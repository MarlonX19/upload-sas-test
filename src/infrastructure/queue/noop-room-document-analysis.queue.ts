import type {
  RoomDocumentAnalysisQueuePort,
  RoomFileDocumentAnalysisJobPayload,
} from "@/application/ports/room-document-analysis-queue.port";

export class NoopRoomDocumentAnalysisQueue implements RoomDocumentAnalysisQueuePort {
  async enqueue(job: RoomFileDocumentAnalysisJobPayload): Promise<void> {
    void job;
  }
}
