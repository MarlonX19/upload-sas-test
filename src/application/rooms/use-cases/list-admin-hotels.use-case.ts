import type { AdminHotelOption, RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export class ListAdminHotelsUseCase {
  constructor(private readonly roomAdminRepository: RoomAdminRepository) {}

  async execute(): Promise<AdminHotelOption[]> {
    return this.roomAdminRepository.listHotelsForAdmin();
  }
}
