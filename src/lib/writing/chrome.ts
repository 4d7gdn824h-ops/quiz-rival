import { primaryLang } from "../homework/language";

export interface CoachUi {
  read: string;
  readAria: string;
  steps: [string, string, string, string, string, string];
  stepProgress: string;
  hintShow: string;
  hintHide: string;
  back: string;
  next: string;
  done: string;
  home: string;
  changePrompt: string;
  copyFail: string;
  wordsSuffix: string;
  questionHeading: string;
  questionGoal: string;
  planLabel: string;
  planPlaceholder: string;
  planHint: string;
  hintThesisLabel: string;
  pickStanceFirst: string;
  themesLegend: string;
  hintThemeLabel: string;
  todayLabel: string;
  hintExampleLabel: string;
  writeHeading: string;
  writeBlurb: string;
  writeBlurbWithExample: string;
  fieldThesis: string;
  fieldThesisPlaceholder: string;
  fieldExample: string;
  fieldClosing: string;
  fieldClosingPlaceholder: string;
  hintThesis: string;
  hintTheme: string;
  hintClosing: string;
  preview: string;
  yourChoices: string;
  finalHeading: string;
  lengthOk: string;
  lengthShort: string;
  lengthLong: string;
  emptyDraft: string;
  copy: string;
  copied: string;
  parentShow: string;
  parentHide: string;
  parentKicker: string;
  validateStance: string;
  validateThemes: string;
  validateExample: string;
  validateDraft: string;
  validatePlan: string;
  close: string;
  sourcePrompt: string;
  sourceFacts: string;
  sourceSections: string;
  sourceUse: string;
  speechQuestion: string;
  speechGoal: string;
  speechRewrite: string;
  speechCompose: string;
  speechNoInsert: string;
  reviewTitle: string;
  opening: string;
}

const EN: CoachUi = {
  read: "Read",
  readAria: "Read the source notes",
  steps: ["Plan", "Thesis", "Arguments", "Example", "Draft", "Check"],
  stepProgress: "Step {step} of {total}: {title}",
  hintShow: "Hint",
  hintHide: "Hide hint",
  back: "Back",
  next: "Next",
  done: "Done",
  home: "Home",
  changePrompt: "Different prompt",
  copyFail: "Could not copy — select the text yourself.",
  wordsSuffix: "words",
  questionHeading: "The assignment",
  questionGoal: "Aim for about {min}–{max} {words}. One clear idea, your own example.",
  planLabel: "Your plan (not the essay)",
  planPlaceholder: "3 bullets: your stance, one idea from the assignment, one example from your life.",
  planHint: "List bullets only. Do not write the paragraph yet.",
  hintThesisLabel: "Thesis sketch (rewrite in your own words)",
  pickStanceFirst: "Pick a stance first.",
  themesLegend: "Ideas",
  hintThemeLabel: "One sentence to rewrite",
  todayLabel: "What happens in your life?",
  hintExampleLabel: "Sample sentence — change the specifics (who? where?)",
  writeHeading: "Build it sentence by sentence",
  writeBlurb: "Four short boxes. They join into one response at the end.",
  writeBlurbWithExample: " Your example from the last step can grow in box 3 — we do not write it for you.",
  fieldThesis: "1. Thesis",
  fieldThesisPlaceholder: "Your thesis — in your own words.",
  fieldExample: "3. Your example",
  fieldClosing: "4. Closing",
  fieldClosingPlaceholder: "One sentence that lands the point.",
  hintThesis: "Thesis sketch",
  hintTheme: "Argument sketch",
  hintClosing: "Closing sketch",
  preview: "Preview",
  yourChoices: "Your choices",
  finalHeading: "Your writing",
  lengthOk: "Length is in range. Read it aloud and fix your own sentences.",
  lengthShort: "A bit short — go back and add the example or the closing.",
  lengthLong: "A bit long — cut a repeat. Stay near the word goal.",
  emptyDraft: "No text yet — go back to Draft.",
  copy: "Copy",
  copied: "Copied",
  parentShow: "Show parent notes (EN)",
  parentHide: "Hide parent notes (EN)",
  parentKicker: "Parent only · English",
  validateStance: "Pick a stance before you continue.",
  validateThemes: "Pick at least one idea.",
  validateExample: "Write your own example (at least one sentence).",
  validateDraft: "Add a thesis, an argument, an example, and a closing — aim for {min}–{max} words.",
  validatePlan: "Jot a short plan first (stance, one idea, one example). Not the full essay.",
  close: "Close",
  sourcePrompt: "Assignment",
  sourceFacts: "Source notes",
  sourceSections: "Ideas to use",
  sourceUse: "How to use this",
  speechQuestion: "Assignment.",
  speechGoal: "Aim for about {min} to {max} words. One clear stance and one example from your life.",
  speechRewrite: "A sketch to rewrite in your own words.",
  speechCompose: "Four short boxes. They become one piece of writing.",
  speechNoInsert: "You can grow your example in box 3. Nothing is filled in for you.",
  reviewTitle: "Check before you hand it in",
  opening: "Opening prompt…",
};

const PL: CoachUi = {
  ...EN,
  read: "Czytaj",
  readAria: "Czytaj tekst źródłowy",
  steps: ["Plan", "Teza", "Wątki", "Przykład", "Pisz", "Gotowe"],
  stepProgress: "Krok {step} z {total}: {title}",
  hintShow: "Podpowiedź",
  hintHide: "Ukryj podpowiedź",
  back: "Wstecz",
  next: "Dalej",
  done: "Gotowe",
  home: "Home",
  changePrompt: "Inne pytanie",
  copyFail: "Nie udało się skopiować — zaznacz tekst ręcznie.",
  wordsSuffix: "słów",
  questionHeading: "Pytanie problemowe",
  questionGoal: "Cel: około {min}–{max} {words}. Jedna jasna teza plus jeden przykład z dzisiaj.",
  planLabel: "Twój plan (to nie jest wypracowanie)",
  planPlaceholder: "3 punkty: teza, jeden wątek ze źródła, jeden przykład z Twojego życia.",
  planHint: "Tylko punkty. Nie pisz jeszcze akapitu.",
  hintThesisLabel: "Szkic tezy (przerób swoimi słowami)",
  pickStanceFirst: "Najpierw wybierz Tak, Nie albo Częściowo.",
  themesLegend: "Wątki",
  hintThemeLabel: "Jedno zdanie do przerobienia",
  todayLabel: "Co dzieje się dzisiaj?",
  hintExampleLabel: "Przykładowe zdanie — zmień konkret (kto? gdzie?)",
  writeHeading: "Składaj po zdaniach",
  writeBlurb: "Cztery krótkie pola. Na końcu złożą się w jedną wypowiedź.",
  writeBlurbWithExample:
    " Przykład z poprzedniego kroku możesz rozwinąć w polu 3 — nic nie wstawiamy za Ciebie.",
  fieldThesis: "1. Teza",
  fieldThesisPlaceholder: "Twoja teza — własnymi słowami.",
  fieldExample: "3. Przykład współczesny",
  fieldClosing: "4. Zakończenie",
  fieldClosingPlaceholder: "Jedno zdanie z wnioskiem.",
  hintThesis: "Szkic tezy",
  hintTheme: "Szkic wątku",
  hintClosing: "Szkic zakończenia",
  preview: "Podgląd",
  yourChoices: "Twoje wybory",
  finalHeading: "Twoja wypowiedź",
  lengthOk: "Długość w celu szkolnym. Przeczytaj na głos i popraw swoje zdania.",
  lengthShort: "Trochę krótko — wróć i dopisz przykład albo zakończenie.",
  lengthLong: "Trochę długo — skróć powtórzenia.",
  emptyDraft: "Brak tekstu — wróć do kroku Pisz.",
  copy: "Kopiuj",
  copied: "Skopiowano",
  parentShow: "Pokaż wskazówki dla rodzica (EN)",
  parentHide: "Ukryj wskazówki dla rodzica (EN)",
  parentKicker: "Parent only · English",
  validateStance: "Wybierz: Tak, Nie albo Częściowo.",
  validateThemes: "Zaznacz przynajmniej jeden wątek.",
  validateExample: "Wpisz własny przykład (choćby jedno zdanie).",
  validateDraft:
    "Dopisz tezę, wątek, przykład i zakończenie — cel to ok. {min}–{max} słów.",
  validatePlan: "Najpierw krótki plan: teza, jeden wątek, jeden przykład. Nie całe wypracowanie.",
  close: "Zamknij",
  sourcePrompt: "Pytanie problemowe",
  sourceFacts: "Lektura w skrócie",
  sourceSections: "Wątki",
  sourceUse: "Jak korzystać",
  speechQuestion: "Pytanie problemowe.",
  speechGoal:
    "Cel: około {min}–{max} słów. Jedna jasna teza plus jeden przykład z dzisiaj.",
  speechRewrite: "Szkic do przerobienia swoimi słowami.",
  speechCompose: "Cztery krótkie pola. Na końcu złożą się w jedną wypowiedź.",
  speechNoInsert:
    "Przykład z poprzedniego kroku możesz rozwinąć w polu 3 — nic nie wstawiamy za Ciebie.",
  reviewTitle: "Sprawdź, zanim oddasz",
  opening: "Otwieram pytanie…",
};

const ES: CoachUi = {
  ...EN,
  read: "Leer",
  readAria: "Leer las notas de la fuente",
  steps: ["Plan", "Tesis", "Argumentos", "Ejemplo", "Borrador", "Revisar"],
  stepProgress: "Paso {step} de {total}: {title}",
  hintShow: "Pista",
  hintHide: "Ocultar pista",
  back: "Atrás",
  next: "Siguiente",
  done: "Listo",
  home: "Inicio",
  changePrompt: "Otra consigna",
  copyFail: "No se pudo copiar — selecciona el texto.",
  wordsSuffix: "palabras",
  questionHeading: "La consigna",
  questionGoal: "Meta: unas {min}–{max} {words}. Una idea clara y un ejemplo tuyo.",
  planLabel: "Tu plan (no es el texto)",
  planPlaceholder: "3 viñetas: tu postura, una idea de la consigna, un ejemplo de tu vida.",
  planHint: "Solo viñetas. Todavía no escribas el párrafo.",
  hintThesisLabel: "Borrador de tesis (reescríbelo con tus palabras)",
  pickStanceFirst: "Primero elige una postura.",
  themesLegend: "Ideas",
  hintThemeLabel: "Una frase para reescribir",
  todayLabel: "¿Qué pasa en tu vida?",
  hintExampleLabel: "Frase de ejemplo — cambia el detalle (¿quién? ¿dónde?)",
  writeHeading: "Escríbelo frase por frase",
  writeBlurb: "Cuatro casillas cortas. Al final forman un solo texto.",
  writeBlurbWithExample:
    " El ejemplo del paso anterior puede crecer en la casilla 3 — no lo escribimos por ti.",
  fieldThesis: "1. Tesis",
  fieldThesisPlaceholder: "Tu tesis, con tus palabras.",
  fieldExample: "3. Tu ejemplo",
  fieldClosing: "4. Cierre",
  fieldClosingPlaceholder: "Una frase que cierre la idea.",
  hintThesis: "Borrador de tesis",
  hintTheme: "Borrador del argumento",
  hintClosing: "Borrador del cierre",
  preview: "Vista previa",
  yourChoices: "Tus elecciones",
  finalHeading: "Tu texto",
  lengthOk: "La extensión está bien. Léelo en voz alta y corrige tus frases.",
  lengthShort: "Un poco corto — vuelve y añade el ejemplo o el cierre.",
  lengthLong: "Un poco largo — quita una repetición.",
  emptyDraft: "Aún no hay texto — vuelve a Borrador.",
  copy: "Copiar",
  copied: "Copiado",
  parentShow: "Mostrar notas para padres (EN)",
  parentHide: "Ocultar notas para padres (EN)",
  validateStance: "Elige una postura antes de seguir.",
  validateThemes: "Elige al menos una idea.",
  validateExample: "Escribe tu propio ejemplo (aunque sea una frase).",
  validateDraft: "Añade tesis, argumento, ejemplo y cierre — meta: {min}–{max} palabras.",
  validatePlan: "Primero un plan corto: postura, una idea, un ejemplo. No el texto entero.",
  close: "Cerrar",
  sourcePrompt: "Consigna",
  sourceFacts: "Notas",
  sourceSections: "Ideas",
  sourceUse: "Cómo usarlo",
  speechQuestion: "Consigna.",
  speechGoal: "Meta: unas {min} a {max} palabras. Una postura clara y un ejemplo de tu vida.",
  speechRewrite: "Un borrador para reescribir con tus palabras.",
  speechCompose: "Cuatro casillas cortas. Juntas forman un texto.",
  speechNoInsert: "Puedes ampliar tu ejemplo en la casilla 3. No escribimos nada por ti.",
  reviewTitle: "Revisa antes de entregar",
  opening: "Abriendo la consigna…",
};

const FR: CoachUi = {
  ...EN,
  read: "Lire",
  readAria: "Lire les notes",
  steps: ["Plan", "Thèse", "Arguments", "Exemple", "Brouillon", "Relire"],
  stepProgress: "Étape {step} sur {total} : {title}",
  hintShow: "Indice",
  hintHide: "Masquer l’indice",
  back: "Retour",
  next: "Suivant",
  done: "Terminé",
  home: "Accueil",
  changePrompt: "Autre sujet",
  copyFail: "Copie impossible — sélectionne le texte.",
  wordsSuffix: "mots",
  questionHeading: "Le sujet",
  questionGoal: "Vise environ {min}–{max} {words}. Une idée claire et un exemple à toi.",
  planLabel: "Ton plan (pas la rédaction)",
  planPlaceholder: "3 puces : ta position, une idée du sujet, un exemple de ta vie.",
  planHint: "Des puces seulement. Pas encore le paragraphe.",
  hintThesisLabel: "Ébauche de thèse (à réécrire avec tes mots)",
  pickStanceFirst: "Choisis d’abord une position.",
  themesLegend: "Idées",
  hintThemeLabel: "Une phrase à réécrire",
  todayLabel: "Que se passe-t-il dans ta vie ?",
  hintExampleLabel: "Phrase modèle — change le détail (qui ? où ?)",
  writeHeading: "Écris phrase par phrase",
  writeBlurb: "Quatre cases courtes. Elles forment un seul texte à la fin.",
  writeBlurbWithExample:
    " Ton exemple de l’étape précédente peut grandir dans la case 3 — on ne l’écrit pas à ta place.",
  fieldThesis: "1. Thèse",
  fieldThesisPlaceholder: "Ta thèse, avec tes mots.",
  fieldExample: "3. Ton exemple",
  fieldClosing: "4. Conclusion",
  fieldClosingPlaceholder: "Une phrase qui conclut.",
  hintThesis: "Ébauche de thèse",
  hintTheme: "Ébauche d’argument",
  hintClosing: "Ébauche de conclusion",
  preview: "Aperçu",
  yourChoices: "Tes choix",
  finalHeading: "Ton texte",
  lengthOk: "La longueur est bonne. Lis à voix haute et corrige tes phrases.",
  lengthShort: "Un peu court — reviens ajouter l’exemple ou la conclusion.",
  lengthLong: "Un peu long — enlève une répétition.",
  emptyDraft: "Pas encore de texte — reviens au brouillon.",
  copy: "Copier",
  copied: "Copié",
  parentShow: "Afficher les notes parent (EN)",
  parentHide: "Masquer les notes parent (EN)",
  validateStance: "Choisis une position avant de continuer.",
  validateThemes: "Choisis au moins une idée.",
  validateExample: "Écris ton propre exemple (au moins une phrase).",
  validateDraft: "Ajoute thèse, argument, exemple et conclusion — vise {min}–{max} mots.",
  validatePlan: "D’abord un plan court : position, une idée, un exemple. Pas la rédaction.",
  close: "Fermer",
  sourcePrompt: "Sujet",
  sourceFacts: "Notes",
  sourceSections: "Idées",
  sourceUse: "Comment s’en servir",
  speechQuestion: "Sujet.",
  speechGoal: "Vise environ {min} à {max} mots. Une position claire et un exemple de ta vie.",
  speechRewrite: "Une ébauche à réécrire avec tes mots.",
  speechCompose: "Quatre cases courtes. Elles deviennent un seul texte.",
  speechNoInsert: "Tu peux développer ton exemple dans la case 3. Rien n’est écrit à ta place.",
  reviewTitle: "Vérifie avant de rendre",
  opening: "Ouverture du sujet…",
};

const BY_LANG: Record<string, CoachUi> = { en: EN, pl: PL, es: ES, fr: FR };

export function coachUiFor(language: string | null | undefined): CoachUi {
  return BY_LANG[primaryLang(language)] ?? EN;
}

export function resolveCoachUi(
  language: string | null | undefined,
  override?: Partial<CoachUi> | null,
): CoachUi {
  const base = coachUiFor(language);
  if (!override) return base;
  const steps =
    Array.isArray(override.steps) && override.steps.length === 6
      ? (override.steps as CoachUi["steps"])
      : base.steps;
  return { ...base, ...override, steps };
}

export function fillTemplate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? "" : String(vars[key]),
  );
}
