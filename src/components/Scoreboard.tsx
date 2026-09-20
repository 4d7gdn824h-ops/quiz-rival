"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { PublicPlayer } from "@/lib/game/types";

const PALETTE = ["#ff6b6b", "#4cc9f0"];

export function soleLeaderId(players: PublicPlayer[]): string | null {
  if (players.length < 2) return null;
  const max = Math.max(...players.map((player) => player.score));
  const leaders = players.filter((player) => player.score === max);
  return leaders.length === 1 ? leaders[0].id : null;
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

  const left = players[0];
  const right = players[1];
  const flashName = players.find((player) => player.id === leadState.flashId)?.name;
  const slots: Array<PublicPlayer | null> = [left ?? null, right ?? null];

  return (
    <div className="rivalry-strip" role="group" aria-label="Live scores">
      <p className="sr-only" aria-live="polite">
        {flashName ? `${flashName} takes the lead` : ""}
      </p>
      {slots.map((player, index) => {
        const color = PALETTE[index % PALETTE.length];
        if (!player) {
          return (
            <div key={`empty-${index}`} className="rivalry-side rivalry-empty">
              <p className="rivalry-tag">Rival</p>
              <p className="rivalry-name text-white/40">Waiting</p>
              <p className="rivalry-score text-white/30">?</p>
            </div>
          );
        }

        const isYou = player.id === youId;
        const isLead = player.id === leaderId;
        const isFlash = player.id === leadState.flashId;
        const tags = [
          isYou ? "You" : null,
          player.isHost ? "Host" : null,
          isLead ? "Lead" : null,
        ].filter(Boolean);

        return (
          <div
            key={player.id}
            className={`rivalry-side${isLead ? " is-lead" : ""}${isFlash ? " rivalry-flash" : ""}`}
            style={
              {
                boxShadow: isYou && !isFlash ? `inset 0 0 0 2px ${color}` : undefined,
                "--flash": color,
              } as CSSProperties
            }
          >
            <p className="rivalry-tag" style={{ color }}>
              {tags.join(" · ") || "Rival"}
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
