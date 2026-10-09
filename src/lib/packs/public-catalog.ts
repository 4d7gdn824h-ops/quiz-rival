import "server-only";

import { PACK_CATALOG } from "@/data/catalog";
import { listTinyLevels as listStaticTinyLevels } from "@/data/levels";
import { getPack } from "@/data/quizzes";
import type { GeneratedHomeworkPack, PublicHomeworkPack, PublicPackDetail } from "@/lib/homework/types";
import { packsForPublicList } from "@/lib/pack-access";
import { toPublicLevel } from "@/lib/public-quiz";

function fromStatic(): PublicHomeworkPack[] {
  return PACK_CATALOG.map((item) => {
    const pack = getPack(item.id);
    const levels = listStaticTinyLevels(item.id).map((level) => toPublicLevel(level, "A"));
    return {
      ...item,
      title: pack?.title ?? item.title,
      generated: false,
      tonight: false,
      hasEssay: false,
      levels,
    };
  });
}

/** Public shape for the device that just created the pack. Not a lookup by id. */
export function toCreatorPack(item: GeneratedHomeworkPack): PublicHomeworkPack {
  const variantA = item.pack.variants.A;
  return {
    id: item.pack.id,
    title: item.pack.title,
    language: item.pack.language,
    questionCount: variantA.length,
    blurb: item.pack.source ?? "Tonight's homework scan",
    levelCount: item.levels.filter((level) => !level.mega).length,
    generated: true,
    tonight: false,
    hasEssay: false,
    levels: item.levels.filter((level) => !level.mega).map((level) => toPublicLevel(level, "A")),
  };
}

export function listPublicCatalog(): PublicHomeworkPack[] {
  return packsForPublicList(fromStatic());
}

export function getPublicPack(id: string): PublicPackDetail | undefined {
  const item = listPublicCatalog().find((pack) => pack.id === id);
  if (!item) return undefined;
  return { ...item, writing: null };
}
