import {
  SOURCE_BYLINE,
  SOURCE_FACTS,
  SOURCE_INTRO,
  SOURCE_KICKER,
  SOURCE_SECTIONS,
  SOURCE_TITLE,
  SOURCE_USE,
} from "./chlopi-source";
import type { QuizLanguage } from "./types";
import {
  CLOSING_HINT,
  ESSAY_PROMPT,
  EXAMPLE_HINT,
  EXAMPLE_PLACEHOLDER,
  PARENT_NOTES_EN,
  STANCES,
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  THEME_SENTENCES,
  THEMES,
  type Stance,
  type ThemeOption,
} from "./writing-coach";

export interface WritingSource {
  kicker: string;
  title: string;
  byline: string;
  intro: string;
  facts: readonly string[];
  sections: readonly { id: string; title: string; body: string }[];
  use: readonly string[];
}

export interface WritingStance {
  id: Stance;
  label: string;
  tip: string;
  thesisHint: string;
}

export interface WritingTheme extends ThemeOption {
  sampleSentence: string;
}

export interface WritingPromptConfig {
  id: string;
  language: QuizLanguage;
  kicker: string;
  title: string;
  blurb: string;
  prompt: string;
  targetWordsMin: number;
  targetWordsMax: number;
  stanceTitle: string;
  stanceLegend: string;
  themeTitle: string;
  themeBlurb: string;
  themeLinkLabel: string;
  themeLinkPlaceholder: string;
  exampleTitle: string;
  exampleBlurb: string;
  examplePlaceholder: string;
  exampleHint: string;
  closingHint: string;
  stances: WritingStance[];
  themes: WritingTheme[];
  parentNotesEn: string[];
  source: WritingSource;
}

export const CHLOPI_WRITING_CONFIG: WritingPromptConfig = {
  id: "chlopi",
  language: "pl",
  kicker: "Klasa 8 · do 26 września",
  title: "Napisz wypracowanie",
  blurb: "Pytanie problemowe · ok. 100 słów. Składasz tekst sama — to nie jest gotowa praca.",
  prompt: ESSAY_PROMPT,
  targetWordsMin: TARGET_WORDS_MIN,
  targetWordsMax: TARGET_WORDS_MAX,
  stanceTitle: "Czy to nadal aktualne?",
  stanceLegend: "Czy problematyka „Chłopów” jest aktualna?",
  themeTitle: "Wątki z lektury",
  themeBlurb: "Zaznacz 1–3. Potem powiążesz je z dzisiejszym przykładem.",
  themeLinkLabel: "2. Nawiązanie do „Chłopów”",
  themeLinkPlaceholder: "Jagna / wykluczenie / Boryna i Antek…",
  exampleTitle: "Twój przykład ze współczesności",
  exampleBlurb: "Napisz sama. Nie wklejamy tu gotowego akapitu.",
  examplePlaceholder: EXAMPLE_PLACEHOLDER,
  exampleHint: EXAMPLE_HINT,
  closingHint: CLOSING_HINT,
  stances: STANCES,
  themes: THEMES.map((theme) => ({
    ...theme,
    sampleSentence: THEME_SENTENCES[theme.id as keyof typeof THEME_SENTENCES] ?? theme.hint,
  })),
  parentNotesEn: [...PARENT_NOTES_EN],
  source: {
    kicker: SOURCE_KICKER,
    title: SOURCE_TITLE,
    byline: SOURCE_BYLINE,
    intro: SOURCE_INTRO,
    facts: SOURCE_FACTS,
    sections: SOURCE_SECTIONS,
    use: SOURCE_USE,
  },
};
