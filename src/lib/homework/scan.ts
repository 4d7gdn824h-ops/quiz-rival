import "server-only";

import { MAX_SCAN_PAGES, PAGE_CAP_MESSAGE } from "@/lib/client/scan-prep";
import { getPublicPack } from "@/lib/packs/public-catalog";
import { toPlayKit } from "@/lib/play/kit";
import { sealAnswerMap } from "@/lib/play/seal";
import { assertNoQuizSecrets } from "@/lib/public-quiz";
import { HomeworkError } from "./errors";
import { extractHomework } from "./extract";
import { generateHomeworkPack } from "./generate";
import type { ExtractedNotes } from "./types";

export async function scanHomework(input: {
  pages?: { mime?: string; data?: string }[] | null;
  rawText?: string;
  title?: string;
  fixtureId?: string;
  pasteDemo?: boolean;
  source?: string;
}) {
  const pages = (Array.isArray(input.pages) ? input.pages : []).filter(
    (page) => page && typeof page.data === "string",
  );
  const started = Date.now();
  let extractMs = 0;
  let generateMs = 0;
  let finishReason: string | null = null;
  try {
    if (pages.length > MAX_SCAN_PAGES) {
      throw new HomeworkError(PAGE_CAP_MESSAGE, "too_many_pages", 400);
    }

    const files = pages.map((page, index) => pageFile(page, index));
    const extracted = await extractHomework({
      files,
      rawText: input.rawText,
      title: input.title,
      fixtureId: input.fixtureId,
      pasteDemo: input.pasteDemo,
      source: input.source,
    });
    extractMs = Date.now() - started;
    finishReason = extracted.finishReason ?? null;

    const notes = extracted.notes;
    if (!notes.topics.length && !notes.facts.length && !notes.rawText.trim()) {
      const error = new HomeworkError(
        "We couldn't read that page. Try a sharper photo in good light.",
        "unreadable",
        422,
      );
      error.finishReason = finishReason;
      throw error;
    }

    const generateStarted = Date.now();
    const generated = await generateHomeworkPack(notes);
    generateMs = Date.now() - generateStarted;
    const pack = getPublicPack(generated.id);
    if (!pack) {
      throw new HomeworkError(
        "We read your page but couldn't build the quiz.",
        "generate_failed",
        500,
      );
    }
    const gradeSeal = generated.mode === "xai" ? sealAnswerMap(generated.pack) : null;
    const payload = {
      mode: generated.mode,
      notice: extracted.notice ?? null,
      notes: clientNotes(notes),
      pack,
      playKit: toPlayKit(generated.pack, generated.levels, gradeSeal),
    };
    assertNoQuizSecrets(payload, "scan");
    return { payload, pages: pages.length, extractMs, generateMs, finishReason };
  } catch (error) {
    stampScanTiming(error, { started, extractMs, generateMs, finishReason });
    throw error;
  }
}

function stampScanTiming(
  error: unknown,
  timing: { started: number; extractMs: number; generateMs: number; finishReason: string | null },
) {
  if (!(error instanceof HomeworkError)) return;
  const elapsed = Date.now() - timing.started;
  if (timing.extractMs === 0) {
    error.extractMs = elapsed;
    error.generateMs = 0;
  } else {
    error.extractMs = timing.extractMs;
    error.generateMs = timing.generateMs || Math.max(0, elapsed - timing.extractMs);
  }
  if (error.finishReason == null) error.finishReason = timing.finishReason;
}

function clientNotes(notes: ExtractedNotes): ExtractedNotes {
  return {
    title: notes.title,
    language: notes.language,
    topics: notes.topics,
    facts: notes.facts,
    essayPrompts: notes.essayPrompts,
    rawText: notes.rawText,
    lines: notes.lines,
    fixtureId: notes.fixtureId,
  };
}

function pageFile(page: { mime?: string; data?: string }, index: number) {
  const mime = (page.mime || "image/jpeg").toLowerCase();
  if (!mime.startsWith("image/")) {
    throw new HomeworkError("That file won't work. Try a photo or a PDF.", "file_type", 400);
  }
  const data = String(page.data || "").replace(/\s/g, "");
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length) {
    throw new HomeworkError(
      "We couldn't read that page. Try a sharper photo in good light.",
      "unreadable",
      422,
    );
  }
  return new File([new Uint8Array(bytes)], `page-${index + 1}.jpg`, { type: mime });
}
