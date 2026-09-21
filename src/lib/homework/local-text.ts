import "server-only";

import { notesFromRawText } from "./lines";
import type { ExtractedNotes } from "./types";

/** Pull study text from SVG / plain text / simple PDFs. Photos need a vision key. */
export function extractLocalNotes(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
}): ExtractedNotes | null {
  const raw = extractLocalText(input);
  if (!raw || raw.replace(/\s+/g, " ").trim().length < 24) return null;
  const titleHint = input.filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  return notesFromRawText(raw, { title: titleHint });
}

export function extractLocalText(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
}): string | null {
  const name = input.filename.toLowerCase();
  const mime = (input.mime || "").toLowerCase();
  if (mime.includes("svg") || name.endsWith(".svg")) {
    return textFromSvg(input.bytes.toString("utf8"));
  }
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return input.bytes.toString("utf8");
  }
  if (mime.includes("json") || name.endsWith(".json")) {
    return textFromJsonFixture(input.bytes.toString("utf8"));
  }
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return textFromPdf(input.bytes);
  }
  return null;
}

function textFromSvg(svg: string): string {
  const chunks = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((match) =>
    decodeXml(match[1].replace(/<[^>]+>/g, "")).trim(),
  );
  return chunks.filter(Boolean).join("\n");
}

function textFromJsonFixture(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as {
      rawText?: string;
      facts?: string[];
      topics?: string[];
      title?: string;
    };
    if (typeof parsed.rawText === "string" && parsed.rawText.trim()) return parsed.rawText;
    const bits = [
      parsed.title,
      ...(parsed.topics ?? []),
      ...(parsed.facts ?? []),
    ].filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return bits.length ? bits.join("\n") : null;
  } catch {
    return raw;
  }
}

function textFromPdf(bytes: Buffer): string | null {
  const raw = bytes.toString("latin1");
  const chunks: string[] = [];
  const tj = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  const tjStar = /\[((?:(?!\]\s*TJ)[\s\S])*)\]\s*TJ/g;
  let match: RegExpExecArray | null;
  while ((match = tj.exec(raw))) {
    chunks.push(unescapePdf(match[1]));
  }
  while ((match = tjStar.exec(raw))) {
    const inner = [...match[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((part) =>
      unescapePdf(part[1]),
    );
    chunks.push(inner.join(""));
  }
  const text = chunks
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 1)
    .join("\n");
  return text.length >= 24 ? text : null;
}

function unescapePdf(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1");
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#160;", " ");
}
