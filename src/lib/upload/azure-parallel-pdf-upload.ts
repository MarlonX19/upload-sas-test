import { BlockBlobClient } from "@azure/storage-blob";

import {
  UPLOAD_BLOCK_SIZE_BYTES,
  UPLOAD_FILE_WORKER_CONCURRENCY,
  UPLOAD_INTERNAL_CONCURRENCY,
} from "@/domain/upload/general-pdf-upload-policy";

export type UploadSasResponse = {
  uploadUrl: string;
  publicBlobUrl: string;
  blobName: string;
  expiresOn: string;
};

export async function requestPdfUploadSas(file: File): Promise<UploadSasResponse> {
  const res = await fetch("/api/upload-sas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/pdf",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<UploadSasResponse>;
  if (!res.ok) {
    throw new Error(body.error ?? "Não foi possível obter permissão de upload (SAS).");
  }
  if (!body.uploadUrl || !body.publicBlobUrl) {
    throw new Error("Resposta inválida do servidor.");
  }
  return body as UploadSasResponse;
}

/**
 * Upload com blocos e progresso (uploadsFile.md: block 4MB, concurrency 3 no SDK).
 */
export async function uploadOnePdfToAzure(
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadSasResponse> {
  const sas = await requestPdfUploadSas(file);
  const client = new BlockBlobClient(sas.uploadUrl);
  await client.uploadData(file, {
    blockSize: UPLOAD_BLOCK_SIZE_BYTES,
    concurrency: UPLOAD_INTERNAL_CONCURRENCY,
    onProgress: (ev) => {
      const pct = file.size > 0 ? Math.round((ev.loadedBytes / file.size) * 100) : 0;
      onProgress(Math.min(100, pct));
    },
  });
  onProgress(100);
  return sas;
}

/**
 * Vários ficheiros: até 3 uploads em paralelo; quando um lote termina, inicia o seguinte.
 */
export async function uploadPdfsInParallelBatches(
  files: File[],
  onFileProgress: (index: number, progress: number) => void,
  parallel: number = UPLOAD_FILE_WORKER_CONCURRENCY,
): Promise<UploadSasResponse[]> {
  const results: UploadSasResponse[] = [];
  const batchSize = Math.max(1, Math.min(parallel, files.length));

  for (let start = 0; start < files.length; start += batchSize) {
    const end = Math.min(start + batchSize, files.length);
    const batch = await Promise.all(
      files.slice(start, end).map((file, offset) => {
        const index = start + offset;
        return uploadOnePdfToAzure(file, (p) => onFileProgress(index, p));
      }),
    );
    results.push(...batch);
  }
  return results;
}
