import type { ScheduleGame } from "./teams";

// The couch's teams in a league, ranked, and the couch's rivalries (docs/PLAN-sports-couch.md B1, a league's This week;
// docs/design-round/league-page-spec.md). Pure: the server's read (src/lib/server/sports/league-teams.ts: each team's record, last
// five and meetings, from the schedules a team's sheet already reads) and the page share it, and tests/sports-couch-table.test.js
// checks it. Every number here is a result: the page hides them all for anyone hiding sports scores (sports/scores.tsx).

/** A team's season so far, as the league's read answers it (the same for everyone). */
export interface TeamForm {
  id: string;
  /** Its finals (none of the preseason's), as the team's sheet counts them. */
  w: number;
  l: number;
  t: number;
  /** Its last five finals, oldest first, each with its game's id (the page shows a result only when it may). */
  form: { id: string; result: "W" | "L" | "T" }[];
  /** Its games this season against the other teams asked for. */
  meetings: Meeting[];
}

/** A game between two of the asked teams, from the first-named team's side. */
export interface Meeting {
  id: string;
  at: string | null;
  state: ScheduleGame["state"];
  final: boolean;
  /** Away first, home second (as a guide reads "Giants at Eagles"); each side's score once begun, and who won once final. */
  away: string;
  home: string;
  score: [number, number] | null;
  winner: string | null;
  calledOff: boolean;
}

/** A team's form from its schedule (`team`'s side of each game); `among`: the other teams whose meetings it keeps. */
export function formOf(team: string, games: ScheduleGame[], among: Set<string>): TeamForm {
  const done = games.filter((g) => g.final && g.result && g.stage !== "pre").sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  const n = (r: string) => done.filter((g) => g.result === r).length;
  const meetings = games
    .filter((g) => g.opponent && among.has(g.opponent.id) && g.opponent.id !== team && g.stage !== "pre")
    .map((g): Meeting => {
      const away = g.home === false ? team : g.opponent!.id;
      const home = g.home === false ? g.opponent!.id : team;
      // The schedule's score is the team's then the opponent's: away first here.
      const score = g.score ? (g.home === false ? g.score : ([g.score[1], g.score[0]] as [number, number])) : null;
      const winner = g.result === "W" ? team : g.result === "L" ? g.opponent!.id : null;
      return { id: g.id, at: g.at, state: g.state, final: g.final, away, home, score, winner, calledOff: g.calledOff };
    });
  return { id: team, w: n("W"), l: n("L"), t: n("T"), form: done.slice(-5).map((g) => ({ id: g.id, result: g.result! })), meetings };
}

/** "7-3", or "5-3-1" with a tie; null before any final. */
export const recordWords = (f: Pick<TeamForm, "w" | "l" | "t">): string | null => (f.w + f.l + f.t ? [f.w, f.l, ...(f.t ? [f.t] : [])].join("–") : null);

/** A share of games won, a tie counting half (as standings count); null before any final. */
export const winShare = (f: Pick<TeamForm, "w" | "l" | "t">): number | null => (f.w + f.l + f.t ? (f.w + f.t / 2) / (f.w + f.l + f.t) : null);

export type Fan = { id: string; name: string; myTeam?: boolean; since?: string };
export type TableTeam = { id: string; short: string; followers: Fan[] };

/**
 * The couch's teams in order, each with its place: by record (a tie counting half, then more wins, then the name), teams with no
 * final yet last; `hidden` (someone hiding scores): yours first, then the most followed, then the name, and no places (an order by
 * record would give the results away).
 */
export function rankTeams<T extends TableTeam>(teams: T[], forms: Map<string, TeamForm>, me: string, hidden: boolean): { team: T; place: number | null }[] {
  const yours = (t: T) => t.followers.some((f) => f.id === me);
  if (hidden) {
    return [...teams]
      .sort((a, b) => +yours(b) - +yours(a) || b.followers.length - a.followers.length || a.short.localeCompare(b.short))
      .map((team) => ({ team, place: null }));
  }
  const share = (t: T) => winShare(forms.get(t.id) ?? { w: 0, l: 0, t: 0 }) ?? -1;
  const sorted = [...teams].sort((a, b) => share(b) - share(a) || (forms.get(b.id)?.w ?? 0) - (forms.get(a.id)?.w ?? 0) || a.short.localeCompare(b.short));
  // One place for a tie (two teams at 7-3 are both 2nd); none for a team with no final.
  const out: { team: T; place: number | null }[] = [];
  sorted.forEach((team, i) => {
    const prev = out[i - 1];
    const same = prev && share(prev.team) === share(team) && (forms.get(prev.team.id)?.w ?? 0) === (forms.get(team.id)?.w ?? 0);
    out.push({ team, place: share(team) < 0 ? null : same ? prev.place : i + 1 });
  });
  return out;
}

/** The person a team stands for on the couch: whose team it is (`myTeam`), you first, else its first fan. */
export function fanOf(t: TableTeam, me: string, not: Set<string> = new Set()): Fan | null {
  const fans = t.followers.filter((f) => !not.has(f.id));
  return fans.find((f) => f.myTeam && f.id === me) ?? fans.find((f) => f.myTeam) ?? fans.find((f) => f.id === me) ?? fans[0] ?? null;
}

/** A meeting of two couch teams that two different people stand for. */
export interface Rivalry extends Meeting {
  fans: [Fan, Fan];
}

/**
 * The couch's rivalries this season: every meeting of two of its teams where each side has a fan the other doesn't (two fans of one
 * team are teammates in its rivalries, never rivals), in order; called-off games left out. Each side's fan is whose team it is.
 */
export function rivalriesOf(teams: TableTeam[], forms: Map<string, TeamForm>, me: string): Rivalry[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const seen = new Map<string, Rivalry>();
  for (const f of forms.values())
    for (const m of f.meetings) {
      if (seen.has(m.id) || m.calledOff) continue;
      const a = byId.get(m.away);
      const b = byId.get(m.home);
      if (!a || !b) continue;
      const aOnly = new Set(a.followers.filter((x) => !b.followers.some((y) => y.id === x.id)).map((x) => x.id));
      const bOnly = new Set(b.followers.filter((x) => !a.followers.some((y) => y.id === x.id)).map((x) => x.id));
      if (!aOnly.size || !bOnly.size) continue;
      const shared = new Set(a.followers.filter((x) => !aOnly.has(x.id)).map((x) => x.id));
      const fa = fanOf(a, me, shared);
      const fb = fanOf(b, me, shared);
      if (fa && fb) seen.set(m.id, { ...m, fans: [fa, fb] });
    }
  return [...seen.values()].sort((x, y) => (x.at ?? "9").localeCompare(y.at ?? "9"));
}

/** Each fan's record in the couch's rivalries (the played ones), best first: "Andrew 2-0". */
export function rivalryRecords(rivalries: Rivalry[]): { fan: Fan; w: number; l: number; t: number }[] {
  const rec = new Map<string, { fan: Fan; w: number; l: number; t: number }>();
  const add = (fan: Fan, k: "w" | "l" | "t") => {
    const r = rec.get(fan.id) ?? { fan, w: 0, l: 0, t: 0 };
    r[k]++;
    rec.set(fan.id, r);
  };
  for (const r of rivalries) {
    if (!r.final || !r.score) continue;
    if (!r.winner) {
      add(r.fans[0], "t");
      add(r.fans[1], "t");
    } else {
      const awayWon = r.winner === r.away;
      add(r.fans[0], awayWon ? "w" : "l");
      add(r.fans[1], awayWon ? "l" : "w");
    }
  }
  return [...rec.values()].sort((a, b) => b.w + b.t / 2 - (a.w + a.t / 2) || a.l - b.l || a.fan.name.localeCompare(b.fan.name));
}

/**
 * Two fans' record in their rivalries (C1: the rivalry card's foot): every played meeting where one stands for each side, whoever's
 * team won. `lead` null when level. Counts the rivalries given (this season's; earlier seasons' since both followed, when given).
 */
export function pairRecord(rivalries: Rivalry[], a: Fan, b: Fan): { lead: Fan | null; first: Fan; other: Fan; w: number; l: number; t: number } {
  let wa = 0;
  let wb = 0;
  let t = 0;
  for (const r of rivalries) {
    if (!r.final || !r.score) continue;
    const ids = r.fans.map((f) => f.id);
    if (!(ids.includes(a.id) && ids.includes(b.id))) continue;
    if (!r.winner) t++;
    else {
      const winnerFan = r.winner === r.away ? r.fans[0] : r.fans[1];
      if (winnerFan.id === a.id) wa++;
      else wb++;
    }
  }
  return wa >= wb ? { lead: wa === wb ? null : a, first: a, other: b, w: wa, l: wb, t } : { lead: b, first: b, other: a, w: wb, l: wa, t };
}
