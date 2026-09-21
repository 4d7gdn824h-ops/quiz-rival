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
import { HomeworkScanCard } from "./HomeworkScanCard";

export function HomeworkClient({ startAtConfirm = false }: { startAtConfirm?: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState<ExtractedNotes | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<HomeworkMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"extract" | "generate" | null>(null);
  const [packId, setPackId] = useState<string | null>(null);
  const [packTitle, setPackTitle] = useState<string | null>(null);
  const [hasEssay, setHasEssay] = useState(false);
  const [ready, setReady] = useState(!startAtConfirm);

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

  async function onGenerate() {
    if (!notes) return;
    setBusy("generate");
    setError(null);
    try {
      const kept: ExtractedNotes = {
        ...notes,
        topics: notes.topics.map((topic) => topic.trim()).filter(Boolean),
        facts: notes.facts.map((fact) => fact.trim()).filter(Boolean),
        essayPrompts: notes.essayPrompts.map((prompt) => prompt.trim()).filter(Boolean),
      };
      const result = await generateHomeworkRequest(kept);
      persist(kept);
      writeTonightPackId(result.pack.id);
      setPackId(result.pack.id);
      setPackTitle(result.pack.title);
      setHasEssay(result.pack.hasEssay);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate pack");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Opening scan…</p>
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
          Upload → confirm notes → generate a 3–5 node path. Keys stay off student screens.
        </p>
      </header>

      {error ? (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {step === "upload" ? (
        <HomeworkScanCard
          busy={busy !== null}
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
            onChange={(next) => {
              setNotes(next);
              persist(next);
            }}
            onGenerate={() => void onGenerate()}
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
          <h2 className="font-display text-2xl">Pack ready</h2>
          <p className="text-sm text-white/70">
            <span className="font-semibold text-lime-200">{packTitle}</span> is waiting in Create
            room as Tonight’s pack. Host picks A/B there.
          </p>
          <Link className="btn-primary flex items-center justify-center" href={`/?pack=${packId}`}>
            Create room with tonight’s pack
          </Link>
          {hasEssay ? (
            <Link
              className="btn-secondary flex items-center justify-center"
              href={`/write?pack=${packId}`}
            >
              Open writing coach
            </Link>
          ) : null}
          <button
            type="button"
            className="text-sm text-white/55 underline underline-offset-4"
            onClick={() => {
              setPackId(null);
              router.replace("/homework");
            }}
          >
            Edit notes and generate again
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
  onChange,
  onGenerate,
}: {
  notes: ExtractedNotes;
  notice: string | null;
  mode: string | null;
  busy: boolean;
  onChange: (notes: ExtractedNotes) => void;
  onGenerate: () => void;
}) {
  const keptLines = notes.lines.filter((line) => line.keep).length;
  return (
    <div className="space-y-5">
      {notice ? (
        <p className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/70">{notice}</p>
      ) : null}
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">
        Mode · {mode ?? "fixture"} · {keptLines} lines kept
      </p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Title</span>
        <input
          className="field"
          value={notes.title}
          onChange={(event) => onChange({ ...notes, title: event.target.value })}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-white/80">Lines on the page</legend>
        <p className="text-xs text-white/45">Uncheck junk: name blanks, signatures, page numbers.</p>
        <div className="grid gap-2">
          {notes.lines.map((line, index) => (
            <label key={line.id} className={`choice ${line.keep ? "choice-on" : ""}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={line.keep}
                onChange={() =>
                  onChange({
                    ...notes,
                    lines: notes.lines.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, keep: !item.keep } : item,
                    ),
                  })
                }
              />
              <span className="block text-sm leading-snug text-white/85">{line.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ChipEditor
        label="Topics to quiz"
        hint="Approve themes for the tiny path. Remove junk."
        values={notes.topics}
        onChange={(topics) => onChange({ ...notes, topics })}
      />
      <ChipEditor
        label="Facts / notes"
        hint="These become multiple-choice stems — not a worked answer sheet."
        values={notes.facts}
        onChange={(facts) => onChange({ ...notes, facts })}
      />
      <ChipEditor
        label="Essay / problem prompts"
        hint="If one stays, writing coach can load it. There is no auto-essay button."
        values={notes.essayPrompts}
        onChange={(essayPrompts) => onChange({ ...notes, essayPrompts })}
      />

      <button type="button" className="btn-primary" disabled={busy} onClick={onGenerate}>
        {busy ? "Generating…" : "Generate tonight’s pack"}
      </button>
    </div>
  );
}

function ChipEditor({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-white/80">{label}</h2>
      <p className="text-xs text-white/45">{hint}</p>
      <div className="grid gap-2">
        {values.map((value, index) => (
          <div key={`${label}-${index}`} className="flex gap-2">
            <textarea
              className="field min-h-20 flex-1"
              value={value}
              onChange={(event) =>
                onChange(
                  values.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                )
              }
            />
            <button
              type="button"
              className="btn-secondary w-auto min-h-20 shrink-0 px-3"
              onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-sm text-white/55 underline underline-offset-4"
        onClick={() => onChange([...values, ""])}
      >
        Add
      </button>
    </section>
  );
}
