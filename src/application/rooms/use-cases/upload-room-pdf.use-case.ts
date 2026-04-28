import type { RoomPdfStoragePort } from "@/application/ports/room-pdf-storage.port";
import { MAX_ROOM_PDF_BYTES, MAX_ROOM_PDF_COUNT, isPdfMagicBytes } from "@/domain/rooms/room-pdf-policy";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";

export type UploadRoomPdfFailure =
  | {
      ok: false;
      code:
        | "ROOM_NOT_FOUND"
        | "TOO_MANY_FILES"
        | "FILE_TOO_LARGE"
        | "NOT_PDF"
        | "INVALID_FILE_NAME";
    }
  | { ok: false; code: "ERROR"; message: string };

export type UploadRoomPdfResult = { ok: true; fileName: string; fileURL: string } | UploadRoomPdfFailure;

export class UploadRoomPdfUseCase {
  constructor(
    private readonly roomAdminRepository: RoomAdminRepository,
    private readonly roomPdfStorage: RoomPdfStoragePort,
  ) {}

  async execute(params: {
    hotelId: string;
    roomId: string;
    originalFileName: string;
    content: Uint8Array;
  }): Promise<UploadRoomPdfResult> {
    const { hotelId, roomId, originalFileName, content } = params;

    const trimmedName = originalFileName.trim();
    if (!/\.pdf$/i.test(trimmedName)) {
      return { ok: false, code: "INVALID_FILE_NAME" };
    }

    const okHotel = await this.roomAdminRepository.roomBelongsToHotel(roomId, hotelId);
    if (!okHotel) {
      return { ok: false, code: "ROOM_NOT_FOUND" };
    }

    const count = await this.roomAdminRepository.getPdfFileCount(roomId);
    if (count >= MAX_ROOM_PDF_COUNT) {
      return { ok: false, code: "TOO_MANY_FILES" };
    }

    if (content.byteLength > MAX_ROOM_PDF_BYTES) {
      return { ok: false, code: "FILE_TOO_LARGE" };
    }

    const head = content.byteLength >= 4 ? content.subarray(0, 4) : new Uint8Array(0);
    if (!isPdfMagicBytes(head)) {
      return { ok: false, code: "NOT_PDF" };
    }

    try {
      const saved = await this.roomPdfStorage.saveRoomPdf({
        roomId,
        originalFileName: trimmedName,
        content,
      });

      await this.roomAdminRepository.appendRoomFile(roomId, saved.ref);

      return { ok: true, fileName: saved.ref.fileName, fileURL: saved.ref.fileURL };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro desconhecido";
      return { ok: false, code: "ERROR", message };
    }
  }
}
