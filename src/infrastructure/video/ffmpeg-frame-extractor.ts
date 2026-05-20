import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpeg from "fluent-ffmpeg";

import type { VideoFrameExtractorPort } from "@/application/ports/video-frame-extractor.port";
import { getDtpJobTempDir } from "@/domain/dtp/dtp-temp-storage";
import { buildCandidateTimestamps } from "@/domain/dtp/map-timestamp-to-frame";
import { cleanupDtpJobTempDir } from "@/infrastructure/dtp/dtp-video-file-storage";
import {
  ffmpegBinDir,
  ffmpegInstallHint,
  resolveFfmpegBinaries,
} from "@/infrastructure/video/resolve-ffmpeg-binaries";

const execFileAsync = promisify(execFile);

let binariesConfigured = false;

function ensureFfmpegConfigured(): { ffmpeg: string; ffprobe: string } {
  const bins = resolveFfmpegBinaries();
  if (!binariesConfigured) {
    ffmpeg.setFfmpegPath(bins.ffmpeg);
    ffmpeg.setFfprobePath(bins.ffprobe);
    binariesConfigured = true;
  }
  return bins;
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

function probeDurationSec(videoPath: string): Promise<number> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const dur = metadata.format.duration ?? 0;
      resolve(typeof dur === "number" && Number.isFinite(dur) ? dur : 0);
    });
  });
}

async function detectSceneTimestamps(videoPath: string): Promise<number[]> {
  const bins = ensureFfmpegConfigured();
  try {
    const { stderr } = await execFileAsync(
      bins.ffmpeg,
      [
        "-i",
        videoPath,
        "-vf",
        "select='gt(scene,0.3)',showinfo",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 10 * 1024 * 1024, env: execEnv() },
    );
    const output = stderr ?? "";
    const timestamps: number[] = [];
    const re = /pts_time:([\d.]+)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(output)) !== null) {
      const t = parseFloat(match[1]!);
      if (Number.isFinite(t)) timestamps.push(t);
    }
    return timestamps;
  } catch {
    return [];
  }
}

function extractFrameAt(videoPath: string, timestampSec: number, outPath: string): Promise<void> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestampSec)
      .frames(1)
      .outputOptions(["-q:v", "2"])
      .output(outPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export class FfmpegVideoFrameExtractor implements VideoFrameExtractorPort {
  async extractFrames(input: {
    videoPath: string;
    maxFrames: number;
    sampleIntervalSec: number;
    maxDurationSec: number;
  }): Promise<{ durationSec: number; frames: { timestampSec: number; pngBytes: Uint8Array }[] }> {
    let durationSec = await probeDurationSec(input.videoPath);
    if (durationSec > input.maxDurationSec) {
      throw new Error(
        `Vídeo demasiado longo (${Math.round(durationSec / 60)} min). Máximo: ${Math.round(input.maxDurationSec / 60)} min.`,
      );
    }
    if (durationSec <= 0) durationSec = 1;

    const sceneTimestamps = await detectSceneTimestamps(input.videoPath);
    const candidateTimestamps = buildCandidateTimestamps(
      durationSec,
      sceneTimestamps,
      input.maxFrames,
      input.sampleIntervalSec,
    );

    const workDir = join(tmpdir(), `dtp-frames-${Date.now()}`);
    await mkdir(workDir, { recursive: true });

    const frames: { timestampSec: number; pngBytes: Uint8Array }[] = [];
    try {
      for (let i = 0; i < candidateTimestamps.length; i++) {
        const t = candidateTimestamps[i]!;
        const outPath = join(workDir, `frame-${i}.png`);
        await extractFrameAt(input.videoPath, t, outPath);
        const buf = await readFile(outPath);
        frames.push({ timestampSec: t, pngBytes: new Uint8Array(buf) });
      }
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }

    return { durationSec, frames };
  }
}

/** Remove diretório temporário do job (vídeo + artefactos). */
export async function cleanupTempVideoDir(jobId: string): Promise<void> {
  await cleanupDtpJobTempDir(jobId);
}

/** @deprecated Vídeo passa a ser gravado no upload API; mantido para testes. */
export async function writeTempVideoFile(jobId: string, videoBytes: Uint8Array): Promise<string> {
  const dir = getDtpJobTempDir(jobId);
  await mkdir(dir, { recursive: true });
  const videoPath = join(dir, "input-video");
  await writeFile(videoPath, videoBytes);
  return videoPath;
}

/** Verifica se ffmpeg está disponível no PATH ou em caminhos conhecidos. */
export async function assertFfmpegAvailable(): Promise<void> {
  const bins = resolveFfmpegBinaries();
  try {
    await execFileAsync(bins.ffmpeg, ["-version"], {
      maxBuffer: 1024 * 1024,
      env: execEnv(),
    });
    ensureFfmpegConfigured();
  } catch {
    throw new Error(
      `ffmpeg não encontrado. ${ffmpegInstallHint()} (ou defina FFMPEG_PATH no .env).`,
    );
  }
}
