/**
 * ID de bloco estável para `stageBlock` / `commitBlockList` (ordem = índice do bloco no ficheiro).
 * Formato: base64(UTF-8) de string fixa, compatível com exigência Azure (máx. 64 bytes antes de codificar).
 * @see https://learn.microsoft.com/en-us/rest/api/storageservices/put-block#request-body
 */
export function encodePdfUploadBlockId(blockIndex: number): string {
  const id = `b${String(blockIndex).padStart(10, "0")}`;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(id, "utf8").toString("base64");
  }
  return btoa(id);
}
