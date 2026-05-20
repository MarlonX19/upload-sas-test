import { randomUUID } from "node:crypto";

import type { DtpAnalysisQueuePort } from "@/application/ports/dtp-analysis-queue.port";
import type { CreateDtpJobBody } from "@/application/dtp/dtos/create-dtp-job.schema";
import type { DtpJobRepository } from "@/domain/repositories/dtp-job.repository";
import type { DtpJob } from "@/domain/dtp/dtp-job";
import {
  isAllowedDtpVideoFileName,
  isAllowedDtpVideoMime,
} from "@/domain/upload/video-dtp-upload-policy";

export type CreateDtpJobResult =
  | { ok: true; job: DtpJob }
  | { ok: false; code: "INVALID_INPUT"; message: string };

export class CreateDtpJobUseCase {
  constructor(
    private readonly dtpJobRepository: DtpJobRepository,
    private readonly dtpAnalysisQueue: DtpAnalysisQueuePort,
  ) {}

  async execute(userId: string, input: CreateDtpJobBody): Promise<CreateDtpJobResult> {
    if (!isAllowedDtpVideoFileName(input.fileName)) {
      return { ok: false, code: "INVALID_INPUT", message: "Extensão de vídeo não suportada." };
    }
    if (!isAllowedDtpVideoMime(input.mimeType)) {
      return { ok: false, code: "INVALID_INPUT", message: "Tipo MIME de vídeo não suportado." };
    }

    const jobId = randomUUID();
    const job = await this.dtpJobRepository.create({
      id: jobId,
      userId,
      videoFileName: input.fileName,
      videoMimeType: input.mimeType,
      videoBlobUrl: input.publicBlobUrl,
      videoBlobName: input.blobName,
    });

    await this.dtpAnalysisQueue.enqueue({
      jobId: job.id,
      userId: job.userId,
      videoBlobUrl: job.videoBlobUrl,
      videoFileName: job.videoFileName,
      videoMimeType: job.videoMimeType,
    });

    return { ok: true, job };
  }
}
