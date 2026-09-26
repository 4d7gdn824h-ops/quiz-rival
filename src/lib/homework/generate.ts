import "server-only";

import { LEVELS } from "@/data/levels";
import { getPack } from "@/data/quizzes";
import type { Level, QuizPackFile, QuizQuestion, QuizVariant } from "@/data/types";
import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { notesFromKeptLines } from "./fixture";
import { detectLanguage, normalizeQuizLanguage } from "./language";
import { requestPracticePack, shouldUseChlopiFixture } from "./llm-pack";
import { homeworkMode } from "./mode";
import { quizChrome } from "./quiz-chrome";
import { saveGeneratedPack } from "./registry";
import { shufflePackOptions } from "./shuffle-options";
import type { ExtractedNotes, GeneratedHomeworkPack, HomeworkMode } from "./types";
import { writingFromNotes } from "./writing-from-notes";
import { planWritingCoach } from "../writing/plan";

export async function generateHomeworkPack(
  rawNotes: ExtractedNotes,
): Promise<GeneratedHomeworkPack> {
  const notes = notesFromKeptLines({
    ...rawNotes,
    language: normalizeQuizLanguage(
      rawNotes.language && rawNotes.language !== "und" ? rawNotes.language : undefined,
      detectLanguage(
        `${rawNotes.title}\n${rawNotes.topics.join(" ")}\n${rawNotes.facts.join(" ")}\n${rawNotes.rawText}`,
      ),
    ),
  });
  if (!notes.topics.length && !notes.facts.length) {
    throw new GameError("Keep at least a few topics or facts, then generate.", 400);
  }

  const id = randomId("hw");
  const mode = homeworkMode();
  let pack: QuizPackFile;
  let levels: Level[];
  let usedMode: HomeworkMode = "fixture";
  let notice: string | undefined;

  if (mode === "xai") {
    try {
      ({ pack, levels } = await requestPracticePack(id, notes));
      usedMode = "xai";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Grok failed";
      if (notes.fixtureId === "chlopi-worksheet") {
        ({ pack, levels } = cloneChlopiPack(id, notes));
        notice = `Grok could not build a pack (${message}), so the built-in Chłopi example was used.`;
      } else {
        ({ pack, levels } = buildDeterministicPack(id, notes));
        notice = `Grok could not build a pack (${message}). Practice questions were built from the confirmed notes — this is not the Chłopi demo.`;
      }
      usedMode = "fixture";
    }
  } else if (shouldUseChlopiFixture(notes, mode)) {
    ({ pack, levels } = cloneChlopiPack(id, notes));
  } else {
    ({ pack, levels } = buildDeterministicPack(id, notes));
  }

  pack = shufflePackOptions(pack);
  validatePack(pack, levels);
  const writing = await writingCoachFor(id, notes, mode);
  const generated: GeneratedHomeworkPack = {
    id,
    pack,
    levels,
    writing,
    notes,
    mode: usedMode,
    notice,
    createdAt: Date.now(),
  };
  saveGeneratedPack(generated);
  return generated;
}

async function writingCoachFor(id: string, notes: ExtractedNotes, mode: HomeworkMode) {
  const local = writingFromNotes(id, notes);
  const prompt = notes.essayPrompts[0]?.trim();
  if (mode !== "xai" || !prompt || notes.fixtureId === "chlopi-worksheet") return local;
  const planned = await planWritingCoach({
    id,
    prompt,
    language: notes.language,
    grade: "8",
    title: notes.title,
    topics: notes.topics,
    facts: notes.facts,
  });
  return planned.config;
}

function cloneChlopiPack(id: string, notes: ExtractedNotes) {
  const source = getPack("chlopi");
  if (!source) throw new GameError("Missing built-in Chłopi pack", 500);
  const keptThemes = matchChlopiThemes(notes);
  const sourceLevels = LEVELS.filter((level) => level.packId === "chlopi");
  const tiny = sourceLevels.filter((level) => !level.mega && keptThemes.has(level.theme));
  const useTiny = tiny.length >= 3 ? tiny : sourceLevels.filter((level) => !level.mega);

  const pack: QuizPackFile = {
    id,
    title: notes.title,
    language: "pl",
    source: "Homework scan · Chłopi fixture",
    variants: {
      A: source.variants.A.map((question) => ({ ...question })),
      B: source.variants.B.map((question) => ({ ...question })),
    },
  };

  const levels: Level[] = [
    {
      id: `${id}-full`,
      packId: id,
      title: `${notes.title} · full pack`,
      theme: "full-pack",
      mega: true,
      passRule: { type: "complete" },
      questionIds: {
        A: pack.variants.A.map((question) => question.id),
        B: pack.variants.B.map((question) => question.id),
      },
    },
    ...useTiny.map((level) => ({
      ...level,
      id: `${id}-${level.theme}`,
      packId: id,
    })),
  ];
  return { pack, levels };
}

function matchChlopiThemes(notes: ExtractedNotes) {
  const blob = `${notes.topics.join(" ")}\n${notes.facts.join(" ")}`.toLowerCase();
  const kept = new Set<string>();
  if (/lektura|autor|reymont|lipce|boryna|fakt/.test(blob)) kept.add("comprehension");
  if (/jagna|presja/.test(blob)) kept.add("jagna-presja");
  if (/wyklucz/.test(blob)) kept.add("wykluczenie");
  if (/antek|majątek|majatek|ziemi|dziedzic/.test(blob)) kept.add("majatek");
  if (/aktual|teza|współczes|wspolczes|dziś|dzis/.test(blob)) kept.add("teza-aktualnosc");
  if (!kept.size) {
    return new Set(["comprehension", "jagna-presja", "wykluczenie", "majatek", "teza-aktualnosc"]);
  }
  return kept;
}

function buildDeterministicPack(id: string, notes: ExtractedNotes) {
  const topics = ensureTopics(notes);
  const facts = notes.facts.length ? notes.facts : topics;
  const language = normalizeQuizLanguage(notes.language, "und");
  const chrome = quizChrome(language);
  const distractors = chrome.distractors;
  const questionsA: QuizQuestion[] = [];
  const questionsB: QuizQuestion[] = [];
  const tiny: Level[] = [];

  topics.forEach((topic, index) => {
    const fact = facts[index % facts.length];
    const other = facts.find((item) => item !== fact) ?? distractors[0];
    const qA1 = mcQuestion(
      `${id}-a-t${index + 1}q1`,
      chrome.whichNote(topic),
      fact,
      [other, distractors[0], distractors[1]],
      chrome.worksheetFact(fact),
    );
    const qA2 = mcQuestion(
      `${id}-a-t${index + 1}q2`,
      chrome.trueFalse(fact),
      chrome.trueLabel,
      [chrome.falseLabel],
      chrome.trueHint,
      ["A", "B"],
    );
    const qB1 = mcQuestion(
      `${id}-b-t${index + 1}q1`,
      chrome.pickFact(topic),
      fact,
      [distractors[2], distractors[3], other],
      chrome.rematchHint(fact),
    );
    const qB2 = mcQuestion(
      `${id}-b-t${index + 1}q2`,
      chrome.includesIdea(topic),
      chrome.yes,
      [chrome.no],
      chrome.yesHint,
      ["A", "B"],
    );
    questionsA.push(qA1, qA2);
    questionsB.push(qB1, qB2);
    tiny.push({
      id: `${id}-l${index + 1}`,
      packId: id,
      title: topic.slice(0, 42),
      theme: slugify(topic) || `topic-${index + 1}`,
      passRule: index === 0 ? { type: "minCorrect", count: 1 } : { type: "complete" },
      questionIds: { A: [qA1.id, qA2.id], B: [qB1.id, qB2.id] },
    });
  });

  const pack: QuizPackFile = {
    id,
    title: notes.title,
    language,
    source: "Homework scan",
    variants: { A: questionsA, B: questionsB },
  };
  const levels: Level[] = [
    {
      id: `${id}-full`,
      packId: id,
      title: `${notes.title} · full pack`,
      theme: "full-pack",
      mega: true,
      passRule: { type: "complete" },
      questionIds: {
        A: questionsA.map((question) => question.id),
        B: questionsB.map((question) => question.id),
      },
    },
    ...tiny,
  ];
  return { pack, levels };
}

function ensureTopics(notes: ExtractedNotes) {
  const topics = notes.topics.map((topic) => topic.trim()).filter(Boolean);
  if (topics.length >= 3) return topics.slice(0, 5);
  const extras = notes.facts
    .map((fact) => fact.trim())
    .filter(Boolean)
    .filter((fact) => !topics.includes(fact));
  const merged = [...topics, ...extras].slice(0, 5);
  while (merged.length < 3) {
    merged.push(quizChrome(notes.language).topicFallback(merged.length + 1));
  }
  return merged;
}

function mcQuestion(
  id: string,
  prompt: string,
  correct: string,
  wrong: string[],
  parentHint: string,
  ids?: string[],
): QuizQuestion {
  const optionIds = ids ?? ["A", "B", "C", "D"];
  const texts = [correct, ...wrong].slice(0, optionIds.length);
  const options = optionIds.slice(0, texts.length).map((optionId, index) => ({
    id: optionId,
    text: texts[index],
  }));
  return {
    id,
    prompt,
    options,
    correctOptionId: optionIds[0],
    parentHint,
  };
}

function validatePack(pack: QuizPackFile, levels: Level[]) {
  const tiny = levels.filter((level) => !level.mega);
  if (tiny.length < 3 || tiny.length > 5) {
    throw new GameError("Generated pack must have 3–5 tiny levels.", 500);
  }
  (["A", "B"] as QuizVariant[]).forEach((variant) => {
    const questions = pack.variants[variant];
    if (!questions?.length) throw new GameError("Generated pack is missing questions.", 500);
    for (const question of questions) {
      if (!question.options.some((option) => option.id === question.correctOptionId)) {
        throw new GameError("Generated question is missing a valid key.", 500);
      }
    }
  });
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
}
