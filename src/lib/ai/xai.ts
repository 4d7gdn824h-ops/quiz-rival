/**
 * xAI Grok — the only model provider. OpenAI-compatible chat completions.
 * https://api.x.ai/v1/chat/completions
 *
 * Text and vision both default to grok-4.6 (text + image in, text out).
 */

export const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
export const DEFAULT_XAI_MODEL = "grok-4.6";
export const DEFAULT_XAI_VISION_MODEL = "grok-4.6";

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI is not configured. Set XAI_API_KEY to use Grok (xAI). Demo worksheets and pasted text still work — nothing is sent to a model, and scans are not replaced with the Chłopi pack.";

export type XaiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type XaiMessage = {
  role: "system" | "user";
  content: string | XaiContentPart[];
};

export function xaiApiKey() {
  return process.env.XAI_API_KEY?.trim() || "";
}

export function xaiConfigured() {
  return Boolean(xaiApiKey());
}

export function xaiTextModel() {
  return process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL;
}

export function xaiVisionModel() {
  return process.env.XAI_VISION_MODEL?.trim() || DEFAULT_XAI_VISION_MODEL;
}

/** Grok 4.6 reasons by default. Low keeps scans and coaching JSON small and fast. */
export function xaiReasoningEffort(): string | undefined {
  const raw = process.env.XAI_REASONING_EFFORT?.trim();
  if (!raw) return "low";
  if (raw === "off" || raw === "none") return undefined;
  return raw;
}

export async function xaiChat(input: {
  messages: XaiMessage[];
  model?: string;
  temperature?: number;
  json?: boolean;
}): Promise<string> {
  const key = xaiApiKey();
  if (!key) {
    throw new Error("XAI_API_KEY is not set");
  }
  const reasoning = xaiReasoningEffort();
  const response = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model || xaiTextModel(),
      temperature: input.temperature ?? 0.3,
      ...(reasoning ? { reasoning_effort: reasoning } : {}),
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
      messages: input.messages,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Grok request failed (${response.status}): ${detail.slice(0, 280)}`);
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Grok returned an empty response");
  return text;
}
