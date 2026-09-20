const g = globalThis as unknown as {
  quizRivalLocks?: Map<string, Promise<void>>;
};

const locks = g.quizRivalLocks ?? (g.quizRivalLocks = new Map());

export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const key = code.toUpperCase();
  const previous = locks.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    key,
    previous.then(() => current).catch(() => current),
  );
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}
