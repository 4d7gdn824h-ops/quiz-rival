/** Pure scan helpers. Safe to import from unit tests and the browser. */

export const LONG_EDGE = 1600;
export const JPEG_QUALITY = 0.8;
export const MAX_SCAN_PAGES = 6;
export const MAX_PDF_PAGES = MAX_SCAN_PAGES;
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
/** Vercel rejects request bodies over 4.5MB. Stay under about 4MB. */
export const JSON_BODY_BUDGET = 4 * 1024 * 1024;
export const MAX_REQUEST_BYTES = JSON_BODY_BUDGET;
export const CLIENT_TIMEOUT_MS = 45_000;
export const SLOW_NOTE_MS = 8_000;
export const SLOW_PAGE_NOTE = "Big pages can take up to 30 seconds";
export const LONG_PDF_NOTE = "This PDF has more than 6 pages. We'll use the first 6.";
export const PAGE_CAP_MESSAGE = "Up to 6 pages at a time — remove one to add another.";

/**
 * Start at a 1600px long edge, then shrink the edge and JPEG quality until the
 * JSON body of every page fits the budget.
 */
export const SCALE_LADDER: { longEdge: number; quality: number }[] = [
  { longEdge: 1600, quality: 0.8 },
  { longEdge: 1600, quality: 0.65 },
  { longEdge: 1280, quality: 0.6 },
  { longEdge: 1024, quality: 0.5 },
  { longEdge: 800, quality: 0.45 },
  { longEdge: 640, quality: 0.4 },
];

export const SCAN_MESSAGES = {
  file_type: "That file won't work. Try a photo or a PDF.",
  file_too_big: "That file's too big.",
  body_too_large: "That upload is too big. Remove a page or try a smaller photo.",
  too_many_pages: PAGE_CAP_MESSAGE,
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
  body_too_large: "Choose another",
  too_many_pages: "Choose another",
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
  if (type.startsWith("image/") && !type.includes("svg")) return "image" as const;
  if (/\.(png|jpe?g|webp|gif)$/.test(name)) return "image" as const;
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

export type IncomingScanFile = {
  kind: "image" | "pdf";
  /** Images are one page. PDFs report how many pages they contain. */
  pageCount: number;
};

export type PageAdmission = {
  /** Pages kept from the start of this file. Zero means the file was not added. */
  take: number;
  rejected: boolean;
};

/**
 * Fill a 6-page tray.
 * A 7th image is rejected and the pages already accepted stay.
 * A PDF that would push the total past 6 is rejected whole.
 * A PDF dropped onto an empty tray keeps only its first 6 pages.
 */
export function admitPages(existingCount: number, incoming: IncomingScanFile[]) {
  let used = Math.max(0, existingCount);
  let message: string | null = null;
  let truncated = false;
  const files: PageAdmission[] = [];

  for (const file of incoming) {
    const count = Math.max(0, Math.floor(file.pageCount));
    if (count < 1) {
      files.push({ take: 0, rejected: true });
      message = PAGE_CAP_MESSAGE;
      continue;
    }

    if (file.kind === "pdf") {
      if (used === 0 && count > MAX_SCAN_PAGES) {
        files.push({ take: MAX_SCAN_PAGES, rejected: false });
        used += MAX_SCAN_PAGES;
        truncated = true;
        continue;
      }
      if (used + count <= MAX_SCAN_PAGES) {
        files.push({ take: count, rejected: false });
        used += count;
        continue;
      }
      files.push({ take: 0, rejected: true });
      message = PAGE_CAP_MESSAGE;
      continue;
    }

    if (used >= MAX_SCAN_PAGES) {
      files.push({ take: 0, rejected: true });
      message = PAGE_CAP_MESSAGE;
      continue;
    }
    files.push({ take: 1, rejected: false });
    used += 1;
  }

  return { files, message, truncated, total: used };
}

/** Base64 length of `bytes` binary octets, without newlines. */
export function base64Length(bytes: number) {
  if (bytes <= 0) return 0;
  return Math.ceil(bytes / 3) * 4;
}

/**
 * UTF-8 length of `{ "pages": [{ "mime", "data": "<base64>" }] }`.
 * `pageByteLengths` are the JPEG sizes before base64.
 */
export function scanJsonBytes(pageByteLengths: number[], mime = "image/jpeg") {
  const shells = pageByteLengths.map(() => ({ mime, data: "" }));
  const shell = new TextEncoder().encode(JSON.stringify({ pages: shells })).length;
  const payload = pageByteLengths.reduce((sum, bytes) => sum + base64Length(bytes), 0);
  return shell + payload;
}

export function bodyExceedsBudget(byteLength: number, budget = JSON_BODY_BUDGET) {
  return byteLength > budget;
}

/**
 * Pick the first scale step whose JPEG sizes keep the JSON body under the budget.
 * `pageByteLengthsByStep[i]` is one JPEG size per page at `SCALE_LADDER[i]`.
 * Returns null when even the smallest step is over budget.
 */
export function chooseScaleIndex(pageByteLengthsByStep: number[][]) {
  for (let index = 0; index < pageByteLengthsByStep.length; index += 1) {
    const jsonBytes = scanJsonBytes(pageByteLengthsByStep[index] ?? []);
    if (!bodyExceedsBudget(jsonBytes)) return { index, jsonBytes };
  }
  return null;
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
  if (input.code && input.code in SCAN_MESSAGES) return input.code;
  if (input.status === 413) return "body_too_large";
  if (input.status === 415) return "file_type";
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
  if (
    input.code === "file_type" ||
    input.code === "file_too_big" ||
    input.code === "body_too_large" ||
    input.code === "too_many_pages" ||
    input.code === "unreadable"
  ) {
    return "pick";
  }
  if (input.failedPhase === "generate" && input.hasNotes) return "generate-only";
  if (input.hasFile) return "same-file";
  return "pick";
}
