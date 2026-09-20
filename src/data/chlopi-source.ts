import { ESSAY_PROMPT } from "./writing-coach";

/** Student-facing Chłopi source card. Facts and motifs only — no model essay, no quiz keys. */
export const SOURCE_KICKER = "Źródło · lektura";
export const SOURCE_TITLE = "Chłopi";
export const SOURCE_BYLINE = "Władysław Reymont · wieś Lipce";

export const SOURCE_INTRO =
  "To karta źródłowa do pytania problemowego. Czytasz wątki z lektury, a potem wracasz do swojego kroku i piszesz własnymi słowami.";

export const SOURCE_PROMPT = ESSAY_PROMPT;

export const SOURCE_FACTS = [
  "Autorem powieści jest Władysław Reymont.",
  "Akcja toczy się głównie we wsi Lipce.",
  "Maciej Boryna należy do ważniejszych, zamożniejszych gospodarzy: ziemia, status i autorytet we wsi.",
] as const;

export const SOURCE_SECTIONS: { id: string; title: string; body: string }[] = [
  {
    id: "presja",
    title: "Presja społeczna (Jagna)",
    body: "Jagna jest w centrum uwagi Lipiec. Wieś ocenia jej wygląd, zachowanie i wybory; plotka nie zostawia jej spokoju. Motyw pokazuje, jak grupa wywiera presję na jednostkę.",
  },
  {
    id: "wykluczenie",
    title: "Wykluczenie odmieńców",
    body: "Społeczność odcina osoby, które nie mieszczą się w lokalnej normie. „Odmieniec” zostaje odrzucony za inność. Wieś broni swoich zasad — często kosztem jednego człowieka.",
  },
  {
    id: "majatek",
    title: "Konflikty pokoleniowe o majątek (Boryna–Antek)",
    body: "Boryna kłóci się z synem Antkiem o ziemię, dziedziczenie i władzę ojca. Do sporu dochodzą sprawy rodzinne, w tym Jagna. Motyw: pokolenia walczą o majątek i decyzje.",
  },
];

export const SOURCE_USE = [
  "Wybierz 1–3 wątki, które pomogą uzasadnić Twoją tezę.",
  "Przykład ze współczesności dopisz sama — karta go nie podaje.",
  "Zamknij źródło: wrócisz do tego samego kroku z tym, co już wpisałaś.",
] as const;
