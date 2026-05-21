import type { DtpOutputLanguage } from "@/domain/dtp/dtp-output-language";

export type DtpJobPollResponse = {
  job: {
    id: string;
    status: "queued" | "processing" | "completed" | "failed" | "uploading";
    videoFileName: string;
    outputLanguage?: DtpOutputLanguage;
    steps?: {
      order: number;
      title: string;
      description: string;
      timestampSec: number;
    }[];
    pdfBlobUrl?: string;
    errorMessage?: string;
    createdAt: string;
    updatedAt: string;
  };
};

export type UploadDtpVideoResult = {
  job: DtpJobPollResponse["job"];
};

/**
 * Envia o vídeo para o servidor (multipart) — ficheiro fica só em temp até à análise.
 */
export function uploadDtpVideoWithProgress(
  file: File,
  outputLanguage: DtpOutputLanguage,
  onProgress: (percent: number) => void,
): Promise<UploadDtpVideoResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("video", file, file.name);
    form.append("outputLanguage", outputLanguage);

    xhr.upload.addEventListener("progress", (ev) => {
      if (!ev.lengthComputable || file.size === 0) return;
      const pct = Math.round((ev.loaded / file.size) * 100);
      onProgress(Math.min(100, pct));
    });

    xhr.addEventListener("load", () => {
      let body: { error?: string; job?: UploadDtpVideoResult["job"] } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        body = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.job?.id) {
        onProgress(100);
        resolve({ job: body.job });
        return;
      }
      reject(new Error(body.error ?? `Falha no envio (${xhr.status}).`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Erro de rede ao enviar o vídeo."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Envio cancelado."));
    });

    xhr.open("POST", "/api/dtp/jobs");
    xhr.send(form);
  });
}

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
