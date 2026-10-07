import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { QuizPackFile, QuizVariant } from "@/data/types";

function sealKey() {
  const secret = process.env.XAI_API_KEY;
  if (!secret) return null;
  return createHash("sha256").update(`quizrival-grade:${secret}`).digest();
}

/** Opaque blob so another serverless instance can score without storing the upload. */
export function sealAnswerMap(pack: QuizPackFile): string | null {
  const key = sealKey();
  if (!key) return null;
  const map: Record<string, string> = {};
  (["A", "B"] as QuizVariant[]).forEach((variant) => {
    for (const question of pack.variants[variant]) {
      map[`${variant}:${question.id}`] = question.correctOptionId;
    }
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(map), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function openSeal(token: string): Record<string, string> {
  if (!token || token.length > 20000) {
    throw new Error("Grade seal rejected");
  }
  const key = sealKey();
  if (!key) throw new Error("Grade seal needs the server AI key");
  const buf = Buffer.from(token, "base64url");
  if (buf.length < 29) throw new Error("Grade seal rejected");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  const map = JSON.parse(json) as unknown;
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    throw new Error("Grade seal rejected");
  }
  return map as Record<string, string>;
}
