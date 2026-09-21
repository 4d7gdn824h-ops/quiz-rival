"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { extractHomeworkRequest, generateHomeworkRequest } from "@/lib/client/api";
import {
  readHomeworkDraft,
  writeHomeworkDraft,
  writeTonightPackId,
} from "@/lib/client/homework-draft";
import type { ExtractedNotes, HomeworkMode } from "@/lib/homework/types";
import type { PublicLevel } from "@/data/types";
import { HomeworkScanCard } from "./HomeworkScanCard";
import { TinyPath } from "./TinyPath";

export function HomeworkClient() {
  const router = useRouter();
  const [notes, setNotes] = useState<ExtractedNotes | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<HomeworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"extract" | "generate" | null>(null);
  const [packId, setPackId] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState<string | null>(null);
  const [pathLevels, setPathLevels] = useState<PublicLevel[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const draft = readHomeworkDraft();
      if (draft) {
        setNotes(draft.notes);
        setNotice(draft.notice);
        setMode(draft.mode);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
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

  async function runExtract(input: { file?: File; fixtureId?: string; forceFixture?: boolean }) {
    setBusy("extract");
    setError(null);
    setPackId(null);
    try {
      const result = await extractHomeworkRequest(input);
      setNotes(result.notes);
      setNotice(result.notice);
      setMode(result.mode);
      persist(result.notes, result.mode, result.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that scan");
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate(kept: ExtractedNotes) {
    setBusy("generate");
    setError(null);
    try {
      persist(kept);
      const result = await generateHomeworkRequest(kept);
      writeTonightPackId(result.pack.id);
      setPackId(result.pack.id);
      setPackTitle(result.pack.title);
      setPathLevels(result.pack.levels.filter((level) => !level.mega));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate pack");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Reading…</p>
      </main>
    );
  }

  const step = packId ? "done" : notes ? "confirm" : "upload";

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

      {error ? (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <HomeworkScanCard
          busy={busy === "extract"}
          onFile={(file) => void runExtract({ file })}
          onDemo={() => void runExtract({ fixtureId: "chlopi-worksheet", forceFixture: true })}
        />
      ) : null}

      {step === "confirm" && notes ? (
        <>
          <ConfirmForm
            notes={notes}
            notice={notice}
            mode={mode}
            busy={busy === "generate"}
            onGenerate={(kept) => void onGenerate(kept)}
          />
          <button
            type="button"
            className="text-sm text-white/55 underline underline-offset-4"
            onClick={() => {
              setNotes(null);
              setPackId(null);
            }}
          >
            Scan a different page
          </button>
        </>
      ) : null}

      {step === "done" && packId ? (
        <section className="card space-y-4">
          <h2 className="font-display text-2xl">Tiny path ready</h2>
          <p className="text-sm text-white/70">
            <span className="font-semibold text-lime-200">{packTitle}</span> uses the same path as
            Create room / Rematch. Host picks A/B there.
          </p>
          {pathLevels.length ? (
            <TinyPath levels={pathLevels} completedIds={[]} disabled />
          ) : null}
          <Link className="btn-primary flex items-center justify-center" href={`/?pack=${packId}`}>
            Create room
          </Link>
          <button
            type="button"
            className="text-sm text-white/55 underline underline-offset-4"
            onClick={() => {
              setPackId(null);
              router.replace("/homework");
            }}
          >
            Edit topics and generate again
          </button>
        </section>
      ) : null}

      <Link className="pb-4 text-center text-sm text-white/40 underline underline-offset-4" href="/">
        Back home
      </Link>
    </main>
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
  const [topics, setTopics] = useState(() => toChecks(notes.topics, "topic"));
  const [questions, setQuestions] = useState(() =>
    toChecks(notes.facts.length ? notes.facts : keptLineTexts(notes), "q"),
  );
  const [lines, setLines] = useState(notes.lines);

  const keptTopics = topics.filter((item) => item.keep).length;
  const keptQuestions = questions.filter((item) => item.keep).length;

  function submit() {
    const keptTopicsText = topics.filter((item) => item.keep).map((item) => item.text.trim()).filter(Boolean);
    const keptFacts = questions.filter((item) => item.keep).map((item) => item.text.trim()).filter(Boolean);
    onGenerate({
      ...notes,
      title: title.trim() || notes.title,
      topics: keptTopicsText,
      facts: keptFacts,
      lines,
      rawText: lines
        .filter((line) => line.keep)
        .map((line) => line.text)
        .join("\n"),
    });
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/70">{notice}</p>
      ) : null}
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
        {mode ?? "fixture"} · uncheck junk · no keys shown
      </p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Title</span>
        <input
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
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

      {lines.some((line) => looksLikeJunkLine(line.text)) ? (
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

function looksLikeJunkLine(text: string) {
  return /imię|imie|nazwisko|szkoła|szkola|podpis|strona\s+\d+|page\s+\d+|_{3,}/i.test(text);
}
