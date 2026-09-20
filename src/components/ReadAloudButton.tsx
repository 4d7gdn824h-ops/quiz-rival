"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  cancelSpeech,
  speakText,
  speechSupported,
  type SpeechLocale,
} from "@/lib/client/speech";

type Props = {
  text: string;
  lang: SpeechLocale;
  /** Defaults to Czytaj (pl) / Read (en). */
  idleLabel?: string;
  className?: string;
};

function subscribeNever() {
  return () => {};
}

export function ReadAloudButton({ text, lang, idleLabel, className }: Props) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [session, setSession] = useState({ text, lang, speaking: false });
  const generation = useRef(0);

  if (session.text !== text || session.lang !== lang) {
    setSession({ text, lang, speaking: false });
  }

  useEffect(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      synth.getVoices();
    };
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    return () => {
      generation.current += 1;
      cancelSpeech();
    };
  }, [lang, text]);

  const speaking = session.speaking;

  const stop = useCallback(() => {
    generation.current += 1;
    cancelSpeech();
    setSession({ text, lang, speaking: false });
  }, [lang, text]);

  const toggle = useCallback(() => {
    if (speaking) {
      stop();
      return;
    }
    const myGen = generation.current + 1;
    generation.current = myGen;
    setSession({ text, lang, speaking: true });
    const started = speakText(text, lang, {
      onend: () => {
        if (generation.current === myGen) setSession({ text, lang, speaking: false });
      },
      onerror: (fatal) => {
        if (fatal && generation.current === myGen) {
          setSession({ text, lang, speaking: false });
        }
      },
    });
    if (!started) setSession({ text, lang, speaking: false });
  }, [lang, speaking, stop, text]);

  const label = idleLabel ?? (lang === "en" ? "Read" : "Czytaj");
  const unsupported =
    lang === "en"
      ? "Reading not supported on this browser"
      : "Czytanie nieobsługiwane w tej przeglądarce";

  if (!mounted) {
    return <div className="min-h-12" aria-hidden="true" />;
  }

  if (!speechSupported()) {
    return <p className="text-sm text-white/50">{unsupported}</p>;
  }

  if (!text.trim()) {
    return null;
  }

  return (
    <button
      type="button"
      className={className ?? "btn-read"}
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop" : `${label} · Read aloud`}
    >
      <SpeakerIcon speaking={speaking} />
      {speaking ? "Stop" : label}
    </button>
  );
}

function SpeakerIcon({ speaking }: { speaking: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4z" fill="currentColor" stroke="none" />
      {speaking ? (
        <>
          <path d="M16 9.5a4 4 0 0 1 0 5" />
          <path d="M18.2 7.2a7 7 0 0 1 0 9.6" />
        </>
      ) : (
        <path d="M16 10.5a2.5 2.5 0 0 1 0 3" />
      )}
    </svg>
  );
}
