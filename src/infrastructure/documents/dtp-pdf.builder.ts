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
  formatStepTimestamp,
  wrapPdfText,
  type DtpPdfLayoutContext,
} from "@/infrastructure/documents/dtp-pdf-layout";
import { sanitizePdfText } from "@/infrastructure/documents/pdf-text-sanitize";

type ContentCursor = { page: PDFPage; y: number };

export type DtpPdfBuildInput = {
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
  const ctx = createDtpPdfLayoutContext(pdf, template, fonts);
  const { margin } = template.page;
  const { regular: font, bold: fontBold } = fonts;
  const colors = template.colors;

  drawCoverPage(ctx, { videoTitle: input.title, createdAt: input.createdAt });

  const sortedSteps = [...input.steps].sort((a, b) => a.order - b.order);
  const cursor: ContentCursor = addContentPage(ctx);

  for (const step of sortedSteps) {
    ensureContentSpace(ctx, cursor, 80);

    const stepHeader = sanitizePdfText(
      `Passo ${step.order} - ${step.title} (${formatStepTimestamp(step.timestampSec)})`,
    );
    cursor.page.drawText(stepHeader, {
      x: margin,
      y: cursor.y,
      size: template.body.stepTitleSize,
      font: fontBold,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
      maxWidth: ctx.contentWidth,
    });
    cursor.y -= 18;

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
    cursor.y -= 8;

    const screenshot = input.screenshotBytesByOrder.get(step.order);
    if (screenshot && screenshot.length > 0) {
      try {
        const image = await pdf.embedPng(screenshot);
        const imgWidth = Math.min(ctx.contentWidth, 500);
        const scale = imgWidth / image.width;
        const imgHeight = image.height * scale;

        ensureContentSpace(ctx, cursor, imgHeight + 24);

        cursor.page.drawImage(image, {
          x: margin,
          y: cursor.y - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });
        cursor.y -= imgHeight + 24;
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

    cursor.y -= 12;
  }

  applyFootersToAllPages(ctx);

  const bytes = await pdf.save();
  return new Uint8Array(bytes);
}
