import { jsonError } from "@/lib/game/http";
import { extractHomework } from "@/lib/homework/extract";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let file: File | null = null;
    let fixtureId: string | undefined;
    let forceFixture = false;
    let pasteDemo = false;
    let rawText: string | undefined;
    let title: string | undefined;
    let source: string | undefined;
    let files: File[] = [];

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        fixtureId?: string;
        fixture?: string;
        forceFixture?: boolean;
        pasteDemo?: boolean;
        rawText?: string;
        title?: string;
        source?: string;
      };
      fixtureId = body.fixtureId || body.fixture;
      forceFixture = Boolean(body.forceFixture);
      pasteDemo = Boolean(body.pasteDemo);
      rawText = body.rawText;
      title = body.title;
      source = body.source;
    } else {
      const form = await request.formData();
      files = form
        .getAll("file")
        .filter((item): item is File => item instanceof File && item.size > 0);
      const maybeFile = form.get("file");
      file = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : files[0] ?? null;
      fixtureId = stringField(form.get("fixtureId") ?? form.get("fixture"));
      forceFixture =
        form.get("forceFixture") === "1" || form.get("forceFixture") === "true";
      pasteDemo =
        form.get("pasteDemo") === "1" || form.get("pasteDemo") === "true";
      rawText = stringField(form.get("rawText"));
      title = stringField(form.get("title"));
      source = stringField(form.get("source"));
    }

    const extract = await extractHomework({
      file,
      files,
      fixtureId,
      forceFixture,
      pasteDemo,
      rawText,
      title,
      source,
    });
    const payload = {
      id: extract.id,
      mode: extract.mode,
      notice: extract.notice ?? null,
      notes: extract.notes,
    };
    assertNoQuizSecrets(payload, "extract");
    return Response.json(payload);
  } catch (error) {
    return jsonError(error);
  }
}

function stringField(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
