import type { DtpJobStatus } from "./dtp-job-status";
import type { DtpStep } from "./dtp-step";

export type DtpJob = {
  id: string;
  userId: string;
  videoFileName: string;
  videoMimeType: string;
  videoBlobUrl: string;
  videoBlobName: string;
  status: DtpJobStatus;
  steps?: DtpStep[];
  pdfBlobUrl?: string;
  pdfBlobName?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};
