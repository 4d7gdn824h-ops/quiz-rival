import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { codeFromFailure, mapScanError, retryMode, SCAN_MESSAGES } from "../client/scan-prep.ts";
import { HomeworkError } from "./errors.ts";
import {
  AI_TRY_AGAIN_MESSAGE,
  VISION_MAX_TOKENS,
  compactPageNotes,
  modelHasReadableText,
  parseModelObject,
  preserveReadError,
  scanLogRecord,
  unreadablePageError,
  visionExtractPrompt,
  xaiHttpCode,
} from "./vision-read.ts";

const EMPTY = { topics: [], facts: [], rawText: "", lineCount: 0, pageNotes: [] };

describe("vision extract schema", () => {
  it("keeps the single-page line list", () => {
    const prompt = visionExtractPrompt(1);
    assert.match(prompt, /"lines": \[\{ "text": string, "junk": boolean \}\]/);
    assert.match(prompt, /"rawText": string/);
    assert.match(prompt, /"topics": string\[\]/);
    assert.match(prompt, /Combine them into one set of notes/);
  });

  it("asks multi-page scans for compact notes and topics only", () => {
    for (const pages of [2, 5, 6]) {
      const prompt = visionExtractPrompt(pages);
      assert.equal(prompt.includes('"lines"'), false);
      assert.equal(prompt.includes('"rawText"'), false);
      assert.match(prompt, /"topics": \["short topic"\]/);
      assert.match(prompt, /"pages": \[\{ "notes": "compact study notes for this page" \}\]/);
    }
    assert.notEqual(visionExtractPrompt(1), visionExtractPrompt(2));
  });

  it("caps vision output at 8192 tokens", () => {
    assert.equal(VISION_MAX_TOKENS, 8192);
    const vision = readFileSync(new URL("./vision.ts", import.meta.url), "utf8");
    assert.match(vision, /maxTokens:\s*VISION_MAX_TOKENS/);
    assert.match(vision, /visionExtractPrompt\(images\.length\)/);
    const extract = readFileSync(new URL("./extract.ts", import.meta.url), "utf8");
    assert.equal(extract.includes("asReadError"), false);
    assert.match(extract, /preserveReadError/);
  });
});

describe("parseModelObject", () => {
  it("repairs a truncated array when finish_reason is length", () => {
    const parsed = parseModelObject('{"title":"Cells","topics":["mito', "length");
    assert.equal(parsed.title, "Cells");
    assert.deepEqual(parsed.topics, ["mito"]);
  });

  it("repairs a truncated pages array and keeps the closed notes", () => {
    const parsed = parseModelObject(
      '{"title":"Cells","topics":["cells"],"pages":[{"notes":"Mitochondria make energy"},{"notes":"The nucleus',
      "length",
    );
    assert.deepEqual(compactPageNotes(parsed.pages), [
      "Mitochondria make energy",
      "The nucleus",
    ]);
  });

  it("keeps valid JSON even when finish_reason is length", () => {
    const parsed = parseModelObject('{"title":"Cells","topics":["cells"]}', "length");
    assert.equal(parsed.title, "Cells");
    assert.deepEqual(parsed.topics, ["cells"]);
  });

  it("maps unparseable length-capped output to truncated", () => {
    const error = catchHomework(() => parseModelObject("not json at all", "length"));
    assert.equal(error.code, "truncated");
    assert.equal(error.status, 422);
    assert.equal(error.finishReason, "length");
    assert.equal(error.message, SCAN_MESSAGES.unreadable);
    assert.notEqual(error.message, error.code);
  });

  it("maps other bad JSON to parse_failed", () => {
    const stopped = catchHomework(() => parseModelObject("nope", "stop"));
    assert.equal(stopped.code, "parse_failed");
    assert.equal(stopped.finishReason, "stop");
    const missing = catchHomework(() => parseModelObject("{", null));
    assert.equal(missing.code, "parse_failed");
    assert.equal(missing.finishReason, null);
  });
});

describe("read error mapping", () => {
  it("passes model error codes through and does not relabel them unreadable", () => {
    const truncated = new HomeworkError(SCAN_MESSAGES.unreadable, "truncated", 422);
    truncated.finishReason = "length";
    assert.equal(preserveReadError(truncated), truncated);
    assert.equal(preserveReadError(truncated).code, "truncated");

    const http = new HomeworkError(AI_TRY_AGAIN_MESSAGE, xaiHttpCode(502), 502);
    assert.equal(preserveReadError(http).code, "ai_http_502");
    assert.equal(xaiHttpCode(429), "ai_http_429");

    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    const timeout = preserveReadError(abort);
    assert.equal(timeout.code, "ai_timeout");
    assert.equal(timeout.status, 504);
    assert.equal(timeout.message, SCAN_MESSAGES.timeout);

    const network = preserveReadError(new Error("socket hang up"));
    assert.equal(network.code, "ai_error");
    assert.notEqual(network.code, "unreadable");
    assert.equal(network.message, AI_TRY_AGAIN_MESSAGE);
    assert.equal(network.message.includes("socket"), false);
    assert.equal(network.message.includes("key"), false);
  });

  it("uses unreadable only when the model returned no readable text", () => {
    assert.equal(modelHasReadableText(EMPTY), false);
    assert.equal(modelHasReadableText({ ...EMPTY, topics: ["cells"] }), true);
    assert.equal(modelHasReadableText({ ...EMPTY, pageNotes: ["Mitochondria"] }), true);
    const error = unreadablePageError("stop");
    assert.equal(error.code, "unreadable");
    assert.equal(error.finishReason, "stop");
    assert.equal(error.message, SCAN_MESSAGES.unreadable);
  });

  it("keeps the accurate code on the client and a kid-friendly line", () => {
    const http = mapScanError("ai_http_502");
    assert.equal(http.code, "ai_http_502");
    assert.equal(http.message, AI_TRY_AGAIN_MESSAGE);
    assert.equal(http.action, "Try again");
    assert.notEqual(http.message, http.code);

    const timeout = mapScanError("ai_timeout");
    assert.equal(timeout.code, "ai_timeout");
    assert.equal(timeout.message, SCAN_MESSAGES.timeout);

    const truncated = mapScanError("truncated");
    assert.equal(truncated.code, "truncated");
    assert.equal(truncated.message, SCAN_MESSAGES.unreadable);
    assert.equal(truncated.action, "Try again");

    const parsed = mapScanError("parse_failed");
    assert.equal(parsed.code, "parse_failed");
    assert.equal(parsed.message, SCAN_MESSAGES.unreadable);

    assert.equal(codeFromFailure({ code: "ai_timeout", status: 504 }), "ai_timeout");
    assert.equal(codeFromFailure({ code: "ai_http_502", status: 502 }), "ai_http_502");
    assert.equal(codeFromFailure({ code: "truncated", status: 422 }), "truncated");
    assert.equal(codeFromFailure({ code: "timeout", status: 504 }), "timeout");
    assert.equal(
      retryMode({ code: "truncated", failedPhase: "extract", hasNotes: false, hasFile: true }),
      "same-file",
    );
  });
});

describe("scanLogRecord", () => {
  it("logs only page counts, timings, finish_reason, and the error code", () => {
    const record = scanLogRecord({
      pages: 5,
      bodyBytes: 1_730_000,
      extractMs: 22000,
      generateMs: 0,
      finishReason: "length",
      code: "truncated",
      errorType: "HomeworkError",
    });
    assert.deepEqual(Object.keys(record).sort(), [
      "bodyBytes",
      "code",
      "errorType",
      "extractMs",
      "finish_reason",
      "generateMs",
      "pages",
    ]);
    assert.equal(record.finish_reason, "length");
    assert.equal(record.code, "truncated");
    const line = JSON.stringify(record);
    assert.equal(line.includes("base64"), false);
    assert.equal(line.includes("data:"), false);
    assert.equal(/sk-|api[_-]?key|Bearer/i.test(line), false);
  });
});

function catchHomework(run: () => unknown) {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof HomeworkError);
    return error;
  }
  assert.fail("expected HomeworkError");
}
