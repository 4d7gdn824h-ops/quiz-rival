import { HOMEWORK_NOTES_KEY, TONIGHT_PACK_KEY } from "@/lib/constants";
import type { ExtractedNotes, HomeworkMode } from "@/lib/homework/types";

export interface HomeworkDraft {
  extractId: string;
  notes: ExtractedNotes;
  mode: HomeworkMode;
  notice: string | null;
}

export function readHomeworkDraft(): HomeworkDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HOMEWORK_NOTES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HomeworkDraft;
  } catch {
    return null;
  }
}

export function writeHomeworkDraft(draft: HomeworkDraft) {
  sessionStorage.setItem(HOMEWORK_NOTES_KEY, JSON.stringify(draft));
}

export function clearHomeworkDraft() {
  sessionStorage.removeItem(HOMEWORK_NOTES_KEY);
}

export function readTonightPackId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TONIGHT_PACK_KEY);
}

export function writeTonightPackId(id: string) {
  sessionStorage.setItem(TONIGHT_PACK_KEY, id);
}
