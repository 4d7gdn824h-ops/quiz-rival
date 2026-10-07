import { assertNoQuizSecrets } from "@/lib/public-quiz";
import { buildPublicRound } from "@/lib/play/kit";
import type { QuizVariant } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const quizId = url.searchParams.get("quizId")?.trim() ?? "";
  const variant: QuizVariant = url.searchParams.get("variant") === "B" ? "B" : "A";
  const levelId = url.searchParams.get("levelId");
  if (!quizId) {
    return Response.json({ error: "Missing quiz" }, { status: 400 });
  }
  const round = buildPublicRound(quizId, variant, levelId);
  if (!round) {
    return Response.json({ error: "That practice pack is not on this server." }, { status: 404 });
  }
  assertNoQuizSecrets(round, "round");
  return Response.json(round);
}
