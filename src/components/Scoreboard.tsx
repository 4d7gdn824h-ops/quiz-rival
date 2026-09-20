"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { PublicPlayer } from "@/lib/game/types";

const YOU_COLOR = "#ff6b6b";
const THEM_COLOR = "#4cc9f0";

export function soleLeaderId(players: PublicPlayer[]): string | null {
  if (players.length < 2) return null;
  const max = Math.max(...players.map((player) => player.score));
  const leaders = players.filter((player) => player.score === max);
  return leaders.length === 1 ? leaders[0].id : null;
}

/** Seat the current player on the left so every device reads You vs Them. */
export function seatYouVsThem(
  players: PublicPlayer[],
  youId?: string,
): { you: PublicPlayer | null; them: PublicPlayer | null } {
  const you =
    (youId ? players.find((player) => player.id === youId) : undefined) ??
    players[0] ??
    null;
  const them = players.find((player) => player.id !== you?.id) ?? null;
  return { you, them };
}

function sideTag(kind: "you" | "them", isLead: boolean) {
  const base = kind === "you" ? "You" : "Them";
  return isLead ? `${base} · Lead` : base;
}

export function Scoreboard({
  players,
  youId,
  live = false,
}: {
  players: PublicPlayer[];
  youId?: string;
  live?: boolean;
}) {
  const { you, them } = seatYouVsThem(players, youId);
  const leaderId = soleLeaderId(players);
  const [leadState, setLeadState] = useState({
    leaderId,
    flashId: null as string | null,
    flashGen: 0,
  });

  if (leaderId !== leadState.leaderId) {
    setLeadState({
      leaderId,
      flashId: leaderId,
      flashGen: leadState.flashGen + 1,
    });
  }

  useEffect(() => {
    if (!leadState.flashId) return;
    const id = window.setTimeout(() => {
      setLeadState((current) =>
        current.flashId ? { ...current, flashId: null } : current,
      );
    }, 1100);
    return () => window.clearTimeout(id);
  }, [leadState.flashId, leadState.flashGen]);

  const flashName = players.find((player) => player.id === leadState.flashId)?.name;
  const slots: Array<{
    kind: "you" | "them";
    player: PublicPlayer | null;
    color: string;
  }> = [
    { kind: "you", player: you, color: YOU_COLOR },
    { kind: "them", player: them, color: THEM_COLOR },
  ];

  const youScore = you?.score ?? 0;
  const themLabel = them?.name ?? "Them";

  return (
    <div
      className="rivalry-strip"
      role="group"
      aria-label={`You ${youScore} versus ${themLabel} ${them?.score ?? "?"}`}
    >
      <p className="sr-only" aria-live="polite">
        {flashName ? `${flashName} takes the lead` : ""}
      </p>
      {slots.map(({ kind, player, color }) => {
        if (!player) {
          return (
            <div
              key={`empty-${kind}`}
              className="rivalry-side rivalry-empty"
              data-side={kind}
            >
              <p className="rivalry-tag">Them</p>
              <p className="rivalry-name text-white/40">Waiting</p>
              <p className="rivalry-score text-white/30">?</p>
            </div>
          );
        }

        const isLead = player.id === leaderId;
        const isFlash = player.id === leadState.flashId;

        return (
          <div
            key={player.id}
            className={`rivalry-side${isLead ? " is-lead" : ""}${isFlash ? " rivalry-flash" : ""}`}
            data-side={kind}
            data-player={player.name}
            data-score={player.score}
            data-lead={isLead ? "true" : "false"}
            style={
              {
                boxShadow:
                  kind === "you" && !isFlash ? `inset 0 0 0 2px ${color}` : undefined,
                "--flash": color,
              } as CSSProperties
            }
          >
            <p className="rivalry-tag" style={{ color }}>
              {sideTag(kind, isLead)}
            </p>
            <p className="rivalry-name" title={player.name}>
              {player.name}
            </p>
            <p className="rivalry-score" style={{ color }}>
              {player.score}
            </p>
            {live ? (
              <p className={`rivalry-status${player.answeredCurrent ? " is-locked" : ""}`}>
                {player.answeredCurrent ? "Locked in" : "Thinking…"}
              </p>
            ) : (
              <p className="rivalry-status">{isLead ? "Ahead" : "Ready"}</p>
            )}
          </div>
        );
      })}
      <div className="rivalry-vs" aria-hidden="true">
        <span>VS</span>
      </div>
    </div>
  );
}
