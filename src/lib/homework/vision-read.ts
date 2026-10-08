/**
 * Pure vision-read helpers. No server-only import, so unit tests can load them.
 * Image bytes, worksheet text, and API keys never belong in these helpers' logs.
 */

import { HomeworkError } from "./errors.ts";

/** Vision extract output cap. 2048 truncated multi-page JSON before it closed. */
export const VISION_MAX_TOKENS = 8192;

const KID_UNREADABLE = "We couldn't read that page. Try a sharper photo in good light.";
const KID_TRY_AGAIN = "We couldn't read that page. Try again in a moment.";
const KID_TIMEOUT = "This is taking too long.";

/** Single-page schema. Kept as the photo prompt used before the multi-page cut. */
export const SINGLE_PAGE_EXTRACT_INSTRUCTIONS = `You extract a child's homework worksheet for a parent-supervised quiz app.
Return ONLY JSON with this shape:
{
  "title": string,
  "language": "BCP-47 or ISO 639 code for the worksheet (e.g. pl, en, es, fr, de, uk). Never translate. Never coerce to pl or en if the page is another language.",
  "topics": string[],
  "facts": string[],
  "essayPrompts": string[],
  "rawText": string,
  "lines": [{ "text": string, "junk": boolean }]
}
Rules:
- Help kids practice. Do NOT solve the worksheet. Do NOT write essay answers.
- facts[] are study notes from the page (true statements, terms, names) — not the answer key to exercises when that would do the work for them.
- essayPrompts[] only if the page asks for a longer written answer / pytanie problemowe / wypracowanie / essai / redacción.
- Mark header junk (name, class, school, signature, page numbers) as junk: true.
- Keep the original language of the worksheet in title, topics, facts, prompts, rawText, lines.`;

const SINGLE_PAGE_VISION_SUFFIX =
  "The images are consecutive pages of one worksheet, in order. Combine them into one set of notes.";

const MULTI_PAGE_EXTRACT_INSTRUCTIONS = `You extract a child's homework worksheet for a parent-supervised quiz app.
Return ONLY JSON with this shape:
{
  "title": string,
  "language": "BCP-47 or ISO 639 code for the worksheet (e.g. pl, en, es, fr, de, uk). Never translate. Never coerce to pl or en if the page is another language.",
  "topics": ["short topic"],
  "pages": [{ "notes": "compact study notes for this page" }]
}
Rules:
- Help kids practice. Do NOT solve the worksheet. Do NOT write essay answers.
- One pages[] item per image, in order. notes is compact study text for that page (terms, true statements, names). Not a full transcript and not the answer key.
- topics[] are short topic names for the whole worksheet.
- Keep the original language of the worksheet in title, topics, and notes.
The images are consecutive pages of one worksheet, in order.`;

/** One page keeps the line list. Two or more pages ask only for compact notes plus topics. */
export function visionExtractPrompt(pageCount: number) {
  if (pageCount >= 2) return MULTI_PAGE_EXTRACT_INSTRUCTIONS;
  return `${SINGLE_PAGE_EXTRACT_INSTRUCTIONS}\n${SINGLE_PAGE_VISION_SUFFIX}`;
}

export function xaiHttpCode(status: number) {
  return `ai_http_${status}`;
}

export function tryParseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Close a cut-off object or array when the model stopped mid-token.
 * Returns null when the fragment cannot be made into JSON.
 */
export function repairTruncatedJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  if (start < 0) return null;
  let slice = candidate.slice(start);
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (let index = 0; index < slice.length; index += 1) {
    const char = slice[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") stack.pop();
  }
  if (escape) slice = slice.slice(0, -1);
  if (inString) slice += '"';
  slice = slice.replace(/,\s*$/, "");
  slice = slice.replace(/,?\s*"[^"\\]*"\s*:\s*$/, "");
  while (stack.length) {
    const open = stack.pop();
    slice += open === "[" ? "]" : "}";
  }
  try {
    const value = JSON.parse(slice) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasReadableSignal(value: Record<string, unknown>) {
  if (typeof value.title === "string" && value.title.trim()) return true;
  if (typeof value.rawText === "string" && value.rawText.trim()) return true;
  if (Array.isArray(value.topics) && value.topics.some((item) => String(item).trim())) return true;
  if (Array.isArray(value.facts) && value.facts.some((item) => String(item).trim())) return true;
  if (Array.isArray(value.lines) && value.lines.length) return true;
  if (Array.isArray(value.pages) && value.pages.length) return true;
  if (typeof value.language === "string" && value.language.trim()) return true;
  return false;
}

export function parseModelObject(text: string, finishReason: string | null): Record<string, unknown> {
  const strict = tryParseJson(text);
  if (strict) return strict;
  const repaired = repairTruncatedJson(text);
  if (repaired && hasReadableSignal(repaired)) return repaired;
  throw jsonReadError(finishReason === "length" ? "truncated" : "parse_failed", finishReason);
}

function jsonReadError(code: "truncated" | "parse_failed", finishReason: string | null) {
  const error = new HomeworkError(KID_UNREADABLE, code, 422);
  error.finishReason = finishReason;
  return error;
}

export function unreadablePageError(finishReason: string | null) {
  const error = new HomeworkError(KID_UNREADABLE, "unreadable", 422);
  error.finishReason = finishReason;
  return error;
}

export function modelHasReadableText(input: {
  topics: string[];
  facts: string[];
  rawText: string;
  lineCount: number;
  pageNotes: string[];
}) {
  return Boolean(
    input.topics.length ||
      input.facts.length ||
      input.rawText.trim() ||
      input.lineCount ||
      input.pageNotes.length,
  );
}

export function compactPageNotes(pages: unknown): string[] {
  if (!Array.isArray(pages)) return [];
  return pages
    .map((page) => {
      if (typeof page === "string") return page.trim();
      if (page && typeof page === "object" && "notes" in page) {
        return String((page as { notes?: unknown }).notes ?? "").trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 6);
}

export function preserveReadError(error: unknown): HomeworkError {
  if (error instanceof HomeworkError) return error;
  if (isAbort(error)) return new HomeworkError(KID_TIMEOUT, "ai_timeout", 504);
  return new HomeworkError(KID_TRY_AGAIN, "ai_error", 502);
}

function isAbort(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError")
  );
}

const SCAN_LOG_KEYS = [
  "pages",
  "bodyBytes",
  "extractMs",
  "generateMs",
  "finish_reason",
  "code",
  "errorType",
] as const;

export function scanLogRecord(input: {
  pages: number;
  bodyBytes: number;
  extractMs: number;
  generateMs: number;
  finishReason: string | null;
  code: string | null;
  errorType: string | null;
}) {
  const record = {
    pages: input.pages,
    bodyBytes: input.bodyBytes,
    extractMs: input.extractMs,
    generateMs: input.generateMs,
    finish_reason: input.finishReason,
    code: input.code,
    errorType: input.errorType,
  };
  const keys = Object.keys(record);
  if (keys.length !== SCAN_LOG_KEYS.length || SCAN_LOG_KEYS.some((key) => !keys.includes(key))) {
    throw new Error("scan log shape drifted");
  }
  return record;
}

export const AI_TRY_AGAIN_MESSAGE = KID_TRY_AGAIN;
