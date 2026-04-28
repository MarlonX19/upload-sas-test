import type { SearchAvailabilityRoomDto } from "@/application/availability/dtos/search-availability.result";
import { isDefaultRoomFilters } from "@/presentation/features/home/constants/room-filters-defaults";
import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";

function textBlob(room: SearchAvailabilityRoomDto): string {
  return [room.name, room.description, room.bedSummary, ...room.amenities].filter(Boolean).join(" ");
}

function matchesAmenities(room: SearchAvailabilityRoomDto, f: RoomFiltersState["amenities"]): boolean {
  const blob = textBlob(room).toLowerCase();
  if (f.breakfast && !/(pequeno|breakfast|café)/i.test(blob)) return false;
  if (f.cleaning && !/limpeza/i.test(blob)) return false;
  if (f.wifi && !/wi[- ]?fi/i.test(blob)) return false;
  if (f.parking && !/(estacionamento|parking)/i.test(blob)) return false;
  if (f.oceanView && !/(vista mar|ocean|sea view|mar)/i.test(blob)) return false;
  if (f.pool && !/(piscina|pool)/i.test(blob)) return false;
  return true;
}

function matchesBedType(room: SearchAvailabilityRoomDto, bedType: RoomFiltersState["bedType"]): boolean {
  const t = textBlob(room);
  const wantsDouble = bedType.double;
  const wantsSingle = bedType.single;
  if (!wantsDouble && !wantsSingle) return true;
  const doubleOk = /duplo|casal|queen|king|double|matrimonial|cama de casal/i.test(t);
  const singleOk = /twin|single|individual|solteiro|2 camas|duas camas/i.test(t);
  if (wantsDouble && wantsSingle) return doubleOk || singleOk;
  if (wantsDouble) return doubleOk;
  return singleOk;
}

function matchesBeds(room: SearchAvailabilityRoomDto, beds: number[]): boolean {
  if (beds.length === 0) return true;
  const m = room.bedSummary.match(/(\d+)/);
  const n = m ? Number(m[1]) : null;
  if (n == null) return true;
  return beds.includes(n);
}

/**
 * Filtra resultados já carregados (sem backend). Heurísticas para comodidades / camas.
 */
export function applyRoomFilters(
  rooms: SearchAvailabilityRoomDto[],
  filters: RoomFiltersState,
): SearchAvailabilityRoomDto[] {
  if (isDefaultRoomFilters(filters)) return rooms;

  return rooms.filter((room) => {
    const priceEur = room.basePricePerNight / 100;
    if (priceEur < filters.priceRange.min || priceEur > filters.priceRange.max) return false;

    if (room.maxOccupancy < filters.guests.min || room.maxOccupancy > filters.guests.max) return false;

    if (filters.hasAirConditioning) {
      const ac = room.amenities.some((a) => /ar.*condicionado|air conditioning|a\/c/i.test(a));
      if (!ac) return false;
    }

    if (!matchesBeds(room, filters.beds)) return false;

    if (!matchesBedType(room, filters.bedType)) return false;

    if (!matchesAmenities(room, filters.amenities)) return false;

    return true;
  });
}
