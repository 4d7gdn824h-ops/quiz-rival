import { jsonError } from "@/lib/game/http";
import { generateHomeworkPack } from "@/lib/homework/generate";
import type { ExtractedNotes } from "@/lib/homework/types";
import { getPublicPack } from "@/lib/packs/public-catalog";
import { toPlayKit } from "@/lib/play/kit";
import { sealAnswerMap } from "@/lib/play/seal";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { notes?: ExtractedNotes };
    if (!body.notes) {
      return Response.json(
        { error: "We read your page but couldn't build the quiz.", code: "generate_failed" },
        { status: 400 },
      );
    }
    const generated = await generateHomeworkPack(body.notes);
    const pack = getPublicPack(generated.id);
    if (!pack) {
      return Response.json(
        { error: "We read your page but couldn't build the quiz.", code: "generate_failed" },
        { status: 500 },
      );
    }
    const gradeSeal = generated.mode === "xai" ? sealAnswerMap(generated.pack) : null;
    const payload = {
      mode: generated.mode,
      pack,
      playKit: toPlayKit(generated.pack, generated.levels, gradeSeal),
    };
    assertNoQuizSecrets(payload, "generate");
    return Response.json(payload);
  } catch (error) {
    return jsonError(error);
  }
}
