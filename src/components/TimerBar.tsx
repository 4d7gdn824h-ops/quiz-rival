"use client";

import { useEffect, useState } from "react";

export function TimerBar({
  endsAt,
  totalMs,
}: {
  endsAt: number | null;
  totalMs: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const remainingMs = endsAt ? Math.max(0, endsAt - now) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
  const urgent = seconds <= 5;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
          Time
        </p>
        <p
          className={`font-display text-5xl font-bold leading-none tabular-nums ${
            urgent ? "text-orange-400" : "text-white"
          }`}
          aria-live="off"
        >
          {seconds}
        </p>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs / 1000)}
        aria-valuenow={seconds}
        aria-label="Seconds remaining"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${
            urgent ? "bg-orange-400" : "bg-lime-300"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
