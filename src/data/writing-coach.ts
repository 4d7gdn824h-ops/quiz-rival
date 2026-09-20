export const ESSAY_PROMPT =
  "Czy problematyka ukazana w „Chłopach” (np. presja społeczna, wykluczenie odmieńców, konflikty pokoleniowe o majątek) jest aktualna w dzisiejszych czasach? Uzasadnij swoją odpowiedź w dłuższej wypowiedzi, podając przynajmniej jeden przykład ze współczesności.";

export const TARGET_WORDS_MIN = 90;
export const TARGET_WORDS_MAX = 120;

export type Stance = "tak" | "nie" | "czesciowo";

export interface ThemeOption {
  id: "presja" | "wykluczenie" | "majatek";
  label: string;
  hint: string;
  parentNote: string;
}

export const STANCES: {
  id: Stance;
  label: string;
  tip: string;
  thesisHint: string;
}[] = [
  {
    id: "tak",
    label: "Tak",
    tip: "Mocna, częsta teza: motywy z powieści wracają dziś jako hejt, wykluczenie albo spory o spadek. Podaj jeden konkretny przykład ze współczesności.",
    thesisHint:
      "Uważam, że problematyka „Chłopów” jest aktualna, ponieważ presja grupy i spory o majątek wciąż ranią ludzi.",
  },
  {
    id: "nie",
    label: "Nie",
    tip: "To odważniejsza teza. Musisz pokazać, czym dzisiejsze życie różni się od Lipiec — i mimo to podać przykład ze współczesności (np. że prawo lub szkoła chronią lepiej).",
    thesisHint:
      "Moim zdaniem świat „Chłopów” jest już odległy: dziś szkoła i prawo inaczej chronią jednostkę niż wieś Reymonta.",
  },
  {
    id: "czesciowo",
    label: "Częściowo",
    tip: "Bezpieczna teza: motywy wracają, ale w innej formie (internet zamiast plotki na wsi). Nazwij, co się zmieniło, a co zostało.",
    thesisHint:
      "Część problemów z „Chłopów” wraca dzisiaj, ale w innej formie — na przykład w internecie zamiast w wiejskiej plotce.",
  },
];

export const THEMES: ThemeOption[] = [
  {
    id: "presja",
    label: "Presja społeczna (Jagna)",
    hint: "Wieś ocenia Jagny; pomyśl o ocenianiu w klasie albo w sieci.",
    parentNote: "Jagna ↔ social pressure / gossip. Link to peer judgment today.",
  },
  {
    id: "wykluczenie",
    label: "Wykluczenie odmieńców",
    hint: "Kogo społeczność odcina, bo nie mieści się w normie wsi?",
    parentNote: "Village rejects people who break local norms — outsiders / otherness.",
  },
  {
    id: "majatek",
    label: "Konflikty pokoleniowe o majątek (Boryna–Antek)",
    hint: "Ojciec i syn kłócą się o ziemię — dziś często o spadek albo mieszkanie.",
    parentNote: "Boryna vs Antek: land, inheritance, father’s authority.",
  },
];

export const THEME_SENTENCES: Record<ThemeOption["id"], string> = {
  presja:
    "Jagna doświadcza presji społecznej: wieś ją ocenia, plotkuje i nie zostawia jej spokoju.",
  wykluczenie:
    "Motyw wykluczenia odmieńców pokazuje, że społeczność odrzuca osoby, które łamią lokalne normy.",
  majatek:
    "Konflikt Boryny z Antkiem o ziemię to spór pokoleń o władzę i dziedziczenie.",
};

export const EXAMPLE_PLACEHOLDER =
  "np. hejt w mediach społecznościowych, wykluczenie kogoś w szkole, kłótnia o spadek w rodzinie";

export const EXAMPLE_HINT =
  "Podobną presję widać dziś, gdy ktoś dostaje hejt w internecie za to, że wygląda albo myśli inaczej.";

export const CLOSING_HINT =
  "Dlatego problemy ukazane przez Reymonta nie są tylko historią wsi — uczą, jak trudno być sobą wśród ludzi.";

export const PARENT_NOTES_EN = [
  "Teacher brief: ~100 words (training length), a clear stance, at least one concrete modern example.",
  "Do not write the essay for her. Check she names a Chłopi motif (Jagna / exclusion / Boryna–Antek) AND a today-example in her own words.",
  "Strong default path: Yes, it is still relevant → social pressure on Jagna → social-media hate or school exclusion → short closing.",
  "“Nie” is allowed but harder: she must argue times have changed and still include a contemporary example.",
  "Count Polish words (spaces). Aim 90–120. This is the short practice version of a longer klasa-8 wypowiedź.",
];

export const STEPS = [
  { id: "pytanie", title: "Pytanie" },
  { id: "teza", title: "Teza" },
  { id: "watki", title: "Wątki" },
  { id: "przyklad", title: "Przykład" },
  { id: "pisz", title: "Pisz" },
  { id: "gotowe", title: "Gotowe" },
] as const;
