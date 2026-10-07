import type { PublicQuestion, QuizVariant } from "@/data/types";
import type { PlayKit, PublicRound } from "@/lib/play/types";

export function roundFromKit(
  kit: PlayKit,
  variant: QuizVariant,
  levelId: string | null,
): PublicRound {
  const tiny = kit.levels.filter((level) => !level.mega);
  const level = levelId
    ? tiny.find((item) => item.id === levelId) ?? null
    : kit.levels.find((item) => item.mega) ?? null;
  const ids = level?.questionIds[variant] ?? kit.questions[variant].map((question) => question.id);
  const byId = new Map(kit.questions[variant].map((question) => [question.id, question]));
  const questions = ids
    .map((id) => byId.get(id))
    .filter((question): question is PublicQuestion => Boolean(question));
  return {
    quizId: kit.quizId,
    title: kit.title,
    language: kit.language,
    variant,
    levelId: level && !level.mega ? level.id : null,
    levelTitle: level && !level.mega ? level.title : null,
    questions,
    levels: tiny.map((item) => ({
      id: item.id,
      title: item.title,
      theme: item.theme,
      questionCount: item.questionCount,
      mega: item.mega,
    })),
  };
}
