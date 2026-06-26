# cogasaur

Build Electron-style desktop apps on a pure Deno stack — **keep** backend + **Fresh 2** SSR
frontend + a **native webview** window, all in **one process**. No Node, no bundled Chromium.

## Architecture (one process, two threads)

```
main thread   → native webview window  →  loads http://localhost:<port>
worker thread → Deno.serve( built Fresh app .use(embed(keep,{at:'/api'})) )
                SSR reads keep IN-PROCESS via ctx.state.api.fetch   ← "the bridge"
                browser islands hit /api over HTTP (localhost-trusted)
```

`webview.run()` blocks the main thread's event loop, so the Fresh+keep server runs on a
worker thread — that's what keeps it one process while the window stays responsive.

## Scaffold an app

```bash
# one-time: put the CLI on your PATH
cd cogasaur
deno task install               # installs `cogasaur` globally

# scaffold (copies the template + runs `deno install`)
cogasaur new my-app
#   or, without a global install:  deno task new my-app

# run it
cd my-app
deno task desktop               # build the Fresh app + open the native window
# or
deno task start                 # run the same app in a browser instead
```

## What a scaffolded app contains

```
my-app/
  backend.ts          keep app — your @Endpoint controllers (the privileged "main process")
  main.ts             Fresh App: staticFiles + embed(keep,{at:'/api'}) + fsRoutes
  routes/index.tsx    SSR route — loads keep via ctx.state.api.fetch in a handler
  islands/Info.tsx    island — calls keep at /api in the browser
  shell.ts            desktop entry: spawns the worker + opens the native window
  server.worker.ts    worker: serves the built Fresh+keep handler
  vite.config.ts      SSR externalization of keep's deps + preact dedupe
  utils.ts            State extends KeepState (so ctx.state.api is typed)
  deno.json           tasks: build · start (web) · desktop (window) · shell
```

## Add a backend capability

1. Add an `@Endpoint` to `backend.ts` (e.g. `@Endpoint({ method:"get", path:"files", output: ... })`).
2. SSR it: in a route handler, `await ctx.state.api.fetch("/app/files")` (in-process, no token).
3. Or call it from the browser: `fetch("/api/app/files")` in an island.

keep's cake (`/docs/<module>`) and system map (`/docs/_map`) are available in the window for free.

## Notes / gotchas (already handled in the template)

- keep's `@Endpoint` path defaults to the **controller root** — always set `path` explicitly.
- The SSR build externalizes **only keep's dep tree** (preact/fresh stay bundled — externalizing
  them gives a second preact instance and a silently-empty render).
- The runtime tasks pass `--node-modules-dir=auto` so Deno resolves keep's externalized deps.
