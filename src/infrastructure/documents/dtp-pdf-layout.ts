import type { PDFDocument, PDFFont, PDFPage, RGB } from "pdf-lib";
import { StandardFonts, rgb } from "pdf-lib";

import type { DtpPdfRgb, DtpPdfTemplate } from "@/domain/dtp/dtp-pdf-template";
import {
  embedDtpPdfAssets,
  fitImageDimensions,
  scaleImageToWidth,
  type DtpPdfEmbeddedAssets,
} from "@/infrastructure/documents/dtp-pdf-assets";
import { sanitizePdfText } from "@/infrastructure/documents/pdf-text-sanitize";

export type DtpPdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

export type DtpPdfPageMeta = {
  videoFileName: string;
  createdAt: Date;
};

export type DtpPdfLayoutContext = {
  pdf: PDFDocument;
  template: DtpPdfTemplate;
  fonts: DtpPdfFonts;
  assets: DtpPdfEmbeddedAssets;
  pageMeta: DtpPdfPageMeta;
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

export async function createDtpPdfLayoutContext(
  pdf: PDFDocument,
  template: DtpPdfTemplate,
  fonts: DtpPdfFonts,
  pageMeta: DtpPdfPageMeta,
): Promise<DtpPdfLayoutContext> {
  const assets = await embedDtpPdfAssets(pdf, template);
  const { width, margin } = template.page;
  return {
    pdf,
    template,
    fonts,
    assets,
    pageMeta,
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
  const { template, fonts, assets } = ctx;
  const { width, height, margin } = template.page;
  const page = ctx.pdf.addPage([width, height]);
  const colors = template.colors;

  const lineDims = scaleImageToWidth(assets.line.width, assets.line.height, width);
  page.drawImage(assets.line, {
    x: 0,
    y: margin,
    width: lineDims.width,
    height: lineDims.height,
  });

  const logoDims = fitImageDimensions(
    assets.logoCover.width,
    assets.logoCover.height,
    template.cover.logoMaxWidth,
    120,
  );
  const logoX = (width - logoDims.width) / 2;
  const logoY = height * 0.48;
  page.drawImage(assets.logoCover, {
    x: logoX,
    y: logoY - logoDims.height,
    width: logoDims.width,
    height: logoDims.height,
  });

  const coverTitle = sanitizePdfText(template.coverTitle);
  const titleWidth = fonts.bold.widthOfTextAtSize(coverTitle, template.cover.titleSize);
  page.drawText(coverTitle, {
    x: (width - titleWidth) / 2,
    y: logoY - logoDims.height - 28,
    size: template.cover.titleSize,
    font: fonts.bold,
    color: toRgb(colors.textMuted),
  });

  const subtitle = sanitizePdfText(input.videoTitle);
  const subtitleLines = wrapPdfText(subtitle, 55);
  let subY = logoY - logoDims.height - 48;
  for (const line of subtitleLines.slice(0, 3)) {
    const lineWidth = fonts.regular.widthOfTextAtSize(line, template.cover.subtitleSize);
    page.drawText(line, {
      x: (width - lineWidth) / 2,
      y: subY,
      size: template.cover.subtitleSize,
      font: fonts.regular,
      color: toRgb(colors.text),
    });
    subY -= 14;
  }

  const dateStr = input.createdAt.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const meta = sanitizePdfText(`Data: ${dateStr}`);
  const metaWidth = fonts.regular.widthOfTextAtSize(meta, template.cover.metaSize);
  page.drawText(meta, {
    x: (width - metaWidth) / 2,
    y: margin + lineDims.height + 24,
    size: template.cover.metaSize,
    font: fonts.regular,
    color: toRgb(colors.textMuted),
  });

  const aiTag = sanitizePdfText("Gerado por IA");
  const aiWidth = fonts.regular.widthOfTextAtSize(aiTag, template.cover.metaSize);
  page.drawText(aiTag, {
    x: (width - aiWidth) / 2,
    y: margin + lineDims.height + 10,
    size: template.cover.metaSize,
    font: fonts.regular,
    color: toRgb(colors.textMuted),
  });

  return page;
}

export function drawContentPageHeader(
  page: PDFPage,
  ctx: DtpPdfLayoutContext,
  input: { videoFileName: string; createdAt: Date },
): void {
  const { template, fonts, assets } = ctx;
  const { width, height, margin } = template.page;
  const headerH = template.header.height;
  const bandTop = height - margin;
  const colors = template.colors;

  const smallLogo = fitImageDimensions(assets.logoSmall.width, assets.logoSmall.height, 90, 36);
  const logoY = bandTop - headerH + (headerH - smallLogo.height) / 2;
  page.drawImage(assets.logoSmall, {
    x: margin,
    y: logoY,
    width: smallLogo.width,
    height: smallLogo.height,
  });

  const brandX = margin + smallLogo.width + 10;
  const brandY = bandTop - headerH + headerH / 2 + 4;
  page.drawText(sanitizePdfText(template.coverTitle), {
    x: brandX,
    y: brandY,
    size: template.header.brandTitleSize,
    font: fonts.bold,
    color: toRgb(colors.textMuted),
  });

  const metaX = width - margin - 200;
  const labelSize = template.header.labelSize;
  const valueSize = template.header.fontSize;
  let metaY = bandTop - 14;

  const rows: { label: string; value: string }[] = [
    { label: "Preparado por:", value: input.videoFileName },
    { label: "Referência:", value: input.videoFileName },
    {
      label: "Data:",
      value: input.createdAt.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    },
    { label: "", value: "Gerado por IA" },
  ];

  for (const row of rows) {
    if (row.label) {
      page.drawText(sanitizePdfText(row.label), {
        x: metaX,
        y: metaY,
        size: labelSize,
        font: fonts.bold,
        color: toRgb(colors.label),
      });
    }
    page.drawText(sanitizePdfText(row.value), {
      x: metaX + (row.label ? 72 : 0),
      y: metaY,
      size: valueSize,
      font: fonts.regular,
      color: toRgb(colors.text),
      maxWidth: width - margin - metaX - 72,
    });
    metaY -= 13;
  }

  page.drawLine({
    start: { x: margin, y: bandTop - headerH - 4 },
    end: { x: width - margin, y: bandTop - headerH - 4 },
    thickness: 0.5,
    color: toRgb(colors.textMuted),
  });
}

export function drawContentPageFooter(
  page: PDFPage,
  ctx: DtpPdfLayoutContext,
  pageNumber: number,
  totalContentPages: number,
): void {
  const { template, fonts } = ctx;
  const { width, margin } = template.page;
  const label = sanitizePdfText(`Página ${pageNumber} de ${totalContentPages}`);
  const labelWidth = fonts.regular.widthOfTextAtSize(label, template.footer.fontSize);

  page.drawText(label, {
    x: width - margin - labelWidth,
    y: margin - 4,
    size: template.footer.fontSize,
    font: fonts.regular,
    color: toRgb(template.colors.footerText),
  });
}

export function addContentPage(ctx: DtpPdfLayoutContext): { page: PDFPage; y: number } {
  const { width, height } = ctx.template.page;
  const page = ctx.pdf.addPage([width, height]);
  drawContentPageHeader(page, ctx, ctx.pageMeta);
  return { page, y: contentTopY(ctx.template) };
}

export function applyFootersToAllPages(ctx: DtpPdfLayoutContext): void {
  const pages = ctx.pdf.getPages();
  const total = pages.length;
  if (total <= 1) return;

  const contentPageCount = total - 1;
  for (let i = 1; i < total; i++) {
    drawContentPageFooter(pages[i]!, ctx, i, contentPageCount);
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
