import "server-only";

import { ROOM_TTL_MS } from "@/lib/constants";
import type { GeneratedHomeworkPack } from "./types";

/**
 * Scanned quizzes live only in this process, pruned with the room TTL (6 hours,
 * inside a 24-hour cap). Raw uploads are not stored. The parent-key secret is
 * not stored — only its hash. Do not list these packs from a public route.
 */
const g = globalThis as unknown as {
  quizRivalHomework?: {
    packs: Map<string, GeneratedHomeworkPack>;
  };
};

function bucket() {
  if (!g.quizRivalHomework) {
    g.quizRivalHomework = {
      packs: new Map(),
    };
  }
  return g.quizRivalHomework;
}

function prune() {
  const cutoff = Date.now() - ROOM_TTL_MS;
  const store = bucket();
  for (const [id, item] of store.packs) {
    if (item.createdAt < cutoff) store.packs.delete(id);
  }
}

export function saveGeneratedPack(pack: GeneratedHomeworkPack) {
  prune();
  bucket().packs.set(pack.id, pack);
}

export function getGeneratedPack(id: string): GeneratedHomeworkPack | undefined {
  prune();
  return bucket().packs.get(id);
}

export function listGeneratedPacks(): GeneratedHomeworkPack[] {
  prune();
  return [...bucket().packs.values()].sort((a, b) => b.createdAt - a.createdAt);
}
