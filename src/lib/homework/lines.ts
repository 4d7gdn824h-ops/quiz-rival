import { detectLanguage, normalizeQuizLanguage } from "./language";
import type { ExtractLine, ExtractedNotes } from "./types";

const JUNK_START =
  /^(imię|imie|nazwisko|szkoła|szkola|klasa|data|podpis|nombre|apellido|escuela|clase|fecha|firma|nom|pr[eé]nom|école|ecole|classe|signature|name\b|class\b|school\b|date\b)/i;

const JUNK_PAGE = /^(strona|página|pagina|page)\s+\d+/i;

export function looksLikeJunk(text: string) {
  const value = text.trim();
  if (!value) return true;
  if (JUNK_START.test(value)) return true;
  if (/_{3,}|x{3,}|\.{4,}/i.test(value) && value.length < 48) return true;
  if (JUNK_PAGE.test(value)) return true;
  return false;
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

export function notesFromRawText(
  rawText: string,
  extras: { title?: string; language?: string; fixtureId?: string } = {},
): ExtractedNotes {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  const lines = asLines(text);
  const kept = lines.filter((line) => line.keep).map((line) => line.text);
  const language = normalizeQuizLanguage(
    extras.language,
    detectLanguage(`${extras.title ?? ""}\n${text}`),
  );
  const facts = deriveFacts(kept);
  const topics = deriveTopics(kept);
  return {
    title: extras.title?.trim() || titleFromLines(kept, language),
    language,
    topics,
    facts,
    essayPrompts: detectEssayPrompts(kept),
    rawText: text,
    lines,
    fixtureId: extras.fixtureId,
  };
}

export function emptyPasteNotes(title = "Tonight's homework"): ExtractedNotes {
  return {
    title,
    language: "und",
    topics: [],
    facts: [],
    essayPrompts: [],
    rawText: "",
    lines: [],
  };
}

export function deriveTopics(kept: string[]): string[] {
  const headings = kept.filter(
    (line) =>
      line.length <= 56 &&
      !/^\d+[.)]/u.test(line) &&
      /[A-Za-zÀ-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻżÑñ]/u.test(line),
  );
  const source = (headings.length >= 3 ? headings : kept)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter((line) => line.length >= 3);
  const unique: string[] = [];
  for (const line of source) {
    const topic = line.length > 42 ? `${line.slice(0, 40).trim()}…` : line;
    if (!unique.some((item) => item.toLowerCase() === topic.toLowerCase())) {
      unique.push(topic);
    }
    if (unique.length >= 5) break;
  }
  return unique.slice(0, 5);
}

function deriveFacts(kept: string[]): string[] {
  return kept
    .filter((line) => line.length >= 8)
    .filter((line) => !detectEssayPrompts([line]).length)
    .slice(0, 12);
}

function titleFromLines(kept: string[], language: string): string {
  const first = kept.find((line) => line.length >= 4 && line.length <= 64);
  if (first) return first.replace(/^\d+[.)]\s*/, "");
  if (language === "pl") return "Karta pracy";
  if (language === "es") return "Ficha de deberes";
  if (language === "fr") return "Fiche de devoirs";
  return "Tonight's homework";
}

function detectEssayPrompts(lines: string[]): string[] {
  return lines
    .filter((line) =>
      /pytanie problemowe|wypracowanie|wypowiedzi|write (an )?essay|longer written|paragraph response|rédige|redige|escribe (un )?(texto|ensayo)|redacta/i.test(
        line,
      ),
    )
    .slice(0, 2);
}
