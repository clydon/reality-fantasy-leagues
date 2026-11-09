"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { clockOf, dayOf, ShowScore, useGameScore, type GameMoment } from "./scores";

// The sports screens' parts (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's boards "Find a team", "The guide's Sports",
// "Start a game on a team"): a team's mark (its colour, its abbreviation in white or ink by contrast: Tags Not Fills keeps a
// team's colour to its mark and its tag), its lower third (the name on the white plate, the colour on the angled tag, the league on
// a dark plate under it), the one yellow plate (Play the next game: a move), an outlined action with its line, and a game's row.
// A game's state, score and result only ever come through scores.tsx's useGameScore.

const INK = "#121018";

/** White or ink on a team's colour, whichever reads better (the worst on ESPN's colours 4.35:1). */
export function teamInk(hex: string | null | undefined): string {
  if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / 0.0573;
  return onWhite >= onInk ? "#fff" : INK;
}

export const teamBg = (hex: string | null | undefined) => (hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : "#4a4558");

/** A team's mark: its abbreviation on its colour. */
export function TeamMark({ abbr, color, size = "md", className = "" }: { abbr: string | null | undefined; color: string | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "sm" ? "size-[30px] rounded-[4px] text-[11px]" : size === "lg" ? "size-16 rounded-[10px] text-[22px]" : "size-10 rounded-[6px] text-[14px]";
  return (
    <span
      aria-hidden
      className={`type-caption grid flex-none place-items-center tracking-[0.02em] shadow-[inset_0_0_0_1px_rgba(255,255,255,.3)] ${s} ${className}`}
      style={{ background: teamBg(color), color: teamInk(color) }}
    >
      {(abbr ?? "").slice(0, 4)}
    </span>
  );
}

/** A team's lower third: the name on the white plate after its colour's angled tag; the league on the dark plate under it. */
export function TeamPlate({ name, color, sub }: { name: string; color: string | null | undefined; sub: string }) {
  return (
    <div data-team-plate className="mt-1.5">
      <div className="flex h-12 overflow-hidden rounded-[3px] bg-plate shadow-[0_6px_18px_rgba(0,0,0,.3)]">
        <span aria-hidden className="relative z-[1] -mr-3 w-[30px] flex-none [clip-path:polygon(0_0,100%_0,calc(100%-12px)_100%,0_100%)]" style={{ background: teamBg(color) }} />
        <h2 className="type-caption min-w-0 flex-1 truncate pl-[22px] pr-3 text-[24px] leading-[48px] text-plate-foreground">{name}</h2>
      </div>
      <span className="type-caption inline-block rounded-b-[3px] bg-secondary px-2.5 pb-1.5 pt-[7px] text-[13px] tracking-[0.04em] text-muted-foreground">{sub}</span>
    </div>
  );
}

/** The one yellow on the screen: a move you make (Play the next game). */
export function PlayPlate({ title, line, onClick, disabled, data }: { title: string; line: string; onClick: () => void; disabled?: boolean; data?: string }) {
  return (
    <button
      type="button"
      data-play={data ?? ""}
      disabled={disabled}
      onClick={onClick}
      className="nd-press mt-3.5 flex min-h-16 w-full flex-col items-start justify-center gap-1 rounded-[4px] bg-chyron px-3.5 py-2.5 text-left text-chyron-foreground disabled:opacity-60"
    >
      <span className="type-caption text-[22px]">{title}</span>
      <span className="text-[13px] font-semibold">{line}</span>
    </button>
  );
}

/** An optional action with its line, outlined. */
export function MoreAction({ title, line, onClick, data }: { title: string; line: string; onClick: () => void; data?: string }) {
  return (
    <button
      type="button"
      data-more={data ?? ""}
      onClick={onClick}
      className="nd-press mt-2 flex min-h-14 w-full flex-col items-start justify-center gap-[3px] rounded-[4px] px-3.5 py-2 text-left outline-1 -outline-offset-1 outline-edge"
    >
      <span className="text-[15px] font-bold">{title}</span>
      <span className="text-[13px] text-muted-foreground">{line}</span>
    </button>
  );
}

/** A group's label: condensed caps, with an aside. */
export function SportsLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-baseline justify-between gap-3">
      <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{children}</span>
      {aside}
    </div>
  );
}

/** A row that opens the next view down. */
export function OpenRow({ title, line, onClick, data, start }: { title: ReactNode; line?: ReactNode; onClick: () => void; data?: string; start?: ReactNode }) {
  return (
    <button type="button" data-open-row={data ?? ""} onClick={onClick} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-b border-border py-2 text-left">
      {start}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{title}</span>
        {line && <span className="mt-[3px] block truncate text-[13px] text-muted-foreground">{line}</span>}
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

export type TeamGame = GameMoment & {
  home: boolean | null;
  opponent: { id: string; short: string; abbreviation: string | null; color?: string | null } | null;
  score: [number, number] | null;
  result: "W" | "L" | "T" | null;
  note?: string | null;
};

/**
 * One of a team's games from its side: its day and time, the opponent's mark, "vs Cowboys" or "at Cowboys", and, only when the
 * game may be told (useGameScore), its result and score; hidden, "Started 8:20 PM" and nothing else.
 */
export function GameRow({ g, league, onClick }: { g: TeamGame; league: string; onClick: () => void }) {
  const s = useGameScore(g);
  const result = s.open && s.started && g.score ? `${g.result ?? ""} ${g.score[0]}–${g.score[1]}`.trim() : null;
  return (
    <div className="flex items-center border-b border-border" data-game-row={g.id}>
      <button type="button" onClick={onClick} className="nd-press flex min-h-[58px] min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left">
        <span className="flex w-[84px] flex-none flex-col gap-0.5">
          <span className="text-[13px] font-bold">{g.at ? dayOf(g.at) : "To be set"}</span>
          <span className="text-[12px] text-muted-foreground">{s.started && !s.open ? s.when : s.started ? s.when : g.at ? clockOf(g.at) : ""}</span>
        </span>
        <TeamMark abbr={g.opponent?.abbreviation ?? g.opponent?.short.slice(0, 3)} color={g.opponent?.color} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">
            {g.home === false ? "at" : "vs"} {g.opponent?.short ?? "To be decided"}
          </span>
          {g.note && <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{g.note}</span>}
        </span>
        {result && <span className={`flex-none text-[13px] font-bold tabular-nums ${g.result === "W" ? "text-(--nd-good)" : "text-muted-foreground"}`}>{result}</span>}
      </button>
      {s.started && !s.open && <ShowScore id={g.id} league={league} className="ml-2" />}
    </div>
  );
}

export type WeekRowGame = GameMoment & {
  league: string;
  leagueName: string;
  note: string | null;
  sides: { id: string; short: string; abbreviation: string | null; color: string | null; score: string | null; winner: boolean | null }[];
};

/** A game of a day's (the guide, a league's week): away at home, each mark, its time; its score only when it may be told. */
export function WeekRow({ g, onClick, showLeague }: { g: WeekRowGame; onClick: () => void; showLeague?: boolean }) {
  const s = useGameScore(g);
  const [a, b] = g.sides;
  const score = s.open && s.started && a.score != null && b.score != null ? `${a.score}–${b.score}` : null;
  return (
    <div className="flex items-center border-b border-border" data-week-game={g.id}>
      <button type="button" onClick={onClick} className="nd-press flex min-h-[58px] min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left">
        <span className="flex flex-none items-center gap-1">
          <TeamMark abbr={a.abbreviation ?? a.short.slice(0, 3)} color={a.color} size="sm" />
          <TeamMark abbr={b.abbreviation ?? b.short.slice(0, 3)} color={b.color} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {a.short} at {b.short}
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
            {[showLeague ? g.leagueName : null, s.started ? s.when : g.at ? clockOf(g.at) : "Time to be set", g.note].filter(Boolean).join(" · ")}
          </span>
        </span>
        {score && <span className="flex-none text-[13px] font-bold tabular-nums">{score}</span>}
      </button>
      {s.started && !s.open && <ShowScore id={g.id} league={g.league} className="ml-2" />}
    </div>
  );
}
