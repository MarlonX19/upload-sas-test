export type DtpAnalysisJobPayload = {
  jobId: string;
  userId: string;
  videoBlobUrl: string;
  videoFileName: string;
  videoMimeType: string;
};

export interface DtpAnalysisQueuePort {
  enqueue(job: DtpAnalysisJobPayload): Promise<void>;
}
