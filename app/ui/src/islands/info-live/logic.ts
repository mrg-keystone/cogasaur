// An island (it has a logic.ts, so it ships JS and hydrates). It reads the SAME
// rune endpoint the page SSR'd — but from the browser, over the token-gated /api
// channel that serveSprig exposes at /api/* on this origin.
type Info = { runtime: string; pid: number; app: string };

export default class InfoLive {
  info: Info | null = null;
  error = "";

  async refresh() {
    this.error = "";
    try {
      const res = await fetch("/api/http/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.info = await res.json();
    } catch (e) {
      this.error = (e as Error).message;
    }
  }
}
