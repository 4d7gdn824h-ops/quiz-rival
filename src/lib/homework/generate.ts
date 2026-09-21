import "server-only";

import { LEVELS } from "@/data/levels";
import { getPack } from "@/data/quizzes";
import type { Level, QuizLanguage, QuizPackFile, QuizQuestion, QuizVariant } from "@/data/types";
import { GameError } from "@/lib/game/engine";
import { randomId } from "@/lib/ids";
import { notesFromKeptLines } from "./fixture";
import { homeworkMode } from "./mode";
import { saveGeneratedPack } from "./registry";
import type { ExtractedNotes, GeneratedHomeworkPack, HomeworkMode } from "./types";
import { parseJsonObject } from "./vision";
import { writingFromNotes } from "./writing-from-notes";

const DISTRACTORS_PL = [
  "Tego nie ma na tej karcie",
  "To fakt z innej lektury, nie z tej pracy",
  "To odpowiedź z matematyki, nie z tego tematu",
  "Akcja dzieje się w kosmosie",
];

const DISTRACTORS_EN = [
  "This is not on the worksheet",
  "That fact is from a different topic",
  "That is a math answer, not this subject",
  "The setting is outer space",
];

export async function generateHomeworkPack(
  rawNotes: ExtractedNotes,
): Promise<GeneratedHomeworkPack> {
  const notes = notesFromKeptLines(rawNotes);
  if (!notes.topics.length && !notes.facts.length) {
    throw new GameError("Keep at least a few topics or facts, then generate.", 400);
  }

  const id = randomId("hw");
  const mode = homeworkMode();
  let pack: QuizPackFile;
  let levels: Level[];
  let usedMode: HomeworkMode = "fixture";

  if (looksLikeChlopi(notes)) {
    ({ pack, levels } = cloneChlopiPack(id, notes));
    usedMode = "fixture";
  } else if (mode !== "fixture") {
    try {
      const generated = await generateWithLlm(id, notes, mode);
      pack = generated.pack;
      levels = generated.levels;
      usedMode = mode;
    } catch {
      ({ pack, levels } = buildDeterministicPack(id, notes));
      usedMode = "fixture";
    }
  } else {
    ({ pack, levels } = buildDeterministicPack(id, notes));
  }

  validatePack(pack, levels);
  const generated: GeneratedHomeworkPack = {
    id,
    pack,
    levels,
    writing: writingFromNotes(id, notes),
    notes,
    mode: usedMode,
    createdAt: Date.now(),
  };
  saveGeneratedPack(generated);
  return generated;
}

function looksLikeChlopi(notes: ExtractedNotes) {
  if (notes.fixtureId === "chlopi-worksheet") return true;
  const blob = `${notes.title}\n${notes.topics.join(" ")}\n${notes.rawText}`.toLowerCase();
  return /chłopi|chlopi|reymont/.test(blob);
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
  const language = notes.language;
  const distractors = language === "en" ? DISTRACTORS_EN : DISTRACTORS_PL;
  const questionsA: QuizQuestion[] = [];
  const questionsB: QuizQuestion[] = [];
  const tiny: Level[] = [];

  topics.forEach((topic, index) => {
    const fact = facts[index % facts.length];
    const other = facts.find((item) => item !== fact) ?? distractors[0];
    const qA1 = mcQuestion(
      `${id}-a-t${index + 1}q1`,
      language === "en" ? `Which note matches “${topic}”?` : `Która notatka pasuje do wątku „${topic}”?`,
      fact,
      [other, distractors[0], distractors[1]],
      language === "en" ? `Worksheet fact: ${fact}` : `From the sheet: ${fact}`,
    );
    const qA2 = mcQuestion(
      `${id}-a-t${index + 1}q2`,
      language === "en"
        ? `True or false: ${fact}`
        : `Prawda czy fałsz: ${fact}`,
      language === "en" ? "True" : "Prawda",
      [language === "en" ? "False" : "Fałsz"],
      language === "en"
        ? "That statement is on the kept notes — True."
        : "To zdanie jest na zatwierdzonej karcie — Prawda.",
      ["A", "B"],
    );
    const qB1 = mcQuestion(
      `${id}-b-t${index + 1}q1`,
      language === "en" ? `Pick the fact for: ${topic}` : `Wskaż fakt do tematu: ${topic}`,
      fact,
      [distractors[2], distractors[3], other],
      language === "en" ? `Same fact, rematch wording: ${fact}` : `Ten sam fakt, wariant B: ${fact}`,
    );
    const qB2 = mcQuestion(
      `${id}-b-t${index + 1}q2`,
      language === "en"
        ? `Does the worksheet include this idea: ${topic}?`
        : `Czy na karcie jest ten wątek: ${topic}?`,
      language === "en" ? "Yes" : "Tak",
      [language === "en" ? "No" : "Nie"],
      language === "en" ? "Yes — it is one of the approved topics." : "Tak — to zatwierdzony wątek.",
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
    merged.push(notes.language === "en" ? `Topic ${merged.length + 1}` : `Wątek ${merged.length + 1}`);
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
  mode: HomeworkMode,
): Promise<{ pack: QuizPackFile; levels: Level[] }> {
  const prompt = `Create a sibling-rivalry quiz pack from confirmed homework notes.
Kids must practice — do NOT write the essay for them, and do NOT dump worksheet answer-key short answers as student-facing explanations.
Return JSON:
{
  "title": string,
  "language": "pl" | "en",
  "levels": [
    {
      "title": string,
      "theme": string,
      "questionsA": [{ "prompt": string, "options": ["A text", "B text", "C text", "D text"], "correctIndex": 0, "parentHint": "English if language is pl" }],
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

  const raw =
    mode === "openai" ? await completeOpenAI(prompt) : await completeAnthropic(prompt);
  const parsed = parseJsonObject(raw) as {
    title?: string;
    language?: string;
    levels?: {
      title?: string;
      theme?: string;
      questionsA?: LlmQuestion[];
      questionsB?: LlmQuestion[];
    }[];
  };
  const language: QuizLanguage = parsed.language === "en" ? "en" : notes.language;
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
    source: "Homework scan · LLM",
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

async function completeOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI generate failed (${response.status})`);
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}

async function completeAnthropic(prompt: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_TEXT_MODEL || "claude-sonnet-4-5",
      max_tokens: 5000,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic generate failed (${response.status})`);
  }
  const body = (await response.json()) as {
    content?: { type?: string; text?: string }[];
  };
  return body.content?.find((part) => part.type === "text")?.text ?? "";
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
