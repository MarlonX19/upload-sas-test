import type {
  RoomDocumentIdea,
  RoomDocumentSoco,
  RoomDocumentStep,
} from "@/domain/rooms/value-objects/room-document-analysis";

/** Métricas de uma chamada `generateObject` ao Vertex/Gemini (AI SDK). */
export type GeminiCallMetrics = {
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

/** Resultado de um passo de análise com métricas de uso do modelo (para observabilidade). */
export type RoomDocumentAiModelOutput<T> = {
  output: T;
  metrics: GeminiCallMetrics;
};

/**
 * Porta de aplicação — análise estruturada do PDF e ideias (adaptador Vertex na infra).
 */
export interface RoomDocumentAiAnalyzer {
  extractStepsFromPdf(input: {
    pdfBytes: Uint8Array;
    mimeType: string;
  }): Promise<RoomDocumentAiModelOutput<RoomDocumentStep[]>>;

  extractSocosFromPdf(input: {
    pdfBytes: Uint8Array;
    mimeType: string;
  }): Promise<RoomDocumentAiModelOutput<RoomDocumentSoco[]>>;

  generateIdeasFromSteps(input: { steps: RoomDocumentStep[] }): Promise<
    RoomDocumentAiModelOutput<RoomDocumentIdea[]>
  >;
}
