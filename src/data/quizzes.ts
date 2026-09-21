import "server-only";

import { getGeneratedPack } from "@/lib/homework/registry";
import type { QuizPackFile, QuizQuestion, QuizVariant } from "./types";
import chlopi from "./chlopi.json";
import warmupEn from "./warmup-en.json";

const PACKS: QuizPackFile[] = [
  chlopi as QuizPackFile,
  warmupEn as QuizPackFile,
];

export function listPacks(): QuizPackFile[] {
  return PACKS;
}

export function getPack(quizId: string): QuizPackFile | undefined {
  return PACKS.find((pack) => pack.id === quizId) ?? getGeneratedPack(quizId)?.pack;
}

export function getQuestions(
  quizId: string,
  variant: QuizVariant,
): QuizQuestion[] | undefined {
  const pack = getPack(quizId);
  return pack?.variants[variant];
}

export function getQuestionById(
  quizId: string,
  variant: QuizVariant,
  questionId: string,
): QuizQuestion | undefined {
  return getQuestions(quizId, variant)?.find((q) => q.id === questionId);
}
