// main.ts — the shell (main thread). Spawns the server worker, then owns the native window.
// webview.run() blocks this thread, but the server lives on the worker thread, so it keeps serving.
import { SizeHint, Webview } from "@webview/webview";

const worker = new Worker(new URL("./server.worker.ts", import.meta.url).href, {
  type: "module",
});

const port = await new Promise<number>((resolve) => {
  worker.onmessage = (e) => {
    if (e.data?.type === "ready") resolve(e.data.port);
  };
});
console.log(`[shell] keep+server ready on http://localhost:${port} — opening native window`);

const w = new Webview(false, { width: 960, height: 660, hint: SizeHint.NONE });
w.title = "cogasaur";
w.navigate(`http://localhost:${port}`);
w.run(); // blocks until the window closes

console.log("[shell] window closed — tearing down");
worker.terminate();
Deno.exit(0);
