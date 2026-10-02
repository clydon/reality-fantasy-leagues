// Computer players: seats a commissioner adds with "Computer player" ticked (player.automated). They
// draft, set lineups, make Eliminator Pool picks, take replenish/swap turns and fill in finale picks
// on their own, in every show and league type, using only what the league itself knows -- what each
// castaway has done in episodes with results (scored by the show's own catalog), who's been in the
// firing line, tribe numbers, who's holding an idol, a known Traitor. Nothing clever: the bar
// is "never makes an obvious mistake" (starting someone who's out, leaving a slot empty, picking the
// person everyone's been voting for), not "plays well".
//
// Pure like state-logic.js: no DB, no clock beyond what state-logic already reads. The server runs it
// after every league write and whenever someone loads a league with a bot move waiting
// (src/lib/server/bots.ts), so a bot's turn never sits waiting for a human to nudge it. Blind-draft
// submissions are the one move that can't be made here -- they live in their own table, never in
// `state` -- so blindSubmissions() only says what each bot WOULD lock in, and the server locks it.
//
// Plain CommonJS with a .d.ts beside it, like action-items.js, so a node script can require it too.
//
// Everything is deterministic: each bot has a small fixed "taste" per castaway (hashOf) to break ties
// and keep two bots from drafting identically, but no randomness, so running it twice on the same
// state does nothing the second time. That property is what lets the server check "is there a bot
// move waiting?" by running it on a copy.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const StateLogic = require("./state-logic.js");

const {
  Core, DraftLogic, BlindDraftLogic, ActiveRosterLogic, PickEmLogic, MidSeasonLogic,
  ReplenishLogic, TradeLogic, EpisodeLogic, FinaleLogic, getLeagueType, rosterSize, inPlay, hasAired,
  currentEpisode, finalePredictionsAvailable,
} = StateLogic;

// A seat the bot plays: flagged automated, and still in the game (a disabled or not-yet-activated
// seat can't act, same as a human's).
function isBot(player) {
  return !!player && player.automated === true && !player.disabled && player.active !== false;
}
function botIds(state) {
  return state.players.filter(isBot).map((p) => p.id);
}

// How sharp each bot plays (player.botLevel, set per seat in League Settings), so a league with a few
// of them has some variety. Every level avoids the structural mistakes -- nobody out of the game is
// ever started or picked, no slot is left empty, every move is a legal one. What changes:
//   read  -- how much weight it puts on the danger signals (votes, idols, tribe numbers, roles) rather
//            than on raw points
//   gut   -- how much its own fixed taste in castaways sways it; a casual player has favourites
//   swap  -- how much better a castaway on offer has to look before it swaps
const LEVELS = {
  casual: { read: 0.4, gut: 2.5, swap: 2 },
  solid: { read: 1, gut: 0.4, swap: 0.75 },
  sharp: { read: 1.4, gut: 0.1, swap: 0.4 },
};
const DEFAULT_LEVEL = "solid";
function levelOf(state, playerId) {
  const p = Core.getPlayer(state, playerId);
  return LEVELS[p && p.botLevel] || LEVELS[DEFAULT_LEVEL];
}

// FNV-1a over playerId|castawayId, scaled to [0, 1). Each bot's fixed preference among otherwise
// equal castaways, scaled by its level's gut.
function hashOf(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}
function taste(playerId, castawayId, level) {
  return hashOf(playerId + "|" + castawayId) * level.gut;
}

// ---- what the league knows about each castaway ----

// Episodes with results, newest first. Only these carry information.
function playedEpisodes(state) {
  return state.episodes.filter((ep) => EpisodeLogic.hasResults(ep)).sort((a, b) => b.number - a.number);
}
function isMerged(state) {
  const latest = [...state.episodes].sort((a, b) => b.number - a.number)[0];
  return !!(latest && latest.postMerge);
}

// What the bots read from each show's scoring events (formats/*.js), by event id. Ids don't collide in
// meaning across formats, so one table serves Survivor, The Traitors and The Challenge; a format added
// later with none of these ids still works, on form alone. Add its ids here to sharpen it.
const SIGNALS = {
  // In the firing line and lived: the likeliest to go next.
  danger: new Set(["survivedVotes", "survivedRoundTable", "nominatedSurvived", "accusedAtRoundTable", "onMurderShortlist", "consideredForMurder"]),
  // Safely with the numbers.
  safe: new Set(["zeroVotesSafe", "votedWithMajority", "votedOutTraitor", "zeroVotes"]),
  // Wins that make someone a target once they can't win their way out (after a merge).
  threat: new Set(["individualImmunity", "dailyWin", "eliminationWin"]),
  // Protection carried into the next vote, and what uses it up.
  protectionGained: new Set(["idolFound"]),
  protectionUsed: new Set(["idolPlayed", "votesNegated"]),
};

// How each tribe's numbers compare, pre-merge, in a show where tribes vote their own out (Survivor):
// being on the tribe that's down in numbers is the most reliable sign someone's in danger. Elsewhere
// (The Challenge's teams and pairs, The Traitors' none) group size says little, so it's left out.
function tribeEdges(state) {
  const edges = {};
  if (StateLogic.formatOf(state).id !== "survivor" || isMerged(state)) return edges;
  const sizes = {};
  state.castaways.forEach((c) => {
    if (c.status === "active" && c.tribeId) sizes[c.tribeId] = (sizes[c.tribeId] || 0) + 1;
  });
  const counts = Object.values(sizes);
  if (counts.length < 2) return edges;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  Object.keys(sizes).forEach((t) => { edges[t] = ((sizes[t] - mean) / mean) * 2; });
  return edges;
}

// One read over every played episode, with recent episodes counting most (each one back is worth 70%
// of the one after it): last week's vote matters more than week one's.
//   form   -- points per episode this league's scoring would have given them, recency-weighted
//   danger / safe / threat -- the SIGNALS above, recency-weighted
//   idols  -- protection found and not yet used
function profiles(state) {
  const out = {};
  state.castaways.forEach((c) => { out[c.id] = { form: 0, danger: 0, safe: 0, idols: 0, threat: 0 }; });
  const played = playedEpisodes(state);
  let weightSum = 0;
  played.forEach((ep, age) => {
    const w = Math.pow(0.7, age);
    weightSum += w;
    ActiveRosterLogic.episodeEvents(state, ep).forEach((ev) => {
      const p = out[ev.castawayId];
      if (!p) return;
      p.form += w * ActiveRosterLogic.pointsFor(state, ev.type);
      if (SIGNALS.danger.has(ev.type)) p.danger += w;
      if (SIGNALS.safe.has(ev.type)) p.safe += w;
      if (SIGNALS.threat.has(ev.type)) p.threat += w;
      if (SIGNALS.protectionGained.has(ev.type)) p.idols += 1;
      if (SIGNALS.protectionUsed.has(ev.type)) p.idols -= 1;
    });
  });
  if (weightSum > 0) Object.values(out).forEach((p) => { p.form /= weightSum; });
  return out;
}

// A secret role the league already knows about (The Traitors). Traitors are rarely banished early --
// the Faithful are busy suspecting each other -- so it counts toward safety. Roles reach a league with
// its episode results, so a bot only knows what the viewers have already seen.
function roleSafety(state, castawayId) {
  const role = StateLogic.RoleLogic.roleOf(state, castawayId);
  return role && /traitor/i.test(role) ? 0.8 : 0;
}

// Ratings for every castaway still in the game, as a bot of this level sees them.
//   safety -- how likely they are to survive the next vote (Eliminator Pool, Classic, finale picks)
//   points -- what they're likely to score next episode (Active Roster lineups)
//   value  -- what they're worth holding on a roster for this league's scoring
function ratings(state, level) {
  const read = (level || LEVELS[DEFAULT_LEVEL]).read;
  const prof = profiles(state);
  const edges = tribeEdges(state);
  const merged = isMerged(state);
  const activeRoster = !!getLeagueType(state).hasActiveRoster;
  const out = {};
  state.castaways.forEach((c) => {
    if (c.status !== "active") return;
    const p = prof[c.id];
    const signals = (edges[c.tribeId] || 0) + (p.idols > 0 ? 1.5 : 0) - 1.5 * p.danger + 0.3 * p.safe
      - (merged ? 0.4 * p.threat : 0) + roleSafety(state, c.id);
    const safety = 0.25 * p.form + read * signals;
    const points = p.form + 0.2 * safety;
    out[c.id] = { safety, points, value: activeRoster ? p.form + 0.5 * safety : safety };
  });
  return out;
}

// Best first, by one of the ratings plus this bot's taste. Castaways with no rating (out of the game)
// are dropped.
function ranked(state, playerId, castawayIds, key) {
  const level = levelOf(state, playerId);
  const r = ratings(state, level);
  return castawayIds
    .filter((id) => r[id])
    .map((id) => ({ id, score: r[id][key] + taste(playerId, id, level) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

// Draft picks also spread across tribes: before anyone has played, a roster that's all one tribe is
// the obvious mistake (one bad week for that tribe sinks the lot).
function draftOrderFor(state, playerId, candidateIds, alreadyMine) {
  const level = levelOf(state, playerId);
  const r = ratings(state, level);
  const tribeCount = {};
  alreadyMine.forEach((id) => {
    const c = Core.getCastaway(state, id);
    if (c && c.tribeId) tribeCount[c.tribeId] = (tribeCount[c.tribeId] || 0) + 1;
  });
  return candidateIds
    .filter((id) => r[id])
    .map((id) => {
      const c = Core.getCastaway(state, id);
      const spread = c && c.tribeId ? 0.6 * (tribeCount[c.tribeId] || 0) : 0;
      return { id, score: r[id].value + taste(playerId, id, level) - spread };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

// ---- moves ----

function snakeDraft(state) {
  if (state.settings.ownershipMode === "shared" || !getLeagueType(state).hasRoster) return 0;
  if (!DraftLogic.isStarted(state)) return 0;
  let made = 0;
  for (let guard = 0; guard < 500; guard++) {
    const turn = DraftLogic.currentTurn(state);
    if (!turn || turn.isComplete || !isBot(Core.getPlayer(state, turn.playerId))) break;
    const free = state.castaways.filter((c) => c.status === "active" && !(c.ownerIds || []).length).map((c) => c.id);
    const best = draftOrderFor(state, turn.playerId, free, Core.ownedCastawayIds(state, turn.playerId))[0];
    if (!best) break;
    const before = state.draftPicksMade;
    DraftLogic.pick(state, best);
    if (state.draftPicksMade === before) break;
    made++;
  }
  return made;
}

// What each bot would lock in for a blind draft that's open and waiting on it. The server does the
// locking (src/lib/server/bots.ts) since submissions are kept out of `state`.
function blindSubmissions(state) {
  if (!botIds(state).length) return [];
  if (state.settings.ownershipMode !== "shared" || !getLeagueType(state).hasRoster) return [];
  if (!DraftLogic.isStarted(state) || BlindDraftLogic.isRevealed(state)) return [];
  const size = rosterSize(state);
  const active = state.castaways.filter((c) => c.status === "active").map((c) => c.id);
  return botIds(state)
    .filter((pid) => !BlindDraftLogic.hasLocked(state, pid))
    .map((pid) => {
      // Greedy, so the tribe spread sees each earlier pick.
      const picks = [];
      for (let i = 0; i < size; i++) {
        const next = draftOrderFor(state, pid, active.filter((id) => !picks.includes(id)), picks)[0];
        if (!next) break;
        picks.push(next);
      }
      return { playerId: pid, castawayIds: picks };
    })
    .filter((s) => !BlindDraftLogic.validateSubmission(state, s.playerId, s.castawayIds));
}

function sameSet(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

// The best-scoring castaways still in the game, as many as there are slots. Re-set whenever that
// differs from what the bot would field now -- so an eliminated starter is replaced the moment the
// results land, not left as an empty slot.
function lineups(state) {
  if (!getLeagueType(state).hasActiveRoster) return 0;
  const ep = currentEpisode(state);
  if (!ep || !inPlay(state, ep.number) || ActiveRosterLogic.isLineupLocked(state, ep.id)) return 0;
  const slots = ActiveRosterLogic.activeSlots(state);
  if (!slots) return 0;
  let made = 0;
  botIds(state).forEach((pid) => {
    const mine = state.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(pid)).map((c) => c.id);
    if (!mine.length) return;
    const best = ranked(state, pid, mine, "points").slice(0, slots);
    const current = ActiveRosterLogic.lineupFor(state, ep.id, pid);
    if (!ActiveRosterLogic.lineupIsCarried(state, ep.id, pid) && sameSet(best, current)) return;
    if (ActiveRosterLogic.setLineup(state, ep.id, pid, best)) made++;
  });
  return made;
}

// Eliminator Pool: whoever looks safest of the people the cycle rule still allows.
function eliminatorPicks(state) {
  if (!getLeagueType(state).hasWeeklyPicks) return 0;
  const ep = currentEpisode(state);
  if (!ep || !inPlay(state, ep.number) || hasAired(ep) || PickEmLogic.decided(ep)) return 0;
  let made = 0;
  botIds(state).forEach((pid) => {
    const { available } = PickEmLogic.eligibility(state, ep.id, pid);
    const best = ranked(state, pid, available, "safety")[0];
    if (!best) return;
    const existing = PickEmLogic.pickFor(state, ep.id, pid);
    if (existing && existing.castawayId === best) return;
    PickEmLogic.setPick(state, ep.id, pid, best);
    const now = PickEmLogic.pickFor(state, ep.id, pid);
    if (now && now.castawayId === best) made++;
  });
  return made;
}

function replenishTurns(state) {
  let made = 0;
  for (let guard = 0; guard < 200; guard++) {
    const turn = state.midSeason && state.midSeason.replenish ? ReplenishLogic.currentTurn(state) : null;
    if (!turn || turn.isComplete || !isBot(Core.getPlayer(state, turn.playerId))) break;
    const candidates = MidSeasonLogic.availableFor(state, turn.playerId).map((c) => c.id);
    const best = ranked(state, turn.playerId, candidates, "value")[0];
    if (!best) break; // nobody left to take: the commissioner sorts it out, same as for a person
    const before = state.midSeason.replenish.index;
    ReplenishLogic.assign(state, best);
    if (state.midSeason.replenish.index === before) break;
    made++;
  }
  return made;
}

// A swap only when it's clearly better: the best castaway on offer has to beat the bot's weakest by a
// real margin (its level's `swap`), or it passes. Swapping for a coin-flip improvement is how you lose
// the person who was about to have a big week.
function tradeTurns(state) {
  let made = 0;
  for (let guard = 0; guard < 200; guard++) {
    const t = state.midSeason && state.midSeason.trade;
    if (!t || t.index >= t.queue.length) break;
    const pid = t.queue[t.index].playerId;
    if (!isBot(Core.getPlayer(state, pid))) break;
    const level = levelOf(state, pid);
    const r = ratings(state, level);
    const mine = state.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(pid)).map((c) => c.id);
    const offered = MidSeasonLogic.availableFor(state, pid).map((c) => c.id);
    const worst = ranked(state, pid, mine, "value").slice(-1)[0];
    const best = ranked(state, pid, offered, "value")[0];
    const before = t.index;
    if (worst && best && r[best].value - r[worst].value > level.swap) TradeLogic.swap(state, worst, best);
    if (state.midSeason.trade && state.midSeason.trade.index === before) TradeLogic.skip(state);
    made++;
  }
  return made;
}

// Finale picks, once there's something to go on: after the merge, or with ten or fewer left. Set once
// and left alone -- nothing locks finale picks, so a bot that kept "improving" them would end up
// picking the winner after the fact.
function finalePicks(state) {
  if (!finalePredictionsAvailable(state)) return 0;
  if (state.finaleActual && state.finaleActual.winner) return 0;
  const active = state.castaways.filter((c) => c.status === "active").map((c) => c.id);
  if (active.length < 3) return 0;
  if (!isMerged(state) && active.length > 10) return 0;
  if (!state.finalePredictions) state.finalePredictions = [];
  let made = 0;
  botIds(state).forEach((pid) => {
    const existing = (state.finalePredictions || []).find((f) => f.playerId === pid);
    if (existing && (existing.winner || (existing.top3 || []).some(Boolean))) return;
    const best = ranked(state, pid, active, "safety");
    FinaleLogic.setWinnerPick(state, pid, best[0]);
    best.slice(0, 3).forEach((id, i) => FinaleLogic.setPick(state, pid, i, id));
    made++;
  });
  return made;
}

// Every move any bot has waiting, applied to `state` in place. Returns how many it made (0 = nothing
// to do). Repeats until quiet, because one move can open another: a replenish pick changes what the
// best lineup is.
function run(state) {
  if (!botIds(state).length) return 0;
  let total = 0;
  for (let pass = 0; pass < 5; pass++) {
    const made = snakeDraft(state) + replenishTurns(state) + tradeTurns(state) + lineups(state) + eliminatorPicks(state) + finalePicks(state);
    total += made;
    if (!made) break;
  }
  return total;
}

// Whether any bot has a move waiting, without touching `state`.
function hasWork(state) {
  if (!botIds(state).length) return false;
  return blindSubmissions(state).length > 0 || run(structuredClone(state)) > 0;
}

module.exports = { LEVELS, DEFAULT_LEVEL, isBot, botIds, ratings, run, hasWork, blindSubmissions };
