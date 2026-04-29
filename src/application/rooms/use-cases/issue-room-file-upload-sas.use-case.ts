import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { IssueRoomFileUploadSasBody } from "@/application/rooms/dtos/issue-room-file-upload-sas.schema";
import { buildAzurePdfBlobName } from "@/domain/upload/azure-pdf-blob-name";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export type IssueRoomFileUploadSasResult =
  | { ok: true; uploadUrl: string; publicBlobUrl: string; blobName: string; expiresOn: string }
  | {
      ok: false;
      code: "ROOM_NOT_FOUND" | "FILE_NOT_FOUND" | "INVALID_BLOB" | "STORAGE";
      message: string;
    };

export class IssueRoomFileUploadSasUseCase {
  constructor(
    private readonly roomAdmin: RoomAdminRepository,
    private readonly writeSas: UserDelegationWriteSasPort,
  ) {}

  async execute(
    roomId: string,
    fileId: string,
    input: IssueRoomFileUploadSasBody,
  ): Promise<IssueRoomFileUploadSasResult> {
    const belongs = await this.roomAdmin.roomBelongsToHotel(roomId, input.hotelId);
    if (!belongs) {
      return { ok: false, code: "ROOM_NOT_FOUND", message: "Quarto ou hotel inválido." };
    }

    const fileName = await this.roomAdmin.findRoomFileNameByFileId(roomId, fileId);
    if (fileName === null) {
      return { ok: false, code: "FILE_NOT_FOUND", message: "Ficheiro não encontrado no quarto." };
    }

    const blobName = buildAzurePdfBlobName(fileName, fileId);
    if (!blobName) {
      return { ok: false, code: "INVALID_BLOB", message: "Nome de ficheiro inválido no quarto." };
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
