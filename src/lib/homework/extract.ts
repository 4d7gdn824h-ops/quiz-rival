import "server-only";

import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { getFixtureMeta, getFixtureNotes, emptyPasteNotes, notesFromRawText } from "./fixture";
import { extractLocalNotes, extractLocalText } from "./local-text";
import { homeworkMode, isAllowedUpload, isRasterImage, MAX_UPLOAD_BYTES } from "./mode";
import type { ExtractedNotes, HomeworkExtract } from "./types";
import { extractWithVision, structureWorksheetText } from "./vision";

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
    return finish({
      notes: emptyPasteNotes(input.title?.trim() || "Tonight's homework"),
      mode: "fixture",
      notice:
        "Paste or edit the worksheet lines (any language), uncheck junk, then generate. Photos are not treated as Chłopi when no vision key is set.",
    });
  }

  if (input.rawText?.trim() && !input.file) {
    return finish({
      notes: notesFromRawText(input.rawText, { title: input.title }),
      mode: "fixture",
      notice:
        "Built notes from the text you pasted. Confirm the language and lines. The pasted text is not saved on the server.",
    });
  }

  const wantNamedFixture = Boolean(input.fixtureId || (input.forceFixture && !input.file));
  if (wantNamedFixture) {
    const fixtureId = input.fixtureId || "chlopi-worksheet";
    try {
      const notes = getFixtureNotes(fixtureId);
      const meta = getFixtureMeta(notes.fixtureId || fixtureId);
      return finish({
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
  try {
    const mime = file.type || guessMime(file.name);
    const titleHint = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    return await readFile({ bytes, mime, filename: file.name, titleHint, mode });
  } finally {
    bytes.fill(0);
  }
}

async function readFile(input: {
  bytes: Buffer;
  mime: string;
  filename: string;
  titleHint: string;
  mode: HomeworkExtract["mode"];
}): Promise<HomeworkExtract> {
  if (input.mode === "xai") {
    if (isRasterImage(input.mime, input.filename)) {
      try {
        const result = await extractWithVision({
          bytes: input.bytes,
          mime: input.mime,
          filename: input.filename,
        });
        return finish({ notes: result.notes, mode: "xai" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not read that scan";
        throw new GameError(message, 502);
      }
    }

    const localText = extractLocalText({
      bytes: input.bytes,
      mime: input.mime,
      filename: input.filename,
    });
    if (localText && localText.replace(/\s+/g, " ").trim().length >= 24) {
      try {
        const notes = await structureWorksheetText(localText, input.titleHint);
        return finish({ notes, mode: "xai" });
      } catch (error) {
        const local = extractLocalNotes({
          bytes: input.bytes,
          mime: input.mime,
          filename: input.filename,
        });
        if (local) {
          return finish({
            notes: { ...local, title: local.title || input.titleHint },
            mode: "fixture",
            notice:
              "xAI could not be reached, so the text inside the file was used instead. The file was not saved.",
          });
        }
        const message = error instanceof Error ? error.message : "Could not read that scan";
        throw new GameError(message, 502);
      }
    }

    throw new GameError(
      "That PDF has no text we can read without saving the file. Take a JPEG or PNG photo of the page, or paste the lines.",
      400,
    );
  }

  const local = extractLocalNotes({
    bytes: input.bytes,
    mime: input.mime,
    filename: input.filename,
  });
  if (local) {
    return finish({
      notes: { ...local, title: local.title || input.titleHint },
      mode: "fixture",
      notice:
        "No XAI_API_KEY — built notes from text inside the file (SVG/PDF/plain text, not photo OCR). The file was not saved. This is not the Chłopi demo unless that page was Chłopi.",
    });
  }

  return finish({
    notes: emptyPasteNotes(input.titleHint || "Tonight's homework"),
    mode: "fixture",
    notice:
      "No XAI_API_KEY — the photo was not sent to a model and was not saved. Paste or edit the worksheet lines (any language), then generate. Or pick a demo worksheet.",
  });
}

function finish(input: {
  notes: ExtractedNotes;
  mode: HomeworkExtract["mode"];
  notice?: string;
}): HomeworkExtract {
  return {
    id: randomId("ex"),
    notes: input.notes,
    mode: input.mode,
    notice: input.notice,
    createdAt: Date.now(),
  };
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
