import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { getDtpJobTempDir } from "@/domain/dtp/dtp-temp-storage";

/** Grava o vídeo no disco via stream (evita carregar 500 MB na RAM). */
export async function saveDtpVideoToTemp(input: {
  jobId: string;
  destinationPath: string;
  body: ReadableStream<Uint8Array>;
}): Promise<void> {
  await mkdir(dirname(input.destinationPath), { recursive: true });
  const nodeStream = Readable.fromWeb(input.body as Parameters<typeof Readable.fromWeb>[0]);
  await pipeline(nodeStream, createWriteStream(input.destinationPath));
}

export async function cleanupDtpJobTempDir(jobId: string): Promise<void> {
  const dir = getDtpJobTempDir(jobId);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
