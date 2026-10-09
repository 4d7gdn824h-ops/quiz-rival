import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** 128-bit id. Not a slug, timestamp, or counter. */
export function randomPackId(): string {
  return randomBytes(16).toString("base64url");
}

/** 128-bit secret returned once to the device that created the pack. */
export function newParentKey(): string {
  return randomBytes(16).toString("base64url");
}

export function hashParentKey(secret: string): string {
  return createHash("sha256").update(secret).digest("base64url");
}

/** Equal-length SHA-256 compare. A bad or missing hash does not throw. */
export function parentKeyMatches(secret: string, storedHash: string): boolean {
  const computed = createHash("sha256").update(secret).digest();
  const stored = Buffer.from(storedHash, "base64url");
  if (stored.length !== computed.length) {
    timingSafeEqual(computed, computed);
    return false;
  }
  return timingSafeEqual(computed, stored);
}

export function packsForPublicList<T extends { generated?: boolean }>(packs: T[]): T[] {
  return packs.filter((pack) => pack.generated !== true);
}

export function resolveAnswerKeyAccess(input: {
  packId: string;
  builtIn: boolean;
  exists: boolean;
  parentKeyHash: string | null;
  parentKey: string | null;
}): { ok: true } | { ok: false } {
  if (!input.packId || !input.exists) return { ok: false };
  if (input.builtIn) return { ok: true };
  if (!input.parentKey || !input.parentKeyHash) return { ok: false };
  if (!parentKeyMatches(input.parentKey, input.parentKeyHash)) return { ok: false };
  return { ok: true };
}
