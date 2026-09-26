"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { STEPS, type Stance } from "@/data/writing-coach";
import { CHLOPI_WRITING_CONFIG, type WritingPromptConfig } from "@/data/writing-config";
import {
  EMPTY_DRAFT,
  readWritingDraft,
  writeWritingDraft,
  type WritingDraft,
} from "@/lib/client/writing-draft";
import {
  extractHomeworkRequest,
  fetchPublicPack,
  planWritingRequest,
} from "@/lib/client/api";
import { cancelSpeech } from "@/lib/client/speech";
import { countWords, joinEssay } from "@/lib/writing/words";
import { fillTemplate, resolveCoachUi, type CoachUi } from "@/lib/writing/chrome";
import { AiStatusBanner } from "./AiStatusBanner";
import { ReadAloudButton } from "./ReadAloudButton";
import { SourceSheet } from "./SourceSheet";

const GRADES = [
  { id: "3", label: "Grades 1–3" },
  { id: "5", label: "Grades 4–6" },
  { id: "8", label: "Grades 7–9" },
  { id: "11", label: "Grades 10–12" },
];

export function WriteCoach({
  initialPackId,
  initialPreset,
}: {
  initialPackId?: string;
  initialPreset?: string;
}) {
  const [phase, setPhase] = useState<"setup" | "coach">("setup");
  const [config, setConfig] = useState<WritingPromptConfig | null>(null);
  const [draft, setDraft] = useState<WritingDraft>({ ...EMPTY_DRAFT });
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("");
  const [grade, setGrade] = useState("8");
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [hintStep, setHintStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"plan" | "scan" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openConfig = useCallback((next: WritingPromptConfig, nextNotice?: string | null) => {
    setConfig(next);
    setDraft(readWritingDraft(next.id) ?? { ...EMPTY_DRAFT, packId: next.id });
    setNotice(nextNotice ?? null);
    setHintStep(null);
    setError(null);
    setPhase("coach");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (initialPackId && initialPackId !== "chlopi") {
        try {
          const pack = await fetchPublicPack(initialPackId);
          if (cancelled) return;
          if (pack.writing) {
            openConfig(pack.writing);
            return;
          }
          setError("That pack has no writing prompt. Paste the assignment below.");
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not open that pack");
        }
        return;
      }
      if (initialPreset === "chlopi" || initialPackId === "chlopi") {
        openConfig(CHLOPI_WRITING_CONFIG);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPackId, initialPreset, openConfig]);

  const update = useCallback((patch: Partial<WritingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      writeWritingDraft(next);
      return next;
    });
    setCopied(false);
    setError(null);
  }, []);

  const ui = useMemo(
    () => (config ? resolveCoachUi(config.language, config.ui) : null),
    [config],
  );

  async function startCustom() {
    const text = prompt.trim();
    if (text.length < 8) {
      setError("Paste the assignment (at least a sentence).");
      return;
    }
    setBusy("plan");
    setError(null);
    try {
      const result = await planWritingRequest({
        prompt: text,
        language: language.trim() || undefined,
        grade,
        title: title.trim() || undefined,
      });
      openConfig(result.config, result.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the coach");
    } finally {
      setBusy(null);
    }
  }

  async function onScan(file: File | undefined) {
    if (!file) return;
    setBusy("scan");
    setError(null);
    try {
      const result = await extractHomeworkRequest({ file });
      const nextPrompt = result.notes.essayPrompts[0]?.trim() || result.notes.rawText.trim();
      if (!nextPrompt) {
        setError(result.notice || "No text came back. Paste the assignment instead.");
        return;
      }
      setPrompt(nextPrompt);
      if (result.notes.language && result.notes.language !== "und") {
        setLanguage(result.notes.language);
      }
      if (result.notes.title) setTitle(result.notes.title);
      setNotice(result.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that page");
    } finally {
      setBusy(null);
    }
  }

  if (phase === "setup" || !config || !ui) {
    return (
      <Setup
        prompt={prompt}
        language={language}
        grade={grade}
        title={title}
        notice={notice}
        error={error}
        busy={busy}
        fileRef={fileRef}
        onPrompt={setPrompt}
        onLanguage={setLanguage}
        onGrade={setGrade}
        onTitle={setTitle}
        onStart={() => void startCustom()}
        onChlopi={() => openConfig(CHLOPI_WRITING_CONFIG)}
        onScan={(file) => void onScan(file)}
      />
    );
  }

  return (
    <Coach
      config={config}
      ui={ui}
      draft={draft}
      notice={notice}
      copied={copied}
      showParent={showParent}
      showSource={showSource}
      hintStep={hintStep}
      error={error}
      onUpdate={update}
      onCopied={setCopied}
      onError={setError}
      onHint={setHintStep}
      onParent={() => setShowParent((value) => !value)}
      onOpenSource={() => {
        cancelSpeech();
        setShowSource(true);
      }}
      onCloseSource={() => setShowSource(false)}
      onChangePrompt={() => {
        setPhase("setup");
        setPrompt(config.prompt);
        setLanguage(config.language === "und" ? "" : config.language);
        setTitle(config.title);
      }}
    />
  );
}

function Setup({
  prompt,
  language,
  grade,
  title,
  notice,
  error,
  busy,
  fileRef,
  onPrompt,
  onLanguage,
  onGrade,
  onTitle,
  onStart,
  onChlopi,
  onScan,
}: {
  prompt: string;
  language: string;
  grade: string;
  title: string;
  notice: string | null;
  error: string | null;
  busy: "plan" | "scan" | null;
  fileRef: RefObject<HTMLInputElement | null>;
  onPrompt: (value: string) => void;
  onLanguage: (value: string) => void;
  onGrade: (value: string) => void;
  onTitle: (value: string) => void;
  onStart: () => void;
  onChlopi: () => void;
  onScan: (file: File | undefined) => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
        Writing coach
      </p>
      <header className="space-y-2">
        <h1 className="font-display text-4xl leading-tight">Write the response</h1>
        <p className="text-sm text-white/65">
          Any subject, any language. Grok coaches the steps — it does not write the essay. Chłopi
          stays available as one example.
        </p>
      </header>
      <AiStatusBanner />
      {notice ? (
        <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/70">{notice}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-orange-400/15 px-4 py-3 text-sm text-orange-100" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">Assignment</h2>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-white/80">Prompt</span>
          <textarea
            className="field min-h-36 leading-relaxed"
            value={prompt}
            onChange={(event) => onPrompt(event.target.value)}
            placeholder="Paste the essay question in any language."
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.svg,.txt"
          className="sr-only"
          onChange={(event) => {
            onScan(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "scan" ? "Reading…" : "Scan a prompt"}
        </button>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-white/80">Title (optional)</span>
          <input className="field" value={title} onChange={(event) => onTitle(event.target.value)} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-white/80">Language</span>
          <input
            className="field"
            value={language}
            onChange={(event) => onLanguage(event.target.value)}
            placeholder="es, en, pl, fr… blank detects it"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-white/80">Grade</span>
          <select className="field" value={grade} onChange={(event) => onGrade(event.target.value)}>
            {GRADES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={onStart}>
          {busy === "plan" ? "Starting…" : "Start coaching"}
        </button>
      </section>

      <section className="card space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Example preset</p>
        <button type="button" className="btn-secondary" onClick={onChlopi}>
          Chłopi · pytanie problemowe
        </button>
        <p className="text-xs text-white/45">
          Klasa 8 Polish scaffold. Built in — it does not call Grok.
        </p>
      </section>
      <Link className="pb-4 text-center text-sm text-white/40 underline underline-offset-4" href="/">
        Home
      </Link>
    </main>
  );
}

function Coach({
  config,
  ui,
  draft,
  notice,
  copied,
  showParent,
  showSource,
  hintStep,
  error,
  onUpdate,
  onCopied,
  onError,
  onHint,
  onParent,
  onOpenSource,
  onCloseSource,
  onChangePrompt,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
  draft: WritingDraft;
  notice: string | null;
  copied: boolean;
  showParent: boolean;
  showSource: boolean;
  hintStep: string | null;
  error: string | null;
  onUpdate: (patch: Partial<WritingDraft>) => void;
  onCopied: (value: boolean) => void;
  onError: (value: string | null) => void;
  onHint: (value: string | null) => void;
  onParent: () => void;
  onOpenSource: () => void;
  onCloseSource: () => void;
  onChangePrompt: () => void;
}) {
  const assembled = useMemo(
    () => joinEssay([draft.thesis, draft.themeLinks, draft.modernPara, draft.closing]),
    [draft.closing, draft.modernPara, draft.themeLinks, draft.thesis],
  );
  const spokenText = useMemo(
    () => speechForStep(config, ui, draft, assembled, hintStep),
    [assembled, config, draft, hintStep, ui],
  );
  const words = countWords(assembled);
  const step = draft.step;
  const stanceMeta = config.stances.find((item) => item.id === draft.stance);

  function next() {
    const message = validate(config, ui, draft);
    if (message) {
      onError(message);
      return;
    }
    onHint(null);
    onUpdate({ step: Math.min(step + 1, STEPS.length - 1) });
  }

  function back() {
    onHint(null);
    onError(null);
    onUpdate({ step: Math.max(step - 1, 0) });
  }

  async function copyEssay() {
    try {
      await navigator.clipboard.writeText(assembled);
      onCopied(true);
    } catch {
      onError(ui.copyFail);
    }
  }

  return (
    <main
      lang={config.language === "und" ? undefined : config.language}
      className="write-main mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6"
    >
      <div className="write-toolbar">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
          {config.kicker}
        </p>
        <button
          type="button"
          className="btn-source"
          onClick={onOpenSource}
          aria-haspopup="dialog"
          aria-expanded={showSource}
          aria-label={ui.readAria}
        >
          <BookIcon />
          {ui.read}
        </button>
      </div>
      <header className="space-y-2">
        <h1 className="font-display text-4xl leading-tight">{config.title}</h1>
        <p className="text-sm text-white/65">{config.blurb}</p>
      </header>
      {notice ? (
        <p className="rounded-2xl bg-orange-400/15 px-4 py-3 text-sm text-orange-50" role="status">
          {notice}
        </p>
      ) : null}

      <ol className="grid grid-cols-6 gap-1" aria-label={ui.stepProgress}>
        {ui.steps.map((item, index) => (
          <li key={STEPS[index].id}>
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
        {fillTemplate(ui.stepProgress, { step: step + 1, total: ui.steps.length, title: ui.steps[step] })}
      </p>

      {step === 0 ? (
        <QuestionStep config={config} ui={ui} plan={draft.plan} onPlan={(plan) => onUpdate({ plan })} showHint={hintStep === "pytanie"} />
      ) : null}
      {step === 1 ? (
        <StanceStep
          config={config}
          ui={ui}
          stance={draft.stance}
          onPick={(stance) => onUpdate({ stance })}
          showHint={hintStep === "teza"}
        />
      ) : null}
      {step === 2 ? (
        <ThemeStep
          config={config}
          ui={ui}
          selected={draft.themes}
          onToggle={(id) =>
            onUpdate({
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
          ui={ui}
          value={draft.example}
          onChange={(example) => onUpdate({ example })}
          showHint={hintStep === "przyklad"}
        />
      ) : null}
      {step === 4 ? (
        <WriteStep
          config={config}
          ui={ui}
          draft={draft}
          stanceHint={stanceMeta?.thesisHint ?? config.stances[0].thesisHint}
          words={words}
          assembled={assembled}
          showHint={hintStep === "pisz"}
          onChange={onUpdate}
        />
      ) : null}
      {step === 5 ? (
        <FinalStep
          config={config}
          ui={ui}
          assembled={assembled}
          words={words}
          copied={copied}
          showParent={showParent}
          onCopy={() => void copyEssay()}
          onToggleParent={onParent}
        />
      ) : null}

      {step < 5 ? (
        <ReadAloudButton text={spokenText} lang={config.language} idleLabel={ui.read} className="btn-read w-full" />
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-orange-400/15 px-4 py-3 text-sm text-orange-100" role="alert">
          {error}
        </p>
      ) : null}

      {step < 5 ? (
        <button
          type="button"
          className="text-center text-sm text-white/55 underline underline-offset-4"
          onClick={() => onHint(hintStep ? null : hintId(step))}
        >
          {hintStep ? ui.hintHide : ui.hintShow}
        </button>
      ) : null}

      <div className="mt-auto grid grid-cols-2 gap-3 pb-2">
        {step > 0 ? (
          <button type="button" className="btn-secondary" onClick={back}>
            {ui.back}
          </button>
        ) : (
          <Link className="btn-secondary flex items-center justify-center" href="/">
            {ui.home}
          </Link>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>
            {ui.next}
          </button>
        ) : (
          <Link className="btn-primary flex items-center justify-center" href="/">
            {ui.done}
          </Link>
        )}
      </div>
      <button
        type="button"
        className="pb-4 text-center text-sm text-white/40 underline underline-offset-4"
        onClick={onChangePrompt}
      >
        {ui.changePrompt}
      </button>

      <SourceSheet
        open={showSource}
        onClose={onCloseSource}
        source={config.source}
        prompt={config.prompt}
        labels={{
          close: ui.close,
          prompt: ui.sourcePrompt,
          facts: ui.sourceFacts,
          sections: ui.sourceSections,
          use: ui.sourceUse,
        }}
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
  ui: CoachUi,
  draft: WritingDraft,
  assembled: string,
  hintStep: string | null,
): string {
  const showHint = hintStep === hintId(draft.step);
  const parts: string[] = [];
  const goal = fillTemplate(ui.speechGoal, {
    min: config.targetWordsMin,
    max: config.targetWordsMax,
  });

  switch (draft.step) {
    case 0:
      parts.push(ui.speechQuestion, config.prompt, goal);
      if (showHint) parts.push(ui.planHint);
      break;
    case 1:
      parts.push(config.stanceTitle);
      for (const item of config.stances) parts.push(`${item.label}. ${item.tip}`);
      if (showHint && draft.stance) {
        const hint = config.stances.find((item) => item.id === draft.stance)?.thesisHint;
        if (hint) parts.push(ui.speechRewrite, hint);
      } else if (showHint) {
        parts.push(ui.pickStanceFirst);
      }
      break;
    case 2:
      parts.push(config.themeTitle, config.themeBlurb);
      for (const theme of config.themes) parts.push(`${theme.label}. ${theme.hint}`);
      if (showHint) parts.push(ui.speechRewrite, sampleSentence(config, draft.themes[0]));
      break;
    case 3:
      parts.push(config.exampleTitle, config.exampleBlurb, ui.todayLabel);
      if (showHint) parts.push(ui.speechRewrite, config.exampleHint);
      break;
    case 4: {
      parts.push(ui.speechCompose);
      if (draft.example) parts.push(ui.speechNoInsert);
      if (showHint) {
        const stanceHint =
          config.stances.find((item) => item.id === draft.stance)?.thesisHint ??
          config.stances[0].thesisHint;
        parts.push(ui.hintThesis, stanceHint);
        const themeHint = draft.themes.map((id) => sampleSentence(config, id)).join(" ");
        if (themeHint) parts.push(ui.hintTheme, themeHint);
        parts.push(ui.hintClosing, config.closingHint);
      }
      break;
    }
    case 5:
      parts.push(assembled || ui.emptyDraft);
      break;
    default:
      break;
  }
  return parts.join(" ");
}

function validate(config: WritingPromptConfig, ui: CoachUi, draft: WritingDraft): string | null {
  const range = { min: config.targetWordsMin, max: config.targetWordsMax };
  if (draft.step === 0 && draft.plan.trim().length < 8) return ui.validatePlan;
  if (draft.step === 1 && !draft.stance) return ui.validateStance;
  if (draft.step === 2 && draft.themes.length < 1) return ui.validateThemes;
  if (draft.step === 3 && draft.example.trim().length < 12) return ui.validateExample;
  if (draft.step === 4) {
    if (countWords(joinEssay([draft.thesis, draft.themeLinks, draft.modernPara, draft.closing])) < 40) {
      return fillTemplate(ui.validateDraft, range);
    }
  }
  return null;
}

function QuestionStep({
  config,
  ui,
  plan,
  onPlan,
  showHint,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
  plan: string;
  onPlan: (value: string) => void;
  showHint: boolean;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-2xl">{ui.questionHeading}</h2>
      <p className="text-[1.05rem] leading-relaxed text-white/90">{config.prompt}</p>
      <p className="text-sm text-white/55">
        {fillTemplate(ui.questionGoal, {
          min: config.targetWordsMin,
          max: config.targetWordsMax,
          words: ui.wordsSuffix,
        })}
      </p>
      <label className="block space-y-2">
        <span className="text-sm font-medium">{ui.planLabel}</span>
        <textarea
          className="field min-h-28"
          value={plan}
          onChange={(event) => onPlan(event.target.value)}
          placeholder={ui.planPlaceholder}
        />
      </label>
      {showHint ? <HintBox label={ui.hintShow} text={ui.planHint} /> : null}
    </section>
  );
}

function StanceStep({
  config,
  ui,
  stance,
  onPick,
  showHint,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
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
            <span className="choice-label font-display text-xl">{item.label}</span>
            <span className="mt-1 block text-sm text-white/65">{item.tip}</span>
          </label>
        ))}
      </fieldset>
      {showHint && stance ? (
        <HintBox
          label={ui.hintThesisLabel}
          text={config.stances.find((item) => item.id === stance)?.thesisHint ?? ""}
        />
      ) : null}
      {showHint && !stance ? <p className="text-sm text-white/50">{ui.pickStanceFirst}</p> : null}
    </section>
  );
}

function ThemeStep({
  config,
  ui,
  selected,
  onToggle,
  showHint,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
  selected: string[];
  onToggle: (id: string) => void;
  showHint: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{config.themeTitle}</h2>
      <p className="text-sm text-white/65">{config.themeBlurb}</p>
      <fieldset className="grid gap-2">
        <legend className="sr-only">{ui.themesLegend}</legend>
        {config.themes.map((theme) => (
          <label key={theme.id} className={`choice ${selected.includes(theme.id) ? "choice-on" : ""}`}>
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
        <HintBox label={ui.hintThemeLabel} text={sampleSentence(config, selected[0])} />
      ) : null}
    </section>
  );
}

function ExampleStep({
  config,
  ui,
  value,
  onChange,
  showHint,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
  value: string;
  onChange: (value: string) => void;
  showHint: boolean;
}) {
  return (
    <section className="card space-y-3">
      <h2 className="font-display text-2xl">{config.exampleTitle}</h2>
      <p className="text-sm text-white/65">{config.exampleBlurb}</p>
      <label className="block space-y-2">
        <span className="text-sm font-medium">{ui.todayLabel}</span>
        <textarea
          className="field min-h-36 leading-relaxed"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={config.examplePlaceholder}
        />
      </label>
      {showHint ? <HintBox label={ui.hintExampleLabel} text={config.exampleHint} /> : null}
    </section>
  );
}

function WriteStep({
  config,
  ui,
  draft,
  stanceHint,
  words,
  assembled,
  showHint,
  onChange,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
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
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl">{ui.writeHeading}</h2>
        <WordBadge words={words} min={config.targetWordsMin} max={config.targetWordsMax} suffix={ui.wordsSuffix} />
      </div>
      <p className="text-sm text-white/65">
        {ui.writeBlurb}
        {draft.example ? ui.writeBlurbWithExample : ""}
      </p>
      {draft.stance || draft.themes.length ? (
        <p className="text-xs text-white/50">
          {ui.yourChoices}: {stanceLabel(config, draft.stance)}
          {draft.themes.length
            ? ` · ${draft.themes
                .map((id) => config.themes.find((theme) => theme.id === id)?.label)
                .filter(Boolean)
                .join(" · ")}`
            : ""}
        </p>
      ) : null}
      <label className="block space-y-2">
        <span className="text-sm font-medium">{ui.fieldThesis}</span>
        <textarea
          className="field min-h-24"
          value={draft.thesis}
          onChange={(event) => onChange({ thesis: event.target.value })}
          placeholder={ui.fieldThesisPlaceholder}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">{config.themeLinkLabel}</span>
        <textarea
          className="field min-h-24"
          value={draft.themeLinks}
          onChange={(event) => onChange({ themeLinks: event.target.value })}
          placeholder={config.themeLinkPlaceholder}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">{ui.fieldExample}</span>
        <textarea
          className="field min-h-24"
          value={draft.modernPara}
          onChange={(event) => onChange({ modernPara: event.target.value })}
          placeholder={draft.example || config.examplePlaceholder}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">{ui.fieldClosing}</span>
        <textarea
          className="field min-h-24"
          value={draft.closing}
          onChange={(event) => onChange({ closing: event.target.value })}
          placeholder={ui.fieldClosingPlaceholder}
        />
      </label>
      {showHint ? (
        <div className="space-y-2">
          <HintBox label={ui.hintThesis} text={stanceHint} />
          {themeHint ? <HintBox label={ui.hintTheme} text={themeHint} /> : null}
          <HintBox label={ui.hintClosing} text={config.closingHint} />
        </div>
      ) : null}
      {assembled ? (
        <p className="rounded-2xl bg-black/25 px-3 py-2 text-xs text-white/45">
          {ui.preview}: {assembled.slice(0, 160)}
          {assembled.length > 160 ? "…" : ""}
        </p>
      ) : null}
    </section>
  );
}

function FinalStep({
  config,
  ui,
  assembled,
  words,
  copied,
  showParent,
  onCopy,
  onToggleParent,
}: {
  config: WritingPromptConfig;
  ui: CoachUi;
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
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl">{ui.finalHeading}</h2>
        <WordBadge words={words} min={config.targetWordsMin} max={config.targetWordsMax} suffix={ui.wordsSuffix} />
      </div>
      <p className="text-sm text-white/65">
        {inRange ? ui.lengthOk : words < config.targetWordsMin ? ui.lengthShort : ui.lengthLong}
      </p>
      {config.reviewChecks?.length ? (
        <ul className="card list-disc space-y-2 pl-8 text-sm text-white/80">
          <li className="list-none -ml-4 font-semibold text-white/55">{ui.reviewTitle}</li>
          {config.reviewChecks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      ) : null}
      <ReadAloudButton
        text={assembled || ui.emptyDraft}
        lang={config.language}
        idleLabel={ui.read}
        className="btn-read w-full"
      />
      <article className="card text-[1.05rem] leading-relaxed whitespace-pre-wrap">
        {assembled || ui.emptyDraft}
      </article>
      <button type="button" className="btn-primary" onClick={onCopy} disabled={!assembled}>
        {copied ? ui.copied : ui.copy}
      </button>
      <button type="button" className="btn-secondary" onClick={onToggleParent}>
        {showParent ? ui.parentHide : ui.parentShow}
      </button>
      {showParent ? (
        <aside className="card space-y-2 text-sm text-lime-100">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-300">{ui.parentKicker}</p>
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

function WordBadge({
  words,
  min,
  max,
  suffix,
}: {
  words: number;
  min: number;
  max: number;
  suffix: string;
}) {
  const ok = words >= min && words <= max;
  return (
    <p
      className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
        ok ? "bg-lime-300 text-black" : "bg-white/10 text-white"
      }`}
      aria-live="polite"
    >
      {words} {suffix}
    </p>
  );
}
