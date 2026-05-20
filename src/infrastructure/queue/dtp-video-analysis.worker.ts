import { Worker, type Job } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import { ProcessDtpVideoAnalysisUseCase } from "@/application/dtp/use-cases/process-dtp-video-analysis.use-case";
import type { DtpAnalysisJobPayload } from "@/application/ports/dtp-analysis-queue.port";
import { container } from "@/di/container";
import { logger } from "@/lib/logger";

import { DTP_VIDEO_ANALYSIS_QUEUE } from "./bullmq-dtp-analysis.queue";
import { getRedisConnection } from "./redis-connection";

const globalWorkerKey = "__uploadSasDtpVideoAnalysisWorker";

type GlobalWithWorker = typeof globalThis & {
  [globalWorkerKey]?: Worker<DtpAnalysisJobPayload, void, string>;
};

export function startDtpVideoAnalysisWorker(): void {
  const g = globalThis as GlobalWithWorker;
  if (g[globalWorkerKey]) {
    return;
  }
  if (!process.env.REDIS_CONNECTION_STRING?.trim() || !process.env.GENAI_KEY?.trim()) {
    return;
  }

  g[globalWorkerKey] = new Worker<DtpAnalysisJobPayload>(
    DTP_VIDEO_ANALYSIS_QUEUE,
    async (job: Job<DtpAnalysisJobPayload>) => {
      const uc = container.get(ProcessDtpVideoAnalysisUseCase);
      await uc.execute(job.data);
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      telemetry: new BullMQOtel("Worker"),
    },
  );

  g[globalWorkerKey].on("failed", (job, err) => {
    const payload = job?.data;
    logger.error(
      {
        event: "dtp_analysis_bullmq_job_failed",
        jobId: job?.id ?? null,
        attemptsMade: job?.attemptsMade,
        dtpJobId: payload?.jobId ?? null,
        exceptionMessage: err instanceof Error ? err.message : String(err),
        err: err instanceof Error ? err : new Error(String(err)),
      },
      "Worker BullMQ: job de análise DTP falhou.",
    );
  });
}
