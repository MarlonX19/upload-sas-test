/** Limites da UI de upload de vídeo via SAS. */
export const MAX_UI_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_UI_VIDEO_FILES = 5;

/** Quantas compressões FFmpeg WASM em paralelo (cada uma = ~worker + memória). */
export const FFMPEG_COMPRESS_CONCURRENCY = 2;

export const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi"] as const;

/** Base MIME antes de parâmetros (ex. `video/webm;codecs=vp9` → `video/webm`). */
export function normalizeVideoMime(mime: string): string {
  const base = mime.trim().split(";")[0]?.trim().toLowerCase() ?? "";
  return base;
}

export function isAllowedVideoMime(mime: string): boolean {
  const m = normalizeVideoMime(mime);
  if (!m) return false;
  return ALLOWED_VIDEO_MIMES.has(m);
}

export function isAllowedVideoFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return ALLOWED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
