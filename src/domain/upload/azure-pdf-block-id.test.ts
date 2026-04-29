import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encodePdfUploadBlockId } from "./azure-pdf-block-id";

describe("encodePdfUploadBlockId", () => {
  it("returns the same value for the same index", () => {
    assert.equal(encodePdfUploadBlockId(3), encodePdfUploadBlockId(3));
  });

  it("returns different values for different indices", () => {
    assert.notEqual(encodePdfUploadBlockId(0), encodePdfUploadBlockId(1));
  });
});
