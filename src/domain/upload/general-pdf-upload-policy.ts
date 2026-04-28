/** Limites da UI de upload geral (vários PDFs) — alinhado a `room-pdf-policy` (250 MB). */
export const MAX_UI_PDF_FILES = 15;
export const MAX_UI_PDF_BYTES = 250 * 1024 * 1024;

export const UPLOAD_BLOCK_SIZE_BYTES = 4 * 1024 * 1024;
export const UPLOAD_INTERNAL_CONCURRENCY = 3;
export const UPLOAD_FILE_WORKER_CONCURRENCY = 3;
