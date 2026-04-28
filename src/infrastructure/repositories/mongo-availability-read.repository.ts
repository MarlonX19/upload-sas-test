import { ObjectId } from "mongodb";

import { AvailableRoomType } from "@/domain/availability/entities/available-room-type";
import { HotelBrief } from "@/domain/availability/entities/hotel-brief";
import type {
  AvailabilityReadRepository,
  AvailabilitySearchParams,
  AvailabilitySearchResult,
} from "@/domain/repositories/availability-read.repository";
import { COLLECTIONS } from "@/infrastructure/database/collections";
import clientPromise from "@/infrastructure/database/mongo-client";

const BLOCKING_BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "checked_in",
] as const;

const BLOCKED_ROOM_STATUSES = ["maintenance", "out_of_order"] as const;

export class MongoAvailabilityReadRepository implements AvailabilityReadRepository {
  async search(params: AvailabilitySearchParams): Promise<AvailabilitySearchResult | null> {
    const { hotelSlug, range, occupancy, minRooms } = params;
    const checkIn = range.checkIn;
    const checkOut = range.checkOut;

    const client = await clientPromise;
    const db = client.db();

    const hotelDoc = await db.collection(COLLECTIONS.hotels).findOne({
      slug: hotelSlug,
      isActive: true,
    });

    if (!hotelDoc?._id) return null;

    const hotelId = hotelDoc._id as ObjectId;
    const address = hotelDoc.address as { city?: string } | undefined;

    const overlapping = await db
      .collection(COLLECTIONS.bookings)
      .find({
        hotelId,
        status: { $in: [...BLOCKING_BOOKING_STATUSES] },
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
      })
      .project({ roomIds: 1 })
      .toArray();

    const bookedRoomIdStrings = new Set<string>();
    for (const doc of overlapping) {
      const ids = doc.roomIds as ObjectId[] | undefined;
      if (!ids) continue;
      for (const rid of ids) {
        bookedRoomIdStrings.add(rid.toHexString());
      }
    }

    const rooms = await db
      .collection(COLLECTIONS.rooms)
      .find({ hotelId })
      .project({ _id: 1, roomTypeId: 1, status: 1 })
      .toArray();

    const availableCountByTypeHex = new Map<string, number>();

    for (const room of rooms) {
      const status = room.status as string;
      if ((BLOCKED_ROOM_STATUSES as readonly string[]).includes(status)) continue;
      const idHex = (room._id as ObjectId).toHexString();
      if (bookedRoomIdStrings.has(idHex)) continue;
      const typeHex = (room.roomTypeId as ObjectId).toHexString();
      availableCountByTypeHex.set(typeHex, (availableCountByTypeHex.get(typeHex) ?? 0) + 1);
    }

    const roomTypes = await db
      .collection(COLLECTIONS.roomTypes)
      .find({ hotelId, isActive: true })
      .sort({ basePricePerNight: 1 })
      .toArray();

    const roomsDomain: AvailableRoomType[] = [];
    for (const rt of roomTypes) {
      const id = rt._id as ObjectId;
      const availableRooms = availableCountByTypeHex.get(id.toHexString()) ?? 0;
      if (availableRooms < minRooms) continue;

      const maxOccupancy = rt.maxOccupancy as number;
      const maxChildren =
        rt.maxChildren === null || rt.maxChildren === undefined
          ? undefined
          : (rt.maxChildren as number);

      if (!occupancy.fitsRoomType(maxOccupancy, maxChildren)) continue;

      roomsDomain.push(
        new AvailableRoomType(
          id.toHexString(),
          rt.name as string,
          rt.slug as string,
          rt.description as string | undefined,
          rt.basePricePerNight as number,
          (rt.currency as string) ?? "EUR",
          maxOccupancy,
          maxChildren,
          rt.bedSummary as string,
          rt.sizeSqm as number | undefined,
          Array.isArray(rt.amenities) ? (rt.amenities as string[]) : [],
          Array.isArray(rt.imageUrls) ? (rt.imageUrls as string[]) : [],
          availableRooms,
        ),
      );
    }

    const hotel = new HotelBrief(
      hotelDoc.name as string,
      hotelDoc.slug as string,
      address?.city,
      hotelDoc.starRating as number | undefined,
    );

    return { hotel, rooms: roomsDomain };
  }
}
