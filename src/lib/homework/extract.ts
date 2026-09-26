import "server-only";

import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { AI_NOT_CONFIGURED_MESSAGE } from "../ai/xai";
import { getFixtureMeta, getFixtureNotes, emptyPasteNotes, notesFromRawText } from "./fixture";
import { extractLocalNotes, extractLocalText } from "./local-text";
import { homeworkMode, isAllowedUpload, MAX_UPLOAD_BYTES } from "./mode";
import { saveExtract } from "./registry";
import type { ExtractedNotes, HomeworkExtract } from "./types";
import { extractWithVision, isVisionImage, structureNotesWithGrok } from "./vision";

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
      notice: xaiNotice(
        "Paste or edit the worksheet lines (any language), uncheck junk, then generate.",
      ),
    });
  }

  if (input.rawText?.trim() && !input.file) {
    return save({
      notes: notesFromRawText(input.rawText, { title: input.title }),
      mode: "fixture",
      notice: xaiNotice(
        "Built notes from the text you pasted. Confirm the language and lines — this is not the Chłopi demo unless that is what you pasted.",
      ),
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

  if (mode === "xai" && isVisionImage(mime, file.name)) {
    try {
      const result = await extractWithVision({ bytes, mime, filename: file.name });
      return save({ notes: result.notes, mode: "xai" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read that scan";
      throw new GameError(message, 502);
    }
  }

  if (mode === "xai") {
    const raw = extractLocalText({ bytes, mime, filename: file.name });
    if (raw && raw.replace(/\s+/g, " ").trim().length >= 24) {
      try {
        const notes = await structureNotesWithGrok(raw, titleHint);
        return save({ notes, mode: "xai" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Grok failed";
        const local = notesFromRawText(raw, { title: titleHint });
        return save({
          notes: { ...local, title: local.title || titleHint },
          mode: "fixture",
          notice: `Grok could not structure this file (${message}). Notes were built from the text itself — not the Chłopi demo.`,
        });
      }
    }
    throw new GameError(
      "Grok reads worksheet photos (JPEG, PNG, WebP, GIF). This file has no text layer — photograph the page or paste the lines. PDF text is used when the file has a text layer.",
      422,
    );
  }

  const local = extractLocalNotes({ bytes, mime, filename: file.name });
  if (local) {
    return save({
      notes: { ...local, title: local.title || titleHint },
      mode: "fixture",
      notice: `${AI_NOT_CONFIGURED_MESSAGE} Notes were built from text inside the file (SVG, PDF, or plain text — not photo OCR).`,
    });
  }

  return save({
    notes: emptyPasteNotes(titleHint || "Tonight's homework"),
    mode: "fixture",
    notice: `${AI_NOT_CONFIGURED_MESSAGE} The photo was not sent to a model and was not treated as Chłopi. Paste the worksheet lines, or pick a demo.`,
  });
}

function xaiNotice(whenConfigured: string) {
  return homeworkMode() === "xai"
    ? `${whenConfigured} Generate will ask Grok for a practice pack in this language.`
    : `${AI_NOT_CONFIGURED_MESSAGE} ${whenConfigured}`;
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
