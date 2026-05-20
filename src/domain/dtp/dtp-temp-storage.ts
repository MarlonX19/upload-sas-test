import { tmpdir } from "node:os";
import { join } from "node:path";

/** Raiz para ficheiros temporários DTP (nunca dentro do repo). */
export function getDtpTempRoot(): string {
  const custom = process.env.DTP_TEMP_DIR?.trim();
  return custom && custom.length > 0 ? custom : tmpdir();
}

export function getDtpJobTempDir(jobId: string): string {
  return join(getDtpTempRoot(), "dtp", jobId);
}

export function resolveVideoInputPath(jobId: string, originalFileName: string): string {
  const dir = getDtpJobTempDir(jobId);
  const lower = originalFileName.trim().toLowerCase();
  let ext = ".mp4";
  if (lower.endsWith(".webm")) ext = ".webm";
  else if (lower.endsWith(".mov")) ext = ".mov";
  else if (lower.endsWith(".avi")) ext = ".avi";
  else {
    const dot = lower.lastIndexOf(".");
    if (dot !== -1) ext = lower.slice(dot);
  }
  return join(dir, `input${ext}`);
}
