const PARENT_KEYS = "quizrival-parent-keys";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PARENT_KEYS);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

/** The creating device keeps the secret. The server stores only a hash. */
export function saveParentKey(packId: string, parentKey: string) {
  if (typeof window === "undefined" || !packId || !parentKey) return;
  const map = readMap();
  map[packId] = parentKey;
  window.localStorage.setItem(PARENT_KEYS, JSON.stringify(map));
}

export function readParentKey(packId: string): string | null {
  const value = readMap()[packId];
  return typeof value === "string" && value ? value : null;
}

/** Fragment so the secret is not sent on the document request and is not an access log line. */
export function parentKeyHref(packId: string, variant: string, secret: string | null): string {
  if (secret) {
    const hash = new URLSearchParams({ pack: packId, key: secret, variant });
    return `/parent/key#${hash.toString()}`;
  }
  const query = new URLSearchParams({ pack: packId, variant });
  return `/parent/key?${query.toString()}`;
}
