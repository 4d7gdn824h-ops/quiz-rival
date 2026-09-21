"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { STEPS, type Stance } from "@/data/writing-coach";
import { CHLOPI_WRITING_CONFIG, type WritingPromptConfig } from "@/data/writing-config";
import {
  EMPTY_DRAFT,
  readWritingDraft,
  writeWritingDraft,
  type WritingDraft,
} from "@/lib/client/writing-draft";
import { cancelSpeech } from "@/lib/client/speech";
import { countWords, joinEssay } from "@/lib/writing/words";
import { ReadAloudButton } from "./ReadAloudButton";
import { SourceSheet } from "./SourceSheet";

export function WriteCoach() {
  const [config, setConfig] = useState<WritingPromptConfig | null>(CHLOPI_WRITING_CONFIG);
  const [draft, setDraft] = useState<WritingDraft>({ ...EMPTY_DRAFT, packId: "chlopi" });
  const [copied, setCopied] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [hintStep, setHintStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setConfig(CHLOPI_WRITING_CONFIG);
      const saved = readWritingDraft("chlopi");
      if (saved) setDraft(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<WritingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch, packId: "chlopi" };
      writeWritingDraft(next);
      return next;
    });
    setCopied(false);
    setError(null);
  }, []);

  const openSource = useCallback(() => {
    cancelSpeech();
    setShowSource(true);
  }, []);

  const closeSource = useCallback(() => {
    setShowSource(false);
  }, []);

  const assembled = useMemo(
    () => joinEssay([draft.thesis, draft.themeLinks, draft.modernPara, draft.closing]),
    [draft.closing, draft.modernPara, draft.themeLinks, draft.thesis],
  );
  const spokenText = useMemo(
    () => (config ? speechForStep(config, draft, assembled, hintStep) : ""),
    [assembled, config, draft, hintStep],
  );
  const words = countWords(assembled);
  const step = draft.step;
  const stanceMeta = config?.stances.find((item) => item.id === draft.stance);

  function next() {
    if (!config) return;
    const message = validate(config, draft);
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

  if (!config) {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Opening prompt…</p>
      </main>
    );
  }

  return (
    <main lang="pl" className="write-main mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <div className="write-toolbar">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
          {config.kicker}
        </p>
        <button
          type="button"
          className="btn-source"
          onClick={openSource}
          aria-haspopup="dialog"
          aria-expanded={showSource}
          aria-label="Czytaj tekst źródłowy"
        >
          <BookIcon />
          Czytaj
        </button>
      </div>
      <header className="space-y-2">
        <h1 className="font-display text-4xl leading-tight">{config.title}</h1>
        <p className="text-sm text-white/65">{config.blurb}</p>
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

      {step === 0 ? <QuestionStep config={config} /> : null}

      {step === 1 ? (
        <StanceStep
          config={config}
          stance={draft.stance}
          onPick={(stance) => update({ stance })}
          showHint={hintStep === "teza"}
        />
      ) : null}

      {step === 2 ? (
        <ThemeStep
          config={config}
          selected={draft.themes}
          onToggle={(id) =>
            update({
              themes: draft.themes.includes(id)
                ? draft.themes.filter((themeId) => themeId !== id)
                : [...draft.themes, id],
            })
          }
          showHint={hintStep === "watki"}
        />
      ) : null}

      {step === 3 ? (
        <ExampleStep
          config={config}
          value={draft.example}
          onChange={(example) => update({ example })}
          showHint={hintStep === "przyklad"}
        />
      ) : null}

      {step === 4 ? (
        <WriteStep
          config={config}
          draft={draft}
          stanceHint={stanceMeta?.thesisHint ?? config.stances[0].thesisHint}
          words={words}
          assembled={assembled}
          showHint={hintStep === "pisz"}
          onChange={update}
        />
      ) : null}

      {step === 5 ? (
        <FinalStep
          config={config}
          assembled={assembled}
          words={words}
          copied={copied}
          showParent={showParent}
          onCopy={() => void copyEssay()}
          onToggleParent={() => setShowParent((value) => !value)}
        />
      ) : null}

      {step < 5 ? (
        <ReadAloudButton
          text={spokenText}
          lang={config.language === "en" ? "en" : "pl"}
          idleLabel="Na głos"
          className="btn-read w-full"
        />
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

      <SourceSheet
        open={showSource}
        onClose={closeSource}
        source={config.source}
        prompt={config.prompt}
      />
    </main>
  );
}

function hintId(step: number) {
  return STEPS[step]?.id ?? null;
}

function sampleSentence(config: WritingPromptConfig, themeId?: string) {
  const match = config.themes.find((theme) => theme.id === themeId);
  return match?.sampleSentence ?? config.themes[0]?.sampleSentence ?? "";
}

function speechForStep(
  config: WritingPromptConfig,
  draft: WritingDraft,
  assembled: string,
  hintStep: string | null,
): string {
  const showHint = hintStep === hintId(draft.step);
  const parts: string[] = [];

  switch (draft.step) {
    case 0:
      parts.push("Pytanie problemowe.");
      parts.push(config.prompt);
      parts.push(
        `Cel: około 100 słów (${config.targetWordsMin}–${config.targetWordsMax}). Jedna jasna teza plus jeden przykład z dzisiaj.`,
      );
      break;
    case 1:
      parts.push(config.stanceTitle);
      for (const item of config.stances) {
        parts.push(`${item.label}. ${item.tip}`);
      }
      if (showHint && draft.stance) {
        const hint = config.stances.find((item) => item.id === draft.stance)?.thesisHint;
        if (hint) parts.push("Szkic tezy (przerób swoimi słowami).", hint);
      } else if (showHint) {
        parts.push("Najpierw wybierz Tak, Nie albo Częściowo.");
      }
      break;
    case 2:
      parts.push(config.themeTitle);
      parts.push(config.themeBlurb);
      for (const theme of config.themes) {
        parts.push(`${theme.label}. ${theme.hint}`);
      }
      if (showHint) {
        parts.push("Jedno zdanie do przerobienia.", sampleSentence(config, draft.themes[0]));
      }
      break;
    case 3:
      parts.push(config.exampleTitle);
      parts.push(config.exampleBlurb);
      parts.push("Co dzieje się dzisiaj?");
      if (showHint) {
        parts.push("Przykładowe zdanie — zmień konkret (kto? gdzie?).", config.exampleHint);
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
          config.stances.find((item) => item.id === draft.stance)?.thesisHint ??
          config.stances[0].thesisHint;
        parts.push("Szkic tezy.", stanceHint);
        const themeHint = draft.themes.map((id) => sampleSentence(config, id)).join(" ");
        if (themeHint) parts.push("Szkic wątku.", themeHint);
        parts.push("Szkic zakończenia.", config.closingHint);
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

function validate(config: WritingPromptConfig, draft: WritingDraft): string | null {
  if (draft.step === 1 && !draft.stance) return "Wybierz: Tak, Nie albo Częściowo.";
  if (draft.step === 2 && draft.themes.length < 1) {
    return "Zaznacz przynajmniej jeden wątek.";
  }
  if (draft.step === 3 && draft.example.trim().length < 12) {
    return "Wpisz własny przykład (choćby jedno zdanie).";
  }
  if (draft.step === 4) {
    if (countWords(joinEssay([draft.thesis, draft.themeLinks, draft.modernPara, draft.closing])) < 40) {
      return `Dopisz tezę, wątek, przykład i zakończenie — cel to ok. ${config.targetWordsMin}–${config.targetWordsMax} słów.`;
    }
  }
  return null;
}

function QuestionStep({ config }: { config: WritingPromptConfig }) {
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-2xl">Pytanie problemowe</h2>
      <p className="text-[1.05rem] leading-relaxed text-white/90">{config.prompt}</p>
      <p className="text-sm text-white/55">
        Cel: około 100 słów ({config.targetWordsMin}–{config.targetWordsMax}). Jedna jasna teza + jeden
        przykład z dzisiaj.
      </p>
    </section>
  );
}

function StanceStep({
  config,
  stance,
  onPick,
  showHint,
}: {
  config: WritingPromptConfig;
  stance: Stance | null;
  onPick: (stance: Stance) => void;
  showHint: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{config.stanceTitle}</h2>
      <fieldset className="grid gap-2">
        <legend className="sr-only">{config.stanceLegend}</legend>
        {config.stances.map((item) => (
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
          text={config.stances.find((item) => item.id === stance)?.thesisHint ?? ""}
        />
      ) : null}
      {showHint && !stance ? (
        <p className="text-sm text-white/50">Najpierw wybierz Tak / Nie / Częściowo.</p>
      ) : null}
    </section>
  );
}

function ThemeStep({
  config,
  selected,
  onToggle,
  showHint,
}: {
  config: WritingPromptConfig;
  selected: string[];
  onToggle: (id: string) => void;
  showHint: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{config.themeTitle}</h2>
      <p className="text-sm text-white/65">{config.themeBlurb}</p>
      <fieldset className="grid gap-2">
        <legend className="sr-only">Wątki</legend>
        {config.themes.map((theme) => (
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
          text={sampleSentence(config, selected[0])}
        />
      ) : null}
    </section>
  );
}

function ExampleStep({
  config,
  value,
  onChange,
  showHint,
}: {
  config: WritingPromptConfig;
  value: string;
  onChange: (value: string) => void;
  showHint: boolean;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-2xl">{config.exampleTitle}</h2>
      <p className="text-sm text-white/65">{config.exampleBlurb}</p>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Co dzieje się dzisiaj?</span>
        <textarea
          className="field min-h-36 leading-relaxed"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={config.examplePlaceholder}
        />
      </label>
      {showHint ? (
        <HintBox label="Przykładowe zdanie — zmień konkret (kto? gdzie?)" text={config.exampleHint} />
      ) : null}
    </section>
  );
}

function WriteStep({
  config,
  draft,
  stanceHint,
  words,
  assembled,
  showHint,
  onChange,
}: {
  config: WritingPromptConfig;
  draft: WritingDraft;
  stanceHint: string;
  words: number;
  assembled: string;
  showHint: boolean;
  onChange: (patch: Partial<WritingDraft>) => void;
}) {
  const themeHint = draft.themes.map((id) => sampleSentence(config, id)).join(" ");
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl">Składaj po zdaniach</h2>
        <WordBadge words={words} min={config.targetWordsMin} max={config.targetWordsMax} />
      </div>
      <p className="text-sm text-white/65">
        Cztery krótkie pola. Na końcu złożą się w jedną wypowiedź.
        {draft.example
          ? " Przykład z poprzedniego kroku możesz rozwinąć w polu 3 — nic nie wstawiamy za Ciebie."
          : ""}
      </p>
      {draft.stance || draft.themes.length ? (
        <p className="text-xs text-white/50">
          Twoje wybory: {stanceLabel(config, draft.stance)}
          {draft.themes.length
            ? ` · ${draft.themes
                .map((id) => config.themes.find((theme) => theme.id === id)?.label)
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
          placeholder="Twoja teza — własnymi słowami."
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">{config.themeLinkLabel}</span>
        <textarea
          className="field min-h-24"
          value={draft.themeLinks}
          onChange={(e) => onChange({ themeLinks: e.target.value })}
          placeholder={config.themeLinkPlaceholder}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">3. Przykład współczesny</span>
        <textarea
          className="field min-h-24"
          value={draft.modernPara}
          onChange={(e) => onChange({ modernPara: e.target.value })}
          placeholder={draft.example || config.examplePlaceholder}
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
          <HintBox label="Szkic zakończenia" text={config.closingHint} />
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
  config,
  assembled,
  words,
  copied,
  showParent,
  onCopy,
  onToggleParent,
}: {
  config: WritingPromptConfig;
  assembled: string;
  words: number;
  copied: boolean;
  showParent: boolean;
  onCopy: () => void;
  onToggleParent: () => void;
}) {
  const inRange = words >= config.targetWordsMin && words <= config.targetWordsMax;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl">Twoja wypowiedź</h2>
        <WordBadge words={words} min={config.targetWordsMin} max={config.targetWordsMax} />
      </div>
      <p className="text-sm text-white/65">
        {inRange
          ? "Długość w celu szkolnym. Przeczytaj na głos i popraw swoje zdania."
          : words < config.targetWordsMin
            ? "Trochę krótko — wróć i dopisz przykład albo zakończenie."
            : "Trochę długo — skróć powtórzenia. Na kartę wystarczy ok. 100 słów."}
      </p>
      <ReadAloudButton
        text={assembled || "Brak tekstu — wróć do kroku Pisz."}
        lang={config.language === "en" ? "en" : "pl"}
        idleLabel="Na głos"
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
            {config.parentNotesEn.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}

function stanceLabel(config: WritingPromptConfig, stance: WritingDraft["stance"]) {
  return config.stances.find((item) => item.id === stance)?.label ?? "";
}

function HintBox({ label, text }: { label: string; text: string }) {
  return (
    <aside className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-white/85">{text}</p>
    </aside>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16A2.5 2.5 0 0 1 6.5 19H20" />
    </svg>
  );
}

function WordBadge({ words, min, max }: { words: number; min: number; max: number }) {
  const ok = words >= min && words <= max;
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
