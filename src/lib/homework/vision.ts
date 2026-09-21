import "server-only";

/**
 * Vision extract for homework scans.
 *
 * TODO: Gemini / other providers if their keys land.
 * TODO: local OCR fallback (e.g. tesseract) when the page is a photo but no LLM key.
 * TODO: OpenAI PDF path — Chat Completions vision is images-only; PDFs currently
 *       require ANTHROPIC_API_KEY (document blocks) or a photograph of the page.
 */

import type { ExtractedNotes, HomeworkMode } from "./types";
import { asLines, getFixtureNotes } from "./fixture";

const EXTRACT_INSTRUCTIONS = `You extract a child's homework worksheet for a parent-supervised quiz app.
Return ONLY JSON with this shape:
{
  "title": string,
  "language": "pl" or "en",
  "topics": string[],
  "facts": string[],
  "essayPrompts": string[],
  "rawText": string,
  "lines": [{ "text": string, "junk": boolean }]
}
Rules:
- Help kids practice. Do NOT solve the worksheet. Do NOT write essay answers.
- facts[] are study notes from the page (true statements, terms, names) — not the answer key to exercises when that would do the work for them.
- essayPrompts[] only if the page asks for a longer written answer / pytanie problemowe / wypracowanie.
- Mark header junk (name, class, school, signature, page numbers) as junk: true.
- Keep the original language of the worksheet in title, topics, facts, prompts, rawText.`;

export async function extractWithVision(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
}): Promise<{ notes: ExtractedNotes; mode: HomeworkMode }> {
  const mode: HomeworkMode = process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : "fixture";
  if (mode === "fixture") {
    throw new Error("No vision API key configured");
  }

  if (input.mime === "application/pdf" || input.filename.toLowerCase().endsWith(".pdf")) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "PDF scans need ANTHROPIC_API_KEY (OpenAI vision path is images-only). Photograph the page, or use the demo worksheet.",
      );
    }
    const parsed = await extractWithAnthropic(input.bytes, "application/pdf");
    return { notes: parsed, mode: "anthropic" };
  }

  if (mode === "openai") {
    const parsed = await extractWithOpenAI(input.bytes, input.mime);
    return { notes: parsed, mode: "openai" };
  }
  const parsed = await extractWithAnthropic(input.bytes, input.mime);
  return { notes: parsed, mode: "anthropic" };
}

async function extractWithOpenAI(bytes: Buffer, mime: string): Promise<ExtractedNotes> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACT_INSTRUCTIONS },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI vision failed (${response.status}): ${detail.slice(0, 280)}`);
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return notesFromModelText(body.choices?.[0]?.message?.content ?? "");
}

async function extractWithAnthropic(bytes: Buffer, mime: string): Promise<ExtractedNotes> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const model = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-5";
  const block =
    mime === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: bytes.toString("base64"),
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: bytes.toString("base64"),
          },
        };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [block, { type: "text", text: EXTRACT_INSTRUCTIONS }],
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic vision failed (${response.status}): ${detail.slice(0, 280)}`);
  }
  const body = (await response.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const text = body.content?.find((part) => part.type === "text")?.text ?? "";
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
  const fallback = getFixtureNotes();
  const rawText = String(parsed.rawText || "").trim() || fallback.rawText;
  const lines =
    Array.isArray(parsed.lines) && parsed.lines.length
      ? parsed.lines
          .map((line, index) => ({
            id: `line-${index + 1}`,
            text: String(line.text ?? "").trim(),
            keep: !line.junk,
          }))
          .filter((line) => line.text)
      : asLines(rawText, fallback.lines);
  const language = parsed.language === "en" ? "en" : "pl";
  const topics = stringList(parsed.topics);
  const facts = stringList(parsed.facts);
  const essayPrompts = stringList(parsed.essayPrompts);
  if (!topics.length && !facts.length && !rawText) {
    throw new Error("Vision model returned empty notes");
  }
  return {
    title: String(parsed.title || "").trim() || "Tonight's homework",
    language,
    topics: topics.length ? topics : fallback.topics.slice(0, 3),
    facts: facts.length ? facts : topics,
    essayPrompts,
    rawText,
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
