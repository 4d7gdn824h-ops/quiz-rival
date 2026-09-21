import { HOMEWORK_FIXTURES } from "@/data/fixtures/catalog";
import { homeworkMode } from "@/lib/homework/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    mode: homeworkMode(),
    vision: homeworkMode() !== "fixture",
    fixtures: HOMEWORK_FIXTURES,
    fixtureImage: HOMEWORK_FIXTURES[0]?.image ?? "/fixtures/chlopi-worksheet.svg",
  });
}
