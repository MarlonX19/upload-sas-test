import { randomUUID } from "node:crypto";

import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { RequestUploadSasBody } from "@/application/upload/dtos/request-upload-sas.schema";
import { buildAzurePdfBlobName } from "@/domain/upload/azure-pdf-blob-name";

export type IssuePdfBlobUploadSasResult =
  | { ok: true; uploadUrl: string; publicBlobUrl: string; blobName: string; expiresOn: string }
  | { ok: false; code: "INVALID_FILE" | "STORAGE"; message: string };

export class IssuePdfBlobUploadSasUseCase {
  constructor(private readonly writeSas: UserDelegationWriteSasPort) {}

  async execute(input: RequestUploadSasBody): Promise<IssuePdfBlobUploadSasResult> {
    if (!/\.pdf$/i.test(input.fileName)) {
      return { ok: false, code: "INVALID_FILE", message: "O ficheiro tem de ser .pdf" };
    }

    const blobName = buildAzurePdfBlobName(input.fileName, randomUUID());
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
