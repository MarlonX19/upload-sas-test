import type { CreateRoomInput } from "@/application/rooms/dtos/create-room.schema";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export type CreateRoomFailure =
  | { ok: false; code: "ROOM_TYPE_NOT_IN_HOTEL" | "DUPLICATE_ROOM_NUMBER" }
  | { ok: false; code: "ERROR"; message: string };

export type CreateRoomResult = { ok: true; roomId: string } | CreateRoomFailure;

export class CreateRoomUseCase {
  constructor(private readonly roomAdminRepository: RoomAdminRepository) {}

  async execute(input: CreateRoomInput): Promise<CreateRoomResult> {
    try {
      const types = await this.roomAdminRepository.listRoomTypesByHotel(input.hotelId);
      const typeOk = types.some((t) => t.id === input.roomTypeId);
      if (!typeOk) {
        return { ok: false, code: "ROOM_TYPE_NOT_IN_HOTEL" };
      }

      const { roomId } = await this.roomAdminRepository.createRoom({
        hotelId: input.hotelId,
        roomTypeId: input.roomTypeId,
        number: input.number,
        floor: input.floor,
        status: input.status,
        pendingFiles: input.pendingFiles.length > 0 ? input.pendingFiles : undefined,
      });

      return { ok: true, roomId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("E11000") || msg.toLowerCase().includes("duplicate")) {
        return { ok: false, code: "DUPLICATE_ROOM_NUMBER" };
      }
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      return { ok: false, code: "ERROR", message };
    }
  }
}
