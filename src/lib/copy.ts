/** Kid-facing copy helpers. Safe to import from unit tests and the browser. */

/** Prompt asks the model to stay under this. */
export const QUIZ_TITLE_TARGET = 40;
/** A longer model title is replaced with the first topic. */
export const QUIZ_TITLE_LIMIT = 60;

/**
 * Capacity label. "pages" stays plural at 1 because the number is "1 of 6",
 * not a count of one page by itself.
 */
export function scanPageCountLabel(count: number, capacity: number) {
  const pages = Math.max(0, Math.floor(count));
  const cap = Math.max(0, Math.floor(capacity));
  return `${pages} of ${cap} pages`;
}

/** "You" → "Your". A name ending in s takes s'. Everything else takes 's. */
export function possessive(name: string) {
  const trimmed = name.trim();
  if (/^you$/i.test(trimmed)) return "Your";
  if (!trimmed) return "Your";
  if (/s$/i.test(trimmed)) return `${trimmed}'`;
  return `${trimmed}'s`;
}

export function turnLabel(name: string) {
  return `${possessive(name)} turn`;
}

export function shortQuizTitle(title: string, topics: readonly string[] = []) {
  const cleaned = title.replace(/\s+/g, " ").trim();
  if (cleaned.length <= QUIZ_TITLE_LIMIT) return cleaned;
  const topic = topics.map((item) => String(item).replace(/\s+/g, " ").trim()).find(Boolean);
  if (topic && topic.length <= QUIZ_TITLE_LIMIT) return topic;
  return (topic || cleaned).slice(0, QUIZ_TITLE_TARGET).trim();
}
