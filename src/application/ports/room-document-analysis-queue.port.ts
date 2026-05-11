export type RoomFileDocumentAnalysisJobPayload = {
  roomId: string;
  fileId: string;
  fileUrl: string;
  mimeType: string;
};

/**
 * Fila assíncrona para não bloquear o pedido HTTP após o PATCH do URL (padrão evento → worker).
 */
export interface RoomDocumentAnalysisQueuePort {
  enqueue(job: RoomFileDocumentAnalysisJobPayload): Promise<void>;
}
