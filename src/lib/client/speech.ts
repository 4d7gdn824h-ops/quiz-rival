export type SpeechLocale = "pl" | "en";

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

export function localeTag(lang: SpeechLocale): string {
  return lang === "pl" ? "pl-PL" : "en-US";
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: SpeechLocale,
): SpeechSynthesisVoice | undefined {
  const wanted = lang === "pl" ? ["pl-pl", "pl"] : ["en-us", "en-gb", "en"];
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
