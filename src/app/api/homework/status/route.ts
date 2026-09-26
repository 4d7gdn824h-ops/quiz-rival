import { AI_NOT_CONFIGURED_MESSAGE, xaiTextModel, xaiVisionModel } from "@/lib/ai/xai";
import { HOMEWORK_FIXTURES } from "@/data/fixtures/catalog";
import { homeworkMode } from "@/lib/homework/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = homeworkMode();
  const configured = mode === "xai";
  return Response.json({
    mode,
    provider: configured ? "xai" : null,
    configured,
    vision: configured,
    message: configured ? null : AI_NOT_CONFIGURED_MESSAGE,
    model: configured ? xaiTextModel() : null,
    visionModel: configured ? xaiVisionModel() : null,
    fixtures: HOMEWORK_FIXTURES,
    fixtureImage: HOMEWORK_FIXTURES[0]?.image ?? "/fixtures/chlopi-worksheet.svg",
  });
}
