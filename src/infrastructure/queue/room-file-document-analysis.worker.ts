import { Worker, type Job } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import { ProcessRoomFileDocumentAnalysisUseCase } from "@/application/rooms/use-cases/process-room-file-document-analysis.use-case";
import { container } from "@/di/container";
import type { RoomFileDocumentAnalysisJobPayload } from "@/application/ports/room-document-analysis-queue.port";
import { logger } from "@/lib/logger";

import { ROOM_FILE_DOCUMENT_ANALYSIS_QUEUE } from "./bullmq-room-document-analysis.queue";
import { getRedisConnection } from "./redis-connection";

const globalWorkerKey = "__uploadSasRoomFileDocumentAnalysisWorker";

type GlobalWithWorker = typeof globalThis & {
  [globalWorkerKey]?: Worker<RoomFileDocumentAnalysisJobPayload, void, string>;
};

export function startRoomFileDocumentAnalysisWorker(): void {
  const g = globalThis as GlobalWithWorker;
  if (g[globalWorkerKey]) {
    return;
  }
  if (!process.env.REDIS_CONNECTION_STRING?.trim() || !process.env.GENAI_KEY?.trim()) {
    return;
  }

  g[globalWorkerKey] = new Worker<RoomFileDocumentAnalysisJobPayload>(
    ROOM_FILE_DOCUMENT_ANALYSIS_QUEUE,
    async (job: Job<RoomFileDocumentAnalysisJobPayload>) => {
      const uc = container.get(ProcessRoomFileDocumentAnalysisUseCase);
      await uc.execute(job.data);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
      telemetry: new BullMQOtel("Worker"),
    },
  );

  g[globalWorkerKey].on("failed", (job, err) => {
    const payload = job?.data;
    logger.error(
      {
        event: "room_document_analysis_bullmq_job_failed",
        jobId: job?.id ?? null,
        attemptsMade: job?.attemptsMade,
        roomId: payload?.roomId ?? null,
        fileId: payload?.fileId ?? null,
        exceptionMessage: err instanceof Error ? err.message : String(err),
        err: err instanceof Error ? err : new Error(String(err)),
      },
      "Worker BullMQ: job de análise do documento falhou.",
    );
  });
}
