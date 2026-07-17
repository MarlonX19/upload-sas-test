import { FFMPEG_COMPRESS_CONCURRENCY } from "@/domain/upload/video-upload-policy";

export type CompressVideoResult = {
  file: File;
  skipped: boolean;
  reason?: "no_gain";
  originalSize: number;
  outputSize: number;
};

type FFmpegLogEvent = { type: string; message: string };
type FFmpegProgressEvent = { progress: number };

type FFmpegInstance = {
  loaded: boolean;
  load: (config: {
    coreURL: string;
    wasmURL: string;
    classWorkerURL?: string;
  }) => Promise<boolean>;
  on: {
    (event: "progress", cb: (ev: FFmpegProgressEvent) => void): void;
    (event: "log", cb: (ev: FFmpegLogEvent) => void): void;
  };
  off: {
    (event: "progress", cb: (ev: FFmpegProgressEvent) => void): void;
    (event: "log", cb: (ev: FFmpegLogEvent) => void): void;
  };
  writeFile: (path: string, data: Uint8Array) => Promise<boolean>;
  exec: (args: string[]) => Promise<number>;
  readFile: (path: string) => Promise<Uint8Array | string>;
  deleteFile: (path: string) => Promise<boolean>;
};

const LOG_PREFIX = "[ffmpeg-compress]";
/** Bust HTTP cache from the failed core-mt experiment (immutable Cache-Control). */
const ASSET_VERSION = "st-restore-1";

type AssetUrls = {
  classWorkerURL: string;
  coreURL: string;
  wasmURL: string;
};

let assetUrlsPromise: Promise<AssetUrls> | null = null;
const idlePool: FFmpegInstance[] = [];
let liveInstances = 0;
const waiters: Array<() => void> = [];

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

function wakeAllWaiters() {
  const pending = waiters.splice(0, waiters.length);
  for (const wake of pending) wake();
}

function inputExtension(fileName: string): string {
  const lower = fileName.trim().toLowerCase();
  const match = lower.match(/\.(mp4|webm|mov|avi)$/);
  return match ? match[0]! : ".mp4";
}

function compressedOutputName(originalName: string): string {
  const base = originalName.trim() || "video";
  const dot = base.lastIndexOf(".");
  const stem = (dot === -1 ? base : base.slice(0, dot)) || "video";
  return `${stem}-compressed.mp4`;
}

function formatUnknownError(e: unknown): string {
  if (e instanceof Error) {
    return e.message || e.name || "Error sem mensagem";
  }
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as { message?: unknown; code?: unknown; name?: unknown };
    const parts = [
      typeof obj.name === "string" ? obj.name : null,
      typeof obj.message === "string" ? obj.message : null,
      obj.code != null ? `code=${String(obj.code)}` : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(": ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

function compressError(step: string, cause: unknown, extra?: string): Error {
  const detail = formatUnknownError(cause);
  const msg = extra
    ? `Falha na compressão (${step}): ${detail}. ${extra}`
    : `Falha na compressão (${step}): ${detail}`;
  console.error(LOG_PREFIX, msg, cause);
  return new Error(msg);
}

async function getAssetUrls(): Promise<AssetUrls> {
  if (!assetUrlsPromise) {
    assetUrlsPromise = (async () => {
      const { toBlobURL } = await import("@ffmpeg/util");
      const base = `${window.location.origin}/ffmpeg`;
      const q = `?v=${ASSET_VERSION}`;
      // Absolute URL avoids Turbopack/Webpack resolving `new URL("./worker.js", import.meta.url)`.
      const classWorkerURL = `${base}/worker.js${q}`;
      const coreURL = await toBlobURL(`${base}/ffmpeg-core.js${q}`, "text/javascript");
      const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm${q}`, "application/wasm");
      return { classWorkerURL, coreURL, wasmURL };
    })().catch((err) => {
      assetUrlsPromise = null;
      throw err;
    });
  }
  return assetUrlsPromise;
}

async function createLoadedInstance(): Promise<FFmpegInstance> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = new FFmpeg() as unknown as FFmpegInstance;
  const urls = await getAssetUrls();
  log("A carregar FFmpeg core…", {
    liveInstances,
    classWorkerURL: urls.classWorkerURL,
  });
  try {
    await ffmpeg.load({
      classWorkerURL: urls.classWorkerURL,
      coreURL: urls.coreURL,
      wasmURL: urls.wasmURL,
    });
  } catch (e) {
    throw compressError(
      "load",
      e,
      "Verifique /ffmpeg/worker.js, ffmpeg-core.js e .wasm (npm run copy:ffmpeg).",
    );
  }
  log("Instância FFmpeg pronta.");
  return ffmpeg;
}

async function acquireInstance(): Promise<FFmpegInstance> {
  while (true) {
    const idle = idlePool.pop();
    if (idle) return idle;

    if (liveInstances < FFMPEG_COMPRESS_CONCURRENCY) {
      liveInstances += 1;
      try {
        return await createLoadedInstance();
      } catch (e) {
        liveInstances -= 1;
        wakeAllWaiters();
        throw e;
      }
    }

    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }
}

function releaseInstance(ffmpeg: FFmpegInstance): void {
  idlePool.push(ffmpeg);
  const next = waiters.shift();
  if (next) next();
}

async function safeDelete(ffmpeg: FFmpegInstance, path: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // ignore missing files
  }
}

/**
 * Comprime o vídeo no browser (máx. 720p, H.264 ultrafast, CRF 28, AAC).
 * Single-thread (@ffmpeg/core). Se o output for maior que o input, devolve o original.
 */
export async function compressVideoForUpload(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CompressVideoResult> {
  const originalSize = file.size;
  const jobId = crypto.randomUUID().slice(0, 8);
  const ext = inputExtension(file.name);
  const inputPath = `input-${jobId}${ext}`;
  const outputPath = `output-${jobId}.mp4`;
  const outName = compressedOutputName(file.name);
  const args = [
    "-i",
    inputPath,
    "-vf",
    "scale=-2:'min(720,ih)'",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  let ffmpeg: FFmpegInstance | null = null;
  let progressHandler: ((ev: FFmpegProgressEvent) => void) | null = null;
  let logHandler: ((ev: FFmpegLogEvent) => void) | null = null;
  const logs: string[] = [];

  log("Início da compressão", {
    jobId,
    name: file.name,
    type: file.type || "(vazio)",
    size: originalSize,
    inputPath,
    outputPath,
  });

  try {
    onProgress?.(0);
    ffmpeg = await acquireInstance();

    logHandler = (ev: FFmpegLogEvent) => {
      const line = `[${ev.type}] ${ev.message}`;
      logs.push(line);
      if (ev.type === "fferr" || /error|failed|invalid|unsupported/i.test(ev.message)) {
        console.warn(LOG_PREFIX, line);
      }
    };
    progressHandler = (ev: FFmpegProgressEvent) => {
      if (!onProgress) return;
      const pct = Math.min(100, Math.max(0, Math.round(ev.progress * 100)));
      onProgress(pct);
    };
    ffmpeg.on("log", logHandler);
    ffmpeg.on("progress", progressHandler);

    const { fetchFile } = await import("@ffmpeg/util");
    await safeDelete(ffmpeg, inputPath);
    await safeDelete(ffmpeg, outputPath);

    let fileData: Uint8Array;
    try {
      fileData = await fetchFile(file);
      log("Ficheiro lido para WASM", { jobId, bytes: fileData.byteLength });
    } catch (e) {
      throw compressError("fetchFile", e);
    }

    try {
      await ffmpeg.writeFile(inputPath, fileData);
      log("writeFile OK", { jobId, inputPath });
    } catch (e) {
      throw compressError("writeFile", e);
    }

    log("ffmpeg.exec", { jobId, cmd: args.join(" ") });
    let code: number;
    try {
      code = await ffmpeg.exec(args);
    } catch (e) {
      const tail = logs.slice(-12).join(" | ");
      throw compressError("exec", e, tail ? `Logs: ${tail}` : undefined);
    }

    log("ffmpeg.exec terminou", { jobId, code, logLines: logs.length });
    if (code !== 0) {
      const tail = logs.slice(-12).join(" | ");
      throw new Error(
        `ffmpeg.exec saiu com código ${code} (codec/formato?). ${tail ? `Logs: ${tail}` : "Sem logs stderr."}`,
      );
    }

    let data: Uint8Array | string;
    try {
      data = await ffmpeg.readFile(outputPath);
    } catch (e) {
      const tail = logs.slice(-12).join(" | ");
      throw compressError("readFile", e, tail ? `Logs: ${tail}` : undefined);
    }

    if (typeof data === "string") {
      throw new Error("Saída de compressão inválida (string em vez de bytes).");
    }

    const outputSize = data.byteLength;
    onProgress?.(100);
    log("Compressão OK", {
      jobId,
      originalSize,
      outputSize,
      skipped: outputSize >= originalSize,
      outName,
    });

    if (outputSize >= originalSize) {
      return {
        file,
        skipped: true,
        reason: "no_gain",
        originalSize,
        outputSize,
      };
    }

    const bytes = data.slice();
    const compressed = new File([bytes], outName, { type: "video/mp4" });
    return {
      file: compressed,
      skipped: false,
      originalSize,
      outputSize,
    };
  } catch (e) {
    if (e instanceof Error) {
      if (/memory|out of memory|OOM/i.test(e.message)) {
        throw new Error(
          "Memória insuficiente para comprimir este vídeo no browser. Tente um ficheiro mais pequeno.",
        );
      }
      if (!e.message.startsWith("Falha na compressão") && !e.message.startsWith("ffmpeg.exec")) {
        console.error(LOG_PREFIX, "Erro não formatado", e);
      }
      throw e;
    }
    throw compressError("unknown", e);
  } finally {
    if (ffmpeg && progressHandler) {
      ffmpeg.off("progress", progressHandler);
    }
    if (ffmpeg && logHandler) {
      ffmpeg.off("log", logHandler);
    }
    if (ffmpeg) {
      await safeDelete(ffmpeg, inputPath);
      await safeDelete(ffmpeg, outputPath);
      releaseInstance(ffmpeg);
    }
  }
}
