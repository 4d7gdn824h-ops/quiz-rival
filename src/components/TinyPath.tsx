"use client";

import { isTinyLevelUnlocked } from "@/data/levels";
import type { PublicLevel } from "@/data/types";

export function TinyPath({
  levels,
  completedIds,
  currentId,
  onSelect,
  disabled = false,
}: {
  levels: PublicLevel[];
  completedIds: readonly string[];
  currentId?: string | null;
  onSelect?: (levelId: string) => void;
  disabled?: boolean;
}) {
  if (!levels.length) return null;

  return (
    <ol className="tiny-path" aria-label="Tiny level path">
      {levels.map((level, index) => {
        const unlocked = isTinyLevelUnlocked(levels, completedIds, level.id);
        const completed = completedIds.includes(level.id);
        const current = currentId === level.id;
        const locked = !unlocked;
        const tappable = Boolean(onSelect) && !disabled && unlocked;

        return (
          <li key={level.id} className="tiny-path-step">
            {index > 0 ? (
              <span
                className={`tiny-path-edge${unlocked || completed ? " is-on" : ""}`}
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              className={[
                "tiny-path-node",
                locked ? "is-locked" : "",
                unlocked && !completed && !current ? "is-open" : "",
                current ? "is-current" : "",
                completed ? "is-done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!tappable}
              aria-current={current ? "step" : undefined}
              aria-disabled={locked || disabled || !onSelect}
              onClick={() => {
                if (tappable) onSelect?.(level.id);
              }}
            >
              <span className="tiny-path-dot" aria-hidden="true">
                {completed ? "✓" : index + 1}
              </span>
              <span className="tiny-path-title">{level.title}</span>
              <span className="sr-only">
                {locked
                  ? "Locked. Finish the previous node first."
                  : completed
                    ? "Completed. Tap to play again."
                    : current
                      ? "Selected. Start to play this micro-round."
                      : "Unlocked. Tap to play this micro-round."}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
