import type { AdminRoomDetail } from "@/domain/repositories/admin-room-detail";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export class GetAdminRoomDetailUseCase {
  constructor(private readonly roomAdminRepository: RoomAdminRepository) {}

  execute(roomId: string): Promise<AdminRoomDetail | null> {
    return this.roomAdminRepository.getRoomDetailForAdmin(roomId);
  }
}
