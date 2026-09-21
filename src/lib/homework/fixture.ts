import { HOMEWORK_FIXTURES, getFixtureMeta } from "@/data/fixtures/catalog";
import chlopiFixture from "@/data/fixtures/chlopi-worksheet.json";
import planetasFixture from "@/data/fixtures/planetas-worksheet.json";
import waterCycleFixture from "@/data/fixtures/water-cycle-worksheet.json";
import type { ExtractedNotes } from "./types";

export { HOMEWORK_FIXTURES, getFixtureMeta } from "@/data/fixtures/catalog";
export { asLines, looksLikeJunk, notesFromRawText, emptyPasteNotes } from "./lines";

export const CHLOPI_FIXTURE_ID = "chlopi-worksheet";

type FixtureFile = {
  id: string;
  title: string;
  language: string;
  topics: string[];
  facts: string[];
  essayPrompts: string[];
  rawText: string;
  lines: { id: string; text: string; keep: boolean }[];
};

const FILES: Record<string, FixtureFile> = {
  "chlopi-worksheet": chlopiFixture as FixtureFile,
  "water-cycle-worksheet": waterCycleFixture as FixtureFile,
  "planetas-worksheet": planetasFixture as FixtureFile,
};

export function listFixtureIds() {
  return HOMEWORK_FIXTURES.map((item) => item.id);
}

export function getFixtureNotes(id = CHLOPI_FIXTURE_ID): ExtractedNotes {
  const file = FILES[id];
  if (!file) {
    throw new Error(`Unknown demo worksheet: ${id}`);
  }
  const meta = getFixtureMeta(file.id);
  return {
    title: file.title,
    language: file.language || meta?.language || "und",
    topics: [...file.topics],
    facts: [...file.facts],
    essayPrompts: [...file.essayPrompts],
    rawText: file.rawText,
    lines: file.lines.map((line) => ({ ...line })),
    fixtureId: file.id,
  };
}

export function cloneNotes(notes: ExtractedNotes): ExtractedNotes {
  return {
    ...notes,
    topics: [...notes.topics],
    facts: [...notes.facts],
    essayPrompts: [...notes.essayPrompts],
    lines: notes.lines.map((line) => ({ ...line })),
  };
}

export function notesFromKeptLines(notes: ExtractedNotes): ExtractedNotes {
  const kept = notes.lines.filter((line) => line.keep);
  const rawText = kept.map((line) => line.text).join("\n");
  return {
    ...notes,
    rawText: rawText || notes.rawText,
    topics: notes.topics.map((topic) => topic.trim()).filter(Boolean),
    facts: notes.facts.map((fact) => fact.trim()).filter(Boolean),
    essayPrompts: notes.essayPrompts.map((prompt) => prompt.trim()).filter(Boolean),
    lines: notes.lines.map((line) => ({ ...line, text: line.text.trim() })),
  };
}
