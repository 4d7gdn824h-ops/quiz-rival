import type { PublicPlayer } from "@/lib/game/types";

const PALETTE = ["#ff6b6b", "#4cc9f0"];

export function Scoreboard({
  players,
  youId,
  live = false,
}: {
  players: PublicPlayer[];
  youId?: string;
  live?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Live scores">
      {players.map((player, index) => {
        const color = PALETTE[index % PALETTE.length];
        const isYou = player.id === youId;
        return (
          <div
            key={player.id}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
            style={{ boxShadow: isYou ? `inset 0 0 0 2px ${color}` : undefined }}
          >
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-white/60">
              {player.name}
              {player.isHost ? " · host" : ""}
              {isYou ? " · you" : ""}
            </p>
            <p className="font-display text-3xl font-bold leading-none" style={{ color }}>
              {player.score}
            </p>
            {live ? (
              player.answeredCurrent ? (
                <p className="mt-1 text-[11px] text-lime-300">Locked in</p>
              ) : (
                <p className="mt-1 text-[11px] text-white/40">Thinking…</p>
              )
            ) : null}
          </div>
        );
      })}
      {players.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-3 py-2 text-white/40">
          <p className="text-xs uppercase tracking-wide">Rival</p>
          <p className="font-display text-2xl">?</p>
          <p className="text-[11px]">Waiting</p>
        </div>
      ) : null}
    </div>
  );
}
