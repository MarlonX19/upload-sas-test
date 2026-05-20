import { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type {
  DtpAnalysisJobPayload,
  DtpAnalysisQueuePort,
} from "@/application/ports/dtp-analysis-queue.port";

import { getRedisConnection } from "./redis-connection";

export const DTP_VIDEO_ANALYSIS_QUEUE = "DTP_VIDEO_ANALYSIS";

export class BullmqDtpAnalysisQueue implements DtpAnalysisQueuePort {
  private queue: Queue<DtpAnalysisJobPayload> | null = null;

  private getQueue(): Queue<DtpAnalysisJobPayload> {
    if (!this.queue) {
      this.queue = new Queue<DtpAnalysisJobPayload>(DTP_VIDEO_ANALYSIS_QUEUE, {
        connection: getRedisConnection(),
        telemetry: new BullMQOtel("Queue"),
      });
    }
    return this.queue;
  }

  async enqueue(job: DtpAnalysisJobPayload): Promise<void> {
    await this.getQueue().add("dtp.video.analysis.v1", job, {
      jobId: `dtp-${job.jobId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    });
  }
}
