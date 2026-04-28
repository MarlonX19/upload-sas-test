import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RoomPdfStoragePort, SavedRoomPdf } from "@/application/ports/room-pdf-storage.port";
import { RoomFileRef } from "@/domain/rooms/value-objects/room-file-ref";
import { getPublicAppUrl } from "@/lib/public-app-url";
import { ROOM_PDF_UPLOAD_ROOT } from "@/infrastructure/storage/room-pdf-upload-path";

const UPLOAD_ROOT = ROOM_PDF_UPLOAD_ROOT;

function slugSegment(name: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return base.length > 0 ? base : "file";
}

export class LocalRoomPdfStorage implements RoomPdfStoragePort {
  async saveRoomPdf(params: {
    roomId: string;
    originalFileName: string;
    content: Uint8Array;
  }): Promise<SavedRoomPdf> {
    const ext = path.extname(params.originalFileName) || ".pdf";
    const base = path.basename(params.originalFileName, ext);
    const safe = `${Date.now()}_${slugSegment(base)}${ext.toLowerCase()}`;
    const dir = path.join(UPLOAD_ROOT, params.roomId);
    await mkdir(dir, { recursive: true });
    const dest = path.join(dir, safe);
    await writeFile(dest, params.content);

    const appUrl = getPublicAppUrl();
    const encoded = encodeURIComponent(safe);
    const publicUrl = `${appUrl}/api/room-pdfs/${params.roomId}/${encoded}`;

    const ref = RoomFileRef.tryCreate(path.basename(params.originalFileName), publicUrl);
    if (!ref) {
      throw new Error("Metadados de ficheiro inválidos.");
    }

    return { storedFileName: safe, publicUrl, ref };
  }
}
