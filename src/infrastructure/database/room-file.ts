/**
 * Metadados de ficheiro (ex.: PDF) associado a um quarto.
 * O binário fica no Azure Storage; no MongoDB guarda-se o nome, o URL e um `fileId` estável para correlacionar o upload.
 */
export type RoomFile = {
  /** Chave lógica (ex.: UUID) — liga a entrada ao processo de upload e ao URL final. */
  fileId: string;
  fileName: string;
  /** Vazio até o upload no Azure concluir. */
  fileURL: string;
};
