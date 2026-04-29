import { randomUUID } from "node:crypto";

import { ObjectId, type UpdateFilter, type Document } from "mongodb";

import type {
  AdminHotelOption,
  AdminRoomTypeOption,
  CreateRoomParams,
  RoomAdminRepository,
} from "@/domain/repositories/room-admin.repository";
import type { RoomFileRef } from "@/domain/rooms/value-objects/room-file-ref";
import { COLLECTIONS } from "@/infrastructure/database/collections";
import type { RoomFile } from "@/infrastructure/database/room-file";
import clientPromise from "@/infrastructure/database/mongo-client";

export class MongoRoomAdminRepository implements RoomAdminRepository {
  async listHotelsForAdmin(): Promise<AdminHotelOption[]> {
    const client = await clientPromise;
    const db = client.db();
    const docs = await db
      .collection(COLLECTIONS.hotels)
      .find({ isActive: true })
      .sort({ name: 1 })
      .project({ _id: 1, name: 1, slug: 1 })
      .toArray();

    return docs.map((d) => ({
      id: (d._id as ObjectId).toHexString(),
      name: d.name as string,
      slug: d.slug as string,
    }));
  }

  async listRoomTypesByHotel(hotelId: string): Promise<AdminRoomTypeOption[]> {
    if (!ObjectId.isValid(hotelId)) return [];
    const hid = new ObjectId(hotelId);
    const client = await clientPromise;
    const db = client.db();
    const docs = await db
      .collection(COLLECTIONS.roomTypes)
      .find({ hotelId: hid, isActive: true })
      .sort({ name: 1 })
      .project({ _id: 1, name: 1, slug: 1 })
      .toArray();

    return docs.map((d) => ({
      id: (d._id as ObjectId).toHexString(),
      name: d.name as string,
      slug: d.slug as string,
    }));
  }

  async createRoom(params: CreateRoomParams): Promise<{ roomId: string }> {
    const hotelId = new ObjectId(params.hotelId);
    const roomTypeId = new ObjectId(params.roomTypeId);
    const client = await clientPromise;
    const db = client.db();
    const now = new Date();

    const pending = params.pendingFiles ?? [];
    const files: RoomFile[] = pending.map((p) => ({
      fileId: p.fileId,
      fileName: p.fileName,
      fileURL: "",
    }));

    const _id = new ObjectId();
    await db.collection(COLLECTIONS.rooms).insertOne({
      _id,
      hotelId,
      roomTypeId,
      number: params.number,
      floor: params.floor,
      status: params.status,
      files,
      createdAt: now,
      updatedAt: now,
    });

    return { roomId: _id.toHexString() };
  }

  async getPdfFileCount(roomId: string): Promise<number> {
    if (!ObjectId.isValid(roomId)) return 0;
    const client = await clientPromise;
    const db = client.db();
    const doc = await db
      .collection(COLLECTIONS.rooms)
      .findOne({ _id: new ObjectId(roomId) }, { projection: { files: 1 } });
    const files = doc?.files;
    return Array.isArray(files) ? files.length : 0;
  }

  async roomBelongsToHotel(roomId: string, hotelId: string): Promise<boolean> {
    if (!ObjectId.isValid(roomId) || !ObjectId.isValid(hotelId)) return false;
    const client = await clientPromise;
    const db = client.db();
    const n = await db.collection(COLLECTIONS.rooms).countDocuments({
      _id: new ObjectId(roomId),
      hotelId: new ObjectId(hotelId),
    });
    return n === 1;
  }

  async appendRoomFile(roomId: string, file: RoomFileRef): Promise<void> {
    if (!ObjectId.isValid(roomId)) {
      throw new Error("Invalid room id");
    }
    const client = await clientPromise;
    const db = client.db();
    const row: RoomFile = {
      fileId: randomUUID(),
      fileName: file.fileName,
      fileURL: file.fileURL,
    };
    const res = await db.collection(COLLECTIONS.rooms).updateOne(
      { _id: new ObjectId(roomId) },
      {
        $push: { files: row },
        $set: { updatedAt: new Date() },
      } as unknown as UpdateFilter<Document>,
    );
    if (res.matchedCount === 0) {
      throw new Error("Room not found");
    }
  }

  async setRoomFileUrlByFileId(
    roomId: string,
    fileId: string,
    publicBlobUrl: string,
  ): Promise<boolean> {
    if (!ObjectId.isValid(roomId)) {
      return false;
    }
    const client = await clientPromise;
    const db = client.db();
    const res = await db.collection(COLLECTIONS.rooms).updateOne(
      { _id: new ObjectId(roomId), "files.fileId": fileId },
      {
        $set: {
          "files.$.fileURL": publicBlobUrl,
          updatedAt: new Date(),
        },
      } as unknown as UpdateFilter<Document>,
    );
    return (res.matchedCount ?? 0) > 0;
  }

  async findRoomFileNameByFileId(roomId: string, fileId: string): Promise<string | null> {
    if (!ObjectId.isValid(roomId)) {
      return null;
    }
    const client = await clientPromise;
    const db = client.db();
    const doc = await db
      .collection(COLLECTIONS.rooms)
      .findOne(
        { _id: new ObjectId(roomId) },
        { projection: { files: 1 } },
      );
    const files = doc?.files;
    if (!Array.isArray(files)) {
      return null;
    }
    for (const f of files) {
      const row = f as { fileId?: string; fileName?: string };
      if (row.fileId === fileId && typeof row.fileName === "string") {
        return row.fileName;
      }
    }
    return null;
  }
}
