import { accessSync, constants } from "node:fs";
import { join } from "node:path";

export type FfmpegBinaries = {
  ffmpeg: string;
  ffprobe: string;
};

const COMMON_FFMPEG_PATHS = [
  process.env.FFMPEG_PATH?.trim(),
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/opt/local/bin/ffmpeg",
].filter(Boolean) as string[];

const COMMON_FFPROBE_PATHS = [
  process.env.FFPROBE_PATH?.trim(),
  "/opt/homebrew/bin/ffprobe",
  "/usr/local/bin/ffprobe",
  "/opt/local/bin/ffprobe",
].filter(Boolean) as string[];

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveFromCandidates(candidates: string[], fallback: string): string {
  for (const candidate of candidates) {
    if (isExecutable(candidate)) return candidate;
  }
  return fallback;
}

/** Resolve caminhos do ffmpeg/ffprobe (env, Homebrew, PATH). */
export function resolveFfmpegBinaries(): FfmpegBinaries {
  return {
    ffmpeg: resolveFromCandidates(COMMON_FFMPEG_PATHS, "ffmpeg"),
    ffprobe: resolveFromCandidates(COMMON_FFPROBE_PATHS, "ffprobe"),
  };
}

export function ffmpegInstallHint(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return "Instale com: brew install ffmpeg";
  }
  if (platform === "linux") {
    return "Instale com: sudo apt install ffmpeg (Debian/Ubuntu) ou equivalente.";
  }
  return "Instale ffmpeg e garanta que está no PATH, ou defina FFMPEG_PATH e FFPROBE_PATH.";
}

/** Diretório pai do binário (útil para PATH mínimo em subprocessos). */
export function ffmpegBinDir(bin: string): string | null {
  if (!bin.includes("/")) return null;
  return join(bin, "..");
}
