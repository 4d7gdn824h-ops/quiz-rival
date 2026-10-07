import "server-only";

import type { HomeworkMode } from "./types";

const PUBLIC_AI_KEYS = [
  "NEXT_PUBLIC_XAI_API_KEY",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_ANTHROPIC_API_KEY",
];

export function assertAiKeysStayServerSide() {
  for (const name of PUBLIC_AI_KEYS) {
    if (process.env[name]) {
      throw new Error(
        `${name} would send an AI key to the browser. Set XAI_API_KEY on the server only.`,
      );
    }
  }
}

export function homeworkMode(): HomeworkMode {
  assertAiKeysStayServerSide();
  if (process.env.XAI_API_KEY) return "xai";
  return "fixture";
}

/** Stay under Vercel Hobby's 4.5MB request body. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

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

export function isRasterImage(mime: string, name: string) {
  const type = mime.toLowerCase();
  const file = name.toLowerCase();
  if (type.includes("svg") || file.endsWith(".svg")) return false;
  if (type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|heic|heif)$/.test(file);
}
