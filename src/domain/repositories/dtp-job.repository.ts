import type { DtpJob } from "@/domain/dtp/dtp-job";
import type { DtpJobStatus } from "@/domain/dtp/dtp-job-status";
import type { DtpStep } from "@/domain/dtp/dtp-step";

export type CreateDtpJobParams = {
  id: string;
  userId: string;
  videoFileName: string;
  videoMimeType: string;
  videoBlobUrl: string;
  videoBlobName: string;
};

export type UpdateDtpJobPatch = {
  status?: DtpJobStatus;
  steps?: DtpStep[];
  pdfBlobUrl?: string;
  pdfBlobName?: string;
  errorMessage?: string | null;
};

export interface DtpJobRepository {
  create(params: CreateDtpJobParams): Promise<DtpJob>;
  findByIdForUser(jobId: string, userId: string): Promise<DtpJob | null>;
  updateById(jobId: string, patch: UpdateDtpJobPatch): Promise<boolean>;
}
