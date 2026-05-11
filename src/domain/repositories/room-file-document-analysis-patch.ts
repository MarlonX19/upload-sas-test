import type {
  RoomDocumentAnalysisStatus,
  RoomDocumentIdea,
  RoomDocumentSoco,
  RoomDocumentStep,
} from "@/domain/rooms/value-objects/room-document-analysis";

/** Campos persistidos no item de `files[]` do quarto (Mongo). */
export type RoomFileDocumentAnalysisPatch = {
  analysisStatus?: RoomDocumentAnalysisStatus;
  analysisError?: string | null;
  analysisSteps?: RoomDocumentStep[] | null;
  socos?: RoomDocumentSoco[] | null;
  ideas?: RoomDocumentIdea[] | null;
  analysisUpdatedAt?: Date;
};
