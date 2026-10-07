import "server-only";

import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { HomeworkError } from "./errors";
import { getFixtureMeta, getFixtureNotes, emptyPasteNotes, notesFromRawText } from "./fixture";
import { extractLocalNotes, extractLocalText } from "./local-text";
import { homeworkMode, isAllowedUpload, isRasterImage, MAX_UPLOAD_BYTES } from "./mode";
import type { ExtractedNotes, HomeworkExtract } from "./types";
import { extractWithVision, structureWorksheetText } from "./vision";

export async function extractHomework(input: {
  file?: File | null;
  files?: File[] | null;
  fixtureId?: string;
  forceFixture?: boolean;
  pasteDemo?: boolean;
  rawText?: string;
  title?: string;
  source?: string;
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

  const uploads = (input.files?.length ? input.files : input.file ? [input.file] : []).filter(
    (file) => file.size > 0,
  );

  if (input.rawText?.trim() && !uploads.length && input.source === "pdf-text") {
    return readPdfText(input.rawText, input.title, mode);
  }

  if (input.rawText?.trim() && !uploads.length) {
    return finish({
      notes: notesFromRawText(input.rawText, { title: input.title }),
      mode: "fixture",
      notice:
        "Built notes from the text you pasted. Confirm the language and lines. The pasted text is not saved on the server.",
    });
  }

  const wantNamedFixture = Boolean(input.fixtureId || (input.forceFixture && !uploads.length));
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

  if (!uploads.length) {
    throw new HomeworkError(
      "Choose a photo or PDF, pick a demo worksheet, or paste the page text.",
      "file_type",
      400,
    );
  }
  const total = uploads.reduce((sum, file) => sum + file.size, 0);
  if (uploads.some((file) => file.size > MAX_UPLOAD_BYTES) || total > MAX_UPLOAD_BYTES) {
    throw new HomeworkError("That file's too big.", "file_too_big", 413);
  }
  if (uploads.some((file) => !isAllowedUpload(file))) {
    throw new HomeworkError("That file won't work. Try a photo or a PDF.", "file_type", 400);
  }

  const images = uploads.filter((file) => isRasterImage(file.type || guessMime(file.name), file.name));
  if (images.length === uploads.length) {
    return readImages(images.slice(0, 10), mode);
  }

  const file = uploads[0];
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const mime = file.type || guessMime(file.name);
    const titleHint = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    return await readFile({ bytes, mime, filename: file.name, titleHint, mode });
  } finally {
    bytes.fill(0);
  }
}

async function readPdfText(
  rawText: string,
  title: string | undefined,
  mode: HomeworkExtract["mode"],
): Promise<HomeworkExtract> {
  const local = notesFromRawText(rawText, { title });
  if (mode !== "xai") {
    return finish({
      notes: local,
      mode: "fixture",
      notice:
        "Built notes from the text in the PDF. Confirm the language and lines. The file was not saved.",
    });
  }
  try {
    const notes = await structureWorksheetText(rawText, title);
    return finish({ notes, mode: "xai" });
  } catch (error) {
    if (local.topics.length || local.facts.length) {
      return finish({
        notes: local,
        mode: "fixture",
        notice:
          "xAI could not be reached, so the text inside the PDF was used instead. The file was not saved.",
      });
    }
    throw asReadError(error);
  }
}

async function readImages(files: File[], mode: HomeworkExtract["mode"]): Promise<HomeworkExtract> {
  const titleHint = files[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  if (mode !== "xai") {
    return finish({
      notes: emptyPasteNotes(titleHint || "Tonight's homework"),
      mode: "fixture",
      notice:
        "No XAI_API_KEY — the photo was not sent to a model and was not saved. Paste or edit the worksheet lines (any language), then generate. Or pick a demo worksheet.",
    });
  }
  const images: { bytes: Buffer; mime: string }[] = [];
  try {
    for (const file of files) {
      images.push({
        bytes: Buffer.from(await file.arrayBuffer()),
        mime: file.type || "image/jpeg",
      });
    }
    const result = await extractWithVision({ images });
    return finish({ notes: result.notes, mode: "xai" });
  } catch (error) {
    throw asReadError(error);
  } finally {
    for (const image of images) image.bytes.fill(0);
  }
}

function asReadError(error: unknown): HomeworkError {
  if (error instanceof HomeworkError) {
    if (error.code === "timeout") return error;
    if (error.code === "unreadable" || error.code === "file_type" || error.code === "file_too_big") {
      return error;
    }
  }
  return new HomeworkError(
    "We couldn't read that page. Try a sharper photo in good light.",
    "unreadable",
    422,
  );
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
          images: [{ bytes: input.bytes, mime: input.mime || "image/jpeg" }],
        });
        return finish({ notes: result.notes, mode: "xai" });
      } catch (error) {
        throw asReadError(error);
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

    throw new HomeworkError(
      "We couldn't read that page. Try a sharper photo in good light.",
      "unreadable",
      422,
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
