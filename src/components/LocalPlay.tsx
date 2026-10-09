"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicQuestion } from "@/data/types";
import { readHomeworkDraft } from "@/lib/client/homework-draft";
import {
  readLocalPlay,
  readPlayKit,
  writeLocalPlay,
  type LocalPlaySetup,
} from "@/lib/client/local-play";
import { markLevelCompleted, readCompletedLevelIds } from "@/lib/client/path-progress";
import { questionSpeechText, readAloudIdleLabel } from "@/lib/client/speech";
import { QUESTION_MS } from "@/lib/constants";
import { roundFromKit } from "@/lib/play/round-from-kit";
import type { PublicRound } from "@/lib/play/types";
import { turnLabel } from "@/lib/copy";
import { ReadAloudButton } from "./ReadAloudButton";
import { Scoreboard } from "./Scoreboard";
import { TimerBar } from "./TimerBar";
import { TinyPath } from "./TinyPath";

type Phase = "loading" | "question" | "handoff" | "done" | "missing";

export function LocalPlay() {
  const [setup, setSetup] = useState<LocalPlaySetup | null>(null);
  const [round, setRound] = useState<PublicRound | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [pending, setPending] = useState<[number, number]>([0, 0]);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [qIndex, setQIndex] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [frozenMs, setFrozenMs] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolved = useRef(false);
  const completedIds = setup ? readCompletedLevelIds(setup.quizId) : [];
  const beginRef = useRef<
    (questionIndex: number, player: 0 | 1, nextScores?: [number, number]) => void
  >(() => undefined);

  useEffect(() => {
    beginRef.current = (questionIndex, player, nextScores = scores) => {
      resolved.current = false;
      setScores(nextScores);
      setPending([0, 0]);
      setQIndex(questionIndex);
      setTurn(player);
      setPicked(null);
      setPaused(false);
      setFrozenMs(null);
      setEndsAt(Date.now() + QUESTION_MS);
      setPhase("question");
      setBusy(false);
    };
  }, [scores]);

  const loadRound = useCallback(async (next: LocalPlaySetup) => {
    setPhase("loading");
    setError(null);
    const kit = readPlayKit(next.quizId);
    if (kit) {
      const built = roundFromKit(kit, next.variant, next.levelId);
      if (!built.questions.length) {
        setError("That path has no questions.");
        setPhase("missing");
        return;
      }
      setRound(built);
      beginRef.current(0, 0, [0, 0]);
      return;
    }
    const params = new URLSearchParams({
      quizId: next.quizId,
      variant: next.variant,
    });
    if (next.levelId) params.set("levelId", next.levelId);
    const response = await fetch(`/api/play/round?${params}`, { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as PublicRound & { error?: string };
    if (!response.ok) {
      setError(data.error || "Could not open that practice round.");
      setPhase("missing");
      return;
    }
    setRound(data);
    beginRef.current(0, 0, [0, 0]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const saved = readLocalPlay();
      if (!saved) {
        setPhase("missing");
        return;
      }
      setSetup(saved);
      void loadRound(saved).catch(() => {
        if (cancelled) return;
        setError("Could not open that practice round.");
        setPhase("missing");
      });
    });
    return () => {
      cancelled = true;
    };
  }, [loadRound]);

  const finishTurn = useCallback(
    async (choice: string | null) => {
      if (resolved.current || !round || !setup || phase !== "question") return;
      resolved.current = true;
      setBusy(true);
      setPicked(choice);
      let point = 0;
      if (choice) {
        try {
          point = (await gradeChoice(setup, round.questions[qIndex], choice)) ? 1 : 0;
        } catch (err) {
          resolved.current = false;
          setBusy(false);
          setError(err instanceof Error ? err.message : "Could not check that answer.");
          return;
        }
      }
      const nextPending: [number, number] = [...pending] as [number, number];
      nextPending[turn] = point;
      setPending(nextPending);
      setError(null);
      setBusy(false);
      const players = setup.mode === "pass" ? 2 : 1;
      if (turn + 1 < players) {
        setPhase("handoff");
        setEndsAt(null);
        return;
      }
      const nextScores: [number, number] = [
        scores[0] + nextPending[0],
        scores[1] + nextPending[1],
      ];
      const nextIndex = qIndex + 1;
      if (nextIndex >= round.questions.length) {
        setScores(nextScores);
        if (round.levelId) markLevelCompleted(setup.quizId, round.levelId);
        setPhase("done");
        return;
      }
      beginRef.current(nextIndex, 0, nextScores);
    },
    [pending, phase, qIndex, round, scores, setup, turn],
  );

  useEffect(() => {
    if (phase !== "question" || paused || !endsAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= endsAt) void finishTurn(null);
    }, 200);
    return () => window.clearInterval(id);
  }, [endsAt, finishTurn, paused, phase]);

  function handoffReady() {
    if (!setup) return;
    resolved.current = false;
    setTurn(1);
    setPicked(null);
    setPaused(false);
    setFrozenMs(null);
    setEndsAt(Date.now() + QUESTION_MS);
    setPhase("question");
  }

  function togglePause() {
    if (phase !== "question" || !endsAt) return;
    if (!paused) {
      setFrozenMs(Math.max(0, endsAt - Date.now()));
      setPaused(true);
      setEndsAt(null);
      return;
    }
    setEndsAt(Date.now() + (frozenMs ?? QUESTION_MS));
    setFrozenMs(null);
    setPaused(false);
  }

  function playLevel(levelId: string) {
    if (!setup) return;
    const next = { ...setup, levelId, startedAt: Date.now() };
    writeLocalPlay(next);
    setSetup(next);
    setScores([0, 0]);
    void loadRound(next);
  }

  function playAgain() {
    if (!setup) return;
    const next = {
      ...setup,
      variant: setup.variant === "A" ? "B" as const : "A" as const,
      startedAt: Date.now(),
    };
    writeLocalPlay(next);
    setSetup(next);
    setScores([0, 0]);
    void loadRound(next);
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Opening practice…</p>
      </main>
    );
  }

  if (phase === "missing" || !setup || !round) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4">
        <p className="text-sm text-white/70">
          {error || "Pick a pack on the home screen, then practice on this phone."}
        </p>
        <Link className="btn-secondary text-center" href="/">
          Back home
        </Link>
      </main>
    );
  }

  const question = round.questions[qIndex];
  const names = setup.names;
  const activeName = names[turn] || (turn === 0 ? "Player 1" : "Player 2");
  const otherName = names[turn === 0 ? 1 : 0] || "Player 2";
  const players =
    setup.mode === "pass"
      ? [
          { id: "p0", name: names[0] || "Player 1", score: scores[0], isHost: true, answeredCurrent: false },
          { id: "p1", name: names[1] || "Player 2", score: scores[1], isHost: false, answeredCurrent: false },
        ]
      : [];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6" data-local-play={setup.mode}>
      {setup.mode === "pass" ? (
        <div className="sticky top-0 z-20 -mx-4 -mt-6 border-b border-white/5 bg-[#0c1022]/90 px-4 pt-4 pb-2 backdrop-blur-md">
          <Scoreboard players={players} youId={turn === 0 ? "p0" : "p1"} live={phase === "question"} />
        </div>
      ) : (
        <p className="text-sm font-semibold text-lime-200" data-solo-score={scores[0]}>
          Score {scores[0]}
        </p>
      )}

      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.28em] text-white/50">
          {setup.mode === "pass" ? "Pass and play" : "Tiny path"}
        </p>
        <h1 className="title-clamp font-display text-3xl" title={round.title} data-testid="quiz-title">
          {round.title}
        </h1>
        {round.levelTitle ? (
          <p className="title-clamp text-sm text-white/60" title={round.levelTitle}>
            {round.levelTitle}
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {phase === "question" && question ? (
        <QuestionCard
          question={question}
          index={qIndex}
          total={round.questions.length}
          levelTitle={round.levelTitle}
          language={round.language}
          activeName={activeName}
          endsAt={paused ? null : endsAt}
          frozenMs={paused ? frozenMs : null}
          picked={picked}
          paused={paused}
          busy={busy}
          onPick={(choice) => void finishTurn(choice)}
          onPause={togglePause}
        />
      ) : null}

      {phase === "handoff" ? (
        <section className="card space-y-4 text-center">
          <h2 className="font-display text-3xl">Pass the phone</h2>
          <p className="text-sm text-white/70">
            {otherName} gets the same question and a fresh 25 seconds. Answers stay hidden.
          </p>
          <button type="button" className="btn-primary" onClick={handoffReady}>
            {otherName} is ready
          </button>
        </section>
      ) : null}

      {phase === "done" ? (
        <DoneCard
          mode={setup.mode}
          names={names}
          scores={scores}
          levels={round.levels}
          completedIds={round.levelId ? [...completedIds, round.levelId] : completedIds}
          currentId={round.levelId}
          onAgain={playAgain}
          onSelectLevel={playLevel}
        />
      ) : null}

      <Link className="pb-2 text-center text-sm text-white/40 underline underline-offset-4" href="/">
        Leave
      </Link>
    </main>
  );
}

function QuestionCard({
  question,
  index,
  total,
  levelTitle,
  language,
  activeName,
  endsAt,
  frozenMs,
  picked,
  paused,
  busy,
  onPick,
  onPause,
}: {
  question: PublicQuestion;
  index: number;
  total: number;
  levelTitle: string | null;
  language: string;
  activeName: string;
  endsAt: number | null;
  frozenMs: number | null;
  picked: string | null;
  paused: boolean;
  busy: boolean;
  onPick: (choice: string) => void;
  onPause: () => void;
}) {
  return (
    <section className="space-y-4">
      <p className="text-sm font-semibold text-lime-200" data-testid="turn-label">
        {turnLabel(activeName)}
      </p>
      <TimerBar endsAt={endsAt} frozenRemainingMs={frozenMs} totalMs={QUESTION_MS} />
      {paused ? null : (
        <button type="button" className="btn-secondary" onClick={onPause} disabled={busy}>
          Pause
        </button>
      )}
      <div className="relative space-y-4">
        <div className={`space-y-4 ${paused ? "pointer-events-none select-none" : ""}`} inert={paused ? true : undefined}>
          <article className="card space-y-4" data-testid={index === 0 ? "question-1" : undefined}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
              Question {index + 1} / {total}
              {levelTitle ? ` · ${levelTitle}` : ""}
            </p>
            <h2 className="font-display text-[1.65rem] leading-snug">{question.prompt}</h2>
            <ReadAloudButton
              text={questionSpeechText(question)}
              lang={language}
              idleLabel={readAloudIdleLabel(language)}
              className="btn-read w-full"
            />
          </article>
          <div className="grid gap-3">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`answer ${picked === option.id ? "answer-on" : ""}`}
                disabled={Boolean(picked) || busy || paused}
                onClick={() => onPick(option.id)}
              >
                <span className="font-display text-xl text-lime-300">{option.id}</span>
                <span className="text-left text-base font-medium leading-snug">{option.text}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-white/45">
            {picked ? "Locked in. Keys stay hidden." : "Tap an answer. You get one shot."}
          </p>
        </div>
        {paused ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-[#0c1022]/95 px-5 py-8 text-center"
            role="dialog"
            aria-modal="true"
            data-paused="true"
          >
            <p className="font-display text-5xl font-bold">Paused</p>
            <button type="button" className="btn-primary" onClick={onPause}>
              Resume
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DoneCard({
  mode,
  names,
  scores,
  levels,
  completedIds,
  currentId,
  onAgain,
  onSelectLevel,
}: {
  mode: "pass" | "solo";
  names: [string, string];
  scores: [number, number];
  levels: PublicRound["levels"];
  completedIds: string[];
  currentId: string | null;
  onAgain: () => void;
  onSelectLevel: (levelId: string) => void;
}) {
  if (mode === "solo") {
    return (
      <section className="card space-y-4 text-center">
        <p className="winner-kicker">Practice</p>
        <h2 className="font-display text-4xl">Round done</h2>
        <p className="text-sm text-white/70">Score {scores[0]}. Answer keys stay hidden.</p>
        <button type="button" className="btn-rematch" onClick={onAgain}>
          <span className="btn-rematch-label">Play again</span>
          <span className="btn-rematch-meta">Switch A↔B</span>
        </button>
        {levels.length ? (
          <div className="space-y-2 text-left">
            <TinyPath
              levels={levels}
              completedIds={completedIds}
              currentId={currentId}
              onSelect={onSelectLevel}
            />
          </div>
        ) : null}
      </section>
    );
  }

  const gap = scores[0] - scores[1];
  const headline = gap === 0 ? "It's a tie" : gap > 0 ? `${names[0]} won` : `${names[1]} won`;
  const outcome = gap === 0 ? "tie" : gap > 0 ? "you" : "them";
  return (
    <section className="card winner-card space-y-5 text-center">
      <p className="winner-kicker">Final</p>
      <h2 className={`winner-headline is-${outcome}`} data-winner={outcome}>
        {headline}
      </h2>
      <div className="winner-scoreline" aria-hidden="true">
        <div className="winner-score-side">
          <p className="winner-score-tag is-you">You</p>
          <p className="winner-score is-you">{scores[0]}</p>
          <p className="winner-score-name">{names[0]}</p>
        </div>
        <p className="winner-score-dash">–</p>
        <div className="winner-score-side">
          <p className="winner-score-tag is-them">Them</p>
          <p className="winner-score is-them">{scores[1]}</p>
          <p className="winner-score-name">{names[1]}</p>
        </div>
      </div>
      <p className="text-sm text-white/55">Answer keys stay hidden.</p>
      <button type="button" className="btn-rematch" onClick={onAgain} data-cta="rematch">
        <span className="btn-rematch-label">Play again</span>
        <span className="btn-rematch-meta">Switch A↔B</span>
      </button>
      {levels.length ? (
        <div className="space-y-2 text-left">
          <TinyPath
            levels={levels}
            completedIds={completedIds}
            currentId={currentId}
            onSelect={onSelectLevel}
          />
        </div>
      ) : null}
    </section>
  );
}

async function gradeChoice(setup: LocalPlaySetup, question: PublicQuestion, choice: string) {
  const kit = readPlayKit(setup.quizId);
  const draft = readHomeworkDraft();
  const response = await fetch("/api/play/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quizId: setup.quizId,
      variant: setup.variant,
      questionId: question.id,
      choice,
      notes: kit && !kit.gradeSeal ? draft?.notes : undefined,
      gradeSeal: kit?.gradeSeal ?? undefined,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    correct?: boolean;
    error?: string;
    correctOptionId?: string;
    parentHint?: string;
  };
  if (!response.ok) throw new Error(data.error || "Could not check that answer.");
  if ("correctOptionId" in data || "parentHint" in data || "answerKey" in data) {
    throw new Error("Could not check that answer.");
  }
  return Boolean(data.correct);
}
