// SSR loader for the home page (runs on the SERVER only). Because it is a
// resolve.ts — not an island's logic.ts — it may inject(Backend) and read the
// rune backend IN-PROCESS (no network hop, no token). Its return value becomes
// the page template's binding scope.
import { Backend, inject, type Resolve } from "@sprig/core";

export const resolve: Resolve = async () => {
  const be = inject(Backend); // bound by serveSprig during SSR
  const { ok, data } = await be.get("/http/read", { method: "POST" });
  return { info: ok ? data : null };
};
