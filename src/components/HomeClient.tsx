"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PACK_CATALOG } from "@/data/catalog";
import { listTinyLevels } from "@/data/levels";
import type { PublicLevel, QuizVariant } from "@/data/types";
import { createRoom, joinRoom } from "@/lib/client/api";
import { readCompletedLevelIds } from "@/lib/client/path-progress";
import { writeSession } from "@/lib/client/session";
import { normalizeRoomCode } from "@/lib/ids";
import { TinyPath } from "./TinyPath";

export function HomeClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [quizId, setQuizId] = useState(PACK_CATALOG[0]?.id ?? "chlopi");
  const [variant, setVariant] = useState<QuizVariant>("A");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const selected = useMemo(
    () => PACK_CATALOG.find((pack) => pack.id === quizId),
    [quizId],
  );

  const pathLevels = useMemo<PublicLevel[]>(
    () =>
      listTinyLevels(quizId).map((level) => ({
        id: level.id,
        title: level.title,
        theme: level.theme,
        questionCount: level.questionIds[variant]?.length ?? 0,
        mega: level.mega,
      })),
    [quizId, variant],
  );

  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setCompletedIds(readCompletedLevelIds(quizId));
    sync();
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [quizId]);

  async function openRoom(levelId?: string) {
    const result = await createRoom({
      name,
      quizId,
      variant,
      ...(levelId ? { playlistId: "tiny" as const, levelId } : {}),
    });
    writeSession({
      playerId: result.player.id,
      roomCode: result.player.roomCode,
      name: result.player.name,
    });
    router.push(`/room/${result.player.roomCode}`);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("create");
    try {
      await openRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
    } finally {
      setBusy(null);
    }
  }

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy("join");
    try {
      const code = normalizeRoomCode(joinCode);
      const result = await joinRoom({ code, name });
      writeSession({
        playerId: result.player.id,
        roomCode: result.player.roomCode,
        name: result.player.name,
      });
      router.push(`/room/${result.player.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-lime-300">
          Live sibling challenge
        </p>
        <h1 className="font-display text-5xl font-bold tracking-tight">QuizRival</h1>
        <p className="text-base text-white/70">
          Two kids. One quiz. Timer. Winner.
        </p>
      </header>

      <Link href="/write" className="card block space-y-1 no-underline">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
          Kartkówka · 26 września
        </p>
        <h2 className="font-display text-3xl">Napisz wypracowanie</h2>
        <p className="text-sm text-white/70">Write essay · pytanie problemowe · ~100 słów</p>
      </Link>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Your display name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          name="displayName"
          autoComplete="nickname"
          maxLength={16}
          placeholder="e.g. Zosia"
          className="field"
        />
      </label>

      {error ? (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={onCreate} className="card space-y-4">
        <h2 className="font-display text-2xl">Create room</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-white/80">Quiz pack</legend>
          <div className="grid gap-2">
            {PACK_CATALOG.map((pack) => (
              <label
                key={pack.id}
                className={`choice ${quizId === pack.id ? "choice-on" : ""}`}
              >
                <input
                  type="radio"
                  name="pack"
                  value={pack.id}
                  checked={quizId === pack.id}
                  onChange={() => setQuizId(pack.id)}
                  className="sr-only"
                />
                <span className="block font-semibold">{pack.title}</span>
                <span className="block text-sm text-white/60">{pack.blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-white/80">Variant</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((option) => (
              <label
                key={option}
                className={`choice text-center ${variant === option ? "choice-on" : ""}`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={option}
                  checked={variant === option}
                  onChange={() => setVariant(option)}
                  className="sr-only"
                />
                <span className="font-display text-2xl"> {option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {pathLevels.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">Tiny levels</p>
            <TinyPath
              levels={pathLevels}
              completedIds={completedIds}
              disabled={busy !== null}
              onSelect={(levelId) => {
                setError(null);
                setBusy("create");
                void openRoom(levelId)
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : "Could not create room");
                  })
                  .finally(() => setBusy(null));
              }}
            />
            <p className="text-xs text-white/45">
              Tap a node to race that micro-round. Finish it to unlock the next.
              Already-cleared nodes stay open.
            </p>
          </div>
        ) : null}
        <button className="btn-primary" disabled={busy !== null} type="submit">
          {busy === "create" ? "Opening…" : "Create room"}
        </button>
        <p className="text-xs text-white/45">
          {selected?.title} · {selected?.questionCount} questions · 25s each
          {pathLevels.length
            ? ` · or tap a node for a ${pathLevels.length}-stop tiny path`
            : ""}
        </p>
      </form>

      <form onSubmit={onJoin} className="card space-y-4">
        <h2 className="font-display text-2xl">Join room</h2>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-white/80">4-letter code</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
            name="roomCode"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="KPLM"
            className="field text-center font-display text-3xl tracking-[0.4em]"
            maxLength={4}
          />
        </label>
        <button className="btn-secondary" disabled={busy !== null} type="submit">
          {busy === "join" ? "Joining…" : "Join room"}
        </button>
      </form>

      <p className="pb-6 text-center text-sm text-white/45">
        Parent?{" "}
        <a className="underline decoration-white/30 underline-offset-4" href="/parent/key">
          Answer key + English hints
        </a>
        <span className="block pt-1">Never shown on student play screens.</span>
      </p>
    </main>
  );
}
