// shell.ts — the desktop entry (main thread). Spawns the server worker, then owns the
// native window. Run after `deno task build`. (`deno task desktop` does both.)
import { SizeHint, Webview } from "@webview/webview";

const worker = new Worker(new URL("./server.worker.ts", import.meta.url).href, {
  type: "module",
});

const port = await new Promise<number>((resolve) => {
  worker.onmessage = (e) => {
    if (e.data?.type === "ready") resolve(e.data.port);
  };
});
console.log(`[shell] Fresh+keep ready on http://localhost:${port} — opening native window`);

const w = new Webview(false, { width: 1040, height: 720, hint: SizeHint.NONE });
w.title = "cogasaur app";
w.navigate(`http://localhost:${port}`);
w.run(); // blocks until the window closes

console.log("[shell] window closed — tearing down");
worker.terminate();
Deno.exit(0);
