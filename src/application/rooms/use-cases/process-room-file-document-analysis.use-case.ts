import type { RoomDocumentAiAnalyzer } from "@/application/ports/room-document-ai-analyzer.port";
import type { RoomPdfBinaryFetcher } from "@/application/ports/room-pdf-binary-fetcher.port";
import type { RoomFileDocumentAnalysisJobPayload } from "@/application/ports/room-document-analysis-queue.port";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export class ProcessRoomFileDocumentAnalysisUseCase {
  constructor(
    private readonly roomAdminRepository: RoomAdminRepository,
    private readonly pdfBinaryFetcher: RoomPdfBinaryFetcher,
    private readonly aiAnalyzer: RoomDocumentAiAnalyzer,
  ) {}

  async execute(payload: RoomFileDocumentAnalysisJobPayload): Promise<void> {
    const { roomId, fileId, fileUrl, mimeType } = payload;

    const touched = await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
      analysisStatus: "processing",
      analysisError: null,
      analysisUpdatedAt: new Date(),
    });
    if (!touched) {
      throw new Error("Quarto ou ficheiro não encontrado para análise.");
    }

    try {
      const pdfBytes = await this.pdfBinaryFetcher.fetchFromUrl(fileUrl);

      const analysisSteps = await this.aiAnalyzer.extractStepsFromPdf({ pdfBytes, mimeType });
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        analysisSteps,
        analysisUpdatedAt: new Date(),
      });

      const socos = await this.aiAnalyzer.extractSocosFromPdf({ pdfBytes, mimeType });
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        socos,
        analysisUpdatedAt: new Date(),
      });

      const ideas = await this.aiAnalyzer.generateIdeasFromSteps({ steps: analysisSteps });
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        ideas,
        analysisStatus: "completed",
        analysisError: null,
        analysisUpdatedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha na análise do documento.";
      await this.roomAdminRepository.updateRoomFileDocumentAnalysisByFileId(roomId, fileId, {
        analysisStatus: "failed",
        analysisError: message,
        analysisUpdatedAt: new Date(),
      });
    }
  }
}
