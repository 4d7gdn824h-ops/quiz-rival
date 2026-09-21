import "server-only";

import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { getFixtureNotes } from "./fixture";
import { homeworkMode, isAllowedUpload, MAX_UPLOAD_BYTES } from "./mode";
import { saveExtract } from "./registry";
import type { HomeworkExtract } from "./types";
import { extractWithVision } from "./vision";

export async function extractHomework(input: {
  file?: File | null;
  fixtureId?: string;
  forceFixture?: boolean;
}): Promise<HomeworkExtract> {
  const mode = homeworkMode();
  const wantFixture = Boolean(input.forceFixture || input.fixtureId || mode === "fixture");

  if (wantFixture && (input.forceFixture || input.fixtureId || !input.file || mode === "fixture")) {
    const notes = getFixtureNotes(input.fixtureId);
    const extract: HomeworkExtract = {
      id: randomId("ex"),
      notes,
      mode: "fixture",
      notice: input.forceFixture || input.fixtureId
        ? "Loaded the Chłopi demo worksheet (fixture mode)."
        : "No OPENAI_API_KEY or ANTHROPIC_API_KEY — using the Chłopi fixture extract so the demo still runs. Photo/PDF bytes were not sent to a model.",
      createdAt: Date.now(),
    };
    saveExtract(extract);
    return extract;
  }

  const file = input.file;
  if (!file) {
    throw new GameError("Choose a photo or PDF, or use the demo worksheet.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new GameError("That file is over 8 MB. Photograph one page at a time.", 413);
  }
  if (!isAllowedUpload(file)) {
    throw new GameError("Use a photo (JPEG/PNG/WebP) or a PDF.", 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || guessMime(file.name);
  try {
    const result = await extractWithVision({
      bytes,
      mime,
      filename: file.name,
    });
    const extract: HomeworkExtract = {
      id: randomId("ex"),
      notes: result.notes,
      mode: result.mode,
      createdAt: Date.now(),
    };
    saveExtract(extract);
    return extract;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that scan";
    throw new GameError(message, 502);
  }
}

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
