/// <reference lib="deno.worker" />
// server.worker.ts — runs the BUILT Fresh app (which embeds keep) on a worker thread,
// so the main thread's blocking webview.run() can't starve it. One process, two threads.
import handler from "./_fresh/server.js";

const server = Deno.serve({
  port: 0,
  onListen: ({ port }) => {
    (self as unknown as Worker).postMessage({ type: "ready", port });
  },
  // forward `info` so keep's localhost trust keeps working for /api calls from the window
}, (req, info) => handler.fetch(req, info));

await server.finished;
