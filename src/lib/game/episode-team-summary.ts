import type { Castaway, LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { episodePlayerPoints, rosterAtEpisode, castawayEpisodeStats } from "./active-roster-rows";
import { playerBetRows } from "./bet-rows";
import { tribeAtEpisode } from "./episode-recap";

// A call is only worth a line when at least this much rode on it -- below it, a bullet is noise.
const NOTABLE = 1;

/** One line of a team's episode summary on the Scoreboard. */
export interface TeamSummaryBullet {
  kind: "perfect" | "best" | "costly" | "benchSaved";
  icon: string;
  /** Plain words, no numbers that `points` already carries. */
  text: string;
  /** The points this line is about, shown on the right; absent for the perfect-lineup line. */
  points?: number;
}

/**
 * The latest episode that's scored for this league -- the one the Scoreboard summarizes. Run on the
 * client's state, which is already spoiler-trimmed, so "latest" is only ever one this viewer may see.
 */
export function latestScoredEpisode(state: LeagueState) {
  return (
    [...state.episodes]
      .filter((ep) => StateLogic.inPlay(state, ep.number) && StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0)
      .sort((a, b) => b.number - a.number)[0] ?? null
  );
}

/**
 * How one episode moved a team in the race for 1st: how much it gained (or lost) on the leader --
 * or, for the leader, on 2nd -- with "1st" and "2nd" as the standings stood AFTER the episode. So
 * when the lead changes hands the two teams' numbers mirror each other (the new leader +5 on the old
 * one, the old one -5 on the new). `tookLead`: sole 1st now and not before, and not just because
 * this was the first episode that scored. Points are scoring events plus that episode's graded
 * predictions, the same ones the Scoreboard total adds up. Null for a one-team league or a player
 * not in it.
 */
export function weekInRace(state: LeagueState, epId: string, playerId: string): { gained: number; leading: boolean; tookLead: boolean } | null {
  const ep = state.episodes.find((e) => e.id === epId);
  const players = episodePlayerPoints(state, epId).map((f) => f.player.id);
  if (!ep || players.length < 2 || !players.includes(playerId)) return null;

  // Through this episode only, so an older one reads as it was then and nothing later leaks in.
  const scored = state.episodes.filter((e) => StateLogic.inPlay(state, e.number) && e.number <= ep.number);
  const weekOf = (pid: string, number: number) => {
    const e = scored.find((x) => x.number === number);
    const events = e ? (episodePlayerPoints(state, e.id).find((f) => f.player.id === pid)?.points ?? 0) : 0;
    const bets = state.settings.bonusEnabled ? playerBetRows(state, pid).filter((b) => b.episode === number).reduce((t, b) => t + b.points, 0) : 0;
    return events + bets;
  };
  const totals = (upTo: number) =>
    players
      .map((pid) => ({ pid, total: StateLogic.roundPoints(scored.filter((e) => e.number <= upTo).reduce((t, e) => t + weekOf(pid, e.number), 0)) }))
      .sort((a, b) => b.total - a.total);

  const after = totals(ep.number);
  const top = after[0].total;
  const leading = after.find((s) => s.pid === playerId)!.total === top;
  // The leader (or one of those level at the top) is measured against the best of the rest.
  const ref = leading ? after.find((s) => s.pid !== playerId)! : after[0];
  const gained = StateLogic.roundPoints(weekOf(playerId, ep.number) - weekOf(ref.pid, ep.number));

  const before = totals(ep.number - 1);
  const soleLeader = (list: typeof after) => list[0].pid === playerId && list[0].total > list[1].total;
  const anyoneScoredBefore = before.some((s) => s.total !== 0);
  return { gained, leading, tookLead: soleLeader(after) && !soleLeader(before) && anyoneScoredBefore };
}

/**
 * A team's episode as the calls its owner made: a perfect lineup, a standout start, a costly one, a
 * benching that saved them points. Only what's worth saying -- a quiet week gets no lines at all.
 * Compared against the league's castaways, never against another team by name. Pure arithmetic over
 * what the Scoreboard breakdown already shows: no AI, nothing stored.
 */
export function episodeTeamBullets(state: LeagueState, epId: string, playerId: string): TeamSummaryBullet[] {
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep) return [];
  const field = episodePlayerPoints(state, epId);
  const mine = field.find((f) => f.player.id === playerId);
  if (!mine) return [];

  const bullets: TeamSummaryBullet[] = [];

  // Everyone still playing this episode, with what they scored in it: the yardstick for "how good
  // was that start", and each of this team's castaways looked up from it.
  const scored = (c: Castaway) => castawayEpisodeStats(state, epId, c.id);
  const playing = state.castaways.filter((c) => inGameFor(state, c, ep.number)).map((c) => ({ c, stats: scored(c) }));
  const startedIds = new Set(StateLogic.activeRosterLineupFor(state, epId, playerId));
  const roster = rosterAtEpisode(state, playerId, epId).map((c) => ({ c, stats: scored(c) }));
  const started = roster.filter((r) => startedIds.has(r.c.id));
  const benched = roster.filter((r) => !startedIds.has(r.c.id));
  const byTotal = <T extends { stats: { total: number } }>(list: T[], dir: 1 | -1) =>
    [...list].sort((a, b) => dir * (b.stats.total - a.stats.total))[0];

  // Perfect lineup: no other choice of starters from this roster would have scored more. Only when
  // there was a real choice (someone on the bench) and something scored, or an empty bench on a
  // quiet week would earn it for nothing.
  const slots = StateLogic.ActiveRosterLogic.activeSlots(state) || roster.length;
  const bestPossible = StateLogic.roundPoints(
    [...roster].sort((a, b) => b.stats.total - a.stats.total).slice(0, slots).reduce((t, r) => t + r.stats.total, 0)
  );
  const startedPoints = StateLogic.roundPoints(started.reduce((t, r) => t + r.stats.total, 0));
  if (benched.length > 0 && roster.some((r) => r.stats.total !== 0) && startedPoints >= bestPossible) {
    bullets.push({ kind: "perfect", icon: "🎯", text: "Perfect lineup: you started your best possible team" });
  }

  // Best start: only when it stood out -- top quarter of everyone playing (top 3 at least), with
  // anyone level counted in, so "8th-best of 18" or a 9-way tie from a tribe win doesn't make a line.
  const best = byTotal(started, 1);
  if (best && best.stats.total >= NOTABLE) {
    const above = playing.filter((p) => p.stats.total > best.stats.total).length;
    const level = playing.filter((p) => p.stats.total === best.stats.total).length;
    if (above + level <= Math.max(3, Math.ceil(playing.length / 4))) {
      const standing =
        above === 0
          ? `${level > 1 ? "tied for the" : "the"} best score of anyone this week`
          : `${level > 1 ? "tied " : ""}${ordinal(above + 1)}-best of ${playing.length} castaways this week`;
      bullets.push({ kind: "best", icon: "⭐", text: `Started ${best.c.name}${why(best.stats, 1)}: ${standing}`, points: best.stats.total });
    }
  }

  // A benched castaway who'd have beaten your weakest starter -- only said alongside a costly start.
  const topBench = byTotal(benched, 1);
  const weakest = byTotal(started, -1);
  const gain = topBench && topBench.stats.total > 0 ? StateLogic.roundPoints(topBench.stats.total - (weakest?.stats.total ?? 0)) : 0;
  const missed = gain >= NOTABLE ? topBench : null;
  const costly = weakest && weakest.stats.total <= -NOTABLE ? weakest : null;
  if (costly) {
    // A better option sat on the bench: the call that cost the most, said once, here.
    const alt = missed ? ` while ${missed.c.name} scored ${fmt(missed.stats.total)} on your bench` : "";
    bullets.push({ kind: "costly", icon: "💀", text: `Started ${costly.c.name}${why(costly.stats, -1)}${alt}`, points: costly.stats.total });
  }

  const saved = byTotal(benched, -1);
  if (saved && saved.stats.total <= -NOTABLE) {
    bullets.push({ kind: "benchSaved", icon: "🛡️", text: `Good call benching ${saved.c.name}${why(saved.stats, -1)}`, points: saved.stats.total });
  }

  return bullets;
}


/** " (Voted out)": the event behind a castaway's score, the biggest one in the direction that counted. */
function why(stats: ReturnType<typeof castawayEpisodeStats>, dir: 1 | -1) {
  const top = [...stats.byType].filter((t) => dir * t.points > 0).sort((a, b) => dir * (b.points * b.count - a.points * a.count))[0];
  return top ? ` (${top.label.toLowerCase()})` : "";
}

/** Still in the game for episode `number` (someone who left in it played it). */
function inGameFor(state: LeagueState, c: Castaway, number: number) {
  if (c.status !== "eliminated") return true;
  const exit = state.episodes.find((e) => e.id === c.exitEpisodeId);
  return !!exit && exit.number >= number;
}

/** A team's whole episode, in words an AI can work from: the race, then every starter and bench player. */
function teamEpisodeBlock(state: LeagueState, epId: string, playerId: string, startedBy: Map<string, number>, teams: number) {
  const ep = state.episodes.find((e) => e.id === epId)!;
  const player = state.players.find((p) => p.id === playerId)!;
  const field = episodePlayerPoints(state, epId);
  const mine = field.find((f) => f.player.id === playerId)?.points ?? 0;
  const average = Math.round((field.reduce((t, f) => t + f.points, 0) / field.length) * 10) / 10;
  const race = weekInRace(state, epId, playerId);
  const raceText = !race
    ? ""
    : race.tookLead
      ? ` · took 1st place, gaining ${race.gained} on the old leader`
      : race.leading
        ? ` · in 1st; lead over 2nd ${race.gained > 0 ? `grew by ${race.gained}` : race.gained < 0 ? `shrank by ${-race.gained}` : "held"}`
        : ` · ${race.gained > 0 ? `closed ${race.gained} on 1st` : race.gained < 0 ? `fell ${-race.gained} further behind 1st` : "kept pace with 1st"}`;

  const startedIds = new Set(StateLogic.activeRosterLineupFor(state, epId, playerId));
  const describe = (c: Castaway) => {
    const stats = castawayEpisodeStats(state, epId, c.id);
    const tribe = state.tribes.find((t) => t.id === tribeAtEpisode(state, c, ep.number))?.name;
    const did = stats.byType.map((t) => (t.count > 1 ? `${t.label} x${t.count}` : t.label)).join(", ") || "nothing scored";
    const n = startedBy.get(c.id) ?? 0;
    return `${c.name}${tribe ? ` (${tribe})` : ""} ${fmt(stats.total)}: ${did.toLowerCase()} [started by ${n} of ${teams} teams]`;
  };
  const roster = rosterAtEpisode(state, playerId, epId);
  const started = roster.filter((c) => startedIds.has(c.id));
  const benched = roster.filter((c) => !startedIds.has(c.id));
  const calls = episodeTeamBullets(state, epId, playerId).map((b) => b.text);
  return [
    `TEAM: ${player.name}`,
    `- This episode: ${fmt(mine)} pts (league average ${average})${raceText}`,
    `- Started: ${started.map(describe).join("; ") || "nobody"}`,
    `- Bench: ${benched.map(describe).join("; ") || "nobody"}`,
    ...(calls.length ? [`- Notable: ${calls.join("; ")}`] : []),
  ].join("\n");
}

/**
 * The one prompt a commissioner copies into any AI chat to write every team's "why it mattered" line
 * for an episode at once: every team's lineup, bench and race, grounded in the episode's own research
 * summary (already stored by the weekly research run) when there is one -- that's what lets a line
 * give a reason, not just restate points. The reply comes back as "Team: sentence" lines, read by
 * parseLeagueReply.
 */
export function buildLeaguePrompt(state: LeagueState, epId: string, episodeSummaryText: string | null) {
  const ep = state.episodes.find((e) => e.id === epId);
  const field = episodePlayerPoints(state, epId);
  if (!ep || field.length === 0) return "";
  const startedBy = new Map<string, number>();
  for (const f of field) for (const id of StateLogic.activeRosterLineupFor(state, epId, f.player.id)) startedBy.set(id, (startedBy.get(id) ?? 0) + 1);

  const lines = [
    `This is a fantasy league for a reality TV show. Each team starts a few castaways every episode and scores points for what they do. Write ONE line per team about episode ${ep.number}: why that team's week went the way it did.`,
    "",
    "Rules:",
    "- 20 words or fewer per line. Plain, everyday words, as if telling a friend who has never seen the show.",
    '- No jargon or made-up compound words (not "idol-less boot", say "voted out without an idol").',
    "- Say which one or two castaways decided the week and what they actually did in the episode. Use the episode story below, not just the points.",
    "- Like a sports commentator, with no subject needed: the team's name is shown right above the line.",
    '- Never name another team or league member. Comparisons are fine without names ("the only team to start her", "most of the league").',
    "",
    `Good: "Rode Toka's immunity win, then benched Ana the night Savu blindsided her."`,
    'Bad: "A strong start, but not enough impact elsewhere." (vague, says nothing about the episode)',
    "",
    "Reply with exactly one line per team, in this format and nothing else:",
    ...field.map((f) => `${f.player.name}: <line>`),
  ];
  if (episodeSummaryText) lines.push("", "WHAT HAPPENED IN THE EPISODE:", episodeSummaryText);
  lines.push("", "THE TEAMS:");
  for (const f of field) lines.push("", teamEpisodeBlock(state, epId, f.player.id, startedBy, field.length));
  return lines.join("\n");
}

/**
 * Reads an AI chat's reply to buildLeaguePrompt back into one line per team. Forgiving of what chats
 * add -- bullets, bold, numbering, quotes, a dash instead of a colon -- of team-name case, and of
 * every team run together on one line ("Sam: ... Alex: ..."): a team's line runs from "Name:" to the
 * next team's. Anything it can't place on a team (a "Here you go:", a sign-off after the last line)
 * comes back in `unmatched` for the commissioner to see.
 */
export function parseLeagueReply(reply: string, teams: { id: string; name: string }[]) {
  const lines: Record<string, string> = {};
  const unmatched: string[] = [];
  if (teams.length === 0) return { lines, unmatched };
  const text = reply.replace(/\*\*|__/g, "").replace(/\r\n?/g, "\n");
  // Longest names first, so "Sam" doesn't claim a line meant for "Sam B".
  const names = [...teams]
    .sort((a, b) => b.name.length - a.name.length)
    .map((t) => t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // "Name:" anywhere, as a whole word. A dash instead of the colon only at the start of a line --
  // mid-sentence, "... voted out - Rob ..." is a castaway, not a team called Rob.
  const marker = new RegExp(`(?<![\\p{L}\\p{N}])(${names})\\s*:|^[ \\t]*(?:[-*•]|\\d+[.)])?[ \\t]*(${names})[ \\t]*[-–—]`, "gimu");
  const found = [...text.matchAll(marker)];

  const clean = (s: string) =>
    s
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
      .replace(/\s*(?:[-*•]|\d+[.)])\s*$/, "") // the next line's bullet or number, left at this one's end
      .trim()
      .replace(/^["“”']+|["“”']+$/g, "")
      .trim();
  const lead = clean(text.slice(0, found[0]?.index ?? text.length));
  if (lead) unmatched.push(...lead.split("\n").map(clean).filter(Boolean));

  found.forEach((m, i) => {
    const name = (m[1] ?? m[2]).toLowerCase();
    const team = teams.find((t) => t.name.toLowerCase() === name)!;
    const body = text.slice(m.index! + m[0].length, found[i + 1]?.index ?? text.length);
    // A team's line is its first paragraph; anything below it before the next team isn't theirs.
    const [first, ...rest] = body.split(/\n\s*\n|\n/).map(clean).filter(Boolean);
    if (first) lines[team.id] = first;
    unmatched.push(...rest);
  });
  return { lines, unmatched };
}

function fmt(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
