import { randomUUID } from "node:crypto";

import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { RequestUploadSasBody } from "@/application/upload/dtos/request-upload-sas.schema";
import { buildAzureVideoBlobName } from "@/domain/upload/azure-video-blob-name";
import {
  isAllowedVideoFileName,
  isAllowedVideoMime,
  normalizeVideoMime,
} from "@/domain/upload/video-upload-policy";

export type IssueVideoBlobUploadSasResult =
  | { ok: true; uploadUrl: string; publicBlobUrl: string; blobName: string; expiresOn: string }
  | { ok: false; code: "INVALID_FILE" | "STORAGE"; message: string };

export class IssueVideoBlobUploadSasUseCase {
  constructor(private readonly writeSas: UserDelegationWriteSasPort) {}

  async execute(input: RequestUploadSasBody): Promise<IssueVideoBlobUploadSasResult> {
    if (!isAllowedVideoFileName(input.fileName)) {
      return {
        ok: false,
        code: "INVALID_FILE",
        message: "Extensão de vídeo não suportada. Use MP4, WebM, MOV ou AVI.",
      };
    }

    const contentType = normalizeVideoMime(input.contentType || "");
    if (contentType && !isAllowedVideoMime(contentType)) {
      return {
        ok: false,
        code: "INVALID_FILE",
        message: "Tipo MIME de vídeo não suportado.",
      };
    }

    const blobName = buildAzureVideoBlobName(input.fileName, randomUUID());
    if (!blobName) {
      return { ok: false, code: "INVALID_FILE", message: "Nome de ficheiro inválido." };
    }

    try {
      const { uploadUrl, publicBlobUrl, expiresOn } = await this.writeSas.buildUploadUrlForBlob({
        blobName,
      });
      return {
        ok: true,
        uploadUrl,
        publicBlobUrl,
        blobName,
        expiresOn: expiresOn.toISOString(),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao emitir SAS.";
      return { ok: false, code: "STORAGE", message };
    }
  }
}
