// Survivor 51's cast through Episode 4, from the mock (the showcase export of the real season, .impeccable/mocks/showcase:
// tribes, who left when, points per episode, and what the research recorded each episode). The Cast explorer and
// Tonight's stats card read it (step 3 counts the real thing from season_decisions, through the guard), and the show
// space's other fixtures borrow its people and photos. Real castaways of a public TV season, never app users.
import { castPhoto } from "./people";

export const STEP = "3";

/** The fixture's reader is on Episode 4; Episode 5 is next. */
export const SEEN = 4;

/** The fixture reader's Outlast team (first names): the explorer's "Your team" tag. */
export const YOUR_TEAM = ["Kristin", "Mike", "Jenna", "Eric"];
export const EPISODES = 13;

/** The tribes, in the mock's colours (tribes never fill a yellow button: they're colour chips). */
export const TRIBES: Record<string, string> = { Toka: "#ffd700", Savu: "#9b6bd0", Dina: "#f3214a" };

export interface CastMember {
  name: string;
  first: string;
  /** The tribe they started on (How it works' faces), and the one they're on now (the explorer's groups). */
  start: string;
  tribe: string;
  /** The episode they left in, and how. */
  out: number | null;
  how: string | null;
  perEp: number[];
  /** [episode, what the research recorded]. */
  events: [number, string][];
  photo: string;
}

const RAW: Omit<CastMember, "first" | "photo">[] = [
  { name: "Aaliyah Puglia", start: "Toka", tribe: "Toka", out: 1, how: "Voted Out", perEp: [-2, 0, 0, 0], events: [[1, "idolPlayed"], [1, "Voted Out"]] },
  { name: "Brady Booker", start: "Toka", tribe: "Toka", out: null, how: null, perEp: [4, 5, 6.5, 5], events: [[1, "zeroVotesSafe"], [1, "votedWithMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedAgainstMajority"], [3, "idolFound"], [3, "zeroVotesSafe"], [3, "learnedOfAdvantage"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Danny Kilby", start: "Toka", tribe: "Dina", out: null, how: null, perEp: [2, 5, 4, 5], events: [[1, "zeroVotesSafe"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedWithMajority"], [3, "survivedVotes"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Devin Way", start: "Toka", tribe: "Savu", out: null, how: null, perEp: [1.5, 5, 6.5, 4], events: [[1, "zeroVotesSafe"], [1, "votedAgainstMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedAgainstMajority"], [3, "idolFound"], [3, "zeroVotesSafe"], [3, "learnedOfAdvantage"], [3, "wentOnJourney"], [4, "votedWithMajority"], [4, "zeroVotesSafe"]] },
  { name: "Jelly Loblack", start: "Toka", tribe: "Savu", out: null, how: null, perEp: [1.5, 9, 1.5, 4], events: [[1, "zeroVotesSafe"], [1, "votedAgainstMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [2, "idolFound"], [3, "votedAgainstMajority"], [3, "zeroVotesSafe"], [4, "votedWithMajority"], [4, "zeroVotesSafe"]] },
  { name: "Jenna Doore", start: "Toka", tribe: "Savu", out: 4, how: "Voted Out", perEp: [4, 5, 4, -4], events: [[1, "idolPlayed"], [1, "survivedVotes"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedWithMajority"], [3, "zeroVotesSafe"], [4, "Voted Out"]] },
  { name: "Lewis Kelly", start: "Toka", tribe: "Dina", out: null, how: null, perEp: [0, 5, 5, 5], events: [[2, "tribeImmunity"], [2, "rewardWin"], [3, "votedWithMajority"], [3, "zeroVotesSafe"], [3, "learnedOfAdvantage"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Maggie Nestor", start: "Toka", tribe: "Toka", out: null, how: null, perEp: [4, 5, 5, 5], events: [[1, "zeroVotesSafe"], [1, "votedWithMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedWithMajority"], [3, "zeroVotesSafe"], [3, "learnedOfAdvantage"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Mike Pinsky", start: "Toka", tribe: "Toka", out: null, how: null, perEp: [4, 5, 1.5, 5], events: [[1, "zeroVotesSafe"], [1, "votedWithMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedAgainstMajority"], [3, "zeroVotesSafe"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Patt Cannaday", start: "Toka", tribe: "Toka", out: 3, how: "Voted Out", perEp: [4, 6, -4, 0], events: [[1, "zeroVotesSafe"], [1, "votedWithMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [2, "learnedOfAdvantage"], [3, "Voted Out"]] },
  { name: "Thien An Nguyen", start: "Toka", tribe: "Toka", out: null, how: null, perEp: [4, 5, 4, 4.5], events: [[1, "zeroVotesSafe"], [1, "votedWithMajority"], [2, "tribeImmunity"], [2, "rewardWin"], [3, "votedWithMajority"], [3, "zeroVotesSafe"], [4, "tribeImmunity"], [4, "rewardWin"], [4, "satOut"]] },
  { name: "Alexis Levine", start: "Savu", tribe: "Savu", out: null, how: null, perEp: [3, 4, 5, 4], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedWithMajority"], [3, "tribeImmunity"], [3, "rewardWin"], [4, "votedWithMajority"], [4, "survivedVotes"]] },
  { name: "Ana Sani", start: "Savu", tribe: "Savu", out: 2, how: "Voted Out", perEp: [3, -4, 0, 0], events: [[1, "tribeImmunity"], [2, "Voted Out"]] },
  { name: "Carter Krull", start: "Savu", tribe: "Toka", out: null, how: null, perEp: [3, 1.5, 5, 5], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedAgainstMajority"], [3, "votedWithMajority"], [3, "zeroVotesSafe"], [3, "learnedOfAdvantage"], [3, "wentOnJourney"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Cristian Chavez", start: "Savu", tribe: "Dina", out: null, how: null, perEp: [3, 4, 5, 5], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedWithMajority"], [3, "tribeImmunity"], [3, "rewardWin"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Eric Macksoud", start: "Savu", tribe: "Dina", out: null, how: null, perEp: [3, 5, 5, 4.5], events: [[1, "tribeImmunity"], [2, "votedWithMajority"], [2, "survivedVotes"], [2, "learnedOfAdvantage"], [3, "tribeImmunity"], [3, "rewardWin"], [4, "tribeImmunity"], [4, "rewardWin"], [4, "satOut"]] },
  { name: "Kristin Flickinger", start: "Savu", tribe: "Toka", out: null, how: null, perEp: [3, 4, 5, 5], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedWithMajority"], [3, "tribeImmunity"], [3, "rewardWin"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Linnea Capobianco", start: "Savu", tribe: "Dina", out: null, how: null, perEp: [3, 4, 5, 5], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedWithMajority"], [3, "tribeImmunity"], [3, "rewardWin"], [4, "tribeImmunity"], [4, "rewardWin"]] },
  { name: "Ori Jean-Charles", start: "Savu", tribe: "Savu", out: null, how: null, perEp: [3, 1.5, 6, 4], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedAgainstMajority"], [3, "tribeImmunity"], [3, "rewardWin"], [3, "learnedOfAdvantage"], [4, "votedWithMajority"], [4, "zeroVotesSafe"]] },
  { name: "Rob Antonson", start: "Savu", tribe: "Savu", out: 3, how: "Quit", perEp: [7, 1.5, -8, 0], events: [[1, "tribeImmunity"], [1, "idolFound"], [2, "zeroVotesSafe"], [2, "votedAgainstMajority"], [3, "Quit"]] },
  { name: "Sharonda Cox", start: "Savu", tribe: "Dina", out: null, how: null, perEp: [3, 4, 6, 5], events: [[1, "tribeImmunity"], [2, "zeroVotesSafe"], [2, "votedWithMajority"], [3, "tribeImmunity"], [3, "rewardWin"], [3, "learnedOfAdvantage"], [4, "tribeImmunity"], [4, "rewardWin"]] },
];

export const CAST: CastMember[] = RAW.map((c) => ({ ...c, first: c.name.split(" ")[0], photo: castPhoto("survivor-51", c.name) }));

export const castaway = (first: string) => CAST.find((c) => c.first === first)!;

/** Every stat the explorer ranks by, full names (imported shows name stats freely, so no abbreviations): points
 *  first, then the research's own counts. A stat can count several events (Most votes against). */
export const STATS: { key: string; events: string[]; name: string; unit: string }[] = [
  { key: "pts", events: [], name: "Points", unit: "points" },
  { key: "majority", events: ["votedWithMajority"], name: "Voted with the majority", unit: "times" },
  { key: "clean", events: ["zeroVotesSafe"], name: "Never written down", unit: "tribals, no votes against" },
  { key: "against", events: ["survivedVotes", "Voted Out"], name: "Most votes against", unit: "tribals with votes against them" },
  { key: "survived", events: ["survivedVotes"], name: "Survived votes against", unit: "times" },
  { key: "immunity", events: ["tribeImmunity"], name: "Tribe immunity wins", unit: "wins" },
  { key: "reward", events: ["rewardWin"], name: "Reward wins", unit: "wins" },
  { key: "idols", events: ["idolFound"], name: "Idols found", unit: "idols" },
  { key: "minority", events: ["votedAgainstMajority"], name: "Voted against the majority", unit: "times" },
  { key: "learned", events: ["learnedOfAdvantage"], name: "Learned of an advantage", unit: "times" },
  { key: "journey", events: ["wentOnJourney"], name: "Went on a journey", unit: "times" },
  { key: "satOut", events: ["satOut"], name: "Sat out a challenge", unit: "times" },
];

/** What a recorded event is called, for a castaway's story. */
export const EVENT_NAME: Record<string, string> = {
  votedWithMajority: "Voted with the majority",
  zeroVotesSafe: "Never written down",
  survivedVotes: "Survived votes against",
  tribeImmunity: "Tribe immunity win",
  rewardWin: "Reward win",
  idolFound: "Found an idol",
  idolPlayed: "Played an idol",
  votedAgainstMajority: "Voted against the majority",
  learnedOfAdvantage: "Learned of an advantage",
  wentOnJourney: "Went on a journey",
  satOut: "Sat out a challenge",
  "Voted Out": "Voted out",
  Quit: "Quit",
};

/** A stat's value for one castaway over Episodes from..to. */
export function statValue(c: CastMember, key: string, from = 1, to = SEEN): number {
  if (key === "pts") return c.perEp.slice(from - 1, to).reduce((a, b) => a + (b || 0), 0);
  const events = STATS.find((s) => s.key === key)?.events ?? [];
  return c.events.filter(([ep, k]) => ep >= from && ep <= to && events.includes(k)).length;
}

/** Everyone with at least one of a stat up to your episode, most first (someone still in before someone out). */
export function statBoard(key: string) {
  return CAST.map((c) => ({ c, n: statValue(c, key), out: c.out && c.out <= SEEN ? c.out : 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || Number(!!a.out) - Number(!!b.out));
}

/** "1 time", "2 times": a unit's first word loses its s for one. */
export const unitFor = (unit: string, n: number) => (n === 1 ? unit.replace(/^(\w+?)s\b/, "$1") : unit);
