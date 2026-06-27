# sprig — bug reports (CLI load crash + `sprig build` grammar-wasm failure)

Two independent defects in `@sprig/core` that each make the published CLI unusable for a
documented workflow. The first is **fixed in 0.12.8**; the second is **still open** and
blocks `sprig build` entirely.

- Reported: 2026-06-27
- Repro env: Deno 2.8.3 (aarch64-apple-darwin), `@sprig/core` 0.12.8 (current latest on JSR)
- Install under test (documented path): `deno install -gAf -n sprig jsr:@sprig/core/cli`

| # | Defect | Affects | Status |
|---|--------|---------|--------|
| 1 | `fromFileUrl(import.meta.url)` at module load → every command crashes from `jsr:` | whole CLI (`--help`, `-v`, `build`, …) | ✅ Fixed in 0.12.8 |
| 2 | bundled `grammar.wasm` can't be instantiated by `web-tree-sitter` → template parse throws | `sprig build` (and any template parse) | ❌ Open in 0.12.8 |

There is also one cosmetic issue: `sprig -v` prints `sprig ?` — the CLI can't resolve its
own version when run from a `jsr:` install. Not a crash; noted for completeness.

---

# Finding 2 (OPEN, blocker) — `sprig build`: bundled `grammar.wasm` is incompatible with the `web-tree-sitter` it ships with

**Severity: blocker for `sprig build`.** A build cannot parse a single template. This is
**not** environmental and **not** `jsr:`-install-specific — it reproduces in a 6-line
script against the published wasm, so it fails wherever sprig is installed from.

## TL;DR

`sprig build` parses every `template.html` with tree-sitter (`framework/.sprig/compiler/
parse.ts` — and `build.ts:64` notes this is "the only place tree-sitter runs"). Loading the
bundled angular-template grammar throws at instantiation:

```
TypeError: WebAssembly.instantiate(): Import #0 "./env": module is not an object or function
```

The published `grammar.wasm` is a **dynamically-linked (PIC) side module**: it imports its C
runtime from a module named **`./env`**. But `web-tree-sitter`'s `Language.load()`
instantiates the grammar **without** a `./env` import object, so `imports["./env"]` is
`undefined` and instantiation fails before any parsing happens.

## Reproduction (isolated — no sprig CLI, no app)

```ts
// repro.ts — mirrors framework/.sprig/compiler/parse.ts exactly
import { Language, Parser } from "npm:web-tree-sitter@^0.25";
await Parser.init();                                    // ✓ succeeds
const bytes = new Uint8Array(await (await fetch(
  "https://jsr.io/@sprig/core/0.12.8/framework/.sprig/compiler/grammar.wasm",
)).arrayBuffer());                                      // ✓ fetches 85,981 bytes
const lang = await Language.load(bytes);                // ✗ throws here
const p = new Parser(); p.setLanguage(lang);
```

```bash
$ deno run -A repro.ts
error: Uncaught (in promise) TypeError: WebAssembly.instantiate():
       Import #0 "./env": module is not an object or function
```

`Parser.init()` and the fetch both succeed — **only `Language.load()` fails.**

## Evidence: the grammar imports a `./env` side-module

Dumping the grammar's import section (`WebAssembly.Module.imports`) shows a single import
module, `./env`, with 16 entries:

```
module "./env" (16 imports):
  memory:memory, __indirect_function_table:table, __stack_pointer:global,
  __memory_base:global, __table_base:global, calloc:function,
  towupper:function, iswspace:function, …
```

`__memory_base`, `__table_base`, `__stack_pointer`, `__indirect_function_table` are the
fingerprint of an **emscripten / wasm-ld relocatable *side module*** (a `-shared`/PIC build).
A grammar produced by the standard `tree-sitter build --wasm` is instead a **self-contained**
module whose imports `web-tree-sitter` satisfies under the module name `env` (no leading
`./`). The leading `./` is the tell that this wasm was linked as a relative side module that
expects a dynamic linker to supply `./env` — which `web-tree-sitter` does not do.

## It's the wasm's format, not a single bad runtime version

The same `grammar.wasm` fails to instantiate on **both** web-tree-sitter 0.24 and 0.25 (using
each version's correct API shape — 0.24's `Parser.Language.load` default export, 0.25's named
`{ Language }`):

```
web-tree-sitter ~0.24  →  TypeError … Import #0 "./env" …
web-tree-sitter ~0.25  →  TypeError … Import #0 "./env" …   (sprig depends on ^0.25 → 0.25.10)
```

So pinning the runtime won't help — the grammar itself is built in a format no stock
`web-tree-sitter` can load. This wasm has, in effect, never been loadable by the runtime
sprig ships with.

## Root cause

`grammar.wasm` was compiled with the wrong wasm toolchain/flags — a relocatable emscripten
side module (`./env` dynamic-linking imports) rather than the self-contained module
`tree-sitter build --wasm` emits and `web-tree-sitter@^0.25`'s `Language.load()` expects.
Most likely either the grammar was built with a raw `emcc -sSIDE_MODULE` / `wasm-ld -shared`
invocation, or a stale/wrong `grammar.wasm` got published.

## Recommended fixes (prioritized)

1. **Rebuild `grammar.wasm` with the official tree-sitter wasm toolchain** so its ABI matches
   the runtime:

   ```bash
   # from the grammar dir, with tree-sitter-cli >= 0.25 (matching web-tree-sitter ^0.25)
   tree-sitter build --wasm
   ```

   The output should import its runtime from `env` (not `./env`) and load via
   `Language.load()` with no import object — confirm with `WebAssembly.Module.imports()`.

2. **Pin the toolchain to the runtime.** Keep the `tree-sitter-cli` used to build the grammar
   and the `web-tree-sitter` dependency on the same minor (both `0.25.x`), so a future
   web-tree-sitter bump can't silently re-introduce an ABI skew.

3. **Add a build smoke test that actually parses one template** (the repro above, three lines:
   `Parser.init()` → `Language.load(grammar.wasm)` → `parse("<div></div>")`). The current test
   surface never instantiates the grammar, so a mis-built wasm ships green — exactly how this
   reached a published release.

## Not at fault

- **`web-tree-sitter`** is correct to reject the module: it's asked to instantiate a wasm that
  imports a `./env` module it was never given. The defect is the grammar's build format.
- **The downstream app / install path** is irrelevant: the repro uses only `web-tree-sitter`
  + the published `grammar.wasm`, with no sprig CLI and no project, and the bytes are identical
  whether sprig is installed from `jsr:` or a working tree.

---

# Finding 1 (FIXED in 0.12.8) — CLI crashed on load from `jsr:` via `fromFileUrl(import.meta.url)`

**Was: blocker. Now: resolved in 0.12.8.** Recorded here for traceability.

## What it was

`framework/cli.ts` (the `./cli` export) **statically** imports `./.sprig/annotate.ts`, which
ran a filesystem-path computation at **module top level**:

```ts
// 0.12.7  framework/.sprig/annotate.ts:14
const HERE = dirname(fromFileUrl(import.meta.url));
```

`fromFileUrl()` throws on any non-`file://` URL. Loaded from JSR, `import.meta.url` is
`https://jsr.io/@sprig/core/0.12.7/…`, so the line threw **during module evaluation**, before
argv was parsed — killing *every* command, including `sprig --help` and `sprig -v`:

```
error: Uncaught (in promise) TypeError: URL must be a file URL: received "https:"
    at fromFileUrl (https://jsr.io/@std/path/1.1.5/from_file_url.ts:29:48)
    at https://jsr.io/@sprig/core/0.12.7/framework/.sprig/annotate.ts:14:22
```

(Notably, `framework/.sprig/compiler/build.ts:33` already carried the comment
*"`fromFileUrl(import.meta.url)` would throw on an https URL"* — the same trap, unguarded, on
the CLI's load path.)

## How it's fixed in 0.12.8

`annotate.ts:14` no longer computes a filesystem path at top level. The sibling overlay asset
is now resolved relative to the module URL (`new URL("./annotate-client.js", import.meta.url)`
+ `fetch`, which reads both `file://` and `https://`), with a comment spelling out the exact
failure mode that was happening. Verified: `sprig --help` and `sprig -v` now run with no crash.

## Still worth auditing

Several other `fromFileUrl(import.meta.url)` sites remain inside command handlers (lazy, so
they only fire if that path runs from a `jsr:` install) — latent versions of the same bug:

```
framework/cli.ts: 135, 178, 216, 385, 628, 644, 655, 703
framework/.sprig/compiler/build.ts: 384
```

Deno's `import.meta.dirname` / `import.meta.filename` return `undefined` (they don't throw) for
remote modules — the non-throwing idiom for these sites.
