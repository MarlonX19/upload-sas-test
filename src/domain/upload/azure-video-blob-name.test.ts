import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAzureVideoBlobName } from "./azure-video-blob-name";
import {
  isAllowedVideoFileName,
  isAllowedVideoMime,
  normalizeVideoMime,
} from "./video-upload-policy";

describe("video-upload-policy", () => {
  it("aceita extensões de vídeo comuns", () => {
    assert.equal(isAllowedVideoFileName("demo.mp4"), true);
    assert.equal(isAllowedVideoFileName("demo.webm"), true);
    assert.equal(isAllowedVideoFileName("demo.mov"), true);
    assert.equal(isAllowedVideoFileName("demo.pdf"), false);
  });

  it("normaliza MIME com codecs", () => {
    assert.equal(normalizeVideoMime("video/webm;codecs=vp9"), "video/webm");
    assert.equal(isAllowedVideoMime("video/webm;codecs=vp9"), true);
    assert.equal(isAllowedVideoMime("application/pdf"), false);
  });
});

describe("buildAzureVideoBlobName", () => {
  it("gera nome sob a pasta test-workspace", () => {
    const name = buildAzureVideoBlobName("My Demo.mp4", "abc-123");
    assert.match(name, /^test-workspace\/video-abc-123-my demo\.mp4$/);
  });
});
