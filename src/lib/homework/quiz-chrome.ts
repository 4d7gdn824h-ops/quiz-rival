import { primaryLang } from "./language";

export type QuizChrome = {
  whichNote: (topic: string) => string;
  worksheetFact: (fact: string) => string;
  trueFalse: (fact: string) => string;
  trueLabel: string;
  falseLabel: string;
  trueHint: string;
  pickFact: (topic: string) => string;
  rematchHint: (fact: string) => string;
  includesIdea: (topic: string) => string;
  yes: string;
  no: string;
  yesHint: string;
  topicFallback: (n: number) => string;
  distractors: string[];
};

const CHROME: Record<string, QuizChrome> = {
  pl: {
    whichNote: (topic) => `Która notatka pasuje do wątku „${topic}”?`,
    worksheetFact: (fact) => `From the sheet: ${fact}`,
    trueFalse: (fact) => `Prawda czy fałsz: ${fact}`,
    trueLabel: "Prawda",
    falseLabel: "Fałsz",
    trueHint: "To zdanie jest na zatwierdzonej karcie — Prawda.",
    pickFact: (topic) => `Wskaż fakt do tematu: ${topic}`,
    rematchHint: (fact) => `Ten sam fakt, wariant B: ${fact}`,
    includesIdea: (topic) => `Czy na karcie jest ten wątek: ${topic}?`,
    yes: "Tak",
    no: "Nie",
    yesHint: "Tak — to zatwierdzony wątek.",
    topicFallback: (n) => `Wątek ${n}`,
    distractors: [
      "Tego nie ma na tej karcie",
      "To fakt z innej lektury, nie z tej pracy",
      "To odpowiedź z matematyki, nie z tego tematu",
      "Akcja dzieje się w kosmosie",
    ],
  },
  en: {
    whichNote: (topic) => `Which note matches “${topic}”?`,
    worksheetFact: (fact) => `Worksheet fact: ${fact}`,
    trueFalse: (fact) => `True or false: ${fact}`,
    trueLabel: "True",
    falseLabel: "False",
    trueHint: "That statement is on the kept notes — True.",
    pickFact: (topic) => `Pick the fact for: ${topic}`,
    rematchHint: (fact) => `Same fact, rematch wording: ${fact}`,
    includesIdea: (topic) => `Does the worksheet include this idea: ${topic}?`,
    yes: "Yes",
    no: "No",
    yesHint: "Yes — it is one of the approved topics.",
    topicFallback: (n) => `Topic ${n}`,
    distractors: [
      "This is not on the worksheet",
      "That fact is from a different topic",
      "That is a math answer, not this subject",
      "The setting is outer space",
    ],
  },
  es: {
    whichNote: (topic) => `¿Qué nota corresponde a «${topic}»?`,
    worksheetFact: (fact) => `Dato de la ficha: ${fact}`,
    trueFalse: (fact) => `Verdadero o falso: ${fact}`,
    trueLabel: "Verdadero",
    falseLabel: "Falso",
    trueHint: "Esa frase está en las notas guardadas — Verdadero.",
    pickFact: (topic) => `Elige el dato de: ${topic}`,
    rematchHint: (fact) => `El mismo dato, variante B: ${fact}`,
    includesIdea: (topic) => `¿La ficha incluye esta idea: ${topic}?`,
    yes: "Sí",
    no: "No",
    yesHint: "Sí — es uno de los temas aprobados.",
    topicFallback: (n) => `Tema ${n}`,
    distractors: [
      "Esto no está en la ficha",
      "Ese dato es de otro tema",
      "Esa es una respuesta de mates, no de esta materia",
      "La acción ocurre en el espacio exterior",
    ],
  },
  fr: {
    whichNote: (topic) => `Quelle note correspond à « ${topic} » ?`,
    worksheetFact: (fact) => `Fait de la fiche : ${fact}`,
    trueFalse: (fact) => `Vrai ou faux : ${fact}`,
    trueLabel: "Vrai",
    falseLabel: "Faux",
    trueHint: "Cette phrase est sur les notes gardées — Vrai.",
    pickFact: (topic) => `Choisis le fait pour : ${topic}`,
    rematchHint: (fact) => `Le même fait, variante B : ${fact}`,
    includesIdea: (topic) => `La fiche contient-elle cette idée : ${topic} ?`,
    yes: "Oui",
    no: "Non",
    yesHint: "Oui — c’est un des thèmes validés.",
    topicFallback: (n) => `Thème ${n}`,
    distractors: [
      "Ceci n’est pas sur la fiche",
      "Ce fait vient d’un autre sujet",
      "C’est une réponse de maths, pas de cette matière",
      "L’action se passe dans l’espace",
    ],
  },
};

/** Stems for the homework language; unknown tags use English stems + original-language facts. */
export function quizChrome(language: string): QuizChrome {
  return CHROME[primaryLang(language)] ?? CHROME.en;
}
