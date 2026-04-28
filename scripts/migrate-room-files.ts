import { config } from "dotenv";
import { resolve } from "node:path";
import { MongoClient } from "mongodb";

import { COLLECTIONS } from "@/infrastructure/database/collections";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

/** Garante o campo `files: []` em documentos de quartos legados. */
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
    const res = await db.collection(COLLECTIONS.rooms).updateMany(
      { $or: [{ files: { $exists: false } }, { files: null }] },
      { $set: { files: [] } },
    );
    console.log(
      `Migração de "files" em rooms concluída: ${res.matchedCount} documento(s) alinhado(s), ${res.modifiedCount} atualizado(s).`,
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
