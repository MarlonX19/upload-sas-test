import { config } from "dotenv";
import { resolve } from "node:path";
import type { Db, Document } from "mongodb";
import { MongoClient, ObjectId } from "mongodb";

import { COLLECTIONS } from "@/infrastructure/database/collections";
import type { RoomFile } from "@/infrastructure/database/room-file";
import { ROOM_TYPE_IMAGE_URLS } from "@/infrastructure/database/room-type-images";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const SEED_HOTEL_SLUG = "hotelli-seed-demo";

async function ensureIndexes(db: Db) {
  await db.collection(COLLECTIONS.hotels).createIndex({ slug: 1 }, { unique: true });
  await db
    .collection(COLLECTIONS.roomTypes)
    .createIndex({ hotelId: 1, slug: 1 }, { unique: true });
  await db.collection(COLLECTIONS.rooms).createIndex({ hotelId: 1, number: 1 }, { unique: true });
  await db.collection(COLLECTIONS.guests).createIndex({ email: 1 }, { unique: true });
  await db.collection(COLLECTIONS.bookings).createIndex({ bookingReference: 1 }, { unique: true });
  await db.collection(COLLECTIONS.bookings).createIndex({ hotelId: 1, checkIn: 1, checkOut: 1 });
  await db.collection(COLLECTIONS.rooms).createIndex({ hotelId: 1, roomTypeId: 1 });
  await db.collection(COLLECTIONS.bookings).createIndex({ guestId: 1 });
}

async function clearSeedHotel(db: Db) {
  const existing = await db.collection(COLLECTIONS.hotels).findOne({ slug: SEED_HOTEL_SLUG });
  if (!existing?._id) return;

  const hotelId = existing._id as ObjectId;

  const bookings = await db
    .collection(COLLECTIONS.bookings)
    .find({ hotelId })
    .project({ _id: 1 })
    .toArray();
  const bookingIds = bookings.map((b: Document) => b._id as ObjectId);

  if (bookingIds.length > 0) {
    await db.collection(COLLECTIONS.payments).deleteMany({ bookingId: { $in: bookingIds } });
  }
  await db.collection(COLLECTIONS.bookings).deleteMany({ hotelId });
  await db.collection(COLLECTIONS.rooms).deleteMany({ hotelId });
  await db.collection(COLLECTIONS.roomTypes).deleteMany({ hotelId });
  await db.collection(COLLECTIONS.ratePlans).deleteMany({ hotelId });
  await db.collection(COLLECTIONS.hotels).deleteOne({ _id: hotelId });

  await db.collection(COLLECTIONS.guests).deleteMany({
    email: { $in: ["maria.silva@seed.hotelli.test", "joao.santos@seed.hotelli.test"] },
  });
}

function now() {
  return new Date();
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Defina MONGODB_URI no .env ou .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  try {
    await ensureIndexes(db);
    await clearSeedHotel(db);

    const t = now();
    const hotelId = new ObjectId();

    await db.collection(COLLECTIONS.hotels).insertOne({
      _id: hotelId,
      name: "Hotelli Lisboa — Demo",
      slug: SEED_HOTEL_SLUG,
      description:
        "Hotel de demonstração para desenvolvimento. Bem-vindo à experiência Hotelli.",
      address: {
        street: "Avenida da Liberdade 120",
        city: "Lisboa",
        state: "Lisboa",
        country: "PT",
        postalCode: "1250-001",
        coordinates: [-9.145, 38.7223],
      },
      contact: { phone: "+351 21 000 0000", email: "reservas@seed.hotelli.test" },
      timezone: "Europe/Lisbon",
      starRating: 4,
      amenities: ["Wi‑Fi", "Pequeno-almoço", "Ar condicionado", "Receção 24h", "Fitness"],
      imageUrls: [],
      isActive: true,
      createdAt: t,
      updatedAt: t,
    });

    const roomTypeSpecs = [
      {
        slug: "standard-double",
        name: "Standard Duplo",
        description: "Quarto confortável com cama de casal ou duas individuais.",
        maxOccupancy: 2,
        bedSummary: "1 cama queen ou 2 singles",
        basePricePerNight: 8900,
        sizeSqm: 22,
        amenities: ["TV", "Cofre", "Mini-bar"],
      },
      {
        slug: "superior-twin",
        name: "Superior Twin",
        description: "Mais espaço e vista parcial para a cidade.",
        maxOccupancy: 2,
        maxChildren: 1,
        bedSummary: "2 camas individuais",
        basePricePerNight: 11500,
        sizeSqm: 26,
        amenities: ["TV 4K", "Cofre", "Mini-bar", "Nespresso"],
      },
      {
        slug: "deluxe-king",
        name: "Deluxe King",
        description: "Cama king, área de estar e casa de banho com banheira.",
        maxOccupancy: 2,
        maxChildren: 1,
        bedSummary: "1 cama king",
        basePricePerNight: 14900,
        sizeSqm: 32,
        amenities: ["TV 4K", "Cofre", "Mini-bar", "Nespresso", "Roupão"],
      },
      {
        slug: "junior-suite",
        name: "Junior Suite",
        description: "Suite com sala separada e vista privilegiada.",
        maxOccupancy: 3,
        maxChildren: 2,
        bedSummary: "1 king + sofá-cama",
        basePricePerNight: 21000,
        sizeSqm: 45,
        amenities: ["Sala", "2 TVs", "Mini-bar premium", "Banheira", "Roupão"],
      },
    ] as const;

    const roomTypeIds: ObjectId[] = [];
    for (const spec of roomTypeSpecs) {
      const id = new ObjectId();
      roomTypeIds.push(id);
      await db.collection(COLLECTIONS.roomTypes).insertOne({
        _id: id,
        hotelId,
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        maxOccupancy: spec.maxOccupancy,
        maxChildren: "maxChildren" in spec ? spec.maxChildren : undefined,
        bedSummary: spec.bedSummary,
        basePricePerNight: spec.basePricePerNight,
        currency: "EUR",
        sizeSqm: spec.sizeSqm,
        imageUrls: [...(ROOM_TYPE_IMAGE_URLS[spec.slug] ?? [])],
        amenities: [...spec.amenities],
        isActive: true,
        createdAt: t,
        updatedAt: t,
      });
    }

    const [rtStandard, rtSuperior, rtDeluxe, rtSuite] = roomTypeIds;

    const roomRows: { number: string; floor: number; roomTypeId: ObjectId; status: string }[] =
      [
        { number: "101", floor: 1, roomTypeId: rtStandard, status: "available" },
        { number: "102", floor: 1, roomTypeId: rtStandard, status: "available" },
        { number: "103", floor: 1, roomTypeId: rtStandard, status: "cleaning" },
        { number: "201", floor: 2, roomTypeId: rtSuperior, status: "available" },
        { number: "202", floor: 2, roomTypeId: rtSuperior, status: "occupied" },
        { number: "203", floor: 2, roomTypeId: rtSuperior, status: "available" },
        { number: "301", floor: 3, roomTypeId: rtDeluxe, status: "available" },
        { number: "302", floor: 3, roomTypeId: rtDeluxe, status: "maintenance" },
        { number: "401", floor: 4, roomTypeId: rtSuite, status: "available" },
        { number: "402", floor: 4, roomTypeId: rtSuite, status: "available" },
      ];

    const roomIdsForBooking: ObjectId[] = [];

    for (const row of roomRows) {
      const rid = new ObjectId();
      if (row.number === "201") roomIdsForBooking.push(rid);
      await db.collection(COLLECTIONS.rooms).insertOne({
        _id: rid,
        hotelId,
        roomTypeId: row.roomTypeId,
        number: row.number,
        floor: row.floor,
        status: row.status,
        files: [] satisfies RoomFile[],
        createdAt: t,
        updatedAt: t,
      });
    }

    const guestId = new ObjectId();
    await db.collection(COLLECTIONS.guests).insertOne({
      _id: guestId,
      email: "maria.silva@seed.hotelli.test",
      phone: "+351 910 000 001",
      firstName: "Maria",
      lastName: "Silva",
      nationality: "PT",
      createdAt: t,
      updatedAt: t,
    });

    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 7);
    checkIn.setHours(15, 0, 0, 0);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3);
    checkOut.setHours(11, 0, 0, 0);

    const bookingRef = `HTL-${Date.now().toString(36).toUpperCase().slice(-8)}`;

    await db.collection(COLLECTIONS.bookings).insertOne({
      hotelId,
      bookingReference: bookingRef,
      guestId,
      guest: {
        email: "maria.silva@seed.hotelli.test",
        firstName: "Maria",
        lastName: "Silva",
        phone: "+351 910 000 001",
      },
      roomIds: roomIdsForBooking,
      checkIn,
      checkOut,
      status: "confirmed",
      adults: 2,
      children: 0,
      totalAmount: 11500 * 3,
      currency: "EUR",
      specialRequests: "Quarto alto, longe do elevador.",
      source: "web",
      createdAt: t,
      updatedAt: t,
    });

    await db.collection(COLLECTIONS.guests).insertOne({
      _id: new ObjectId(),
      email: "joao.santos@seed.hotelli.test",
      phone: "+351 920 000 002",
      firstName: "João",
      lastName: "Santos",
      createdAt: t,
      updatedAt: t,
    });

    console.log("Seed concluído.");
    console.log(`  Hotel slug: ${SEED_HOTEL_SLUG} (${hotelId.toHexString()})`);
    console.log(`  Tipos de quarto: ${roomTypeSpecs.length}`);
    console.log(`  Quartos: ${roomRows.length}`);
    console.log(`  Reserva exemplo: ${bookingRef}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
