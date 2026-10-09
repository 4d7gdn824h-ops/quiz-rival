"use client";

import { useRef, useState } from "react";
import { HOMEWORK_FIXTURES } from "@/data/fixtures/catalog";
import { LONG_PDF_NOTE, MAX_SCAN_PAGES } from "@/lib/client/scan-prep";
import { scanPageCountLabel } from "@/lib/copy";

export interface ScanThumb {
  id: string;
  thumbUrl: string;
}

export function HomeworkScanCard({
  busy,
  pages,
  capMessage,
  truncated,
  onFiles,
  onRemove,
  onStart,
  onDemo,
  onPaste,
}: {
  busy: boolean;
  pages: ScanThumb[];
  capMessage: string | null;
  truncated: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  onDemo: (fixtureId: string) => void;
  onPaste: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function take(list: FileList | File[] | null | undefined) {
    if (busy) return;
    const files = Array.from(list ?? []);
    if (!files.length) return;
    onFiles(files);
  }

  return (
    <section className="card space-y-3" data-testid="scan-card">
      <div className="space-y-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-orange-300">
          Tonight’s homework
        </p>
        <h2 className="font-display text-2xl leading-tight">Scan a worksheet</h2>
        <p className="text-sm text-white/60">
          Add up to {MAX_SCAN_PAGES} photos or PDF pages. We build the quiz from those pages.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf"
        data-testid="scan-file"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        data-testid="scan-camera"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        className={`scan-drop ${over ? "is-over" : ""} ${busy ? "is-reading" : ""}`}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
      >
        {busy ? (
          <span className="font-display text-2xl">Reading…</span>
        ) : (
          <>
            <span className="font-display text-xl">Photos / PDF</span>
            <span className="mt-1 block text-sm text-white/55">
              Drop pages here, or tap to choose several
            </span>
          </>
        )}
      </button>

      {pages.length ? (
        <div className="space-y-2">
          <p data-testid="page-count" className="text-sm text-white/80">
            {scanPageCountLabel(pages.length, MAX_SCAN_PAGES)}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {pages.map((page, index) => (
              <li key={page.id} className="relative" data-testid="page-thumb">
                {/* Local canvas previews; next/image cannot optimize them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.thumbUrl}
                  alt={`Page ${index + 1}`}
                  className="h-24 w-full rounded-xl bg-white/5 object-contain"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-sm font-bold text-white"
                  aria-label={`Remove page ${index + 1}`}
                  data-testid="remove-page"
                  disabled={busy}
                  onClick={() => onRemove(page.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {capMessage ? (
        <p data-testid="page-cap" className="text-sm text-orange-100" role="status">
          {capMessage}
        </p>
      ) : null}
      {truncated ? (
        <p data-testid="page-limit" className="text-sm text-white/70">
          {LONG_PDF_NOTE}
        </p>
      ) : null}

      {pages.length ? (
        <button
          type="button"
          className="btn-primary"
          data-testid="make-quiz"
          disabled={busy}
          onClick={onStart}
        >
          Make the quiz
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          Camera
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onPaste}>
          Paste lines
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Demo worksheets</p>
        <div className="flex flex-wrap gap-2">
          {HOMEWORK_FIXTURES.map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white/80 disabled:opacity-50"
              disabled={busy}
              onClick={() => onDemo(fixture.id)}
            >
              {fixture.title}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
