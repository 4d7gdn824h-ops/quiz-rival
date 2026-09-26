import type { PlaylistId, QuizVariant } from "@/data/types";
import type { WritingPromptConfig } from "@/data/writing-config";
import type { RoomSnapshot } from "@/lib/game/types";
import type { ExtractedNotes, HomeworkMode, PublicHomeworkPack, PublicPackDetail } from "@/lib/homework/types";

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
  playlistId?: PlaylistId;
  levelId?: string | null;
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

export async function fetchPackCatalog() {
  return parse<{ packs: PublicHomeworkPack[]; homeworkMode: HomeworkMode }>(
    await fetch("/api/packs", { cache: "no-store" }),
  );
}

export async function fetchPublicPack(id: string) {
  return parse<PublicPackDetail>(
    await fetch(`/api/packs/${encodeURIComponent(id)}`, { cache: "no-store" }),
  );
}

export async function extractHomeworkRequest(input: {
  file?: File | null;
  fixtureId?: string;
  forceFixture?: boolean;
  pasteDemo?: boolean;
  rawText?: string;
  title?: string;
}) {
  if (input.file) {
    const form = new FormData();
    form.append("file", input.file);
    if (input.forceFixture) form.append("forceFixture", "1");
    if (input.fixtureId) form.append("fixtureId", input.fixtureId);
    if (input.pasteDemo) form.append("pasteDemo", "1");
    if (input.rawText) form.append("rawText", input.rawText);
    if (input.title) form.append("title", input.title);
    return parse<{
      id: string;
      mode: HomeworkMode;
      notice: string | null;
      notes: ExtractedNotes;
    }>(await fetch("/api/homework/extract", { method: "POST", body: form }));
  }
  return parse<{
    id: string;
    mode: HomeworkMode;
    notice: string | null;
    notes: ExtractedNotes;
  }>(
    await fetch("/api/homework/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixtureId: input.fixtureId,
        forceFixture: input.forceFixture,
        pasteDemo: input.pasteDemo,
        rawText: input.rawText,
        title: input.title,
      }),
    }),
  );
}

export async function fetchHomeworkStatus() {
  return parse<{
    mode: HomeworkMode;
    configured: boolean;
    vision: boolean;
    message: string | null;
    model: string | null;
    visionModel: string | null;
  }>(await fetch("/api/homework/status", { cache: "no-store" }));
}

export async function planWritingRequest(input: {
  prompt: string;
  language?: string;
  grade?: string;
  title?: string;
  topics?: string[];
  facts?: string[];
}) {
  return parse<{
    mode: HomeworkMode;
    notice: string | null;
    config: WritingPromptConfig;
  }>(
    await fetch("/api/write/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function generateHomeworkRequest(notes: ExtractedNotes) {
  return parse<{ mode: HomeworkMode; notice: string | null; pack: PublicHomeworkPack }>(
    await fetch("/api/homework/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }),
  );
}
