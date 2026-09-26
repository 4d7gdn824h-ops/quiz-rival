import type { Stance } from "@/data/writing-coach";

export interface WritingDraft {
  packId: string;
  step: number;
  stance: Stance | null;
  themes: string[];
  example: string;
  /** Planning notes. Not part of the essay the child turns in. */
  plan: string;
  thesis: string;
  themeLinks: string;
  modernPara: string;
  closing: string;
}

export const EMPTY_DRAFT: WritingDraft = {
  packId: "chlopi",
  step: 0,
  stance: null,
  themes: [],
  example: "",
  plan: "",
  thesis: "",
  themeLinks: "",
  modernPara: "",
  closing: "",
};

const keyFor = (packId: string) => `quizrival-essay-draft:${packId}`;
const LEGACY_KEY = "quizrival-chlopi-essay-draft";

export function readWritingDraft(packId = "chlopi"): WritingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      sessionStorage.getItem(keyFor(packId)) ??
      (packId === "chlopi" ? sessionStorage.getItem(LEGACY_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WritingDraft;
    if (typeof parsed.step !== "number") return null;
    return { ...EMPTY_DRAFT, ...parsed, packId };
  } catch {
    return null;
  }
}

export function writeWritingDraft(draft: WritingDraft) {
  const packId = draft.packId || "chlopi";
  sessionStorage.setItem(keyFor(packId), JSON.stringify(draft));
}

export function clearWritingDraft(packId = "chlopi") {
  sessionStorage.removeItem(keyFor(packId));
  if (packId === "chlopi") sessionStorage.removeItem(LEGACY_KEY);
}
