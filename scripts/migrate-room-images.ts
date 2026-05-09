import { config } from "dotenv";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

import { COLLECTIONS } from "@/infrastructure/database/collections";
import { ROOM_TYPE_IMAGE_URLS } from "@/infrastructure/database/room-type-images";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const SEED_DEMO_ORG_SLUG = "upload-demo-seed";

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
    const hotel = await db.collection(COLLECTIONS.hotels).findOne({ slug: SEED_DEMO_ORG_SLUG });
    if (!hotel?._id) {
      console.error(
        `Organização com slug "${SEED_DEMO_ORG_SLUG}" não encontrada. Corra a seed primeiro.`,
      );
      process.exit(1);
    }

    const hotelId = hotel._id;
    let updated = 0;

    for (const [slug, imageUrls] of Object.entries(ROOM_TYPE_IMAGE_URLS)) {
      const res = await db.collection(COLLECTIONS.roomTypes).updateOne(
        { hotelId, slug },
        { $set: { imageUrls, updatedAt: new Date() } },
      );
      if (res.matchedCount) {
        updated += 1;
        console.log(`  ${slug}: ${imageUrls.length} imagem(ns)`);
      }
    }

    console.log(`Migração de imagens concluída (${updated} categorias).`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
