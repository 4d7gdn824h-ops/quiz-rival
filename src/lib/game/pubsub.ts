import { EventEmitter } from "node:events";

const g = globalThis as unknown as { quizRivalBus?: EventEmitter };
export const gameBus = g.quizRivalBus ?? (g.quizRivalBus = new EventEmitter());
gameBus.setMaxListeners(200);

export function notifyRoom(code: string) {
  const key = `room:${code.toUpperCase()}`;
  setTimeout(() => {
    gameBus.emit(key);
  }, 0);
}

export function onRoom(code: string, listener: () => void): () => void {
  const key = `room:${code.toUpperCase()}`;
  gameBus.on(key, listener);
  return () => {
    gameBus.off(key, listener);
  };
}
