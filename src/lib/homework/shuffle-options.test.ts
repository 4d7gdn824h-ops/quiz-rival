import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { QuizPackFile, QuizQuestion } from "@/data/types";
import { generateHomeworkPack } from "./generate";
import { shufflePackOptions } from "./shuffle-options";
import type { ExtractedNotes } from "./types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.XAI_API_KEY;
});

function question(id: string, correct: string): QuizQuestion {
  return {
    id,
    prompt: `Question ${id}`,
    options: [
      { id: "A", text: correct },
      { id: "B", text: `${correct} — wrong 1` },
      { id: "C", text: `${correct} — wrong 2` },
      { id: "D", text: `${correct} — wrong 3` },
    ],
    correctOptionId: "A",
    parentHint: "See the notes.",
  };
}

function allAPack(id: string): QuizPackFile {
  return {
    id,
    title: "Fractions",
    language: "en",
    variants: {
      A: [question("a1", "one half"), question("a2", "numerator"), question("a3", "denominator")],
      B: [question("b1", "one half"), question("b2", "numerator"), question("b3", "denominator")],
    },
  };
}

describe("option shuffle", () => {
  it("moves correct answers off a single letter and keeps the key", () => {
    const once = shufflePackOptions(allAPack("hw_fractions"));
    const twice = shufflePackOptions(allAPack("hw_fractions"));
    assert.deepEqual(once, twice);
    const letters = [...once.variants.A, ...once.variants.B].map((item) => item.correctOptionId);
    assert.ok(new Set(letters).size > 1, `expected mixed keys, got ${letters.join(",")}`);
    for (const item of [...once.variants.A, ...once.variants.B]) {
      const expected = item.id.endsWith("1") ? "one half" : item.id.endsWith("2") ? "numerator" : "denominator";
      assert.equal(item.options.find((option) => option.id === item.correctOptionId)?.text, expected);
      assert.deepEqual(
        item.options.map((option) => option.id),
        ["A", "B", "C", "D"],
      );
    }
  });

  it("shuffles a demo pack built without an API key", async () => {
    const notes: ExtractedNotes = {
      title: "Fractions",
      language: "en",
      topics: ["Halves", "Numerator", "Denominator"],
      facts: [
        "A fraction is a part of a whole.",
        "1/2 means one of two equal parts.",
        "The numerator is the top number.",
      ],
      essayPrompts: [],
      rawText: "Fractions practice",
      lines: [],
    };
    const generated = await generateHomeworkPack(notes);
    const questions = [...generated.pack.variants.A, ...generated.pack.variants.B];
    const letters = questions.map((item) => item.correctOptionId);
    assert.ok(new Set(letters).size > 1, `expected mixed keys, got ${letters.join(",")}`);
    for (const item of questions) {
      const correct = item.options.find((option) => option.id === item.correctOptionId);
      assert.ok(correct);
      assert.deepEqual(
        item.options.map((option) => option.id),
        item.options.map((_, index) => String.fromCharCode(65 + index)),
      );
    }
  });

  it("shuffles a Grok pack whose model put every answer on A", async () => {
    process.env.XAI_API_KEY = "xai-test";
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Fractions practice",
                language: "en",
                levels: ["Halves", "Numerator", "Denominator"].map((title) => ({
                  title,
                  theme: title,
                  questionsA: [
                    {
                      prompt: `Which note matches ${title}?`,
                      options: ["Right note", "Wrong one", "Wrong two", "Wrong three"],
                      correctIndex: 0,
                      parentHint: "Use the worksheet.",
                    },
                  ],
                  questionsB: [
                    {
                      prompt: `Rematch: which note matches ${title}?`,
                      options: ["Right note", "Wrong one", "Wrong two", "Wrong three"],
                      correctIndex: 0,
                      parentHint: "Use the worksheet.",
                    },
                  ],
                })),
              }),
            },
          },
        ],
      });
    const generated = await generateHomeworkPack({
      title: "Fractions",
      language: "en",
      topics: ["Halves", "Numerator", "Denominator"],
      facts: ["1/2 means one of two equal parts."],
      essayPrompts: [],
      rawText: "Fractions",
      lines: [],
    });
    assert.equal(generated.mode, "xai");
    const questions = [...generated.pack.variants.A, ...generated.pack.variants.B];
    const letters = questions.map((item) => item.correctOptionId);
    assert.ok(new Set(letters).size > 1, `expected mixed keys, got ${letters.join(",")}`);
    for (const item of questions) {
      assert.equal(item.options.find((option) => option.id === item.correctOptionId)?.text, "Right note");
      assert.deepEqual(
        item.options.map((option) => option.id),
        ["A", "B", "C", "D"],
      );
    }
  });
});
