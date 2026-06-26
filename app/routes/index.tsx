import { define } from "../utils.ts";
import Info from "../islands/Info.tsx";

// Async data loading goes in the HANDLER (runs server-side). The page stays sync.
export const handler = define.handlers({
  async GET(ctx) {
    // Read keep IN-PROCESS via ctx.state.api.fetch (no network hop, no token).
    const info = await (await ctx.state.api.fetch("/app/info")).json();
    return { data: { info } };
  },
});

export default define.page<typeof handler>(function Home(ctx) {
  const { info } = ctx.data;

  return (
    <div class="px-4 py-8 mx-auto min-h-screen" style="background:#0a0e14;color:#d7e0ea;font-family:system-ui">
      <div class="max-w-screen-md mx-auto">
        <h1 class="text-2xl font-bold">🦕 cogasaur · keep + Fresh</h1>
        <p style="color:#7587a0" class="my-2">
          This page is <b>SSR'd by Fresh</b>; the values below were read from keep{" "}
          <b>in-process</b> (<code>ctx.state.api.fetch</code> — no network, no token).
        </p>
        <ul style="font-family:ui-monospace,Menlo,monospace;color:#4cc2ff" class="my-4">
          <li>runtime: {info.runtime}</li>
          <li>pid: {info.pid}</li>
          <li>cwd: {info.cwd}</li>
          <li>mem: {info.mem}</li>
        </ul>
        <Info />
      </div>
    </div>
  );
});
