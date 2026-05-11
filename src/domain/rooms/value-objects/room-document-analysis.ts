/** Estado da análise assíncrona do PDF (Vertex) para um ficheiro do quarto. */
export type RoomDocumentAnalysisStatus = "pending" | "processing" | "completed" | "failed";

/** Passo extraído do procedimento documentado. */
export type RoomDocumentStep = {
  title: string;
  description: string;
  order: number;
};

/** SOCOS / achado: risco, lacuna, ponto de melhoria ou questão em aberto. */
export type RoomDocumentSoco = {
  severity: "low" | "medium" | "high";
  topic: string;
  detail: string;
};

/** Ideia de melhoria ou automação sugerida a partir do processo. */
export type RoomDocumentIdea = {
  title: string;
  rationale: string;
};
