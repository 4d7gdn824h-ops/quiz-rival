import { GameError, tickState } from "@/lib/game/engine";
import { withRoomLock } from "@/lib/game/lock";
import { toSnapshot } from "@/lib/game/snapshot";
import { getStore } from "@/lib/game/store";
import type { RoomSnapshot } from "@/lib/game/types";

export async function jsonError(error: unknown) {
  if (error instanceof GameError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

export async function loadFreshState(code: string) {
  return withRoomLock(code, async () => {
    const store = getStore();
    const state = await store.getState(code);
    if (!state) return null;
    const ticked = tickState(state);
    if (ticked !== state) {
      await store.saveState(ticked);
      return ticked;
    }
    return state;
  });
}

export async function snapshotResponse(
  code: string,
  playerId?: string,
): Promise<RoomSnapshot | null> {
  const state = await loadFreshState(code);
  if (!state) return null;
  return toSnapshot(state, playerId);
}
