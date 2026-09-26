import type { QuizPackFile, QuizQuestion, QuizVariant } from "@/data/types";

/** Stable option order for a generated pack. Same pack id, variant, and question id always shuffle the same way. */
export function shufflePackOptions(pack: QuizPackFile): QuizPackFile {
  return {
    ...pack,
    variants: {
      A: pack.variants.A.map((question) => shuffleQuestion(pack.id, "A", question)),
      B: pack.variants.B.map((question) => shuffleQuestion(pack.id, "B", question)),
    },
  };
}

function shuffleQuestion(packId: string, variant: QuizVariant, question: QuizQuestion): QuizQuestion {
  const tagged = question.options.map((option) => ({
    text: option.text,
    correct: option.id === question.correctOptionId,
  }));
  if (tagged.length < 2) return question;
  const rand = mulberry32(fnv1a(`${packId}|${variant}|${question.id}`));
  for (let i = tagged.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = tagged[i];
    tagged[i] = tagged[j];
    tagged[j] = swap;
  }
  const options = tagged.map((option, index) => ({
    id: String.fromCharCode(65 + index),
    text: option.text,
  }));
  const correctAt = tagged.findIndex((option) => option.correct);
  return {
    ...question,
    options,
    correctOptionId: correctAt >= 0 ? options[correctAt].id : question.correctOptionId,
  };
}

function fnv1a(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
