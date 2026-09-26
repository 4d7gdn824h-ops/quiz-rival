import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_XAI_MODEL,
  DEFAULT_XAI_VISION_MODEL,
  XAI_CHAT_COMPLETIONS_URL,
  xaiChat,
  xaiTextModel,
  xaiVisionModel,
} from "./xai";
import { homeworkMode } from "../homework/mode";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.XAI_API_KEY;
  delete process.env.XAI_MODEL;
  delete process.env.XAI_VISION_MODEL;
  delete process.env.XAI_REASONING_EFFORT;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("xAI provider", () => {
  it("ignores OpenAI and Anthropic keys", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    assert.equal(homeworkMode(), "fixture");
    process.env.XAI_API_KEY = "xai-test";
    assert.equal(homeworkMode(), "xai");
  });

  it("defaults to grok-4.6 and posts chat completions", async () => {
    process.env.XAI_API_KEY = "xai-test";
    let url = "";
    let auth = "";
    let body: { model?: string; reasoning_effort?: string; messages?: unknown[] } = {};
    globalThis.fetch = async (input, init) => {
      url = String(input);
      const headers = new Headers(init?.headers);
      auth = headers.get("Authorization") ?? "";
      body = JSON.parse(String(init?.body));
      return Response.json({
        choices: [{ message: { content: "{\"ok\":true}" } }],
      });
    };
    const text = await xaiChat({
      json: true,
      messages: [{ role: "user", content: "hi" }],
    });
    assert.equal(url, XAI_CHAT_COMPLETIONS_URL);
    assert.equal(auth, "Bearer xai-test");
    assert.equal(body.model, DEFAULT_XAI_MODEL);
    assert.equal(xaiTextModel(), DEFAULT_XAI_MODEL);
    assert.equal(xaiVisionModel(), DEFAULT_XAI_VISION_MODEL);
    assert.equal(body.reasoning_effort, "low");
    assert.equal(text, "{\"ok\":true}");
  });

  it("honors XAI_MODEL and XAI_VISION_MODEL", () => {
    process.env.XAI_MODEL = "grok-4.3";
    process.env.XAI_VISION_MODEL = "grok-4.5";
    assert.equal(xaiTextModel(), "grok-4.3");
    assert.equal(xaiVisionModel(), "grok-4.5");
  });

  it("refuses to call the API without a key", async () => {
    await assert.rejects(() => xaiChat({ messages: [{ role: "user", content: "hi" }] }), /XAI_API_KEY/);
  });
});
