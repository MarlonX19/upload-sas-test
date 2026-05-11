import { Worker, type Job } from "bullmq";

import { ProcessRoomFileDocumentAnalysisUseCase } from "@/application/rooms/use-cases/process-room-file-document-analysis.use-case";
import { container } from "@/di/container";
import type { RoomFileDocumentAnalysisJobPayload } from "@/application/ports/room-document-analysis-queue.port";

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
    },
  );

  g[globalWorkerKey].on("failed", (job, err) => {
    console.error("[room-file-analysis-worker] Job falhou", job?.id, err);
  });
}
