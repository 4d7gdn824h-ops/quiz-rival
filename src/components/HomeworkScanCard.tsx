"use client";

import { useRef, useState } from "react";
import { HOMEWORK_FIXTURES } from "@/data/fixtures/catalog";

export function HomeworkScanCard({
  busy,
  onFile,
  onDemo,
  onPasteDemo,
}: {
  busy: boolean;
  onFile: (file: File) => void;
  onDemo: (fixtureId: string) => void;
  onPasteDemo?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  function take(file: File | undefined) {
    if (!file || busy) return;
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
          Photo or PDF. We pull topics so they can practice — we do not write the answers.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.svg,.txt"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          take(event.target.files?.[0]);
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
          take(event.dataTransfer.files?.[0]);
        }}
      >
        {busy ? (
          <span className="font-display text-2xl">Reading…</span>
        ) : (
          <>
            <span className="font-display text-xl">Photo / PDF</span>
            <span className="mt-1 block text-sm text-white/55">
              Drop a page here, or tap to choose
            </span>
          </>
        )}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          Camera
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !onPasteDemo}
          onClick={() => onPasteDemo?.()}
        >
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

      {filename && !busy ? (
        <p className="text-xs text-white/45">Selected: {filename}</p>
      ) : (
        <p className="text-xs text-white/45">
          Photos go to Grok only when XAI_API_KEY is set. Without it, paste the page or pick a
          demo — a photo is not treated as Chłopi.
        </p>
      )}
    </section>
  );
}
