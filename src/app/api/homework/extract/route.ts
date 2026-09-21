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

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        fixtureId?: string;
        fixture?: string;
        forceFixture?: boolean;
      };
      fixtureId = body.fixtureId || body.fixture;
      forceFixture = Boolean(body.forceFixture || fixtureId);
    } else {
      const form = await request.formData();
      const maybeFile = form.get("file");
      file = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;
      fixtureId = stringField(form.get("fixtureId") ?? form.get("fixture"));
      forceFixture =
        form.get("forceFixture") === "1" ||
        form.get("forceFixture") === "true" ||
        Boolean(fixtureId);
    }

    const extract = await extractHomework({ file, fixtureId, forceFixture });
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
