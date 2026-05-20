/**
 * Helvetica (WinAnsi) no pdf-lib não suporta Unicode decomposto (NFD, ex. c + ̧)
 * nem alguns símbolos tipográficos. Normaliza para NFC e substitui o que faltar.
 */
export function sanitizePdfText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u200b-\u200d\ufeff]/g, "");
}
