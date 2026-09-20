import { ROOM_TTL_MS } from "@/lib/constants";
import { createInitialState } from "./engine";
import { notifyRoom } from "./pubsub";
import type { GameStore, RoomState } from "./types";

class MemoryStore implements GameStore {
  kind = "memory" as const;
  private rooms = new Map<string, RoomState>();

  async createRoom(input: Parameters<GameStore["createRoom"]>[0]) {
    this.prune();
    let created = createInitialState(input);
    while (this.rooms.has(created.state.room.code)) {
      created = createInitialState(input);
    }
    this.rooms.set(created.state.room.code, created.state);
    notifyRoom(created.state.room.code);
    return created;
  }

  async getState(code: string) {
    this.prune();
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  async saveState(state: RoomState) {
    this.rooms.set(state.room.code, state);
    notifyRoom(state.room.code);
  }

  private prune() {
    const cutoff = Date.now() - ROOM_TTL_MS;
    for (const [code, state] of this.rooms) {
      if (state.room.createdAt < cutoff) this.rooms.delete(code);
    }
  }
}

const g = globalThis as unknown as { quizRivalMemory?: MemoryStore };
export const memoryStore = g.quizRivalMemory ?? (g.quizRivalMemory = new MemoryStore());
