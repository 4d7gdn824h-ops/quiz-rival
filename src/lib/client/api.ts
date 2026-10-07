import type { PlaylistId, QuizVariant } from "@/data/types";
import type { RoomSnapshot } from "@/lib/game/types";
import { CLIENT_TIMEOUT_MS } from "@/lib/client/scan-prep";
import type { ExtractedNotes, HomeworkMode, PublicHomeworkPack, PublicPackDetail } from "@/lib/homework/types";
import type { PlayKit } from "@/lib/play/types";

export class RequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) {
    throw new RequestError(data.error || res.statusText || "Request failed", res.status, data.code);
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

export async function fetchRoomService() {
  return parse<{ store: "memory" | "supabase"; multiplayer: boolean; ok: boolean }>(
    await fetch("/api/rooms", { cache: "no-store" }),
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

export type ExtractResult = {
  id: string;
  mode: HomeworkMode;
  notice: string | null;
  notes: ExtractedNotes;
};

export async function extractHomeworkRequest(
  input: {
    file?: File | null;
    files?: File[];
    fixtureId?: string;
    forceFixture?: boolean;
    pasteDemo?: boolean;
    rawText?: string;
    title?: string;
    source?: string;
  },
  opts?: ScanRequestOpts,
) {
  const files = input.files?.length ? input.files : input.file ? [input.file] : [];
  if (files.length) {
    const form = new FormData();
    for (const file of files) form.append("file", file);
    if (input.forceFixture) form.append("forceFixture", "1");
    if (input.fixtureId) form.append("fixtureId", input.fixtureId);
    if (input.pasteDemo) form.append("pasteDemo", "1");
    if (input.rawText) form.append("rawText", input.rawText);
    if (input.title) form.append("title", input.title);
    if (input.source) form.append("source", input.source);
    return postScan<ExtractResult>("/api/homework/extract", form, null, opts);
  }
  return postScan<ExtractResult>(
    "/api/homework/extract",
    JSON.stringify({
      fixtureId: input.fixtureId,
      forceFixture: input.forceFixture,
      pasteDemo: input.pasteDemo,
      rawText: input.rawText,
      title: input.title,
      source: input.source,
    }),
    { "Content-Type": "application/json" },
    opts,
  );
}

export async function generateHomeworkRequest(notes: ExtractedNotes, opts?: ScanRequestOpts) {
  return postScan<{ mode: HomeworkMode; pack: PublicHomeworkPack; playKit: PlayKit }>(
    "/api/homework/generate",
    JSON.stringify({ notes }),
    { "Content-Type": "application/json" },
    opts,
  );
}

type ScanRequestOpts = {
  signal?: AbortSignal;
  onProgress?: (ratio: number) => void;
  onUploaded?: () => void;
};

function postScan<T>(
  url: string,
  body: FormData | string,
  headers: Record<string, string> | null,
  opts?: ScanRequestOpts,
) {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const signal = opts?.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (headers) {
      for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts?.onProgress?.(event.loaded / event.total);
    };
    xhr.upload.onload = () => opts?.onUploaded?.();
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort);
    xhr.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new RequestError("offline", 0, "offline"));
    };
    xhr.onabort = () => {
      signal.removeEventListener("abort", onAbort);
      if (opts?.signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      reject(new RequestError("timeout", 504, "timeout"));
    };
    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort);
      let data: { error?: string; code?: string } = {};
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as typeof data) : {};
      } catch {
        data = {};
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new RequestError(data.error || xhr.statusText || "Request failed", xhr.status, data.code));
        return;
      }
      resolve(data as T);
    };
    xhr.send(body);
  });
}
