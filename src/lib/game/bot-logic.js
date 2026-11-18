// Computer players: seats a commissioner adds with "Computer player" ticked (player.automated). They
// draft, set lineups, make Eliminator Pool picks, fill group slots, make waiver claims and fill in finale picks
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
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see above */
const StateLogic = require("./state-logic.js");
const Formats = require("./formats/index.js");
const Spec = require("./game-spec/index.js");
/* eslint-enable @typescript-eslint/no-require-imports */

const {
  Core, DraftLogic, BlindDraftLogic, AuctionLogic, BudgetLogic, PriceLogic, MarketLogic, ActiveRosterLogic, PickEmLogic, MidSeasonLogic,
  KeeperLogic, EpisodeLogic, FinaleLogic, GroupSlotLogic, KnockoutLogic, PoolLogic, piecesOf, inPlay, closedForPlay,
  currentEpisode, finalePredictionsAvailable, seasonWinner,
} = StateLogic;

// A seat the bot plays: flagged automated, and still in the game (a disabled or not-yet-activated
// seat can't act, same as a human's).
function isBot(player) {
  return !!player && player.automated === true && !player.disabled && player.active !== false;
}
// A seat playing live. One catching up in a game at its own pace (docs/PLAN-own-pace-games.md: StateLogic.GhostLogic.paceAll)
// plays its own week on its own copy instead, through catchUpTo: never the league's current episode, which on a finished
// season is long past and on a season it's behind on is weeks ahead of it.
function botIds(state) {
  return state.players.filter((p) => isBot(p) && !StateLogic.GhostLogic.isCatchingUp(state, p.id)).map((p) => p.id);
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

// What the bots read from each show's moments: their tags (formats/moment-tags.js), which every show's rules carry
// as data, so any show gets them:
//   danger            in the firing line and lived: the likeliest to go next
//   safe              safely with the numbers
//   threat            wins that make someone a target once they can't win their way out (after a merge)
//   protectionGained  protection carried into the next vote, and protectionUsed what uses it up
// A show whose moments have none of these still works, on form alone.

// How each tribe's numbers compare, pre-merge, in a show where tribes vote their own out (Survivor: a vote one group
// goes to at a time, the format's groupVotes): being on the tribe that's down in numbers is the most reliable sign
// someone's in danger. Elsewhere (The Challenge's teams and pairs, The Traitors' none) group size says little, so it's
// left out.
function tribeEdges(state) {
  const edges = {};
  if (!Formats.groupVotesOf(StateLogic.formatOf(state)).length || isMerged(state)) return edges;
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
//   danger / safe / threat -- the moments' tags above, recency-weighted
//   idols  -- protection found and not yet used
function profiles(state) {
  const out = {};
  state.castaways.forEach((c) => { out[c.id] = { form: 0, danger: 0, safe: 0, idols: 0, threat: 0 }; });
  const played = playedEpisodes(state);
  const tagsOf = Formats.momentTags(StateLogic.formatOf(state));
  let weightSum = 0;
  played.forEach((ep, age) => {
    const w = Math.pow(0.7, age);
    weightSum += w;
    ActiveRosterLogic.episodeEvents(state, ep).forEach((ev) => {
      const p = out[ev.castawayId];
      if (!p) return;
      p.form += w * ActiveRosterLogic.eventPoints(state, ev);
      const tags = tagsOf(ev.type);
      if (tags.includes("danger")) p.danger += w;
      if (tags.includes("safe")) p.safe += w;
      if (tags.includes("threat")) p.threat += w;
      if (tags.includes("protectionGained")) p.idols += 1;
      if (tags.includes("protectionUsed")) p.idols -= 1;
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
  const activeRoster = !!piecesOf(state).hasActiveRoster;
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

/** The league a draft reads: at your own pace, the cast as it stood before the game's start; else the league itself. */
function draftCopy(state) {
  if (!StateLogic.GhostLogic.ownPace(state)) return state;
  const start = StateLogic.startEpisode(state) ?? 1;
  return StateLogic.SpoilerLogic.viewThrough(state, Math.max(0, start - 1));
}

function snakeDraft(state) {
  // A blind draft's bots lock in (blindSubmissions), an auction's bid (auctionBids); a draw's deals itself (no turn comes up).
  if (BlindDraftLogic.on(state) || !piecesOf(state).hasRoster) return 0;
  if (!DraftLogic.isStarted(state)) return 0;
  let made = 0;
  for (let guard = 0; guard < 500; guard++) {
    const turn = DraftLogic.currentTurn(state);
    if (!turn || turn.isComplete || !isBot(Core.getPlayer(state, turn.playerId))) break;
    // A game at your own pace drafts together at its start (docs/PLAN-own-pace-games.md, sync point 1): on the cast as it stood
    // before it, never the season's later statuses (on a finished season only the winner is still in).
    const on = draftCopy(state);
    // G3 part 3b: only those in the game's pool (PoolLogic), as the pick takes them.
    const inPool = PoolLogic.test(state);
    const free = on.castaways.filter((c) => c.status === "active" && !(c.ownerIds || []).length && inPool(c.id)).map((c) => c.id);
    // A draft spread across the cast's groups (step A10 part 3) or under a salary cap (part 3b): only who keeps the team spread
    // and within it, read over every free agent as the pick's own checks read it (else whoever keeps it that this list lacks).
    const fits = StateLogic.draftFitsFor(on, turn.playerId);
    const mine = free.filter((id) => fits.includes(id));
    const best = draftOrderFor(on, turn.playerId, mine.length ? mine : fits, Core.ownedCastawayIds(state, turn.playerId))[0];
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
  if (!BlindDraftLogic.on(state) || !piecesOf(state).hasRoster) return [];
  if (!DraftLogic.isStarted(state) || BlindDraftLogic.isRevealed(state)) return [];
  // G3 part 3b: only those in the game's pool (PoolLogic).
  const active = PoolLogic.offered(state).map((c) => c.id);
  return botIds(state)
    .filter((pid) => !BlindDraftLogic.hasLocked(state, pid) && BlindDraftLogic.eligiblePlayers(state).some((p) => p.id === pid))
    .map((pid) => {
      // Greedy, so the tribe spread and a salary cap (step A10 part 3b) see each earlier pick; the places its keepers leave
      // (part 4), beside them.
      const keep = KeeperLogic.keptIds(state, pid);
      const size = KeeperLogic.places(state, pid);
      const picks = [];
      for (let i = 0; i < size; i++) {
        const next = draftOrderFor(state, pid, StateLogic.draftFits(state, [...keep, ...picks], active.filter((id) => !picks.includes(id) && !keep.includes(id))), picks)[0];
        if (!next) break;
        picks.push(next);
      }
      return { playerId: pid, castawayIds: picks };
    })
    .filter((s) => !BlindDraftLogic.validateSubmission(state, s.playerId, s.castawayIds));
}

// What each bot would bid in an auction that's open and waiting on it (step A10 part 3b): its favourites by its own ratings, a
// team's worth and as many again as backups, as a sheet (AuctionLogic.sheetFor: the budget over the team it wants by rank, the
// backups at the lowest price). The server locks them in (src/lib/server/bots.ts), since bids are kept out of `state`.
function auctionBids(state) {
  if (!botIds(state).length || !AuctionLogic.on(state) || !piecesOf(state).hasRoster) return [];
  if (!DraftLogic.isStarted(state) || !AuctionLogic.ready(state)) return [];
  // G3 part 3b: only those in the game's pool (PoolLogic).
  const free = PoolLogic.offered(state).filter((c) => !(c.ownerIds || []).length).map((c) => c.id);
  return botIds(state)
    .filter((pid) => !AuctionLogic.hasLocked(state, pid))
    // Step A10 part 4: a sheet for the places its keepers leave.
    .map((pid) => ({ playerId: pid, bids: AuctionLogic.sheetFor(state, draftOrderFor(state, pid, free, []).slice(0, KeeperLogic.places(state, pid) * 2), pid) }))
    .filter((x) => !AuctionLogic.validateBids(state, x.playerId, x.bids));
}

function sameSet(a, b) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

// The best-scoring castaways still in the game, as many as there are slots. Re-set whenever that
// differs from what the bot would field now -- so an eliminated starter is replaced the moment the
// results land, not left as an empty slot.
function lineups(state) {
  if (!piecesOf(state).hasActiveRoster) return 0;
  const ep = currentEpisode(state);
  if (!ep || !inPlay(state, ep.number) || ActiveRosterLogic.isLineupLocked(state, ep.id)) return 0;
  const slots = ActiveRosterLogic.activeSlots(state);
  if (!slots) return 0;
  let made = 0;
  // Step A11 part 1: nobody knocked out of the game sets one (validateLineup would refuse it).
  const outs = StateLogic.KnockoutLogic.outs(state);
  botIds(state).forEach((pid) => {
    if (!outs.has(pid)) made += lineupFor(state, ep, pid, slots);
  });
  return made;
}
// One bot's lineup (and captain) for `ep`, on `state`: the league's, or a catching-up bot's own copy (catchUpTo).
function lineupFor(state, ep, pid, slots) {
  const mine = state.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(pid)).map((c) => c.id);
  if (!mine.length) return 0;
  // Cast properties (chunk 5): the best lineup the slots take (a QB in the QB slot), else the top `slots`.
  const best = StateLogic.SlotLogic.best(state, ranked(state, pid, mine, "points"), slots);
  const current = ActiveRosterLogic.lineupFor(state, ep.id, pid);
  // A game with a captain (A9 part 2): the best of them wears it.
  const captainOk = !ActiveRosterLogic.captainTimes(state) || ActiveRosterLogic.captainFor(state, ep.id, pid) === best[0];
  if (!ActiveRosterLogic.lineupIsCarried(state, ep.id, pid) && sameSet(best, current) && captainOk) return 0;
  let set = ActiveRosterLogic.setLineup(state, ep.id, pid, best);
  if (ActiveRosterLogic.captainTimes(state) && ActiveRosterLogic.setCaptain(state, ep.id, pid, best[0])) set = true;
  return set ? 1 : 0;
}

// Group slots (docs/PLAN-start-a-game-gpt.md step A10 part 1; computer players fill them since A11 part 5c): a slot with nothing in
// it for the episode (never picked, or its group has ended) takes the group on offer whose people it rates best (their likely
// points, on average, as its lineup reads them, plus its own taste), before the episode locks. A slot riding with its group is
// left as it is (validatePick refuses a swap while it lasts unless the game allows them, and a bot never chases one), and an
// exclusive opening's group someone else holds is passed over for the next best. Nothing on offer (the show isn't divided going
// in, or that's not sure and the game voids it): the slot stays empty, as a person's would.
function groupSlotPicks(state) {
  const cfg = GroupSlotLogic.config(state);
  if (!cfg) return 0;
  const ep = currentEpisode(state);
  if (!ep || !inPlay(state, ep.number) || ActiveRosterLogic.isLineupLocked(state, ep.id)) return 0;
  const ix = GroupSlotLogic.index(state);
  const offer = GroupSlotLogic.offered(state, ep.number, ix);
  if (!offer.groups.length) return 0;
  const outs = KnockoutLogic.outs(state);
  let made = 0;
  botIds(state).forEach((pid) => {
    // Knocked out, or a team with nobody on it (a bot with no castaways scores nothing, as its lineup does).
    if (outs.has(pid) || !Core.ownedCastawayIds(state, pid).length) return;
    const level = levelOf(state, pid);
    const r = ratings(state, level);
    // Each group's people's likely points on average, worked out once.
    const rate = new Map(offer.groups.map((g) => {
      const people = g.members.filter((m) => r[m]);
      return [g.id, people.length ? people.reduce((n, m) => n + r[m].points + taste(pid, m, level), 0) / people.length : -Infinity];
    }));
    const best = [...offer.groups].sort((a, b) => rate.get(b.id) - rate.get(a.id) || (a.id < b.id ? -1 : 1));
    for (let slot = 0; slot < cfg.slots; slot++) {
      const st = GroupSlotLogic.standing(state, pid, slot, ep.number, ix);
      if (st.pick && st.status !== "dropped") continue;
      const g = best.find((x) => !GroupSlotLogic.validatePick(state, ep.id, pid, slot, x.id));
      if (g && GroupSlotLogic.setPick(state, ep.id, pid, slot, g.id)) made++;
    }
  });
  return made;
}

// Eliminator Pool: whoever looks safest of the people the cycle rule still allows. A pool's second pick (step A10 part 2): the
// next safest beside it. Someone out of a pool with lives has nobody to pick (eligibility).
function eliminatorPicks(state) {
  if (!piecesOf(state).hasWeeklyPicks) return 0;
  const ep = currentEpisode(state);
  if (!ep || !inPlay(state, ep.number) || closedForPlay(ep) || PickEmLogic.decided(ep, state)) return 0;
  let made = 0;
  botIds(state).forEach((pid) => { made += eliminatorPickFor(state, ep, pid); });
  return made;
}
// One bot's pick (and a pool's second) for `ep`, on `state`: the league's, or a catching-up bot's own copy (catchUpTo).
function eliminatorPickFor(state, ep, pid) {
  const parts = PickEmLogic.parts(state);
  let made = 0;
  const { available } = PickEmLogic.eligibility(state, ep.id, pid);
  // C5: a pick scored by what they do takes whoever looks likeliest to score, as many as the game picks each episode.
  if (PickEmLogic.byMoments(state)) {
    const want = ranked(state, pid, available, "points").slice(0, Math.max(1, StateLogic.gameOf(state).get.each || 1));
    if (!want.length) return 0;
    const had = PickEmLogic.picked(PickEmLogic.pickFor(state, ep.id, pid));
    if (had.length === want.length && had.every((id, i) => id === want[i])) return 0;
    PickEmLogic.setPick(state, ep.id, pid, want[0], { picks: want });
    return PickEmLogic.picked(PickEmLogic.pickFor(state, ep.id, pid))[0] === want[0] ? 1 : 0;
  }
  const order = ranked(state, pid, available, "safety");
  const best = order[0];
  if (!best) return 0;
  const existing = PickEmLogic.pickFor(state, ep.id, pid);
  if (!existing || existing.castawayId !== best) {
    PickEmLogic.setPick(state, ep.id, pid, best);
    const now = PickEmLogic.pickFor(state, ep.id, pid);
    if (now && now.castawayId === best) made++;
  }
  const next = order[1];
  const now = PickEmLogic.pickFor(state, ep.id, pid);
  if (parts && parts.second && next && now && now.castawayId === best && now.second !== next) {
    PickEmLogic.setPick(state, ep.id, pid, next, { second: true });
    if (PickEmLogic.pickFor(state, ep.id, pid).second === next) made++;
  }
  return made;
}

// A game at your own pace (docs/PLAN-own-pace-games.md): computer players catch up as people do, one episode at a time. Run
// when someone reveals episode `n` (reveal.ts markRevealed, under the league lock): every bot still behind it plays each week
// up to `n` on the copy a late joiner at that mark sees (StateLogic.GhostLogic.applyAs: nothing past the week exists in it, so
// a bot never reads ahead), then its mark is `n`. A bot already past `n` (someone else revealed further) does nothing.
// Deterministic like run(): a second call changes nothing. Survival Pool's pick, and a Weekly Lineup's lineup (part 3a).
function catchUpTo(state, n) {
  const G = StateLogic.GhostLogic;
  let made = 0;
  state.players.filter(isBot).forEach((p) => {
    const lj = p.lateJoin;
    if (!lj || !lj.catchingUp || !Number.isInteger(lj.seenThrough)) return;
    while (lj.seenThrough < n) {
      const week = lj.seenThrough + 1;
      const ep = state.episodes.find((e) => e.number === week);
      if (ep) {
        G.applyAs(state, p.id, lj.seenThrough, ep.id, (view) => {
          const vEp = view.episodes.find((e) => e.number === week);
          if (!vEp || !inPlay(view, week) || closedForPlay(vEp) || PickEmLogic.decided(vEp, view)) return;
          if (piecesOf(view).hasWeeklyPicks) made += eliminatorPickFor(view, vEp, p.id);
          if (piecesOf(view).hasActiveRoster && !ActiveRosterLogic.isLineupLocked(view, vEp.id)) {
            const slots = ActiveRosterLogic.activeSlots(view);
            if (slots) made += lineupFor(view, vEp, p.id, slots);
          }
        });
      }
      lj.seenThrough = week;
      G.markCaughtUp(state, p.id, week);
    }
  });
  return made;
}

// A bot's claim for a waiver week (docs/PLAN-midseason-waivers.md, PLAN-waivers-v2.md), made when the
// week processes: claims live outside `state` (they're private), so the server asks for this rather
// than run() making it. Ranked pairs, as anyone's: replacements are the best free agents on offer, each
// for any loss it could replace; a swap only drops one of its weakest still in for a free agent who
// clearly beats them by a real margin (its level's `swap`): swapping for a coin-flip improvement is how
// you lose the person who was about to have a big week. Kept within the week's limit on adds.
function waiverClaim(state, playerId, period) {
  const W = StateLogic.WaiverLogic;
  // C4: whom each kind of move can bring in (a replacement's, a swap's), as the game's waivers hold them.
  const offeredFor = (kind) => MidSeasonLogic.availableFor(state, playerId, kind).map((c) => c.id);
  const owed = W.replacementsOwed(state, playerId, period);
  const swapsLeft = W.swapsLeft(state, period, playerId);
  const cap = owed.count + swapsLeft + 2;
  const pairs = [];
  const adds = new Set();
  // A salary cap (step A10 part 3b): only pairs that keep the team within it (or no further over), at today's prices. A stock
  // market (part 3c): only pairs their cash covers, so a swap buys whom they rate above what their sale brings in.
  const prices = BudgetLogic.priced(state) ? PriceLogic.prices(state) : null;
  const push = (addId, dropId) => {
    if (prices && BudgetLogic.moveProblem(state, playerId, dropId, addId, prices)) return;
    if (!adds.has(addId) && adds.size >= cap) return;
    adds.add(addId);
    pairs.push({ addId, dropId });
  };
  // A stock market (part 3c): of those they rate, only the ones the sale pays for, the best of them (the best overall would be
  // the dearest, refused for want of cash), so a castaway whose price has run ahead of how they rate them pays for one who hasn't.
  const market = MarketLogic.on(state);
  const affords = (a, d) => !market || !MarketLogic.moveProblem(state, playerId, d, a, prices);
  if (owed.count) {
    const reps = ranked(state, playerId, offeredFor("replace"), "value");
    if (market) owed.outIds.forEach((d) => reps.filter((a) => affords(a, d)).slice(0, owed.count + 2).forEach((a) => push(a, d)));
    else reps.slice(0, owed.count + 2).forEach((a) => owed.outIds.forEach((d) => push(a, d)));
  }
  if (swapsLeft > 0) {
    const level = levelOf(state, playerId);
    const r = ratings(state, level);
    const mine = state.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(playerId)).map((c) => c.id);
    const best = ranked(state, playerId, offeredFor("swap"), "value");
    ranked(state, playerId, mine, "value")
      .reverse()
      .slice(0, swapsLeft)
      .forEach((drop) => best.filter((id) => r[id].value - r[drop].value > level.swap && affords(id, drop)).slice(0, 3).forEach((a) => push(a, drop)));
  }
  return { pairs };
}

// Finale picks, once there's something to go on: after the merge, or with ten or fewer left. Set once
// and left alone -- a bot that kept "improving" them would end up picking the winner after the fact.
// Never once the results have a winner (they settle the finale, step A4), nor while this week's episode is on: picks lock
// when the season's last episode starts (the routes' finale lock), and this week's could be it.
function finalePicks(state) {
  if (!finalePredictionsAvailable(state)) return 0;
  if (seasonWinner(state)) return 0;
  const week = currentEpisode(state);
  if (week && closedForPlay(week)) return 0;
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
// to do). Repeats until quiet, because one move can open another: a finished draft opens lineups.
function run(state) {
  // Any computer player: one catching up at your own pace still drafts with everyone (snakeDraft reads its turn).
  if (!state.players.some(isBot)) return 0;
  let total = 0;
  for (let pass = 0; pass < 5; pass++) {
    const made = snakeDraft(state) + lineups(state) + groupSlotPicks(state) + eliminatorPicks(state) + finalePicks(state);
    total += made;
    if (!made) break;
  }
  return total;
}

// A game at your own pace with teams (docs/PLAN-own-pace-games.md part 3a): each computer player with none picks its own from who
// was in before its start, on what was known then (ratings on that copy, the tribe spread and any cap as a draft's), then
// GhostLogic.pickTeam. Returns how many teams it picked.
function paceTeams(state) {
  const G = StateLogic.GhostLogic;
  let made = 0;
  state.players.filter((p) => isBot(p) && G.needsTeam(state, p.id)).forEach((p) => {
    const start = p.lateJoin.startEpisode;
    const view = StateLogic.SpoilerLogic.viewThrough(state, Math.max(0, start - 1));
    const pool = G.draftPool(state, start, !G.sharedJoin(state));
    const size = Math.min(G.teamSize(state), pool.length);
    const picks = [];
    for (let i = 0; i < size; i++) {
      const next = draftOrderFor(view, p.id, StateLogic.draftFits(view, picks, pool.filter((id) => !picks.includes(id))), picks)[0];
      if (!next) break;
      picks.push(next);
    }
    if (!G.pickTeam(state, p.id, picks)) made++;
  });
  return made;
}

// Whether any bot has a move waiting, without touching `state`.
function hasWork(state) {
  if (!state.players.some(isBot)) return false;
  return blindSubmissions(state).length > 0 || auctionBids(state).length > 0 || run(structuredClone(state)) > 0;
}

// ---- answers to a game's own questions (docs/PLAN-start-a-game-redo.md E1b) ----
//
// A game of questions keeps its answers in game_answers, outside `state` (like blind-draft lock-ins), so this only says what each
// computer player WOULD answer and the server writes it (bots.ts). For each bot playing live, each question open now (this
// episode's window, or one asked once while it's still open) it hasn't answered: an answer the engine itself accepts
// (Spec.answerProblem), from what the league knows. Who goes home: the one most in danger; who wins, scores most, does it first: the
// best rated; yes or no, a number, over or under, a choice: its taste for that question that episode, a sharp player leaning to
// what usually happens (no, the low count). Deterministic like the rest: run twice, the second run has nothing to add.
//
// The kinds it answers; the rest (an order, confidence, chips, pairs, a split, trivia, a side, a bracket, a ticket, a stake from a
// bank, a card's lines, Weekly Calls) wait, and the gallery says so (start-gallery/index.js botsFit keeps the same list).
const ANSWERS = Spec.BOT_ANSWERS;
/** Whether a computer player answers this question (the spec's one rule: game-spec answers.js botAnswers). */
const answersQuestion = (q) => Spec.botAnswers(q);
/** Whether computer players play every question this game asks that's kept outside its state (a draft's finale picks are
 *  finalePicks'): none, a game with no questions of its own. */
function answersAll(state) {
  return StateLogic.AnswerLogic.questions(state).filter((q) => !Spec.isCalls(q) && !inState(state, q)).every(answersQuestion);
}
/** The questions a computer player answers into game_answers (bots.ts reads the table only for a game that has one). */
function answeredQuestions(state) {
  return StateLogic.AnswerLogic.questions(state).filter((q) => !Spec.isCalls(q) && answersQuestion(q) && !inState(state, q));
}
// The finale picks a draft keeps in its state (top3, winner): finalePicks plays those.
function inState(state, q) {
  return !!StateLogic.finaleOfGame(state) && (q.id === "top3" || q.id === "winner");
}
function answerFor(state, playerId, q0, faces, ep) {
  // A wager (E1b's second slice): its answer is the question's own; its stake is added where what it may stake is known (staked).
  const q = q0.wager !== undefined && q0.answer !== "ticket" ? Spec.unwagered(q0) : q0;
  const level = levelOf(state, playerId);
  const ids = faces.map((f) => f.id);
  const feel = (key) => hashOf(`${playerId}|${q.id}|${ep}|${key}`);
  // Who it names first: going home (who goes home, a boot order, ranked by who's likeliest to go), else doing well (who wins, scores,
  // a leaderboard). By the league's own ratings, with its taste.
  const st = q.settle || {};
  const goes = st.take === "out" || (st.by === "results" && st.take === "order");
  let rate = null;
  const scoreOf = (id) => {
    rate = rate || ratings(state, level);
    const r = rate[id];
    const base = r ? (goes ? -r.safety : r.points) : 0;
    return base + taste(playerId, `${q.id}|${id}`, level) * 2;
  };
  const ranked = (list) => list.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
  if (Spec.NAMES.includes(q.answer)) {
    if (!ids.length) return null;
    const best = ranked(ids);
    const n = Math.max(1, Math.min(q.pick || 1, best.length));
    return n === 1 ? best[0] : best.slice(0, n);
  }
  // An order or confidence (E1b's second slice): everyone still in, likeliest first, up to its count.
  if (Spec.RANKS.includes(q.answer)) return ids.length ? ranked(ids).slice(0, Math.max(1, Math.min(q.pick || ids.length, ids.length))) : null;
  // Chips: a sharp one puts most on its first choice, an easy one spreads them.
  if (q.answer === "chips") {
    const total = Number.isInteger(q.chips) && q.chips > 0 ? q.chips : 0;
    if (!ids.length || !total) return null;
    const shares = level.read >= LEVELS.sharp.read ? [0.7, 0.3] : level.read >= LEVELS.solid.read ? [0.5, 0.3, 0.2] : [0.25, 0.25, 0.25, 0.25];
    const best = ranked(ids).slice(0, shares.length);
    const out = {};
    let left = total;
    best.forEach((id, i) => {
      const n = i === best.length - 1 ? left : Math.min(left, Math.round(total * shares[i]));
      if (n > 0) out[id] = n;
      left -= n;
    });
    return Object.keys(out).length ? out : { [best[0]]: total };
  }
  // Who outlasts whom: in each pair, whoever's still in and safer (Spec.pairsFrom, the pairs everyone gets).
  if (q.answer === "pairs") {
    const pairs = Spec.pairsFrom(q, StateLogic.AnswerLogic.startIn(state));
    if (!pairs.length) return null;
    const inNow = new Set(ids);
    const r = ratings(state, level);
    const lasts = (id) => (inNow.has(id) ? 1000 : 0) + (r[id] ? r[id].safety : 0) + taste(playerId, `${q.id}|${id}`, level) * 2;
    return Object.fromEntries(pairs.map((p) => [Spec.pairKey(p), lasts(p[0]) >= lasts(p[1]) ? p[0] : p[1]]));
  }
  // A ticket: its fewest legs, picked by its taste from the questions it's built of (all of them its own answers: stakeAll answers
  // them first).
  if (q.answer === "ticket") {
    const t = Spec.ticketOf(q);
    if (!t) return null;
    return { legs: t.of.slice().sort((a, b) => feel(`leg|${a}`) - feel(`leg|${b}`)).slice(0, t.min) };
  }
  // A jury's split: a guess sized to the cast (a jury of about half of who's left after the final three), lopsided for a sharp one.
  if (q.answer === "split") {
    const jury = Math.max(3, Math.round(((state.castaways || []).length - 3) / 2));
    const shapes = [[jury - 2, 2], [jury - 1, 1], [jury], [jury - 3, 3], [jury - 3, 2, 1], [jury - 4, 3, 1]].map((s) => s.filter((n) => n > 0));
    return shapes[Math.floor(feel("split") * (level.read >= LEVELS.sharp.read ? 3 : shapes.length))];
  }
  // A sharp player leans hardest to what usually happens (nothing; the low end), a normal one less, an easy one goes on its gut.
  const lean = level.read >= LEVELS.sharp.read ? 0.25 : level.read >= LEVELS.solid.read ? 0.35 : 0.5;
  if (q.answer === "yesNo") return feel("yn") < lean ? "yes" : "no";
  if (q.answer === "overUnder") return feel("ou") < lean ? "over" : "under";
  if (q.answer === "choice") {
    const opts = (q.options || []).map((o) => (o && typeof o === "object" ? (o.id !== undefined ? o.id : o.label) : o));
    if (!opts.length) return null;
    const i = Math.min(opts.length - 1, Math.floor(feel("ch") * (feel("lo") < lean ? opts.length : Math.ceil(opts.length / 2))));
    return opts[i];
  }
  // A count: the low end for a sharp one (things rarely happen twice), wider for an easy one.
  if (q.answer === "number") return [1, 0, 2, 3][Math.floor(feel("n") * (level.read >= LEVELS.solid.read ? 2 : 4))];
  return null;
}
/** A stake's share of what it may stake: an easy one bets big, a sharp one small. */
const stakeShare = (level) => (level.read >= LEVELS.sharp.read ? 0.2 : level.read >= LEVELS.solid.read ? 0.3 : 0.5);
/** A question's answer with its stake (E1b's second slice): a wager's { answer, stake }, a ticket's { legs, stake }, a share of what it
 *  may stake (`most`); null when that can't be read (drawn from points as they stand, with no room given). */
function staked(q, value, level, most) {
  if (q.wager === undefined) return value;
  if (most === null) return null;
  const stake = Math.floor(most * stakeShare(level));
  return q.answer === "ticket" ? { ...value, stake } : { answer: value, stake };
}
/** The most a seat may stake on `q` in a window (`key`): a wager of house points, up to it; one drawn from its points or a bank
 *  (Spec.drawsOnBank), what's left of them as they stand (`room`: { points, held }, as answers.ts reads a person's), less what this
 *  run stakes elsewhere (`staking`); null with no room. */
function mostFor(state, q, key, room, staking) {
  const cap = Number.isInteger(q.wager) ? q.wager : Infinity;
  if (!Spec.drawsOnBank(q, Spec.bankOf(StateLogic.gameOf(state)))) return Number.isFinite(cap) ? cap : null;
  if (!room) return null;
  return Math.min(cap, Spec.stakeMost(room.points, room.held, key, staking));
}
/** Tickets last: a ticket's legs are its own answers, made first. */
const ticketsLast = (qs) => [...qs.filter((q) => q.answer !== "ticket"), ...qs.filter((q) => q.answer === "ticket")];
/** Whether any question it answers is staked from points or a bank: the server reads each seat's room for those (bots.ts). */
function stakesPoints(state) {
  const bank = Spec.bankOf(StateLogic.gameOf(state));
  return answeredQuestions(state).some((q) => Spec.drawsOnBank(q, bank));
}
/** One answer, checked as a person's is: its stake added, against who it can name, rank or pair, and what it may stake. */
function oneAnswer(state, pid, q, ep, room, staking) {
  const AL = StateLogic.AnswerLogic;
  const faces = AL.faces(state, q, { playerId: pid });
  const key = `${q.id}|${ep}`;
  const most = q.wager === undefined ? null : mostFor(state, q, key, room, staking);
  const value = staked(q, answerFor(state, pid, q, faces, ep), levelOf(state, pid), most);
  if (value === null || value === undefined) return null;
  if (Spec.answerProblem(q, value, faceSet(state, q, faces), most === null ? undefined : { most })) return null;
  if (q.wager !== undefined && Spec.drawsOnBank(q, Spec.bankOf(StateLogic.gameOf(state)))) staking.set(key, value.stake);
  return value;
}
/** What an answer is checked against, as answers.ts checks a person's: who it can name or rank or put chips on (still in), each pair's
 *  "pair:who"; nothing for the rest. */
function faceSet(state, q0, faces) {
  const q = q0.wager !== undefined && q0.answer !== "ticket" ? Spec.unwagered(q0) : q0;
  if (Spec.NAMES.includes(q.answer) || Spec.RANKS.includes(q.answer) || q.answer === "chips") return new Set(faces.map((f) => f.id));
  if (q.answer === "pairs") return new Set(Spec.pairsFrom(q, StateLogic.AnswerLogic.startIn(state)).flatMap((p) => p.map((id) => `${Spec.pairKey(p)}:${id}`)));
  return undefined;
}
/**
 * The answers computer players would give now: [{ playerId, question, episode, answer }] for each bot seat playing live and each
 * question open to answer it hasn't (`stored`: the game's answer rows, { playerId, question, episode }). `o.now` (ms), `o.finale`
 * (the season's last episode, for a question open until it).
 */
function answers(state, stored, o) {
  const opt = o || {};
  const AL = StateLogic.AnswerLogic;
  const qs = ticketsLast(answeredQuestions(state));
  const bots = botIds(state);
  if (!qs.length || !bots.length) return [];
  const have = new Set((stored || []).map((r) => `${r.playerId}|${r.question}|${r.episode}`));
  const now = AL.episodeNow(state);
  const out = [];
  for (const pid of bots) {
    const staking = new Map();
    for (const q of qs) {
      const ep = q.asked === "once" ? 0 : AL.windowAt(state, q, now);
      if (ep === null || ep === undefined || have.has(`${pid}|${q.id}|${ep}`)) continue;
      if (AL.closed(state, q, ep, { now: opt.now, finale: opt.finale })) continue;
      const value = oneAnswer(state, pid, q, ep, opt.rooms ? opt.rooms.get(`${pid}|live`) : null, staking);
      if (value === null) continue;
      out.push({ playerId: pid, question: q.id, episode: ep, answer: value });
    }
  }
  return out;
}

/**
 * At your own pace (E1b's second slice): the answers each computer player catching up gives as it reaches each week, through the
 * week after `n` (null: its own mark; so its next week's answers are in before anyone opens it), each on its own copy as it stood
 * before that week (GhostLogic.viewFor at the week before: that week's results unseen), so nothing it answers knows the outcome.
 * Call before catchUpTo moves them on (bots.ts catchUpBots), and after every write for their next week (answerForBots).
 */
function catchUpAnswers(state, stored, n, rooms) {
  const G = StateLogic.GhostLogic;
  const AL = StateLogic.AnswerLogic;
  const qs = ticketsLast(answeredQuestions(state));
  if (!qs.length) return [];
  const have = new Set((stored || []).map((r) => `${r.playerId}|${r.question}|${r.episode}`));
  const out = [];
  catchUpWeeks(state, n).forEach(({ playerId: pid, week }) => {
    let view = null;
    const staking = new Map();
    for (const q of qs) {
      // Already answered (the usual case after the first time): no copy to make.
      if (have.has(`${pid}|${q.id}|${q.asked === "once" ? 0 : week}`)) continue;
      view = view || G.viewFor(state, pid, week - 1);
      const ep = q.asked === "once" ? 0 : AL.windowAt(view, q, week, week - 1);
      if (ep === null || ep === undefined || (q.asked !== "once" && ep !== week)) continue;
      const key = `${pid}|${q.id}|${ep}`;
      if (have.has(key) || AL.closed(view, q, ep, { mark: week - 1, player: pid })) continue;
      const value = oneAnswer(view, pid, q, ep, rooms ? rooms.get(`${pid}|${week - 1}`) : null, staking);
      if (value === null) continue;
      have.add(key);
      out.push({ playerId: pid, question: q.id, episode: ep, answer: value });
    }
  });
  return out;
}
/** The weeks each computer player catching up answers for, through the week after `n` (null: its own mark): [{ playerId, week }],
 *  each on its copy as of week - 1 (catchUpAnswers; and the server reads each one's room to stake there: bots.ts). */
function catchUpWeeks(state, n) {
  const G = StateLogic.GhostLogic;
  const aired = new Set(state.episodes.map((e) => e.number));
  const out = [];
  state.players.filter((p) => isBot(p) && G.isCatchingUp(state, p.id)).forEach((p) => {
    const lj = p.lateJoin;
    if (!lj || !Number.isInteger(lj.seenThrough)) return;
    const to = Math.max(Number.isInteger(n) ? n : lj.seenThrough, lj.seenThrough) + 1;
    for (let week = lj.seenThrough + 1; week <= to && aired.has(week); week++) out.push({ playerId: p.id, week });
  });
  return out;
}

module.exports = { LEVELS, DEFAULT_LEVEL, isBot, botIds, ratings, run, hasWork, catchUpTo, paceTeams, blindSubmissions, auctionBids, waiverClaim, groupSlotPicks, ANSWERS, answersQuestion, answersAll, answeredQuestions, answers, catchUpAnswers, catchUpWeeks, stakesPoints };
