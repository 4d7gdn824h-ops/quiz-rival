import { SESSION_STORAGE_KEY } from "@/lib/constants";

export interface PlayerSession {
  playerId: string;
  roomCode: string;
  name: string;
}

function readFrom(storage: Storage | undefined): PlayerSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function readSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  return readFrom(window.sessionStorage) ?? readFrom(window.localStorage);
}

export function writeSession(session: PlayerSession) {
  const raw = JSON.stringify(session);
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
  window.localStorage.setItem(SESSION_STORAGE_KEY, raw);
}

export function clearSession() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
