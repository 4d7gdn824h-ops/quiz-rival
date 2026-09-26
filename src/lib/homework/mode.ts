import { xaiConfigured } from "../ai/xai";
import type { HomeworkMode } from "./types";

/** Grok when `XAI_API_KEY` is set. OpenAI and Anthropic keys are ignored. */
export function homeworkMode(): HomeworkMode {
  return xaiConfigured() ? "xai" : "fixture";
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/pdf",
]);

export function isAllowedUpload(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) return false;
  if (ALLOWED_UPLOAD_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif") ||
    name.endsWith(".svg") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".json")
  );
}
