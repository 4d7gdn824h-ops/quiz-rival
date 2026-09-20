import { PATH_PROGRESS_KEY } from "@/lib/constants";

type ProgressMap = Record<string, string[]>;

function readAll(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PATH_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: ProgressMap) {
  window.localStorage.setItem(PATH_PROGRESS_KEY, JSON.stringify(map));
}

export function readCompletedLevelIds(packId: string): string[] {
  const list = readAll()[packId];
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}

export function markLevelCompleted(packId: string, levelId: string): string[] {
  const map = readAll();
  const next = new Set(readCompletedLevelIds(packId));
  next.add(levelId);
  const list = [...next];
  map[packId] = list;
  writeAll(map);
  return list;
}
