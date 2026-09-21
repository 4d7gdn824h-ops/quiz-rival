import { listPublicCatalog } from "@/lib/packs/public-catalog";
import { homeworkMode } from "@/lib/homework/mode";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const packs = listPublicCatalog();
  const payload = {
    packs,
    homeworkMode: homeworkMode(),
  };
  assertNoQuizSecrets(payload, "packs");
  return Response.json(payload);
}
