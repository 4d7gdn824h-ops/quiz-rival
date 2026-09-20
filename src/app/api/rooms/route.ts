import { getStore } from "@/lib/game/store";
import { jsonError } from "@/lib/game/http";
import { toSnapshot } from "@/lib/game/snapshot";
import type { QuizVariant } from "@/data/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      quizId?: string;
      variant?: QuizVariant;
    };
    const store = getStore();
    const created = await store.createRoom({
      hostName: body.name ?? "",
      quizId: body.quizId ?? "chlopi",
      variant: body.variant === "B" ? "B" : "A",
    });
    return Response.json({
      player: created.player,
      snapshot: toSnapshot(created.state, created.player.id),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  return Response.json({
    store: getStore().kind,
    ok: true,
  });
}
