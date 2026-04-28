import { z } from "zod";

export const searchAvailabilityInputSchema = z
  .object({
    hotelSlug: z.string().min(1).optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
    adults: z.coerce.number().int().min(1).max(30).optional(),
    children: z.coerce.number().int().min(0).max(15).optional(),
    rooms: z.coerce.number().int().min(1).max(8).optional(),
  })
  .transform((data) => ({
    hotelSlug: data.hotelSlug ?? "hotelli-seed-demo",
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    adults: data.adults ?? 2,
    children: data.children ?? 0,
    rooms: data.rooms ?? 1,
  }));

export type SearchAvailabilityInput = z.output<typeof searchAvailabilityInputSchema>;
