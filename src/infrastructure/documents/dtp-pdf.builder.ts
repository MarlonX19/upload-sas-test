import { PDFDocument, rgb, type PDFPage } from "pdf-lib";

import type { DtpPdfTemplateId } from "@/domain/dtp/dtp-pdf-template";
import { resolveDtpPdfTemplate } from "@/domain/dtp/dtp-pdf-template";
import type { DtpStep } from "@/domain/dtp/dtp-step";
import {
  addContentPage,
  applyFootersToAllPages,
  createDtpPdfLayoutContext,
  drawCoverPage,
  embedDtpPdfFonts,
  wrapPdfText,
  type DtpPdfLayoutContext,
} from "@/infrastructure/documents/dtp-pdf-layout";
import { fitImageDimensions } from "@/infrastructure/documents/dtp-pdf-assets";
import { sanitizePdfText } from "@/infrastructure/documents/pdf-text-sanitize";

type ContentCursor = { page: PDFPage; y: number };

export type DtpPdfBuildInput = {
  /** Nome do ficheiro de vídeo (referência e título do procedimento). */
  title: string;
  createdAt: Date;
  steps: DtpStep[];
  screenshotBytesByOrder: Map<number, Uint8Array>;
  templateId?: DtpPdfTemplateId;
};

function needsNewContentPage(y: number, ctx: DtpPdfLayoutContext, minSpace: number): boolean {
  return y - minSpace < ctx.contentBottomY;
}

function ensureContentSpace(ctx: DtpPdfLayoutContext, cursor: ContentCursor, minSpace: number): void {
  if (!needsNewContentPage(cursor.y, ctx, minSpace)) return;
  const next = addContentPage(ctx);
  cursor.page = next.page;
  cursor.y = next.y;
}

export async function buildDtpPdf(input: DtpPdfBuildInput): Promise<Uint8Array> {
  const template = resolveDtpPdfTemplate(input.templateId);
  const pdf = await PDFDocument.create();
  const fonts = await embedDtpPdfFonts(pdf);
  const pageMeta = { videoFileName: input.title, createdAt: input.createdAt };
  const ctx = await createDtpPdfLayoutContext(pdf, template, fonts, pageMeta);

  const { margin } = template.page;
  const { regular: font, bold: fontBold } = fonts;
  const colors = template.colors;

  drawCoverPage(ctx, { videoTitle: input.title, createdAt: input.createdAt });

  const sortedSteps = [...input.steps].sort((a, b) => a.order - b.order);
  const cursor: ContentCursor = addContentPage(ctx);

  for (const step of sortedSteps) {
    ensureContentSpace(ctx, cursor, 100);

    const stepHeading = sanitizePdfText(`Step ${step.order}: ${step.title}`);
    cursor.page.drawText(stepHeading, {
      x: margin,
      y: cursor.y,
      size: template.body.stepHeadingSize,
      font: fontBold,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
      maxWidth: ctx.contentWidth,
    });
    cursor.y -= 22;

    ensureContentSpace(ctx, cursor, 24);
    cursor.page.drawText(sanitizePdfText("STEP DESCRIPTION:"), {
      x: margin,
      y: cursor.y,
      size: template.body.stepLabelSize,
      font: fontBold,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
    });
    cursor.y -= 16;

    const descLines = wrapPdfText(step.description, 85);
    for (const line of descLines) {
      ensureContentSpace(ctx, cursor, 20);
      cursor.page.drawText(line, {
        x: margin,
        y: cursor.y,
        size: template.body.stepBodySize,
        font,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: ctx.contentWidth,
      });
      cursor.y -= 14;
    }
    cursor.y -= 10;

    const screenshot = input.screenshotBytesByOrder.get(step.order);
    if (screenshot && screenshot.length > 0) {
      try {
        const image = await pdf.embedPng(screenshot);
        const maxW = Math.min(ctx.contentWidth, 480);
        const maxH = 280;
        const { width: imgWidth, height: imgHeight } = fitImageDimensions(
          image.width,
          image.height,
          maxW,
          maxH,
        );

        ensureContentSpace(ctx, cursor, imgHeight + 28);

        const imgX = margin + (ctx.contentWidth - imgWidth) / 2;
        cursor.page.drawImage(image, {
          x: imgX,
          y: cursor.y - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });
        cursor.y -= imgHeight + 28;
      } catch {
        ensureContentSpace(ctx, cursor, 20);
        cursor.page.drawText(sanitizePdfText("[Captura de ecrã indisponível]"), {
          x: margin,
          y: cursor.y,
          size: 9,
          font,
          color: rgb(colors.textMuted.r, colors.textMuted.g, colors.textMuted.b),
        });
        cursor.y -= 20;
      }
    }

    cursor.y -= 16;
  }

  applyFootersToAllPages(ctx);

  const bytes = await pdf.save();
  return new Uint8Array(bytes);
}
