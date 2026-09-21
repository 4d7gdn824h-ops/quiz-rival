import { primaryLang } from "@/lib/homework/language";

export type SpeechLocale = string;

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

const LOCALE_TAGS: Record<string, string> = {
  pl: "pl-PL",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  uk: "uk-UA",
  ru: "ru-RU",
  nl: "nl-NL",
  cs: "cs-CZ",
  sk: "sk-SK",
  sv: "sv-SE",
  no: "nb-NO",
  da: "da-DK",
  fi: "fi-FI",
  hu: "hu-HU",
  ro: "ro-RO",
  el: "el-GR",
  tr: "tr-TR",
  ar: "ar-SA",
  he: "he-IL",
  hi: "hi-IN",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

export function localeTag(lang: SpeechLocale): string {
  const trimmed = String(lang || "").trim();
  if (!trimmed || trimmed === "und") return "en-US";
  if (trimmed.includes("-")) return trimmed;
  return LOCALE_TAGS[primaryLang(trimmed)] ?? trimmed;
}

export function readAloudIdleLabel(lang: SpeechLocale): string {
  return primaryLang(lang) === "pl" ? "Czytaj" : "Read";
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: SpeechLocale,
): SpeechSynthesisVoice | undefined {
  const tag = localeTag(lang).replaceAll("_", "-").toLowerCase();
  const primary = primaryLang(lang);
  const wanted = [tag, primary, primary === "en" ? "en-us" : "", primary === "en" ? "en-gb" : ""].filter(
    Boolean,
  );
  const list = voices.map((voice) => ({
    voice,
    tag: voice.lang.replaceAll("_", "-").toLowerCase(),
  }));
  for (const code of wanted) {
    const exact = list.find((item) => item.tag === code);
    if (exact) return exact.voice;
    const prefix = list.find(
      (item) => item.tag.startsWith(`${code}-`) || item.tag.startsWith(code),
    );
    if (prefix) return prefix.voice;
  }
  return undefined;
}

let keepAlive: number | null = null;

function clearKeepAlive() {
  if (keepAlive != null) {
    window.clearInterval(keepAlive);
    keepAlive = null;
  }
}

/** Chrome can stall long utterances; pause/resume keeps the queue alive. */
const KEEP_ALIVE_MS = 12_000;

export function cancelSpeech() {
  clearKeepAlive();
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
}

const OPTIONS_MAX_CHARS = 360;

/** Stem plus options when they are short; otherwise stem only. */
export function questionSpeechText(question: {
  prompt: string;
  options: { id: string; text: string }[];
}): string {
  const stem = question.prompt.trim();
  const options = question.options.map((option) => `${option.id}. ${option.text}`).join(" ");
  if (options.length > 0 && options.length <= OPTIONS_MAX_CHARS) {
    return `${stem} ${options}`;
  }
  return stem;
}

export function speakText(
  text: string,
  lang: SpeechLocale,
  handlers: { onend: () => void; onerror: (fatal: boolean) => void },
): boolean {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || !speechSupported()) return false;

  const synth = window.speechSynthesis;
  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = localeTag(lang);
  utterance.rate = 0.95;
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) utterance.voice = voice;

  utterance.onend = () => {
    clearKeepAlive();
    handlers.onend();
  };
  utterance.onerror = (event) => {
    clearKeepAlive();
    const reason = event.error;
    const cancelled = reason === "interrupted" || reason === "canceled";
    // Empty-voice / headless engines often fire synthesis-failed immediately.
    // Keep the session open so Stop still works; user can cancel.
    const fatal = cancelled || reason === "not-allowed";
    handlers.onerror(fatal);
  };

  try {
    synth.speak(utterance);
  } catch {
    handlers.onerror(true);
    return false;
  }

  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
  if (!isIOS && trimmed.length > 180) {
    keepAlive = window.setInterval(() => {
      if (!synth.speaking) {
        clearKeepAlive();
        return;
      }
      synth.pause();
      synth.resume();
    }, KEEP_ALIVE_MS);
  }

  return true;
}