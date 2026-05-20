import { z } from "zod";

export const issueVideoDtpUploadSasBodySchema = z.object({
  fileName: z.string().min(1).max(260),
  contentType: z.string().min(1).max(120),
});

export type IssueVideoDtpUploadSasBody = z.infer<typeof issueVideoDtpUploadSasBodySchema>;
