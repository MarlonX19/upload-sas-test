import { z } from "zod";

import { MAX_ROOM_PDF_COUNT } from "@/domain/rooms/room-pdf-policy";
import { isRoomStatus } from "@/domain/rooms/value-objects/room-status";

const objectIdHex = z.string().regex(/^[a-fA-F0-9]{24}$/, "Identificador inválido.");

const pendingFileSchema = z.object({
  fileId: z.string().uuid("fileId inválido."),
  fileName: z
    .string()
    .min(1)
    .max(512)
    .refine((n) => /\.pdf$/i.test(n), "Cada ficheiro tem de ser .pdf"),
});

export const createRoomInputSchema = z.object({
  hotelId: objectIdHex,
  roomTypeId: objectIdHex,
  number: z.string().trim().min(1).max(32),
  floor: z.coerce.number().int().min(-5).max(200),
  status: z.string().refine((s) => isRoomStatus(s), "Estado do registo inválido."),
  pendingFiles: z.array(pendingFileSchema).max(MAX_ROOM_PDF_COUNT).default([]),
});

export type CreateRoomInput = z.infer<typeof createRoomInputSchema>;
