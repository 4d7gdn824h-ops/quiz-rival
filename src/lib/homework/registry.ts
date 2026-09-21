import "server-only";

import { ROOM_TTL_MS } from "@/lib/constants";
import type { GeneratedHomeworkPack, HomeworkExtract } from "./types";

const g = globalThis as unknown as {
  quizRivalHomework?: {
    extracts: Map<string, HomeworkExtract>;
    packs: Map<string, GeneratedHomeworkPack>;
  };
};

function bucket() {
  if (!g.quizRivalHomework) {
    g.quizRivalHomework = {
      extracts: new Map(),
      packs: new Map(),
    };
  }
  return g.quizRivalHomework;
}

function prune() {
  const cutoff = Date.now() - ROOM_TTL_MS;
  const store = bucket();
  for (const [id, item] of store.extracts) {
    if (item.createdAt < cutoff) store.extracts.delete(id);
  }
  for (const [id, item] of store.packs) {
    if (item.createdAt < cutoff) store.packs.delete(id);
  }
}

export function saveExtract(extract: HomeworkExtract) {
  prune();
  bucket().extracts.set(extract.id, extract);
}

export function getExtract(id: string): HomeworkExtract | undefined {
  prune();
  return bucket().extracts.get(id);
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
