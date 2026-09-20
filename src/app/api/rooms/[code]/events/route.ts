import { jsonError, snapshotResponse } from "@/lib/game/http";
import { onRoom } from "@/lib/game/pubsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CodeParams = { params: Promise<{ code: string }> };

export async function GET(request: Request, { params }: CodeParams) {
  try {
    const { code } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId") ?? undefined;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = async () => {
          const snapshot = await snapshotResponse(code, playerId ?? undefined);
          if (!snapshot) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "Room not found" })}\n\n`),
            );
            return;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        };
        await send();
        const unsub = onRoom(code, () => {
          void send();
        });
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);
        request.signal.addEventListener("abort", () => {
          unsub();
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
