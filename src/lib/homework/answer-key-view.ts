import type { QuizVariant } from "@/data/types";

export interface AnswerKeyQuestion {
  id: string;
  prompt: string;
  correctOptionId: string;
  correctText: string;
  parentHint: string;
}

export interface AnswerKeyView {
  id: string;
  title: string;
  variant: QuizVariant;
  questions: AnswerKeyQuestion[];
}
