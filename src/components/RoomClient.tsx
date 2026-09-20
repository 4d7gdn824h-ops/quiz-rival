"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getCatalogItem } from "@/data/catalog";
import { QUESTION_MS, POLL_MS } from "@/lib/constants";
import { fetchSnapshot, joinRoom, roomAction } from "@/lib/client/api";
import {
  markLevelCompleted,
  readCompletedLevelIds,
} from "@/lib/client/path-progress";
import { readSession, writeSession } from "@/lib/client/session";
import { questionSpeechText, type SpeechLocale } from "@/lib/client/speech";
import type { RoomSnapshot } from "@/lib/game/types";
import { ReadAloudButton } from "./ReadAloudButton";
import { Scoreboard, seatYouVsThem } from "./Scoreboard";
import { TimerBar } from "./TimerBar";
import { TinyPath } from "./TinyPath";

export function RoomClient({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needJoin, setNeedJoin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const applySnap = useCallback((next: RoomSnapshot) => {
    if (next.room.status === "finished" && next.room.quizId && next.room.levelId) {
      markLevelCompleted(next.room.quizId, next.room.levelId);
    }
    setSnapshot(next);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = readSession();
      const pid = session?.roomCode === code ? session.playerId : undefined;
      try {
        const snap = await fetchSnapshot(code, pid);
        if (cancelled) return;
        applySnap(snap);
        if (pid && snap.players.some((p) => p.id === pid)) {
          setPlayerId(pid);
          setName(session?.name ?? "");
          setNeedJoin(false);
        } else {
          setNeedJoin(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Room not found");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySnap, code]);

  useEffect(() => {
    if (!ready || needJoin) return;
    const poll = window.setInterval(() => {
      void fetchSnapshot(code, playerId ?? undefined)
        .then(applySnap)
        .catch(() => undefined);
    }, POLL_MS);

    let source: EventSource | null = null;
    try {
      const qs = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
      source = new EventSource(`/api/rooms/${code}/events${qs}`);
      source.onmessage = (event) => {
        const data = JSON.parse(event.data) as RoomSnapshot & { error?: string };
        if (!data.error && data.room) applySnap(data);
      };
    } catch {
      /* polling still runs */
    }

    return () => {
      window.clearInterval(poll);
      source?.close();
    };
  }, [applySnap, code, needJoin, playerId, ready]);

  useEffect(() => {
    if (snapshot?.room.status !== "playing" || !playerId) return;
    const id = window.setInterval(() => {
      if (!snapshot.room.questionEndsAt) return;
      if (Date.now() >= snapshot.room.questionEndsAt) {
        void roomAction(code, { action: "tick", playerId })
          .then(applySnap)
          .catch(() => undefined);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [applySnap, code, playerId, snapshot?.room.questionEndsAt, snapshot?.room.status]);

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await joinRoom({ code, name });
      writeSession({
        playerId: result.player.id,
        roomCode: result.player.roomCode,
        name: result.player.name,
      });
      setPlayerId(result.player.id);
      setNeedJoin(false);
      applySnap(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    if (!playerId) return;
    setBusy(true);
    try {
      applySnap(await roomAction(code, { action: "start", playerId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function onAnswer(choice: string) {
    if (!playerId || !snapshot?.currentQuestion || snapshot.yourAnswer) return;
    try {
      applySnap(
        await roomAction(code, {
          action: "answer",
          playerId,
          questionId: snapshot.currentQuestion.id,
          choice,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Answer failed");
    }
  }

  async function onRematch() {
    if (!playerId) return;
    setBusy(true);
    try {
      applySnap(
        await roomAction(code, {
          action: "rematch",
          playerId,
          switchVariant: true,
          reshuffle: true,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rematch failed");
    } finally {
      setBusy(false);
    }
  }

  const completedIds = snapshot?.room.quizId
    ? readCompletedLevelIds(snapshot.room.quizId)
    : [];

  async function onSelectLevel(levelId: string) {
    if (!playerId) return;
    setBusy(true);
    try {
      applySnap(await roomAction(code, { action: "selectLevel", playerId, levelId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pick that level");
    } finally {
      setBusy(false);
    }
  }

  const you = snapshot?.players.find((p) => p.id === playerId);
  const isHost = you?.isHost ?? false;
  const spacedCode = useMemo(() => code.split("").join(" "), [code]);
  const currentLevelTitle = snapshot?.levels.find(
    (level) => level.id === snapshot.room.currentLevelId && !level.mega,
  )?.title;
  const packLang: SpeechLocale =
    getCatalogItem(snapshot?.room.quizId ?? "")?.language === "en" ? "en" : "pl";

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-md flex-1 items-center justify-center px-4">
        <p className="text-white/60">Opening room…</p>
      </main>
    );
  }

  if (error && !snapshot) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-4">
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-red-200" role="alert">
          {error}
        </p>
        <Link className="btn-secondary text-center" href="/">
          Back home
        </Link>
      </main>
    );
  }

  if (!snapshot || needJoin) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-center font-display text-4xl">{spacedCode}</h1>
        <form onSubmit={onJoin} className="card space-y-4">
          <h2 className="font-display text-2xl">Join this room</h2>
          <label className="block space-y-2">
            <span className="text-sm">Display name</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={16}
            />
          </label>
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? "Joining…" : "Join"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      {snapshot.room.status === "lobby" || snapshot.room.status === "playing" ? (
        <div className="sticky top-0 z-20 -mx-4 -mt-6 border-b border-white/5 bg-[#0c1022]/90 px-4 pt-4 pb-2 backdrop-blur-md">
          <Scoreboard
            players={snapshot.players}
            youId={playerId ?? undefined}
            live={snapshot.room.status === "playing"}
          />
        </div>
      ) : null}

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Room</p>
          <p className="font-display text-3xl tracking-[0.2em]">{spacedCode}</p>
        </div>
        <div className="text-right text-sm text-white/60">
          <p>{snapshot.room.quizTitle}</p>
          <p>Variant {snapshot.room.variant}</p>
        </div>
      </header>

      {error ? (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {snapshot.room.status === "lobby" ? (
        <section className="card space-y-4">
          <h2 className="font-display text-3xl">Lobby</h2>
          <p className="text-white/70">
            {snapshot.players.length < 2
              ? "Share the code. Wait for your sibling, then start."
              : "Both here. Host can start the 25s race."}
          </p>
          {snapshot.levels.length > 0 ? (
            <div className="space-y-2">
              <TinyPath
                levels={snapshot.levels.filter((level) => !level.mega)}
                completedIds={completedIds}
                currentId={snapshot.room.levelId ?? snapshot.room.currentLevelId}
                disabled={busy || !isHost}
                onSelect={isHost ? (levelId) => void onSelectLevel(levelId) : undefined}
              />
              <p className="text-xs text-white/45">
                {snapshot.room.levelId
                  ? "This room is one micro-round. Host can tap another unlocked node."
                  : "Tap a node for a micro-round, or Start the full pack."}
              </p>
            </div>
          ) : null}
          {isHost ? (
            <button className="btn-primary" onClick={() => void onStart()} disabled={busy}>
              {busy ? "Starting…" : "Start"}
            </button>
          ) : (
            <p className="rounded-2xl bg-white/5 px-4 py-3 text-white/70">
              Waiting for host to tap Start…
            </p>
          )}
        </section>
      ) : null}

      {snapshot.room.status === "playing" && snapshot.currentQuestion ? (
        <section className="space-y-4">
          <TimerBar endsAt={snapshot.room.questionEndsAt} totalMs={QUESTION_MS} />
          <article className="card space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
              Question {snapshot.room.currentQuestionIndex + 1} / {snapshot.room.questionCount}
              {currentLevelTitle ? ` · ${currentLevelTitle}` : ""}
            </p>
            <h2 className="font-display text-[1.65rem] leading-snug">
              {snapshot.currentQuestion.prompt}
            </h2>
            <ReadAloudButton
              text={questionSpeechText(snapshot.currentQuestion)}
              lang={packLang}
              idleLabel={packLang === "en" ? "Read" : "Czytaj"}
              className="btn-read w-full"
            />
          </article>
          <div className="grid gap-3">
            {snapshot.currentQuestion.options.map((option) => {
              const selected = snapshot.yourAnswer === option.id;
              const locked = Boolean(snapshot.yourAnswer);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void onAnswer(option.id)}
                  disabled={locked}
                  className={`answer ${selected ? "answer-on" : ""}`}
                >
                  <span className="font-display text-xl text-lime-300">{option.id}</span>
                  <span className="text-left text-base font-medium leading-snug">
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>
          {snapshot.yourAnswer ? (
            <p className="text-center text-sm text-lime-200">
              Locked in. Keys stay hidden until the parent screen.
            </p>
          ) : (
            <p className="text-center text-sm text-white/45">Tap an answer. You get one shot.</p>
          )}
        </section>
      ) : null}

      {snapshot.room.status === "finished" ? (
        <WinnerPanel
          snapshot={snapshot}
          youId={playerId}
          isHost={isHost}
          busy={busy}
          completedIds={completedIds}
          onRematch={() => void onRematch()}
          onSelectLevel={isHost ? (levelId) => void onSelectLevel(levelId) : undefined}
        />
      ) : null}

      <Link className="pb-4 text-center text-sm text-white/40 underline underline-offset-4" href="/">
        Leave room
      </Link>
    </main>
  );
}

function WinnerPanel({
  snapshot,
  youId,
  isHost,
  busy,
  completedIds,
  onRematch,
  onSelectLevel,
}: {
  snapshot: RoomSnapshot;
  youId: string | null;
  isHost: boolean;
  busy: boolean;
  completedIds: readonly string[];
  onRematch: () => void;
  onSelectLevel?: (levelId: string) => void;
}) {
  const { you, them } = seatYouVsThem(snapshot.players, youId ?? undefined);
  const youWonSole =
    Boolean(you && snapshot.winnerIds.length === 1 && snapshot.winnerIds[0] === you.id);
  const theyWonSole =
    Boolean(them && snapshot.winnerIds.length === 1 && snapshot.winnerIds[0] === them.id);
  const outcome = youWonSole ? "you" : theyWonSole ? "them" : "tie";
  const headline =
    outcome === "you" ? "YOU WON" : outcome === "them" ? "THEY WON" : "IT'S A TIE";
  const youScore = you?.score ?? 0;
  const themScore = them?.score ?? 0;
  const gap = youScore - themScore;
  const gapText = gap > 0 ? `+${gap}` : gap === 0 ? "0" : `−${Math.abs(gap)}`;
  const gapCaption =
    gap > 0 ? "points ahead" : gap < 0 ? "points behind" : "score gap";
  const gapSpoken =
    gap === 0
      ? `Tied ${youScore} to ${themScore}`
      : gap > 0
        ? `You won by ${gap}, ${youScore} to ${themScore}`
        : `They won by ${Math.abs(gap)}, ${themScore} to ${youScore}`;

  return (
    <section className="card winner-card space-y-5 text-center">
      <p className="winner-kicker">Final</p>
      <h2 className={`winner-headline is-${outcome}`} data-winner={outcome}>
        {headline}
      </h2>
      <div className="winner-gap-block" aria-label={gapSpoken}>
        <p className={`winner-gap is-${outcome}`} data-score-gap={String(gap)}>
          {gapText}
        </p>
        <p className="winner-gap-caption">{gapCaption}</p>
      </div>
      <div className="winner-scoreline" aria-hidden="true">
        <div className="winner-score-side">
          <p className="winner-score-tag is-you">You</p>
          <p className="winner-score is-you">{youScore}</p>
          <p className="winner-score-name">{you?.name ?? "You"}</p>
        </div>
        <p className="winner-score-dash">–</p>
        <div className="winner-score-side">
          <p className="winner-score-tag is-them">Them</p>
          <p className="winner-score is-them">{themScore}</p>
          <p className="winner-score-name">{them?.name ?? "Waiting"}</p>
        </div>
      </div>
      {isHost ? (
        <button className="btn-rematch" onClick={onRematch} disabled={busy} data-cta="rematch">
          <span className="btn-rematch-label">{busy ? "Resetting…" : "Rematch"}</span>
          <span className="btn-rematch-meta">Switch A↔B + shuffle</span>
        </button>
      ) : (
        <p className="winner-wait">Host can tap Rematch for another round.</p>
      )}
      {snapshot.levels.filter((level) => !level.mega).length ? (
        <div className="space-y-2 text-left">
          <TinyPath
            levels={snapshot.levels.filter((level) => !level.mega)}
            completedIds={completedIds}
            currentId={snapshot.room.levelId ?? snapshot.room.currentLevelId}
            disabled={busy || !isHost}
            onSelect={onSelectLevel}
          />
          <p className="text-xs text-white/45">
            That node is done. Tap the next unlocked one for the following micro-round.
          </p>
        </div>
      ) : null}
      {isHost ? (
        <Link
          className="block text-sm text-white/55 underline underline-offset-4"
          href={`/parent/key?pack=${snapshot.room.quizId}&variant=${snapshot.room.variant}`}
        >
          Review keys (parent)
        </Link>
      ) : null}
    </section>
  );
}
