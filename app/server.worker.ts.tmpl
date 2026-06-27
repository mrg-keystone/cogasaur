/// <reference lib="deno.worker" />
// Worker thread: hosts the composed serveSprig handler on its own event loop, so
// the main thread's blocking webview.run() can't starve it. Binds to a free port
// and reports it back to the shell.
import handler from "./serve.ts";

Deno.serve({
  port: 0,
  onListen: ({ port }) => {
    (self as unknown as Worker).postMessage({ type: "ready", port });
  },
}, handler.fetch);
