import { randomUUID } from "node:crypto";

import type { DtpAnalysisQueuePort } from "@/application/ports/dtp-analysis-queue.port";
import { resolveVideoInputPath } from "@/domain/dtp/dtp-temp-storage";
import type { DtpJobRepository } from "@/domain/repositories/dtp-job.repository";
import type { DtpJob } from "@/domain/dtp/dtp-job";
import {
  isAllowedDtpVideoFileName,
  isAllowedDtpVideoMime,
  MAX_DTP_VIDEO_BYTES,
} from "@/domain/upload/video-dtp-upload-policy";
import { cleanupDtpJobTempDir, saveDtpVideoToTemp } from "@/infrastructure/dtp/dtp-video-file-storage";

export type CreateDtpJobWithVideoInput = {
  userId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  body: ReadableStream<Uint8Array>;
};

export type CreateDtpJobWithVideoResult =
  | { ok: true; job: DtpJob }
  | { ok: false; code: "INVALID_INPUT" | "FILE_TOO_LARGE"; message: string };

export class CreateDtpJobWithVideoUseCase {
  constructor(
    private readonly dtpJobRepository: DtpJobRepository,
    private readonly dtpAnalysisQueue: DtpAnalysisQueuePort,
  ) {}

  async execute(input: CreateDtpJobWithVideoInput): Promise<CreateDtpJobWithVideoResult> {
    if (!isAllowedDtpVideoFileName(input.fileName)) {
      return { ok: false, code: "INVALID_INPUT", message: "Extensão de vídeo não suportada." };
    }
    if (!isAllowedDtpVideoMime(input.mimeType)) {
      return { ok: false, code: "INVALID_INPUT", message: "Tipo MIME de vídeo não suportado." };
    }
    if (input.fileSize > MAX_DTP_VIDEO_BYTES) {
      return {
        ok: false,
        code: "FILE_TOO_LARGE",
        message: `O vídeo excede o limite de ${MAX_DTP_VIDEO_BYTES / (1024 * 1024)} MB.`,
      };
    }

    const jobId = randomUUID();
    const videoLocalPath = resolveVideoInputPath(jobId, input.fileName);

    try {
      await saveDtpVideoToTemp({
        jobId,
        destinationPath: videoLocalPath,
        body: input.body,
      });
    } catch (e) {
      await cleanupDtpJobTempDir(jobId);
      const message = e instanceof Error ? e.message : "Falha ao guardar o vídeo temporário.";
      return { ok: false, code: "INVALID_INPUT", message };
    }

    const job = await this.dtpJobRepository.create({
      id: jobId,
      userId: input.userId,
      videoFileName: input.fileName,
      videoMimeType: input.mimeType,
    });

    try {
      await this.dtpAnalysisQueue.enqueue({
        jobId: job.id,
        userId: job.userId,
        videoLocalPath,
        videoFileName: job.videoFileName,
        videoMimeType: job.videoMimeType,
      });
    } catch (e) {
      await cleanupDtpJobTempDir(jobId);
      await this.dtpJobRepository.updateById(jobId, {
        status: "failed",
        errorMessage: e instanceof Error ? e.message : "Falha ao enfileirar análise.",
      });
      throw e;
    }

    return { ok: true, job };
  }
}
