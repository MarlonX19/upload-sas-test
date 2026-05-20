import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { StandardFonts, rgb } from "pdf-lib";

import type { DtpPdfRgb, DtpPdfTemplate } from "@/domain/dtp/dtp-pdf-template";
import { sanitizePdfText } from "@/infrastructure/documents/pdf-text-sanitize";

export type DtpPdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

export type DtpPdfLayoutContext = {
  pdf: PDFDocument;
  template: DtpPdfTemplate;
  fonts: DtpPdfFonts;
  contentWidth: number;
  contentBottomY: number;
};

function toRgb(c: DtpPdfRgb): RGB {
  return rgb(c.r, c.g, c.b);
}

export async function embedDtpPdfFonts(pdf: PDFDocument): Promise<DtpPdfFonts> {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

export function createDtpPdfLayoutContext(
  pdf: PDFDocument,
  template: DtpPdfTemplate,
  fonts: DtpPdfFonts,
): DtpPdfLayoutContext {
  const { width, margin } = template.page;
  return {
    pdf,
    template,
    fonts,
    contentWidth: width - margin * 2,
    contentBottomY: margin + template.footer.height,
  };
}

export function contentTopY(template: DtpPdfTemplate): number {
  const { height, margin } = template.page;
  return height - margin - template.header.height;
}

export function drawCoverPage(
  ctx: DtpPdfLayoutContext,
  input: { videoTitle: string; createdAt: Date },
): PDFPage {
  const { template, fonts } = ctx;
  const { width, height, margin } = template.page;
  const page = ctx.pdf.addPage([width, height]);

  const title = sanitizePdfText(template.coverTitle);
  const titleWidth = fonts.bold.widthOfTextAtSize(title, template.cover.titleSize);
  const titleY = height * 0.52;

  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: titleY,
    size: template.cover.titleSize,
    font: fonts.bold,
    color: toRgb(template.colors.primary),
  });

  const subtitle = sanitizePdfText(input.videoTitle);
  const subtitleWidth = fonts.bold.widthOfTextAtSize(subtitle, template.cover.subtitleSize);
  page.drawText(subtitle, {
    x: (width - subtitleWidth) / 2,
    y: titleY - 40,
    size: template.cover.subtitleSize,
    font: fonts.bold,
    color: toRgb(template.colors.text),
    maxWidth: width - margin * 2,
  });

  const dateStr = input.createdAt.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const meta = sanitizePdfText(`Gerado em ${dateStr}`);
  const metaWidth = fonts.regular.widthOfTextAtSize(meta, template.cover.metaSize);
  page.drawText(meta, {
    x: (width - metaWidth) / 2,
    y: titleY - 68,
    size: template.cover.metaSize,
    font: fonts.regular,
    color: toRgb(template.colors.textMuted),
  });

  return page;
}

/** Faixa de confidencialidade no topo da página de conteúdo. */
export function drawContentPageHeader(page: PDFPage, ctx: DtpPdfLayoutContext): void {
  const { template, fonts } = ctx;
  const { width, height, margin } = template.page;
  const headerH = template.header.height;
  const bandTop = height - margin;

  page.drawRectangle({
    x: margin,
    y: bandTop - headerH,
    width: width - margin * 2,
    height: headerH,
    color: toRgb(template.colors.disclaimerBg),
  });

  const disclaimer = sanitizePdfText(template.headerDisclaimer);
  page.drawText(disclaimer, {
    x: margin + 8,
    y: bandTop - headerH + (headerH - template.header.fontSize) / 2,
    size: template.header.fontSize,
    font: fonts.bold,
    color: toRgb(template.colors.disclaimerText),
    maxWidth: width - margin * 2 - 16,
  });
}

export function drawContentPageFooter(
  page: PDFPage,
  ctx: DtpPdfLayoutContext,
  pageNumber: number,
  totalPages: number,
): void {
  const { template, fonts } = ctx;
  const { width, margin } = template.page;
  const label = sanitizePdfText(`Página ${pageNumber} de ${totalPages}`);
  const labelWidth = fonts.regular.widthOfTextAtSize(label, template.footer.fontSize);

  page.drawText(label, {
    x: width - margin - labelWidth,
    y: margin - 4,
    size: template.footer.fontSize,
    font: fonts.regular,
    color: toRgb(template.colors.footerText),
  });
}

/** Nova página de conteúdo com cabeçalho de confidencialidade; devolve Y inicial do corpo. */
export function addContentPage(ctx: DtpPdfLayoutContext): { page: PDFPage; y: number } {
  const { width, height } = ctx.template.page;
  const page = ctx.pdf.addPage([width, height]);
  drawContentPageHeader(page, ctx);
  return { page, y: contentTopY(ctx.template) };
}

export function applyFootersToAllPages(ctx: DtpPdfLayoutContext): void {
  const pages = ctx.pdf.getPages();
  const total = pages.length;
  if (total <= 1) return;

  for (let i = 1; i < total; i++) {
    drawContentPageFooter(pages[i]!, ctx, i + 1, total);
  }
}

export function wrapPdfText(text: string, maxChars: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export function formatStepTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
