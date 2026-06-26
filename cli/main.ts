#!/usr/bin/env -S deno run -A
// cogasaur — scaffold desktop apps on the Deno stack:
// rune backend + sprig SSR frontend + native webview, one origin, one process.
import { Command } from "jsr:@cliffy/command@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";
import { dirname, join, resolve } from "jsr:@std/path@1";
import { TEMPLATE_FILES } from "./template-manifest.ts";

const VERSION = "0.2.0";
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
}

const newCmd = new Command()
  .description("Scaffold a new cogasaur desktop app into <parent>/<name>.")
  .arguments("<name:string>")
  .option("--dir <parent:string>", "Parent directory to scaffold into.", { default: "." })
  .option("--no-install", "Skip the post-scaffold `deno install`.")
  .action(async (opts, name) => {
    const target = resolve(opts.dir, name);
    if (await exists(target)) {
      throw new Error(`refusing to scaffold: ${target} already exists`);
    }

    await copyTemplate(target);
    await applyName(target, name);

    if (opts.install) {
      console.log("  installing dependencies (deno install)…");
      const install = await new Deno.Command("deno", {
        args: ["install"],
        cwd: target,
        stdout: "inherit",
        stderr: "inherit",
      }).output();
      if (!install.success) {
        console.error(
          colors.yellow(`⚠ deno install failed — run it yourself in ${name}/ before building.`),
        );
      }
    }

    console.log(`
${colors.green("✓")} scaffolded ${colors.bold(name)} → ${target}

  cd ${name}
  deno task desktop      ${colors.dim("# build the UI + open the native window")}

  ${colors.dim("needs the rune + sprig CLIs — see the generated README.md")}
`);
  });

const cli = new Command()
  .name("cogasaur")
  .version(VERSION)
  .description("Desktop apps on Deno — rune backend + sprig SSR + native webview.")
  .action(function () {
    this.showHelp();
  })
  .command("new", newCmd)
  .error((err: Error) => {
    console.error(colors.red("✗ ") + err.message);
    Deno.exit(1);
  });

if (import.meta.main) {
  await cli.parse(Deno.args);
}
