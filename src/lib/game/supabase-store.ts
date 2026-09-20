import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PlaylistId, QuizVariant } from "@/data/types";
import { DEFAULT_PLAYLIST_ID } from "@/lib/constants";
import { createInitialState } from "./engine";
import { notifyRoom } from "./pubsub";
import type { Answer, GameStore, Player, Room, RoomState } from "./types";

interface RoomRow {
  code: string;
  status: Room["status"];
  quiz_id: string;
  variant: QuizVariant;
  host_id: string;
  current_question_index: number;
  question_ends_at: string | null;
  question_order: number[];
  playlist_id?: PlaylistId | null;
  created_at: string;
}

interface PlayerRow {
  id: string;
  room_code: string;
  name: string;
  score: number;
}

interface AnswerRow {
  room_code: string;
  player_id: string;
  question_id: string;
  choice: string;
  correct: boolean;
}

function toRoom(row: RoomRow): Room {
  return {
    code: row.code,
    status: row.status,
    quizId: row.quiz_id,
    variant: row.variant,
    hostId: row.host_id,
    currentQuestionIndex: row.current_question_index,
    questionEndsAt: row.question_ends_at
      ? new Date(row.question_ends_at).getTime()
      : null,
    questionOrder: row.question_order ?? [],
    playlistId: row.playlist_id === "tiny" ? "tiny" : DEFAULT_PLAYLIST_ID,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export class SupabaseStore implements GameStore {
  kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createRoom(input: Parameters<GameStore["createRoom"]>[0]) {
    let created = createInitialState(input);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { error } = await this.client.from("rooms").insert(toRoomRow(created.state.room));
      if (!error) {
        await this.client.from("players").insert(toPlayerRow(created.player));
        notifyRoom(created.state.room.code);
        return created;
      }
      if (error.code === "23505") {
        created = createInitialState(input);
        continue;
      }
      throw new Error(error.message);
    }
    throw new Error("Could not allocate a room code");
  }

  async getState(code: string): Promise<RoomState | null> {
    const upper = code.toUpperCase();
    const { data: roomRow, error } = await this.client
      .from("rooms")
      .select("*")
      .eq("code", upper)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!roomRow) return null;
    const [{ data: playerRows }, { data: answerRows }] = await Promise.all([
      this.client.from("players").select("*").eq("room_code", upper),
      this.client.from("answers").select("*").eq("room_code", upper),
    ]);
    return {
      room: toRoom(roomRow as RoomRow),
      players: ((playerRows ?? []) as PlayerRow[]).map((row) => ({
        id: row.id,
        roomCode: row.room_code,
        name: row.name,
        score: row.score,
      })),
      answers: ((answerRows ?? []) as AnswerRow[]).map((row) => ({
        roomCode: row.room_code,
        playerId: row.player_id,
        questionId: row.question_id,
        choice: row.choice,
        correct: row.correct,
      })),
    };
  }

  async saveState(state: RoomState) {
    const { error: roomError } = await this.client
      .from("rooms")
      .update(toRoomRow(state.room))
      .eq("code", state.room.code);
    if (roomError) throw new Error(roomError.message);

    const { data: existingPlayers } = await this.client
      .from("players")
      .select("id")
      .eq("room_code", state.room.code);
    const existingIds = new Set((existingPlayers ?? []).map((p: { id: string }) => p.id));
    for (const player of state.players) {
      if (existingIds.has(player.id)) {
        const { error } = await this.client
          .from("players")
          .update({ name: player.name, score: player.score })
          .eq("id", player.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await this.client.from("players").insert(toPlayerRow(player));
        if (error) throw new Error(error.message);
      }
    }

    const { error: deleteAnswersError } = await this.client
      .from("answers")
      .delete()
      .eq("room_code", state.room.code);
    if (deleteAnswersError) throw new Error(deleteAnswersError.message);
    if (state.answers.length > 0) {
      const { error } = await this.client
        .from("answers")
        .insert(state.answers.map(toAnswerRow));
      if (error) throw new Error(error.message);
    }
    notifyRoom(state.room.code);
  }
}

function toRoomRow(room: Room) {
  return {
    code: room.code,
    status: room.status,
    quiz_id: room.quizId,
    variant: room.variant,
    host_id: room.hostId,
    current_question_index: room.currentQuestionIndex,
    question_ends_at: room.questionEndsAt
      ? new Date(room.questionEndsAt).toISOString()
      : null,
    question_order: room.questionOrder,
    playlist_id: room.playlistId ?? DEFAULT_PLAYLIST_ID,
    created_at: new Date(room.createdAt).toISOString(),
  };
}

function toPlayerRow(player: Player) {
  return {
    id: player.id,
    room_code: player.roomCode,
    name: player.name,
    score: player.score,
  };
}

function toAnswerRow(answer: Answer) {
  return {
    room_code: answer.roomCode,
    player_id: answer.playerId,
    question_id: answer.questionId,
    choice: answer.choice,
    correct: answer.correct,
  };
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
