"use client";

import { useMutation } from "@tanstack/react-query";

import type { SearchAvailabilityOutput } from "@/application/availability/dtos/search-availability.result";
import { searchAvailabilityAction } from "@/presentation/features/home/actions/search-availability.action";

export type SearchAvailabilityMutationInput = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotelSlug?: string;
};

export function useSearchAvailability() {
  return useMutation({
    mutationFn: async (input: SearchAvailabilityMutationInput): Promise<SearchAvailabilityOutput> => {
      const result = await searchAvailabilityAction({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        children: input.children,
        rooms: input.rooms,
        hotelSlug: input.hotelSlug,
      });
      if (result?.serverError) {
        throw new Error(result.serverError);
      }
      if (result?.validationErrors) {
        throw new Error("Dados inválidos.");
      }
      if (!result?.data) {
        throw new Error("Resposta vazia.");
      }
      return result.data;
    },
  });
}
