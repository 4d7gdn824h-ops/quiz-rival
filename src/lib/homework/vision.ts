import "server-only";

/**
 * Homework vision goes to xAI on our server.
 * Bytes stay in this request. We do not call the xAI Files API (that would
 * store the upload) and we do not write the file to disk.
 */

import type { ExtractedNotes } from "./types";
import { HomeworkError } from "./errors";
import { asLines } from "./lines";
import { detectLanguage, normalizeQuizLanguage } from "./language";
import { xaiComplete } from "./xai";
import {
  SINGLE_PAGE_EXTRACT_INSTRUCTIONS,
  VISION_MAX_TOKENS,
  compactPageNotes,
  modelHasReadableText,
  parseModelObject,
  tryParseJson,
  unreadablePageError,
  visionExtractPrompt,
} from "./vision-read";

export async function extractWithVision(input: {
  images: { bytes: Buffer; mime: string }[];
}): Promise<{ notes: ExtractedNotes; mode: "xai"; finishReason: string | null }> {
  if (!process.env.XAI_API_KEY) {
    throw new HomeworkError("We couldn't read that page. Try again in a moment.", "ai_error", 500);
  }
  const images = input.images.slice(0, 6).filter((image) => image.bytes.length > 0);
  if (!images.length) {
    throw new HomeworkError("We couldn't read that page. Try a sharper photo in good light.", "unreadable", 422);
  }
  if (images.some((image) => image.mime === "application/pdf")) {
    throw new HomeworkError(
      "We couldn't read that page. Try a sharper photo in good light.",
      "unreadable",
      422,
    );
  }
  const completion = await xaiComplete({
    temperature: 0.2,
    maxTokens: VISION_MAX_TOKENS,
    kind: "vision",
    content: [
      {
        type: "text",
        text: visionExtractPrompt(images.length),
      },
      ...images.map((image) => ({
        type: "image_url",
        image_url: {
          url: `data:${image.mime || "image/jpeg"};base64,${image.bytes.toString("base64")}`,
        },
      })),
    ],
  });
  return {
    notes: notesFromModelText(completion.text, completion.finishReason),
    mode: "xai",
    finishReason: completion.finishReason,
  };
}

export async function structureWorksheetText(
  rawText: string,
  titleHint?: string,
): Promise<{ notes: ExtractedNotes; finishReason: string | null }> {
  const clipped = rawText.slice(0, 12000);
  const completion = await xaiComplete({
    temperature: 0.2,
    maxTokens: 2048,
    content: `${SINGLE_PAGE_EXTRACT_INSTRUCTIONS}\n\nWorksheet title hint: ${titleHint || "Tonight's homework"}\n\nWorksheet text:\n${clipped}`,
  });
  return {
    notes: notesFromModelText(completion.text, completion.finishReason),
    finishReason: completion.finishReason,
  };
}

function notesFromModelText(text: string, finishReason: string | null): ExtractedNotes {
  const parsed = parseModelObject(text, finishReason) as {
    title?: string;
    language?: string;
    topics?: unknown;
    facts?: unknown;
    essayPrompts?: unknown;
    rawText?: string;
    lines?: { text?: string; junk?: boolean }[];
    pages?: unknown;
  };
  const pageNotes = compactPageNotes(parsed.pages);
  const rawText = String(parsed.rawText || "").trim() || pageNotes.join("\n\n");
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
  const factList = facts.length ? facts : pageNotes.slice(0, 16);
  const blob = `${parsed.title ?? ""}\n${topics.join(" ")}\n${factList.join(" ")}\n${rawText}`;
  const language = normalizeQuizLanguage(parsed.language, detectLanguage(blob));
  if (
    !modelHasReadableText({
      topics,
      facts: factList,
      rawText,
      lineCount: lines.length,
      pageNotes,
    })
  ) {
    throw unreadablePageError(finishReason);
  }
  const kept = lines.filter((line) => line.keep).map((line) => line.text);
  return {
    title: String(parsed.title || "").trim() || "Tonight's homework",
    language,
    topics: topics.length ? topics : kept.slice(0, 5),
    facts: factList.length ? factList : topics.length ? topics : kept.slice(0, 8),
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
  const parsed = tryParseJson(text);
  if (!parsed) throw new Error("Model did not return JSON");
  return parsed;
}
