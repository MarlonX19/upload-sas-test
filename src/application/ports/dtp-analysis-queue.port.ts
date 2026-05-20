export type DtpAnalysisJobPayload = {
  jobId: string;
  userId: string;
  videoLocalPath: string;
  videoFileName: string;
  videoMimeType: string;
};

export interface DtpAnalysisQueuePort {
  enqueue(job: DtpAnalysisJobPayload): Promise<void>;
}
