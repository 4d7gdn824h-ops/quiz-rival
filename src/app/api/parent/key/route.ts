import { loadAnswerKey } from "@/lib/homework/answer-key";
import type { QuizVariant } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { packId?: unknown; variant?: unknown; parentKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const packId = typeof body.packId === "string" ? body.packId : "";
  const variant: QuizVariant = body.variant === "B" ? "B" : "A";
  const parentKey = typeof body.parentKey === "string" ? body.parentKey : null;
  const key = loadAnswerKey({ packId, variant, parentKey });
  if (!key) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(key);
}
