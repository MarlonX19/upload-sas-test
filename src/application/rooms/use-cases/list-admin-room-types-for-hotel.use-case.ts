import type { AdminRoomTypeOption, RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export class ListAdminRoomTypesForHotelUseCase {
  constructor(private readonly roomAdminRepository: RoomAdminRepository) {}

  async execute(hotelId: string): Promise<AdminRoomTypeOption[]> {
    if (!/^[a-fA-F0-9]{24}$/.test(hotelId)) {
      return [];
    }
    return this.roomAdminRepository.listRoomTypesByHotel(hotelId);
  }
}
