import { z } from "zod";

export const requestUploadSasBodySchema = z.object({
  fileName: z.string().trim().min(1).max(512),
  contentType: z.string().max(200).optional().default(""),
});

export type RequestUploadSasBody = z.infer<typeof requestUploadSasBodySchema>;
