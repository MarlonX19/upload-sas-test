import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const coreSrcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const ffmpegSrcDir = join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const destDir = join(root, "public", "ffmpeg");

const coreFiles = ["ffmpeg-core.js", "ffmpeg-core.wasm"];
/** Worker ESM + deps (relative imports from worker.js). */
const workerFiles = ["worker.js", "const.js", "errors.js"];

if (!existsSync(join(coreSrcDir, "ffmpeg-core.wasm"))) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core assets not found; skip copy.");
  process.exit(0);
}

if (!existsSync(join(ffmpegSrcDir, "worker.js"))) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/ffmpeg worker.js not found; skip copy.");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
for (const name of coreFiles) {
  copyFileSync(join(coreSrcDir, name), join(destDir, name));
}
for (const name of workerFiles) {
  copyFileSync(join(ffmpegSrcDir, name), join(destDir, name));
}
console.log(
  "[copy-ffmpeg-core] Copied core + worker assets to public/ffmpeg/:",
  [...coreFiles, ...workerFiles].join(", "),
);
