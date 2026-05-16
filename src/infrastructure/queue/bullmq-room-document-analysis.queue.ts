import { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import type {
  RoomDocumentAnalysisQueuePort,
  RoomFileDocumentAnalysisJobPayload,
} from "@/application/ports/room-document-analysis-queue.port";

import { getRedisConnection } from "./redis-connection";

export const ROOM_FILE_DOCUMENT_ANALYSIS_QUEUE = "ROOM_FILE_DOCUMENT_ANALYSIS";

export class BullmqRoomDocumentAnalysisQueue implements RoomDocumentAnalysisQueuePort {
  private queue: Queue<RoomFileDocumentAnalysisJobPayload> | null = null;

  private getQueue(): Queue<RoomFileDocumentAnalysisJobPayload> {
    if (!this.queue) {
      this.queue = new Queue<RoomFileDocumentAnalysisJobPayload>(ROOM_FILE_DOCUMENT_ANALYSIS_QUEUE, {
        connection: getRedisConnection(),
        telemetry: new BullMQOtel("Queue"),
      });
    }
    return this.queue;
  }

  async enqueue(job: RoomFileDocumentAnalysisJobPayload): Promise<void> {
    await this.getQueue().add("document.analysis.v1", job, {
      jobId: `rfa-${job.roomId}-${job.fileId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    });
  }
}
