import { createServer } from "node:http";
import { spawn } from "node:child_process";

const port = 8787;
const appPort = 3210;
const useMock = !process.env.XAI_API_KEY;

function notes() {
  const topics = ["Evaporation", "Condensation", "Precipitation", "Collection", "Runoff"];
  const facts = [
    "Water evaporates from oceans",
    "Clouds form by condensation",
    "Rain is precipitation",
    "Water collects in lakes",
    "Runoff returns water to the sea",
  ];
  return {
    title: "Water cycle",
    language: "en",
    topics,
    facts,
    essayPrompts: [],
    rawText: facts.join("\n"),
    lines: facts.map((text, index) => ({ text, junk: false, id: `line-${index + 1}` })),
  };
}

function level(index, fact, topic) {
  const question = (label) => ({
    prompt: `${label}: ${fact}`,
    options: [fact, "Not on the page", "A blank line", "Skip this"],
    correctIndex: 0,
    parentHint: "See the worksheet.",
  });
  return {
    title: topic,
    theme: `stop-${index}`,
    questionsA: [question("Which note is on the page")],
    questionsB: [question("Rematch")],
  };
}

function quiz() {
  const source = notes();
  return {
    title: source.title,
    language: "en",
    levels: source.facts.map((fact, index) => level(index + 1, fact, source.topics[index] || `Stop ${index + 1}`)),
  };
}

const mock = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  const payload = raw.includes("sibling-rivalry") ? quiz() : notes();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
  );
});

await new Promise((resolve) => mock.listen(port, "127.0.0.1", resolve));
console.log(useMock ? `mock xAI on ${port}` : "using real XAI_API_KEY");

const child = spawn("npx", ["next", "start", "-p", String(appPort)], {
  stdio: "inherit",
  env: {
    ...process.env,
    XAI_API_KEY: process.env.XAI_API_KEY || "e2e-mock-key",
    XAI_BASE_URL: useMock ? `http://127.0.0.1:${port}/v1` : "https://api.x.ai/v1",
  },
});

function shutdown() {
  mock.close();
  child.kill("SIGTERM");
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
child.on("exit", (code) => {
  mock.close();
  process.exit(code ?? 0);
});
