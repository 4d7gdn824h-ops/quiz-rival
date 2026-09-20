import type { PublicQuestion, QuizVariant } from "@/data/types";

export type RoomStatus = "lobby" | "playing" | "finished";

export interface Room {
  code: string;
  status: RoomStatus;
  quizId: string;
  variant: QuizVariant;
  hostId: string;
  currentQuestionIndex: number;
  questionEndsAt: number | null;
  questionOrder: number[];
  createdAt: number;
}

export interface Player {
  id: string;
  roomCode: string;
  name: string;
  score: number;
}

export interface Answer {
  roomCode: string;
  playerId: string;
  questionId: string;
  choice: string;
  correct: boolean;
}

export interface RoomState {
  room: Room;
  players: Player[];
  answers: Answer[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  answeredCurrent: boolean;
}

export interface RoomSnapshot {
  store: "memory" | "supabase";
  room: {
    code: string;
    status: RoomStatus;
    quizId: string;
    quizTitle: string;
    variant: QuizVariant;
    hostId: string;
    currentQuestionIndex: number;
    questionEndsAt: number | null;
    questionCount: number;
    questionSeconds: number;
  };
  players: PublicPlayer[];
  currentQuestion: PublicQuestion | null;
  yourAnswer: string | null;
  winnerIds: string[];
}

export interface GameStore {
  kind: "memory" | "supabase";
  createRoom(input: {
    hostName: string;
    quizId: string;
    variant: QuizVariant;
  }): Promise<{ state: RoomState; player: Player }>;
  getState(code: string): Promise<RoomState | null>;
  saveState(state: RoomState): Promise<void>;
}
