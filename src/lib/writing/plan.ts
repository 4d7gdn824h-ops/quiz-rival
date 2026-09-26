import type { WritingPromptConfig, WritingTheme } from "../../data/writing-config";
import type { Stance } from "../../data/writing-coach";
import { AI_NOT_CONFIGURED_MESSAGE, xaiChat, xaiConfigured, xaiTextModel } from "../ai/xai";
import { detectLanguage, normalizeQuizLanguage, primaryLang } from "../homework/language";
import { parseJsonObject } from "../homework/json";
import type { HomeworkMode } from "../homework/types";
import { randomId } from "../ids";
import { countWords } from "./words";
import type { CoachUi } from "./chrome";

export interface WritingPlanInput {
  id?: string;
  prompt: string;
  language?: string;
  grade?: string;
  title?: string;
  topics?: string[];
  facts?: string[];
}

export interface WritingPlanResult {
  config: WritingPromptConfig;
  mode: HomeworkMode;
  notice: string | null;
}

const GRADE_WORDS: Record<string, { min: number; max: number }> = {
  "3": { min: 40, max: 80 },
  "5": { min: 60, max: 110 },
  "8": { min: 90, max: 140 },
  "11": { min: 140, max: 220 },
};

export function normalizeGrade(grade?: string) {
  const raw = String(grade ?? "8").trim();
  if (GRADE_WORDS[raw]) return raw;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return "8";
  if (n <= 3) return "3";
  if (n <= 6) return "5";
  if (n <= 9) return "8";
  return "11";
}

export function wordTargetForGrade(grade?: string) {
  return GRADE_WORDS[normalizeGrade(grade)];
}

export async function planWritingCoach(input: WritingPlanInput): Promise<WritingPlanResult> {
  const prompt = input.prompt.trim();
  if (prompt.length < 8) {
    throw new Error("Paste an assignment or essay prompt.");
  }
  const language = normalizeQuizLanguage(
    input.language && input.language !== "und" ? input.language : undefined,
    detectLanguage(prompt),
  );
  const prepared: WritingPlanInput = { ...input, prompt, language, grade: normalizeGrade(input.grade) };
  if (!xaiConfigured()) {
    return {
      config: localWritingCoach(prepared),
      mode: "fixture",
      notice: AI_NOT_CONFIGURED_MESSAGE,
    };
  }
  try {
    const raw = await xaiChat({
      model: xaiTextModel(),
      temperature: 0.4,
      json: true,
      messages: [
        {
          role: "system",
          content:
            "You coach a child who will write the essay themselves. Return JSON only. Do not write the essay, a model paragraph, or a full sample answer. Hints are one sentence the child must rewrite.",
        },
        { role: "user", content: coachUserPrompt(prepared) },
      ],
    });
    return { config: configFromModel(raw, prepared), mode: "xai", notice: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grok failed";
    return {
      config: localWritingCoach(prepared),
      mode: "fixture",
      notice: `Grok could not build this coach (${message}). A local scaffold is shown instead — it does not write the essay.`,
    };
  }
}

function coachUserPrompt(input: WritingPlanInput) {
  const words = wordTargetForGrade(input.grade);
  const lang = input.language || "und";
  return `Build a step-by-step writing coach for this assignment. The child writes every sentence.
Language for ALL student-facing strings: ${lang}. Do not translate the assignment itself.
Grade band: ${input.grade} (about ${words.min}–${words.max} words).
Do not write the essay. Each hint is ONE sentence (under 40 words) the child must change.
Stance ids must be "tak", "nie", "czesciowo" (labels in ${lang}).
Return JSON:
{
  "title": string,
  "blurb": string,
  "kicker": string,
  "stanceTitle": string,
  "stanceLegend": string,
  "themeTitle": string,
  "themeBlurb": string,
  "themeLinkLabel": string,
  "themeLinkPlaceholder": string,
  "exampleTitle": string,
  "exampleBlurb": string,
  "examplePlaceholder": string,
  "exampleHint": string,
  "closingHint": string,
  "stances": [{ "id": "tak"|"nie"|"czesciowo", "label": string, "tip": string, "thesisHint": string }],
  "themes": [{ "id": string, "label": string, "hint": string, "parentNote": string, "sampleSentence": string }],
  "reviewChecks": string[],
  "parentNotesEn": string[],
  "source": { "kicker": string, "title": string, "byline": string, "intro": string, "facts": string[], "sections": [{ "id": string, "title": string, "body": string }], "use": string[] },
  "ui": { "steps": [string, string, string, string, string, string], "next": string, "back": string, "hintShow": string }
}
3 stances. 1-3 themes drawn from the assignment, not from an unrelated book.
reviewChecks are questions, not a rewritten essay.
parentNotesEn is English for the parent and must say not to write the essay for the child.
Assignment title: ${input.title || ""}
Topics: ${(input.topics ?? []).join(" | ")}
Facts (do not turn these into the essay): ${(input.facts ?? []).join(" | ")}
Assignment (keep this wording; do not answer it):
${input.prompt}`;
}

export function configFromModel(raw: string, input: WritingPlanInput): WritingPromptConfig {
  const parsed = parseJsonObject(raw) as Record<string, unknown>;
  const local = localWritingCoach(input);
  const stances = normalizeStances(parsed.stances, local);
  const themes = normalizeThemes(parsed.themes, local);
  const reviewChecks = stringList(parsed.reviewChecks, 6).map(clipHint);
  const parentNotesEn = stringList(parsed.parentNotesEn, 8);
  if (!parentNotesEn.some((note) => /do not write the essay/i.test(note))) {
    parentNotesEn.unshift("Do not write the essay for them. Hints are one sentence to adapt.");
  }
  const hintBlob = [
    ...stances.map((stance) => `${stance.tip} ${stance.thesisHint}`),
    ...themes.map((theme) => `${theme.hint} ${theme.sampleSentence}`),
    String(parsed.exampleHint ?? ""),
    String(parsed.closingHint ?? ""),
    ...reviewChecks,
  ].join(" ");
  if (countWords(hintBlob) > 380) {
    throw new Error("Coach hints were an essay, not a scaffold");
  }
  const sourceRaw = (parsed.source ?? {}) as Record<string, unknown>;
  const words = wordTargetForGrade(input.grade);
  const ui = uiOverride(parsed.ui);
  return {
    ...local,
    id: input.id || local.id,
    language: input.language || local.language,
    kicker: clip(String(parsed.kicker || local.kicker), 80),
    title: clip(String(parsed.title || local.title), 80),
    blurb: clip(String(parsed.blurb || local.blurb), 220),
    prompt: input.prompt,
    targetWordsMin: words.min,
    targetWordsMax: words.max,
    stanceTitle: clip(String(parsed.stanceTitle || local.stanceTitle), 80),
    stanceLegend: clip(String(parsed.stanceLegend || local.stanceLegend), 120),
    themeTitle: clip(String(parsed.themeTitle || local.themeTitle), 80),
    themeBlurb: clip(String(parsed.themeBlurb || local.themeBlurb), 220),
    themeLinkLabel: clip(String(parsed.themeLinkLabel || local.themeLinkLabel), 80),
    themeLinkPlaceholder: clip(String(parsed.themeLinkPlaceholder || local.themeLinkPlaceholder), 120),
    exampleTitle: clip(String(parsed.exampleTitle || local.exampleTitle), 80),
    exampleBlurb: clip(String(parsed.exampleBlurb || local.exampleBlurb), 220),
    examplePlaceholder: clip(String(parsed.examplePlaceholder || local.examplePlaceholder), 160),
    exampleHint: clipHint(String(parsed.exampleHint || local.exampleHint)),
    closingHint: clipHint(String(parsed.closingHint || local.closingHint)),
    stances,
    themes,
    reviewChecks: reviewChecks.length ? reviewChecks : local.reviewChecks,
    parentNotesEn,
    source: {
      kicker: clip(String(sourceRaw.kicker || local.source.kicker), 80),
      title: clip(String(sourceRaw.title || input.title || local.source.title), 80),
      byline: clip(String(sourceRaw.byline || local.source.byline), 120),
      intro: clip(String(sourceRaw.intro || local.source.intro), 320),
      facts: stringList(sourceRaw.facts, 8).map((fact) => clip(fact, 220)),
      sections: themeSections(sourceRaw.sections, themes),
      use: stringList(sourceRaw.use, 6).map((item) => clip(item, 180)),
    },
    ui,
  };
}

function uiOverride(value: unknown): Partial<CoachUi> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const ui: Partial<CoachUi> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (key === "steps" && Array.isArray(item) && item.length === 6) {
      ui.steps = item.map((step) => clip(String(step), 24)) as CoachUi["steps"];
    } else if (typeof item === "string" && item.trim()) {
      (ui as Record<string, string>)[key] = clip(item, 180);
    }
  }
  return ui;
}

function normalizeStances(value: unknown, local: WritingPromptConfig) {
  const rows = Array.isArray(value) ? value : [];
  const mapped = rows.slice(0, 3).map((row, index) => {
    const item = (row ?? {}) as Record<string, unknown>;
    const id = stanceId(String(item.id ?? ""), index);
    return {
      id,
      label: clip(String(item.label || local.stances[index]?.label || id), 32),
      tip: clipHint(String(item.tip || local.stances[index]?.tip || "")),
      thesisHint: clipHint(String(item.thesisHint || local.stances[index]?.thesisHint || "")),
    };
  });
  if (mapped.length < 3) {
    throw new Error("Grok coach is missing stances");
  }
  const ids = new Set(mapped.map((item) => item.id));
  if (ids.size < 3) throw new Error("Grok coach stances were not distinct");
  return mapped;
}

function stanceId(raw: string, index: number): Stance {
  const value = raw.toLowerCase();
  if (["tak", "yes", "sí", "si", "oui", "ja"].includes(value)) return "tak";
  if (["nie", "no", "non"].includes(value)) return "nie";
  if (["czesciowo", "częściowo", "partly", "partial", "en parte", "partiellement"].includes(value)) {
    return "czesciowo";
  }
  return (["tak", "nie", "czesciowo"] as const)[index] ?? "czesciowo";
}

function normalizeThemes(value: unknown, local: WritingPromptConfig): WritingTheme[] {
  const rows = Array.isArray(value) ? value : [];
  const themes = rows.slice(0, 3).map((row, index) => {
    const item = (row ?? {}) as Record<string, unknown>;
    const label = clip(String(item.label || local.themes[index]?.label || `Idea ${index + 1}`), 80);
    return {
      id: slug(String(item.id || label)) || `topic-${index + 1}`,
      label,
      hint: clipHint(String(item.hint || local.themes[index]?.hint || label)),
      parentNote: clip(String(item.parentNote || label), 180),
      sampleSentence: clipHint(String(item.sampleSentence || local.themes[index]?.sampleSentence || label)),
    };
  });
  if (!themes.length) throw new Error("Grok coach is missing themes");
  return themes;
}

function themeSections(value: unknown, themes: WritingTheme[]) {
  if (!Array.isArray(value) || !value.length) {
    return themes.map((theme) => ({ id: theme.id, title: theme.label, body: theme.hint }));
  }
  return value.slice(0, 4).map((row, index) => {
    const item = (row ?? {}) as Record<string, unknown>;
    return {
      id: slug(String(item.id || themes[index]?.id || `s${index + 1}`)) || `s${index + 1}`,
      title: clip(String(item.title || themes[index]?.label || "Idea"), 80),
      body: clip(String(item.body || themes[index]?.hint || ""), 240),
    };
  });
}

const COPY: Record<
  string,
  {
    title: string;
    blurb: string;
    stanceTitle: string;
    stanceLegend: string;
    themeTitle: string;
    themeBlurb: string;
    themeLinkLabel: string;
    exampleTitle: string;
    exampleBlurb: string;
    examplePlaceholder: string;
    exampleHint: string;
    closingHint: string;
    stances: { id: Stance; label: string; tip: string; thesisHint: string }[];
    sample: (topic: string) => string;
    review: string[];
    sourceIntro: string;
    sourceByline: string;
    sourceKicker: string;
    use: string[];
    grade: Record<string, string>;
  }
> = {
  en: {
    title: "Write the response",
    blurb: "You write it. This coach only helps you plan — it will not hand you a finished essay.",
    stanceTitle: "Your stance",
    stanceLegend: "Pick a direction",
    themeTitle: "Ideas from the assignment",
    themeBlurb: "Pick 1–3. Then connect them to your own example.",
    themeLinkLabel: "2. Link to the assignment",
    exampleTitle: "Your own example",
    exampleBlurb: "Write it yourself. We will not paste a finished paragraph.",
    examplePlaceholder: "e.g. something from school, home, or your own day",
    exampleHint: "One sentence — change the specifics (who? where?).",
    closingHint: "Close with one sentence that is your conclusion.",
    stances: [
      {
        id: "tak",
        label: "Yes",
        tip: "You agree. Name one idea from the assignment and one example from your life.",
        thesisHint: "I think yes, because one idea from the assignment shows up in my own life.",
      },
      {
        id: "nie",
        label: "No",
        tip: "You disagree. Say what is different, and still give a real example.",
        thesisHint: "I think the answer is no, because the situation in the assignment is not mine.",
      },
      {
        id: "czesciowo",
        label: "Partly",
        tip: "Some of it fits and some does not. Name both.",
        thesisHint: "Partly: one idea from the assignment fits my life, but not all of it.",
      },
    ],
    sample: (topic) => `Write one sentence of your own about “${topic}”. Do not copy the sheet.`,
    review: [
      "Is the stance clear?",
      "Did you use an idea from the assignment?",
      "Is the example in your own words?",
      "Does the last sentence come back to the stance?",
    ],
    sourceIntro: "These are source notes. Read them, close this sheet, and write in your own words.",
    sourceByline: "From the assignment",
    sourceKicker: "Source",
    use: [
      "Pick 1–3 ideas that support your stance.",
      "Add your own example — the coach will not write it.",
      "Close this sheet to return to the same step.",
    ],
    grade: { "3": "Grades 1–3", "5": "Grades 4–6", "8": "Grades 7–9", "11": "Grades 10–12" },
  },
  pl: {
    title: "Napisz wypowiedź",
    blurb: "Piszesz sama. Trener tylko układa plan — nie oddaje gotowej pracy.",
    stanceTitle: "Twoja teza",
    stanceLegend: "Wybierz kierunek tezy",
    themeTitle: "Wątki z polecenia",
    themeBlurb: "Zaznacz 1–3. Potem powiążesz je z własnym przykładem.",
    themeLinkLabel: "2. Nawiązanie do polecenia",
    exampleTitle: "Twój przykład",
    exampleBlurb: "Napisz sama. Nie wklejamy gotowego akapitu.",
    examplePlaceholder: "np. sytuacja ze szkoły, domu albo Twojego dnia",
    exampleHint: "Jedno zdanie — zmień konkret (kto? gdzie?).",
    closingHint: "Na końcu jedno zdanie z wnioskiem, własnymi słowami.",
    stances: [
      {
        id: "tak",
        label: "Tak",
        tip: "Zgadzasz się. Nazwij jeden wątek z polecenia i jeden przykład z życia.",
        thesisHint: "Uważam, że tak, bo wątek z polecenia widać też w moim życiu.",
      },
      {
        id: "nie",
        label: "Nie",
        tip: "Nie zgadzasz się. Pokaż różnicę i i tak podaj własny przykład.",
        thesisHint: "Moim zdaniem nie, bo sytuacja z polecenia nie jest moją sytuacją.",
      },
      {
        id: "czesciowo",
        label: "Częściowo",
        tip: "Coś pasuje, coś nie. Nazwij obie strony.",
        thesisHint: "Częściowo: jeden wątek z polecenia pasuje do mojego życia, ale nie cały.",
      },
    ],
    sample: (topic) => `Napisz jedno własne zdanie o „${topic}”. Nie kopiuj karty.`,
    review: [
      "Czy teza jest jasna?",
      "Czy jest wątek z polecenia?",
      "Czy przykład jest Twoimi słowami?",
      "Czy ostatnie zdanie wraca do tezy?",
    ],
    sourceIntro: "To notatki źródłowe. Przeczytaj, zamknij kartę i pisz własnymi słowami.",
    sourceByline: "Z polecenia",
    sourceKicker: "Źródło",
    use: [
      "Wybierz 1–3 wątki, które podtrzymują tezę.",
      "Przykład dopisz sama — trener go nie pisze.",
      "Zamknij kartę: wrócisz do tego samego kroku.",
    ],
    grade: { "3": "Klasy 1–3", "5": "Klasy 4–6", "8": "Klasy 7–9", "11": "Klasy 10–12" },
  },
  es: {
    title: "Escribe la respuesta",
    blurb: "La escribes tú. Este entrenador solo ayuda a planear — no entrega el texto hecho.",
    stanceTitle: "Tu postura",
    stanceLegend: "Elige una dirección",
    themeTitle: "Ideas de la consigna",
    themeBlurb: "Elige 1–3. Luego las unes con un ejemplo tuyo.",
    themeLinkLabel: "2. Enlace con la consigna",
    exampleTitle: "Tu ejemplo",
    exampleBlurb: "Escríbelo tú. No pegamos un párrafo terminado.",
    examplePlaceholder: "p. ej. algo de la escuela, de casa o de tu día",
    exampleHint: "Una frase — cambia el detalle (¿quién? ¿dónde?).",
    closingHint: "Cierra con una frase que sea tu conclusión.",
    stances: [
      {
        id: "tak",
        label: "Sí",
        tip: "Estás de acuerdo. Nombra una idea de la consigna y un ejemplo de tu vida.",
        thesisHint: "Creo que sí, porque una idea de la consigna aparece en mi vida.",
      },
      {
        id: "nie",
        label: "No",
        tip: "No estás de acuerdo. Di qué es distinto y da un ejemplo real.",
        thesisHint: "Creo que no, porque la situación de la consigna no es la mía.",
      },
      {
        id: "czesciowo",
        label: "En parte",
        tip: "Algo encaja y algo no. Nombra las dos cosas.",
        thesisHint: "En parte: una idea de la consigna encaja en mi vida, pero no todo.",
      },
    ],
    sample: (topic) => `Escribe una frase tuya sobre «${topic}». No copies la ficha.`,
    review: [
      "¿La postura está clara?",
      "¿Usaste una idea de la consigna?",
      "¿El ejemplo está en tus palabras?",
      "¿La última frase vuelve a la postura?",
    ],
    sourceIntro: "Son notas de la fuente. Léelas, cierra esta ficha y escribe con tus palabras.",
    sourceByline: "De la consigna",
    sourceKicker: "Fuente",
    use: [
      "Elige 1–3 ideas que sostengan tu postura.",
      "Añade tu ejemplo — el entrenador no lo escribe.",
      "Cierra la ficha para volver al mismo paso.",
    ],
    grade: { "3": "Grados 1–3", "5": "Grados 4–6", "8": "Grados 7–9", "11": "Grados 10–12" },
  },
  fr: {
    title: "Écris la réponse",
    blurb: "Tu l’écris. Ce coach aide seulement à planifier — il ne rend pas une copie toute faite.",
    stanceTitle: "Ta position",
    stanceLegend: "Choisis une direction",
    themeTitle: "Idées du sujet",
    themeBlurb: "Choisis-en 1 à 3. Puis relie-les à ton exemple.",
    themeLinkLabel: "2. Lien avec le sujet",
    exampleTitle: "Ton exemple",
    exampleBlurb: "Écris-le toi-même. On ne colle pas un paragraphe fini.",
    examplePlaceholder: "p. ex. quelque chose de l’école, de la maison ou de ta journée",
    exampleHint: "Une phrase — change le détail (qui ? où ?).",
    closingHint: "Termine par une phrase qui est ta conclusion.",
    stances: [
      {
        id: "tak",
        label: "Oui",
        tip: "Tu es d’accord. Nomme une idée du sujet et un exemple de ta vie.",
        thesisHint: "Je pense que oui, parce qu’une idée du sujet se voit dans ma vie.",
      },
      {
        id: "nie",
        label: "Non",
        tip: "Tu n’es pas d’accord. Dis ce qui est différent et donne quand même un exemple.",
        thesisHint: "Je pense que non, parce que la situation du sujet n’est pas la mienne.",
      },
      {
        id: "czesciowo",
        label: "En partie",
        tip: "Une partie convient, une partie non. Nomme les deux.",
        thesisHint: "En partie : une idée du sujet convient à ma vie, mais pas tout.",
      },
    ],
    sample: (topic) => `Écris une phrase à toi sur « ${topic} ». Ne copie pas la fiche.`,
    review: [
      "La position est-elle claire ?",
      "As-tu utilisé une idée du sujet ?",
      "L’exemple est-il dans tes mots ?",
      "La dernière phrase revient-elle à la position ?",
    ],
    sourceIntro: "Ce sont des notes. Lis-les, ferme la fiche et écris avec tes mots.",
    sourceByline: "D’après le sujet",
    sourceKicker: "Source",
    use: [
      "Choisis 1 à 3 idées qui soutiennent ta position.",
      "Ajoute ton exemple — le coach ne l’écrit pas.",
      "Ferme la fiche pour revenir à la même étape.",
    ],
    grade: { "3": "Années 1–3", "5": "Années 4–6", "8": "Années 7–9", "11": "Années 10–12" },
  },
};

export function localWritingCoach(input: WritingPlanInput): WritingPromptConfig {
  const prompt = input.prompt.trim();
  const language = normalizeQuizLanguage(
    input.language && input.language !== "und" ? input.language : undefined,
    detectLanguage(`${input.title ?? ""}\n${prompt}`),
  );
  const grade = normalizeGrade(input.grade);
  const words = wordTargetForGrade(grade);
  const copy = COPY[primaryLang(language)] ?? COPY.en;
  const topics = (input.topics ?? []).map((topic) => topic.trim()).filter(Boolean).slice(0, 3);
  const labels = topics.length ? topics : [clip(prompt, 42)];
  const themes: WritingTheme[] = labels.map((topic, index) => {
    const fact = input.facts?.[index]?.trim() || topic;
    return {
      id: `topic-${index + 1}`,
      label: clip(topic, 80),
      hint: clip(fact, 180),
      parentNote: clip(fact, 180),
      sampleSentence: copy.sample(clip(topic, 48)),
    };
  });
  const id = input.id || randomId("write");
  return {
    id,
    language,
    kicker: `${copy.grade[grade]} · ${language}`,
    title: input.title?.trim() ? clip(input.title.trim(), 80) : copy.title,
    blurb: copy.blurb,
    prompt,
    targetWordsMin: words.min,
    targetWordsMax: words.max,
    stanceTitle: copy.stanceTitle,
    stanceLegend: copy.stanceLegend,
    themeTitle: copy.themeTitle,
    themeBlurb: copy.themeBlurb,
    themeLinkLabel: copy.themeLinkLabel,
    themeLinkPlaceholder: themes.map((theme) => theme.label).join(" / "),
    exampleTitle: copy.exampleTitle,
    exampleBlurb: copy.exampleBlurb,
    examplePlaceholder: copy.examplePlaceholder,
    exampleHint: copy.exampleHint,
    closingHint: copy.closingHint,
    stances: copy.stances,
    themes,
    reviewChecks: copy.review,
    parentNotesEn: [
      "Do not write the essay for them. Check a clear stance, one idea from the assignment, and one example in their own words.",
      `Grade band ${grade}. Aim for about ${words.min}–${words.max} words.`,
      "There is no button that writes the full essay.",
    ],
    source: {
      kicker: copy.sourceKicker,
      title: input.title?.trim() || copy.title,
      byline: copy.sourceByline,
      intro: copy.sourceIntro,
      facts: (input.facts ?? []).map((fact) => fact.trim()).filter(Boolean).slice(0, 8),
      sections: themes.map((theme) => ({ id: theme.id, title: theme.label, body: theme.hint })),
      use: copy.use,
    },
  };
}

function stringList(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
}

function clip(value: string, max: number) {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function clipHint(value: string) {
  const text = clip(value, 280);
  const words = text.split(/\s+/);
  if (words.length <= 45) return text;
  return `${words.slice(0, 45).join(" ")}…`;
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
}
