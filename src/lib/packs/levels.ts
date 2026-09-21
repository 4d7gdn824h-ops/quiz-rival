import "server-only";

import * as staticLevels from "@/data/levels";
import type { Level, PlaylistId, QuizVariant } from "@/data/types";
import { getGeneratedPack } from "@/lib/homework/registry";

function packLevels(packId: string): Level[] {
  const generated = getGeneratedPack(packId);
  if (generated) return generated.levels;
  return staticLevels.LEVELS.filter((level) => level.packId === packId);
}

export function listTinyLevels(packId: string): Level[] {
  return packLevels(packId).filter((level) => !level.mega);
}

export function listMegaLevels(packId: string): Level[] {
  return packLevels(packId).filter((level) => level.mega);
}

export function getLevel(packId: string, levelId: string): Level | undefined {
  return packLevels(packId).find((level) => level.id === levelId);
}

export function getPlaylist(packId: string, playlistId: PlaylistId = "full"): Level[] {
  if (playlistId === "tiny") {
    const tiny = listTinyLevels(packId);
    return tiny.length ? tiny : listMegaLevels(packId);
  }
  const mega = listMegaLevels(packId);
  return mega.length ? mega : listTinyLevels(packId);
}

export function resolvePlayLevels(
  packId: string,
  playlistId: PlaylistId = "full",
  levelId?: string | null,
): Level[] {
  if (levelId) {
    const one = getLevel(packId, levelId);
    if (one) return [one];
  }
  return getPlaylist(packId, playlistId);
}

export function flattenLevelQuestionIds(levels: Level[], variant: QuizVariant): string[] {
  return levels.flatMap((level) => level.questionIds[variant] ?? []);
}

export function findLevelForQuestion(
  levels: Level[],
  variant: QuizVariant,
  questionId: string,
): Level | undefined {
  return levels.find((level) => level.questionIds[variant]?.includes(questionId));
}
