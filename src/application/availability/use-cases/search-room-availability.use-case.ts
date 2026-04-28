import type { SearchAvailabilityInput } from "@/application/availability/dtos/search-availability.schema";
import type { SearchAvailabilityOutput } from "@/application/availability/dtos/search-availability.result";
import { GuestOccupancy } from "@/domain/availability/value-objects/guest-occupancy";
import { StayDateRange } from "@/domain/availability/value-objects/stay-date-range";
import type { AvailabilityReadRepository } from "@/domain/repositories/availability-read.repository";

export type SearchAvailabilityFailure =
  | { ok: false; code: "INVALID_DATES" | "PAST_CHECK_IN" | "HOTEL_NOT_FOUND" | "INVALID_GUESTS" }
  | { ok: false; code: "ERROR"; message: string };

export type SearchAvailabilityResponse =
  | { ok: true; data: SearchAvailabilityOutput }
  | SearchAvailabilityFailure;

export class SearchRoomAvailabilityUseCase {
  constructor(private readonly availabilityReadRepository: AvailabilityReadRepository) {}

  async execute(input: SearchAvailabilityInput): Promise<SearchAvailabilityResponse> {
    const range = StayDateRange.tryFromIsoStrings(input.checkIn, input.checkOut);
    if (!range) {
      return { ok: false, code: "INVALID_DATES" };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!range.checkInOnOrAfter(today)) {
      return { ok: false, code: "PAST_CHECK_IN" };
    }

    const occupancy = GuestOccupancy.tryCreate(input.adults, input.children);
    if (!occupancy) {
      return { ok: false, code: "INVALID_GUESTS" };
    }

    try {
      const found = await this.availabilityReadRepository.search({
        hotelSlug: input.hotelSlug,
        range,
        occupancy,
        minRooms: input.rooms,
      });

      if (!found) {
        return { ok: false, code: "HOTEL_NOT_FOUND" };
      }

      const nights = range.nights();
      const results = found.rooms.map((r) => ({
        roomTypeId: r.roomTypeId,
        name: r.name,
        slug: r.slug,
        description: r.description,
        basePricePerNight: r.basePricePerNight,
        currency: r.currency,
        maxOccupancy: r.maxOccupancy,
        maxChildren: r.maxChildren,
        bedSummary: r.bedSummary,
        sizeSqm: r.sizeSqm,
        amenities: [...r.amenities],
        imageUrls: [...r.imageUrls],
        availableRooms: r.availableRooms,
      }));

      const data: SearchAvailabilityOutput = {
        hotel: {
          name: found.hotel.name,
          slug: found.hotel.slug,
          city: found.hotel.city,
          starRating: found.hotel.starRating,
        },
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        nights,
        guests: { adults: occupancy.adults, children: occupancy.children, rooms: input.rooms },
        results,
        empty: results.length === 0,
      };

      return { ok: true, data };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      return { ok: false, code: "ERROR", message };
    }
  }
}
