import type {
  RoomDocumentIdea,
  RoomDocumentSoco,
  RoomDocumentStep,
} from "@/domain/rooms/value-objects/room-document-analysis";

/**
 * Porta de aplicação — análise estruturada do PDF e ideias (adaptador Vertex na infra).
 */
export interface RoomDocumentAiAnalyzer {
  extractStepsFromPdf(input: { pdfBytes: Uint8Array; mimeType: string }): Promise<RoomDocumentStep[]>;
  extractSocosFromPdf(input: { pdfBytes: Uint8Array; mimeType: string }): Promise<RoomDocumentSoco[]>;
  generateIdeasFromSteps(input: { steps: RoomDocumentStep[] }): Promise<RoomDocumentIdea[]>;
}
