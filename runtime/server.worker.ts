/// <reference lib="deno.worker" />
// server.worker.ts — runs on a WORKER THREAD so it has its own event loop:
// the main thread's blocking webview.run() can't starve it. Hosts keep + HTTP + SSR.
import { api } from "./backend.ts";

const server = Deno.serve({
  port: 0,
  onListen: ({ port }) => {
    (self as unknown as Worker).postMessage({ type: "ready", port });
  },
}, async (req, info) => {
  const url = new URL(req.url);

  // SSR the index page. We read app state from keep IN-PROCESS (no network, no token).
  if (url.pathname === "/") {
    const info0 = await (await api.backend.fetch("/app/info")).json();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>cogasaur</title>
<style>
  body{margin:0;font:14px system-ui;background:#0a0e14;color:#d7e0ea;height:100vh;display:grid;place-items:center}
  .card{background:#11161f;border:1px solid #222c3a;border-radius:12px;padding:28px 34px;max-width:560px}
  h1{font-size:18px;margin:0 0 4px} .sub{color:#7587a0;font-size:12px;margin-bottom:18px}
  dl{display:grid;grid-template-columns:90px 1fr;gap:6px 14px;margin:0}
  dt{color:#7587a0} dd{margin:0;font-family:ui-monospace,Menlo,monospace;color:#4cc2ff}
  .tag{color:#70e1a0;font-family:ui-monospace,Menlo,monospace;font-size:11px}
  a{color:#4cc2ff}
</style></head><body>
  <div class="card">
    <h1>🦕 cogasaur <span class="tag">runtime core</span></h1>
    <div class="sub">SSR'd by a Deno worker · data pulled from keep <b>in-process</b> (no network hop, no token)</div>
    <dl>
      <dt>runtime</dt><dd>${info0.runtime}</dd>
      <dt>pid</dt><dd>${info0.pid}</dd>
      <dt>cwd</dt><dd>${info0.cwd}</dd>
      <dt>mem</dt><dd>${info0.mem}</dd>
    </dl>
    <p class="sub" style="margin-top:18px">live over HTTP in this same window:
      <a href="/app/info">/app/info</a> · <a href="/docs/App">/docs/App</a> (keep's cake)</p>
  </div>
</body></html>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // Everything else → keep's real handler (so /app/info and /docs/* work over HTTP too).
  // Forward `info` so keep's localhost trust keeps working.
  return api.handler(req, info);
});

await server.finished;
