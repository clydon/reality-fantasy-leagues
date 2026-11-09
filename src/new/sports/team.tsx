"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { sportsApi, useCouchTeams, useHome, useCurrentCouch, useTeamSchedule, type TeamSchedule } from "../data";
import { Avatar } from "../ui/bars";
import { toast } from "../ui/toast";
import { GameRow, MoreAction, OpenRow, PlayPlate, SportsLabel, TeamMark, TeamPlate, type TeamGame } from "./parts";
import { begun, clockOf, dayOf, ShowScore, useGameScore, useHideSports } from "./scores";
import { useStartSport } from "./start";

// A team's sheet (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "Find a team", the user's calls of 2026-11-08 and
// 2026-11-09): you go to a team to start a game, and the game then lives on the couch. Its lower third and Follow (the couch's
// faces who do); a game on now (only when it may be told); **Play the next game**, the one yellow (one tap: Pick'em on it, the
// couch told after the 10-second Undo); Start a game… (the rest of the season, a run, a rival: start-sport.tsx); its rivals (the
// couch's teams first, four, then All opponents · N), filtering what's below to their meetings; the series still to finish; Coming
// up (five, then folded by month); Earlier, folded. A record, a form strip and every result go through Hide scores.

export type StartWhen =
  | { kind: "next" }
  | { kind: "season" }
  | { kind: "games"; games: string[] }
  | { kind: "meetings"; against: string };

export interface TeamRef {
  league: string;
  team: string;
}

const COMING = 5;
const RIVALS = 4;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Game = TeamSchedule["games"][number];
const asRow = (g: Game): TeamGame => ({
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

/** Their record from the finals, "7–2" (a tie as a third number). */
function recordOf(games: Game[]): string | null {
  const done = games.filter((g) => g.final && g.result && g.stage !== "pre");
  if (!done.length) return null;
  const n = (r: string) => done.filter((g) => g.result === r).length;
  return [n("W"), n("L"), ...(n("T") ? [n("T")] : [])].join("–");
}

export function TeamView({
  league,
  team,
  against: firstAgainst,
  onStart,
  onGame,
  onStarted,
}: TeamRef & { against?: string; onStart: (when: StartWhen, teamName: string) => void; onGame: (g: Game, s: TeamSchedule) => void; onStarted?: () => void }) {
  const { data: home } = useHome();
  const couch = useCurrentCouch(home);
  const me = home?.user.id ?? "";
  const qc = useQueryClient();
  const [against, setAgainst] = useState<string | null>(firstAgainst ?? null);
  const sched = useTeamSchedule(league, team);
  const couchTeams = useCouchTeams(couch?.id ?? null);
  const hidden = useHideSports();
  const { start, busy } = useStartSport();
  const [allRivals, setAllRivals] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [earlier, setEarlier] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const s = sched.data;
  const now = Date.now();

  const view = useMemo(() => {
    if (!s) return null;
    const games = s.games.filter((g) => !g.calledOff);
    const mine = against ? games.filter((g) => g.opponent?.id === against) : games;
    const live = games.find((g) => g.state === "in") ?? null;
    const coming = mine.filter((g) => !begun(g, now));
    const past = mine.filter((g) => begun(g, now) && g.id !== live?.id).reverse();
    // The rivals: the couch's teams first, then by how soon they meet.
    const ours = new Set((couchTeams.data?.teams ?? []).filter((t) => t.league === league).map((t) => t.id));
    const opps = new Map<string, { id: string; short: string; abbreviation: string | null; color: string | null; next: Game | null; n: number }>();
    for (const g of games) {
      if (!g.opponent) continue;
      const o = opps.get(g.opponent.id) ?? { ...g.opponent, next: null, n: 0 };
      o.n++;
      if (!o.next && !begun(g, now)) o.next = g;
      opps.set(g.opponent.id, o);
    }
    const rivals = [...opps.values()]
      .filter((o) => o.next)
      .sort((a, b) => +ours.has(b.id) - +ours.has(a.id) || (a.next!.at ?? "").localeCompare(b.next!.at ?? ""));
    return { games, live, coming, past, rivals, ours, record: recordOf(games) };
  }, [s, against, couchTeams.data, league, now]);

  if (sched.isLoading) return <p className="mt-4 text-[14px] text-muted-foreground">Loading their season…</p>;
  if (!s || !view) return <p className="mt-4 text-[14px] text-muted-foreground">{sched.error ? "Couldn't load their season. Try again in a minute." : "No such team."}</p>;

  const followers = couchTeams.data?.teams.find((t) => t.league === league && t.id === team)?.followers ?? [];
  const youFollow = following ?? followers.some((f) => f.id === me);
  const others = followers.filter((f) => f.id !== me);
  const followLine = youFollow
    ? others.length
      ? `You and ${others.length === 1 ? others[0].name : `${others.length} others`} follow them`
      : "You follow them: their games lead your guide"
    : others.length
      ? `${others.slice(0, 2).map((f) => f.name).join(" and ")}${others.length > 2 ? ` and ${others.length - 2} more` : ""} ${others.length === 1 ? "follows" : "follow"} them`
      : "Nobody on your couch follows them yet";
  const follow = async () => {
    const next = !youFollow;
    setFollowing(next);
    try {
      await sportsApi.follow(league, team, next);
      await qc.invalidateQueries({ queryKey: ["new-design", "couch-teams"] });
      toast(next ? `Following the ${s.team.short}: their games lead your guide` : `Unfollowed: their games leave your guide`);
    } catch (e) {
      setFollowing(!next);
      toast.quiet((e as Error).message);
    }
  };

  const next = view.games.find((g) => !begun(g, now)) ?? null;
  const record = !hidden && view.record ? ` · ${view.record}` : "";
  const form = hidden ? [] : view.games.filter((g) => g.final && g.result).slice(-8);
  const rivals = allRivals ? view.rivals : view.rivals.slice(0, RIVALS);
  const rival = against ? view.rivals.find((r) => r.id === against) : null;
  const shown = view.coming.slice(0, COMING);
  const months = new Map<string, Game[]>();
  for (const g of view.coming.slice(COMING)) {
    const k = g.at ? `${MONTHS[new Date(g.at).getMonth()]} ${new Date(g.at).getFullYear()}` : "To be set";
    months.set(k, [...(months.get(k) ?? []), g]);
  }

  return (
    <div data-team-view={`${league}/${team}`}>
      <TeamPlate name={s.team.name} color={s.team.color} sub={`${s.leagueName ?? league}${record}`} />
      <div className="mt-3 flex min-h-11 items-center gap-2" data-team-follow>
        {followers.length > 0 && (
          <span className="flex -space-x-1.5">
            {followers.slice(0, 3).map((f) => (
              <Avatar key={f.id} id={f.id} name={f.name} size={24} />
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">{followLine}</span>
        <button
          type="button"
          aria-pressed={youFollow}
          data-follow-team
          onClick={follow}
          className={`nd-press min-h-11 flex-none rounded-full px-4 text-[14px] font-bold ${youFollow ? "bg-foreground text-background" : "outline-1 -outline-offset-1 outline-edge"}`}
        >
          {youFollow ? "Following" : "Follow"}
        </button>
      </div>
      {form.length > 0 && (
        <div className="mt-3 flex gap-1" role="img" aria-label={`Their last ${form.length}: ${form.map((g) => g.result).join(", ")}`} data-team-form>
          {form.map((g) => (
            <span
              key={g.id}
              className={`grid h-[26px] min-w-0 flex-1 place-items-center rounded-[3px] text-[11px] font-extrabold outline-1 -outline-offset-1 ${g.result === "W" ? "bg-good/15 text-(--nd-good) outline-transparent" : "text-muted-foreground outline-border"}`}
            >
              {g.result}
            </span>
          ))}
        </div>
      )}
      {view.live && <LiveNow g={view.live} league={league} />}
      {next ? (
        <PlayPlate
          data="next"
          disabled={busy}
          title={`Play the ${dayOf(next.at ?? "") === "Today" ? "game tonight" : "next game"}`}
          line={`Pick'em · ${next.at ? `${dayOf(next.at)} ${clockOf(next.at)}` : "time to be set"} ${versus(next)} · tells the couch`}
          onClick={() => void start({ league, team, games: [next.id], game: "pickem" }, onStarted)}
        />
      ) : (
        <p className="mt-4 text-[14px] text-muted-foreground" data-no-next>
          No games coming up this season.
        </p>
      )}
      {next && <MoreAction data="start" title="Start a game…" line="The rest of the season, a run of games, a rival" onClick={() => onStart(against ? { kind: "meetings", against } : { kind: "next" }, s.team.short)} />}

      {view.rivals.length > 0 && (
        <>
          <SportsLabel>Against a rival</SportsLabel>
          <div className="flex flex-wrap gap-1.5" data-rivals>
            {rivals.map((r) => {
              const on = against === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  data-rival={r.id}
                  onClick={() => setAgainst(on ? null : r.id)}
                  className={`nd-press inline-flex min-h-11 flex-col items-start justify-center rounded-[4px] px-3 py-1 text-left text-[14px] font-bold leading-tight outline-1 -outline-offset-1 ${on ? "bg-foreground text-background outline-foreground" : "outline-edge"}`}
                >
                  {r.short}
                  <span className="text-[12px] font-normal opacity-85">{view.ours.has(r.id) ? "Your couch's · " : ""}{r.next?.at ? dayOf(r.next.at) : ""}</span>
                </button>
              );
            })}
          </div>
          {view.rivals.length > RIVALS && (
            <button type="button" onClick={() => setAllRivals(!allRivals)} className="mt-3 text-[13px] font-bold underline underline-offset-[3px]" data-all-rivals>
              {allRivals ? "Fewer opponents" : `All opponents · ${view.rivals.length}`}
            </button>
          )}
          {rival && (
            <p className="mt-3 text-[13px] text-muted-foreground" data-against-note>
              Just their games against the {rival.short}.{" "}
              <button type="button" className="font-bold text-foreground underline underline-offset-[3px]" onClick={() => onStart({ kind: "meetings", against: rival.id }, s.team.short)}>
                Play every meeting
              </button>
            </p>
          )}
        </>
      )}

      {!against && s.series.some((x) => x.state === "coming" && x.games.length >= 2) && (
        <>
          <SportsLabel>Series</SportsLabel>
          {s.series
            .filter((x) => x.state === "coming" && x.games.length >= 2)
            .slice(0, 4)
            .map((x) => (
              <OpenRow key={x.games.join()} data="series" title={x.name} line={`${x.games.length} games · Play the series`} onClick={() => onStart({ kind: "games", games: x.games }, s.team.short)} />
            ))}
        </>
      )}

      {shown.length > 0 && (
        <>
          <SportsLabel>{rival ? `Coming up against the ${rival.short}` : `Coming up · ${view.coming.length}`}</SportsLabel>
          {shown.map((g) => (
            <GameRow key={g.id} g={asRow(g)} league={league} onClick={() => onGame(g, s)} />
          ))}
          {[...months].map(([m, rows]) => (
            <div key={m}>
              <button
                type="button"
                aria-expanded={open.has(m)}
                onClick={() => setOpen((o) => new Set(o.has(m) ? [...o].filter((x) => x !== m) : [...o, m]))}
                className="nd-press flex min-h-[52px] w-full items-center gap-3 border-b border-border text-left"
              >
                <span className="flex-1 text-[15px] font-semibold">
                  {m} <span className="font-normal text-muted-foreground">· {rows.length}</span>
                </span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open.has(m) ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {open.has(m) && rows.map((g) => <GameRow key={g.id} g={asRow(g)} league={league} onClick={() => onGame(g, s)} />)}
            </div>
          ))}
        </>
      )}
      {view.past.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setEarlier(!earlier)} className="text-[13px] font-bold underline underline-offset-[3px]" data-earlier>
            {earlier ? "Hide earlier games" : `Earlier · ${view.past.length}`}
          </button>
          {earlier && view.past.map((g) => <GameRow key={g.id} g={asRow(g)} league={league} onClick={() => onGame(g, s)} />)}
        </div>
      )}
    </div>
  );
}

/** A game of theirs on now: its score only when it may be told; else when it started, and Show the score. */
function LiveNow({ g, league }: { g: Game; league: string }) {
  const s = useGameScore(asRow(g));
  return (
    <div className="mt-3.5" data-live-now>
      <div className="flex h-10 overflow-hidden rounded-[3px] bg-plate shadow-[0_6px_18px_rgba(0,0,0,.3)]">
        <span className="type-caption relative z-[1] -mr-3 flex items-center bg-secondary pl-2.5 pr-[22px] text-[14px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-12px)_100%,0_100%)]">
          {s.open ? "On now" : "Started"}
        </span>
        <span className="type-caption flex min-w-0 flex-1 items-center truncate pl-5 pr-3 text-[17px] text-plate-foreground">
          {s.open && g.score ? `${versus(g)} · ${g.score[0]}–${g.score[1]}` : versus(g)}
        </span>
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">{s.open ? "Picks closed when it started." : `${s.when}. Picks closed when it started.`}</p>
      {!s.open && <ShowScore id={g.id} league={league} className="mt-2" />}
    </div>
  );
}

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
        <TeamMark abbr={away?.abbreviation ?? away?.short.slice(0, 3)} color={(away as { color?: string | null } | null)?.color} size="lg" />
        <span className="type-caption text-[18px] text-muted-foreground">at</span>
        <TeamMark abbr={homeSide?.abbreviation ?? homeSide?.short.slice(0, 3)} color={(homeSide as { color?: string | null } | null)?.color} size="lg" />
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
          <MoreAction data="game-start" title="Another game on it…" line="Squares, a draft or Pick a few" onClick={() => onStart({ kind: "games", games: [g.id] })} />
        </>
      ) : (
        <p className="mt-4 text-[14px] text-muted-foreground">{sc.open && (g.state === "post" || g.final) ? "It's over." : "It's already on: picks closed at the start."}</p>
      )}
    </div>
  );
}
