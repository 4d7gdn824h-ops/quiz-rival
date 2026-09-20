"use client";

import { useEffect, useId, useRef } from "react";
import {
  SOURCE_BYLINE,
  SOURCE_FACTS,
  SOURCE_INTRO,
  SOURCE_KICKER,
  SOURCE_PROMPT,
  SOURCE_SECTIONS,
  SOURCE_TITLE,
  SOURCE_USE,
} from "@/data/chlopi-source";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChlopiSourceSheet({ open, onClose }: Props) {
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
        <div className="flex items-start justify-between gap-3">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
              {SOURCE_KICKER}
            </p>
            <h2 id={titleId} className="font-display text-3xl leading-tight">
              {SOURCE_TITLE}
            </h2>
            <p className="text-sm text-white/60">{SOURCE_BYLINE}</p>
          </header>
          <button
            ref={closeRef}
            type="button"
            className="shrink-0 pt-1 text-sm font-semibold text-white/70 underline underline-offset-4"
            onClick={onClose}
          >
            Zamknij
          </button>
        </div>

        <p className="text-sm leading-relaxed text-white/75">{SOURCE_INTRO}</p>

        <section className="card space-y-2">
          <h3 className="text-sm font-semibold text-white/55">Pytanie problemowe</h3>
          <p className="text-[1.02rem] leading-relaxed text-white/90">{SOURCE_PROMPT}</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-xl">Lektura w skrócie</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/80">
            {SOURCE_FACTS.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="font-display text-xl">Wątki z powieści</h3>
          {SOURCE_SECTIONS.map((section) => (
            <article key={section.id} className="card space-y-1.5">
              <h4 className="font-semibold text-lime-200">{section.title}</h4>
              <p className="text-sm leading-relaxed text-white/80">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-xl">Jak korzystać</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/70">
            {SOURCE_USE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div className="source-sheet-actions">
          <button ref={closeRef} type="button" className="btn-primary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
