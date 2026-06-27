#!/usr/bin/env -S deno run -A
// Pre-publish invariants for the app/ template. Run before pushing:
//   deno task verify
//
// Guards the two regressions that have shipped broken @mrg-keystone/cogasaur
// packages before — both invisible to a plain local scaffold, because local
// reads go straight to the source files and never exercise the publish path:
//
//   1. Publish-time import rewrite. `deno publish` parses every TS/JS module in
//      the package graph and rewrites import specifiers it can't resolve through
//      the *root* import map (which only maps @std/path). The app/ template's
//      `@sprig/*`, `@mrg-keystone/rune`, `@webview/webview`, `@/…` specifiers
//      resolve only in the *scaffolded* app's deno.json — so publish rewrote them
//      to `./@sprig/core` etc., and every scaffold was full of TS2307. The fix:
//      template sources carry an inert `.tmpl` suffix (unknown media type → shipped
//      raw, never parsed). This check fails if any live module sneaks back in.
//
//   2. Missing-file 404. `deno publish` silently drops some files (notably
//      `.gitignore`) from the package. A manifest entry the registry won't serve
//      makes `cogasaur new` throw `failed to read template file …: 404`. This check
//      fails if any TEMPLATE_FILES entry isn't in the set publish actually ships.
import { TEMPLATE_FILES } from "./template-manifest.ts";

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

// (1) No live JS/TS module may sit in the template — it would be import-rewritten.
const LIVE_MODULE = /\.(?:[mc]?tsx?|[mc]?jsx?)$/;
for (const rel of TEMPLATE_FILES) {
  if (LIVE_MODULE.test(rel)) {
    fail(
      `"${rel}" is a live module in the template — rename it to "${rel}.tmpl" so ` +
        `deno publish ships it raw instead of rewriting its imports`,
    );
  }
}

// (2) Everything in the manifest must be in what `deno publish` actually ships.
const dry = await new Deno.Command("deno", {
  args: ["publish", "--dry-run", "--allow-dirty", "--no-check"],
  stdout: "piped",
  stderr: "piped",
}).output();
const out = new TextDecoder().decode(dry.stdout) +
  new TextDecoder().decode(dry.stderr);
if (!dry.success) {
  fail(`deno publish --dry-run failed:\n${out}`);
} else {
  // Lines look like:  file:///…/app/serve.ts.tmpl (829B)
  const shipped = new Set(
    [...out.matchAll(/file:\/\/.*?\/app\/(.+?) \(/g)].map((m) => m[1]),
  );
  for (const rel of TEMPLATE_FILES) {
    if (!shipped.has(rel)) {
      fail(
        `"${rel}" is in the manifest but deno publish does NOT ship it — ` +
          `scaffolds will 404 fetching it from JSR`,
      );
    }
  }
}

if (errors.length) {
  console.error("✗ template invariants violated:\n");
  for (const e of errors) console.error(`  • ${e}\n`);
  Deno.exit(1);
}
console.log(
  `✓ ${TEMPLATE_FILES.length} template files: all inert (no live modules) + all published`,
);
