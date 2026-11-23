"use client";

import type { TeamSchedule } from "../data";
import { MoreAction, PlayPlate, TeamMark, type TeamGame } from "./parts";
import { clockOf, dayOf, ShowScore, useGameScore } from "./scores";
import { useStartSport } from "./start";
import { teamKeyOf } from "@/lib/sports/team-badge";

// A team's games' parts (the team's page, docs/PLAN-sports-couch.md B2, is src/new/screens/team-page.tsx; it replaced the team's
// sheet): what Start a game on is asked for (StartWhen), a schedule game as a game row's moment, "vs Cowboys", and one game's sheet:
// the two marks, its name and time, Show the score once it's begun, and Play this game (B4 redesigns it as the Play sheet).

export type StartWhen =
  | { kind: "next" }
  | { kind: "season" }
  | { kind: "games"; games: string[] }
  | { kind: "meetings"; against: string };

export interface TeamRef {
  league: string;
  team: string;
}


type Game = TeamSchedule["games"][number];
export const asRow = (g: Game): TeamGame => ({
  id: g.id,
  at: g.at,
  state: g.state,
  final: g.final,
  called: g.calledOff ? "postponed" : null,
  home: g.home,
  opponent: g.opponent,
  score: g.score,
  result: g.result,
  note: g.note,
});

/** "vs Cowboys", "at Cowboys". */
export const versus = (g: Pick<Game, "home" | "opponent">) => `${g.home === false ? "at" : "vs"} ${g.opponent?.short ?? "To be decided"}`;

/** One game's sheet: the two marks, its name and time, Show the score once it's begun, and Play this game. */
export function GameView({ g, s, onStart, onStarted }: { g: Game; s: TeamSchedule; onStart: (when: StartWhen) => void; onStarted?: () => void }) {
  const row = asRow(g);
  const sc = useGameScore(row);
  const { start, busy } = useStartSport();
  const away = g.home === false ? s.team : g.opponent;
  const homeSide = g.home === false ? g.opponent : s.team;
  const title = `${away?.short ?? "To be decided"} at ${homeSide?.short ?? "To be decided"}`;
  return (
    <div data-game-view={g.id}>
      <div className="flex items-center gap-3">
        <TeamMark abbr={away?.abbreviation ?? away?.short.slice(0, 3)} color={(away as { color?: string | null } | null)?.color} size="lg" team={away && teamKeyOf(s.league, away.id)} />
        <span className="type-caption text-[18px] text-muted-foreground">at</span>
        <TeamMark abbr={homeSide?.abbreviation ?? homeSide?.short.slice(0, 3)} color={(homeSide as { color?: string | null } | null)?.color} size="lg" team={homeSide && teamKeyOf(s.league, homeSide.id)} />
      </div>
      <h2 className="type-caption mt-3 text-[28px]">{title}</h2>
      <p className="mt-1 text-[14px] text-muted-foreground">
        {sc.started ? sc.when : g.at ? `${dayOf(g.at)} · ${clockOf(g.at)}` : "Time to be set"}
        {sc.open && sc.started && g.score ? ` · ${g.score[0]}–${g.score[1]}` : ""}
        {g.note ? ` · ${g.note}` : ""}
      </p>
      {sc.started && !sc.open && <ShowScore id={g.id} league={s.league} className="mt-3" />}
      {!sc.started ? (
        <>
          <PlayPlate
            data="game"
            disabled={busy}
            title="Play this game"
            line={`Pick'em on it, one tap · tells the couch`}
            onClick={() => void start({ league: s.league, team: s.team.id, games: [g.id], game: "pickem" }, onStarted)}
          />
          <MoreAction data="game-start" title="Another game on it…" line="Squares, a draft or Pick a few · both teams' players" onClick={() => onStart({ kind: "games", games: [g.id] })} />
        </>
      ) : (
        <p className="mt-4 text-[14px] text-muted-foreground">{sc.open && (g.state === "post" || g.final) ? "It's over." : "It's already on: picks closed at the start."}</p>
      )}
    </div>
  );
}
