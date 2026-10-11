// Builds the whole app into one self-contained HTML page (plus any bundled songs).
//
//   node scripts/build-standalone.mjs [--song path.mp3:"Song name"]... [--out dir]
//
// Writes <out>/index.html (a full document) and <out>/fragment.html (the same page without
// <html>/<head>, for hosts that supply their own document skeleton). Songs passed with --song
// are copied to <out>/songs/ and load automatically on first visit.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const out = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : join(root, "dist", "standalone"));
const songs = [];
args.forEach((a, i) => {
  if (a !== "--song") return;
  const spec = args[i + 1];
  const at = spec.lastIndexOf(":");
  const file = at > 1 ? spec.slice(0, at) : spec;
  const name = at > 1 ? spec.slice(at + 1) : basename(file).replace(/\.[^.]+$/, "");
  songs.push({ file: resolve(file), name });
});

const common = { bundle: true, minify: true, format: "iife", target: "es2020", write: false, logLevel: "error", define: { "process.env.NODE_ENV": '"production"' }, tsconfig: join(root, "tsconfig.json") };
const worker = await build({ ...common, entryPoints: [join(root, "src/lib/audio/analysis.worker.ts")] });
const app = await build({ ...common, entryPoints: [join(root, "src/standalone.tsx")], jsx: "automatic", loader: { ".ts": "ts", ".tsx": "tsx" } });

const safe = (js) => js.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const fonts = readFileSync(join(root, "src/app/layout.tsx"), "utf8").match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/)[0];

mkdirSync(join(out, "songs"), { recursive: true });
const builtIn = songs.map((s, i) => {
  const name = `song-${i + 1}${s.file.match(/\.[^.]+$/)?.[0] ?? ".mp3"}`;
  copyFileSync(s.file, join(out, "songs", name));
  return { id: `builtin-${i + 1}-${name}`, file: `songs/${name}`, name: s.name };
});

const body = `<title>WorshipFlow</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script>window.__PL_WORKER_SRC__ = ${JSON.stringify(worker.outputFiles[0].text).replace(/<\/script/gi, "<\\/script")};
window.__PL_BUILT_IN__ = ${JSON.stringify(builtIn)};</script>
<script>${safe(app.outputFiles[0].text)}</script>
`;
writeFileSync(join(out, "fragment.html"), body);
writeFileSync(join(out, "index.html"), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#0a0d13">\n</head>\n<body>\n${body}</body>\n</html>\n`);
console.log(`Built ${join(out, "index.html")} (${(body.length / 1024).toFixed(0)} KB)${builtIn.length ? ` with ${builtIn.length} song(s)` : ""}`);
