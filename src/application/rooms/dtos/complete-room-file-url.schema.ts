import { z } from "zod";

const objectIdHex = z.string().regex(/^[a-fA-F0-9]{24}$/, "Identificador inválido.");

const maxUploadMs = z.number().int().nonnegative().max(86400000); // até 24h (retomadas)
const maxPdfBytes = 250 * 1024 * 1024; // alinhado ao limite típico de upload

export const completeRoomFileUrlBodySchema = z.object({
  hotelId: objectIdHex,
  publicBlobUrl: z.string().url("URL do blob inválida.").max(4000),
  mimeType: z.string().min(1).max(255).optional(),
  /** Duração do upload no cliente até commit + PATCH (milissegundos). Opcional para telemetria. */
  uploadDurationMs: maxUploadMs.optional(),
  /** Tamanho do PDF em octetos, conforme o cliente gravou na sessão. */
  fileSizeBytes: z.number().int().positive().max(maxPdfBytes).optional(),
  /** Nome original enviado pelo cliente. */
  fileName: z.string().trim().min(1).max(512).optional(),
});

export type CompleteRoomFileUrlBody = z.infer<typeof completeRoomFileUrlBodySchema>;
