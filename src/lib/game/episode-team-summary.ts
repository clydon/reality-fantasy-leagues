import type { Castaway, LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { episodePlayerPoints, rosterAtEpisode, castawayEpisodeStats } from "./active-roster-rows";
import { playerBetRows } from "./bet-rows";

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
