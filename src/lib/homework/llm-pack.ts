import type { Level, QuizPackFile, QuizQuestion } from "../../data/types";
import { xaiChat, xaiTextModel } from "../ai/xai";
import { normalizeQuizLanguage, primaryLang } from "./language";
import { parseJsonObject } from "./json";
import type { ExtractedNotes, HomeworkMode } from "./types";

const CHLOPI_LEAK = /chłopi|chlopi|reymont|jagna|boryna/;

export function shouldUseChlopiFixture(notes: ExtractedNotes, mode: HomeworkMode): boolean {
  if (mode === "xai") return false;
  if (notes.fixtureId === "chlopi-worksheet") return true;
  const blob = `${notes.title}\n${notes.topics.join(" ")}\n${notes.rawText}`.toLowerCase();
  return /chłopi|chlopi|reymont/.test(blob);
}

export function quizUserPrompt(notes: ExtractedNotes) {
  return `Create a sibling-rivalry quiz pack from confirmed homework notes.
Kids must practice. Do NOT write an essay. Do NOT dump the worksheet answer key into the prompt or the options.
parentHint is one short nudge for the parent key screen. It must not be the letter of the correct option and must not be a worked solution.
Student prompts must not contain "the answer is" or paste the correct option into the stem.
Write every student-facing prompt, option, and level title in language ${notes.language}. Do not translate into English or Polish unless that is already the worksheet language. Do not mention Chłopi, Reymont, Jagna, or Boryna unless those names are in the notes.
Return JSON:
{
  "title": string,
  "language": "BCP-47 / ISO code matching the worksheet",
  "levels": [
    {
      "title": string,
      "theme": string,
      "questionsA": [{ "prompt": string, "options": ["A text", "B text", "C text", "D text"], "correctIndex": 0, "parentHint": "short parent nudge" }],
      "questionsB": [same shape, reworded for rematch]
    }
  ]
}
Need 3-5 levels. Each level 1-3 multiple-choice questions. Variant B is the same facts, different wording. Guided practice, not an answer dump.
Notes title: ${notes.title}
Language: ${notes.language}
Topics: ${notes.topics.join(" | ")}
Facts: ${notes.facts.join(" | ")}
Essay prompts (do not answer them): ${notes.essayPrompts.join(" | ")}
Kept text: ${notes.rawText.slice(0, 4000)}`;
}

export async function requestPracticePack(
  id: string,
  notes: ExtractedNotes,
): Promise<{ pack: QuizPackFile; levels: Level[] }> {
  const raw = await xaiChat({
    model: xaiTextModel(),
    temperature: 0.4,
    json: true,
    messages: [
      {
        role: "system",
        content:
          "You write practice quizzes for children. Never dump an answer key or write an essay. Never switch the subject to Chłopi unless the notes are about that book.",
      },
      { role: "user", content: quizUserPrompt(notes) },
    ],
  });
  const built = packFromLlmText(id, notes, raw);
  assertPackFitsNotes(built.pack, notes);
  return built;
}

export function packFromLlmText(
  id: string,
  notes: ExtractedNotes,
  raw: string,
): { pack: QuizPackFile; levels: Level[] } {
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
  const language = normalizeQuizLanguage(parsed.language, notes.language);
  const llmLevels = (parsed.levels ?? []).slice(0, 5);
  if (llmLevels.length < 3) {
    throw new Error("Grok returned too few levels");
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
    source: "Homework scan · Grok",
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

export function assertPackFitsNotes(pack: QuizPackFile, notes: ExtractedNotes) {
  const want = primaryLang(notes.language);
  const got = primaryLang(pack.language);
  if (want !== "und" && got !== "und" && want !== got) {
    throw new Error(`Grok pack language ${got} does not match worksheet language ${want}`);
  }
  if (packLeaksUnrelatedChlopi(pack, notes)) {
    throw new Error("Grok switched this worksheet to the Chłopi fixture");
  }
  const questions = [...pack.variants.A, ...pack.variants.B];
  for (const question of questions) {
    if (/the answer is|odpowiedź to|la respuesta es/i.test(question.prompt)) {
      throw new Error("Grok put an answer dump in a student prompt");
    }
  }
}

export function packLeaksUnrelatedChlopi(pack: QuizPackFile, notes: ExtractedNotes) {
  const notesBlob = `${notes.title}\n${notes.topics.join(" ")}\n${notes.facts.join(" ")}\n${notes.rawText}`.toLowerCase();
  const notesAreChlopi =
    notes.fixtureId === "chlopi-worksheet" || CHLOPI_LEAK.test(notesBlob);
  if (notesAreChlopi) return false;
  const prompts = [...pack.variants.A, ...pack.variants.B]
    .map((question) => `${question.prompt} ${question.options.map((option) => option.text).join(" ")}`)
    .join("\n")
    .toLowerCase();
  return CHLOPI_LEAK.test(prompts);
}

type LlmQuestion = {
  prompt?: string;
  options?: string[];
  correctIndex?: number;
  parentHint?: string;
};

function fromLlmQuestion(id: string, item: LlmQuestion): QuizQuestion {
  const options = (item.options ?? [])
    .map((text, index) => ({
      id: String.fromCharCode(65 + index),
      text: String(text).trim(),
    }))
    .filter((option) => option.text);
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

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
}
