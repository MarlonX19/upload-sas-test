import type { BlobBinaryFetcherPort } from "@/application/ports/blob-binary-fetcher.port";
import type { BlobBinaryUploaderPort } from "@/application/ports/blob-binary-uploader.port";
import type { DtpAnalysisJobPayload } from "@/application/ports/dtp-analysis-queue.port";
import type { DtpVideoAiAnalyzer } from "@/application/ports/dtp-video-ai-analyzer.port";
import type { VideoFrameExtractorPort } from "@/application/ports/video-frame-extractor.port";
import type { DtpJobRepository } from "@/domain/repositories/dtp-job.repository";
import { findNearestFrame } from "@/domain/dtp/map-timestamp-to-frame";
import type { DtpStep } from "@/domain/dtp/dtp-step";
import {
  buildAzureDtpPdfBlobName,
  buildAzureDtpScreenshotBlobName,
} from "@/domain/upload/azure-video-blob-name";
import {
  DTP_FRAME_SAMPLE_INTERVAL_SEC,
  MAX_DTP_FRAMES,
  MAX_DTP_VIDEO_DURATION_SEC,
} from "@/domain/upload/video-dtp-upload-policy";
import { buildDtpPdf } from "@/infrastructure/documents/dtp-pdf.builder";
import {
  assertFfmpegAvailable,
  cleanupTempVideoDir,
  writeTempVideoFile,
} from "@/infrastructure/video/ffmpeg-frame-extractor";
import { logger } from "@/lib/logger";

export class ProcessDtpVideoAnalysisUseCase {
  constructor(
    private readonly dtpJobRepository: DtpJobRepository,
    private readonly blobFetcher: BlobBinaryFetcherPort,
    private readonly blobUploader: BlobBinaryUploaderPort,
    private readonly frameExtractor: VideoFrameExtractorPort,
    private readonly aiAnalyzer: DtpVideoAiAnalyzer,
  ) {}

  async execute(payload: DtpAnalysisJobPayload): Promise<void> {
    const { jobId } = payload;
    const pipelineT0 = performance.now();

    logger.info(
      { event: "dtp_analysis_job_started", jobId, videoFileName: payload.videoFileName },
      "Início da análise de vídeo DTP.",
    );

    const touched = await this.dtpJobRepository.updateById(jobId, {
      status: "processing",
      errorMessage: null,
    });
    if (!touched) {
      throw new Error("Job DTP não encontrado.");
    }

    try {
      await assertFfmpegAvailable();

      const fetchT0 = performance.now();
      const videoBytes = await this.blobFetcher.fetchFromUrl(payload.videoBlobUrl);
      logger.info(
        {
          event: "dtp_video_fetched",
          jobId,
          videoBytesLen: videoBytes.byteLength,
          fetchDurationMs: Math.round(performance.now() - fetchT0),
        },
        "Vídeo descarregado para análise DTP.",
      );

      const videoPath = await writeTempVideoFile(jobId, videoBytes);

      try {
        const { frames } = await this.frameExtractor.extractFrames({
          videoPath,
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
        });

        const stepsWithScreenshots: DtpStep[] = [];
        const screenshotBytesByOrder = new Map<number, Uint8Array>();

        for (const step of aiResult.steps) {
          const nearest = findNearestFrame(frames, step.timestampSec);
          let screenshotBlobUrl: string | undefined;

          if (nearest) {
            const screenshotBlobName = buildAzureDtpScreenshotBlobName(jobId, step.order);
            const uploaded = await this.blobUploader.uploadBytes({
              blobName: screenshotBlobName,
              bytes: nearest.pngBytes,
              contentType: "image/png",
            });
            screenshotBlobUrl = uploaded.publicBlobUrl;
            screenshotBytesByOrder.set(step.order, nearest.pngBytes);
          }

          stepsWithScreenshots.push({
            ...step,
            timestampSec: nearest?.timestampSec ?? step.timestampSec,
            screenshotBlobUrl,
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
      } finally {
        await cleanupTempVideoDir(jobId);
      }
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
    }
  }
}
