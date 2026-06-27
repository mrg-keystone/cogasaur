# cogasaur — bug report: published scaffold does not build (`./@…` import rewrite)

**Severity: blocker.** `cogasaur new` produces an app that fails to type-check, fails
`sprig build`, and fails `deno install` / `deno serve` out of the box. The authored
source in this repo is correct — the breakage is introduced **at publish time**.

- Reported: 2026-06-27
- Repro env: deno (current), `rune` 2.0.0, `sprig` 0.12.7, macOS (darwin 24.5.0)
- Affected: published `@mrg-keystone/cogasaur@0.2.1` (latest on JSR). v0.1.0 is broken
  in a different way (see "Secondary findings").

---

## TL;DR

The `app/**/*.ts` template files import workspace aliases (`@sprig/core`,
`@sprig/keep`, `@mrg-keystone/rune`, `@webview/webview`, `@/…`). Those are correct in
the source. But the JSR-published package serves those same files with every alias
**rewritten to a relative path** (`./@sprig/core`, `./@mrg-keystone/rune`, `./@/…`).
The scaffolder copies the published files **verbatim**, so a freshly scaffolded app is
full of `import … from "./@sprig/core"`, which Deno resolves as the *file*
`ui/src/@sprig/core` → `TS2307 module not found`. Nothing in the toolchain (Deno,
sprig, rune) produces or resolves that form.

---

## Reproduction

```bash
deno run -A jsr:@mrg-keystone/cogasaur@0.2.1 new probe-app
cd probe-app
deno install            # ✗ error: Module not found ".../ui/src/@sprig/core"
deno check serve.ts     # ✗ 6× TS2307 (see below)
deno task build         # ✗ sprig: "Cannot read file: .../islands/info-live/@sprig/core"
```

`deno check serve.ts` (6 errors):

```
TS2307: Cannot find module '.../@sprig/keep'                       serve.ts:8
TS2307: Cannot find module '.../server/bootstrap/@mrg-keystone/rune'  mod.ts:5
TS2307: Cannot find module '.../server/bootstrap/@/bootstrap/config.ts'   mod.ts:6
TS2307: Cannot find module '.../server/bootstrap/@/bootstrap/modules.ts'  mod.ts:7
TS2307: Cannot find module '.../ui/src/@sprig/core'               main.ts:10
TS2307: Cannot find module '.../ui/src/@sprig/keep'               main.ts:11
```

---

## Evidence: source is correct, the published artifact is not

**Source in this repo (correct — bare aliases):**

```
app/serve.ts:8                    import { serveSprig } from "@sprig/keep";
app/ui/src/main.ts:10             } from "@sprig/core";
app/server/bootstrap/mod.ts:5     import { bootstrapServer } from "@mrg-keystone/rune";
app/server/bootstrap/mod.ts:6     import { config } from "@/bootstrap/config.ts";
```

`grep -rn 'from "\./@' app/` → **0 matches.** The `dooks` (HEAD) commit's only import
change was `+import { signal } from "@sprig/core"` (bare); it didn't even touch
`serve.ts`/`main.ts`.

**Published `@mrg-keystone/cogasaur@0.2.1` (broken — `./@…`), fetched live from JSR:**

```
$ curl -s https://jsr.io/@mrg-keystone/cogasaur/0.2.1/app/serve.ts
8:  import { serveSprig } from "./@sprig/keep";

$ curl -s https://jsr.io/@mrg-keystone/cogasaur/0.2.1/app/ui/src/main.ts
10:  } from "./@sprig/core";
11:  import { createRenderer } from "./@sprig/keep";
12:  import { dirname, fromFileUrl } from "jsr:@std/path@1";   # ← also rewritten
```

**Internally inconsistent:** the *same published package* still ships an `app/deno.json`
whose import map defines the **bare** aliases — so the published template's imports do
not match the import map shipped beside them:

```
$ curl -s https://jsr.io/@mrg-keystone/cogasaur/0.2.1/app/deno.json
"@sprig/core": "jsr:@sprig/core@^0.12.7"     # bare key — no leading ./
```

The scaffolder does **not** transform anything — `cli/main.ts > copyTemplate()` fetches
each manifest entry and writes the bytes verbatim. So the `./@…` is baked into the
published bytes, before the CLI ever runs.

---

## Root cause (strong hypothesis — please confirm against the publish pipeline)

The `app/**/*.ts` template files are **included in cogasaur's own JSR publish graph**
(`deno.json > publish.include: ["app/", …]`), so the publish step type-resolves and
**rewrites their import specifiers**. cogasaur's **root** `deno.json` maps only
`@std/path` — it does **not** map `@sprig/*`, `@mrg-keystone/rune`, `@webview/webview`,
or `@/`. From the publisher's point of view those are unresolvable bare specifiers, so
each `@…` is rewritten to a relative `./@…` path. This matches every observation:

- *Every* `@`-prefixed specifier gained a `./` — including the locally-mapped `@/`
  (`@/bootstrap/config.ts` → `./@/bootstrap/config.ts`), because the mapping lives in
  the **nested** `app/server/deno.json`, which the root publish graph doesn't apply.
- `jsr:@std/path@1` was left as-is in some files / rewritten in others — consistent
  with per-file graph resolution rather than a deliberate template choice.

The template `.ts` files are meant to be **inert text** copied into a *new* project
(where the app's own `deno.json`/`ui/deno.json`/`server/deno.json` resolve the aliases),
**not** treated as cogasaur's source. The publish pipeline doesn't know that.

**To confirm:** download the published tarball and diff against `app/`
(`deno run -A jsr:@mrg-keystone/cogasaur@0.2.1` source view, or the JSR "files" tab),
and inspect the reusable `mrg-keystone/actions/.github/workflows/jsr-publish.yml@main`
for any graph/rewrite step.

---

## Recommended fixes (prioritized)

1. **Stop the publisher from treating template files as source.** Make `app/` template
   files inert so their imports are never rewritten. Cleanest option: store them with a
   non-resolved extension (e.g. `serve.ts.tmpl`, or under `templates/` as `.txt`) and
   have `copyTemplate()` strip the suffix on write; update `gen-manifest.ts` accordingly.
   Alternatively, ensure the publish step does not import-rewrite `app/**` (exclude it
   from the type graph) — but inert templates is the robust fix, since the files
   intentionally reference aliases that only exist in the *scaffolded* project.

2. **Add a scaffold→build smoke test to CI — the highest-value fix.** `publish.yml`
   currently only validates + publishes; it never runs the produced app. A post-publish
   (or pre-publish, against a packed tarball) job like:

   ```bash
   deno run -A jsr:@mrg-keystone/cogasaur@$VERSION new smoke
   cd smoke && deno install && deno check serve.ts && deno task build
   ```

   would have caught **both** this `./@…` breakage and the v0.1.0 `.gitignore` 404
   before release. Right now the package can publish green while producing a non-building
   app.

3. **Republish** once 1–2 land, and yank/deprecate the broken 0.1.0–0.2.1 if feasible.

---

## Secondary findings

- **v0.1.0 crashes the scaffolder entirely:** `cogasaur new` (the globally-installed
  CLI, which `deno install -gA … cogasaur` pinned to 0.1.0) throws
  `failed to read template file .gitignore: 404`. JSR does not serve dotfiles, so any
  dotfile in `TEMPLATE_FILES` is unfetchable. The current manifest no longer lists
  `.gitignore`, so this specific crash is gone — but the CLI should **generate**
  `.gitignore` itself rather than template it, to prevent a regression if one is re-added
  to `app/`.

- **Stale global install is a sharp edge.** The README's
  `deno install -gA -n cogasaur jsr:@mrg-keystone/cogasaur` pins whatever was latest at
  install time (here 0.1.0) and never auto-updates, so users hit the *old* broken
  version even after you publish a fix. Recommend documenting `-f` reinstall, or having
  the CLI warn when a newer version exists.

- **Version drift:** repo `deno.json` says `"version": "0.2.0"` while JSR latest is
  `0.2.1` (auto-bumped); the installed CLI's `help` banner prints `0.2.0` even when
  resolved from 0.2.1. Cosmetic, but confusing when triaging.

- **Help text vs README stack drift:** the installed CLI `help` describes a
  "keep + Fresh 2 (routes/ + islands/)" app, while the README and 0.2.x template are
  "rune + sprig". Align the CLI help with the current stack.

---

## Workaround (for users, until a fix ships)

In a freshly scaffolded app, strip the spurious leading `./` from aliased imports:

```bash
# preview
grep -rl 'from "\./@' --include='*.ts' . | grep -v node_modules
# fix (review first): ./@  →  @   in every *.ts
```

rune-generated files self-heal on the next `rune sync` (it emits the correct `@/`
form); only the cogasaur-authored files (`serve.ts`, `shell.ts`, `ui/src/main.ts`,
`ui/src/islands/**`, `ui/src/pages/**`, `server/bootstrap/mod.ts`) need the manual pass.

---

## Not at fault (ruled out with evidence)

- **rune** (`@mrg-keystone/rune` 2.0.0): when it regenerates a file it emits correct
  bare `@/` imports — e.g. re-running `rune sync` rewrote `bootstrap/modules.ts` from
  the shipped `./@/src/info/…` to `@/src/info/…`.
- **sprig** (`@sprig/core` 0.12.7): `sprig build` correctly **rejects** `./@sprig/core`;
  its convention is the bare `@sprig/core` the `deno.json` import map defines. sprig does
  not author the affected files.
