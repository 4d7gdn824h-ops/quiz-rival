import {
  answerState,
  joinState,
  rematchState,
  startState,
  tickState,
} from "@/lib/game/engine";
import { jsonError, snapshotResponse } from "@/lib/game/http";
import { withRoomLock } from "@/lib/game/lock";
import { toSnapshot } from "@/lib/game/snapshot";
import { getStore } from "@/lib/game/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CodeParams = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: CodeParams) {
  try {
    const { code } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId") ?? undefined;
    const snapshot = await snapshotResponse(code, playerId);
    if (!snapshot) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }
    return Response.json(snapshot);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, { params }: CodeParams) {
  try {
    const { code } = await params;
    const store = getStore();
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      playerId?: string;
      questionId?: string;
      choice?: string;
      switchVariant?: boolean;
      reshuffle?: boolean;
    };

    return withRoomLock(code, async () => {
      const state = await store.getState(code);
      if (!state) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }
      const fresh = tickState(state);
      if (fresh !== state) {
        await store.saveState(fresh);
      }
      const current = fresh !== state ? fresh : state;

      if (body.action === "join") {
        const joined = joinState(current, body.name ?? "", body.playerId);
        await store.saveState(joined.state);
        return Response.json({
          player: joined.player,
          snapshot: toSnapshot(joined.state, joined.player.id),
        });
      }

      if (!body.playerId) {
        return Response.json({ error: "Missing playerId" }, { status: 400 });
      }

      if (body.action === "start") {
        const next = startState(current, body.playerId);
        await store.saveState(next);
        return Response.json(toSnapshot(next, body.playerId));
      }

      if (body.action === "answer") {
        const next = answerState(current, {
          playerId: body.playerId,
          questionId: body.questionId ?? "",
          choice: body.choice ?? "",
        });
        await store.saveState(next);
        return Response.json(toSnapshot(next, body.playerId));
      }

      if (body.action === "tick") {
        return Response.json(toSnapshot(current, body.playerId));
      }

      if (body.action === "rematch") {
        const next = rematchState(current, body.playerId, {
          switchVariant: body.switchVariant,
          reshuffle: body.reshuffle,
        });
        await store.saveState(next);
        return Response.json(toSnapshot(next, body.playerId));
      }

      return Response.json({ error: "Unknown action" }, { status: 400 });
    });
  } catch (error) {
    return jsonError(error);
  }
}
