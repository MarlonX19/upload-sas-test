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

export async function requestVideoDtpUploadSas(file: File): Promise<VideoUploadSasResponse> {
  const res = await fetch("/api/dtp/upload-sas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "video/mp4",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<VideoUploadSasResponse>;
  if (!res.ok) {
    throw new Error(body.error ?? "Não foi possível obter permissão de upload (SAS).");
  }
  if (!body.uploadUrl || !body.publicBlobUrl || !body.blobName) {
    throw new Error("Resposta inválida do servidor.");
  }
  return body as VideoUploadSasResponse;
}

export async function uploadVideoToAzure(
  file: File,
  onProgress: (percent: number) => void,
): Promise<VideoUploadSasResponse> {
  const sas = await requestVideoDtpUploadSas(file);
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

export type CreateDtpJobResponse = {
  job: {
    id: string;
    status: string;
    videoFileName: string;
  };
};

export async function createDtpJob(input: {
  publicBlobUrl: string;
  blobName: string;
  fileName: string;
  mimeType: string;
}): Promise<CreateDtpJobResponse> {
  const res = await fetch("/api/dtp/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<CreateDtpJobResponse>;
  if (!res.ok) {
    throw new Error(body.error ?? "Não foi possível criar o job de análise.");
  }
  if (!body.job?.id) {
    throw new Error("Resposta inválida ao criar job.");
  }
  return body as CreateDtpJobResponse;
}

export type DtpJobPollResponse = {
  job: {
    id: string;
    status: "queued" | "processing" | "completed" | "failed" | "uploading";
    videoFileName: string;
    steps?: {
      order: number;
      title: string;
      description: string;
      timestampSec: number;
      screenshotBlobUrl?: string;
    }[];
    pdfBlobUrl?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
  };
};

export async function fetchDtpJob(jobId: string): Promise<DtpJobPollResponse> {
  const res = await fetch(`/api/dtp/jobs/${encodeURIComponent(jobId)}`);
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<DtpJobPollResponse>;
  if (!res.ok) {
    throw new Error(body.error ?? "Não foi possível obter o estado do job.");
  }
  if (!body.job) {
    throw new Error("Resposta inválida do servidor.");
  }
  return body as DtpJobPollResponse;
}
