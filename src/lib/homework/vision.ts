import "server-only";

/**
 * Worksheet vision via xAI Grok only.
 * Chat completions vision accepts images (JPEG, PNG, WebP, GIF). A PDF is
 * structured from its text layer, or the parent photographs the page.
 */

import { xaiChat, xaiConfigured, xaiTextModel, xaiVisionModel } from "../ai/xai";
import { asLines } from "./lines";
import { detectLanguage, normalizeQuizLanguage } from "./language";
import { parseJsonObject } from "./json";
import type { ExtractedNotes } from "./types";

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
- essayPrompts[] only if the page asks for a longer written answer (essay, pytanie problemowe, wypracowanie, essai, redacción, texto).
- Mark header junk (name, class, school, signature, page numbers) as junk: true.
- Keep the original language of the worksheet in title, topics, facts, prompts, rawText, lines.
- Do not replace the page with a different book or the Polish novel Chłopi unless that is what is on the page.`;

const VISION_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isVisionImage(mime: string, filename: string) {
  if (VISION_MIME.has(mime.toLowerCase())) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

export async function extractWithVision(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
}): Promise<{ notes: ExtractedNotes; mode: "xai" }> {
  if (!xaiConfigured()) {
    throw new Error("XAI_API_KEY is not set");
  }
  if (!isVisionImage(input.mime, input.filename)) {
    throw new Error(
      "Grok vision reads photos (JPEG, PNG, WebP, GIF). Photograph the page, or paste the lines.",
    );
  }
  const dataUrl = `data:${input.mime};base64,${input.bytes.toString("base64")}`;
  const text = await xaiChat({
    model: xaiVisionModel(),
    temperature: 0.2,
    json: true,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_INSTRUCTIONS },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return { notes: notesFromModelText(text), mode: "xai" };
}

export async function structureNotesWithGrok(rawText: string, title?: string): Promise<ExtractedNotes> {
  if (!xaiConfigured()) {
    throw new Error("XAI_API_KEY is not set");
  }
  const text = await xaiChat({
    model: xaiTextModel(),
    temperature: 0.2,
    json: true,
    messages: [
      {
        role: "user",
        content: `${EXTRACT_INSTRUCTIONS}\n\nTitle hint: ${title ?? ""}\n\nWorksheet text:\n${rawText.slice(0, 12000)}`,
      },
    ],
  });
  return notesFromModelText(text);
}

export function notesFromModelText(text: string): ExtractedNotes {
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
    throw new Error("Vision model returned empty notes");
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
