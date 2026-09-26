import { CHLOPI_WRITING_CONFIG, type WritingPromptConfig } from "@/data/writing-config";
import { localWritingCoach } from "@/lib/writing/plan";
import type { ExtractedNotes } from "./types";

export function writingFromNotes(packId: string, notes: ExtractedNotes): WritingPromptConfig | null {
  const prompt = notes.essayPrompts[0]?.trim();
  if (!prompt) return null;
  if (notes.fixtureId === "chlopi-worksheet") {
    return { ...CHLOPI_WRITING_CONFIG, id: packId, prompt };
  }
  return localWritingCoach({
    id: packId,
    prompt,
    language: notes.language,
    grade: "8",
    title: notes.title,
    topics: notes.topics,
    facts: notes.facts,
  });
}
