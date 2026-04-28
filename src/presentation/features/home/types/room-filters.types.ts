/** Estado dos filtros laterais (filtro.md) — UI apenas; integração API pode vir depois. */
export type RoomFiltersState = {
  priceRange: { min: number; max: number };
  guests: { min: number; max: number };
  hasAirConditioning: boolean;
  beds: number[];
  bedType: { double: boolean; single: boolean };
  amenities: {
    breakfast: boolean;
    cleaning: boolean;
    wifi: boolean;
    parking: boolean;
    oceanView: boolean;
    pool: boolean;
  };
};
