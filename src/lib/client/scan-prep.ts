/** Pure scan helpers. Safe to import from unit tests and the browser. */

export const LONG_EDGE = 1600;
export const JPEG_QUALITY = 0.8;
export const MAX_PDF_PAGES = 10;
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 3.5 * 1024 * 1024;
export const CLIENT_TIMEOUT_MS = 45_000;
export const SLOW_NOTE_MS = 8_000;
export const SLOW_PAGE_NOTE = "Big pages can take up to 30 seconds";
export const LONG_PDF_NOTE = "This PDF has more than 10 pages. We'll use the first 10.";

export const SCAN_MESSAGES = {
  file_type: "That file won't work. Try a photo or a PDF.",
  file_too_big: "That file's too big.",
  unreadable: "We couldn't read that page. Try a sharper photo in good light.",
  timeout: "This is taking too long.",
  generate_failed: "We read your page but couldn't build the quiz.",
  offline: "You're offline. Your page is saved.",
} as const;

export type ScanErrorCode = keyof typeof SCAN_MESSAGES;

export type ScanAction = "Choose another" | "Retake" | "Try again";

const ACTIONS: Record<ScanErrorCode, ScanAction> = {
  file_type: "Choose another",
  file_too_big: "Choose another",
  unreadable: "Retake",
  timeout: "Try again",
  generate_failed: "Try again",
  offline: "Try again",
};

export class ScanFailure extends Error {
  code: string;

  constructor(code: string, message = code) {
    super(message);
    this.name = "ScanFailure";
    this.code = code;
  }
}

export function fitLongEdge(width: number, height: number, max = LONG_EDGE) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const scale = max / long;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export function isAcceptedScanFile(file: { type?: string; name?: string }) {
  const type = (file.type ?? "").toLowerCase();
  const name = (file.name ?? "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf" as const;
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png")
  ) {
    return "image" as const;
  }
  return null;
}

/** A text layer counts when the page actually has letters, not just empty operators. */
export function hasRealTextLayer(text: string) {
  const letters = text.match(/\p{L}/gu);
  return (letters?.length ?? 0) >= 40;
}

export function mapScanError(code: string, phase: "extract" | "generate" = "extract") {
  const known = (Object.keys(SCAN_MESSAGES) as ScanErrorCode[]).find((item) => item === code);
  const resolved: ScanErrorCode =
    known ?? (phase === "generate" ? "generate_failed" : "unreadable");
  return {
    code: resolved,
    message: SCAN_MESSAGES[resolved],
    action: ACTIONS[resolved],
  };
}

export function codeFromFailure(input: {
  code?: string | null;
  status?: number;
  name?: string;
  offline?: boolean;
}) {
  if (input.offline || input.status === 0) return "offline";
  if (
    input.name === "TimeoutError" ||
    input.code === "timeout" ||
    input.status === 504 ||
    input.status === 408
  ) {
    return "timeout";
  }
  if (input.code === "file_type" || input.status === 415) return "file_type";
  if (input.code === "file_too_big" || input.status === 413) return "file_too_big";
  if (input.code === "generate_failed") return "generate_failed";
  if (input.code === "unreadable") return "unreadable";
  if (input.code && input.code in SCAN_MESSAGES) return input.code;
  return "unreadable";
}

/**
 * Try again must reuse what we already have.
 * A failed build retries generate only — it does not upload the file again.
 */
export function retryMode(input: {
  code: string;
  failedPhase: "extract" | "generate";
  hasNotes: boolean;
  hasFile: boolean;
}): "generate-only" | "same-file" | "pick" {
  if (input.code === "file_type" || input.code === "file_too_big" || input.code === "unreadable") {
    return "pick";
  }
  if (input.failedPhase === "generate" && input.hasNotes) return "generate-only";
  if (input.hasFile) return "same-file";
  return "pick";
}
