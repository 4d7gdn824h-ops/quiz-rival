"use client";

import { useRef, useState } from "react";

export function HomeworkScanCard({
  busy,
  onFile,
  onDemo,
}: {
  busy: boolean;
  onFile: (file: File) => void;
  onDemo: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    setFilename(file.name);
    onFile(file);
  }

  return (
    <section className="card space-y-3">
      <div className="space-y-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-orange-300">
          Tonight’s homework
        </p>
        <h2 className="font-display text-2xl leading-tight">Scan a worksheet</h2>
        <p className="text-sm text-white/60">
          Photo or PDF. We pull topics and facts so they can practice — we do not write the
          answers for them.
        </p>
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => photoRef.current?.click()}
        >
          Camera
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Photo / PDF
        </button>
      </div>
      <button type="button" className="btn-primary" disabled={busy} onClick={onDemo}>
        {busy ? "Reading…" : "Use demo worksheet"}
      </button>
      {filename ? (
        <p className="text-xs text-white/45">Selected: {filename}</p>
      ) : (
        <p className="text-xs text-white/45">
          Demo uses <code className="text-white/70">/fixtures/chlopi-worksheet.svg</code> (no API
          key needed).
        </p>
      )}
    </section>
  );
}
