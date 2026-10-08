import { bodyExceedsBudget, JSON_BODY_BUDGET } from "@/lib/client/scan-prep";
import { jsonError } from "@/lib/game/http";
import { HomeworkError } from "@/lib/homework/errors";
import { scanHomework } from "@/lib/homework/scan";
import { scanLogRecord } from "@/lib/homework/vision-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOO_BIG = "That upload is too big. Remove a page or try a smaller photo.";

export async function POST(request: Request) {
  let bodyBytes = Number(request.headers.get("content-length") || 0);
  let pageCount = 0;
  try {
    const declared = bodyBytes;
    if (declared > 0 && bodyExceedsBudget(declared, JSON_BODY_BUDGET)) {
      throw new HomeworkError(TOO_BIG, "body_too_large", 413);
    }
    const raw = await request.text();
    bodyBytes = new TextEncoder().encode(raw).length;
    if (bodyExceedsBudget(bodyBytes, JSON_BODY_BUDGET)) {
      throw new HomeworkError(TOO_BIG, "body_too_large", 413);
    }
    let body: {
      pages?: { mime?: string; data?: string }[];
      rawText?: string;
      title?: string;
      fixtureId?: string;
      fixture?: string;
      pasteDemo?: boolean;
      source?: string;
    } = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        throw new HomeworkError(
          "We couldn't read that page. Try a sharper photo in good light.",
          "parse_failed",
          400,
        );
      }
    }
    pageCount = Array.isArray(body.pages) ? body.pages.length : 0;
    const result = await scanHomework({
      pages: body.pages,
      rawText: body.rawText,
      title: body.title,
      fixtureId: body.fixtureId || body.fixture,
      pasteDemo: body.pasteDemo,
      source: body.source,
    });
    console.info(
      JSON.stringify(
        scanLogRecord({
          pages: result.pages,
          bodyBytes,
          extractMs: result.extractMs,
          generateMs: result.generateMs,
          finishReason: result.finishReason,
          code: null,
          errorType: null,
        }),
      ),
    );
    return Response.json(result.payload);
  } catch (error) {
    console.error(
      JSON.stringify(
        scanLogRecord({
          pages: pageCount,
          bodyBytes,
          extractMs: error instanceof HomeworkError ? (error.extractMs ?? 0) : 0,
          generateMs: error instanceof HomeworkError ? (error.generateMs ?? 0) : 0,
          finishReason: error instanceof HomeworkError ? error.finishReason : null,
          code: error instanceof HomeworkError ? error.code : "ai_error",
          errorType: error instanceof Error ? error.name : "Error",
        }),
      ),
    );
    return jsonError(error);
  }
}
