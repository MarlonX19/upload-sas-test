export type DtpPdfTemplateId = "default";

export type DtpPdfRgb = { r: number; g: number; b: number };

export type DtpPdfTemplate = {
  id: DtpPdfTemplateId;
  coverTitle: string;
  headerDisclaimer: string;
  page: { width: number; height: number; margin: number };
  header: { height: number; fontSize: number };
  footer: { height: number; fontSize: number };
  cover: { titleSize: number; subtitleSize: number; metaSize: number };
  body: { stepTitleSize: number; stepBodySize: number };
  colors: {
    primary: DtpPdfRgb;
    text: DtpPdfRgb;
    textMuted: DtpPdfRgb;
    disclaimerBg: DtpPdfRgb;
    disclaimerText: DtpPdfRgb;
    footerText: DtpPdfRgb;
  };
};

export const DTP_COVER_TITLE = "DTP generated";

export const DTP_HEADER_DISCLAIMER =
  "Esses dados são sensíveis e de uso interno na empresa.";

export const DEFAULT_DTP_PDF_TEMPLATE: DtpPdfTemplate = {
  id: "default",
  coverTitle: DTP_COVER_TITLE,
  headerDisclaimer: DTP_HEADER_DISCLAIMER,
  page: { width: 595, height: 842, margin: 50 },
  header: { height: 36, fontSize: 8 },
  footer: { height: 28, fontSize: 9 },
  cover: { titleSize: 28, subtitleSize: 14, metaSize: 10 },
  body: { stepTitleSize: 12, stepBodySize: 10 },
  colors: {
    primary: { r: 0.145, g: 0.388, b: 0.922 },
    text: { r: 0.1, g: 0.1, b: 0.1 },
    textMuted: { r: 0.4, g: 0.4, b: 0.4 },
    disclaimerBg: { r: 1, g: 0.973, b: 0.902 },
    disclaimerText: { r: 0.573, g: 0.251, b: 0.055 },
    footerText: { r: 0.5, g: 0.5, b: 0.5 },
  },
};

export function resolveDtpPdfTemplate(id?: DtpPdfTemplateId): DtpPdfTemplate {
  if (!id || id === "default") {
    return DEFAULT_DTP_PDF_TEMPLATE;
  }
  return DEFAULT_DTP_PDF_TEMPLATE;
}
