import path from "node:path";

/** Diretório raiz dos PDFs de quartos (filesystem local; futuro: Azure). */
export const ROOM_PDF_UPLOAD_ROOT = path.join(process.cwd(), "uploads", "room-pdfs");
