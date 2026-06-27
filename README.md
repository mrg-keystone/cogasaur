# cogasaur

Build desktop apps on a pure Deno stack — a **rune** backend + **sprig** SSR frontend +
a **native webview** window, all on one origin in **one process**. No Node, no bundled
Chromium. Published on JSR as [`@mrg-keystone/cogasaur`](https://jsr.io/@mrg-keystone/cogasaur).

## Architecture (one origin, two threads)

```
main thread   → native webview window  →  loads http://localhost:<port>/ui
worker thread → Deno.serve( serveSprig({ keep: api, app, base:"/ui" }) )
                  api = bootstrapServer("server", modules)    ← rune backend
                  app = bootstrap({ routes, base, renderer })  ← sprig UI
                  /api/*  → rune backend (token-gated network channel)
                  else    → sprig SSR, reading rune IN-PROCESS via inject(Backend)
```

`serveSprig` (`@sprig/core/keep`) folds the rune backend's `{ backend, handler }` and the
sprig UI into one `{ fetch }` handler. `webview.run()` blocks the main thread, so that
handler runs on a worker thread — one process, responsive window.

## Scaffold an app

```bash
# scaffold straight from JSR — always the latest published version, no install:
deno run -A jsr:@mrg-keystone/cogasaur new my-app

cd my-app
deno task desktop      # build the UI + open the native window
deno task start        # or serve in a browser at http://localhost:8000/ui
```

Prefer a pinned global command? Install it — but use `-f` to **reinstall/upgrade**, since
a global install pins whatever was latest at install time and never auto-updates:

```bash
deno install -gAf -n cogasaur jsr:@mrg-keystone/cogasaur   # -f also upgrades in place
cogasaur new my-app                                         # copies the template + runs `deno install`
```

A scaffolded app needs the two framework CLIs (its README repeats this):

```bash
curl -fsSL https://github.com/mrg-keystone/rune/releases/download/latest/install.sh | sh
deno install -gAf -n sprig jsr:@sprig/core/cli
```

## What a scaffolded app contains

```
my-app/
  server/             rune backend
    spec/runes/core.rune   shared [SRV] services
    src/info/info.rune     the info module spec — edit, then `deno task sync`
    src/info/…             generated + filled module (coordinators, dtos, http edge)
    bootstrap/mod.ts       bootstrapServer("server", modules) → `api`
  ui/                 sprig frontend
    src/main.ts            routes + renderer + bootstrap → `app`
    src/shell/             the document layout (<router-outlet>)
    src/pages/home/        resolve.ts (SSR reads the backend in-process) + template
    src/islands/info-live/ an island (ships JS; hits /api in the browser)
  serve.ts            serveSprig composition root
  shell.ts            desktop entry: spawns the worker + opens the native window
  server.worker.ts    worker: serves the serveSprig handler
  deno.json           workspace [server, ui] + tasks: build · start · dev · desktop · sync
```

## Add a backend capability

1. Edit `server/src/info/info.rune` (or add `server/spec/runes/<m>.rune`):
   `[ENT] http.foo(FooDto): BarDto` → `[REQ] thing.foo(FooDto): BarDto` + recipe.
2. `deno task sync` — rune regenerates the module; fill the coordinator/business stubs.
3. SSR it: in a page `resolve.ts`, `inject(Backend).get("/http/foo", { method: "POST", body })`.
4. Or from the browser (island): `fetch("/api/http/foo", { method: "POST", … })`.

## Security — rooted in infra

Because the backend runs on the rune (keep) runtime, security roots in **infra** (the
keystone control plane) automatically: set `INFRA_URL` and the runtime wires the infra
token-exchange client, the offline JWKS verifier, and the revocation poller; endpoints
authorize with `@Public` / `@Roles` / `@claims` + `getIdentity`. Unset locally, the
loopback origin is trusted and SSR reads the backend in-process — the desktop app just works.

## The CLI is published from `main`

Push to `main` → a scaffold smoke test runs first, and only if it's green does the
[`mrg-keystone/actions`](https://github.com/mrg-keystone/actions) JSR workflow validate,
compute the next version, and publish `@mrg-keystone/cogasaur`.

The `app/` template (copied into every scaffold) is shipped via `cli/template-manifest.ts` —
regenerate it with `deno task gen:manifest` after any change under `app/`. Template **source
files carry an inert `.tmpl` suffix** (`serve.ts.tmpl`, …) so `deno publish` ships them raw
instead of parsing them as modules and rewriting their `@sprig/*` / `@/…` imports to broken
`./@…` paths; `cogasaur new` strips the suffix on write. Run `deno task verify` before pushing
— it enforces that every template stays inert and that every manifest entry actually ships.
