"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { extractHomeworkRequest, generateHomeworkRequest, RequestError } from "@/lib/client/api";
import { writeLocalPlay, writePlayKit } from "@/lib/client/local-play";
import {
  readHomeworkDraft,
  writeHomeworkDraft,
  writeTonightPackId,
} from "@/lib/client/homework-draft";
import { stashPendingScan, takePendingScan } from "@/lib/client/pending-scan";
import { prepareScanFile, type ScanPreview } from "@/lib/client/scan-files";
import {
  codeFromFailure,
  isAcceptedScanFile,
  LONG_PDF_NOTE,
  mapScanError,
  MAX_ORIGINAL_BYTES,
  retryMode,
  ScanFailure,
  SLOW_NOTE_MS,
  SLOW_PAGE_NOTE,
} from "@/lib/client/scan-prep";
import { emptyPasteNotes, looksLikeJunk, notesFromRawText } from "@/lib/homework/lines";
import type { ExtractedNotes, HomeworkMode } from "@/lib/homework/types";
import type { PublicLevel } from "@/data/types";
import { HomeworkScanCard } from "./HomeworkScanCard";
import { TinyPath } from "./TinyPath";

type Stage = "pick" | "preparing" | "uploading" | "reading" | "held" | "confirm" | "building" | "done" | "error";

type ScanErrorView = ReturnType<typeof mapScanError>;

export function HomeworkClient() {
  const router = useRouter();
  const [notes, setNotes] = useState<ExtractedNotes | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<HomeworkMode | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [packId, setPackId] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState<string | null>(null);
  const [pathLevels, setPathLevels] = useState<PublicLevel[]>([]);
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("pick");
  const [preview, setPreview] = useState<ScanPreview>({ thumbUrl: null, pageCount: 0, truncated: false });
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState<ScanErrorView | null>(null);
  const fileHeld = useRef<File | null>(null);
  const failedPhase = useRef<"extract" | "generate">("extract");
  const cancelRef = useRef<AbortController | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pipelineRef = useRef<(file: File) => Promise<void>>(async () => undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    const file = takePendingScan();
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (file) {
        started = true;
        setReady(true);
        void pipelineRef.current(file);
        return;
      }
      const draft = readHomeworkDraft();
      if (draft) {
        setNotes(draft.notes);
        setNotice(draft.notice);
        setMode(draft.mode);
        setStage("confirm");
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (file && !started) stashPendingScan(file);
    };
  }, []);

  function persist(next: ExtractedNotes, nextMode = mode, nextNotice = notice) {
    writeHomeworkDraft({
      extractId: "local",
      notes: next,
      mode: nextMode ?? "fixture",
      notice: nextNotice,
    });
  }

  async function runDemo(input: { fixtureId?: string; pasteDemo?: boolean }) {
    setDemoBusy(true);
    setDemoError(null);
    setPackId(null);
    setScanError(null);
    try {
      const result = await extractHomeworkRequest(input);
      setNotes(result.notes);
      setNotice(result.notice);
      setMode(result.mode);
      persist(result.notes, result.mode, result.notice);
      setStage("confirm");
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : "Could not read that scan");
      setStage("pick");
    } finally {
      setDemoBusy(false);
    }
  }

  function showFailure(error: unknown, phase: "extract" | "generate") {
    failedPhase.current = phase;
    const code =
      error instanceof ScanFailure
        ? error.code
        : error instanceof RequestError
          ? codeFromFailure({ code: error.code, status: error.status })
          : error instanceof TypeError
            ? "offline"
            : phase === "generate"
              ? "generate_failed"
              : "unreadable";
    setScanError(mapScanError(code, phase));
    setStage("error");
  }

  async function runPipeline(file: File) {
    fileHeld.current = file;
    failedPhase.current = "extract";
    const kind = isAcceptedScanFile(file);
    if (!kind) {
      showFailure(new ScanFailure("file_type"), "extract");
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      showFailure(new ScanFailure("file_too_big"), "extract");
      return;
    }
    const cancel = new AbortController();
    cancelRef.current?.abort();
    cancelRef.current = cancel;
    setScanError(null);
    setDemoError(null);
    setNotes(null);
    setPackId(null);
    setProgress(0);
    setAttempt((value) => value + 1);
    setStage("preparing");
    setPreview(
      kind === "image"
        ? { thumbUrl: URL.createObjectURL(file), pageCount: 1, truncated: false }
        : { thumbUrl: null, pageCount: 0, truncated: false },
    );
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new ScanFailure("offline");
      }
      const prepared = await prepareScanFile(file, {
        signal: cancel.signal,
        onPreview: (next) => setPreview(next),
      });
      if (cancel.signal.aborted) return;
      setPreview({
        thumbUrl: prepared.thumbUrl,
        pageCount: prepared.pageCount,
        truncated: prepared.truncated,
      });
      setStage("uploading");
      const result = await extractHomeworkRequest(
        prepared.kind === "text"
          ? { rawText: prepared.text, title: prepared.title, source: "pdf-text" }
          : { files: prepared.files },
        {
          signal: cancel.signal,
          onProgress: (ratio) => setProgress(ratio),
          onUploaded: () => setStage("reading"),
        },
      );
      if (cancel.signal.aborted) return;
      setNotes(result.notes);
      setNotice(result.notice);
      setMode(result.mode);
      persist(result.notes, result.mode, result.notice);
      setStage("confirm");
    } catch (error) {
      if (cancel.signal.aborted || isAbort(error)) {
        setStage("held");
        return;
      }
      showFailure(error, "extract");
    } finally {
      if (cancelRef.current === cancel) cancelRef.current = null;
    }
  }
  useEffect(() => {
    pipelineRef.current = runPipeline;
  });

  async function onGenerate(kept: ExtractedNotes) {
    failedPhase.current = "generate";
    const cancel = new AbortController();
    cancelRef.current?.abort();
    cancelRef.current = cancel;
    setScanError(null);
    setDemoError(null);
    setNotes(kept);
    setAttempt((value) => value + 1);
    setStage("building");
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new ScanFailure("offline");
      }
      persist(kept);
      const result = await generateHomeworkRequest(kept, { signal: cancel.signal });
      if (cancel.signal.aborted) return;
      writePlayKit(result.playKit);
      writeTonightPackId(result.pack.id);
      setPackId(result.pack.id);
      setPackTitle(result.pack.title);
      setPathLevels((result.pack.levels ?? []).filter((level) => !level.mega));
      setStage("done");
    } catch (error) {
      if (cancel.signal.aborted || isAbort(error)) {
        setStage("confirm");
        return;
      }
      showFailure(error, "generate");
    } finally {
      if (cancelRef.current === cancel) cancelRef.current = null;
    }
  }

  function cancelScan() {
    cancelRef.current?.abort();
    setStage(stage === "building" ? "confirm" : "held");
  }

  function onErrorAction() {
    if (!scanError) return;
    const plan = retryMode({
      code: scanError.code,
      failedPhase: failedPhase.current,
      hasNotes: Boolean(notes),
      hasFile: Boolean(fileHeld.current),
    });
    if (scanError.action === "Try again" && plan === "generate-only" && notes) {
      void onGenerate(notes);
      return;
    }
    if (scanError.action === "Try again" && fileHeld.current) {
      void runPipeline(fileHeld.current);
      return;
    }
    if (scanError.action === "Retake") {
      cameraRef.current?.click();
      return;
    }
    pickRef.current?.click();
  }

  function pasteInstead() {
    setScanError(null);
    if (!notes || (!notes.topics.length && !notes.facts.length && !notes.rawText.trim())) {
      const empty = emptyPasteNotes();
      setNotes(empty);
      setMode("fixture");
      setNotice("Paste the page in any language, then generate.");
    }
    setStage("confirm");
  }

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Reading…</p>
      </main>
    );
  }

  const waiting = stage === "preparing" || stage === "uploading" || stage === "reading" || stage === "building" || stage === "held";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
        Parent · homework scan
      </p>
      <header className="space-y-1">
        <h1 className="font-display text-4xl leading-tight">Tonight’s pack</h1>
        <p className="text-sm text-white/65">
          Photo/PDF → confirm topics → generate the tiny path. Keys stay off student screens.
        </p>
      </header>

      {demoError ? (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200" role="alert">
          {demoError}
        </p>
      ) : null}

      {waiting ? (
        <ScanWait
          key={attempt}
          stage={stage}
          progress={progress}
          preview={preview}
          onCancel={cancelScan}
          onRetry={() => {
            if (fileHeld.current) void runPipeline(fileHeld.current);
          }}
        />
      ) : null}

      {stage === "error" && scanError ? (
        <ScanError
          view={scanError}
          preview={preview}
          onAction={onErrorAction}
          onPaste={pasteInstead}
        />
      ) : null}

      {stage === "pick" ? (
        <HomeworkScanCard
          busy={demoBusy}
          onFile={(file) => void runPipeline(file)}
          onDemo={(fixtureId) => void runDemo({ fixtureId })}
          onPasteDemo={() => void runDemo({ pasteDemo: true })}
        />
      ) : null}

      {stage === "confirm" && notes ? (
        <>
          <ConfirmForm
            notes={notes}
            notice={notice}
            mode={mode}
            busy={false}
            onGenerate={(kept) => void onGenerate(kept)}
          />
          <button
            type="button"
            className="text-sm text-white/55 underline underline-offset-4"
            onClick={() => {
              setNotes(null);
              setPackId(null);
              setStage("pick");
            }}
          >
            Scan a different page
          </button>
        </>
      ) : null}

      {stage === "done" && packId ? (
        <section className="card space-y-4">
          <h2 className="font-display text-2xl">Tiny path ready</h2>
          <p className="text-sm text-white/70">
            <span className="font-semibold text-lime-200">{packTitle}</span> uses the same path as
            Create room / Rematch. Host picks A/B there.
          </p>
          {pathLevels.length ? (
            <TinyPath
              levels={pathLevels}
              completedIds={[]}
              currentId={pathLevels[0]?.id}
              onSelect={(levelId) => startPractice("solo", levelId)}
            />
          ) : null}
          <p className="text-xs text-white/45">
            Tap a node to practice that stop on this phone. Answer keys stay hidden.
          </p>
          <Link className="btn-primary flex items-center justify-center" href={`/?pack=${packId}`}>
            Create room
          </Link>
          <button type="button" className="btn-secondary" onClick={() => startPractice("pass", null)}>
            Take turns on this phone
          </button>
          <button type="button" className="btn-secondary" onClick={() => startPractice("solo", null)}>
            Practice the whole pack
          </button>
          <button
            type="button"
            className="text-sm text-white/55 underline underline-offset-4"
            onClick={() => {
              setPackId(null);
              setStage("confirm");
              router.replace("/homework");
            }}
          >
            Edit topics and generate again
          </button>
        </section>
      ) : null}

      <input
        ref={pickRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void runPipeline(file);
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void runPipeline(file);
        }}
      />

      <Link className="pb-4 text-center text-sm text-white/40 underline underline-offset-4" href="/">
        Back home
      </Link>
    </main>
  );

  function startPractice(mode: "solo" | "pass", levelId: string | null) {
    if (!packId) return;
    writeLocalPlay({
      mode,
      quizId: packId,
      variant: "A",
      levelId,
      names: ["You", "Player 2"],
      startedAt: Date.now(),
    });
    router.push("/play");
  }
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function PagePreview({ preview }: { preview: ScanPreview }) {
  return (
    <div className="space-y-2">
      {preview.thumbUrl ? (
        // Blob previews are local; next/image cannot optimize them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.thumbUrl} alt="Page preview" className="h-28 w-auto rounded-xl object-contain" />
      ) : null}
      {preview.pageCount > 0 ? (
        <p data-testid="page-count" className="text-sm text-white/80">
          {preview.pageCount} {preview.pageCount === 1 ? "page" : "pages"}
        </p>
      ) : null}
      {preview.truncated ? (
        <p data-testid="page-limit" className="text-sm text-white/70">
          {LONG_PDF_NOTE}
        </p>
      ) : null}
    </div>
  );
}

function ScanWait({
  stage,
  progress,
  preview,
  onCancel,
  onRetry,
}: {
  stage: Stage;
  progress: number;
  preview: ScanPreview;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const [topicsOn, setTopicsOn] = useState(false);
  const [slow, setSlow] = useState(false);
  const checklist = stage === "reading" || stage === "building";

  useEffect(() => {
    if (stage !== "reading" && stage !== "building") return;
    const topics = window.setTimeout(() => setTopicsOn(true), 2000);
    const note = window.setTimeout(() => setSlow(true), SLOW_NOTE_MS);
    return () => {
      window.clearTimeout(topics);
      window.clearTimeout(note);
    };
  }, [stage]);

  const reading: ItemState = stage === "building" || topicsOn ? "done" : stage === "reading" ? "active" : "todo";
  const topics: ItemState = stage === "building" ? "done" : topicsOn && stage === "reading" ? "active" : "todo";
  const building: ItemState = stage === "building" ? "active" : "todo";
  const status =
    stage === "preparing"
      ? "Getting your page ready…"
      : stage === "uploading"
        ? `Uploading… ${Math.round(progress * 100)}%`
        : stage === "reading"
          ? topicsOn
            ? "Finding topics…"
            : "Reading page…"
          : stage === "building"
            ? "Building your quiz…"
            : "Stopped. Your page is still here.";

  return (
    <section className="card space-y-3">
      <PagePreview preview={preview} />
      <p data-testid="scan-status" aria-live="polite" className="text-sm font-medium text-white/85">
        {status}
      </p>
      {stage === "uploading" ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          data-testid="upload-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full bg-lime-300" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      ) : null}
      {checklist ? (
        <ul data-testid="scan-checklist" className="space-y-1 text-sm text-white/80">
          <CheckItem label="Reading page" state={reading} />
          <CheckItem label="Finding topics" state={topics} />
          <CheckItem label="Building your quiz" state={building} />
        </ul>
      ) : null}
      {slow && checklist ? (
        <p data-testid="scan-slow-note" className="text-sm text-white/60">
          {SLOW_PAGE_NOTE}
        </p>
      ) : null}
      {stage === "held" ? (
        <button type="button" className="btn-primary" onClick={onRetry}>
          Try again
        </button>
      ) : (
        <button type="button" className="btn-secondary" data-testid="scan-cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </section>
  );
}

type ItemState = "todo" | "active" | "done";

function CheckItem({ label, state }: { label: string; state: ItemState }) {
  const mark = state === "done" ? "✓" : state === "active" ? "…" : "○";
  return (
    <li data-state={state}>
      <span aria-hidden="true">{mark} </span>
      {label}
    </li>
  );
}

function ScanError({
  view,
  preview,
  onAction,
  onPaste,
}: {
  view: ScanErrorView;
  preview: ScanPreview;
  onAction: () => void;
  onPaste: () => void;
}) {
  return (
    <section className="card space-y-3" role="alert">
      <PagePreview preview={preview} />
      <p className="text-base text-white">{view.message}</p>
      <button type="button" className="btn-primary" data-testid="scan-error-action" onClick={onAction}>
        {view.action}
      </button>
      <button type="button" className="btn-secondary" data-testid="scan-paste" onClick={onPaste}>
        Paste text instead
      </button>
      <p data-testid="scan-error-code" className="text-xs text-white/40">
        {view.code}
      </p>
    </section>
  );
}

function ConfirmForm({
  notes,
  notice,
  mode,
  busy,
  onGenerate,
}: {
  notes: ExtractedNotes;
  notice: string | null;
  mode: string | null;
  busy: boolean;
  onGenerate: (kept: ExtractedNotes) => void;
}) {
  const [title, setTitle] = useState(notes.title);
  const [language, setLanguage] = useState(notes.language || "und");
  const [paste, setPaste] = useState(
    notes.rawText || notes.lines.map((line) => line.text).join("\n"),
  );
  const [topics, setTopics] = useState(() => toChecks(notes.topics, "topic"));
  const [questions, setQuestions] = useState(() =>
    toChecks(notes.facts.length ? notes.facts : keptLineTexts(notes), "q"),
  );
  const [lines, setLines] = useState(notes.lines);

  const keptTopics = topics.filter((item) => item.keep).length;
  const keptQuestions = questions.filter((item) => item.keep).length;
  const needsPaste = keptTopics === 0 && keptQuestions === 0 && !lines.some((line) => line.keep);

  function applyPasted() {
    const next = notesFromRawText(paste, {
      title: title.trim() || undefined,
      language: language && language !== "und" ? language : undefined,
    });
    setLanguage(next.language);
    if (!title.trim()) setTitle(next.title);
    setLines(next.lines);
    setTopics(toChecks(next.topics.length ? next.topics : next.facts, "topic"));
    setQuestions(toChecks(next.facts.length ? next.facts : keptLineTexts(next), "q"));
    setPaste(next.rawText);
  }

  function submit() {
    const keptTopicsText = topics.filter((item) => item.keep).map((item) => item.text.trim()).filter(Boolean);
    const keptFacts = questions.filter((item) => item.keep).map((item) => item.text.trim()).filter(Boolean);
    onGenerate({
      ...notes,
      title: title.trim() || notes.title,
      language: language.trim() || notes.language,
      topics: keptTopicsText,
      facts: keptFacts,
      lines,
      rawText:
        lines.filter((line) => line.keep).map((line) => line.text).join("\n") || paste,
    });
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/70">{notice}</p>
      ) : null}
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
        {mode ?? "fixture"} · {language} · uncheck junk · no keys shown
      </p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Title</span>
        <input
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Worksheet language</span>
        <input
          className="field"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          placeholder="pl, en, es, fr…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="block text-xs text-white/45">
          BCP-47 / ISO code. Content stays in this language — we do not force Polish or English.
        </span>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Paste / edit worksheet text</span>
        <textarea
          className="field min-h-36"
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder="Paste the page in any language. Uncheck junk after applying."
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !paste.trim()}
          onClick={applyPasted}
        >
          Use this text
        </button>
      </label>

      <Checklist
        legend="Topics for the tiny path"
        hint="Each kept topic becomes a node on the same TinyPath as Create room."
        items={topics}
        meta={`${keptTopics} kept`}
        onToggle={(id) =>
          setTopics((current) =>
            current.map((item) => (item.id === id ? { ...item, keep: !item.keep } : item)),
          )
        }
      />

      <Checklist
        legend="Detected notes / questions"
        hint="Uncheck name blanks, page numbers, or anything that would give the answer away."
        items={questions}
        meta={`${keptQuestions} kept`}
        onToggle={(id) =>
          setQuestions((current) =>
            current.map((item) => (item.id === id ? { ...item, keep: !item.keep } : item)),
          )
        }
      />

      {lines.some((line) => looksLikeJunk(line.text)) ? (
        <Checklist
          legend="Page lines"
          hint="Junk (name, signature, page) starts unchecked."
          items={lines}
          onToggle={(id) =>
            setLines((current) =>
              current.map((item) => (item.id === id ? { ...item, keep: !item.keep } : item)),
            )
          }
        />
      ) : null}

      {needsPaste ? (
        <p className="text-sm text-orange-100">
          Paste a few study lines above, then Generate. We will not invent Chłopi for an empty page.
        </p>
      ) : null}

      <button
        type="button"
        className="btn-primary"
        disabled={busy || (keptTopics === 0 && keptQuestions === 0)}
        onClick={submit}
      >
        {busy ? "Generating…" : "Generate tiny path"}
      </button>
    </div>
  );
}

function Checklist({
  legend,
  hint,
  items,
  meta,
  onToggle,
}: {
  legend: string;
  hint: string;
  items: { id: string; text: string; keep: boolean }[];
  meta?: string;
  onToggle: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-white/80">
        {legend}
        {meta ? <span className="ml-2 text-xs font-normal text-white/45">{meta}</span> : null}
      </legend>
      <p className="text-xs text-white/45">{hint}</p>
      <div className="grid gap-2">
        {items.map((item) => (
          <label key={item.id} className={`choice ${item.keep ? "choice-on" : ""}`}>
            <input
              type="checkbox"
              className="sr-only"
              checked={item.keep}
              onChange={() => onToggle(item.id)}
            />
            <span className="block text-sm leading-snug text-white/85">{item.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function toChecks(values: string[], prefix: string) {
  return values
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${prefix}-${index + 1}`,
      text,
      keep: true,
    }));
}

function keptLineTexts(notes: ExtractedNotes) {
  return notes.lines.filter((line) => line.keep).map((line) => line.text);
}
