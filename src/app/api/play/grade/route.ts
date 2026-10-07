import type { QuizVariant } from "@/data/types";
import { jsonError } from "@/lib/game/http";
import { gradeAnswer } from "@/lib/play/grade";
import type { ExtractedNotes } from "@/lib/homework/types";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      quizId?: string;
      variant?: QuizVariant;
      questionId?: string;
      choice?: string;
      notes?: ExtractedNotes | null;
      gradeSeal?: string | null;
    };
    const correct = gradeAnswer({
      quizId: body.quizId ?? "",
      variant: body.variant === "B" ? "B" : "A",
      questionId: body.questionId ?? "",
      choice: body.choice ?? "",
      notes: body.notes ?? null,
      gradeSeal: body.gradeSeal ?? null,
    });
    const payload = { correct };
    assertNoQuizSecrets(payload, "grade");
    return Response.json(payload);
  } catch (error) {
    return jsonError(error);
  }
}
