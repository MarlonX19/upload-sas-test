/**
 * Nomes das coleções MongoDB — infraestrutura.
 */
export const COLLECTIONS = {
  hotels: "hotels",
  roomTypes: "room_types",
  /** Documentos de quarto: `files[]` com fileId, fileName, fileURL (URL preenchido após upload Azure). */
  rooms: "rooms",
  guests: "guests",
  bookings: "bookings",
  ratePlans: "rate_plans",
  payments: "payments",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
