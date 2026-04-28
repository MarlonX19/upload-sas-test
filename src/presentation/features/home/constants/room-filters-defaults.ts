import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";

export const DEFAULT_ROOM_FILTERS: RoomFiltersState = {
  priceRange: { min: 0, max: 2000 },
  guests: { min: 1, max: 10 },
  hasAirConditioning: false,
  beds: [],
  bedType: { double: false, single: false },
  amenities: {
    breakfast: false,
    cleaning: false,
    wifi: false,
    parking: false,
    oceanView: false,
    pool: false,
  },
};

export function isDefaultRoomFilters(f: RoomFiltersState): boolean {
  return (
    f.priceRange.min === DEFAULT_ROOM_FILTERS.priceRange.min &&
    f.priceRange.max === DEFAULT_ROOM_FILTERS.priceRange.max &&
    f.guests.min === DEFAULT_ROOM_FILTERS.guests.min &&
    f.guests.max === DEFAULT_ROOM_FILTERS.guests.max &&
    !f.hasAirConditioning &&
    f.beds.length === 0 &&
    !f.bedType.double &&
    !f.bedType.single &&
    !Object.values(f.amenities).some(Boolean)
  );
}

export function countActiveFilters(f: RoomFiltersState): number {
  let c = 0;
  if (f.priceRange.min !== 0 || f.priceRange.max !== 2000) c++;
  if (f.guests.min !== 1 || f.guests.max !== 10) c++;
  if (f.hasAirConditioning) c++;
  if (f.beds.length > 0) c++;
  if (f.bedType.double || f.bedType.single) c++;
  if (Object.values(f.amenities).some(Boolean)) c++;
  return c;
}
