import type { DtpJob } from "@/domain/dtp/dtp-job";

export type DtpJobClientView = {
  id: string;
  status: DtpJob["status"];
  videoFileName: string;
  outputLanguage: DtpJob["outputLanguage"];
  steps?: DtpJob["steps"];
  pdfBlobUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export function toDtpJobClientView(job: DtpJob): DtpJobClientView {
  return {
    id: job.id,
    status: job.status,
    videoFileName: job.videoFileName,
    outputLanguage: job.outputLanguage,
    steps: job.steps,
    pdfBlobUrl: job.pdfBlobUrl,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
