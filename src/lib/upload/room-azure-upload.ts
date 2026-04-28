import { uploadOnePdfToAzure } from "@/lib/upload/azure-parallel-pdf-upload";

/**
 * Faz upload do PDF ao Azure (SAS) e grava o URL final no documento do quarto (via `fileId`).
 */
export async function uploadRoomFileToAzureAndSaveUrl(
  file: File,
  fileId: string,
  roomId: string,
  hotelId: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const result = await uploadOnePdfToAzure(file, onProgress);
  const res = await fetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}/url`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, publicBlobUrl: result.publicBlobUrl }),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Falha ao guardar a URL do ficheiro no quarto.");
  }
}

const DEFAULT_PARALLEL = 3;

/**
 * Vários PDFs: lotes paralelos (igual à política de `uploadsFile.md`).
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
