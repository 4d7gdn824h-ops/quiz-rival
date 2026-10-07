import "server-only";

/**
 * Homework vision goes to xAI on our server.
 * Bytes stay in this request. We do not call the xAI Files API (that would
 * store the upload) and we do not write the file to disk.
 */

import type { ExtractedNotes } from "./types";
import { asLines } from "./lines";
import { detectLanguage, normalizeQuizLanguage } from "./language";
import { xaiComplete } from "./xai";

const EXTRACT_INSTRUCTIONS = `You extract a child's homework worksheet for a parent-supervised quiz app.
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

export async function extractWithVision(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
}): Promise<{ notes: ExtractedNotes; mode: "xai" }> {
  if (!process.env.XAI_API_KEY) {
    throw new Error("No vision API key configured");
  }
  if (input.mime === "application/pdf" || input.filename.toLowerCase().endsWith(".pdf")) {
    throw new Error(
      "Photograph the page as a JPEG or PNG. We do not upload PDF files to xAI storage.",
    );
  }
  const mime = input.mime || "image/jpeg";
  const dataUrl = `data:${mime};base64,${input.bytes.toString("base64")}`;
  const text = await xaiComplete({
    temperature: 0.2,
    content: [
      { type: "text", text: EXTRACT_INSTRUCTIONS },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  });
  return { notes: notesFromModelText(text), mode: "xai" };
}

export async function structureWorksheetText(
  rawText: string,
  titleHint?: string,
): Promise<ExtractedNotes> {
  const clipped = rawText.slice(0, 12000);
  const text = await xaiComplete({
    temperature: 0.2,
    content: `${EXTRACT_INSTRUCTIONS}\n\nWorksheet title hint: ${titleHint || "Tonight's homework"}\n\nWorksheet text:\n${clipped}`,
  });
  return notesFromModelText(text);
}

function notesFromModelText(text: string): ExtractedNotes {
  const parsed = parseJsonObject(text) as {
    title?: string;
    language?: string;
    topics?: unknown;
    facts?: unknown;
    essayPrompts?: unknown;
    rawText?: string;
    lines?: { text?: string; junk?: boolean }[];
  };
  const rawText = String(parsed.rawText || "").trim();
  const lines =
    Array.isArray(parsed.lines) && parsed.lines.length
      ? parsed.lines
          .map((line, index) => ({
            id: `line-${index + 1}`,
            text: String(line.text ?? "").trim(),
            keep: !line.junk,
          }))
          .filter((line) => line.text)
      : asLines(rawText);
  const topics = stringList(parsed.topics);
  const facts = stringList(parsed.facts);
  const essayPrompts = stringList(parsed.essayPrompts);
  const blob = `${parsed.title ?? ""}\n${topics.join(" ")}\n${facts.join(" ")}\n${rawText}`;
  const language = normalizeQuizLanguage(parsed.language, detectLanguage(blob));
  if (!topics.length && !facts.length && !rawText && !lines.length) {
    throw new Error("xAI returned empty notes");
  }
  const kept = lines.filter((line) => line.keep).map((line) => line.text);
  return {
    title: String(parsed.title || "").trim() || "Tonight's homework",
    language,
    topics: topics.length ? topics : kept.slice(0, 5),
    facts: facts.length ? facts : topics.length ? topics : kept.slice(0, 8),
    essayPrompts,
    rawText: rawText || kept.join("\n"),
    lines,
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 16);
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}
