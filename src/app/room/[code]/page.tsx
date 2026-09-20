import { RoomClient } from "@/components/RoomClient";
import { normalizeRoomCode } from "@/lib/ids";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={normalizeRoomCode(code)} />;
}
