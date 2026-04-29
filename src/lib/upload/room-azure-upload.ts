import {
  deleteRoomUploadSession,
  type RoomUploadSessionV1,
} from "@/lib/upload/room-upload-session-idb";
import { uploadResumableRoomPdfToAzureAndSaveUrl } from "@/lib/upload/resumable-room-pdf-upload";

/**
 * Upload retomável: grava o binário em IndexedDB, blocos no Azure, depois PATCH do URL no quarto.
 */
export async function uploadRoomFileToAzureAndSaveUrl(
  file: File,
  fileId: string,
  roomId: string,
  hotelId: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  await uploadResumableRoomPdfToAzureAndSaveUrl(
    { roomId, fileId, hotelId, file },
    onProgress,
  );
}

/**
 * Continua a partir da sessão em IndexedDB (após perda de rede ou recarregar a página).
 */
export async function resumeRoomFileUploadFromSession(
  roomId: string,
  fileId: string,
  hotelId: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  await uploadResumableRoomPdfToAzureAndSaveUrl(
    { roomId, fileId, hotelId },
    onProgress,
  );
}

const DEFAULT_PARALLEL = 3;

/**
 * Vários PDFs: lotes paralelos (até 3 ficheiros em simultâneo).
 */
export async function uploadRoomPdfsToAzureInBatches(
  items: { file: File; fileId: string }[],
  roomId: string,
  hotelId: string,
  onFileProgress: (index: number, progress: number) => void,
  onFileComplete?: (index: number) => void,
  parallel: number = DEFAULT_PARALLEL,
): Promise<void> {
  const batchSize = Math.max(1, Math.min(parallel, items.length));
  for (let start = 0; start < items.length; start += batchSize) {
    const slice = items.slice(start, start + batchSize);
    await Promise.all(
      slice.map((item, offset) => {
        const index = start + offset;
        return uploadRoomFileToAzureAndSaveUrl(
          item.file,
          item.fileId,
          roomId,
          hotelId,
          (p) => onFileProgress(index, p),
        ).then(() => {
          onFileComplete?.(index);
        });
      }),
    );
  }
}

/**
 * Retoma vários envios a partir de metadados de sessão (sem `File` em memória).
 */
export async function resumeRoomPdfsFromSessionsInBatches(
  sessions: RoomUploadSessionV1[],
  onFileProgress: (index: number, progress: number) => void,
  onFileComplete?: (index: number) => void,
  parallel: number = DEFAULT_PARALLEL,
): Promise<void> {
  const batchSize = Math.max(1, Math.min(parallel, sessions.length));
  for (let start = 0; start < sessions.length; start += batchSize) {
    const slice = sessions.slice(start, start + batchSize);
    await Promise.all(
      slice.map((s, offset) => {
        const index = start + offset;
        return resumeRoomFileUploadFromSession(s.roomId, s.fileId, s.hotelId, (p) =>
          onFileProgress(index, p),
        ).then(() => {
          onFileComplete?.(index);
        });
      }),
    );
  }
}

export async function discardRoomUploadSession(roomId: string, fileId: string): Promise<void> {
  await deleteRoomUploadSession(roomId, fileId);
}
