import { bodyExceedsBudget, JSON_BODY_BUDGET } from "@/lib/client/scan-prep";
import { jsonError } from "@/lib/game/http";
import { HomeworkError } from "@/lib/homework/errors";
import { scanHomework } from "@/lib/homework/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOO_BIG = "That upload is too big. Remove a page or try a smaller photo.";

export async function POST(request: Request) {
  try {
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > 0 && bodyExceedsBudget(declared, JSON_BODY_BUDGET)) {
      throw new HomeworkError(TOO_BIG, "body_too_large", 413);
    }
    const raw = await request.text();
    if (bodyExceedsBudget(new TextEncoder().encode(raw).length, JSON_BODY_BUDGET)) {
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
          "unreadable",
          400,
        );
      }
    }
    const payload = await scanHomework({
      pages: body.pages,
      rawText: body.rawText,
      title: body.title,
      fixtureId: body.fixtureId || body.fixture,
      pasteDemo: body.pasteDemo,
      source: body.source,
    });
    return Response.json(payload);
  } catch (error) {
    return jsonError(error);
  }
}
