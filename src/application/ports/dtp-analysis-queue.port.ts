import type { DtpOutputLanguage } from "@/domain/dtp/dtp-output-language";

export type DtpAnalysisJobPayload = {
  jobId: string;
  userId: string;
  videoLocalPath: string;
  videoFileName: string;
  videoMimeType: string;
  outputLanguage: DtpOutputLanguage;
};

export interface DtpAnalysisQueuePort {
  enqueue(job: DtpAnalysisJobPayload): Promise<void>;
}
