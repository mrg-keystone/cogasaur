#!/usr/bin/env -S deno run -A
// cogasaur — scaffold desktop apps on the Deno stack (keep backend + Fresh SSR + native webview).
//
// Usage:
//   cogasaur new <name> [--dir <parent>]
//   cogasaur help
import { dirname, join, resolve } from "jsr:@std/path@1";
import { TEMPLATE_FILES } from "./template-manifest.ts";

const TEMPLATE = new URL("../app/", import.meta.url);

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

// Copy the template by fetching each manifest entry. `fetch` reads both `file://`
// (local checkout / global install) and `https://` (installed from JSR), so the
// same path works no matter where the CLI was loaded from — unlike Deno.readDir,
// which can't enumerate or copy from a remote JSR URL.
async function copyTemplate(dst: string) {
  for (const rel of TEMPLATE_FILES) {
    const res = await fetch(new URL(rel, TEMPLATE));
    if (!res.ok) throw new Error(`failed to read template file ${rel}: ${res.status}`);
    const out = join(dst, rel);
    await Deno.mkdir(dirname(out), { recursive: true });
    await Deno.writeFile(out, new Uint8Array(await res.arrayBuffer()));
  }
}

// Stamp the app's display name into the few places it shows.
async function applyName(dir: string, name: string) {
  const sub = async (rel: string, from: string, to: string) => {
    const p = join(dir, rel);
    try {
      await Deno.writeTextFile(p, (await Deno.readTextFile(p)).replaceAll(from, to));
    } catch { /* file may not exist; ignore */ }
  };
  await sub("shell.ts", `w.title = "cogasaur app";`, `w.title = ${JSON.stringify(name)};`);
  await sub("routes/_app.tsx", `<title>app</title>`, `<title>${name}</title>`);
}

function help() {
  console.log(`cogasaur — desktop apps on Deno (keep + Fresh + native webview)

Usage:
  cogasaur new <name> [--dir <parent>]   Scaffold a new app into <parent>/<name>
  cogasaur help                          Show this help

After scaffolding:
  cd <name>
  deno task desktop      # build the Fresh app + open the native window
  deno task start        # run the same app in a browser instead
  deno task build        # just build (produces _fresh/)

What you get: a keep backend (backend.ts), a Fresh 2 UI (routes/ + islands/) that
embeds keep at /api and SSRs from it in-process, and a one-process native shell
(shell.ts + server.worker.ts).`);
}

async function cmdNew(args: string[]) {
  const name = args.find((a) => !a.startsWith("-"));
  if (!name) {
    console.error("usage: cogasaur new <name> [--dir <parent>]");
    Deno.exit(1);
  }
  const di = args.indexOf("--dir");
  const parent = di >= 0 && args[di + 1] ? args[di + 1] : Deno.cwd();
  const target = resolve(parent, name);

  if (await exists(target)) {
    console.error(`refusing to scaffold: ${target} already exists`);
    Deno.exit(1);
  }

  await copyTemplate(target);
  await applyName(target, name);

  // Populate node_modules (Fresh/Vite needs it) — same step @fresh/init runs.
  console.log("  installing dependencies (deno install)…");
  const install = await new Deno.Command("deno", {
    args: ["install"],
    cwd: target,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!install.success) {
    console.error(`\n⚠ deno install failed — run it yourself in ${name}/ before building.`);
  }

  console.log(`✅ scaffolded "${name}" → ${target}

  cd ${name}
  deno task desktop      # build + open the native window
`);
}

const [cmd, ...rest] = Deno.args;
switch (cmd) {
  case "new":
    await cmdNew(rest);
    break;
  case undefined:
  case "help":
  case "-h":
  case "--help":
    help();
    break;
  default:
    console.error(`unknown command: ${cmd}\n`);
    help();
    Deno.exit(1);
}
