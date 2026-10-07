import type { QuizVariant } from "@/data/types";
import type { PlayKit } from "@/lib/play/types";

export const LOCAL_PLAY_KEY = "quizrival-local-play";
const PLAY_KIT_KEY = "quizrival-play-kit";

export interface LocalPlaySetup {
  mode: "pass" | "solo";
  quizId: string;
  variant: QuizVariant;
  levelId: string | null;
  names: [string, string];
  startedAt: number;
}

export function writeLocalPlay(setup: LocalPlaySetup) {
  sessionStorage.setItem(LOCAL_PLAY_KEY, JSON.stringify(setup));
}

export function readLocalPlay(): LocalPlaySetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCAL_PLAY_KEY);
    if (!raw) return null;
    const setup = JSON.parse(raw) as LocalPlaySetup;
    if (!setup?.quizId || (setup.mode !== "pass" && setup.mode !== "solo")) return null;
    return setup;
  } catch {
    return null;
  }
}

export function writePlayKit(kit: PlayKit) {
  const encoded = JSON.stringify(kit);
  if (encoded.includes("correctOptionId") || encoded.includes("parentHint") || encoded.includes("answerKey")) {
    throw new Error("Refusing to keep quiz secrets on this phone.");
  }
  const map = readKitMap();
  map[kit.quizId] = kit;
  sessionStorage.setItem(PLAY_KIT_KEY, JSON.stringify(map));
}

export function readPlayKit(quizId: string): PlayKit | null {
  return readKitMap()[quizId] ?? null;
}

function readKitMap(): Record<string, PlayKit> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(PLAY_KIT_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, PlayKit>;
    return map && typeof map === "object" ? map : {};
  } catch {
    return {};
  }
}
