import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DTP_PDF_TEMPLATE,
  DTP_COVER_TITLE,
  DTP_HEADER_DISCLAIMER,
} from "@/domain/dtp/dtp-pdf-template";
import { buildCandidateTimestamps, findNearestFrame } from "@/domain/dtp/map-timestamp-to-frame";
import {
  isAllowedDtpVideoFileName,
  isAllowedDtpVideoMime,
  MAX_DTP_VIDEO_BYTES,
} from "@/domain/upload/video-dtp-upload-policy";
import { buildAzureVideoBlobName } from "@/domain/upload/azure-video-blob-name";
import { buildDtpPdf } from "@/infrastructure/documents/dtp-pdf.builder";
import { sanitizePdfText } from "@/infrastructure/documents/pdf-text-sanitize";

/** PNG 1×1 válido. */
const TINY_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("video-dtp-upload-policy", () => {
  it("aceita MP4 e WebM", () => {
    assert.equal(isAllowedDtpVideoFileName("demo.mp4"), true);
    assert.equal(isAllowedDtpVideoFileName("demo.webm"), true);
    assert.equal(isAllowedDtpVideoFileName("demo.pdf"), false);
    assert.equal(isAllowedDtpVideoMime("video/mp4"), true);
    assert.equal(isAllowedDtpVideoMime("application/pdf"), false);
  });

  it("define limite de 500 MB", () => {
    assert.equal(MAX_DTP_VIDEO_BYTES, 500 * 1024 * 1024);
  });
});

describe("azure-video-blob-name", () => {
  it("gera nome com prefixo video-", () => {
    const name = buildAzureVideoBlobName("My Demo.mp4", "abc-123");
    assert.match(name, /^video-abc-123-my demo\.mp4$/);
  });
});

describe("map-timestamp-to-frame", () => {
  it("encontra frame mais próximo", () => {
    const frames = [
      { timestampSec: 0, pngBytes: new Uint8Array([1]) },
      { timestampSec: 10, pngBytes: new Uint8Array([2]) },
      { timestampSec: 20, pngBytes: new Uint8Array([3]) },
    ];
    const nearest = findNearestFrame(frames, 11);
    assert.equal(nearest?.timestampSec, 10);
  });

  it("limita timestamps candidatos", () => {
    const ts = buildCandidateTimestamps(120, [5, 15], 5, 30);
    assert.ok(ts.length <= 5);
    assert.ok(ts.includes(5));
  });
});

describe("pdf-text-sanitize", () => {
  it("compõe cedilha NFD (macOS) para forma WinAnsi", () => {
    const nfd = "Gravac\u0327\u00e3o";
    const out = sanitizePdfText(nfd);
    assert.equal(out, "Gravação");
  });

  it("substitui travessão por hífen", () => {
    assert.equal(sanitizePdfText("Passo 1 — título"), "Passo 1 - título");
  });
});

describe("dtp-pdf-template", () => {
  it("define capa e aviso de confidencialidade", () => {
    assert.equal(DEFAULT_DTP_PDF_TEMPLATE.coverTitle, DTP_COVER_TITLE);
    assert.equal(DEFAULT_DTP_PDF_TEMPLATE.headerDisclaimer, DTP_HEADER_DISCLAIMER);
    assert.equal(DTP_COVER_TITLE, "DTP generated");
  });
});

describe("dtp-pdf.builder", () => {
  it("gera PDF com capa e pelo menos uma pagina de conteudo", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const screenshotBytesByOrder = new Map<number, Uint8Array>([[1, TINY_PNG]]);
    const pdfBytes = await buildDtpPdf({
      title: "Gravac\u0327\u00e3o de Tela.mov",
      createdAt: new Date("2026-05-19T12:00:00Z"),
      steps: [
        {
          order: 1,
          title: "Aceder à interface",
          description: "Abra a interface. O ecrã exibe o painel e a caixa de texto.",
          timestampSec: 0,
        },
      ],
      screenshotBytesByOrder,
    });
    assert.ok(pdfBytes.byteLength > 100);
    const head = Buffer.from(pdfBytes.subarray(0, 4)).toString("ascii");
    assert.equal(head, "%PDF");

    const doc = await PDFDocument.load(pdfBytes);
    assert.ok(doc.getPageCount() >= 2, "capa + conteudo");
  });
});
