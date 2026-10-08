import "server-only";

import { createHash } from "crypto";
import type { Level, QuizPackFile, QuizQuestion, QuizVariant } from "@/data/types";
import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { notesFromKeptLines } from "./fixture";
import { detectLanguage, normalizeQuizLanguage } from "./language";
import { homeworkMode } from "./mode";
import { quizChrome } from "./quiz-chrome";
import { saveGeneratedPack } from "./registry";
import type { ExtractedNotes, GeneratedHomeworkPack, HomeworkMode } from "./types";
import { parseJsonObject } from "./vision";
import { HomeworkError } from "./errors";
import { xaiComplete } from "./xai";

export function prepareNotes(rawNotes: ExtractedNotes): ExtractedNotes {
  return notesFromKeptLines({
    ...rawNotes,
    language: normalizeQuizLanguage(
      rawNotes.language && rawNotes.language !== "und" ? rawNotes.language : undefined,
      detectLanguage(
        `${rawNotes.title}\n${rawNotes.topics.join(" ")}\n${rawNotes.facts.join(" ")}\n${rawNotes.rawText}`,
      ),
    ),
  });
}

/** Same pack every time for these notes, so scoring does not need a saved upload. */
export function fixturePackFromNotes(rawNotes: ExtractedNotes): {
  notes: ExtractedNotes;
  pack: QuizPackFile;
  levels: Level[];
} {
  const notes = prepareNotes(rawNotes);
  if (!notes.topics.length && !notes.facts.length) {
    throw new GameError("Keep at least a few topics or facts, then generate.", 400);
  }
  const id = deterministicPackId(notes);
  return { notes, ...buildDeterministicPack(id, notes) };
}

export async function generateHomeworkPack(
  rawNotes: ExtractedNotes,
): Promise<GeneratedHomeworkPack> {
  const mode = homeworkMode();
  const prepared = prepareNotes(rawNotes);
  let notes = prepared;
  let pack: QuizPackFile | undefined;
  let levels: Level[] | undefined;
  let usedMode: HomeworkMode = "fixture";

  if (mode === "xai") {
    try {
      const generated = await generateWithLlm(randomId("hw"), prepared);
      validatePack(generated.pack, generated.levels);
      pack = generated.pack;
      levels = generated.levels;
      usedMode = "xai";
    } catch {
      // The model timed out or returned junk. Build the quiz from the notes
      // we already read so this request still returns a pack.
      usedMode = "fixture";
    }
  }

  if (!pack || !levels) {
    try {
      const built = fixturePackFromNotes(rawNotes);
      validatePack(built.pack, built.levels);
      notes = built.notes;
      pack = built.pack;
      levels = built.levels;
      usedMode = "fixture";
    } catch {
      throw new HomeworkError(
        "We read your page but couldn't build the quiz.",
        "generate_failed",
        422,
      );
    }
  }

  validatePack(pack, levels);
  const generated: GeneratedHomeworkPack = {
    id: pack.id,
    pack,
    levels,
    writing: null,
    notes,
    mode: usedMode,
    createdAt: Date.now(),
  };
  saveGeneratedPack(withoutUpload(generated));
  return generated;
}

function withoutUpload(pack: GeneratedHomeworkPack): GeneratedHomeworkPack {
  return {
    ...pack,
    notes: {
      title: pack.notes.title,
      language: pack.notes.language,
      topics: [],
      facts: [],
      essayPrompts: [],
      rawText: "",
      lines: [],
    },
  };
}

function deterministicPackId(notes: ExtractedNotes) {
  const body = JSON.stringify({
    fixtureId: notes.fixtureId ?? "",
    title: notes.title,
    language: notes.language,
    topics: notes.topics,
    facts: notes.facts,
    kept: notes.lines.filter((line) => line.keep).map((line) => line.text),
    raw: notes.rawText,
  });
  return `hw${createHash("sha256").update(body).digest("hex").slice(0, 12)}`;
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

async function generateWithLlm(
  id: string,
  notes: ExtractedNotes,
): Promise<{ pack: QuizPackFile; levels: Level[] }> {
  const prompt = `Create a sibling-rivalry quiz pack from homework notes taken from the student's pages.
Every question must be answerable from those page notes. Infer a fair difficulty from the material. Do not ask the student for a name, grade, or topic list.
Kids must practice — do NOT write the essay for them, and do NOT dump worksheet answer-key short answers as student-facing explanations.
Write every student-facing prompt, option, and level title in the worksheet language (${notes.language}). Do not translate the notes into English or Polish unless the worksheet already is that language. Do not coerce language to pl or en.
Return JSON:
{
  "title": string,
  "language": "BCP-47 / ISO code matching the worksheet",
  "levels": [
    {
      "title": string,
      "theme": string,
      "questionsA": [{ "prompt": string, "options": ["A text", "B text", "C text", "D text"], "correctIndex": 0, "parentHint": "English for the parent key screen" }],
      "questionsB": [same shape, reworded for rematch]
    }
  ]
}
Need 3-5 levels. Each level 2-3 multiple-choice questions. Variant B is the same facts, different wording.
Notes title: ${notes.title}
Language: ${notes.language}
Topics: ${notes.topics.join(" | ")}
Facts: ${notes.facts.join(" | ")}
Essay prompts (do not answer them): ${notes.essayPrompts.join(" | ")}
Kept text: ${notes.rawText.slice(0, 4000)}`;

  const raw = await xaiComplete({ content: prompt, temperature: 0.4, maxTokens: 4096 });
  const parsed = parseJsonObject(raw.text) as {
    title?: string;
    language?: string;
    levels?: {
      title?: string;
      theme?: string;
      questionsA?: LlmQuestion[];
      questionsB?: LlmQuestion[];
    }[];
  };
  const language = normalizeQuizLanguage(parsed.language, notes.language);
  const llmLevels = (parsed.levels ?? []).slice(0, 5);
  if (llmLevels.length < 3) {
    throw new Error("LLM returned too few levels");
  }

  const questionsA: QuizQuestion[] = [];
  const questionsB: QuizQuestion[] = [];
  const tiny: Level[] = [];
  llmLevels.forEach((level, index) => {
    const aQs = (level.questionsA ?? []).slice(0, 3).map((item, qIndex) =>
      fromLlmQuestion(`${id}-a-l${index + 1}q${qIndex + 1}`, item),
    );
    const bQs = (level.questionsB ?? []).slice(0, 3).map((item, qIndex) =>
      fromLlmQuestion(`${id}-b-l${index + 1}q${qIndex + 1}`, item),
    );
    if (aQs.length < 1 || bQs.length < 1) throw new Error("Level missing questions");
    questionsA.push(...aQs);
    questionsB.push(...bQs);
    tiny.push({
      id: `${id}-l${index + 1}`,
      packId: id,
      title: String(level.title || `Level ${index + 1}`).slice(0, 42),
      theme: slugify(String(level.theme || level.title || `t${index + 1}`)) || `t${index + 1}`,
      passRule: { type: "complete" },
      questionIds: {
        A: aQs.map((question) => question.id),
        B: bQs.map((question) => question.id),
      },
    });
  });

  const pack: QuizPackFile = {
    id,
    title: String(parsed.title || notes.title).trim() || notes.title,
    language,
    source: "Homework scan · xAI",
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

type LlmQuestion = {
  prompt?: string;
  options?: string[];
  correctIndex?: number;
  parentHint?: string;
};

function fromLlmQuestion(id: string, item: LlmQuestion): QuizQuestion {
  const options = (item.options ?? []).map((text, index) => ({
    id: String.fromCharCode(65 + index),
    text: String(text).trim(),
  })).filter((option) => option.text);
  if (options.length < 2) throw new Error("Question needs options");
  const correctIndex = Math.min(Math.max(Number(item.correctIndex) || 0, 0), options.length - 1);
  return {
    id,
    prompt: String(item.prompt || "").trim() || "Which is true?",
    options,
    correctOptionId: options[correctIndex].id,
    parentHint: String(item.parentHint || "").trim() || "See the confirmed worksheet notes.",
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
