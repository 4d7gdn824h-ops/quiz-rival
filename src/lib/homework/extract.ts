import "server-only";

import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { getFixtureMeta, getFixtureNotes, emptyPasteNotes, notesFromRawText } from "./fixture";
import { extractLocalNotes } from "./local-text";
import { homeworkMode, isAllowedUpload, MAX_UPLOAD_BYTES } from "./mode";
import { saveExtract } from "./registry";
import type { ExtractedNotes, HomeworkExtract } from "./types";
import { extractWithVision } from "./vision";

export async function extractHomework(input: {
  file?: File | null;
  fixtureId?: string;
  forceFixture?: boolean;
  pasteDemo?: boolean;
  rawText?: string;
  title?: string;
}): Promise<HomeworkExtract> {
  const mode = homeworkMode();

  if (input.pasteDemo && !input.file && !input.rawText?.trim()) {
    return save({
      notes: emptyPasteNotes(input.title?.trim() || "Tonight's homework"),
      mode: "fixture",
      notice:
        "Paste or edit the worksheet lines (any language), uncheck junk, then generate. Photos are not treated as Chłopi when no vision key is set.",
    });
  }

  if (input.rawText?.trim() && !input.file) {
    return save({
      notes: notesFromRawText(input.rawText, { title: input.title }),
      mode: "fixture",
      notice:
        "Built notes from the text you pasted (no vision model). Confirm the language and lines — this is not the Chłopi demo unless that is what you pasted.",
    });
  }

  const wantNamedFixture = Boolean(input.fixtureId || (input.forceFixture && !input.file));
  if (wantNamedFixture) {
    const fixtureId = input.fixtureId || "chlopi-worksheet";
    try {
      const notes = getFixtureNotes(fixtureId);
      const meta = getFixtureMeta(notes.fixtureId || fixtureId);
      return save({
        notes,
        mode: "fixture",
        notice: `Loaded the ${meta?.title ?? notes.title} demo worksheet (${notes.language}). Fixture mode — not a live vision read.`,
      });
    } catch {
      throw new GameError("Unknown demo worksheet.", 400);
    }
  }

  const file = input.file;
  if (!file) {
    throw new GameError("Choose a photo or PDF, pick a demo worksheet, or paste the page text.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new GameError("That file is over 8 MB. Photograph one page at a time.", 413);
  }
  if (!isAllowedUpload(file)) {
    throw new GameError("Use a photo (JPEG/PNG/WebP), an SVG, or a PDF.", 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || guessMime(file.name);
  const titleHint = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");

  if (mode !== "fixture") {
    try {
      const result = await extractWithVision({
        bytes,
        mime,
        filename: file.name,
      });
      return save({
        notes: result.notes,
        mode: result.mode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read that scan";
      throw new GameError(message, 502);
    }
  }

  const local = extractLocalNotes({ bytes, mime, filename: file.name });
  if (local) {
    return save({
      notes: { ...local, title: local.title || titleHint },
      mode: "fixture",
      notice:
        "No vision API key — built notes from text inside the file (SVG/PDF/plain text, not photo OCR). Confirm language and lines. This is not the Chłopi demo unless that page was Chłopi.",
    });
  }

  return save({
    notes: emptyPasteNotes(titleHint || "Tonight's homework"),
    mode: "fixture",
    notice:
      "No OPENAI_API_KEY or ANTHROPIC_API_KEY — the photo was not sent to a model and was not treated as Chłopi. Paste or edit the worksheet lines (any language), then generate. Or pick a demo worksheet.",
  });
}

function save(input: {
  notes: ExtractedNotes;
  mode: HomeworkExtract["mode"];
  notice?: string;
}): HomeworkExtract {
  const extract: HomeworkExtract = {
    id: randomId("ex"),
    notes: input.notes,
    mode: input.mode,
    notice: input.notice,
    createdAt: Date.now(),
  };
  saveExtract(extract);
  return extract;
}

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain";
  return "image/jpeg";
}
