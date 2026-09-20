import type { Level, PlaylistId, QuizVariant } from "./types";

/**
 * Tiny-level map for when Duolingo-style screenshots arrive.
 * Do not invent a skill-tree UI yet — this is the content seam.
 *
 * Chłopi themes follow the packet: comprehension, Jagna, exclusion,
 * Boryna–Antek / property, thesis/today. Variant B is the rematch path
 * (same level ids, B question wording).
 */
export const LEVELS: Level[] = [
  {
    id: "chlopi-full",
    packId: "chlopi",
    title: "Chłopi · full pack",
    theme: "full-pack",
    mega: true,
    passRule: { type: "complete" },
    questionIds: {
      A: [
        "chlopi-a-q1",
        "chlopi-a-q2",
        "chlopi-a-q3",
        "chlopi-a-q4",
        "chlopi-a-q5",
        "chlopi-a-q6",
        "chlopi-a-q7",
        "chlopi-a-q8",
      ],
      B: [
        "chlopi-b-q1",
        "chlopi-b-q2",
        "chlopi-b-q3",
        "chlopi-b-q4",
        "chlopi-b-q5",
        "chlopi-b-q6",
        "chlopi-b-q7",
        "chlopi-b-q8",
      ],
    },
  },
  {
    id: "chlopi-comprehension",
    packId: "chlopi",
    title: "Lektura",
    theme: "comprehension",
    passRule: { type: "minCorrect", count: 2 },
    questionIds: {
      A: ["chlopi-a-q1", "chlopi-a-q2", "chlopi-a-q3"],
      B: ["chlopi-b-q1", "chlopi-b-q2", "chlopi-b-q3"],
    },
  },
  {
    id: "chlopi-jagna",
    packId: "chlopi",
    title: "Jagna · presja",
    theme: "jagna-presja",
    passRule: { type: "complete" },
    questionIds: {
      A: ["chlopi-a-q5"],
      B: ["chlopi-b-q5"],
    },
  },
  {
    id: "chlopi-wykluczenie",
    packId: "chlopi",
    title: "Wykluczenie",
    theme: "wykluczenie",
    passRule: { type: "complete" },
    questionIds: {
      A: ["chlopi-a-q7"],
      B: ["chlopi-b-q7"],
    },
  },
  {
    id: "chlopi-majatek",
    packId: "chlopi",
    title: "Boryna–Antek",
    theme: "majatek",
    passRule: { type: "complete" },
    questionIds: {
      A: ["chlopi-a-q4", "chlopi-a-q6"],
      B: ["chlopi-b-q4", "chlopi-b-q6"],
    },
  },
  {
    id: "chlopi-teza",
    packId: "chlopi",
    title: "Teza · dziś",
    theme: "teza-aktualnosc",
    passRule: { type: "complete" },
    questionIds: {
      A: ["chlopi-a-q8"],
      B: ["chlopi-b-q8"],
    },
  },
  {
    id: "warmup-en-full",
    packId: "warmup-en",
    title: "Warm-up · full pack",
    theme: "full-pack",
    mega: true,
    passRule: { type: "complete" },
    questionIds: {
      A: [
        "warmup-en-a-q1",
        "warmup-en-a-q2",
        "warmup-en-a-q3",
        "warmup-en-a-q4",
        "warmup-en-a-q5",
        "warmup-en-a-q6",
        "warmup-en-a-q7",
        "warmup-en-a-q8",
      ],
      B: [
        "warmup-en-b-q1",
        "warmup-en-b-q2",
        "warmup-en-b-q3",
        "warmup-en-b-q4",
        "warmup-en-b-q5",
        "warmup-en-b-q6",
        "warmup-en-b-q7",
        "warmup-en-b-q8",
      ],
    },
  },
  {
    id: "warmup-en-places",
    packId: "warmup-en",
    title: "Places",
    theme: "places",
    passRule: { type: "minCorrect", count: 2 },
    questionIds: {
      A: ["warmup-en-a-q1", "warmup-en-a-q6", "warmup-en-a-q8"],
      B: ["warmup-en-b-q1", "warmup-en-b-q6", "warmup-en-b-q8"],
    },
  },
  {
    id: "warmup-en-science",
    packId: "warmup-en",
    title: "Science",
    theme: "science",
    passRule: { type: "minCorrect", count: 2 },
    questionIds: {
      A: ["warmup-en-a-q3", "warmup-en-a-q4", "warmup-en-a-q7"],
      B: ["warmup-en-b-q3", "warmup-en-b-q4", "warmup-en-b-q7"],
    },
  },
  {
    id: "warmup-en-school",
    packId: "warmup-en",
    title: "School bits",
    theme: "school",
    passRule: { type: "complete" },
    questionIds: {
      A: ["warmup-en-a-q2", "warmup-en-a-q5"],
      B: ["warmup-en-b-q2", "warmup-en-b-q5"],
    },
  },
];

export function listTinyLevels(packId: string): Level[] {
  return LEVELS.filter((level) => level.packId === packId && !level.mega);
}

export function listMegaLevels(packId: string): Level[] {
  return LEVELS.filter((level) => level.packId === packId && level.mega);
}

export function getPlaylist(packId: string, playlistId: PlaylistId = "full"): Level[] {
  if (playlistId === "tiny") {
    const tiny = listTinyLevels(packId);
    return tiny.length ? tiny : listMegaLevels(packId);
  }
  const mega = listMegaLevels(packId);
  return mega.length ? mega : listTinyLevels(packId);
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
