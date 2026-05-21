import type { BlobBinaryUploaderPort } from "@/application/ports/blob-binary-uploader.port";
import type { DtpAnalysisJobPayload } from "@/application/ports/dtp-analysis-queue.port";
import type { DtpVideoAiAnalyzer } from "@/application/ports/dtp-video-ai-analyzer.port";
import type { VideoFrameExtractorPort } from "@/application/ports/video-frame-extractor.port";
import type { DtpJobRepository } from "@/domain/repositories/dtp-job.repository";
import { findNearestFrame } from "@/domain/dtp/map-timestamp-to-frame";
import type { DtpStep } from "@/domain/dtp/dtp-step";
import { buildAzureDtpPdfBlobName } from "@/domain/upload/azure-video-blob-name";
import { resolveDtpOutputLanguage } from "@/domain/dtp/dtp-output-language";
import {
  DTP_FRAME_SAMPLE_INTERVAL_SEC,
  MAX_DTP_FRAMES,
  MAX_DTP_VIDEO_DURATION_SEC,
} from "@/domain/upload/video-dtp-upload-policy";
import { buildDtpPdf } from "@/infrastructure/documents/dtp-pdf.builder";
import { cleanupDtpJobTempDir } from "@/infrastructure/dtp/dtp-video-file-storage";
import { assertFfmpegAvailable } from "@/infrastructure/video/ffmpeg-frame-extractor";
import { logger } from "@/lib/logger";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

export class ProcessDtpVideoAnalysisUseCase {
  constructor(
    private readonly dtpJobRepository: DtpJobRepository,
    private readonly blobUploader: BlobBinaryUploaderPort,
    private readonly frameExtractor: VideoFrameExtractorPort,
    private readonly aiAnalyzer: DtpVideoAiAnalyzer,
  ) {}

  async execute(payload: DtpAnalysisJobPayload): Promise<void> {
    const { jobId, videoLocalPath } = payload;
    const pipelineT0 = performance.now();

    logger.info(
      { event: "dtp_analysis_job_started", jobId, videoFileName: payload.videoFileName, videoLocalPath },
      "Início da análise de vídeo DTP.",
    );

    const touched = await this.dtpJobRepository.updateById(jobId, {
      status: "processing",
      errorMessage: null,
    });
    if (!touched) {
      throw new Error("Job DTP não encontrado.");
    }

    const storedJob = await this.dtpJobRepository.findByIdForUser(jobId, payload.userId);
    const outputLanguage = resolveDtpOutputLanguage(
      payload.outputLanguage ?? storedJob?.outputLanguage,
    );

    try {
      await assertFfmpegAvailable();

      try {
        await access(videoLocalPath, constants.R_OK);
      } catch {
        throw new Error("Ficheiro de vídeo temporário não encontrado ou inacessível.");
      }

      const { frames } = await this.frameExtractor.extractFrames({
        videoPath: videoLocalPath,
        maxFrames: MAX_DTP_FRAMES,
        sampleIntervalSec: DTP_FRAME_SAMPLE_INTERVAL_SEC,
        maxDurationSec: MAX_DTP_VIDEO_DURATION_SEC,
      });

      logger.info(
        { event: "dtp_frames_extracted", jobId, frameCount: frames.length },
        "Frames extraídos do vídeo.",
      );

      const aiResult = await this.aiAnalyzer.detectStepsFromFrames({
        frames,
        videoFileName: payload.videoFileName,
        outputLanguage,
      });

      const stepsWithScreenshots: DtpStep[] = [];
      const screenshotBytesByOrder = new Map<number, Uint8Array>();

      for (const step of aiResult.steps) {
        const nearest = findNearestFrame(frames, step.timestampSec);
        if (nearest) {
          screenshotBytesByOrder.set(step.order, nearest.pngBytes);
        }

        stepsWithScreenshots.push({
          ...step,
          timestampSec: nearest?.timestampSec ?? step.timestampSec,
        });
      }

      await this.dtpJobRepository.updateById(jobId, {
        steps: stepsWithScreenshots,
      });

      const job = await this.dtpJobRepository.findByIdForUser(jobId, payload.userId);
      const pdfBytes = await buildDtpPdf({
        title: payload.videoFileName,
        createdAt: job?.createdAt ?? new Date(),
        steps: stepsWithScreenshots,
        screenshotBytesByOrder,
      });

      const pdfBlobName = buildAzureDtpPdfBlobName(jobId);
      const pdfUploaded = await this.blobUploader.uploadBytes({
        blobName: pdfBlobName,
        bytes: pdfBytes,
        contentType: "application/pdf",
      });

      await this.dtpJobRepository.updateById(jobId, {
        status: "completed",
        pdfBlobUrl: pdfUploaded.publicBlobUrl,
        pdfBlobName,
        errorMessage: null,
      });

      logger.info(
        {
          event: "dtp_analysis_job_completed",
          jobId,
          stepCount: stepsWithScreenshots.length,
          aiDurationMs: aiResult.durationMs,
          totalDurationMs: Math.round(performance.now() - pipelineT0),
          inputTokens: aiResult.inputTokens ?? null,
          outputTokens: aiResult.outputTokens ?? null,
        },
        "Análise DTP concluída com PDF gerado.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.dtpJobRepository.updateById(jobId, {
        status: "failed",
        errorMessage: message,
      });
      logger.error(
        {
          event: "dtp_analysis_job_failed",
          jobId,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Análise DTP falhou.",
      );
      throw e;
    } finally {
      await cleanupDtpJobTempDir(jobId);
    }
  }
}
