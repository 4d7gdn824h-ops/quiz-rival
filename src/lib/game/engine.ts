import type { PlaylistId, QuizVariant } from "@/data/types";
import {
  ALL_ANSWERED_HOLD_MS,
  ANSWER_GRACE_MS,
  DEFAULT_PLAYLIST_ID,
  MAX_PLAYERS,
  QUESTION_MS,
} from "@/lib/constants";
import { getPlayQuestions } from "@/lib/levels/resolve";
import { identityOrder, randomId, randomRoomCode, shuffledOrder } from "@/lib/ids";
import type { Answer, Player, Room, RoomState } from "./types";

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function playQuestions(state: RoomState) {
  return getPlayQuestions(state.room.quizId, state.room.variant, state.room.playlistId);
}

function currentQuestionId(state: RoomState): string | null {
  const questions = playQuestions(state);
  if (!questions.length) return null;
  const realIndex = state.room.questionOrder[state.room.currentQuestionIndex];
  return questions[realIndex]?.id ?? null;
}

function cloneState(state: RoomState): RoomState {
  return {
    room: { ...state.room, questionOrder: [...state.room.questionOrder] },
    players: state.players.map((p) => ({ ...p })),
    answers: state.answers.map((a) => ({ ...a })),
  };
}

export function createInitialState(input: {
  hostName: string;
  quizId: string;
  variant: QuizVariant;
  playlistId?: PlaylistId;
}): { state: RoomState; player: Player } {
  const playlistId = input.playlistId ?? DEFAULT_PLAYLIST_ID;
  const questions = getPlayQuestions(input.quizId, input.variant, playlistId);
  if (!questions?.length) {
    throw new GameError("Unknown quiz pack", 404);
  }
  const name = sanitizeName(input.hostName);
  const host: Player = {
    id: randomId("p"),
    roomCode: "",
    name,
    score: 0,
  };
  const room: Room = {
    code: randomRoomCode(),
    status: "lobby",
    quizId: input.quizId,
    variant: input.variant,
    hostId: host.id,
    currentQuestionIndex: 0,
    questionEndsAt: null,
    questionOrder: identityOrder(questions.length),
    playlistId,
    createdAt: Date.now(),
  };
  host.roomCode = room.code;
  return { state: { room, players: [host], answers: [] }, player: host };
}

export function joinState(state: RoomState, name: string, existingPlayerId?: string): {
  state: RoomState;
  player: Player;
} {
  const next = cloneState(state);
  if (existingPlayerId) {
    const existing = next.players.find((p) => p.id === existingPlayerId);
    if (existing) {
      existing.name = sanitizeName(name) || existing.name;
      return { state: next, player: existing };
    }
  }
  if (next.room.status !== "lobby") {
    throw new GameError("This room already started. Ask the host for a rematch.", 409);
  }
  if (next.players.length >= MAX_PLAYERS) {
    throw new GameError("Room is full (2 players).", 409);
  }
  const player: Player = {
    id: randomId("p"),
    roomCode: next.room.code,
    name: sanitizeName(name),
    score: 0,
  };
  next.players.push(player);
  return { state: next, player };
}

export function startState(state: RoomState, actorId: string, now = Date.now()): RoomState {
  assertHost(state, actorId);
  if (state.room.status === "playing") return state;
  if (state.room.status === "finished") {
    throw new GameError("Match is over. Use rematch.");
  }
  const next = cloneState(state);
  next.room.status = "playing";
  next.room.currentQuestionIndex = 0;
  next.room.questionEndsAt = now + QUESTION_MS;
  return next;
}

export function answerState(
  state: RoomState,
  input: { playerId: string; questionId: string; choice: string },
  now = Date.now(),
): RoomState {
  if (state.room.status !== "playing") {
    throw new GameError("Not in a live question right now.");
  }
  const player = state.players.find((p) => p.id === input.playerId);
  if (!player) throw new GameError("You are not in this room.", 403);

  const questions = playQuestions(state);
  if (!questions.length) throw new GameError("Quiz missing.", 500);
  const realIndex = state.room.questionOrder[state.room.currentQuestionIndex];
  const question = questions[realIndex];
  if (!question || question.id !== input.questionId) {
    throw new GameError("That question is no longer live.");
  }
  if (
    state.room.questionEndsAt &&
    now > state.room.questionEndsAt + ANSWER_GRACE_MS
  ) {
    throw new GameError("Time is up for this question.");
  }
  if (!question.options.some((o) => o.id === input.choice)) {
    throw new GameError("Invalid choice.");
  }
  if (
    state.answers.some(
      (a) => a.playerId === input.playerId && a.questionId === input.questionId,
    )
  ) {
    return state;
  }

  const next = cloneState(state);
  const correct = input.choice === question.correctOptionId;
  const answer: Answer = {
    roomCode: next.room.code,
    playerId: input.playerId,
    questionId: input.questionId,
    choice: input.choice,
    correct,
  };
  next.answers.push(answer);
  if (correct) {
    const scoring = next.players.find((p) => p.id === input.playerId);
    if (scoring) scoring.score += 1;
  }
  return maybeHoldIfAllAnswered(next, now);
}

export function tickState(state: RoomState, now = Date.now()): RoomState {
  if (state.room.status !== "playing") return state;
  if (!state.room.questionEndsAt) return state;
  if (now < state.room.questionEndsAt) {
    return maybeHoldIfAllAnswered(state, now);
  }
  return advanceQuestion(state, now);
}

export function rematchState(
  state: RoomState,
  actorId: string,
  options: { switchVariant?: boolean; reshuffle?: boolean } = {},
): RoomState {
  assertHost(state, actorId);
  const switchVariant = options.switchVariant ?? true;
  const reshuffle = options.reshuffle ?? true;
  const next = cloneState(state);
  const nextVariant: QuizVariant =
    switchVariant && next.room.variant === "A" ? "B" : switchVariant ? "A" : next.room.variant;
  const questions = getPlayQuestions(next.room.quizId, nextVariant, next.room.playlistId);
  if (!questions?.length) throw new GameError("Quiz missing.", 500);
  next.room.variant = nextVariant;
  next.room.status = "lobby";
  next.room.currentQuestionIndex = 0;
  next.room.questionEndsAt = null;
  next.room.questionOrder = reshuffle
    ? shuffledOrder(questions.length)
    : identityOrder(questions.length);
  next.answers = [];
  next.players = next.players.map((p) => ({ ...p, score: 0 }));
  return next;
}

export function winnerIds(state: RoomState): string[] {
  if (state.room.status !== "finished" || state.players.length === 0) return [];
  const best = Math.max(...state.players.map((p) => p.score));
  return state.players.filter((p) => p.score === best).map((p) => p.id);
}

export function sanitizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, 16);
  if (name.length < 1) throw new GameError("Enter a display name.");
  return name;
}

function assertHost(state: RoomState, actorId: string) {
  if (state.room.hostId !== actorId) {
    throw new GameError("Only the host can do that.", 403);
  }
}

function maybeHoldIfAllAnswered(state: RoomState, now: number): RoomState {
  const qid = currentQuestionId(state);
  if (!qid) return state;
  const answered = state.players.every((p) =>
    state.answers.some((a) => a.playerId === p.id && a.questionId === qid),
  );
  if (!answered) return state;
  if (state.room.questionEndsAt && state.room.questionEndsAt <= now) {
    return advanceQuestion(state, now);
  }
  if (
    state.room.questionEndsAt &&
    state.room.questionEndsAt - now <= ALL_ANSWERED_HOLD_MS
  ) {
    return state;
  }
  const next = cloneState(state);
  next.room.questionEndsAt = now + ALL_ANSWERED_HOLD_MS;
  return next;
}

function advanceQuestion(state: RoomState, now: number): RoomState {
  const next = cloneState(state);
  const questions = playQuestions(next);
  const lastIndex = questions.length - 1;
  if (next.room.currentQuestionIndex >= lastIndex) {
    next.room.status = "finished";
    next.room.questionEndsAt = null;
    return next;
  }
  next.room.currentQuestionIndex += 1;
  next.room.questionEndsAt = now + QUESTION_MS;
  return next;
}
