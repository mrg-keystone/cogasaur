import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

// Externalize ONLY keep's backend dependency tree from the SSR bundle (Deno resolves
// it at runtime). Do NOT externalize preact/fresh — bundling them keeps a single
// preact instance; externalizing them gives the SSR server a second copy and renders
// silently empty (the Preact-dedupe footgun). node: builtins are always external.
const ssrExternal = (id: string) =>
  id.startsWith("node:") ||
  /(@mrg-keystone|@danet|reflect-metadata|class-validator|class-transformer|path-to-regexp|jose|@opentelemetry|handlebars)/
    .test(id);

export default defineConfig({
  plugins: [fresh(), tailwindcss()],
  resolve: {
    dedupe: ["preact", "preact/hooks", "preact/jsx-runtime", "@preact/signals"],
  },
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          external: ssrExternal,
        },
      },
    },
  },
});
