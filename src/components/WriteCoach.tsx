"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLOSING_HINT,
  EXAMPLE_HINT,
  EXAMPLE_PLACEHOLDER,
  ESSAY_PROMPT,
  PARENT_NOTES_EN,
  STANCES,
  STEPS,
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  THEME_SENTENCES,
  THEMES,
  type Stance,
  type ThemeOption,
} from "@/data/writing-coach";
import {
  EMPTY_DRAFT,
  readWritingDraft,
  writeWritingDraft,
  type WritingDraft,
} from "@/lib/client/writing-draft";
import { countWords, joinEssay } from "@/lib/writing/words";
import { ReadAloudButton } from "./ReadAloudButton";

export function WriteCoach() {
  const [draft, setDraft] = useState<WritingDraft>(EMPTY_DRAFT);
  const [copied, setCopied] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [hintStep, setHintStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      const saved = readWritingDraft();
      if (!cancelled && saved) setDraft(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<WritingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      writeWritingDraft(next);
      return next;
    });
    setCopied(false);
    setError(null);
  }, []);

  const assembled = useMemo(
    () => joinEssay([draft.thesis, draft.themeLinks, draft.modernPara, draft.closing]),
    [draft.closing, draft.modernPara, draft.themeLinks, draft.thesis],
  );
  const spokenText = useMemo(
    () => speechForStep(draft, assembled, hintStep),
    [assembled, draft, hintStep],
  );
  const words = countWords(assembled);
  const step = draft.step;
  const stanceMeta = STANCES.find((item) => item.id === draft.stance);

  function next() {
    const message = validate(draft);
    if (message) {
      setError(message);
      return;
    }
    setHintStep(null);
    update({ step: Math.min(step + 1, STEPS.length - 1) });
  }

  function back() {
    setHintStep(null);
    setError(null);
    update({ step: Math.max(step - 1, 0) });
  }

  async function copyEssay() {
    try {
      await navigator.clipboard.writeText(assembled);
      setCopied(true);
    } catch {
      setError("Nie udało się skopiować — zaznacz tekst ręcznie.");
    }
  }

  return (
    <main lang="pl" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
          Klasa 8 · do 26 września
        </p>
        <h1 className="font-display text-4xl leading-tight">Napisz wypracowanie</h1>
        <p className="text-sm text-white/65">
          Pytanie problemowe · ok. 100 słów. Składasz tekst sama — to nie jest gotowa praca.
        </p>
      </header>

      <ol className="grid grid-cols-6 gap-1" aria-label="Postęp">
        {STEPS.map((item, index) => (
          <li key={item.id}>
            <span
              className={`block rounded-full py-2 text-center text-[10px] font-semibold ${
                index === step
                  ? "bg-lime-300 text-black"
                  : index < step
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-white/40"
              }`}
            >
              {index + 1}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-center text-sm text-white/55">
        Krok {step + 1} z {STEPS.length}: {STEPS[step].title}
      </p>

      {step === 0 ? <QuestionStep /> : null}

      {step === 1 ? (
        <StanceStep
          stance={draft.stance}
          onPick={(stance) => update({ stance })}
          showHint={hintStep === "teza"}
        />
      ) : null}

      {step === 2 ? (
        <ThemeStep
          selected={draft.themes}
          onToggle={(id) =>
            update({
              themes: draft.themes.includes(id)
                ? draft.themes.filter((t) => t !== id)
                : [...draft.themes, id],
            })
          }
          showHint={hintStep === "watki"}
        />
      ) : null}

      {step === 3 ? (
        <ExampleStep
          value={draft.example}
          onChange={(example) => update({ example })}
          showHint={hintStep === "przyklad"}
        />
      ) : null}

      {step === 4 ? (
        <WriteStep
          draft={draft}
          stanceHint={stanceMeta?.thesisHint ?? STANCES[0].thesisHint}
          words={words}
          assembled={assembled}
          showHint={hintStep === "pisz"}
          onChange={update}
        />
      ) : null}

      {step === 5 ? (
        <FinalStep
          assembled={assembled}
          words={words}
          copied={copied}
          showParent={showParent}
          onCopy={() => void copyEssay()}
          onToggleParent={() => setShowParent((v) => !v)}
        />
      ) : null}

      {step < 5 ? (
        <ReadAloudButton text={spokenText} lang="pl" idleLabel="Czytaj" className="btn-read w-full" />
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-orange-400/15 px-4 py-3 text-sm text-orange-100" role="alert">
          {error}
        </p>
      ) : null}

      {step > 0 && step < 5 ? (
        <button
          type="button"
          className="text-center text-sm text-white/55 underline underline-offset-4"
          onClick={() => setHintStep((current) => (current ? null : hintId(step)))}
        >
          {hintStep ? "Ukryj podpowiedź" : "Podpowiedź"}
        </button>
      ) : null}

      <div className="mt-auto grid grid-cols-2 gap-3 pb-4">
        {step > 0 ? (
          <button type="button" className="btn-secondary" onClick={back}>
            Wstecz
          </button>
        ) : (
          <Link className="btn-secondary flex items-center justify-center" href="/">
            Home
          </Link>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>
            Dalej
          </button>
        ) : (
          <Link className="btn-primary flex items-center justify-center" href="/">
            Gotowe
          </Link>
        )}
      </div>
    </main>
  );
}

function hintId(step: number) {
  return STEPS[step]?.id ?? null;
}

/** Spoken copy for the current step: visible prompt, revealed tips, or the final essay. */
function speechForStep(draft: WritingDraft, assembled: string, hintStep: string | null): string {
  const showHint = hintStep === hintId(draft.step);
  const parts: string[] = [];

  switch (draft.step) {
    case 0:
      parts.push("Pytanie problemowe.");
      parts.push(ESSAY_PROMPT);
      parts.push(
        `Cel: około 100 słów (${TARGET_WORDS_MIN}–${TARGET_WORDS_MAX}). Jedna jasna teza plus jeden przykład z dzisiaj.`,
      );
      break;
    case 1:
      parts.push("Czy to nadal aktualne?");
      for (const item of STANCES) {
        parts.push(`${item.label}. ${item.tip}`);
      }
      if (showHint && draft.stance) {
        const hint = STANCES.find((item) => item.id === draft.stance)?.thesisHint;
        if (hint) parts.push("Szkic tezy (przerób swoimi słowami).", hint);
      } else if (showHint) {
        parts.push("Najpierw wybierz Tak, Nie albo Częściowo.");
      }
      break;
    case 2:
      parts.push("Wątki z lektury.");
      parts.push("Zaznacz 1–3. Potem powiążesz je z dzisiejszym przykładem.");
      for (const theme of THEMES) {
        parts.push(`${theme.label}. ${theme.hint}`);
      }
      if (showHint) {
        const id = draft.themes[0] ?? "presja";
        parts.push("Jedno zdanie do przerobienia.", THEME_SENTENCES[id]);
      }
      break;
    case 3:
      parts.push("Twój przykład ze współczesności.");
      parts.push("Napisz sama. Nie wklejamy tu gotowego akapitu.");
      parts.push("Co dzieje się dzisiaj?");
      if (showHint) {
        parts.push("Przykładowe zdanie — zmień konkret (kto? gdzie?).", EXAMPLE_HINT);
      }
      break;
    case 4: {
      parts.push("Składaj po zdaniach.");
      parts.push("Cztery krótkie pola. Na końcu złożą się w jedną wypowiedź.");
      if (draft.example) {
        parts.push(
          "Przykład z poprzedniego kroku możesz rozwinąć w polu 3 — nic nie wstawiamy za Ciebie.",
        );
      }
      if (showHint) {
        const stanceHint =
          STANCES.find((item) => item.id === draft.stance)?.thesisHint ?? STANCES[0].thesisHint;
        parts.push("Szkic tezy.", stanceHint);
        const themeHint = draft.themes.map((id) => THEME_SENTENCES[id]).join(" ");
        if (themeHint) parts.push("Szkic wątku.", themeHint);
        parts.push("Szkic zakończenia.", CLOSING_HINT);
      }
      break;
    }
    case 5:
      parts.push(assembled || "Brak tekstu — wróć do kroku Pisz.");
      break;
    default:
      break;
  }

  return parts.join(" ");
}

function validate(draft: WritingDraft): string | null {
  if (draft.step === 1 && !draft.stance) return "Wybierz: Tak, Nie albo Częściowo.";
  if (draft.step === 2 && draft.themes.length < 1) {
    return "Zaznacz przynajmniej jeden wątek z lektury.";
  }
  if (draft.step === 3 && draft.example.trim().length < 12) {
    return "Wpisz własny przykład ze współczesności (choćby jedno zdanie).";
  }
  if (draft.step === 4) {
    if (countWords(joinEssay([draft.thesis, draft.themeLinks, draft.modernPara, draft.closing])) < 40) {
      return "Dopisz tezę, wątek, przykład i zakończenie — cel to ok. 100 słów.";
    }
  }
  return null;
}

function QuestionStep() {
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-2xl">Pytanie problemowe</h2>
      <p className="text-[1.05rem] leading-relaxed text-white/90">{ESSAY_PROMPT}</p>
      <p className="text-sm text-white/55">
        Cel: około 100 słów ({TARGET_WORDS_MIN}–{TARGET_WORDS_MAX}). Jedna jasna teza + jeden
        przykład z dzisiaj.
      </p>
    </section>
  );
}

function StanceStep({
  stance,
  onPick,
  showHint,
}: {
  stance: Stance | null;
  onPick: (stance: Stance) => void;
  showHint: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">Czy to nadal aktualne?</h2>
      <fieldset className="grid gap-2">
        <legend className="sr-only">Czy problematyka „Chłopów” jest aktualna?</legend>
        {STANCES.map((item) => (
          <label key={item.id} className={`choice ${stance === item.id ? "choice-on" : ""}`}>
            <input
              type="radio"
              className="sr-only"
              name="stance"
              value={item.id}
              checked={stance === item.id}
              onChange={() => onPick(item.id)}
            />
            <span className="font-display text-xl">{item.label}</span>
            <span className="mt-1 block text-sm text-white/65">{item.tip}</span>
          </label>
        ))}
      </fieldset>
      {showHint && stance ? (
        <HintBox
          label="Szkic tezy (przerób swoimi słowami)"
          text={STANCES.find((item) => item.id === stance)?.thesisHint ?? ""}
        />
      ) : null}
      {showHint && !stance ? (
        <p className="text-sm text-white/50">Najpierw wybierz Tak / Nie / Częściowo.</p>
      ) : null}
    </section>
  );
}

function ThemeStep({
  selected,
  onToggle,
  showHint,
}: {
  selected: ThemeOption["id"][];
  onToggle: (id: ThemeOption["id"]) => void;
  showHint: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">Wątki z lektury</h2>
      <p className="text-sm text-white/65">Zaznacz 1–3. Potem powiążesz je z dzisiejszym przykładem.</p>
      <fieldset className="grid gap-2">
        <legend className="sr-only">Wątki</legend>
        {THEMES.map((theme) => (
          <label
            key={theme.id}
            className={`choice ${selected.includes(theme.id) ? "choice-on" : ""}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected.includes(theme.id)}
              onChange={() => onToggle(theme.id)}
            />
            <span className="block font-semibold">{theme.label}</span>
            <span className="block text-sm text-white/60">{theme.hint}</span>
          </label>
        ))}
      </fieldset>
      {showHint ? (
        <HintBox
          label="Jedno zdanie do przerobienia"
          text={
            selected.length
              ? THEME_SENTENCES[selected[0]]
              : THEME_SENTENCES.presja
          }
        />
      ) : null}
    </section>
  );
}

function ExampleStep({
  value,
  onChange,
  showHint,
}: {
  value: string;
  onChange: (value: string) => void;
  showHint: boolean;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-2xl">Twój przykład ze współczesności</h2>
      <p className="text-sm text-white/65">
        Napisz sama. Nie wklejamy tu gotowego akapitu.
      </p>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Co dzieje się dzisiaj?</span>
        <textarea
          className="field min-h-36 leading-relaxed"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={EXAMPLE_PLACEHOLDER}
        />
      </label>
      {showHint ? (
        <HintBox label="Przykładowe zdanie — zmień konkret (kto? gdzie?)" text={EXAMPLE_HINT} />
      ) : null}
    </section>
  );
}

function WriteStep({
  draft,
  stanceHint,
  words,
  assembled,
  showHint,
  onChange,
}: {
  draft: WritingDraft;
  stanceHint: string;
  words: number;
  assembled: string;
  showHint: boolean;
  onChange: (patch: Partial<WritingDraft>) => void;
}) {
  const themeHint = draft.themes.map((id) => THEME_SENTENCES[id]).join(" ");
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl">Składaj po zdaniach</h2>
        <WordBadge words={words} />
      </div>
      <p className="text-sm text-white/65">
        Cztery krótkie pola. Na końcu złożą się w jedną wypowiedź.
        {draft.example
          ? " Przykład z poprzedniego kroku możesz rozwinąć w polu 3 — nic nie wstawiamy za Ciebie."
          : ""}
      </p>
      {draft.stance || draft.themes.length ? (
        <p className="text-xs text-white/50">
          Twoje wybory: {stanceLabel(draft.stance)}
          {draft.themes.length
            ? ` · ${draft.themes
                .map((id) => THEMES.find((t) => t.id === id)?.label)
                .filter(Boolean)
                .join(" · ")}`
            : ""}
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">1. Teza</span>
        <textarea
          className="field min-h-24"
          value={draft.thesis}
          onChange={(e) => onChange({ thesis: e.target.value })}
          placeholder="Czy problematyka jest aktualna? Dlaczego?"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">2. Nawiązanie do „Chłopów”</span>
        <textarea
          className="field min-h-24"
          value={draft.themeLinks}
          onChange={(e) => onChange({ themeLinks: e.target.value })}
          placeholder="Jagna / wykluczenie / Boryna i Antek…"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">3. Przykład współczesny</span>
        <textarea
          className="field min-h-24"
          value={draft.modernPara}
          onChange={(e) => onChange({ modernPara: e.target.value })}
          placeholder={draft.example || EXAMPLE_PLACEHOLDER}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">4. Zakończenie</span>
        <textarea
          className="field min-h-24"
          value={draft.closing}
          onChange={(e) => onChange({ closing: e.target.value })}
          placeholder="Jedno zdanie z wnioskiem."
        />
      </label>
      {showHint ? (
        <div className="space-y-2">
          <HintBox label="Szkic tezy" text={stanceHint} />
          {themeHint ? <HintBox label="Szkic wątku" text={themeHint} /> : null}
          <HintBox label="Szkic zakończenia" text={CLOSING_HINT} />
        </div>
      ) : null}
      {assembled ? (
        <p className="rounded-2xl bg-black/25 px-3 py-2 text-xs text-white/45">
          Podgląd: {assembled.slice(0, 160)}
          {assembled.length > 160 ? "…" : ""}
        </p>
      ) : null}
    </section>
  );
}

function FinalStep({
  assembled,
  words,
  copied,
  showParent,
  onCopy,
  onToggleParent,
}: {
  assembled: string;
  words: number;
  copied: boolean;
  showParent: boolean;
  onCopy: () => void;
  onToggleParent: () => void;
}) {
  const inRange = words >= TARGET_WORDS_MIN && words <= TARGET_WORDS_MAX;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl">Twoja wypowiedź</h2>
        <WordBadge words={words} />
      </div>
      <p className="text-sm text-white/65">
        {inRange
          ? "Długość w celu szkolnym. Przeczytaj na głos i popraw swoje zdania."
          : words < TARGET_WORDS_MIN
            ? "Trochę krótko — wróć i dopisz przykład albo zakończenie."
            : "Trochę długo — skróć powtórzenia. Na kartę wystarczy ok. 100 słów."}
      </p>
      <ReadAloudButton
        text={assembled || "Brak tekstu — wróć do kroku Pisz."}
        lang="pl"
        idleLabel="Czytaj"
        className="btn-read w-full"
      />
      <article className="card text-[1.05rem] leading-relaxed whitespace-pre-wrap">
        {assembled || "Brak tekstu — wróć do kroku Pisz."}
      </article>
      <button type="button" className="btn-primary" onClick={onCopy} disabled={!assembled}>
        {copied ? "Skopiowano" : "Kopiuj"}
      </button>
      <button type="button" className="btn-secondary" onClick={onToggleParent}>
        {showParent ? "Ukryj wskazówki dla rodzica (EN)" : "Pokaż wskazówki dla rodzica (EN)"}
      </button>
      {showParent ? (
        <aside className="card space-y-2 text-sm text-lime-100">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Parent only · English</p>
          <ul className="list-disc space-y-2 pl-4">
            {PARENT_NOTES_EN.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}

function stanceLabel(stance: WritingDraft["stance"]) {
  return STANCES.find((item) => item.id === stance)?.label ?? "";
}

function HintBox({ label, text }: { label: string; text: string }) {
  return (
    <aside className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-white/85">{text}</p>
    </aside>
  );
}

function WordBadge({ words }: { words: number }) {
  const ok = words >= TARGET_WORDS_MIN && words <= TARGET_WORDS_MAX;
  return (
    <p
      className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
        ok ? "bg-lime-300 text-black" : "bg-white/10 text-white"
      }`}
      aria-live="polite"
    >
      {words} słów
    </p>
  );
}
