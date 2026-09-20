export type QuizLanguage = "pl" | "en";
export type QuizVariant = "A" | "B";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  parentHint: string;
}

export interface QuizPackFile {
  id: string;
  title: string;
  language: QuizLanguage;
  source?: string;
  variants: Record<QuizVariant, QuizQuestion[]>;
}

export interface PublicQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export interface PackCatalogItem {
  id: string;
  title: string;
  language: QuizLanguage;
  questionCount: number;
  blurb: string;
}
