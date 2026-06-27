// Desktop entry (main thread). Spawns the server worker, then owns the native
// window. webview.run() blocks this thread, but the server lives on the worker,
// so the window stays responsive. Run after a build: `deno task desktop`.
import { SizeHint, Webview } from "@webview/webview";

const worker = new Worker(new URL("./server.worker.ts", import.meta.url).href, {
  type: "module",
});

const port = await new Promise<number>((resolve) => {
  worker.onmessage = (e) => {
    if (e.data?.type === "ready") resolve(e.data.port);
  };
});
console.log(`[shell] rune+sprig ready on http://localhost:${port}/ui — opening window`);

const w = new Webview(false, { width: 1040, height: 720, hint: SizeHint.NONE });
w.title = "cogasaur app";
w.navigate(`http://localhost:${port}/ui`);
w.run(); // blocks until the window closes

console.log("[shell] window closed — tearing down");
worker.terminate();
Deno.exit(0);
