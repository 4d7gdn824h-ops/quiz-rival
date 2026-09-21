import type {
  Level,
  PublicLevel,
  PublicQuestion,
  QuizQuestion,
  QuizVariant,
} from "@/data/types";

const SECRET_KEYS = new Set([
  "correctOptionId",
  "parentHint",
  "parentHints",
  "answerKey",
  "answerKeys",
]);

export function toPublicQuestion(question: QuizQuestion): PublicQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  };
}

export function toPublicLevel(level: Level, variant: QuizVariant = "A"): PublicLevel {
  return {
    id: level.id,
    title: level.title,
    theme: level.theme,
    questionCount: level.questionIds[variant]?.length ?? 0,
    mega: level.mega,
  };
}

/** Student JSON must never include keys or English parentHints. */
export function assertNoQuizSecrets(payload: unknown, path = "payload"): void {
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoQuizSecrets(item, `${path}[${index}]`));
    return;
  }
  if (!payload || typeof payload !== "object") return;
  for (const [key, value] of Object.entries(payload)) {
    if (SECRET_KEYS.has(key)) {
      throw new Error(`Refusing to send quiz secret "${key}" at ${path}`);
    }
    assertNoQuizSecrets(value, path ? `${path}.${key}` : key);
  }
}
