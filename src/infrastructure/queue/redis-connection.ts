import IORedis from "ioredis";

let shared: IORedis | null = null;

/** Uma instância por processo; BullMQ recomenda `maxRetriesPerRequest: null`. */
export function getRedisConnection(): IORedis {
  if (shared) {
    return shared;
  }
  const url = process.env.REDIS_CONNECTION_STRING?.trim();
  if (!url) {
    throw new Error("REDIS_CONNECTION_STRING em falta.");
  }
  shared = new IORedis(url, { maxRetriesPerRequest: null });
  return shared;
}
