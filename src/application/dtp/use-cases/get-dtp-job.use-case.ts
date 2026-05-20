import type { DtpJobRepository } from "@/domain/repositories/dtp-job.repository";
import type { DtpJob } from "@/domain/dtp/dtp-job";

export type GetDtpJobResult =
  | { ok: true; job: DtpJob }
  | { ok: false; code: "NOT_FOUND"; message: string };

export class GetDtpJobUseCase {
  constructor(private readonly dtpJobRepository: DtpJobRepository) {}

  async execute(userId: string, jobId: string): Promise<GetDtpJobResult> {
    const job = await this.dtpJobRepository.findByIdForUser(jobId, userId);
    if (!job) {
      return { ok: false, code: "NOT_FOUND", message: "Job não encontrado." };
    }
    return { ok: true, job };
  }
}
