import { BlockBlobClient, RestError } from "@azure/storage-blob";

import { encodePdfUploadBlockId } from "@/domain/upload/azure-pdf-block-id";
import {
  UPLOAD_BLOCK_SIZE_BYTES,
  UPLOAD_INTERNAL_CONCURRENCY,
} from "@/domain/upload/general-pdf-upload-policy";
import {
  deleteRoomUploadSession,
  getRoomUploadSession,
  putRoomUploadSession,
  ROOM_UPLOAD_SESSION_VERSION,
  type RoomUploadSessionV1,
} from "@/lib/upload/room-upload-session-idb";

export type RoomFileUploadSasResponse = {
  uploadUrl: string;
  publicBlobUrl: string;
  blobName: string;
  expiresOn: string;
};

export async function requestRoomFileUploadSas(
  roomId: string,
  fileId: string,
  hotelId: string,
): Promise<RoomFileUploadSasResponse> {
  const res = await fetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}/upload-sas`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<RoomFileUploadSasResponse>;
  if (!res.ok) {
    throw new Error(body.error ?? "Não foi possível obter permissão de upload (SAS).");
  }
  if (!body.uploadUrl || !body.publicBlobUrl) {
    throw new Error("Resposta inválida do servidor.");
  }
  return body as RoomFileUploadSasResponse;
}

function waitForOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      resolve();
    };
    window.addEventListener("online", done);
  });
}

function totalBlockCount(fileSize: number, blockSize: number): number {
  return Math.max(1, Math.ceil(fileSize / blockSize));
}

function mergeCompletedIndices(current: number[], newlyDone: number[]): number[] {
  const s = new Set([...current, ...newlyDone]);
  return Array.from(s).sort((a, b) => a - b);
}

function percentFromCompleted(
  completed: number[],
  fileSize: number,
  blockSize: number,
): number {
  const n = totalBlockCount(fileSize, blockSize);
  if (completed.length >= n) return 100;
  let bytes = 0;
  for (const i of completed) {
    if (i < 0 || i >= n) continue;
    const offset = i * blockSize;
    bytes += Math.min(blockSize, fileSize - offset);
  }
  return fileSize > 0 ? Math.min(100, Math.round((bytes / fileSize) * 100)) : 0;
}

function shouldRefreshSasFromError(e: unknown): boolean {
  if (e instanceof RestError) {
    return e.statusCode === 401 || e.statusCode === 403;
  }
  if (e instanceof Error) {
    return /403|401|expired|SAS/i.test(e.message);
  }
  return false;
}

async function stageBlockWithRetry(
  client: BlockBlobClient,
  blockIndex: number,
  data: Uint8Array,
  getClient: () => Promise<BlockBlobClient>,
): Promise<void> {
  const blockId = encodePdfUploadBlockId(blockIndex);
  let c = client;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await c.stageBlock(blockId, data, data.byteLength);
      return;
    } catch (e) {
      if (shouldRefreshSasFromError(e) && attempt < 3) {
        c = await getClient();
        continue;
      }
      throw e;
    }
  }
}

async function commitBlockListWithRetry(
  client: BlockBlobClient,
  blockIds: string[],
  commitOptions: Parameters<BlockBlobClient["commitBlockList"]>[1],
  getClient: () => Promise<BlockBlobClient>,
): Promise<void> {
  let c = client;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await c.commitBlockList(blockIds, commitOptions);
      return;
    } catch (e) {
      if (shouldRefreshSasFromError(e) && attempt < 3) {
        c = await getClient();
        continue;
      }
      throw e;
    }
  }
}

/**
 * Cria ou actualiza a sessão local a partir de um `File` e executa upload em blocos + commit + PATCH URL.
 * Se `file` for omitido, lê a sessão existente no IndexedDB (retoma após recarregar).
 */
export async function uploadResumableRoomPdfToAzureAndSaveUrl(
  options: {
    roomId: string;
    fileId: string;
    hotelId: string;
    file?: File;
  },
  onProgress: (percent: number) => void,
): Promise<void> {
  const { roomId, fileId, hotelId } = options;
  const blockSize = UPLOAD_BLOCK_SIZE_BYTES;
  const parallel = UPLOAD_INTERNAL_CONCURRENCY;

  let session: RoomUploadSessionV1;
  if (options.file) {
    const f = options.file;
    if (f.size === 0) {
      throw new Error("O ficheiro PDF está vazio.");
    }
    const buf = await f.arrayBuffer();
    session = {
      version: ROOM_UPLOAD_SESSION_VERSION,
      roomId,
      fileId,
      hotelId,
      fileName: f.name,
      contentType: f.type || "application/pdf",
      size: f.size,
      fileData: buf,
      completedBlockIndices: [],
      updatedAt: Date.now(),
    };
    await putRoomUploadSession(session);
  } else {
    const existing = await getRoomUploadSession(roomId, fileId);
    if (!existing) {
      throw new Error("Não existe sessão de upload guardada para retomar.");
    }
    if (existing.hotelId !== hotelId) {
      throw new Error("Sessão de upload incompatível com o hotel actual.");
    }
    session = existing;
  }

  const fileSize = session.size;
  const nBlocks = totalBlockCount(fileSize, blockSize);
  let completed = [...session.completedBlockIndices];

  const getSas = () => requestRoomFileUploadSas(roomId, fileId, hotelId);
  let sas = await getSas();
  let client = new BlockBlobClient(sas.uploadUrl);

  const refreshClient = async () => {
    sas = await getSas();
    client = new BlockBlobClient(sas.uploadUrl);
    return client;
  };

  const runProgress = () => onProgress(percentFromCompleted(completed, fileSize, blockSize));

  const completedSet = new Set(completed);
  while (completedSet.size < nBlocks) {
    await waitForOnline();
    const pending: number[] = [];
    for (let i = 0; i < nBlocks; i++) {
      if (!completedSet.has(i)) pending.push(i);
    }
    if (pending.length === 0) break;
    const batch = pending.slice(0, parallel);
    const buf = session.fileData;

    await Promise.all(
      batch.map(async (blockIndex) => {
        const offset = blockIndex * blockSize;
        const len = Math.min(blockSize, fileSize - offset);
        const data = new Uint8Array(buf, offset, len);
        await stageBlockWithRetry(client, blockIndex, data, refreshClient);
      }),
    );

    for (const i of batch) {
      completedSet.add(i);
    }
    completed = Array.from(completedSet).sort((a, b) => a - b);
    session = {
      ...session,
      completedBlockIndices: completed,
      updatedAt: Date.now(),
    };
    await putRoomUploadSession(session);
    runProgress();
  }

  if (completedSet.size !== nBlocks) {
    throw new Error("Estado de blocos inconsistente.");
  }

  await waitForOnline();
  sas = await getSas();
  client = new BlockBlobClient(sas.uploadUrl);
  const blockIds: string[] = [];
  for (let i = 0; i < nBlocks; i++) {
    blockIds.push(encodePdfUploadBlockId(i));
  }

  const commitOpts = {
    blobHTTPHeaders: {
      blobContentType: session.contentType || "application/pdf",
    },
  };
  await commitBlockListWithRetry(client, blockIds, commitOpts, refreshClient);
  onProgress(100);

  sas = await getSas();

  const patchRes = await fetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}/url`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, publicBlobUrl: sas.publicBlobUrl }),
    },
  );
  if (!patchRes.ok) {
    const j = (await patchRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Falha ao guardar a URL do ficheiro no quarto.");
  }

  await deleteRoomUploadSession(roomId, fileId);
}
