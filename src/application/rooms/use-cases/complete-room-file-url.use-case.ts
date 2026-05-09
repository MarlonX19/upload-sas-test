import type { CompleteRoomFileUrlBody } from "@/application/rooms/dtos/complete-room-file-url.schema";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export type CompleteRoomFileUrlResult =
  | { ok: true }
  | { ok: false; code: "ROOM_NOT_FOUND" | "FILE_NOT_FOUND" | "ERROR"; message: string };

export class CompleteRoomFileUrlUseCase {
  constructor(private readonly roomAdminRepository: RoomAdminRepository) {}

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
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao atualizar o ficheiro.";
      return { ok: false, code: "ERROR", message };
    }
  }
}
