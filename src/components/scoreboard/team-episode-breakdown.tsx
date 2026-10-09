"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import { teamEpisodeBreakdown, type TeamEpisodeLine } from "@/lib/game/team-episode-breakdown";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { cn } from "cn";

// How one team earned its points in one episode, in the same style as the Scoreboard's Roster list:
// a line per starter with what they scored (tap for the events behind it), then the bench -- faded,
// with what each would have scored, not counted -- then that episode's predictions. Shared by the
// Scoreboard's per-episode rows and the Overview's Latest Episode card.
export function TeamEpisodeBreakdown({
  state,
  epId,
  playerId,
  note,
}: {
  state: LeagueState;
  epId: string;
  playerId: string;
  /** The commissioner's "why it mattered" line for this team and episode, if one was written. */
  note?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const b = teamEpisodeBreakdown(state, epId, playerId);
  const toggle = (id: string) => setOpen(open === id ? null : id);

  return (
    <div className="mt-1.5">
      {note && <p className="mb-1.5 text-xs italic">&ldquo;{note}&rdquo;</p>}
      {b.started.length === 0 ? (
        <div className="text-xs italic text-muted-foreground">Nobody started.</div>
      ) : (
        b.started.map((l) => <Line key={l.c.id} l={l} open={open === l.c.id} onToggle={() => toggle(l.c.id)} />)
      )}
      {b.benched.length > 0 && (
        <>
          <div className="mb-0.5 mt-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            Bench <span className="font-normal normal-case tracking-normal">— would have scored, not counted</span>
          </div>
          {b.benched.map((l) => (
            <Line key={l.c.id} l={l} benched open={open === l.c.id} onToggle={() => toggle(l.c.id)} />
          ))}
        </>
      )}
      {b.bets.length > 0 && (
        <div className="mt-2 border-t border-border pt-1.5">
          <div className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Predictions</div>
          {b.bets.map((bet, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5 text-xs">
              <span className="min-w-0 flex-1">
                {bet.label} <span className="text-muted-foreground">&mdash; guessed &ldquo;{bet.guess}&rdquo;</span>
              </span>
              <span className={cn("shrink-0 font-mono font-bold", bet.correct === true ? "text-good" : "text-muted-foreground")}>
                {bet.correct === true ? `✓ +${bet.points}` : bet.correct === false ? "✗" : "…"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Line({ l, benched, open, onToggle }: { l: TeamEpisodeLine; benched?: boolean; open: boolean; onToggle: () => void }) {
  return (
    <div className={cn(benched && "opacity-60")}>
      <button
        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-secondary"
        aria-expanded={open}
        onClick={onToggle}
      >
        <CastawayAvatar
          castaway={l.c}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[0.6rem] font-bold"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.c.name}</span>
        <span
          className={cn(
            "w-9 shrink-0 text-right font-mono text-sm font-bold",
            l.points < 0 && "text-destructive",
            benched && "font-normal"
          )}
        >
          {fmt(l.points)}
        </span>
      </button>
      {open && (
        <div className="mb-1.5 ml-10 mr-1 flex flex-col gap-0.5 text-xs">
          {l.items.length === 0 ? (
            <span className="italic text-muted-foreground">Nothing scored.</span>
          ) : (
            l.items.map((it) => (
              <div key={it.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 text-muted-foreground">{it.label}</span>
                <span className={cn("shrink-0 font-mono", it.points < 0 && "text-destructive")}>{fmt(it.points)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// "+2", "-0.5", "0".
export function fmt(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
