export type QuizLanguage = "pl" | "en";
export type QuizVariant = "A" | "B";

/** Sibling rooms default to the full-pack mega-level. Flip to `tiny` when screenshots land. */
export type PlaylistId = "full" | "tiny";

export type PassRule =
  | { type: "complete" }
  | { type: "minCorrect"; count: number };

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
  levelCount: number;
}

/**
 * One-theme micro-round. Client-safe (ids + titles only — no keys).
 * Variant A/B share a level and swap questionIds.
 */
export interface Level {
  id: string;
  packId: string;
  title: string;
  theme: string;
  questionIds: Record<QuizVariant, string[]>;
  passRule: PassRule;
  /** True for the temporary 8-question mega-level that today's rooms play. */
  mega?: boolean;
}

export interface PublicLevel {
  id: string;
  title: string;
  theme: string;
  questionCount: number;
  mega?: boolean;
}
