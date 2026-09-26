import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { XAI_CHAT_COMPLETIONS_URL } from "../ai/xai";
import { countWords } from "./words";
import { resolveCoachUi } from "./chrome";
import { planWritingCoach, wordTargetForPrompt } from "./plan";

const originalFetch = globalThis.fetch;
const SPANISH =
  "¿Por qué es importante cuidar el agua en tu comunidad? Escribe un texto con tu opinión y un ejemplo de tu vida.";

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.XAI_API_KEY;
});

function spanishCoachJson() {
  return JSON.stringify({
    title: "Cuidar el agua",
    blurb: "Tú escribes el texto. Esto solo te ayuda a planear.",
    kicker: "Grados 4–6 · es",
    stanceTitle: "Tu postura",
    stanceLegend: "Elige una dirección",
    themeTitle: "Ideas",
    themeBlurb: "Elige una idea y un ejemplo tuyo.",
    themeLinkLabel: "2. Enlace con la consigna",
    themeLinkPlaceholder: "el agua en tu barrio",
    exampleTitle: "Tu ejemplo",
    exampleBlurb: "Escríbelo tú.",
    examplePlaceholder: "en el colegio o en casa",
    exampleHint: "Cambia el lugar y la persona de esta frase.",
    closingHint: "Cierra con una frase que vuelva a tu postura.",
    stances: [
      {
        id: "tak",
        label: "Sí",
        tip: "Estás de acuerdo y das un ejemplo de tu barrio.",
        thesisHint: "Creo que sí, porque el agua de mi barrio hay que cuidarla.",
      },
      {
        id: "nie",
        label: "No",
        tip: "No estás de acuerdo y explicas qué es distinto.",
        thesisHint: "Creo que no, porque en mi barrio el agua ya se cuida bien.",
      },
      {
        id: "czesciowo",
        label: "En parte",
        tip: "Algo encaja y algo no.",
        thesisHint: "En parte importa, pero no en todos los sitios de mi ciudad.",
      },
    ],
    themes: [
      {
        id: "agua",
        label: "Cuidar el agua",
        hint: "Piensa en un grifo, un río o la lluvia de tu zona.",
        parentNote: "Local water, not a model paragraph.",
        sampleSentence: "En mi calle a veces se deja el grifo abierto.",
      },
    ],
    reviewChecks: [
      "¿La postura está clara?",
      "¿El ejemplo es de tu vida?",
      "¿La última frase vuelve a la postura?",
    ],
    parentNotesEn: ["Do not write the essay for them."],
    source: {
      kicker: "Fuente",
      title: "El agua",
      byline: "Consigna",
      intro: "Lee la consigna y escribe con tus palabras.",
      facts: ["El agua es limitada."],
      sections: [{ id: "agua", title: "Cuidar el agua", body: "Un ejemplo del barrio." }],
      use: ["Elige una idea.", "Escribe el ejemplo tú."],
    },
    ui: {
      steps: ["Plan", "Tesis", "Argumentos", "Ejemplo", "Borrador", "Revisar"],
      next: "Siguiente",
      back: "Atrás",
      hintShow: "Pista",
    },
  });
}

describe("word targets", () => {
  it("uses a count or range written in the prompt", () => {
    assert.deepEqual(wordTargetForPrompt("Escribe un texto de 150–200 palabras sobre el agua.", "5"), {
      min: 150,
      max: 200,
    });
    assert.deepEqual(wordTargetForPrompt("Write 150-200 words on fractions.", "3"), {
      min: 150,
      max: 200,
    });
    assert.deepEqual(wordTargetForPrompt("Write 150 to 200 words.", "3"), { min: 150, max: 200 });
    assert.deepEqual(wordTargetForPrompt("Écris entre 150 et 200 mots.", "8"), { min: 150, max: 200 });
    assert.deepEqual(wordTargetForPrompt("Schreibe 150 bis 200 Wörter.", "8"), { min: 150, max: 200 });
    assert.deepEqual(wordTargetForPrompt("Napisz ok. 100 słów o szkole.", "8"), { min: 100, max: 100 });
    assert.deepEqual(wordTargetForPrompt("Write about 100 words on pets.", "11"), { min: 100, max: 100 });
  });

  it("falls back to the grade band when the prompt has no word count", () => {
    assert.deepEqual(wordTargetForPrompt("Grades 4–6. Write about rivers in your town.", "5"), {
      min: 60,
      max: 110,
    });
    assert.deepEqual(wordTargetForPrompt(SPANISH, "5"), { min: 60, max: 110 });
    assert.deepEqual(wordTargetForPrompt("Napisz o klasie 8 i wakacjach.", "8"), { min: 90, max: 140 });
  });
});

describe("writing coach", () => {
  it("coaches a Spanish prompt from a mocked Grok response without writing the essay", async () => {
    process.env.XAI_API_KEY = "xai-test";
    let url = "";
    let body = "";
    globalThis.fetch = async (input, init) => {
      url = String(input);
      body = String(init?.body);
      return Response.json({ choices: [{ message: { content: spanishCoachJson() } }] });
    };
    const result = await planWritingCoach({
      prompt: SPANISH,
      language: "es",
      grade: "5",
      title: "El agua",
    });
    assert.equal(url, XAI_CHAT_COMPLETIONS_URL);
    assert.match(body, /Do not write the essay/);
    assert.match(body, /cuidar el agua/);
    assert.equal(result.mode, "xai");
    assert.equal(result.notice, null);
    assert.equal(result.config.language, "es");
    assert.equal(result.config.prompt, SPANISH);
    assert.equal(result.config.targetWordsMin, 60);
    assert.equal(result.config.targetWordsMax, 110);
    assert.deepEqual(
      result.config.stances.map((stance) => stance.label),
      ["Sí", "No", "En parte"],
    );
    const ui = resolveCoachUi(result.config.language, result.config.ui);
    assert.equal(ui.next, "Siguiente");
    assert.equal(ui.steps[0], "Plan");
    const hints = [
      ...result.config.stances.map((stance) => stance.thesisHint),
      ...result.config.themes.map((theme) => theme.sampleSentence ?? ""),
      result.config.exampleHint,
      result.config.closingHint,
    ].join(" ");
    assert.ok(countWords(hints) < 120);
    assert.doesNotMatch(JSON.stringify(result.config), /chłopi|chlopi|jagna/i);
  });

  it("keeps a prompt word range and a long stance label", async () => {
    process.env.XAI_API_KEY = "xai-test";
    const prompt = "Should schools ban homework? Write 150–200 words. Take a clear side.";
    let body = "";
    globalThis.fetch = async (_input, init) => {
      body = String(init?.body);
      const parsed = JSON.parse(spanishCoachJson()) as { stances: { label: string }[] };
      parsed.stances[0].label = "Yes — ban homework in middle school";
      parsed.stances[1].label = "No — keep homework, with limits";
      parsed.stances[2].label = "Partly — ban it only on weekends";
      return Response.json({ choices: [{ message: { content: JSON.stringify(parsed) } }] });
    };
    const result = await planWritingCoach({
      prompt,
      language: "en",
      grade: "5",
    });
    assert.match(body, /150/);
    assert.match(body, /200/);
    assert.equal(result.config.targetWordsMin, 150);
    assert.equal(result.config.targetWordsMax, 200);
    assert.equal(result.config.stances[0]?.label, "Yes — ban homework in middle school");
    assert.equal(result.config.stances[1]?.label, "No — keep homework, with limits");
    assert.doesNotMatch(result.config.stances.map((stance) => stance.label).join("\n"), /…/);
  });

  it("uses the prompt range on the local coach when AI is not configured", async () => {
    const result = await planWritingCoach({
      prompt: "Escribe 150-200 palabras sobre el agua en tu barrio y da un ejemplo.",
      language: "es",
      grade: "5",
    });
    assert.equal(result.mode, "fixture");
    assert.equal(result.config.targetWordsMin, 150);
    assert.equal(result.config.targetWordsMax, 200);
  });

  it("keeps a Spanish scaffold and says AI is not configured when no key is set", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      throw new Error("fetch should not run");
    };
    const result = await planWritingCoach({
      prompt: SPANISH,
      language: "es",
      grade: "8",
    });
    assert.equal(called, false);
    assert.equal(result.mode, "fixture");
    assert.match(result.notice ?? "", /AI is not configured/);
    assert.equal(result.config.language, "es");
    assert.equal(result.config.prompt, SPANISH);
    assert.equal(result.config.stances[0]?.label, "Sí");
    assert.match(result.config.blurb, /no entrega el texto/i);
  });
});
