"use client";

import { useEffect, useId, useRef } from "react";
import type { WritingSource } from "@/data/writing-config";

type Props = {
  open: boolean;
  onClose: () => void;
  source: WritingSource;
  prompt: string;
  labels?: {
    close: string;
    prompt: string;
    facts: string;
    sections: string;
    use: string;
  };
};

export function SourceSheet({ open, onClose, source, prompt, labels }: Props) {
  const closeLabel = labels?.close ?? "Zamknij";
  const promptLabel = labels?.prompt ?? "Pytanie problemowe";
  const factsLabel = labels?.facts ?? "Lektura w skrócie";
  const sectionsLabel = labels?.sections ?? "Wątki";
  const useLabel = labels?.use ?? "Jak korzystać";
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="source-backdrop" onClick={onClose}>
      <div
        className="source-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="source-sheet-handle" aria-hidden="true" />
        <div className="source-sheet-body">
          <div className="flex items-start justify-between gap-3">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
                {source.kicker}
              </p>
              <h2 id={titleId} className="font-display text-3xl leading-tight">
                {source.title}
              </h2>
              <p className="text-sm text-white/60">{source.byline}</p>
            </header>
            <button
              ref={closeRef}
              type="button"
              className="shrink-0 pt-1 text-sm font-semibold text-white/70 underline underline-offset-4"
              onClick={onClose}
            >
              {closeLabel}
            </button>
          </div>

          <p className="text-sm leading-relaxed text-white/75">{source.intro}</p>

          <section className="card space-y-2">
            <h3 className="text-sm font-semibold text-white/55">{promptLabel}</h3>
            <p className="text-[1.02rem] leading-relaxed text-white/90">{prompt}</p>
          </section>

          {source.facts.length ? (
            <section className="space-y-2">
              <h3 className="font-display text-xl">{factsLabel}</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/80">
                {source.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {source.sections.length ? (
            <section className="space-y-3">
              <h3 className="font-display text-xl">{sectionsLabel}</h3>
              {source.sections.map((section) => (
                <article key={section.id} className="card space-y-1.5">
                  <h4 className="font-semibold text-lime-200">{section.title}</h4>
                  <p className="text-sm leading-relaxed text-white/80">{section.body}</p>
                </article>
              ))}
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="font-display text-xl">{useLabel}</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/70">
              {source.use.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
        <div className="source-sheet-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
