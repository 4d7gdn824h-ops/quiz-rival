/**
 * Homework / pack language is a BCP-47 tag (or ISO 639 primary), not just pl|en.
 * UI chrome may stay EN/PL; worksheet content must keep the detected language.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  polish: "pl",
  polski: "pl",
  english: "en",
  spanish: "es",
  espanol: "es",
  español: "es",
  castellano: "es",
  french: "fr",
  francais: "fr",
  français: "fr",
  german: "de",
  deutsch: "de",
  italian: "it",
  italiano: "it",
  portuguese: "pt",
  portugues: "pt",
  português: "pt",
  ukrainian: "uk",
  russian: "ru",
  dutch: "nl",
  czech: "cs",
  slovak: "sk",
  swedish: "sv",
  norwegian: "no",
  danish: "da",
  finnish: "fi",
  hungarian: "hu",
  romanian: "ro",
  greek: "el",
  turkish: "tr",
  arabic: "ar",
  hebrew: "he",
  hindi: "hi",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
};

/** BCP-47 / ISO code. `"und"` when unknown — never coerced to pl/en. */
export function normalizeQuizLanguage(
  raw?: string | null,
  fallback = "und",
): string {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  const lower = value.replaceAll("_", "-").toLowerCase();
  if (LANGUAGE_NAMES[lower]) return LANGUAGE_NAMES[lower];
  const named = LANGUAGE_NAMES[lower.split(/[-,\s]/)[0] ?? ""];
  if (named && !/^[a-z]{2,3}(-|$)/.test(lower)) return named;
  const match = lower.match(/^([a-z]{2,3})(?:-([a-z0-9]{2,8}))?/);
  if (!match) return fallback;
  const lang = match[1];
  const region = match[2];
  if (region && region.length === 2) return `${lang}-${region.toUpperCase()}`;
  if (region) return `${lang}-${region}`;
  return lang;
}

export function primaryLang(tag: string | null | undefined): string {
  const normalized = normalizeQuizLanguage(tag, "und");
  return normalized.split("-")[0] || "und";
}

export function isPolish(tag: string | null | undefined) {
  return primaryLang(tag) === "pl";
}

export function isEnglish(tag: string | null | undefined) {
  return primaryLang(tag) === "en";
}

type LangScore = { lang: string; score: number };

const DETECTORS: { lang: string; test: (blob: string) => number }[] = [
  {
    lang: "pl",
    test: (blob) =>
      count(/[ąćęłńóśźż]/gi, blob) * 3 +
      count(/\b(się|jest|oraz|nie|czy|karta|pracy|lektura|wsi|głównie)\b/gi, blob) * 2,
  },
  {
    lang: "es",
    test: (blob) =>
      count(/[ñ¿¡]/g, blob) * 4 +
      count(/[áéíóúü]/gi, blob) +
      count(/\b(el|los|las|una|del|que|planeta|sistema|tierra)\b/gi, blob) * 2,
  },
  {
    lang: "fr",
    test: (blob) =>
      count(/[àâçéèêëîïôùûœæ]/gi, blob) * 2 +
      count(/\b(les|une|des|est|dans|pour|avec|photosynthèse|eau)\b/gi, blob) * 2,
  },
  {
    lang: "de",
    test: (blob) =>
      count(/[äöüß]/gi, blob) * 3 +
      count(/\b(und|der|die|das|nicht|ein|ist|wasser)\b/gi, blob) * 2,
  },
  {
    lang: "pt",
    test: (blob) =>
      count(/[ãõáéíóúç]/gi, blob) +
      count(/\b(uma|não|os|das|para|água|ciclo)\b/gi, blob) * 2,
  },
  {
    lang: "it",
    test: (blob) =>
      count(/\b(una|sono|della|nel|che|acqua|ciclo)\b/gi, blob) * 2,
  },
  {
    lang: "en",
    test: (blob) =>
      count(/\b(the|and|from|with|this|water|cycle|planet|because)\b/gi, blob) * 2,
  },
];

/** Best-effort ISO 639-1 from worksheet text. Does not default to Polish. */
export function detectLanguage(text: string): string {
  const blob = text.replace(/\s+/g, " ").trim();
  if (!blob) return "und";
  const scores: LangScore[] = DETECTORS.map((item) => ({
    lang: item.lang,
    score: item.test(blob),
  })).sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score < 2) return "und";
  const second = scores[1];
  if (second && best.score === second.score) {
    const diacriticWinner = scores.find(
      (item) => item.score === best.score && item.lang !== "en",
    );
    return diacriticWinner?.lang ?? best.lang;
  }
  return best.lang;
}

function count(pattern: RegExp, blob: string) {
  return blob.match(pattern)?.length ?? 0;
}
