import type { RoomFileRef } from "@/domain/rooms/value-objects/room-file-ref";

export type SavedRoomPdf = {
  /** Nome seguro no disco / path segment (pode diferir do original). */
  storedFileName: string;
  /** URL pública ou de API para obter o ficheiro. */
  publicUrl: string;
  /** Metadados a persistir no agregado. */
  ref: RoomFileRef;
};

/**
 * Escrita de binários PDF do quarto (Azure Blob, filesystem local, etc.).
 */
export interface RoomPdfStoragePort {
  saveRoomPdf(params: {
    roomId: string;
    originalFileName: string;
    content: Uint8Array;
  }): Promise<SavedRoomPdf>;
}
