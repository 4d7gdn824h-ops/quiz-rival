"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PACK_CATALOG } from "@/data/catalog";
import { listTinyLevels } from "@/data/levels";
import type { PublicLevel, QuizVariant } from "@/data/types";
import { createRoom, extractHomeworkRequest, fetchPackCatalog, joinRoom } from "@/lib/client/api";
import {
  writeHomeworkDraft,
  readTonightPackId,
} from "@/lib/client/homework-draft";
import { readCompletedLevelIds } from "@/lib/client/path-progress";
import { writeSession } from "@/lib/client/session";
import type { PublicHomeworkPack } from "@/lib/homework/types";
import { normalizeRoomCode } from "@/lib/ids";
import { toPublicLevel } from "@/lib/public-quiz";
import { HomeworkScanCard } from "./HomeworkScanCard";
import { TinyPath } from "./TinyPath";

function asClientPack(item: (typeof PACK_CATALOG)[number]): PublicHomeworkPack {
  return {
    ...item,
    generated: false,
    tonight: false,
    hasEssay: item.id === "chlopi",
    levels: listTinyLevels(item.id).map((level) => toPublicLevel(level, "A")),
  };
}

export function HomeClient({ initialPackId }: { initialPackId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [packs, setPacks] = useState<PublicHomeworkPack[]>(() => PACK_CATALOG.map(asClientPack));
  const [quizId, setQuizId] = useState(initialPackId || PACK_CATALOG[0]?.id || "chlopi");
  const [variant, setVariant] = useState<QuizVariant>("A");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | "extract" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPackCatalog()
      .then(({ packs: next }) => {
        if (cancelled) return;
        setPacks(next);
        const tonight = next.find((pack) => pack.tonight)?.id ?? readTonightPackId();
        const preferred = initialPackId || tonight;
        if (preferred && next.some((pack) => pack.id === preferred)) {
          setQuizId(preferred);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [initialPackId]);

  const selected = useMemo(
    () => packs.find((pack) => pack.id === quizId) ?? packs[0],
    [packs, quizId],
  );

  const pathLevels = useMemo<PublicLevel[]>(
    () => selected?.levels?.filter((level) => !level.mega) ?? [],
    [selected],
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

  async function runExtract(input: { file?: File; fixtureId?: string; forceFixture?: boolean }) {
    setError(null);
    setBusy("extract");
    try {
      const result = await extractHomeworkRequest(input);
      writeHomeworkDraft({
        extractId: result.id,
        notes: result.notes,
        mode: result.mode,
        notice: result.notice,
      });
      router.push("/homework");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that scan");
      setBusy(null);
    }
  }

  const writeHref = selected?.hasEssay
    ? selected.generated
      ? `/write?pack=${selected.id}`
      : "/write"
    : "/write";
  const writeKicker = selected?.generated && selected.hasEssay ? "Tonight’s prompt" : "Kartkówka · 26 września";
  const writeBlurb =
    selected?.generated && selected.hasEssay
      ? "Write essay · prompt from the scan · scaffold only"
      : "Write essay · pytanie problemowe · ~100 słów";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="space-y-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-lime-300">
          Live sibling challenge
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">QuizRival</h1>
        <p className="text-sm text-white/70">Two kids. One quiz. Timer. Winner.</p>
      </header>

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

      <form onSubmit={onCreate} className="card card-hero space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-3xl">Create room</h2>
          <p className="text-sm text-white/65">Host the sibling race. Share the 4-letter code.</p>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-white/80">Quiz pack</legend>
          <div className="grid gap-2">
            {packs.map((pack) => (
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
                <span className="block font-semibold">
                  {pack.title}
                  {pack.tonight ? (
                    <span className="ml-2 rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
                      Tonight
                    </span>
                  ) : null}
                </span>
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

      <HomeworkScanCard
        busy={busy !== null}
        onFile={(file) => void runExtract({ file })}
        onDemo={() => void runExtract({ fixtureId: "chlopi-worksheet", forceFixture: true })}
      />

      <Link
        href={writeHref}
        className="card card-quiet flex items-center justify-between gap-3 no-underline"
      >
        <span className="min-w-0 space-y-0.5">
          <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-orange-300">
            {writeKicker}
          </span>
          <h2 className="font-display text-xl leading-tight">Napisz wypracowanie</h2>
          <span className="block text-xs text-white/55">{writeBlurb}</span>
        </span>
        <span className="shrink-0 text-white/40" aria-hidden="true">
          →
        </span>
      </Link>

      {pathLevels.length ? (
        <section className="card space-y-2">
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
        </section>
      ) : null}

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
        <a
          className="underline decoration-white/30 underline-offset-4"
          href={`/parent/key${selected ? `?pack=${selected.id}&variant=${variant}` : ""}`}
        >
          Answer key + English hints
        </a>
        <span className="block pt-1">Never shown on student play screens.</span>
      </p>
    </main>
  );
}
