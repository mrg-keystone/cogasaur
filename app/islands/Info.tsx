import { useSignal } from "@preact/signals";

// Island: runs in the browser, hits keep over HTTP at /api (embed mounts keep there).
// On localhost the request is trusted — no token needed.
export default function Info() {
  const out = useSignal("(not called yet)");
  const calls = useSignal(0);

  async function ping() {
    const r = await fetch("/api/app/info");
    out.value = JSON.stringify(await r.json(), null, 2);
    calls.value++;
  }

  return (
    <div style="margin-top:16px">
      <button
        onClick={ping}
        style="background:#4cc2ff;color:#001018;border:0;border-radius:7px;padding:8px 13px;font-weight:600;cursor:pointer"
      >
        browser → keep: fetch /api/app/info
      </button>
      <pre style="background:#060a10;border:1px solid #222c3a;border-radius:7px;padding:10px;margin-top:10px;color:#c3d0df">{out.value}</pre>
      <small style="color:#7587a0">island calls: {calls}</small>
    </div>
  );
}
