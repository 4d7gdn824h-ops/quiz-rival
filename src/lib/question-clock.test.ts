import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  freezeRemaining,
  pauseQuestionClock,
  resumeDeadline,
  resumeQuestionClock,
  type QuestionClock,
} from "./question-clock.ts";

const QUESTION_MS = 25_000;

describe("question clock pause and resume", () => {
  it("freezes the exact remainder and never goes negative", () => {
    assert.equal(freezeRemaining(25_000, 4_200), 20_800);
    assert.equal(freezeRemaining(1_000, 1_000), 0);
    assert.equal(freezeRemaining(1_000, 1_400), 0);
  });

  it("resumes from the remainder instead of a fresh question length", () => {
    const now = 50_000;
    assert.equal(resumeDeadline(12_400, now), now + 12_400);
    assert.notEqual(resumeDeadline(12_400, now), now + QUESTION_MS);
    assert.equal(resumeDeadline(0, now), now);
    assert.equal(resumeDeadline(-40, now), now);
  });

  it("keeps the same remainder across repeated pause and resume", () => {
    let clock: QuestionClock = { endsAt: 25_000, remainingMs: null, paused: false };
    const pauses = [
      { at: 3_000, resumeAt: 8_000 },
      { at: 10_000, resumeAt: 19_500 },
      { at: 21_000, resumeAt: 40_000 },
    ];
    let played = 0;
    let cursor = 0;
    for (const pause of pauses) {
      played += pause.at - cursor;
      clock = pauseQuestionClock(clock, pause.at);
      assert.equal(clock.paused, true);
      assert.equal(clock.endsAt, null);
      assert.equal(clock.remainingMs, QUESTION_MS - played);
      const frozen = clock.remainingMs;
      clock = resumeQuestionClock(clock, pause.resumeAt);
      assert.equal(clock.paused, false);
      assert.equal(clock.remainingMs, null);
      assert.equal(clock.endsAt, pause.resumeAt + frozen);
      assert.equal(freezeRemaining(clock.endsAt ?? 0, pause.resumeAt), frozen);
      cursor = pause.resumeAt;
    }
    assert.equal(played, 3_000 + 2_000 + 1_500);
    assert.equal(freezeRemaining(clock.endsAt ?? 0, cursor), QUESTION_MS - played);
  });

  it("does not resume when the clock is already running, and does not reset a paused clock that has no remainder", () => {
    const running: QuestionClock = { endsAt: 10_000, remainingMs: null, paused: false };
    assert.deepEqual(resumeQuestionClock(running, 4_000), running);
    const paused: QuestionClock = { endsAt: null, remainingMs: null, paused: true };
    assert.deepEqual(resumeQuestionClock(paused, 4_000), {
      paused: false,
      remainingMs: null,
      endsAt: 4_000,
    });
  });
});
