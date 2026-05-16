const DB_NAME = "upload-sas-room-sessions";
const DB_VERSION = 1;
const STORE = "sessions";

export const ROOM_UPLOAD_SESSION_VERSION = 1 as const;

export type RoomUploadSessionV1 = {
  version: typeof ROOM_UPLOAD_SESSION_VERSION;
  roomId: string;
  fileId: string;
  hotelId: string;
  fileName: string;
  contentType: string;
  size: number;
  fileData: ArrayBuffer;
  /** Índices de bloco já enviados com sucesso (0-based), únicos, ordenados */
  completedBlockIndices: number[];
  updatedAt: number;
  /** Epoch (ms) em que o utilizador iniciou este upload (para duração total no PATCH). */
  uploadStartedAtEpochMs?: number;
};

export function roomUploadSessionKey(roomId: string, fileId: string): string {
  return `${roomId}::${fileId}`;
}

type StoredRow = RoomUploadSessionV1 & { key: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponível."));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
  });
}

export async function putRoomUploadSession(session: RoomUploadSessionV1): Promise<void> {
  const db = await openDb();
  const key = roomUploadSessionKey(session.roomId, session.fileId);
  const row: StoredRow = { key, ...session };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const r = tx.objectStore(STORE).put(row);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function getRoomUploadSession(
  roomId: string,
  fileId: string,
): Promise<RoomUploadSessionV1 | null> {
  const db = await openDb();
  const key = roomUploadSessionKey(roomId, fileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const raw = r.result as StoredRow | undefined;
      db.close();
      if (!raw || raw.version !== ROOM_UPLOAD_SESSION_VERSION) {
        resolve(null);
        return;
      }
      const { key: _k, ...rest } = raw;
      resolve(rest as RoomUploadSessionV1);
    };
  });
}

export async function deleteRoomUploadSession(roomId: string, fileId: string): Promise<void> {
  const db = await openDb();
  const key = roomUploadSessionKey(roomId, fileId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const r = tx.objectStore(STORE).delete(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function listRoomUploadSessions(): Promise<RoomUploadSessionV1[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).getAll();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const rows = (r.result ?? []) as StoredRow[];
      db.close();
      const out: RoomUploadSessionV1[] = [];
      for (const raw of rows) {
        if (raw?.version !== ROOM_UPLOAD_SESSION_VERSION) continue;
        const { key: _k, ...rest } = raw;
        out.push(rest as RoomUploadSessionV1);
      }
      resolve(out);
    };
  });
}
