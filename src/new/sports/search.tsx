"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useSportsSearch, type FoundTeams } from "../data";
import { TeamMark } from "./parts";
import { begun, clockOf, dayOf } from "./scores";

// The search box finds teams and leagues too (docs/PLAN-start-a-game-gpt.md, "U0's first round": Shows · Teams · Leagues; U0's
// board "Find a team"): a matchup when the words name two teams ("eagles cowboys", in any order), each team with its next game,
// and the leagues the words name, from /api/sports/search (the edge keeps each an hour). A next game is still to come, so saying
// it gives nothing away. Add a show (watching/sheets.tsx) draws these beside its shows and opens a team as its own step.

export type TeamPick = { kind: "team"; league: string; team: string; name: string; against?: string } | { kind: "league"; league: string; leagueName: string };

/** The words, asked once typing pauses. */
export function useTeamSearch(q: string) {
  const [asked, setAsked] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => setAsked(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const found = useSportsSearch(asked);
  const t = q.trim();
  const data: FoundTeams | undefined = t.length >= 2 ? found.data : undefined;
  return { data, loading: t.length >= 2 && (asked !== q || found.isFetching), strong: !!data?.teams.some((x) => x.score >= 96) || !!data?.matchup };
}

/** Their next game; one already begun says only when it started (Hide scores or not: a search row is no place for a score). */
const nextLine = (n: { at: string | null; home: boolean | null; opponent: { short: string } | null; state: "pre" | "in" | "post" } | null) => {
  if (!n) return "No games coming up";
  const vs = `${n.home === false ? "at" : "vs"} ${n.opponent?.short ?? "TBD"}`;
  if (n.at && begun({ at: n.at, state: n.state })) return `Started ${clockOf(n.at)} ${vs}`;
  return `Next: ${n.at ? `${dayOf(n.at)} ${clockOf(n.at)}` : "time to be set"} ${vs}`;
};

const Group = ({ label }: { label: string }) => <p className="type-caption mb-1 mt-4 text-[14px] tracking-[0.04em] text-muted-foreground">{label}</p>;

function Row({ start, title, sub, onClick, data }: { start: ReactNode; title: string; sub: string; onClick: () => void; data: string }) {
  return (
    <button type="button" data-hit={title} data-hit-kind={data} onClick={onClick} className="nd-press flex min-h-16 w-full items-center gap-3 border-b border-border text-left">
      {start}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[16px]">{title}</b>
        <small className="block truncate text-[12px] text-muted-foreground">{sub}</small>
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** The Teams and Leagues groups. */
export function SportsResults({ data, onPick }: { data: FoundTeams | undefined; onPick: (p: TeamPick) => void }) {
  // A tour's or a promotion's league (golf's, F1's, the UFC's) is an event an episode: not playable from here yet (BACKLOG).
  const leagues = data?.leagues.filter((l) => l.slate) ?? [];
  if (!data || (!data.teams.length && !leagues.length && !data.matchup)) return null;
  const m = data.matchup;
  return (
    <div data-sports-results>
      {(m || data.teams.length > 0) && <Group label="Teams" />}
      {m && (
        <Row
          data="matchup"
          start={
            <span className="flex flex-none -space-x-2">
              <TeamMark abbr={m.teams[0].abbreviation ?? m.teams[0].short.slice(0, 3)} color={m.teams[0].color} />
              <TeamMark abbr={m.teams[1].abbreviation ?? m.teams[1].short.slice(0, 3)} color={m.teams[1].color} />
            </span>
          }
          title={`${m.teams[0].short} v ${m.teams[1].short}`}
          sub={`${m.leagueName ?? m.league} · ${m.next ? `Next meeting ${m.next.at ? `${dayOf(m.next.at)} ${clockOf(m.next.at)}` : ""}` : "No meetings left this season"}`}
          onClick={() => onPick({ kind: "team", league: m.league, team: m.teams[0].id, name: m.teams[0].short, against: m.teams[1].id })}
        />
      )}
      {data.teams.slice(0, m ? 2 : 5).map((t) => (
        <Row
          key={`${t.league}/${t.id}`}
          data="team"
          start={<TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} />}
          title={t.name}
          sub={`${t.leagueName ?? t.league} · ${nextLine(t.next)}`}
          onClick={() => onPick({ kind: "team", league: t.league, team: t.id, name: t.short })}
        />
      ))}
      {leagues.length > 0 && <Group label="Leagues" />}
      {leagues.slice(0, 3).map((l) => (
        <Row
          key={l.league}
          data="league"
          start={<span className="type-caption grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-[14px]">{l.leagueName.slice(0, 4)}</span>}
          title={l.name ?? l.leagueName}
          sub="Every game, week by week"
          onClick={() => onPick({ kind: "league", league: l.league, leagueName: l.leagueName })}
        />
      ))}
    </div>
  );
}
