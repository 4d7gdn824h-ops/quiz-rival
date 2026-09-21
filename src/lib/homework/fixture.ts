import chlopiFixture from "@/data/fixtures/chlopi-worksheet.json";
import type { ExtractedNotes, ExtractLine } from "./types";

export const CHLOPI_FIXTURE_ID = "chlopi-worksheet";

type FixtureFile = {
  id: string;
  title: string;
  language: "pl" | "en";
  topics: string[];
  facts: string[];
  essayPrompts: string[];
  rawText: string;
  lines: { id: string; text: string; keep: boolean }[];
};

const CHLOPI = chlopiFixture as FixtureFile;

export function listFixtureIds() {
  return [CHLOPI_FIXTURE_ID];
}

export function getFixtureNotes(id = CHLOPI_FIXTURE_ID): ExtractedNotes {
  const file = id === CHLOPI_FIXTURE_ID ? CHLOPI : CHLOPI;
  return {
    title: file.title,
    language: file.language,
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

export function asLines(rawText: string, fallback: ExtractLine[] = []): ExtractLine[] {
  const rows = rawText
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean);
  if (!rows.length) return fallback;
  return rows.map((text, index) => ({
    id: `line-${index + 1}`,
    text,
    keep: !looksLikeJunk(text),
  }));
}

export function looksLikeJunk(text: string) {
  const value = text.trim();
  if (!value) return true;
  if (/^(imię|imie|nazwisko|szkoła|szkola|klasa|data|podpis)/i.test(value)) return true;
  if (/_{3,}|x{3,}|\.{4,}/i.test(value) && value.length < 48) return true;
  if (/^strona\s+\d+/i.test(value)) return true;
  if (/^page\s+\d+/i.test(value)) return true;
  return false;
}
