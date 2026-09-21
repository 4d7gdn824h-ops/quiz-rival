import { CHLOPI_WRITING_CONFIG, type WritingPromptConfig, type WritingTheme } from "@/data/writing-config";
import { isPolish } from "./language";
import type { ExtractedNotes } from "./types";

const GENERIC_STANCES_PL = CHLOPI_WRITING_CONFIG.stances.map((stance) => {
  if (stance.id === "tak") {
    return {
      ...stance,
      tip: "Mocna teza: zgadzasz się z pytaniem. Podaj wątek z karty i jeden przykład ze współczesności.",
      thesisHint: "Uważam, że tak — to widać i w materiale z karty, i w dzisiejszym życiu.",
    };
  }
  if (stance.id === "nie") {
    return {
      ...stance,
      tip: "Odważniejsza teza: pokaż, czym dziś różni się świat, ale i tak podaj przykład ze współczesności.",
      thesisHint: "Moim zdaniem to pytanie wymaga „nie”, bo realia z karty już się zmieniły.",
    };
  }
  return {
    ...stance,
    tip: "Bezpieczna teza: coś wraca, ale w innej formie. Nazwij, co zostało, a co się zmieniło.",
    thesisHint: "Częściowo: motyw z karty wraca dzisiaj, ale w innej postaci.",
  };
});

const GENERIC_STANCES_EN = CHLOPI_WRITING_CONFIG.stances.map((stance) => {
  if (stance.id === "tak") {
    return {
      ...stance,
      label: "Yes",
      tip: "Strong thesis: you agree. Name a worksheet theme and one example from your own life.",
      thesisHint: "I think yes — it shows up in the worksheet and in life today.",
    };
  }
  if (stance.id === "nie") {
    return {
      ...stance,
      label: "No",
      tip: "Bolder thesis: show how today is different, and still give a real example.",
      thesisHint: "I think the answer is no, because the world of the worksheet has changed.",
    };
  }
  return {
    ...stance,
    label: "Partly",
    tip: "Safe thesis: something returns in another form. Name what stayed and what changed.",
    thesisHint: "Partly: a theme from the sheet comes back today, but in a different shape.",
  };
});

export function writingFromNotes(packId: string, notes: ExtractedNotes): WritingPromptConfig | null {
  const prompt = notes.essayPrompts[0]?.trim();
  if (!prompt) return null;
  if (notes.fixtureId === "chlopi-worksheet" || /chłopi|chlopi/i.test(notes.title)) {
    return { ...CHLOPI_WRITING_CONFIG, id: packId, prompt };
  }

  const themes: WritingTheme[] = notes.topics.slice(0, 3).map((topic, index) => {
    const fact = notes.facts[index] ?? notes.facts[0] ?? topic;
    return {
      id: `topic-${index + 1}`,
      label: topic,
      hint: fact,
      parentNote: fact,
      sampleSentence: fact,
    };
  });
  if (!themes.length) {
    themes.push({
      id: "topic-1",
      label: notes.title,
      hint: notes.facts[0] ?? prompt,
      parentNote: "Link the worksheet theme to a concrete example in her own words.",
      sampleSentence: notes.facts[0] ?? prompt,
    });
  }

  const pl = isPolish(notes.language);
  return {
    id: packId,
    language: notes.language || (pl ? "pl" : "en"),
    kicker: pl ? "Kartkówka · na dziś" : "Tonight's prompt",
    title: pl ? "Napisz wypracowanie" : "Write the response",
    blurb: pl
      ? "Pytanie z karty · ok. 100 słów. Składasz tekst sama — to nie jest gotowa praca."
      : "Worksheet prompt · about 100 words. She writes it — this is not a finished essay.",
    prompt,
    targetWordsMin: 90,
    targetWordsMax: 120,
    stanceTitle: pl ? "Twoja teza" : "Your stance",
    stanceLegend: pl ? "Wybierz kierunek tezy" : "Pick a stance",
    themeTitle: pl ? "Wątki z karty" : "Themes from the sheet",
    themeBlurb: pl
      ? "Zaznacz 1–3. Potem powiążesz je z własnym przykładem."
      : "Pick 1–3. Then connect them to your own example.",
    themeLinkLabel: pl ? "2. Nawiązanie do karty" : "2. Link to the worksheet",
    themeLinkPlaceholder: themes.map((theme) => theme.label).join(" / "),
    exampleTitle: pl ? "Twój przykład" : "Your own example",
    exampleBlurb: pl
      ? "Napisz sama. Nie wklejamy tu gotowego akapitu."
      : "Write it yourself. We will not dump a finished paragraph.",
    examplePlaceholder: pl
      ? "np. sytuacja ze szkoły, domu albo internetu"
      : "e.g. something from school, home, or the internet",
    exampleHint: pl
      ? "Jedno zdanie-szkic: zmień konkret (kto? gdzie?)."
      : "One sample sentence — change the specifics (who? where?).",
    closingHint: pl
      ? "Na końcu jedno zdanie z wnioskiem — własnymi słowami."
      : "Close with one sentence that is a conclusion in your own words.",
    stances: pl ? GENERIC_STANCES_PL : GENERIC_STANCES_EN,
    themes,
    parentNotesEn: [
      "Do not write the essay for them. Check a clear stance, a worksheet theme, and one example in their own words.",
      `Prompt from the scan: ${prompt}`,
      "Aim ~100 words. This coach only scaffolds (thesis → themes → example → sentences). There is no auto-full-essay button.",
    ],
    source: {
      kicker: pl ? "Źródło · karta" : "Source · worksheet",
      title: notes.title,
      byline: pl ? "Z dzisiejszej karty pracy" : "From tonight's worksheet",
      intro: pl
        ? "To karta źródłowa do pytania z pracy domowej. Czytasz wątki, wracasz do kroku i piszesz własnymi słowami."
        : "Source notes from the homework scan. Read the themes, then return to the same step and write in your own words.",
      facts: notes.facts,
      sections: themes.map((theme) => ({
        id: theme.id,
        title: theme.label,
        body: theme.hint,
      })),
      use: pl
        ? [
            "Wybierz 1–3 wątki, które pomogą uzasadnić tezę.",
            "Przykład dopisz sama — karta go nie pisze za Ciebie.",
            "Zamknij źródło: wrócisz do tego samego kroku z tym, co już wpisałaś.",
          ]
        : [
            "Pick 1–3 themes that support the thesis.",
            "Add your own example — the sheet will not write it.",
            "Close the source to return to the same step with the draft intact.",
          ],
    },
  };
}
