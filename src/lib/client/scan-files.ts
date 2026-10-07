import {
  fitLongEdge,
  hasRealTextLayer,
  isAcceptedScanFile,
  JPEG_QUALITY,
  LONG_EDGE,
  MAX_PDF_PAGES,
  MAX_REQUEST_BYTES,
  ScanFailure,
} from "./scan-prep";

export interface ScanPreview {
  thumbUrl: string | null;
  pageCount: number;
  truncated: boolean;
}

export type PreparedScan =
  | {
      kind: "images";
      files: File[];
      pageCount: number;
      truncated: boolean;
      thumbUrl: string | null;
    }
  | {
      kind: "text";
      text: string;
      title: string;
      pageCount: number;
      truncated: boolean;
      thumbUrl: string | null;
    };

type PdfTextItem = { str?: string };

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[] }>;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<unknown> };
};

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy?: () => Promise<void> | void;
};

export async function prepareScanFile(
  file: File,
  hooks: {
    signal?: AbortSignal;
    onPreview: (preview: ScanPreview) => void;
  },
): Promise<PreparedScan> {
  throwIfAborted(hooks.signal);
  const kind = isAcceptedScanFile(file);
  if (!kind) throw new ScanFailure("file_type");
  if (kind === "pdf") return preparePdf(file, hooks);
  return prepareImage(file, hooks);
}

async function prepareImage(
  file: File,
  hooks: { signal?: AbortSignal; onPreview: (preview: ScanPreview) => void },
): Promise<PreparedScan> {
  const quick = URL.createObjectURL(file);
  hooks.onPreview({ thumbUrl: quick, pageCount: 1, truncated: false });
  throwIfAborted(hooks.signal);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ScanFailure("unreadable");
  }
  try {
    const size = fitLongEdge(bitmap.width, bitmap.height, LONG_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new ScanFailure("unreadable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    let quality = JPEG_QUALITY;
    let blob = await canvasToJpeg(canvas, quality);
    if (blob.size > MAX_REQUEST_BYTES) {
      quality = 0.6;
      blob = await canvasToJpeg(canvas, quality);
    }
    if (blob.size > MAX_REQUEST_BYTES) throw new ScanFailure("file_too_big");
    const thumbUrl = URL.createObjectURL(blob);
    const jpeg = new File([blob], jpegName(file.name), { type: "image/jpeg" });
    hooks.onPreview({ thumbUrl, pageCount: 1, truncated: false });
    URL.revokeObjectURL(quick);
    return { kind: "images", files: [jpeg], pageCount: 1, truncated: false, thumbUrl };
  } finally {
    bitmap.close();
  }
}

async function preparePdf(
  file: File,
  hooks: { signal?: AbortSignal; onPreview: (preview: ScanPreview) => void },
): Promise<PreparedScan> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(hooks.signal);
  const doc = (await pdfjs
    .getDocument({ data, useSystemFonts: true })
    .promise) as unknown as PdfDoc;
  try {
    const pageCount = doc.numPages;
    const truncated = pageCount > MAX_PDF_PAGES;
    const limit = Math.min(pageCount, MAX_PDF_PAGES);
    hooks.onPreview({ thumbUrl: null, pageCount, truncated });
    if (!limit) throw new ScanFailure("unreadable");

    let text = "";
    for (let index = 1; index <= limit; index += 1) {
      throwIfAborted(hooks.signal);
      const page = await doc.getPage(index);
      const content = await page.getTextContent();
      text += `${textFromItems(content.items)}\n`;
    }

    const title = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
    if (hasRealTextLayer(text)) {
      const first = await doc.getPage(1);
      const thumbBlob = await renderPage(first, 800, 0.7);
      const thumbUrl = URL.createObjectURL(thumbBlob);
      hooks.onPreview({ thumbUrl, pageCount, truncated });
      return { kind: "text", text: text.trim(), title, pageCount, truncated, thumbUrl };
    }

    const canvases: HTMLCanvasElement[] = [];
    for (let index = 1; index <= limit; index += 1) {
      throwIfAborted(hooks.signal);
      const page = await doc.getPage(index);
      const canvas = await rasterPage(page, LONG_EDGE);
      canvases.push(canvas);
      if (index === 1) {
        const thumbUrl = URL.createObjectURL(await canvasToJpeg(canvas, JPEG_QUALITY));
        hooks.onPreview({ thumbUrl, pageCount, truncated });
      }
    }
    let files = await filesFromCanvases(canvases, JPEG_QUALITY);
    if (totalSize(files) > MAX_REQUEST_BYTES) {
      files = await filesFromCanvases(canvases, 0.6);
    }
    if (totalSize(files) > MAX_REQUEST_BYTES) throw new ScanFailure("file_too_big");
    return {
      kind: "images",
      files,
      pageCount,
      truncated,
      thumbUrl: files[0] ? URL.createObjectURL(files[0]) : null,
    };
  } finally {
    await doc.destroy?.();
  }
}

function textFromItems(items: unknown[]) {
  return items
    .map((item) => {
      if (item && typeof item === "object" && "str" in item) {
        return String((item as PdfTextItem).str ?? "");
      }
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function rasterPage(page: PdfPage, maxEdge: number) {
  const base = page.getViewport({ scale: 1 });
  const size = fitLongEdge(base.width, base.height, maxEdge);
  const viewport = page.getViewport({ scale: size.width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new ScanFailure("unreadable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function renderPage(page: PdfPage, maxEdge: number, quality: number) {
  const canvas = await rasterPage(page, maxEdge);
  return canvasToJpeg(canvas, quality);
}

function filesFromCanvases(canvases: HTMLCanvasElement[], quality: number) {
  return Promise.all(
    canvases.map(async (canvas, index) => {
      const blob = await canvasToJpeg(canvas, quality);
      return new File([blob], `page-${index + 1}.jpg`, { type: "image/jpeg" });
    }),
  );
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ScanFailure("unreadable"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function totalSize(files: File[]) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

function jpegName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "page";
  return `${base}.jpg`;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}
