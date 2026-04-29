import { z } from "zod";

const objectIdHex = z.string().regex(/^[a-fA-F0-9]{24}$/, "Identificador inválido.");

export const issueRoomFileUploadSasBodySchema = z.object({
  hotelId: objectIdHex,
});

export type IssueRoomFileUploadSasBody = z.infer<typeof issueRoomFileUploadSasBodySchema>;
