import "server-only";

import { ROOM_TTL_MS } from "@/lib/constants";
import type { GeneratedHomeworkPack } from "./types";

/**
 * Generated quizzes can live in this process so a single Node server can host
 * a room. Raw uploads are not stored here. Extracts are not kept after the
 * response is sent.
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
