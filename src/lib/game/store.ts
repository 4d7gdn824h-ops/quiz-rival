import { memoryStore } from "./memory-store";
import { isSupabaseConfigured, SupabaseStore } from "./supabase-store";
import type { GameStore } from "./types";

const g = globalThis as unknown as { quizRivalStore?: GameStore };

export function getStore(): GameStore {
  if (g.quizRivalStore) return g.quizRivalStore;
  if (isSupabaseConfigured()) {
    g.quizRivalStore = new SupabaseStore(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    return g.quizRivalStore;
  }
  g.quizRivalStore = memoryStore;
  return g.quizRivalStore;
}
