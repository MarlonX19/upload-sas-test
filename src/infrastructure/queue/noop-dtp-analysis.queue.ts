import type { DtpAnalysisQueuePort, DtpAnalysisJobPayload } from "@/application/ports/dtp-analysis-queue.port";

export class NoopDtpAnalysisQueue implements DtpAnalysisQueuePort {
  async enqueue(job: DtpAnalysisJobPayload): Promise<void> {
    void job;
  }
}
