export type DtpPdfTemplateId = "bosch";

export type DtpPdfRgb = { r: number; g: number; b: number };

export type DtpPdfAssetPaths = {
  logoCover: string;
  logoSmall: string;
  line: string;
};

export type DtpPdfTemplate = {
  id: DtpPdfTemplateId;
  coverTitle: string;
  page: { width: number; height: number; margin: number };
  header: { height: number; fontSize: number; labelSize: number; brandTitleSize: number };
  footer: { height: number; fontSize: number };
  cover: {
    logoMaxWidth: number;
    titleSize: number;
    subtitleSize: number;
    metaSize: number;
  };
  body: { stepHeadingSize: number; stepLabelSize: number; stepBodySize: number };
  colors: {
    boschRed: DtpPdfRgb;
    text: DtpPdfRgb;
    textMuted: DtpPdfRgb;
    footerText: DtpPdfRgb;
    label: DtpPdfRgb;
  };
  assets: DtpPdfAssetPaths;
};

/** Título da capa (modelo Desktop Procedure). */
export const DTP_COVER_TITLE = "Desktop Procedure";

const ASSETS: DtpPdfAssetPaths = {
  logoCover: "src/assets/images/boschlogo.png",
  logoSmall: "src/assets/images/smallBoschLogo.png",
  line: "src/assets/images/lineBosch.png",
};

/** Bosch grey ~#7F7F7F, red ~#E20015 */
export const BOSCH_DTP_PDF_TEMPLATE: DtpPdfTemplate = {
  id: "bosch",
  coverTitle: DTP_COVER_TITLE,
  page: { width: 595, height: 842, margin: 50 },
  header: { height: 78, fontSize: 8, labelSize: 7, brandTitleSize: 11 },
  footer: { height: 28, fontSize: 9 },
  cover: {
    logoMaxWidth: 220,
    titleSize: 22,
    subtitleSize: 11,
    metaSize: 10,
  },
  body: { stepHeadingSize: 14, stepLabelSize: 11, stepBodySize: 10 },
  colors: {
    boschRed: { r: 0.886, g: 0.012, b: 0.051 },
    text: { r: 0.1, g: 0.1, b: 0.1 },
    textMuted: { r: 0.5, g: 0.51, b: 0.52 },
    footerText: { r: 0.45, g: 0.45, b: 0.45 },
    label: { r: 0.35, g: 0.35, b: 0.35 },
  },
  assets: ASSETS,
};

/** @deprecated use BOSCH_DTP_PDF_TEMPLATE */
export const DEFAULT_DTP_PDF_TEMPLATE = BOSCH_DTP_PDF_TEMPLATE;

export function resolveDtpPdfTemplate(id?: DtpPdfTemplateId): DtpPdfTemplate {
  if (!id || id === "bosch") {
    return BOSCH_DTP_PDF_TEMPLATE;
  }
  return BOSCH_DTP_PDF_TEMPLATE;
}
