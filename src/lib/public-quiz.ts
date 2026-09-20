import type { PublicQuestion, QuizQuestion } from "@/data/types";

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
