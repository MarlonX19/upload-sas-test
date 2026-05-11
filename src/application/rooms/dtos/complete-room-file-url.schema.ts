import { z } from "zod";

const objectIdHex = z.string().regex(/^[a-fA-F0-9]{24}$/, "Identificador inválido.");

export const completeRoomFileUrlBodySchema = z.object({
  hotelId: objectIdHex,
  publicBlobUrl: z.string().url("URL do blob inválida.").max(4000),
  mimeType: z.string().min(1).max(255).optional(),
});

export type CompleteRoomFileUrlBody = z.infer<typeof completeRoomFileUrlBodySchema>;
