import { SESSION_STORAGE_KEY } from "@/lib/constants";

export interface PlayerSession {
  playerId: string;
  roomCode: string;
  name: string;
}

export function readSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function writeSession(session: PlayerSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
