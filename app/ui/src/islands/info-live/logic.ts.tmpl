// An island (it has a logic.ts, so it ships JS and hydrates). It reads the SAME
// rune endpoint the page SSR'd — but from the browser, over the token-gated /api
// channel that serveSprig exposes at /api/* on this origin.
//
// Browser-mutable state MUST be a signal() — the render effect only re-runs for
// signals it read during render. Plain class fields aren't tracked, so assigning
// to one (even synchronously) never repaints. Read a signal by CALLING it in the
// template (info(), error()); write it with .set().
import { signal } from "@sprig/core";

type Info = { runtime: string; pid: number; app: string };

export default class InfoLive {
  info = signal<Info | null>(null);
  error = signal("");

  async refresh() {
    this.error.set("");
    try {
      const res = await fetch("/api/http/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.info.set(await res.json());
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
