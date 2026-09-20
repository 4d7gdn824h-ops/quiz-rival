import type { PlaylistId, PublicLevel, PublicQuestion, QuizVariant } from "@/data/types";

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
  playlistId: PlaylistId;
  /** When set with `playlistId: "tiny"`, the room plays that one micro-round. */
  levelId: string | null;
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
    playlistId: PlaylistId;
    levelId: string | null;
    currentLevelId: string | null;
  };
  levels: PublicLevel[];
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
    playlistId?: PlaylistId;
    levelId?: string | null;
  }): Promise<{ state: RoomState; player: Player }>;
  getState(code: string): Promise<RoomState | null>;
  saveState(state: RoomState): Promise<void>;
}
