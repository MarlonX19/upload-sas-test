const INVALID = /[<>:"/\\|?*\x00-\x1f]/g;

function fileBasename(p: string): string {
  const s = p.replace(/\\/g, "/");
  const i = s.lastIndexOf("/");
  return i === -1 ? s : s.slice(i + 1);
}

function pickExtension(originalFileName: string): string {
  const base = fileBasename(originalFileName.trim() || "video");
  const dot = base.lastIndexOf(".");
  if (dot === -1) return ".mp4";
  const ext = base.slice(dot).toLowerCase();
  if ([".mp4", ".webm", ".mov", ".avi"].includes(ext)) return ext;
  return ".mp4";
}

/** Prefixo virtual (pasta) no container para vídeos deste teste. */
export const VIDEO_BLOB_FOLDER_PREFIX = "test-workspace";

/**
 * Nome do blob no Azure para vídeos: test-workspace/video-{uuid}-{stem}{ext}
 */
export function buildAzureVideoBlobName(originalFileName: string, uniqueId: string): string {
  const base = fileBasename(originalFileName.trim() || "video");
  const ext = pickExtension(originalFileName);
  const noExt = base.endsWith(ext) ? base.slice(0, -ext.length) : base.replace(/\.[^.]+$/, "");
  const cleaned = noExt.replace(INVALID, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 120);
  const stem = cleaned.length > 0 ? cleaned : "video";
  return `${VIDEO_BLOB_FOLDER_PREFIX}/video-${uniqueId}-${stem}${ext}`.toLowerCase();
}
