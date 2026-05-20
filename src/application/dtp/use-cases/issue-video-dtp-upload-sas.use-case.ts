import { randomUUID } from "node:crypto";

import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { IssueVideoDtpUploadSasBody } from "@/application/dtp/dtos/issue-video-dtp-upload-sas.schema";
import { buildAzureVideoBlobName } from "@/domain/upload/azure-video-blob-name";
import {
  isAllowedDtpVideoFileName,
  isAllowedDtpVideoMime,
} from "@/domain/upload/video-dtp-upload-policy";

export type IssueVideoDtpUploadSasResult =
  | { ok: true; uploadUrl: string; publicBlobUrl: string; blobName: string; expiresOn: string }
  | { ok: false; code: "INVALID_FILE" | "STORAGE"; message: string };

export class IssueVideoDtpUploadSasUseCase {
  constructor(private readonly writeSas: UserDelegationWriteSasPort) {}

  async execute(input: IssueVideoDtpUploadSasBody): Promise<IssueVideoDtpUploadSasResult> {
    if (!isAllowedDtpVideoFileName(input.fileName)) {
      return {
        ok: false,
        code: "INVALID_FILE",
        message: "Extensão de vídeo não suportada. Use MP4, WebM ou MOV.",
      };
    }
    if (!isAllowedDtpVideoMime(input.contentType)) {
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
