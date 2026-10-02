import type { Castaway, LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { episodePlayerPoints, rosterAtEpisode, castawayEpisodeStats } from "./active-roster-rows";
import { playerBetRows } from "./bet-rows";

// A call is only worth a line when at least this much rode on it -- below it, a bullet is noise.
const NOTABLE = 1;

/** One line of a team's episode summary on the Scoreboard. */
export interface TeamSummaryBullet {
  kind: "best" | "costly" | "benchSaved" | "benchMissed" | "net";
  icon: string;
  /** Plain words, no numbers that `points` already carries. */
  text: string;
  /** The points this line is about, shown on the right; absent for the net line. */
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
 * A team's episode as the calls its owner made: the best and costliest castaways they started, a
 * benching that saved them points (or cost them some), and how the week moved them against the
 * league -- against the average and against 1st place (or 2nd, for the leader), never against a team
 * by name. Pure arithmetic over what the Scoreboard breakdown already shows: no AI, nothing stored.
 */
export function episodeTeamBullets(state: LeagueState, epId: string, playerId: string): TeamSummaryBullet[] {
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep) return [];
  const field = episodePlayerPoints(state, epId);
  const mine = field.find((f) => f.player.id === playerId);
  if (!mine) return [];

  // No "you scored N" line: the Net line already says how the week went against the league.
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

  // Left on the bench: only when starting them over your weakest starter would have gained points.
  const topBench = byTotal(benched, 1);
  const weakest = byTotal(started, -1);
  const gain = topBench && topBench.stats.total > 0 ? StateLogic.roundPoints(topBench.stats.total - (weakest?.stats.total ?? 0)) : 0;
  const missed = gain >= NOTABLE ? topBench : null;
  const costly = weakest && weakest.stats.total <= -NOTABLE ? weakest : null;
  if (costly) {
    // A better option sat on the bench: the call that cost the most, said once, here.
    const alt = missed ? ` while ${missed.c.name} scored ${fmt(missed.stats.total)} on your bench` : "";
    bullets.push({ kind: "costly", icon: "💀", text: `Started ${costly.c.name}${why(costly.stats, -1)}${alt}`, points: costly.stats.total });
  } else if (missed) {
    const instead = weakest ? `, ${gain} more than ${weakest.c.name}, who you started` : "";
    bullets.push({ kind: "benchMissed", icon: "🪑", text: `${missed.c.name} scored on your bench${why(missed.stats, 1)}${instead}`, points: missed.stats.total });
  }

  const saved = byTotal(benched, -1);
  if (saved && saved.stats.total <= -NOTABLE) {
    bullets.push({ kind: "benchSaved", icon: "🛡️", text: `Good call benching ${saved.c.name}${why(saved.stats, -1)}`, points: saved.stats.total });
  }

  bullets.push({ kind: "net", ...netLine(state, ep.number, playerId, field) });
  return bullets;
}

/** "+0.8 vs. league average · gained 2 on 1st place" -- the week against the field, then the race. */
function netLine(state: LeagueState, number: number, playerId: string, field: ReturnType<typeof episodePlayerPoints>) {
  const average = field.reduce((t, f) => t + f.points, 0) / field.length;
  const mine = field.find((f) => f.player.id === playerId)!;
  const vsAverage = Math.round((mine.points - average) * 10) / 10;
  const parts = [vsAverage === 0 ? "Right on the league average" : `${fmt(vsAverage)} vs. league average`];

  // The race as it stood after this episode (events plus graded predictions through it), and how
  // much this one week moved the gap. Through `number` only, so an older episode reads as it was
  // then, and the server never folds in a later episode the viewer hasn't seen.
  const players = field.map((f) => f.player.id);
  const through = (pid: string, upTo: number, from = 1) => totalThrough(state, pid, upTo, from);
  const standings = players.map((pid) => ({ pid, total: through(pid, number) })).sort((a, b) => b.total - a.total);
  if (standings.length > 1) {
    const leading = standings[0].total === through(playerId, number);
    const ref = leading ? standings.find((s) => s.pid !== playerId)! : standings[0];
    const moved = StateLogic.roundPoints(through(playerId, number, number) - through(ref.pid, number, number));
    if (leading) parts.push(moved > 0 ? `pulled ${moved} further ahead of 2nd` : moved < 0 ? `lead over 2nd shrank by ${-moved}` : "held your lead");
    else parts.push(moved > 0 ? `gained ${moved} on 1st place` : moved < 0 ? `fell ${-moved} further behind 1st` : "kept pace with 1st");
  }
  return { icon: vsAverage > 0 ? "📈" : vsAverage < 0 ? "📉" : "➖", text: parts.join(" · ") };
}

/** A player's scoring-event points plus graded prediction points, over episodes from..upTo. */
function totalThrough(state: LeagueState, playerId: string, upTo: number, from = 1) {
  let total = 0;
  for (const ep of state.episodes) {
    if (ep.number < from || ep.number > upTo) continue;
    total += episodePlayerPoints(state, ep.id).find((f) => f.player.id === playerId)?.points ?? 0;
  }
  if (state.settings.bonusEnabled) {
    total += playerBetRows(state, playerId)
      .filter((b) => b.episode >= from && b.episode <= upTo)
      .reduce((t, b) => t + b.points, 0);
  }
  return StateLogic.roundPoints(total);
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

/**
 * The prompt a player copies into any AI chat for their "why it mattered" line. Grounded in the
 * episode's own research summary (already written and stored by the weekly research run) when there
 * is one, so the sentence can say WHY -- not just restate the numbers.
 */
export function buildSummaryPrompt(bullets: TeamSummaryBullet[], episodeSummaryText: string | null, episodeNumber: number) {
  const lines = [
    `Write ONE sentence (20 words or fewer) on why this fantasy team's week went the way it did, in episode ${episodeNumber}.`,
    "",
    "Rules:",
    "- Plain, everyday words, as if explaining it out loud to a friend who has never seen the show.",
    '- No jargon, no made-up compound words (not "idol-less boot", say "voted out without an idol").',
    "- Do not name or mention any other fantasy team or player in the league.",
    "- Return only the sentence: no quotes, no preamble.",
  ];
  if (episodeSummaryText) lines.push("", "WHAT HAPPENED IN THE EPISODE:", episodeSummaryText);
  lines.push("", "THIS TEAM'S EPISODE:", ...bullets.map((b) => `- ${b.text}${b.points !== undefined ? ` (${fmt(b.points)})` : ""}`));
  return lines.join("\n");
}

function fmt(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
