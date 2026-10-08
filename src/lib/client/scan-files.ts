import {
  admitPages,
  fitLongEdge,
  isAcceptedScanFile,
  JSON_BODY_BUDGET,
  LONG_EDGE,
  SCALE_LADDER,
  ScanFailure,
  scanJsonBytes,
} from "./scan-prep";

export interface TrayPage {
  id: string;
  thumbUrl: string;
  label: string;
  canvas: HTMLCanvasElement;
}

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
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

let pageSerial = 0;

export async function addFilesToTray(
  existingCount: number,
  files: File[],
  hooks: { signal?: AbortSignal } = {},
): Promise<{ pages: TrayPage[]; message: string | null; truncated: boolean }> {
  throwIfAborted(hooks.signal);
  const described: { file: File; kind: "image" | "pdf"; pageCount: number }[] = [];
  for (const file of files) {
    throwIfAborted(hooks.signal);
    const kind = isAcceptedScanFile(file);
    if (!kind) throw new ScanFailure("file_type");
    if (kind === "pdf") {
      described.push({ file, kind, pageCount: await pdfPageCount(file) });
    } else {
      described.push({ file, kind, pageCount: 1 });
    }
  }

  const admission = admitPages(
    existingCount,
    described.map((item) => ({ kind: item.kind, pageCount: item.pageCount })),
  );

  const pages: TrayPage[] = [];
  for (let index = 0; index < described.length; index += 1) {
    throwIfAborted(hooks.signal);
    const decision = admission.files[index];
    const item = described[index];
    if (!decision || decision.rejected || decision.take < 1 || !item) continue;
    if (item.kind === "pdf") {
      pages.push(...(await rasterPdf(item.file, decision.take, hooks.signal)));
    } else {
      pages.push(await rasterImage(item.file));
    }
  }

  return { pages, message: admission.message, truncated: admission.truncated };
}

export async function encodeTrayForJson(pages: TrayPage[]) {
  for (const step of SCALE_LADDER) {
    const encoded: { mime: string; data: string }[] = [];
    const sizes: number[] = [];
    for (const page of pages) {
      const blob = await canvasToJpeg(scaleCanvas(page.canvas, step.longEdge), step.quality);
      sizes.push(blob.size);
      encoded.push({ mime: "image/jpeg", data: await blobToBase64(blob) });
    }
    const jsonBytes = new TextEncoder().encode(JSON.stringify({ pages: encoded })).length;
    if (jsonBytes <= JSON_BODY_BUDGET && scanJsonBytes(sizes) <= JSON_BODY_BUDGET) {
      return { pages: encoded, jsonBytes };
    }
  }
  throw new ScanFailure("body_too_large");
}

async function pdfPageCount(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = (await pdfjs.getDocument({ data, useSystemFonts: true }).promise) as unknown as PdfDoc;
  try {
    return doc.numPages;
  } finally {
    await doc.destroy?.();
  }
}

async function rasterPdf(file: File, take: number, signal?: AbortSignal) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = (await pdfjs.getDocument({ data, useSystemFonts: true }).promise) as unknown as PdfDoc;
  try {
    const pages: TrayPage[] = [];
    const limit = Math.min(doc.numPages, take);
    for (let index = 1; index <= limit; index += 1) {
      throwIfAborted(signal);
      const page = await doc.getPage(index);
      const canvas = await rasterPage(page, LONG_EDGE);
      pages.push(trayPage(canvas, `Page ${index}`));
    }
    return pages;
  } finally {
    await doc.destroy?.();
  }
}

async function rasterImage(file: File) {
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
    return trayPage(canvas, file.name);
  } finally {
    bitmap.close();
  }
}

function trayPage(canvas: HTMLCanvasElement, label: string): TrayPage {
  pageSerial += 1;
  const thumb = scaleCanvas(canvas, 360);
  return {
    id: `page-${pageSerial}`,
    thumbUrl: thumb.toDataURL("image/jpeg", 0.7),
    label,
    canvas,
  };
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

function scaleCanvas(source: HTMLCanvasElement, maxEdge: number) {
  const size = fitLongEdge(source.width, source.height, maxEdge);
  if (size.width === source.width && size.height === source.height) return source;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new ScanFailure("unreadable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
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

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new ScanFailure("unreadable"));
    reader.readAsDataURL(blob);
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}
