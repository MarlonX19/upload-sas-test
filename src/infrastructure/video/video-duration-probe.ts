import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "fluent-ffmpeg";

import {
  ffmpegBinDir,
  resolveFfmpegBinaries,
} from "@/infrastructure/video/resolve-ffmpeg-binaries";

const execFileAsync = promisify(execFile);

/** Converte "Duration: 00:01:23.45" do stderr do ffmpeg para segundos. */
export function parseDurationFromFfmpegOutput(text: string): number {
  const match = text.match(/Duration:\s*(\d+):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!match) return 0;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3]);
  const frac = match[4] ? Number(`0.${match[4]}`) : 0;
  const total = h * 3600 + m * 60 + s + frac;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

function execEnv(): NodeJS.ProcessEnv {
  const bins = resolveFfmpegBinaries();
  const dir = ffmpegBinDir(bins.ffmpeg);
  if (!dir) return process.env;
  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  const current = process.env[pathKey] ?? "";
  if (current.split(":").includes(dir)) return process.env;
  return { ...process.env, [pathKey]: `${dir}:${current}` };
}

function durationFromFfprobeMetadata(metadata: ffmpeg.FfprobeData): number {
  let best = 0;
  const formatDur = metadata.format.duration;
  if (typeof formatDur === "number" && Number.isFinite(formatDur) && formatDur > 0) {
    best = formatDur;
  }
  for (const stream of metadata.streams ?? []) {
    const sd = stream.duration;
    if (typeof sd === "number" && Number.isFinite(sd) && sd > best) {
      best = sd;
    }
  }
  return best;
}

async function probeDurationViaFfmpegStderr(videoPath: string): Promise<number> {
  const bins = resolveFfmpegBinaries();
  try {
    await execFileAsync(bins.ffmpeg, ["-hide_banner", "-i", videoPath, "-f", "null", "-"], {
      maxBuffer: 2 * 1024 * 1024,
      env: execEnv(),
    });
  } catch (e: unknown) {
    const err = e as { stderr?: string; stdout?: string };
    const text = `${err.stderr ?? ""}\n${err.stdout ?? ""}`;
    return parseDurationFromFfmpegOutput(text);
  }
  return 0;
}

/**
 * Duração do vídeo em segundos. WebM do MediaRecorder costuma não ter duration no format;
 * usamos fallbacks (streams + decode via stderr do ffmpeg).
 */
export async function probeVideoDurationSec(
  videoPath: string,
  ffprobe: (path: string) => Promise<ffmpeg.FfprobeData>,
): Promise<number> {
  let duration = 0;
  try {
    const metadata = await ffprobe(videoPath);
    duration = durationFromFfprobeMetadata(metadata);
  } catch {
    duration = 0;
  }

  if (duration < 1) {
    duration = await probeDurationViaFfmpegStderr(videoPath);
  }

  return duration;
}
