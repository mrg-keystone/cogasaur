# cogasaur app

A desktop app on a pure Deno stack — **rune** backend + **sprig** SSR frontend +
a **native webview**, all on one origin in one process.

## Prerequisites

The two framework CLIs are native tools (like the app's own toolchain):

```bash
# rune — the .rune spec → backend generator
curl -fsSL https://github.com/mrg-keystone/rune/releases/download/latest/install.sh | sh
# sprig — the SSR/build CLI
deno install -gAf -n sprig jsr:@sprig/core/cli
```

## Run

```bash
deno install          # fetch deps (creates node_modules/ for the decorator stack)
deno task desktop     # build the UI + open the native window
# or
deno task start       # serve the same app in a browser at http://localhost:8000/ui
deno task dev         # sprig HMR dev server (UI only)
```

## Architecture (one origin, two threads)

```
main thread   → native webview → loads http://localhost:<port>/ui
worker thread → Deno.serve( serveSprig({ keep: api, app, base:"/ui" }) )
                  api = bootstrapServer("server", modules)   ← rune backend
                  app = bootstrap({ routes, base, renderer }) ← sprig UI
                  /api/*  → rune backend  (token-gated network channel)
                  else    → sprig SSR, reading rune IN-PROCESS via inject(Backend)
```

`serveSprig` (`@sprig/core/keep`) folds the rune backend and the sprig UI into one
`{ fetch }`. `webview.run()` blocks the main thread, so the server runs on a worker
— one process, responsive window.

## Layout

```
server/                 rune backend
  spec/runes/core.rune  shared [SRV] services
  src/info/info.rune    the info module spec (edit, then `deno task sync`)
  src/info/…            generated + filled module (coordinators, dtos, http edge)
  bootstrap/mod.ts      bootstrapServer("server", modules) → `api`
ui/                     sprig frontend
  src/main.ts           routes + renderer + bootstrap → `app`
  src/shell/            the document layout (<router-outlet>)
  src/pages/home/       resolve.ts (SSR, reads backend in-process) + template
  src/islands/info-live/ an island (ships JS; hits /api in the browser)
serve.ts                serveSprig composition root
shell.ts · server.worker.ts   the desktop shell (webview + server worker)
```

## Add a backend endpoint

1. Edit `server/src/info/info.rune` (or add `server/spec/runes/<m>.rune`):
   `[ENT] http.foo(FooDto): BarDto` → `[REQ] thing.foo(FooDto): BarDto` + recipe.
2. `deno task sync` — rune regenerates the module; fill the coordinator/business stubs.
3. SSR it: in a page `resolve.ts`, `inject(Backend).get("/http/foo", { method: "POST", body })`.
4. Or from the browser (island): `fetch("/api/http/foo", { method: "POST", … })`.

## Security — rooted in infra

The backend runs on the rune (keep) runtime, so security roots in **infra** (the
keystone control plane) automatically: set `INFRA_URL` (see `.env.example`) and the
runtime wires the infra token-exchange client, the offline JWKS verifier, and the
revocation poller. Endpoints authorize with `@Public` / `@Roles` / `@claims` +
`getIdentity`. Unset locally, the loopback origin is trusted and SSR reads the
backend in-process with no token — so the desktop app just works.
