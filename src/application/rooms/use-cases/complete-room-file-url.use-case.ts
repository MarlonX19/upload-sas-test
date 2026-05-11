import type { CompleteRoomFileUrlBody } from "@/application/rooms/dtos/complete-room-file-url.schema";
import type { RoomDocumentAnalysisQueuePort } from "@/application/ports/room-document-analysis-queue.port";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

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
      return { ok: false, code: "ROOM_NOT_FOUND", message: "Registo ou organização inválidos." };
    }
    try {
      const set = await this.roomAdminRepository.setRoomFileUrlByFileId(
        roomId,
        fileId,
        input.publicBlobUrl,
      );
      if (!set) {
        return { ok: false, code: "FILE_NOT_FOUND", message: "Ficheiro não encontrado neste registo." };
      }

      let analysisEnqueued = false;
      try {
        await this.documentAnalysisQueue.enqueue({
          roomId,
          fileId,
          fileUrl: input.publicBlobUrl,
          mimeType: input.mimeType?.trim() || "application/pdf",
        });
        analysisEnqueued = true;
      } catch (e) {
        console.error("[CompleteRoomFileUrlUseCase] Falha ao enfileirar análise do documento:", e);
      }

      return { ok: true, analysisEnqueued };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao atualizar o ficheiro.";
      return { ok: false, code: "ERROR", message };
    }
  }
}
