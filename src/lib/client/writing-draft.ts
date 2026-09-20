import type { Stance, ThemeOption } from "@/data/writing-coach";

export interface WritingDraft {
  step: number;
  stance: Stance | null;
  themes: ThemeOption["id"][];
  example: string;
  thesis: string;
  themeLinks: string;
  modernPara: string;
  closing: string;
}

export const EMPTY_DRAFT: WritingDraft = {
  step: 0,
  stance: null,
  themes: [],
  example: "",
  thesis: "",
  themeLinks: "",
  modernPara: "",
  closing: "",
};

const KEY = "quizrival-chlopi-essay-draft";

export function readWritingDraft(): WritingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WritingDraft;
    if (typeof parsed.step !== "number") return null;
    return { ...EMPTY_DRAFT, ...parsed };
  } catch {
    return null;
  }
}

export function writeWritingDraft(draft: WritingDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearWritingDraft() {
  sessionStorage.removeItem(KEY);
}
