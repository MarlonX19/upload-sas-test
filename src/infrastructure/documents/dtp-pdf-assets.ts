import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { PDFDocument, PDFImage } from "pdf-lib";

import type { DtpPdfTemplate } from "@/domain/dtp/dtp-pdf-template";

export type DtpPdfEmbeddedAssets = {
  logoCover: PDFImage;
  logoSmall: PDFImage;
  line: PDFImage;
};

function assetPath(relative: string): string {
  return join(process.cwd(), relative);
}

export async function embedDtpPdfAssets(
  pdf: PDFDocument,
  template: DtpPdfTemplate,
): Promise<DtpPdfEmbeddedAssets> {
  const { assets } = template;
  const [coverBytes, smallBytes, lineBytes] = await Promise.all([
    readFile(assetPath(assets.logoCover)),
    readFile(assetPath(assets.logoSmall)),
    readFile(assetPath(assets.line)),
  ]);

  return {
    logoCover: await pdf.embedPng(coverBytes),
    logoSmall: await pdf.embedPng(smallBytes),
    line: await pdf.embedPng(lineBytes),
  };
}

/** Escala imagem para largura exacta (ex. faixa Bosch de ponta a ponta na página). */
export function scaleImageToWidth(
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
): { width: number; height: number } {
  const scale = targetWidth / imageWidth;
  return { width: targetWidth, height: imageHeight * scale };
}

/** Escala imagem para caber em maxWidth × maxHeight mantendo proporção. */
export function fitImageDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * scale, height: height * scale };
}
