import "server-only";

import { getCatalogItem } from "@/data/catalog";
import type { QuizVariant } from "@/data/types";
import { getPack } from "@/data/quizzes";
import { resolveAnswerKeyAccess } from "@/lib/pack-access";
import type { AnswerKeyView } from "./answer-key-view";
import { getGeneratedPack } from "./registry";

export type { AnswerKeyView };

/** Built-in demos are open. A scanned pack needs the creating device's secret. Missing and wrong secrets are the same result. */
export function loadAnswerKey(input: {
  packId: string;
  variant: QuizVariant;
  parentKey: string | null;
}): AnswerKeyView | null {
  const packId = input.packId.trim();
  const builtIn = Boolean(getCatalogItem(packId));
  const generated = builtIn ? undefined : getGeneratedPack(packId);
  const access = resolveAnswerKeyAccess({
    packId,
    builtIn,
    exists: builtIn || Boolean(generated),
    parentKeyHash: generated?.parentKeyHash ?? null,
    parentKey: input.parentKey,
  });
  if (!access.ok) return null;
  const pack = getPack(packId);
  if (!pack) return null;
  const questions = pack.variants[input.variant] ?? [];
  return {
    id: pack.id,
    title: pack.title,
    variant: input.variant,
    questions: questions.map((question) => {
      const correct = question.options.find((option) => option.id === question.correctOptionId);
      return {
        id: question.id,
        prompt: question.prompt,
        correctOptionId: question.correctOptionId,
        correctText: correct?.text ?? "",
        parentHint: question.parentHint,
      };
    }),
  };
}
