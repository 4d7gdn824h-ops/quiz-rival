import { homeworkMode } from "@/lib/homework/mode";
import { listFixtureIds } from "@/lib/homework/fixture";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    mode: homeworkMode(),
    fixtures: listFixtureIds(),
    fixtureImage: "/fixtures/chlopi-worksheet.svg",
  });
}
