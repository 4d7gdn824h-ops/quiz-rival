"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RequestError, scanHomeworkRequest } from "@/lib/client/api";
import { addFilesToTray, encodeTrayForJson, type TrayPage } from "@/lib/client/scan-files";
import {
  codeFromFailure,
  isAcceptedScanFile,
  LONG_PDF_NOTE,
  mapScanError,
  MAX_ORIGINAL_BYTES,
  MAX_SCAN_PAGES,
  PAGE_CAP_MESSAGE,
  retryMode,
  ScanFailure,
  SLOW_NOTE_MS,
  SLOW_PAGE_NOTE,
} from "@/lib/client/scan-prep";
import { startScanPlay } from "@/lib/client/start-scan-play";
import { takePendingPaste, takePendingScan } from "@/lib/client/pending-scan";
import { HomeworkScanCard } from "./HomeworkScanCard";

type Stage = "pick" | "preparing" | "uploading" | "reading" | "held" | "paste" | "error";

type ScanErrorView = ReturnType<typeof mapScanError>;

export function HomeworkClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("pick");
  const [pages, setPages] = useState<TrayPage[]>([]);
  const [capMessage, setCapMessage] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState<ScanErrorView | null>(null);
  const [paste, setPaste] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pagesRef = useRef<TrayPage[]>([]);
  const addIncomingRef = useRef<(files: File[]) => Promise<void>>(async () => undefined);
  const cancelRef = useRef<AbortController | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const failedPhase = useRef<"extract" | "generate">("extract");

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  function showFailure(error: unknown, phase: "extract" | "generate") {
    failedPhase.current = phase;
    const code =
      error instanceof ScanFailure
        ? error.code
        : error instanceof RequestError
          ? codeFromFailure({ code: error.code, status: error.status })
          : error instanceof TypeError
            ? "offline"
            : "unreadable";
    setScanError(mapScanError(code, phase));
    setStage("error");
  }

  async function addIncoming(files: File[]) {
    const accepted = files.filter((file) => isAcceptedScanFile(file));
    if (!accepted.length) {
      showFailure(new ScanFailure("file_type"), "extract");
      return;
    }
    if (accepted.some((file) => file.size > MAX_ORIGINAL_BYTES)) {
      showFailure(new ScanFailure("file_too_big"), "extract");
      return;
    }
    if (pagesRef.current.length >= MAX_SCAN_PAGES) {
      setCapMessage(PAGE_CAP_MESSAGE);
      setStage("pick");
      return;
    }
    setCapMessage(null);
    setScanError(null);
    setStage("preparing");
    try {
      const added = await addFilesToTray(pagesRef.current.length, accepted);
      setPages((current) => [...current, ...added.pages].slice(0, MAX_SCAN_PAGES));
      setCapMessage(added.message);
      setTruncated((value) => value || added.truncated);
      setStage("pick");
    } catch (error) {
      showFailure(error, "extract");
    }
  }

  useEffect(() => {
    addIncomingRef.current = addIncoming;
  });

  useEffect(() => {
    let cancelled = false;
    const pending = takePendingScan();
    const openPaste = takePendingPaste();
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setReady(true);
      if (openPaste) setStage("paste");
      if (pending.length) void addIncomingRef.current(pending);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function removePage(id: string) {
    setPages((current) => current.filter((page) => page.id !== id));
    setCapMessage(null);
  }

  async function runScan(source: { pages: TrayPage[] } | { rawText: string }) {
    const cancel = new AbortController();
    cancelRef.current?.abort();
    cancelRef.current = cancel;
    setScanError(null);
    setProgress(0);
    setAttempt((value) => value + 1);
    setStage("pages" in source ? "preparing" : "uploading");
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new ScanFailure("offline");
      }
      const body =
        "rawText" in source
          ? { rawText: source.rawText, source: "paste" }
          : await encodeTrayForJson(source.pages).then((encoded) => {
              if (cancel.signal.aborted) return null;
              return { pages: encoded.pages };
            });
      if (!body || cancel.signal.aborted) return;
      setStage("uploading");
      const result = await scanHomeworkRequest(body, {
        signal: cancel.signal,
        onProgress: (ratio) => setProgress(ratio),
        onUploaded: () => setStage("reading"),
      });
      if (cancel.signal.aborted) return;
      startScanPlay({
        packId: result.pack.id,
        levels: result.pack.levels,
        playKit: result.playKit,
        notes: result.notes,
        mode: result.mode,
        notice: result.notice,
      });
      router.push("/play");
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

  async function runDemo(fixtureId: string) {
    setScanError(null);
    setAttempt((value) => value + 1);
    setStage("reading");
    try {
      const result = await scanHomeworkRequest({ fixtureId });
      startScanPlay({
        packId: result.pack.id,
        levels: result.pack.levels,
        playKit: result.playKit,
        notes: result.notes,
        mode: result.mode,
        notice: result.notice,
      });
      router.push("/play");
    } catch (error) {
      showFailure(error, "extract");
    }
  }

  function cancelScan() {
    cancelRef.current?.abort();
    setStage("held");
  }

  function onErrorAction() {
    if (!scanError) return;
    const plan = retryMode({
      code: scanError.code,
      failedPhase: failedPhase.current,
      hasNotes: false,
      hasFile: pagesRef.current.length > 0,
    });
    if (scanError.action === "Try again" && plan === "same-file" && pagesRef.current.length) {
      void runScan({ pages: pagesRef.current });
      return;
    }
    if (scanError.action === "Retake") {
      pickRef.current?.click();
      return;
    }
    setStage("pick");
    pickRef.current?.click();
  }

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Reading…</p>
      </main>
    );
  }

  const waiting = stage === "preparing" || stage === "uploading" || stage === "reading" || stage === "held";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-300">
        Parent · homework scan
      </p>
      <header className="space-y-1">
        <h1 className="font-display text-4xl leading-tight">Tonight’s pack</h1>
        <p className="text-sm text-white/65">
          Add the pages, then the quiz starts. Answer keys stay off this screen.
        </p>
      </header>

      {waiting ? (
        <ScanWait
          key={attempt}
          stage={stage}
          progress={progress}
          pages={pages}
          truncated={truncated}
          onCancel={cancelScan}
          onRetry={() => {
            if (pagesRef.current.length) void runScan({ pages: pagesRef.current });
          }}
        />
      ) : null}

      {stage === "error" && scanError ? (
        <ScanError
          view={scanError}
          pages={pages}
          onAction={onErrorAction}
          onPaste={() => {
            setScanError(null);
            setStage("paste");
          }}
        />
      ) : null}

      {stage === "paste" ? (
        <section className="card space-y-3">
          <h2 className="font-display text-2xl">Paste the page</h2>
          <textarea
            className="field min-h-36"
            data-testid="paste-text"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder="Paste the worksheet in any language."
          />
          <button
            type="button"
            className="btn-primary"
            data-testid="make-quiz"
            disabled={!paste.trim()}
            onClick={() => void runScan({ rawText: paste.trim() })}
          >
            Make the quiz
          </button>
        </section>
      ) : null}

      {stage === "pick" ? (
        <HomeworkScanCard
          busy={false}
          pages={pages}
          capMessage={capMessage}
          truncated={truncated}
          onFiles={(files) => void addIncoming(files)}
          onRemove={removePage}
          onStart={() => void runScan({ pages })}
          onDemo={(fixtureId) => void runDemo(fixtureId)}
          onPaste={() => setStage("paste")}
        />
      ) : null}

      <input
        ref={pickRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void addIncoming(files);
        }}
      />

      <Link className="pb-4 text-center text-sm text-white/40 underline underline-offset-4" href="/">
        Back home
      </Link>
    </main>
  );
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function PageThumbs({ pages, truncated }: { pages: TrayPage[]; truncated: boolean }) {
  if (!pages.length) return null;
  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-3 gap-2">
        {pages.map((page, index) => (
          <li key={page.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.thumbUrl}
              alt={`Page ${index + 1}`}
              className="h-20 w-full rounded-xl bg-white/5 object-contain"
            />
          </li>
        ))}
      </ul>
      <p data-testid="page-count" className="text-sm text-white/80">
        {pages.length} {pages.length === 1 ? "page" : "pages"}
      </p>
      {truncated ? (
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
  pages,
  truncated,
  onCancel,
  onRetry,
}: {
  stage: Stage;
  progress: number;
  pages: TrayPage[];
  truncated: boolean;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const [topicsOn, setTopicsOn] = useState(false);
  const [buildOn, setBuildOn] = useState(false);
  const [slow, setSlow] = useState(false);
  const checklist = stage === "reading";

  useEffect(() => {
    if (stage !== "reading") return;
    const topics = window.setTimeout(() => setTopicsOn(true), 2000);
    const build = window.setTimeout(() => setBuildOn(true), 4000);
    const note = window.setTimeout(() => setSlow(true), SLOW_NOTE_MS);
    return () => {
      window.clearTimeout(topics);
      window.clearTimeout(build);
      window.clearTimeout(note);
    };
  }, [stage]);

  const reading: ItemState = topicsOn || buildOn ? "done" : stage === "reading" ? "active" : "todo";
  const topics: ItemState = buildOn ? "done" : topicsOn ? "active" : "todo";
  const building: ItemState = buildOn ? "active" : "todo";
  const status =
    stage === "preparing"
      ? "Getting your pages ready…"
      : stage === "uploading"
        ? `Uploading… ${Math.round(progress * 100)}%`
        : stage === "reading"
          ? buildOn
            ? "Building your quiz…"
            : topicsOn
              ? "Finding topics…"
              : "Reading pages…"
          : "Stopped. Your pages are still here.";

  return (
    <section className="card space-y-3">
      <PageThumbs pages={pages} truncated={truncated} />
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
          <CheckItem label="Reading pages" state={reading} />
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
  pages,
  onAction,
  onPaste,
}: {
  view: ScanErrorView;
  pages: TrayPage[];
  onAction: () => void;
  onPaste: () => void;
}) {
  return (
    <section className="card space-y-3" role="alert">
      <PageThumbs pages={pages} truncated={false} />
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
