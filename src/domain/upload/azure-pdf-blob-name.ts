const INVALID = /[<>:"/\\|?*\x00-\x1f]/g;

function fileBasename(p: string): string {
  const s = p.replace(/\\/g, "/");
  const i = s.lastIndexOf("/");
  return i === -1 ? s : s.slice(i + 1);
}

/**
 * Nome do blob no Azure: um segmento por nível, seguro para URL (prefixo pdf- + id + nome limpo).
 */
export function buildAzurePdfBlobName(originalFileName: string, uniqueId: string): string {
  const base = fileBasename(originalFileName.trim() || "document");
  if (!/\.pdf$/i.test(base)) {
    return "";
  }
  const noExt = base.slice(0, -4);
  const cleaned = noExt.replace(INVALID, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 120);
  const stem = cleaned.length > 0 ? cleaned : "document";
  return `pdf-${uniqueId}-${stem}.pdf`.toLowerCase();
}
