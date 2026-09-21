import "server-only";

import { PACK_CATALOG } from "@/data/catalog";
import { listTinyLevels as listStaticTinyLevels } from "@/data/levels";
import { getPack } from "@/data/quizzes";
import { CHLOPI_WRITING_CONFIG } from "@/data/writing-config";
import { listGeneratedPacks } from "@/lib/homework/registry";
import type { GeneratedHomeworkPack, PublicHomeworkPack, PublicPackDetail } from "@/lib/homework/types";
import { toPublicLevel } from "@/lib/public-quiz";

function staticWriting(id: string) {
  return id === "chlopi" ? CHLOPI_WRITING_CONFIG : null;
}

function fromStatic(): PublicHomeworkPack[] {
  return PACK_CATALOG.map((item) => {
    const pack = getPack(item.id);
    const levels = listStaticTinyLevels(item.id).map((level) => toPublicLevel(level, "A"));
    return {
      ...item,
      title: pack?.title ?? item.title,
      generated: false,
      tonight: false,
      hasEssay: item.id === "chlopi",
      levels,
    };
  });
}

function fromGenerated(item: GeneratedHomeworkPack, tonight: boolean): PublicHomeworkPack {
  const variantA = item.pack.variants.A;
  return {
    id: item.pack.id,
    title: item.pack.title,
    language: item.pack.language,
    questionCount: variantA.length,
    blurb: item.pack.source ?? "Tonight's homework scan",
    levelCount: item.levels.filter((level) => !level.mega).length,
    generated: true,
    tonight,
    hasEssay: Boolean(item.writing),
    levels: item.levels.filter((level) => !level.mega).map((level) => toPublicLevel(level, "A")),
  };
}

export function listPublicCatalog(): PublicHomeworkPack[] {
  const generated = listGeneratedPacks();
  const tonightId = generated[0]?.id;
  return [
    ...generated.map((item) => fromGenerated(item, item.id === tonightId)),
    ...fromStatic(),
  ];
}

export function getPublicPack(id: string): PublicPackDetail | undefined {
  const generated = listGeneratedPacks().find((item) => item.id === id);
  if (generated) {
    const tonightId = listGeneratedPacks()[0]?.id;
    return {
      ...fromGenerated(generated, generated.id === tonightId),
      writing: generated.writing,
    };
  }
  const item = fromStatic().find((pack) => pack.id === id);
  if (!item) return undefined;
  return { ...item, writing: staticWriting(id) };
}
