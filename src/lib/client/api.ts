import type { QuizVariant } from "@/data/types";
import type { RoomSnapshot } from "@/lib/game/types";

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return data;
}

export async function createRoom(input: {
  name: string;
  quizId: string;
  variant: QuizVariant;
}) {
  return parse<{
    player: { id: string; name: string; roomCode: string };
    snapshot: RoomSnapshot;
  }>(
    await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function joinRoom(input: {
  code: string;
  name: string;
  playerId?: string;
}) {
  return parse<{
    player: { id: string; name: string; roomCode: string };
    snapshot: RoomSnapshot;
  }>(
    await fetch(`/api/rooms/${input.code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        name: input.name,
        playerId: input.playerId,
      }),
    }),
  );
}

export async function fetchSnapshot(code: string, playerId?: string) {
  const qs = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
  return parse<RoomSnapshot>(
    await fetch(`/api/rooms/${code}${qs}`, { cache: "no-store" }),
  );
}

export async function roomAction(
  code: string,
  body: Record<string, unknown>,
) {
  return parse<RoomSnapshot>(
    await fetch(`/api/rooms/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
