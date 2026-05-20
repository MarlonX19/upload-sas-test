import { z } from "zod";

export const createDtpJobBodySchema = z.object({
  publicBlobUrl: z.string().url(),
  blobName: z.string().min(1).max(512),
  fileName: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(120),
});

export type CreateDtpJobBody = z.infer<typeof createDtpJobBodySchema>;
