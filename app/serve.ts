// The single-origin composition root. One serveSprig() {fetch} handler folds:
//   • the rune backend (api): the in-process Backend for SSR + the token-gated
//     /api/* network channel — security rooted in infra when INFRA_BASE_URL is set
//     (keep's bootstrapServer auto-wires token exchange + JWKS verify + revocation).
//   • the sprig UI (app) mounted at /ui.
// Run for the browser:  deno serve -A --unstable-kv serve.ts   → http://localhost:8000/ui
// Run as a desktop app: deno task desktop                       (shell.ts opens a webview)
import { serveSprig } from "@sprig/keep";
import { api } from "./server/bootstrap/mod.ts"; // rune: bootstrapServer already awaited
import { app } from "./ui/src/main.ts"; // sprig: bootstrap({ routes })

export default serveSprig({ keep: api, app, base: "/ui" });
