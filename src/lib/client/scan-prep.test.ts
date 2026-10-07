import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fitLongEdge,
  LONG_EDGE,
  mapScanError,
  retryMode,
  SCAN_MESSAGES,
} from "./scan-prep.ts";

describe("fitLongEdge", () => {
  it("shrinks a 12MP landscape photo to 1600 on the long edge", () => {
    assert.deepEqual(fitLongEdge(4000, 3000), { width: 1600, height: 1200 });
  });

  it("shrinks a portrait photo on the long edge", () => {
    assert.deepEqual(fitLongEdge(3000, 4000), { width: 1200, height: 1600 });
  });

  it("leaves a smaller image at its own size", () => {
    assert.deepEqual(fitLongEdge(800, 600), { width: 800, height: 600 });
    assert.deepEqual(fitLongEdge(LONG_EDGE, 900), { width: LONG_EDGE, height: 900 });
  });
});

describe("mapScanError", () => {
  it("uses the plain lines and keeps the code off the headline", () => {
    for (const [code, message] of Object.entries(SCAN_MESSAGES)) {
      const view = mapScanError(code);
      assert.equal(view.message, message);
      assert.equal(view.code, code);
      assert.notEqual(view.message, code);
    }
    assert.equal(mapScanError("file_type").action, "Choose another");
    assert.equal(mapScanError("file_too_big").action, "Choose another");
    assert.equal(mapScanError("unreadable").action, "Retake");
    assert.equal(mapScanError("timeout").action, "Try again");
    assert.equal(mapScanError("generate_failed").action, "Try again");
    assert.equal(mapScanError("offline").action, "Try again");
  });
});

describe("retryMode", () => {
  it("retries generate only after a read, without asking for the file again", () => {
    assert.equal(
      retryMode({
        code: "generate_failed",
        failedPhase: "generate",
        hasNotes: true,
        hasFile: true,
      }),
      "generate-only",
    );
    assert.equal(
      retryMode({
        code: "timeout",
        failedPhase: "generate",
        hasNotes: true,
        hasFile: true,
      }),
      "generate-only",
    );
  });

  it("retries the same file when the read itself timed out", () => {
    assert.equal(
      retryMode({
        code: "timeout",
        failedPhase: "extract",
        hasNotes: false,
        hasFile: true,
      }),
      "same-file",
    );
    assert.equal(
      retryMode({
        code: "offline",
        failedPhase: "extract",
        hasNotes: false,
        hasFile: true,
      }),
      "same-file",
    );
  });

  it("asks for another file only when this one cannot be used", () => {
    assert.equal(
      retryMode({
        code: "file_type",
        failedPhase: "extract",
        hasNotes: false,
        hasFile: true,
      }),
      "pick",
    );
  });
});
