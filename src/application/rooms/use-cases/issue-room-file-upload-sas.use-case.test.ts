import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { UserDelegationWriteSasPort } from "@/application/ports/user-delegation-write-sas.port";
import type { RoomAdminRepository } from "@/domain/repositories/room-admin.repository";
import { buildAzurePdfBlobName } from "@/domain/upload/azure-pdf-blob-name";

import { IssueRoomFileUploadSasUseCase } from "./issue-room-file-upload-sas.use-case";

const HOTEL_ID = "507f1f77bcf86cd799439011";

describe("IssueRoomFileUploadSasUseCase", () => {
  it("emits SAS for a deterministic blob name from room file + fileId", async () => {
    const roomAdmin: Pick<RoomAdminRepository, "roomBelongsToHotel" | "findRoomFileNameByFileId"> = {
      roomBelongsToHotel: async () => true,
      findRoomFileNameByFileId: async () => "relatorio.pdf",
    };
    const writeSas: UserDelegationWriteSasPort = {
      buildUploadUrlForBlob: async ({ blobName }) => ({
        uploadUrl: `https://account.blob.core.windows.net/c/${blobName}?sas=1`,
        publicBlobUrl: `https://account.blob.core.windows.net/c/${blobName}`,
        expiresOn: new Date("2026-06-01T00:00:00.000Z"),
      }),
    };
    const uc = new IssueRoomFileUploadSasUseCase(
      roomAdmin as RoomAdminRepository,
      writeSas,
    );
    const out = await uc.execute("roomid", "550e8400-e29b-41d4-a716-446655440000", {
      hotelId: HOTEL_ID,
    });
    assert.equal(out.ok, true);
    if (out.ok) {
      const expected = buildAzurePdfBlobName("relatorio.pdf", "550e8400-e29b-41d4-a716-446655440000");
      assert.equal(out.blobName, expected);
    }
  });
});
