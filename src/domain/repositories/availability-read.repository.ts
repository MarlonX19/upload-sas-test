import type { AvailableRoomType } from "@/domain/availability/entities/available-room-type";
import type { HotelBrief } from "@/domain/availability/entities/hotel-brief";
import type { GuestOccupancy } from "@/domain/availability/value-objects/guest-occupancy";
import type { StayDateRange } from "@/domain/availability/value-objects/stay-date-range";

export type AvailabilitySearchParams = {
  hotelSlug: string;
  range: StayDateRange;
  occupancy: GuestOccupancy;
  /** Número mínimo de quartos físicos livres por tipo. */
  minRooms: number;
};

export type AvailabilitySearchResult = {
  hotel: HotelBrief;
  rooms: AvailableRoomType[];
};

/**
 * Leitura de disponibilidade — contrato da camada de domínio (implementação na infra).
 */
export interface AvailabilityReadRepository {
  search(params: AvailabilitySearchParams): Promise<AvailabilitySearchResult | null>;
}
