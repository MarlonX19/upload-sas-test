import type {
  RoomDocumentAiAnalyzer,
  RoomDocumentAiModelOutput,
} from "@/application/ports/room-document-ai-analyzer.port";
import type {
  RoomDocumentIdea,
  RoomDocumentSoco,
  RoomDocumentStep,
} from "@/domain/rooms/value-objects/room-document-analysis";

/** Mantém o contentor válido quando `GENAI_KEY` não está configurada (worker não arranca). */
export class DisabledRoomDocumentAiAnalyzer implements RoomDocumentAiAnalyzer {
  async extractStepsFromPdf(input: {
    pdfBytes: Uint8Array;
    mimeType: string;
  }): Promise<RoomDocumentAiModelOutput<RoomDocumentStep[]>> {
    void input;
    throw new Error("Análise por IA desactivada: defina GENAI_KEY.");
  }

  async extractSocosFromPdf(input: {
    pdfBytes: Uint8Array;
    mimeType: string;
  }): Promise<RoomDocumentAiModelOutput<RoomDocumentSoco[]>> {
    void input;
    throw new Error("Análise por IA desactivada: defina GENAI_KEY.");
  }

  async generateIdeasFromSteps(input: {
    steps: RoomDocumentStep[];
  }): Promise<RoomDocumentAiModelOutput<RoomDocumentIdea[]>> {
    void input;
    throw new Error("Análise por IA desactivada: defina GENAI_KEY.");
  }
}
