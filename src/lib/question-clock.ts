/** Live question clock. Pause stores the remainder and clears the deadline. */

export type QuestionClock = {
  endsAt: number | null;
  remainingMs: number | null;
  paused: boolean;
};

/** Milliseconds left. Never negative. */
export function freezeRemaining(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

/** Continue from the frozen remainder. Does not start a fresh question length. */
export function resumeDeadline(remainingMs: number, now: number): number {
  return now + Math.max(0, remainingMs);
}

export function pauseQuestionClock(clock: QuestionClock, now: number): QuestionClock {
  if (clock.paused || clock.endsAt == null) return clock;
  return {
    paused: true,
    endsAt: null,
    remainingMs: freezeRemaining(clock.endsAt, now),
  };
}

/**
 * Resume only looks at the stored remainder. The deadline is null while paused,
 * so a guard on `endsAt` would leave the quiz paused forever.
 */
export function resumeQuestionClock(clock: QuestionClock, now: number): QuestionClock {
  if (!clock.paused) return clock;
  const remainingMs = Math.max(0, clock.remainingMs ?? 0);
  return {
    paused: false,
    remainingMs: null,
    endsAt: resumeDeadline(remainingMs, now),
  };
}
