/** Limites para upload de vídeo DTP. */
export const MAX_DTP_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_DTP_VIDEO_DURATION_SEC = 30 * 60;
export const MAX_DTP_FRAMES = 40;
export const DTP_FRAME_SAMPLE_INTERVAL_SEC = 8;

export const ALLOWED_DTP_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

export const ALLOWED_DTP_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi"];

export function isAllowedDtpVideoMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (!m) return false;
  return ALLOWED_DTP_VIDEO_MIMES.has(m);
}

export function isAllowedDtpVideoFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return ALLOWED_DTP_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
