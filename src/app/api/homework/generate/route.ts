import { jsonError } from "@/lib/game/http";
import { generateHomeworkPack } from "@/lib/homework/generate";
import type { ExtractedNotes } from "@/lib/homework/types";
import { getPublicPack } from "@/lib/packs/public-catalog";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { notes?: ExtractedNotes };
    if (!body.notes) {
      return Response.json({ error: "Missing confirmed notes" }, { status: 400 });
    }
    const generated = await generateHomeworkPack(body.notes);
    const pack = getPublicPack(generated.id);
    if (!pack) {
      return Response.json({ error: "Pack missing after generate" }, { status: 500 });
    }
    const payload = {
      mode: generated.mode,
      notice: generated.notice ?? null,
      pack,
    };
    assertNoQuizSecrets(payload, "generate");
    return Response.json(payload);
  } catch (error) {
    return jsonError(error);
  }
}
