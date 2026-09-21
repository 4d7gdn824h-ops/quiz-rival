import { getQuestions } from "@/data/quizzes";
import { flattenLevelQuestionIds, resolvePlayLevels } from "@/lib/packs/levels";
import type { Level, PlaylistId, QuizQuestion, QuizVariant } from "@/data/types";
import type { Answer } from "@/lib/game/types";

/** Questions for a room playlist (keys stay server-side). */
export function getPlayQuestions(
  quizId: string,
  variant: QuizVariant,
  playlistId: PlaylistId = "full",
  levelId?: string | null,
): QuizQuestion[] {
  const bank = getQuestions(quizId, variant) ?? [];
  const byId = new Map(bank.map((question) => [question.id, question]));
  const ids = flattenLevelQuestionIds(
    resolvePlayLevels(quizId, playlistId, levelId),
    variant,
  );
  const resolved = ids
    .map((id) => byId.get(id))
    .filter((question): question is QuizQuestion => Boolean(question));
  return resolved.length ? resolved : bank;
}

export function didPassLevel(
  level: Level,
  variant: QuizVariant,
  playerId: string,
  answers: Answer[],
): boolean {
  const ids = level.questionIds[variant] ?? [];
  const mine = answers.filter((a) => a.playerId === playerId && ids.includes(a.questionId));
  if (level.passRule.type === "minCorrect") {
    return mine.filter((a) => a.correct).length >= level.passRule.count;
  }
  return ids.every((id) => mine.some((a) => a.questionId === id));
}
