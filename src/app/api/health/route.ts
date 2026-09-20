import { PACK_CATALOG } from "@/data/catalog";
import { getStore } from "@/lib/game/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    packs: PACK_CATALOG,
    store: getStore().kind,
  });
}
