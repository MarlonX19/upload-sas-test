import type { RoomDocumentAiAnalyzer } from "@/application/ports/room-document-ai-analyzer.port";
import type { RoomPdfBinaryFetcher } from "@/application/ports/room-pdf-binary-fetcher.port";
import type { RoomFileDocumentAnalysisJobPayload } from "@/application/ports/room-document-analysis-queue.port";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";
import { logger } from "@/lib/logger";

function sumTokens(
  acc: { inT: number; outT: number; totT: number },
  m: { inputTokens?: number; outputTokens?: number; totalTokens?: number },
): void {
  if (typeof m.inputTokens === "number") acc.inT += m.inputTokens;
  if (typeof m.outputTokens === "number") acc.outT += m.outputTokens;
  if (typeof m.totalTokens === "number") acc.totT += m.totalTokens;
}

export class ProcessRoomFileDocumentAnalysisUseCase {
  constructor(
    private readonly roomAdminRepository: RoomAdminRepository,
    private readonly pdfBinaryFetcher: RoomPdfBinaryFetcher,
    private readonly aiAnalyzer: RoomDocumentAiAnalyzer,
  ) {}

  async execute(payload: RoomFileDocumentAnalysisJobPayload): Promise<void> {
    const { roomId, fileId, fileUrl, mimeType } = payload;
    const pipelineT0 = performance.now();

    logger.info(
      { event: "room_document_analysis_job_started", roomId, fileId, mimeType },
      "Início da análise do documento (job).",
    );

    const touched = await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
      analysisStatus: "processing",
      analysisError: null,
      analysisUpdatedAt: new Date(),
    });
    if (!touched) {
      const message = "Quarto ou ficheiro não encontrado para análise.";
      logger.error(
        {
          event: "room_document_analysis_room_or_file_missing",
          roomId,
          fileId,
          exceptionMessage: message,
        },
        message,
      );
      throw new Error(message);
    }

    try {
      const fetchT0 = performance.now();
      const pdfBytes = await this.pdfBinaryFetcher.fetchFromUrl(fileUrl);
      const fetchDurationMs = Math.round(performance.now() - fetchT0);

      logger.info(
        {
          event: "room_document_analysis_pdf_fetched",
          roomId,
          fileId,
          pdfBytesLen: pdfBytes.byteLength,
          fetchDurationMs,
        },
        "PDF descarregado para análise Vertex.",
      );

      const tokenAcc = { inT: 0, outT: 0, totT: 0 };

      const stepsResult = await this.aiAnalyzer.extractStepsFromPdf({ pdfBytes, mimeType });
      sumTokens(tokenAcc, stepsResult.metrics);
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        analysisSteps: stepsResult.output,
        analysisUpdatedAt: new Date(),
      });

      const socosResult = await this.aiAnalyzer.extractSocosFromPdf({ pdfBytes, mimeType });
      sumTokens(tokenAcc, socosResult.metrics);
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        socos: socosResult.output,
        analysisUpdatedAt: new Date(),
      });

      const ideasResult = await this.aiAnalyzer.generateIdeasFromSteps({ steps: stepsResult.output });
      sumTokens(tokenAcc, ideasResult.metrics);
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        ideas: ideasResult.output,
        analysisStatus: "completed",
        analysisError: null,
        analysisUpdatedAt: new Date(),
      });

      const pipelineDurationMs = Math.round(performance.now() - pipelineT0);

      logger.info(
        {
          event: "room_document_analysis_completed",
          roomId,
          fileId,
          pdfBytesLen: pdfBytes.byteLength,
          pipelineDurationMs,
          fetchDurationMs,
          vertexInputTokensTotal: tokenAcc.inT > 0 ? tokenAcc.inT : null,
          vertexOutputTokensTotal: tokenAcc.outT > 0 ? tokenAcc.outT : null,
          vertexTotalTokensReportedSum: tokenAcc.totT > 0 ? tokenAcc.totT : null,
        },
        "Análise do documento concluída com sucesso.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha na análise do documento.";
      const pipelineDurationMs = Math.round(performance.now() - pipelineT0);
      logger.error(
        {
          event: "room_document_analysis_pipeline_failed",
          roomId,
          fileId,
          pipelineDurationMs,
          exceptionMessage: message,
          err: err instanceof Error ? err : new Error(message),
        },
        "Análise do documento falhou (estado gravado como failed).",
      );
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        analysisStatus: "failed",
        analysisError: message,
        analysisUpdatedAt: new Date(),
      });
    }
  }
}
