import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { IssueRoomFileUploadSasBody } from "@/application/rooms/dtos/issue-room-file-upload-sas.schema";
import { buildAzurePdfBlobName } from "@/domain/upload/azure-pdf-blob-name";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";
import { logger } from "@/lib/logger";

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
      logger.warn(
        { event: "room_upload_sas_room_not_found", roomId, fileId, hotelId: input.hotelId },
        "SAS não emitido: registo ou organização inválidos.",
      );
      return { ok: false, code: "ROOM_NOT_FOUND", message: "Registo ou organização inválidos." };
    }

    const fileName = await this.roomAdmin.findRoomFileNameByFileId(roomId, fileId);
    if (fileName === null) {
      logger.warn(
        { event: "room_upload_sas_file_not_found", roomId, fileId, hotelId: input.hotelId },
        "SAS não emitido: ficheiro não encontrado no registo.",
      );
      return { ok: false, code: "FILE_NOT_FOUND", message: "Ficheiro não encontrado neste registo." };
    }

    const blobName = buildAzurePdfBlobName(fileName, fileId);
    if (!blobName) {
      logger.warn(
        { event: "room_upload_sas_invalid_blob_name", roomId, fileId, hotelId: input.hotelId, fileName },
        "SAS não emitido: nome do blob é inválido.",
      );
      return { ok: false, code: "INVALID_BLOB", message: "Nome de ficheiro inválido neste registo." };
    }

    try {
      const { uploadUrl, publicBlobUrl, expiresOn } = await this.writeSas.buildUploadUrlForBlob({
        blobName,
      });
      logger.info(
        {
          event: "room_upload_sas_issued",
          roomId,
          fileId,
          hotelId: input.hotelId,
          fileName,
          blobName,
        },
        "SAS de upload ao blob emitido (início do fluxo cliente → Azure).",
      );
      return {
        ok: true,
        uploadUrl,
        publicBlobUrl,
        blobName,
        expiresOn: expiresOn.toISOString(),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao emitir SAS.";
      logger.error(
        {
          event: "room_upload_sas_storage_failed",
          roomId,
          fileId,
          hotelId: input.hotelId,
          fileName,
          blobName,
          exceptionMessage: message,
          err: e instanceof Error ? e : new Error(message),
        },
        "Falha ao emitir SAS de upload ao armazenamento.",
      );
      return { ok: false, code: "STORAGE", message };
    }
  }
}
