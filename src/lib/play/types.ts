import type { PublicLevel, PublicQuestion, QuizVariant } from "@/data/types";

export interface PlayLevel extends PublicLevel {
  questionIds: Record<QuizVariant, string[]>;
}

/** Public quiz for one phone. No answer keys. */
export interface PlayKit {
  quizId: string;
  title: string;
  language: string;
  levels: PlayLevel[];
  questions: Record<QuizVariant, PublicQuestion[]>;
  gradeSeal: string | null;
}

export interface PublicRound {
  quizId: string;
  title: string;
  language: string;
  variant: QuizVariant;
  levelId: string | null;
  levelTitle: string | null;
  questions: PublicQuestion[];
  levels: PublicLevel[];
}
