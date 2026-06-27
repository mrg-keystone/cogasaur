// The sprig UI member: route table + renderer + app. A route's `load` names a
// page FOLDER (template.html + optional logic.ts); the framework auto-loads it.
// `app` is consumed by ../../serve.ts via serveSprig (mounts the keep/rune
// backend in-process + the UI at /ui on one origin).
import {
  bootstrap,
  defineRoutes,
  type Route,
  type SprigApp,
} from "@sprig/core";
import { createRenderer } from "@sprig/keep";
import { dirname, fromFileUrl } from "@std/path";

export const routes: Route[] = defineRoutes([
  { path: "", load: "pages/home" },
]);

// scan src/ for folder-components and build the SSR renderer once, at boot.
export const renderer = await createRenderer(
  dirname(fromFileUrl(import.meta.url)), // src/ root
  "/ui",
  { dev: !!Deno.env.get("SPRIG_DEV") },
);

export const app: SprigApp = bootstrap({ routes, base: "/ui", renderer });
