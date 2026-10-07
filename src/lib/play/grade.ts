import "server-only";

import { getPack, listPacks } from "@/data/quizzes";
import type { QuizQuestion, QuizVariant } from "@/data/types";
import { GameError } from "@/lib/game/engine";
import { fixturePackFromNotes } from "@/lib/homework/generate";
import type { ExtractedNotes } from "@/lib/homework/types";
import { openSeal } from "./seal";

export function gradeAnswer(input: {
  quizId: string;
  variant: QuizVariant;
  questionId: string;
  choice: string;
  notes?: ExtractedNotes | null;
  gradeSeal?: string | null;
}): boolean {
  const choice = input.choice.trim();
  if (!choice || choice.length > 8) {
    throw new GameError("Invalid choice.", 400);
  }

  if (input.gradeSeal) {
    try {
      const map = openSeal(input.gradeSeal);
      const expected = map[`${input.variant}:${input.questionId}`];
      if (typeof expected !== "string" || !expected) {
        throw new GameError("That question is not in this practice round.", 404);
      }
      return expected === choice;
    } catch (error) {
      if (error instanceof GameError) throw error;
      throw new GameError("Could not check that answer.", 400);
    }
  }

  const known = findKnownQuestion(input.quizId, input.variant, input.questionId);
  if (known) return known.correctOptionId === choice;

  if (input.notes) {
    const { pack } = fixturePackFromNotes(input.notes);
    const rebuilt = pack.variants[input.variant].find(
      (question) => question.id === input.questionId,
    );
    if (rebuilt) return rebuilt.correctOptionId === choice;
  }

  throw new GameError("That question is not in this practice round.", 404);
}

function findKnownQuestion(
  quizId: string,
  variant: QuizVariant,
  questionId: string,
): QuizQuestion | undefined {
  const direct = getPack(quizId)?.variants[variant]?.find((question) => question.id === questionId);
  if (direct) return direct;
  for (const pack of listPacks()) {
    const question = pack.variants[variant]?.find((item) => item.id === questionId);
    if (question) return question;
  }
  return undefined;
}
