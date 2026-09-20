import { ROOM_CODE_LENGTH } from "./constants";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomId(prefix = "p"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function randomRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, "").slice(0, ROOM_CODE_LENGTH).toUpperCase();
}

export function identityOrder(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

export function shuffledOrder(length: number): number[] {
  const order = identityOrder(length);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
