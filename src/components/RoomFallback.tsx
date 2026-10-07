"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { listTinyLevels } from "@/data/levels";
import type { PublicLevel, QuizVariant } from "@/data/types";
import { writeLocalPlay } from "@/lib/client/local-play";
import { toPublicLevel } from "@/lib/public-quiz";
import { TinyPath } from "./TinyPath";

export function RoomFallback({
  defaultName,
  quizId,
  variant,
  levels,
  levelId = null,
  message = "Two phones can’t join a live room right now. You can still play on this phone.",
}: {
  defaultName: string;
  quizId: string;
  variant: QuizVariant;
  levels?: PublicLevel[];
  levelId?: string | null;
  message?: string;
}) {
  const router = useRouter();
  const [name2, setName2] = useState("");
  const path =
    levels && levels.length
      ? levels.filter((level) => !level.mega)
      : listTinyLevels(quizId).map((level) => toPublicLevel(level, variant));

  function start(mode: "pass" | "solo", nextLevelId: string | null) {
    const first = defaultName.trim() || "Player 1";
    const second = name2.trim() || "Player 2";
    writeLocalPlay({
      mode,
      quizId,
      variant,
      levelId: nextLevelId,
      names: [first, second],
      startedAt: Date.now(),
    });
    router.push("/play");
  }

  return (
    <section className="card space-y-4" data-fallback="local" role="region" aria-label="Play on this phone">
      <div className="space-y-1">
        <h2 className="font-display text-2xl">Play on this phone</h2>
        <p className="text-sm text-white/70">{message}</p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-white/80">Second player</span>
        <input
          className="field"
          value={name2}
          onChange={(event) => setName2(event.target.value)}
          maxLength={16}
          placeholder="e.g. Antek"
          name="playerTwo"
        />
      </label>
      <button type="button" className="btn-primary" onClick={() => start("pass", levelId)}>
        Take turns
      </button>
      <p className="text-xs text-white/45">
        Same 25 second timer. Pass the phone. No answer keys.
      </p>
      {path.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-white/80">Or play a tiny path alone</p>
          <TinyPath
            levels={path}
            completedIds={[]}
            onSelect={(id) => start("solo", id)}
          />
        </div>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => start("solo", levelId)}>
          Practice alone
        </button>
      )}
    </section>
  );
}
