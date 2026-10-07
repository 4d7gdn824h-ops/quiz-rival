import "server-only";

import { HomeworkError } from "./errors";
import { assertAiKeysStayServerSide } from "./mode";

const XAI_TIMEOUT_MS = 40_000;

/**
 * Fast Grok with vision and no reasoning pass. On live Vercel, grok-4.6 with
 * reasoning_effort "low" still took ~19 s to read a page and ~35–39 s to build
 * the quiz (59 s end to end, right at the 40 s abort). This model reads the
 * same page in ~7 s.
 */
export const FAST_XAI_MODEL = "grok-4.20-0309-non-reasoning";

export function xaiModel(kind: "text" | "vision" = "text") {
  if (kind === "vision") {
    return process.env.XAI_VISION_MODEL || process.env.XAI_MODEL || FAST_XAI_MODEL;
  }
  return process.env.XAI_MODEL || FAST_XAI_MODEL;
}

/** Non-reasoning models reject reasoning_effort with a 400, so only send it to reasoning models. */
export function supportsReasoningEffort(model: string) {
  return !/non-reasoning|grok-build|grok-code/i.test(model);
}

function xaiChatUrl() {
  const base = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

/**
 * grok-4.7 reasons before it answers, and reasoning_effort defaults to "high".
 * A quiz JSON call with that default outlives a Hobby function, which then
 * dies with a non-JSON 504 — the deterministic fallback never gets to respond.
 * Low effort plus a 40s abort keeps the failure inside this request.
 */
export async function xaiComplete(input: {
  content: string | Array<Record<string, unknown>>;
  temperature?: number;
  maxTokens?: number;
  kind?: "text" | "vision";
}): Promise<string> {
  assertAiKeysStayServerSide();
  const key = process.env.XAI_API_KEY;
  if (!key) throw new HomeworkError("XAI_API_KEY missing", "xai_http", 500);

  const model = xaiModel(input.kind);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XAI_TIMEOUT_MS);
  try {
    const response = await fetch(xaiChatUrl(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 4096,
        ...(supportsReasoningEffort(model) ? { reasoning_effort: "low" } : {}),
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: input.content }],
      }),
    });

    if (!response.ok) {
      throw new HomeworkError(`xAI request failed (${response.status})`, "xai_http", 502);
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const text = messageText(body.choices?.[0]?.message?.content);
    if (!text.trim()) {
      throw new HomeworkError("Model returned an empty response", "xai_empty", 502);
    }
    return text;
  } catch (error) {
    if (error instanceof HomeworkError) throw error;
    if (isAbort(error)) {
      throw new HomeworkError("The model took too long.", "timeout", 504);
    }
    const message = error instanceof Error ? error.message : "xAI request failed";
    throw new HomeworkError(message, "xai_http", 502);
  } finally {
    clearTimeout(timer);
  }
}

function isAbort(error: unknown) {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError")
  );
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("\n");
  }
  return "";
}
