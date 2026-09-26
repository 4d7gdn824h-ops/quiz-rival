import { jsonError } from "@/lib/game/http";
import { planWritingCoach } from "@/lib/writing/plan";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      language?: string;
      grade?: string;
      title?: string;
      topics?: string[];
      facts?: string[];
    };
    const prompt = String(body.prompt ?? "").trim();
    if (prompt.length < 8) {
      return Response.json({ error: "Paste an assignment or essay prompt." }, { status: 400 });
    }
    const result = await planWritingCoach({
      prompt,
      language: body.language,
      grade: body.grade,
      title: body.title,
      topics: Array.isArray(body.topics) ? body.topics.map(String) : undefined,
      facts: Array.isArray(body.facts) ? body.facts.map(String) : undefined,
    });
    assertNoQuizSecrets(result, "write-plan");
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
