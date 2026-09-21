import { getPublicPack } from "@/lib/packs/public-catalog";
import { assertNoQuizSecrets } from "@/lib/public-quiz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PackParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: PackParams) {
  const { id } = await params;
  const pack = getPublicPack(id);
  if (!pack) {
    return Response.json({ error: "Pack not found" }, { status: 404 });
  }
  assertNoQuizSecrets(pack, "pack");
  return Response.json(pack);
}
