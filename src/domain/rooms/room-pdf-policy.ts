/** Regras de negócio para PDFs anexados a um quarto (invariantes do agregado). */
export const MAX_ROOM_PDF_COUNT = 12;
export const MAX_ROOM_PDF_BYTES = 250 * 1024 * 1024;

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

export function isPdfMagicBytes(firstBytes: Uint8Array): boolean {
  if (firstBytes.length < 4) return false;
  for (let i = 0; i < 4; i += 1) {
    if (firstBytes[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}
