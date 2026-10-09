import { PACK_CATALOG } from "@/data/catalog";
import { multiplayerAvailable } from "@/lib/game/availability";
import { getStore } from "@/lib/game/store";
import { homeworkMode } from "@/lib/homework/mode";
import { listPublicCatalog } from "@/lib/packs/public-catalog";
import { packsForPublicList } from "@/lib/pack-access";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = {
    packs: packsForPublicList(listPublicCatalog()),
    builtIn: PACK_CATALOG,
    store: getStore().kind,
    multiplayer: multiplayerAvailable(),
    homeworkMode: homeworkMode(),
  };
  assertNoQuizSecrets(payload.packs, "packs");
  return Response.json(payload);
}
