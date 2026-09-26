import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { XAI_CHAT_COMPLETIONS_URL } from "../ai/xai";
import type { ExtractedNotes } from "./types";
import {
  packLeaksUnrelatedChlopi,
  requestPracticePack,
  shouldUseChlopiFixture,
} from "./llm-pack";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_MODEL;
});

function notes(partial: Partial<ExtractedNotes> & Pick<ExtractedNotes, "title" | "language">): ExtractedNotes {
  return {
    topics: [],
    facts: [],
    essayPrompts: [],
    rawText: "",
    lines: [],
    ...partial,
  };
}

const fractions = notes({
  title: "Fractions",
  language: "en",
  topics: ["Halves", "Numerator", "Denominator"],
  facts: [
    "A fraction is a part of a whole.",
    "1/2 means one of two equal parts.",
    "The numerator is the top number.",
    "The denominator is the bottom number.",
  ],
  rawText:
    "Fractions\nA fraction is a part of a whole.\n1/2 means one of two equal parts.\nThe numerator is the top number.\nThe denominator is the bottom number.",
});

function level(title: string, prompt: string) {
  const question = {
    prompt,
    options: ["One of two equal parts", "A whole only", "A times table", "A decimal point"],
    correctIndex: 0,
    parentHint: "Think about splitting one whole into equal groups.",
  };
  return {
    title,
    theme: title,
    questionsA: [question],
    questionsB: [{ ...question, prompt: `Rematch: ${prompt}` }],
  };
}

function fractionsJson() {
  return JSON.stringify({
    title: "Fractions practice",
    language: "en",
    levels: [
      level("Halves", "Which note matches halves?"),
      level("Numerator", "Which note matches the numerator?"),
      level("Denominator", "Which note matches the denominator?"),
    ],
  });
}

describe("practice packs", () => {
  it("does not clone Chłopi when Grok is configured", () => {
    const chlopi = notes({
      title: "Chłopi",
      language: "pl",
      fixtureId: "chlopi-worksheet",
      rawText: "Reymont, Jagna, Boryna",
    });
    assert.equal(shouldUseChlopiFixture(chlopi, "xai"), false);
    assert.equal(shouldUseChlopiFixture(chlopi, "fixture"), true);
    assert.equal(shouldUseChlopiFixture(fractions, "fixture"), false);
  });

  it("builds an English maths pack from a mocked Grok response", async () => {
    process.env.XAI_API_KEY = "xai-test";
    process.env.XAI_MODEL = "grok-4.6";
    let url = "";
    let body = "";
    globalThis.fetch = async (input, init) => {
      url = String(input);
      body = String(init?.body);
      return Response.json({ choices: [{ message: { content: fractionsJson() } }] });
    };
    const { pack } = await requestPracticePack("hw_maths", fractions);
    assert.equal(url, XAI_CHAT_COMPLETIONS_URL);
    assert.match(body, /grok-4\.6/);
    assert.match(body, /Fractions/);
    assert.match(body, /Never switch the subject to Chłopi/);
    assert.equal(pack.language, "en");
    assert.equal(pack.source, "Homework scan · Grok");
    assert.match(pack.variants.A[0].prompt, /halves/i);
    const blob = JSON.stringify(pack);
    assert.doesNotMatch(blob, /chłopi|chlopi|jagna|reymont|boryna/i);
    assert.equal(pack.variants.A[0].id.startsWith("hw_maths-"), true);
    assert.equal(packLeaksUnrelatedChlopi(pack, fractions), false);
  });

  it("rejects a mocked reply that swaps maths for Chłopi", async () => {
    process.env.XAI_API_KEY = "xai-test";
    const leaked = JSON.stringify({
      title: "Chłopi",
      language: "pl",
      levels: [
        level("Jagna", "Kim jest Jagna w Chłopach?"),
        level("Boryna", "Co robi Boryna?"),
        level("Reymont", "Kto napisał Chłopów Reymonta?"),
      ],
    });
    globalThis.fetch = async () =>
      Response.json({ choices: [{ message: { content: leaked } }] });
    await assert.rejects(() => requestPracticePack("hw_maths", fractions), /Chłopi|language/);
  });
});
