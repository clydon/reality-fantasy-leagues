// The names people call games by (the bold pass, docs/design-round/wizard-r2b-spec.md §2; the user, 2026-11-18: "ensure all game
// types are possible and intuitive to create (it's okay to repeat yourself in the UI because the engine we developed to a human
// understandable game isn't always a one to one)"). Kept here, beside the bold pass's screens, so Round 2's gallery stays as it was
// for the user's comparison; carried into the catalog if the pass is kept.

import { SPORT_AKA } from "./sport";

/** What fans also call a base: said once on its screen ("Also called …") and read by search. */
export const AKA: Record<string, string[]> = {
  fantasy: ["season-long league", "weekly lineup", "redraft league"],
  h2h: ["matchups", "head-to-head fantasy"],
  outlast: ["draft and watch", "survivor draft"],
  bestball: ["draft and forget", "no lineups"],
  auction: ["salary auction", "bidding draft"],
  cap: ["salary cap", "daily fantasy", "DFS"],
  market: ["stocks", "buy low, sell high"],
  guillotine: ["elimination league", "chopping block"],
  reverse: ["worst team wins", "boot draft"],
  hat: ["random draft", "sweepstake", "office pool"],
  spread: ["one per tribe", "one from each group"],
  keeper: ["dynasty", "keepers"],
  onemoment: ["crying draft", "single-moment draft"],
  pool: ["survivor pool", "eliminator pool", "last man standing"],
  lives: ["survivor pool with lives", "second chance pool"],
  norepeat: ["never twice pool", "use each once"],
  picks: ["pick of the week", "weekly pick"],
  objectives: ["missions", "challenges"],
  confidence: ["confidence pool", "ranked picks"],
  sheet: ["prediction game", "picks sheet", "who goes home"],
  seasonpred: ["preseason picks", "winner pick", "final three"],
  bootorder: ["boot list", "elimination order"],
  most: ["who cries most", "over the season"],
  calls: ["calls", "episode picks"],
  overunder: ["over under", "totals"],
  pairs: ["head to head picks", "who lasts longer"],
  split: ["jury vote", "final vote"],
  quote: ["title quote", "who says it"],
  seal: ["lock your winner", "early winner pick"],
  bank: ["betting game", "bankroll", "wagers"],
  props: ["props", "prop sheet", "side bets"],
  parlay: ["parlay ticket", "multi"],
  pot: ["split pot", "pick pot"],
  double: ["all in", "double up"],
  jackpot: ["rollover", "carry over"],
  h2hpicks: ["pick'em head to head", "duel"],
  teams: ["team vs team", "tribes"],
  race: ["first to", "race"],
  coop: ["co-op", "together", "beat the show"],
  twovone: ["2 v 1", "handicap match"],
  bingo: ["bingo cards", "drinking game card"],
  trivia: ["quiz", "pub quiz", "recap quiz"],
  bingotrivia: ["bingo and quiz"],
  livecalls: ["live picks", "in-play"],
  traitors: ["mafia", "werewolf", "secret roles"],
  host: ["question master", "game master"],
  majority: ["family feud", "guess the room"],
  bounty: ["vote steal", "bounty hunter"],
  twist: ["power up", "chaos"],
  solo: ["just me", "practice", "single player"],
  beatbot: ["vs the computer", "beat the AI"],
  vsbot: ["computer player", "bot player"],
  minis: ["mini games", "variety"],
  halves: ["pre and post merge", "two leagues"],
  redraft: ["redraft", "shake-up draft"],
  twoshows: ["crossover", "two seasons"],
};

/** One meaning per name (the writer spike's collisions, docs/PLAN-local-game-writer.md): a base's or a change's name in the bold
 *  pass. Parlay is the same word as the change that makes one, on purpose. */
export const NAMES: Record<string, string> = {
  props: "Prop bets",
  parlay: "Parlay",
  "change:card": "A new card each episode",
  "change:parlay": "Parlay",
};
export const baseName = (id: string, name: string) => NAMES[id] ?? name;
export const changeName = (id: string, name: string) => NAMES[`change:${id}`] ?? name;

/** More shelves: a base also listed where a person would look for it (beside the catalog's own `also`). */
export const SHELVES: Record<string, string[]> = {
  solo: ["pool", "lives", "beatbot"],
  party: ["bingo", "majority"],
  pools: ["h2hpicks"],
  predict: ["beatbot", "confidence"],
};

/** Each category's lead game: the one drawn with the season, first that plays here. */
export const LEADS: Record<string, string[]> = {
  fantasy: ["fantasy", "outlast", "bestball", "sp-league", "sp-game-draft", "ev-season"],
  pools: ["pool", "picks", "lives", "sp-pickem-team", "sp-pickem", "ev-winner"],
  predict: ["sheet", "calls", "seasonpred", "sp-props", "sp-bracket", "ev-top"],
  bets: ["bank", "props", "pot", "sp-squares", "sp-bank"],
  versus: ["h2h", "h2hpicks", "teams", "sp-h2h-pickem", "sp-weeks"],
  quiz: ["bingo", "trivia"],
  party: ["traitors", "majority", "host"],
  solo: ["beatbot", "solo"],
  season: ["halves", "redraft", "minis"],
};

/** A story show's leads (the spec's story column): nobody's playing to stay, so its pools pick who scores and its predictions are the
 *  show's own calls; its party is the couch guessing each other. */
export const STORY_LEADS: Record<string, string[]> = {
  pools: ["picks", "objectives", "pool"],
  predict: ["calls", "sheet", "seasonpred"],
  party: ["majority", "host", "traitors"],
};

/** Search: the catalog's own words, then what fans call it; `aka` is the fan's name that matched, said on the square. */
export function searchKnown<B extends { id: string; name: string; plain: string; about: string }>(q: string, bases: B[]): { base: B; score: number; aka: string | null }[] {
  const STOP = new Set(["a", "an", "the", "to", "of", "and", "or", "for", "with", "on", "in", "we", "i", "my", "our", "game", "games", "lets", "let's", "play"]);
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const ws = words(q);
  const phrase = q.trim().toLowerCase();
  if (!ws.length) return [];
  const out: { base: B; score: number; aka: string | null }[] = [];
  for (const b of bases) {
    const name = words(baseName(b.id, b.name)).join(" ");
    const aka = [...(AKA[b.id] ?? []), ...(SPORT_AKA[b.id] ?? [])].map((a) => a.toLowerCase());
    const hay = [name, b.plain.toLowerCase(), b.about.toLowerCase(), ...aka].join(" ");
    let score = 0;
    let matched: string | null = null;
    for (const w of ws) {
      if (name.split(" ").includes(w)) score += 6;
      else if (aka.some((a) => a.split(/\s+/).includes(w))) {
        score += 5;
        matched = matched ?? aka.find((a) => a.split(/\s+/).includes(w)) ?? null;
      } else if (hay.includes(w)) score += 2;
    }
    if (phrase.length > 3 && (name.includes(phrase) || aka.some((a) => a.includes(phrase)))) {
      score += 12;
      if (!name.includes(phrase)) matched = aka.find((a) => a.includes(phrase)) ?? matched;
    }
    if (score) out.push({ base: b, score, aka: name.split(" ").some((w) => ws.includes(w)) ? null : matched });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

/** What people call a change (Find a change reads them beside its name and line). */
export const CHANGE_AKA: Record<string, string> = {
  matchups: "h2h versus vs matchup duel",
  captain: "double captain star",
  knockouts: "elimination cut chop guillotine lowest out",
  standing: "lives life second chance",
  race: "first to target",
  coop: "co-op together team up",
  bank: "bankroll betting wager money",
  side: "side bets prop",
  stake: "wager stake bet",
  pot: "split share pot",
  jackpot: "rollover carry over",
  repeat: "never twice same pick again",
  second: "two picks double pick",
  cap: "salary budget price",
  market: "trade buy sell stocks",
  waivers: "pickups free agents add drop",
  keepers: "dynasty keep",
  redraft: "redraft new draft merge",
  shakeup: "redraft swap",
  traitors: "mafia werewolf secret",
  bootcall: "boot who goes home vote",
  reverse: "worst flip upside down",
  only: "big moments only some",
  what: "points scoring place",
  teams: "teams tribes sides",
  solo: "alone single player just me",
  bot: "computer ai bot",
  hidden: "secret lineups hidden",
  room: "draft time when",
  size: "how many each team size roster",
  draft: "snake order auction draft",
};
