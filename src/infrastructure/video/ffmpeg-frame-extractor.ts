import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpeg from "fluent-ffmpeg";

import type { VideoFrameExtractorPort } from "@/application/ports/video-frame-extractor.port";
import { getDtpJobTempDir } from "@/domain/dtp/dtp-temp-storage";
import { cleanupDtpJobTempDir } from "@/infrastructure/dtp/dtp-video-file-storage";
import {
  ffmpegBinDir,
  ffmpegInstallHint,
  resolveFfmpegBinaries,
} from "@/infrastructure/video/resolve-ffmpeg-binaries";
import { probeVideoDurationSec } from "@/infrastructure/video/video-duration-probe";
import { logger } from "@/lib/logger";

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

function ffprobeAsync(videoPath: string): Promise<ffmpeg.FfprobeData> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

/**
 * Extrai frames com filtro fps (decodifica o vídeo inteiro).
 * Evita seek em WebM do MediaRecorder, onde metadata de duração falha e seek devolve sempre o 1.º frame.
 */
async function extractFramesByFps(input: {
  videoPath: string;
  sampleIntervalSec: number;
  maxFrames: number;
  maxDurationSec: number;
}): Promise<{ timestampSec: number; pngBytes: Uint8Array }[]> {
  const bins = ensureFfmpegConfigured();
  const workDir = join(tmpdir(), `dtp-frames-${Date.now()}`);
  await mkdir(workDir, { recursive: true });
  const pattern = join(workDir, "frame-%03d.png");

  try {
    await execFileAsync(
      bins.ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-t",
        String(input.maxDurationSec),
        "-i",
        input.videoPath,
        "-vf",
        `fps=1/${input.sampleIntervalSec}`,
        "-frames:v",
        String(input.maxFrames),
        "-q:v",
        "2",
        pattern,
      ],
      { maxBuffer: 10 * 1024 * 1024, env: execEnv() },
    );

    const files = (await readdir(workDir))
      .filter((f) => f.endsWith(".png"))
      .sort();

    const frames: { timestampSec: number; pngBytes: Uint8Array }[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await readFile(join(workDir, files[i]!));
      frames.push({
        timestampSec: i * input.sampleIntervalSec,
        pngBytes: new Uint8Array(buf),
      });
    }
    return frames;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export class FfmpegVideoFrameExtractor implements VideoFrameExtractorPort {
  async extractFrames(input: {
    videoPath: string;
    maxFrames: number;
    sampleIntervalSec: number;
    maxDurationSec: number;
  }): Promise<{ durationSec: number; frames: { timestampSec: number; pngBytes: Uint8Array }[] }> {
    let probedDurationSec = await probeVideoDurationSec(input.videoPath, ffprobeAsync);

    if (probedDurationSec > input.maxDurationSec) {
      throw new Error(
        `Vídeo demasiado longo (${Math.round(probedDurationSec / 60)} min). Máximo: ${Math.round(input.maxDurationSec / 60)} min.`,
      );
    }

    const frames = await extractFramesByFps({
      videoPath: input.videoPath,
      sampleIntervalSec: input.sampleIntervalSec,
      maxFrames: input.maxFrames,
      maxDurationSec: input.maxDurationSec,
    });

    if (frames.length === 0) {
      throw new Error("Não foi possível extrair frames do vídeo.");
    }

    const inferredFromFrames =
      frames.length > 1
        ? frames[frames.length - 1]!.timestampSec + input.sampleIntervalSec
        : input.sampleIntervalSec;

    const durationSec =
      probedDurationSec >= 1
        ? Math.max(probedDurationSec, inferredFromFrames)
        : inferredFromFrames;

    logger.info(
      {
        event: "dtp_frame_extraction",
        videoPath: input.videoPath,
        probedDurationSec,
        durationSec,
        frameCount: frames.length,
        firstTimestampSec: frames[0]?.timestampSec,
        lastTimestampSec: frames[frames.length - 1]?.timestampSec,
      },
      "Frames DTP extraídos (amostragem fps).",
    );

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
