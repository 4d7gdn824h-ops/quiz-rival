import "server-only";

import { assertAiKeysStayServerSide } from "./mode";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export function xaiModel() {
  return process.env.XAI_MODEL || "grok-4.7";
}

/**
 * Stateless chat completion. We do not upload files to the xAI Files API,
 * and we do not send a conversation id that would keep the upload.
 */
export async function xaiComplete(input: {
  content: string | Array<Record<string, unknown>>;
  temperature?: number;
}): Promise<string> {
  assertAiKeysStayServerSide();
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY missing");

  const response = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: xaiModel(),
      temperature: input.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: input.content }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`xAI request failed (${response.status}): ${detail.slice(0, 280)}`);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  return messageText(body.choices?.[0]?.message?.content);
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
