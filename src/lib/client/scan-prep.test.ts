import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  admitPages,
  base64Length,
  bodyExceedsBudget,
  chooseScaleIndex,
  fitLongEdge,
  JSON_BODY_BUDGET,
  LONG_EDGE,
  mapScanError,
  MAX_SCAN_PAGES,
  PAGE_CAP_MESSAGE,
  retryMode,
  SCALE_LADDER,
  scanJsonBytes,
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

describe("admitPages", () => {
  it("keeps the first 6 images and rejects a 7th", () => {
    const incoming = Array.from({ length: 7 }, () => ({ kind: "image" as const, pageCount: 1 }));
    const result = admitPages(0, incoming);
    assert.equal(result.files.filter((file) => !file.rejected).length, MAX_SCAN_PAGES);
    assert.equal(result.files[6]?.rejected, true);
    assert.equal(result.files[6]?.take, 0);
    assert.equal(result.total, 6);
    assert.equal(result.message, PAGE_CAP_MESSAGE);
  });

  it("rejects a PDF that would push the tray past 6 and keeps the pages already there", () => {
    const result = admitPages(4, [{ kind: "pdf", pageCount: 3 }]);
    assert.deepEqual(result.files, [{ take: 0, rejected: true }]);
    assert.equal(result.total, 4);
    assert.equal(result.message, PAGE_CAP_MESSAGE);
    assert.equal(result.truncated, false);
  });

  it("takes only the first 6 pages of a PDF dropped onto an empty tray", () => {
    const result = admitPages(0, [{ kind: "pdf", pageCount: 9 }]);
    assert.deepEqual(result.files, [{ take: 6, rejected: false }]);
    assert.equal(result.total, 6);
    assert.equal(result.truncated, true);
    assert.equal(result.message, null);
  });

  it("accepts a PDF that still fits", () => {
    const result = admitPages(2, [
      { kind: "image", pageCount: 1 },
      { kind: "pdf", pageCount: 3 },
    ]);
    assert.deepEqual(result.files, [
      { take: 1, rejected: false },
      { take: 3, rejected: false },
    ]);
    assert.equal(result.total, 6);
    assert.equal(result.message, null);
  });
});

describe("scan JSON body budget", () => {
  it("measures base64 JSON growth and the 4MB cap", () => {
    assert.equal(base64Length(3), 4);
    assert.equal(base64Length(4), 8);
    const one = scanJsonBytes([30]);
    const payload = JSON.stringify({
      pages: [{ mime: "image/jpeg", data: "A".repeat(base64Length(30)) }],
    });
    assert.equal(one, new TextEncoder().encode(payload).length);
    assert.equal(bodyExceedsBudget(JSON_BODY_BUDGET), false);
    assert.equal(bodyExceedsBudget(JSON_BODY_BUDGET + 1), true);
    assert.ok(JSON_BODY_BUDGET < 4.5 * 1024 * 1024);
  });

  it("stays on the 1600px step when six pages already fit", () => {
    const modest = Array.from({ length: SCALE_LADDER.length }, () => Array(6).fill(80_000));
    const chosen = chooseScaleIndex(modest);
    assert.equal(chosen?.index, 0);
    assert.equal(SCALE_LADDER[0]?.longEdge, LONG_EDGE);
    assert.ok((chosen?.jsonBytes ?? Infinity) <= JSON_BODY_BUDGET);
  });

  it("steps down the ladder until the JSON body is under about 4MB", () => {
    const tooBig = Array(6).fill(900_000);
    const fits = Array(6).fill(400_000);
    const chosen = chooseScaleIndex([tooBig, tooBig, fits, fits]);
    assert.equal(chosen?.index, 2);
    assert.equal(SCALE_LADDER[chosen?.index ?? 0]?.longEdge, 1280);
    assert.ok(scanJsonBytes(tooBig) > JSON_BODY_BUDGET);
    assert.ok((chosen?.jsonBytes ?? Infinity) <= JSON_BODY_BUDGET);
  });

  it("gives up when every step is still over the budget", () => {
    const huge = Array.from({ length: SCALE_LADDER.length }, () => Array(6).fill(2_000_000));
    assert.equal(chooseScaleIndex(huge), null);
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
