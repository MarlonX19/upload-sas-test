import { BlockBlobClient } from "@azure/storage-blob";

import {
  UPLOAD_BLOCK_SIZE_BYTES,
  UPLOAD_INTERNAL_CONCURRENCY,
} from "@/domain/upload/general-pdf-upload-policy";

export type VideoUploadSasResponse = {
  uploadUrl: string;
  publicBlobUrl: string;
  blobName: string;
  expiresOn: string;
};

export async function requestVideoUploadSas(file: File): Promise<VideoUploadSasResponse> {
  const res = await fetch("/api/upload-sas/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "video/mp4",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<VideoUploadSasResponse>;
  if (!res.ok) {
    throw new Error(body.error ?? "Não foi possível obter permissão de upload (SAS).");
  }
  if (!body.uploadUrl || !body.publicBlobUrl || !body.blobName) {
    throw new Error("Resposta inválida do servidor.");
  }
  return body as VideoUploadSasResponse;
}

/**
 * Upload direto ao Azure Blob com blocos e progresso (mesmo padrão dos PDFs).
 */
export async function uploadVideoToAzure(
  file: File,
  onProgress: (percent: number) => void,
): Promise<VideoUploadSasResponse> {
  const sas = await requestVideoUploadSas(file);
  const client = new BlockBlobClient(sas.uploadUrl);
  await client.uploadData(file, {
    blockSize: UPLOAD_BLOCK_SIZE_BYTES,
    concurrency: UPLOAD_INTERNAL_CONCURRENCY,
    blobHTTPHeaders: {
      blobContentType: file.type || "video/mp4",
    },
    onProgress: (ev) => {
      const pct = file.size > 0 ? Math.round((ev.loadedBytes / file.size) * 100) : 0;
      onProgress(Math.min(100, pct));
    },
  });
  onProgress(100);
  return sas;
}
