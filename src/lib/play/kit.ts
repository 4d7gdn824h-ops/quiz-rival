import "server-only";

import type { Level, QuizPackFile, QuizVariant } from "@/data/types";
import { getLevel, listTinyLevels } from "@/lib/packs/levels";
import { getPack } from "@/data/quizzes";
import { getPlayQuestions } from "@/lib/levels/resolve";
import { assertNoQuizSecrets, toPublicLevel, toPublicQuestion } from "@/lib/public-quiz";
import type { PlayKit, PublicRound } from "./types";

export function toPlayKit(
  pack: QuizPackFile,
  levels: Level[],
  gradeSeal: string | null,
): PlayKit {
  const kit: PlayKit = {
    quizId: pack.id,
    title: pack.title,
    language: pack.language,
    gradeSeal,
    levels: levels.map((level) => ({
      id: level.id,
      title: level.title,
      theme: level.theme,
      mega: level.mega,
      questionCount: level.questionIds.A?.length ?? 0,
      questionIds: {
        A: [...(level.questionIds.A ?? [])],
        B: [...(level.questionIds.B ?? [])],
      },
    })),
    questions: {
      A: pack.variants.A.map(toPublicQuestion),
      B: pack.variants.B.map(toPublicQuestion),
    },
  };
  assertNoQuizSecrets(kit, "playKit");
  return kit;
}

export function buildPublicRound(
  quizId: string,
  variant: QuizVariant,
  levelId?: string | null,
): PublicRound | null {
  const pack = getPack(quizId);
  if (!pack) return null;
  const questions = getPlayQuestions(
    quizId,
    variant,
    levelId ? "tiny" : "full",
    levelId ?? null,
  );
  if (!questions.length) return null;
  const level = levelId ? getLevel(quizId, levelId) : undefined;
  const round: PublicRound = {
    quizId,
    title: pack.title,
    language: pack.language,
    variant,
    levelId: level && !level.mega ? level.id : null,
    levelTitle: level && !level.mega ? level.title : null,
    questions: questions.map(toPublicQuestion),
    levels: listTinyLevels(quizId).map((item) => toPublicLevel(item, variant)),
  };
  assertNoQuizSecrets(round, "round");
  return round;
}
