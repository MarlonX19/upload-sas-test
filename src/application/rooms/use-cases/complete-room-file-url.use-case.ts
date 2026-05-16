import type { CompleteRoomFileUrlBody } from "@/application/rooms/dtos/complete-room-file-url.schema";
import type { RoomDocumentAnalysisQueuePort } from "@/application/ports/room-document-analysis-queue.port";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";
import { logger } from "@/lib/logger";

export type CompleteRoomFileUrlResult =
  | { ok: true; analysisEnqueued: boolean }
  | { ok: false; code: "ROOM_NOT_FOUND" | "FILE_NOT_FOUND" | "ERROR"; message: string };

export class CompleteRoomFileUrlUseCase {
  constructor(
    private readonly roomAdminRepository: RoomAdminRepository,
    private readonly documentAnalysisQueue: RoomDocumentAnalysisQueuePort,
  ) {}

  async execute(
    roomId: string,
    fileId: string,
    input: CompleteRoomFileUrlBody,
  ): Promise<CompleteRoomFileUrlResult> {
    const ok = await this.roomAdminRepository.roomBelongsToHotel(roomId, input.hotelId);
    if (!ok) {
      logger.warn(
        { event: "complete_room_file_url_room_not_found", roomId, fileId, hotelId: input.hotelId },
        "PATCH URL: quarto não pertence ao hotel.",
      );
      return { ok: false, code: "ROOM_NOT_FOUND", message: "Registo ou organização inválidos." };
    }
    try {
      const set = await this.roomAdminRepository.setRoomFileUrlByFileId(
        roomId,
        fileId,
        input.publicBlobUrl,
      );
      if (!set) {
        logger.warn(
          {
            event: "complete_room_file_url_file_not_found",
            roomId,
            fileId,
            hotelId: input.hotelId,
          },
          "PATCH URL: fileId não existe neste quarto.",
        );
        return { ok: false, code: "FILE_NOT_FOUND", message: "Ficheiro não encontrado neste registo." };
      }

      let analysisEnqueued = false;
      const mimeType = input.mimeType?.trim() || "application/pdf";
      try {
        await this.documentAnalysisQueue.enqueue({
          roomId,
          fileId,
          fileUrl: input.publicBlobUrl,
          mimeType,
        });
        analysisEnqueued = true;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error(
          {
            event: "room_document_analysis_enqueue_failed",
            roomId,
            fileId,
            exceptionMessage: message,
            err: e instanceof Error ? e : new Error(message),
          },
          "Falha ao enfileirar análise do documento após upload.",
        );
      }

      logger.info(
        {
          event: "room_document_upload_completed",
          roomId,
          fileId,
          hotelId: input.hotelId,
          mimeType,
          analysisEnqueued,
          fileName: input.fileName ?? null,
          fileSizeBytes: input.fileSizeBytes ?? null,
          uploadDurationMs: input.uploadDurationMs ?? null,
        },
        "Upload de documento registado na base!",
      );

      return { ok: true, analysisEnqueued };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao atualizar o ficheiro.";
      logger.error(
        {
          event: "complete_room_file_url_failed",
          roomId,
          fileId,
          hotelId: input.hotelId,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Erro ao concluir o registo da URL do ficheiro.",
      );
      return { ok: false, code: "ERROR", message };
    }
  }
}
