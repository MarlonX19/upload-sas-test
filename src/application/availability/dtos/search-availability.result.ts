/** Saída serializável para UI / JSON (camada de aplicação). */
export type SearchAvailabilityHotelDto = {
  name: string;
  slug: string;
  city?: string;
  starRating?: number;
};

export type SearchAvailabilityRoomDto = {
  roomTypeId: string;
  name: string;
  slug: string;
  description?: string;
  basePricePerNight: number;
  currency: string;
  maxOccupancy: number;
  maxChildren?: number;
  bedSummary: string;
  sizeSqm?: number;
  amenities: string[];
  imageUrls: string[];
  availableRooms: number;
};

export type SearchAvailabilityOutput = {
  hotel: SearchAvailabilityHotelDto;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: { adults: number; children: number; rooms: number };
  results: SearchAvailabilityRoomDto[];
  empty: boolean;
};
