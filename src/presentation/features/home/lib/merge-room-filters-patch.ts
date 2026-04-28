import type { RoomFiltersState } from "@/presentation/features/home/types/room-filters.types";

export function mergeRoomFiltersPatch(
  current: RoomFiltersState,
  patch: Partial<RoomFiltersState>,
): RoomFiltersState {
  return {
    ...current,
    ...patch,
    priceRange: patch.priceRange
      ? { ...current.priceRange, ...patch.priceRange }
      : current.priceRange,
    guests: patch.guests ? { ...current.guests, ...patch.guests } : current.guests,
    beds: patch.beds !== undefined ? patch.beds : current.beds,
    bedType: patch.bedType ? { ...current.bedType, ...patch.bedType } : current.bedType,
    amenities: patch.amenities ? { ...current.amenities, ...patch.amenities } : current.amenities,
  };
}
