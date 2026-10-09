import type { ExtractedNotes } from "@/lib/homework/types";
import type { PlayKit } from "@/lib/play/types";
import { writeHomeworkDraft, writeTonightPackId } from "./homework-draft";
import { writeLocalPlay, writePlayKit } from "./local-play";
import { saveParentKey } from "./parent-key";

/** First tiny-path node, then the quiz. The player name stays "You". */
export function startScanPlay(input: {
  packId: string;
  levels?: { id: string; mega?: boolean }[];
  playKit: PlayKit;
  notes: ExtractedNotes;
  mode: "xai" | "fixture";
  notice: string | null;
  parentKey?: string | null;
}) {
  writeHomeworkDraft({
    extractId: "local",
    notes: input.notes,
    mode: input.mode,
    notice: input.notice,
  });
  writePlayKit(input.playKit);
  writeTonightPackId(input.packId);
  if (input.parentKey) saveParentKey(input.packId, input.parentKey);
  const first = input.levels?.find((level) => !level.mega);
  writeLocalPlay({
    mode: "solo",
    quizId: input.packId,
    variant: "A",
    levelId: first?.id ?? null,
    names: ["You", "Player 2"],
    startedAt: Date.now(),
  });
}
