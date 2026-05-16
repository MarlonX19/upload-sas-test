import { MongoClient } from "mongodb";

const options = {};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createConnectingPromise(uri: string): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri, options).connect();
    }
    return global._mongoClientPromise;
  }

  const client = new MongoClient(uri, options);
  return client.connect();
}

let cached: Promise<MongoClient> | null = null;

/**
 * Resolve a primeira ligação ao Mongo. Chamado no primeiro await — não avalia/envia
 * `MONGODB_URI` no carregamento do módulo, para o `next build` funcionar dentro do Docker
 * sem definir secrets de runtime no estágio builder.
 */
function resolveConnectingPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    return Promise.reject(
      new Error("Defina MONGODB_URI nas variáveis de ambiente (ex.: `.env.local` ou App settings)."),
    );
  }

  if (cached !== null) {
    return cached;
  }

  cached = createConnectingPromise(uri);
  return cached;
}

/**
 * Objeto thenable compatível com `Promise<MongoClient>` — usado assim: `await clientPromise`.
 */
const clientPromise = {
  [Symbol.toStringTag]: "Promise",
  then<TResult1 = MongoClient, TResult2 = never>(
    onfulfilled?: ((value: MongoClient) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return resolveConnectingPromise().then(onfulfilled, onrejected);
  },
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<MongoClient | TResult> {
    return resolveConnectingPromise().catch(onrejected);
  },
  finally(onfinally?: (() => void) | null): Promise<MongoClient> {
    return resolveConnectingPromise().finally(onfinally ?? undefined);
  },
} satisfies Promise<MongoClient>;

export default clientPromise;
