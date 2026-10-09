"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { QuizVariant } from "@/data/types";
import type { AnswerKeyView } from "@/lib/homework/answer-key-view";

export function ParentKeyClient({
  initial,
  variant,
}: {
  initial: AnswerKeyView | null;
  variant: QuizVariant;
}) {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [unlocked, setUnlocked] = useState<AnswerKeyView | null | undefined>(undefined);
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const packId = params.get("pack");
  const parentKey = params.get("key");
  const unlocking = Boolean(packId && parentKey);

  useEffect(() => {
    if (!packId || !parentKey) return;
    const hashVariant: QuizVariant =
      new URLSearchParams(hash.replace(/^#/, "")).get("variant") === "B" ? "B" : variant;
    let cancelled = false;
    void fetch("/api/parent/key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, parentKey, variant: hashVariant }),
    })
      .then(async (response) => {
        if (cancelled) return;
        setUnlocked(response.ok ? ((await response.json()) as AnswerKeyView) : null);
      })
      .catch(() => {
        if (!cancelled) setUnlocked(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hash, packId, parentKey, variant]);

  if (unlocking && unlocked === undefined) {
    return <p className="text-white/60">Opening the answer key…</p>;
  }
  const view = unlocking ? (unlocked ?? null) : initial;
  if (!view) {
    return <p className="text-white/70">Not found.</p>;
  }
  return (
    <ol className="space-y-4">
      {view.questions.map((question, index) => (
        <li key={question.id} className="card space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/50">
            {index + 1}. {question.prompt}
          </p>
          <p className="font-semibold">
            Key: {question.correctOptionId}
            {question.correctText ? ` — ${question.correctText}` : ""}
          </p>
          <p className="text-sm text-lime-200">{question.parentHint}</p>
        </li>
      ))}
    </ol>
  );
}

function subscribeHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function readHash() {
  return window.location.hash;
}
