// Forked from the live app repo (SurvivorDraft/shared/state-logic.js) -- started as a verbatim
// copy (see git history), but now diverges to support this repo's own league-type/show system
// (LEAGUE_TYPES/SHOWS below), which the live vanilla-JS app has no concept of and never will.
// The live repo is untouched by this fork; there is no sync in either direction anymore. This
// file is imported as `StateLogic` via state-logic.d.ts's ambient types (see that file).
//
// Pure game logic for Survivor Draft League — no DOM, no localStorage, no network.
// Loaded both by the browser (<script src="/shared/state-logic.js">, defines window.StateLogic)
// and by the Node server (require('../../shared/state-logic.js')).
// Every function takes `state` as its first argument instead of closing over a global.
//
// Organized as one class per game-logic domain (Core, ScoringLogic, DraftLogic, RosterLogic,
// ReplenishLogic, TradeLogic, EpisodeLogic, BetLogic, FinaleLogic, Migrations). This is
// deliberately still ONE FILE, not one-file-per-class: the browser loads this via a plain
// <script> tag with no bundler, so a real multi-file split would need either `require()` (which
// doesn't exist in that context) or a generated/concatenated bundle (which creates an ongoing
// "forgot to regenerate before committing" drift risk between what the server runs and what the
// browser fetches, every single time this file changes). Classes-in-one-file gets the same
// organizational win — clear domain boundaries, `DraftLogic.currentTurn(state)`-style
// discoverability — with none of that risk. All exported functions are still exact 1:1 aliases
// to class statics, so no existing call site (public/app.js, every server route) needs to change.
//
// Adding a new game-logic feature: add a static method to the relevant class below (or a new
// class for a genuinely new domain), then add its alias in the `return {...}` block at the
// bottom. Cross-domain calls are plain `OtherClass.method(state, ...)` — see ReplenishLogic
// calling ScoringLogic, or RosterLogic calling DraftLogic, for the existing pattern.
//
// League types: DraftLogic and ScoringLogic below are thin dispatchers, not the real
// implementations -- they read `state.settings.leagueTypeId`, look it up in LEAGUE_TYPES, and
// delegate to that entry's `draftStrategy`/`scoringStrategy`. LEAGUE_TYPES has two entries today:
// 'classic-draft' (EliminationOrderScoringStrategy, a real roster draft) and 'pickem'
// (NoDraftStrategy + PickEmScoringStrategy -- no roster, no draft at all; see PickEmLogic for the
// actual weekly-pick mechanic, which is NOT behind this dispatch since it doesn't fit the
// DraftStrategy shape below, per the note two sentences down).
//
// One league type can carry more than one draft mechanic: 'classic-draft' resolves to
// SnakeDraftStrategy or BlindDraftStrategy depending on `settings.ownershipMode`
// ('exclusive'/'shared'), which getLeagueType applies as an override -- see CLASSIC_DRAFT_SHARED.
// Call sites still just read getLeagueType(state) and never need to know ownershipMode exists.
//
// Adding a further league type means: write a new strategy class implementing the same static
// method shape as SnakeDraftStrategy (syncOrder/currentTurn/isStarted/forceStart/reorder/move/
// pick/undo) and/or EliminationOrderScoringStrategy (compute) -- or reuse NoDraftStrategy as-is if
// the new type has no draft either -- register it under a new LEAGUE_TYPES key, and set
// supportsReplenish/supportsTrade/supportsFinalePredictions/hasRoster/hasWeeklyPicks for whether
// those features apply to it. ReplenishLogic/TradeLogic deliberately are NOT behind this dispatch
// yet -- they're mid-season features of the current league type, gated by those three support
// flags, not an independently-varying axis on their own. A "weekly pick'em" league (no persistent
// roster, no turn-based picks at all) almost certainly won't fit the DraftStrategy shape above --
// don't force it in; that's why 'pickem' gets NoDraftStrategy (an inert stand-in so nothing that
// dispatches through DraftLogic crashes) plus its own top-level state branch (PickEmLogic,
// `episode.picks`) instead of a real third DraftStrategy pretending to be turn-based.
//
// Show formats: a league's game vocabulary -- exit methods, the scoring-event catalog, what ends the
// season -- comes from its show's format (./formats/, docs/PLAN-show-formats.md) via formatOf(state),
// never from a constant in here. The format id is cached on the league as settings.showFormat when its
// show is picked (and a stored format's data as settings.showFormatData), because this file can't read
// the database.
(function(root, factory){
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./formats/index.js'));
  else root.StateLogic = factory(root.GameFormats);
})(typeof self !== 'undefined' ? self : this, function(Formats){

const PALETTE = ['#45a89a','#d9704a','#a76bb0','#5089c4','#86a34c','#c99a3e','#b0563f','#6b8fc9'];
// No longer seeded into new leagues (see Migrations.defaultState) -- a fresh league starts with an
// empty cast so it isn't pre-filled with the wrong show's people. Kept as sample data.
const SEED_CASTAWAYS = ['Aaliyah','Alexis','Ana','Brady','Carter','Cristian','Devin','Eric','Jelly','Jenna','Kilby','Kristin','Lewis','Linnea','Maggie','Mike','Ori','Patt','Rob','Sharonda','Thien An'];

// The rules this league plays by. A league with no showFormat (every league from before formats, and
// a new one whose show isn't picked yet) gets the registry's default, which is Survivor's. A show on a
// stored format (one an admin approved from a research proposal, db/show-formats.js) also caches the
// format's data as settings.showFormatData; a built-in format ignores it.
//
// A league's own ruleset copy (settings.leagueRulesetData, db/league-rulesets.js) wins over all of
// that when present -- a commissioner's fork, forever ahead of whatever the show's format does next.
//
// On top of whichever base that is go the season rule changes this league's commissioner adopted
// (settings.adoptedRuleChanges, docs/PLAN-season-rule-changes.md): additive, and gated by episode, so
// nothing before a change's effective episode scores differently. A league with none -- every league
// until one is adopted -- gets the base itself, untouched.
function formatOf(state){
  const s = state && state.settings ? state.settings : {};
  const base = s.leagueRulesetData
    ? Formats.formatForRuleset(s.leagueRulesetData)
    : Formats.formatFor(s.showFormat || null, s.showFormatData || null);
  const adopted = s.adoptedRuleChanges;
  if(!Array.isArray(adopted) || !adopted.length) return base;
  try { return Formats.withChanges(base, adopted); }
  catch(e){
    // Adopting validates a change against this league's base, so this means the base moved under it
    // (an edited ruleset copy). Scoring by the base alone beats a league that won't load; the adopt
    // screen reports the change as not fitting.
    if(typeof console !== 'undefined') console.error('season rule changes not applied:', e && e.message);
    return base;
  }
}

// The episode this league starts playing at (settings.startEpisode, default 1). A league formed
// mid-season -- "we've all watched episode 1, we'll draft before episode 2" -- starts at 2: earlier
// episodes are history everyone has seen, so they're shown but nothing in them scores, and no picks
// or lineups are made for them.
function startEpisode(state){
  const n = Number(state && state.settings ? state.settings.startEpisode : 1);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
function inPlay(state, episodeNumber){ return episodeNumber >= startEpisode(state); }

// Whether an episode has started airing: ep.airsAt is stamped by the server from the season's
// schedule (src/lib/server/air-times.ts) and absent when there's no schedule or the league is
// catching up -- then nothing is "aired" by the clock, only by its results.
function hasAired(ep, now){ return !!(ep && ep.airsAt) && (now || Date.now()) >= Date.parse(ep.airsAt); }

// The most recent in-play episode that has actually aired/been logged (EpisodeLogic.hasResults) --
// what a Replenish or Swap made "now" is really tied to: the episode whose results just created the
// opening (an elimination) or window (an active-roster upgrade), not some future episode number that
// may not even exist yet. Null before anything has happened. Used to stamp MidSeasonLogEntry.episode
// (ReplenishLogic.assign / TradeLogic.swap) so the transaction history can show "Episode N" instead
// of a bare timestamp.
function lastCompletedEpisode(state){
  const played = [...state.episodes].filter(e => inPlay(state, e.number) && EpisodeLogic.hasResults(e)).sort((a,b) => b.number - a.number);
  return played.length ? played[0].number : null;
}

// The episode "this week's choice" is being made for -- Eliminator Pool's pick, Active Roster's
// lineup, Overview's side bets: the next one to reveal when catching up, otherwise the latest, but
// never before the league's own start episode (a league set to start later picks/fields for that
// one first). One shared definition so all three agree on which episode is "now".
function currentEpisode(state){
  const number = Math.max(BetLogic.upcomingEpisodeNumber(state), startEpisode(state));
  return state.episodes.find(e => e.number === number) || null;
}

// Reads a castaway object's owner list, tolerating a castaway that predates the field. Kept
// module-private: the filter predicates below already hold the castaway object, so going through
// Core.ownersOf (which looks it up by id) would be pointless indirection -- see the ownership
// comment in Core for which call sites are expected to use the helpers instead.
function ownerListOf(c){ return (c && c.ownerIds) || []; }
function leagueGhostOwners(state, c){ const g = ghostIdSet(state); return ownerListOf(c).filter(id => g.has(id)); }

// Late joiners (GhostLogic, docs/PLAN-late-joiners.md): a ghost's team lives in ownerIds like anyone
// else's, but it's private -- the rest of the league never sees it -- so it must never take a castaway
// off the board for them. Exclusivity ("is this castaway free?") asks about the league's own players
// only; scoring and "is this mine?" keep reading ownerListOf as before.
function isGhost(p){ return !!(p && p.ghost); }
function ghostIdSet(state){ return new Set((state.players || []).filter(isGhost).map(p => p.id)); }
function leagueOwnersOf(state, c){
  const ghosts = ghostIdSet(state);
  return ownerListOf(c).filter(id => !ghosts.has(id));
}
// Taking part in the league's shared mechanics: draft order, blind-draft lock-ins, pickup and swap
// rounds. Ghosts play their own season alongside, so they're left out of all of these.
function inLeagueRotation(p){ return !!p && !p.disabled && p.active !== false && !isGhost(p); }

// The castaways a player originally drafted, whatever happened to them since. Derived rather than
// stored: every acquisition that ISN'T the draft (replenish, trade) is written to midSeason.log with
// the castaway it added and the one it dropped, so a player's first logged move for a castaway says
// how they came to hold it -- a drop first means they already had it, i.e. drafted it; an add first
// means they didn't. Castaways a player still holds with nothing logged were drafted too (draft,
// blind-draft reveal and activatePlayer are the only unlogged ways to gain one). The old
// acquiredVia/formerOwnerId pair can't answer this: both are overwritten by the next move.
function originalDraftPicks(state, playerId){
  const first = {};
  ((state.midSeason && state.midSeason.log) || []).forEach(tx => {
    if(tx.playerId !== playerId) return;
    if(tx.droppedCastawayId && !(tx.droppedCastawayId in first)) first[tx.droppedCastawayId] = 'drop';
    if(tx.addedCastawayId && !(tx.addedCastawayId in first)) first[tx.addedCastawayId] = 'add';
  });
  return (state.castaways||[]).filter(c =>
    first[c.id] ? first[c.id] === 'drop' : ownerListOf(c).includes(playerId));
}

// ---------- Core: id generation + basic entity lookups, used by every other class ----------
// Names as compared, never as displayed: accents folded ('Thiên' -> 'thien'), punctuation and
// quotes turned into separators ('Kimberly "Kilby" K.' -> 'kimberly kilby k'), case dropped,
// whitespace collapsed. Wiki tables and hand-typed names disagree about all three, and none of
// those disagreements should be able to lose a castaway. See Core.findCastawayByName.
function normalizeName(name){
  return String(name == null ? '' : name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

class Core {
  static uid(prefix){ return prefix+'_'+Math.random().toString(36).slice(2,9); }
  static getPlayer(state, id){ return state.players.find(p=>p.id===id); }
  // Resolves a name FROM THE WIKI to a castaway in this league.
  //
  // Needed because the wiki is inconsistent about which name it prints where: the cast table gives
  // full names ("Bruce Perreault"), but the episode guide and the vote table's own cells give first
  // names only ("Bruce"). An import keyed on exact names would match nothing at all from those two.
  //
  // Returns {castaway} on a confident match, {ambiguous:[names]} when a first name fits more than one
  // castaway, or {} when nothing fits. Ambiguity is reported rather than resolved -- picking one of
  // two people named Matt is the kind of quiet guess that lands wrong data in a scored league.
  // Resolves a name from OUTSIDE this league -- a wiki table, a commissioner's typing -- to one of
  // its castaways. Returns {castaway}, {ambiguous:[names]}, or {} for no match.
  //
  // Tried in tiers, most exact first, and a tier that matches more than one person REFUSES rather
  // than picking: the wiki prints short names in its vote tables and two castaways can share one, so
  // a coin flip here would silently score the wrong person.
  //
  // The tiers exist because of what the wiki actually does. Its cast table gives a full name
  // ('Kimberly "Kilby" Kilbourne', 'Thien An Nguyen') while its vote grid and episode guide use
  // whatever the show calls that person on screen ('Kilby', 'Thien An'). The old version had one
  // fallback -- a single word matched against first names only -- so a nickname that isn't the first
  // name, a two-word short name, and any name whose accents differ between the two tables all failed
  // outright, and an unmatched name used to fail the whole import.
  static findCastawayByName(state, name){
    const wanted = normalizeName(name);
    if(!wanted) return {};
    const cast = state.castaways || [];
    const wantedTokens = wanted.split(' ');

    // Each tier returns as soon as it finds anything at all -- one match wins, several are ambiguous,
    // and only an empty tier falls through to a looser one.
    const tier = (predicate) => {
      const hits = cast.filter(predicate);
      if(hits.length === 1) return { castaway: hits[0] };
      if(hits.length > 1) return { ambiguous: hits.map(c=>c.name) };
      return null;
    };
    const tokensOf = (c) => normalizeName(c.name).split(' ').filter(Boolean);

    return (
      // 1. the same name, ignoring case, accents and punctuation.
      tier(c => normalizeName(c.name) === wanted) ||
      // 2. every word of the wanted name appears in theirs: 'Kilby' in 'Kimberly Kilby Kilbourne',
      //    'Thien An' in 'Thien An Nguyen', 'Matt' in 'Matt Blankinship'. Still strict in the way the
      //    old comment cared about -- 'Matt Blankinship' can't match a different Matt, because BOTH
      //    words have to be there.
      tier(c => { const t = tokensOf(c); return wantedTokens.every(w => t.includes(w)); }) ||
      // 3. the reverse, for when the wiki's grid is FULLER than the cast list: 'Thien An Nguyen'
      //    matching a castaway entered as 'Thien An'.
      tier(c => { const t = tokensOf(c); return t.length > 0 && t.every(w => wantedTokens.includes(w)); }) ||
      // 4. last resort, prefixes of at least three letters, for shortenings the tiers above miss
      //    ('Yam' -> 'Yamil'). Three rather than two so an initial can't sweep up a whole tribe.
      tier(c => { const t = tokensOf(c); return wantedTokens.every(w => w.length >= 3 && t.some(x => x.startsWith(w) || w.startsWith(x))); }) ||
      {}
    );
  }
  // Resolves a SEASON's name for someone -- a staged result's castaway_name, which is the season
  // cast's own spelling -- to this league's castaway (docs/PLAN-universal-season-cast.md, piece 7). By
  // the link first: the season_cast row with exactly that name, then whoever here is linked to it
  // (castaway.seasonCastId), whatever this league calls them. Only when that finds nobody -- no season
  // cast given, a league not linked yet, data from before the links -- does it fall back to the loose
  // findCastawayByName. `seasonCast` is that season's rows, [{ id, name }].
  static findSeasonCastaway(state, name, seasonCast){
    const wanted = String(name == null ? '' : name).trim().toLowerCase();
    const row = wanted && (seasonCast || []).find(r => String(r.name).trim().toLowerCase() === wanted);
    const linked = row && (state.castaways || []).find(c => c.seasonCastId === row.id);
    return linked ? { castaway: linked } : Core.findCastawayByName(state, name);
  }
  static getCastaway(state, id){ return state.castaways.find(c=>c.id===id); }
  static getTribe(state, id){ return state.tribes.find(t=>t.id===id); }

  // ---- ownership ----
  // Castaway ownership is `castaway.ownerIds: string[]`, not a scalar owner, for EVERY league
  // type -- exclusive-ownership leagues (today's only shipped mode) are simply the case where the
  // array never exceeds length 1, enforced by the draft strategy rather than by the data shape.
  // That keeps shared-ownership league types (several players owning the same castaway) from
  // needing a second parallel field that every ownership-aware call site would have to branch on.
  // WRITES always go through setOwner/addOwner/removeOwner below -- that's where the one-owner-max
  // invariant of exclusive mode lives. Plain reads of the array (`c.ownerIds[0]`,
  // `c.ownerIds.includes(id)`) are fine where the caller already holds the castaway object; the
  // read helpers here are for callers that only have an id.
  static ownersOf(state, castawayId){ return ownerListOf(Core.getCastaway(state, castawayId)); }
  static ownedCastawayIds(state, playerId){ return state.castaways.filter(c=>ownerListOf(c).includes(playerId)).map(c=>c.id); }
  static isOwnedBy(state, castawayId, playerId){ return Core.ownersOf(state, castawayId).includes(playerId); }
  // Exclusive-mode convenience: drops any existing owners and sets exactly one. A null/undefined
  // playerId clears ownership entirely (used by undraft and by replenish/trade drops).
  static setOwner(state, castawayId, playerId){
    const c = Core.getCastaway(state, castawayId);
    // A ghost's private ownership survives the league's own moves (see leagueOwnersOf).
    if(c) c.ownerIds = [...leagueGhostOwners(state, c), ...(playerId ? [playerId] : [])];
  }
  // Shared-mode primitives: add/remove a single owner without disturbing the others.
  static addOwner(state, castawayId, playerId){
    const c = Core.getCastaway(state, castawayId);
    if(!c || !playerId) return;
    if(!c.ownerIds) c.ownerIds = [];
    if(!c.ownerIds.includes(playerId)) c.ownerIds.push(playerId);
  }
  static removeOwner(state, castawayId, playerId){
    const c = Core.getCastaway(state, castawayId);
    if(!c || !c.ownerIds) return;
    c.ownerIds = c.ownerIds.filter(id=>id!==playerId);
  }
}

// ---------- EliminationOrderScoringStrategy: the 'classic-draft' league type's scoring ----------
// A castaway earns 1 point, plus 1 for every elimination they outlast, counted as it happens: out
// 4th = 4, the winner of 18 = 18, still in after k eliminations = k + 1 so far. Final totals are
// exactly the old "sum of placementOrder" (an eliminated castaway's placementOrder IS 1 + the
// eliminations before theirs); counting live just stops a mid-season table ranking whoever lost
// someone early first. Plus an optional side-bet bonus layer and an optional finale-prediction layer.
// `locked` is every owned castaway's points so far; `banked` is the part from castaways already out.
class EliminationOrderScoringStrategy {
  /** One castaway's Classic points so far, on whatever (spoiler-trimmed) state the viewer sees. */
  static castawayPoints(state, c){
    if(c.status==='eliminated') return typeof c.placementOrder==='number' ? c.placementOrder : 0;
    return EliminationOrderScoringStrategy.stillInPoints(state);
  }
  /** What every castaway still in has earned so far: 1 + the eliminations they've outlasted. */
  static stillInPoints(state){
    return state.castaways.filter(x=>x.status==='eliminated' && typeof x.placementOrder==='number').length + 1;
  }
  static compute(state){
    const results = {};
    state.players.forEach(p=> results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:0, banked:0, bonus:0, finale:0, total:0, roster:[], formerRoster:[]});
    const stillInPoints = EliminationOrderScoringStrategy.stillInPoints(state);
    // Per-player, via Core.ownedCastawayIds rather than a single scalar owner per castaway, so a
    // castaway with several owners (shared-ownership league types) contributes its placement to
    // each of them. In exclusive-ownership leagues every castaway has at most one owner, so this
    // sums to exactly what the old single-owner pass produced.
    state.players.forEach(p=>{
      Core.ownedCastawayIds(state, p.id).forEach(cid=>{
        const c = Core.getCastaway(state, cid);
        results[p.id].roster.push(c);
        if(c.status==='eliminated'){
          if(typeof c.placementOrder==='number'){ results[p.id].locked += c.placementOrder; results[p.id].banked += c.placementOrder; }
        } else {
          results[p.id].locked += stillInPoints;
        }
      });
    });
    state.castaways.forEach(c=>{
      // Dropped via replenish/trade: no longer counts, but still shown (grayed out) for history.
      if(c.formerOwnerId && results[c.formerOwnerId]){
        results[c.formerOwnerId].formerRoster.push(c);
      }
    });
    if(state.settings.bonusEnabled){
      state.episodes.forEach(ep=>{
        (ep.bets||[]).forEach(bet=>{
          if((bet.predictions||[]).length < 2) return; // needs company: won't pay out if nobody else guessed
          (bet.predictions||[]).forEach(pred=>{
            if(pred.correct===true && results[pred.playerId]){
              results[pred.playerId].bonus += (bet.points||0);
            }
          });
        });
      });
    }
    if(state.finaleActual && state.finaleActual.winner){
      (state.finalePredictions||[]).forEach(fp=>{
        if(!results[fp.playerId]) return;
        const correctTop3 = (fp.top3||[]).filter(id=>id && (state.finaleActual.top3||[]).includes(id)).length;
        results[fp.playerId].finale += correctTop3*(state.settings.finaleTop3Points||0);
        if(fp.winner && fp.winner===state.finaleActual.winner) results[fp.playerId].finale += (state.settings.finaleWinnerPoints||0);
      });
    }
    Object.values(results).forEach(r=> r.total = r.locked + (state.settings.bonusEnabled? r.bonus:0) + r.finale);
    return Object.values(results).sort((a,b)=>b.total-a.total);
  }
}
// ---------- PickEmScoringStrategy: the 'pickem' league type's scoring ----------
// Points = (points per correct pick) x however many of a player's weekly picks survived their
// episode. Reuses ScoreRow's `locked` field as the generic "core score" slot -- same field
// EliminationOrderScoringStrategy sums boot-order into -- rather than widening the shared
// ScoreRow shape for a second league type; PickEmLeaderboardRow (frontend) presents it with its
// own pick'em-appropriate label instead of "Boot Order". `roster`/`formerRoster` stay empty:
// pickem has no roster at all (see PickEmLogic below).
//
// Streaks: a correct pick extends a player's streak; a wrong pick -- or NO pick for an episode that
// happened -- ends it. Players are ranked by their LONGEST streak, with total points (every correct
// pick, all streaks combined) breaking ties. The per-episode walk is PickEmLogic.history, shared with
// the Scoreboard's pick history so the two can't disagree.
class PickEmScoringStrategy {
  static compute(state){
    const results = {};
    state.players.forEach(p=> {
      const h = PickEmLogic.history(state, p.id);
      results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:h.total, bonus:0, finale:0, total:h.total,
        longestStreak:h.longestStreak, currentStreak:h.currentStreak, roster:[], formerRoster:[]};
    });
    return Object.values(results).sort((a,b)=> b.longestStreak - a.longestStreak || b.total - a.total);
  }
}
// Thin dispatcher -- see the "League types" comment near the top of this file. Delegates to
// whichever league type's scoringStrategy is active; today that's always
// EliminationOrderScoringStrategy, so behavior is unchanged from before this split.
class ScoringLogic {
  static compute(state){ return getLeagueType(state).scoringStrategy.compute(state); }
}

// ---------- SnakeDraftStrategy: the 'classic-draft' league type's draft mechanic ----------
class SnakeDraftStrategy {
  // Keeps draftOrder in sync in case players were added/removed some other way. Inactive players
  // (joined after the draft concluded, not yet activated) are deliberately left out until
  // RosterLogic.activatePlayer() folds them in -- otherwise they'd silently re-enter the snake rotation.
  static syncOrder(state){
    state.draftOrder = state.draftOrder.filter(pid => Core.getPlayer(state, pid));
    state.players.forEach(p=>{ if(p.active !== false && !isGhost(p) && !state.draftOrder.includes(p.id)) state.draftOrder.push(p.id); });
  }
  // Snake draft turn: round 0 goes draftOrder[0..N-1], round 1 goes reversed, etc.
  static currentTurn(state){
    SnakeDraftStrategy.syncOrder(state);
    const order = state.draftOrder;
    const n = order.length;
    if(n===0) return null;
    const totalPicksNeeded = n * rosterSize(state);
    if(state.draftPicksMade >= totalPicksNeeded) return { isComplete:true };
    const round = Math.floor(state.draftPicksMade / n);
    const posInRound = state.draftPicksMade % n;
    const roundOrder = round % 2 === 0 ? order : [...order].reverse();
    const playerId = roundOrder[posInRound];
    return {
      isComplete:false,
      playerId,
      personalPickNumber: round + 1,
      overallPickNumber: state.draftPicksMade + 1
    };
  }
  // True once picks are allowed: a real pick has already been made, the commissioner forced it
  // open early, or the scheduled start time (if any) has arrived. With no schedule set and no
  // force-start, the draft simply never auto-starts -- the commissioner has to force it.
  static isStarted(state){
    if(state.draftPicksMade > 0) return true;
    if(state.draftForceStarted) return true;
    const scheduled = state.settings.draftScheduledAt;
    return !!(scheduled && Date.now() >= new Date(scheduled).getTime());
  }
  static forceStart(state){ state.draftForceStarted = true; }
  static reorder(state, fromIdx, toIdx){
    if(fromIdx===toIdx) return;
    const [moved] = state.draftOrder.splice(fromIdx, 1);
    state.draftOrder.splice(toIdx, 0, moved);
  }
  static move(state, idx, delta){
    const target = idx + delta;
    if(target < 0 || target >= state.draftOrder.length) return;
    const arr = state.draftOrder;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
  }
  static pick(state, castawayId){
    const turn = SnakeDraftStrategy.currentTurn(state);
    const c = Core.getCastaway(state, castawayId);
    if(!turn || turn.isComplete || !c || leagueOwnersOf(state, c).length) return;
    Core.setOwner(state, castawayId, turn.playerId);
    c.acquiredVia = 'draft';
    state.draftPicksMade++;
  }
  static undo(state, castawayId){
    const c = Core.getCastaway(state, castawayId);
    if(!c || c.status!=='active') return;
    if(c.acquiredVia==='draft'){
      state.draftPicksMade = Math.max(0, state.draftPicksMade - 1);
    }
    Core.setOwner(state, castawayId, null);
    c.acquiredVia = null;
  }
}

// ---------- NoDraftStrategy: the 'pickem' league type's (non-)draft mechanic ----------
// Pick'em has no draft and no roster at all -- see this file's own top-of-file comment, which
// specifically calls out a weekly pick'em league as a shape that doesn't fit DraftStrategy and
// shouldn't be forced into it. This exists only so DraftLogic's dispatch (and everything that
// calls through it: RosterLogic.addPlayer, the Draft tab's panels if visited directly by URL
// even though the frontend hides that tab for this league type) has something safe to call
// instead of crashing on `undefined.currentTurn(...)`. Every method is an inert no-op/safe
// default; `currentTurn` returning `null` (not `{isComplete:true}`) matters specifically because
// RosterLogic.addPlayer checks `turn && turn.isComplete` to decide whether a new player starts
// inactive -- null keeps every pick'em player active from the moment they join, which is correct
// here since there's no fair-turn-order concept to have missed.
class NoDraftStrategy {
  static syncOrder(){ /* no draft order to maintain */ }
  static currentTurn(){ return null; }
  static isStarted(){ return false; }
  static forceStart(){ /* nothing to force-start */ }
  static reorder(){ /* no draft order */ }
  static move(){ /* no draft order */ }
  static pick(){ /* pickem ownership isn't assigned through this path -- see PickEmLogic */ }
  static undo(){ /* no draft picks to undo */ }
}

// ---------- BlindDraftLogic + BlindDraftStrategy: Classic Draft's SHARED-ownership mechanic -------
// `settings.ownershipMode` picks which draft mechanic 'classic-draft' runs (a fixed pairing, not
// two independent choices):
//   'exclusive' (default) -> SnakeDraftStrategy: turn-based, one owner per castaway.
//   'shared'              -> BlindDraftStrategy: every player privately submits their whole set of
//                            picks, nothing is revealed until EVERY eligible player has locked in,
//                            then all reveal at once and the same castaway may end up on several
//                            rosters (hence step 1's ownerIds array -- see Core's ownership note).
//
// WHERE THE UNREVEALED PICKS LIVE, and why not here: not in `state` at all, but in the
// blind_draft_picks table (db/migrations/0004_blind_draft_picks.sql explains the reasoning in
// full). `state` is broadcast wholesale to every league member, so picks kept in it would be
// readable from any player's Network tab before the reveal. That means this class deliberately
// does NOT hold the pick contents: it holds the PUBLIC half of the mechanic
// (`state.blindDraft.lockedPlayerIds` -- who has locked in, for the "waiting on N players" UI --
// and `state.blindDraft.revealedAt`), plus the pure rules for validating a submission and for
// applying a reveal once the server hands it the picks it read from that table. The server-side
// half lives in src/lib/server/blind-draft.ts.
class BlindDraftLogic {
  // Who must lock in before the reveal fires. Excludes inactive seats (joined after a draft
  // concluded, not yet activated) and disabled ones (player left or was removed) -- a disabled
  // seat can never lock in, so counting it would deadlock the draft for everyone else forever.
  static eligiblePlayers(state){
    return state.players.filter(inLeagueRotation);
  }
  static isRevealed(state){ return !!(state.blindDraft && state.blindDraft.revealedAt); }
  static lockedPlayerIds(state){ return (state.blindDraft && state.blindDraft.lockedPlayerIds) || []; }
  static hasLocked(state, playerId){ return BlindDraftLogic.lockedPlayerIds(state).includes(playerId); }
  static waitingOn(state){
    const locked = BlindDraftLogic.lockedPlayerIds(state);
    return BlindDraftLogic.eligiblePlayers(state).filter(p => !locked.includes(p.id));
  }
  // Rewrites the public mirror of who's locked in from the authoritative list the server read out
  // of blind_draft_picks, rather than incrementally adding/removing ids -- the table is the source
  // of truth, this field is a cache of it, and recomputing wholesale means the two can't drift.
  static setLockedPlayerIds(state, playerIds){
    if(!state.blindDraft) state.blindDraft = { lockedPlayerIds: [], revealedAt: null };
    state.blindDraft.lockedPlayerIds = [...playerIds];
  }
  // True once every eligible player has a submission in. Deliberately takes the ids the server
  // just read inside the transaction rather than reading the cached mirror, so the decision to
  // reveal is made against the table, never against a field that might be mid-update.
  static allLockedIn(state, lockedPlayerIds){
    const eligible = BlindDraftLogic.eligiblePlayers(state);
    if(eligible.length === 0) return false;
    return eligible.every(p => lockedPlayerIds.includes(p.id));
  }
  // Validates one player's submission. Returns null if it's fine, or a human-readable reason --
  // unlike most of this file (which silently no-ops on a bad request, see SnakeDraftStrategy.pick),
  // a rejected blind submission needs to tell the player WHY: they can't see what anyone else did,
  // so a silent no-op would be indistinguishable from a successful lock-in.
  static validateSubmission(state, playerId, castawayIds){
    if(!getLeagueType(state).hasRoster || state.settings.ownershipMode !== 'shared'){
      return 'This league is not running a blind draft';
    }
    if(!DraftLogic.isStarted(state)) return "The draft hasn't started yet";
    if(BlindDraftLogic.isRevealed(state)) return 'The draft has already been revealed';
    const player = Core.getPlayer(state, playerId);
    if(!player) return 'No such player';
    if(player.disabled) return 'That seat has been disabled';
    if(player.active === false) return 'That player is not active in this draft';
    const ids = Array.isArray(castawayIds) ? castawayIds : [];
    const teamSize = rosterSize(state);
    if(ids.length !== teamSize) return `Pick exactly ${teamSize} castaway${teamSize===1?'':'s'}`;
    if(new Set(ids).size !== ids.length) return 'Same castaway picked more than once';
    for(const id of ids){
      const c = Core.getCastaway(state, id);
      if(!c) return 'Unknown castaway in submission';
      // No free-agent check: shared mode never removes anyone from availability, so the whole
      // active cast is offered to every player every time (see RosterLogic.freeAgents' comment).
      if(c.status !== 'active') return `${c.name} is already eliminated`;
    }
    return null;
  }
  // Applies every player's picks at once. `picksByPlayer` is {[playerId]: castawayId[]}, read from
  // blind_draft_picks by the caller inside the same transaction that holds the league row lock.
  // Uses addOwner (not setOwner) because shared mode is the whole point -- several players can and
  // will land on the same castaway.
  static reveal(state, picksByPlayer, revealedAt){
    if(BlindDraftLogic.isRevealed(state)) return false;
    let assigned = 0;
    Object.keys(picksByPlayer).forEach(playerId => {
      if(!Core.getPlayer(state, playerId)) return; // seat removed between locking and reveal
      (picksByPlayer[playerId] || []).forEach(castawayId => {
        const c = Core.getCastaway(state, castawayId);
        if(!c) return;
        Core.addOwner(state, castawayId, playerId);
        c.acquiredVia = 'draft';
        assigned++;
      });
    });
    if(!state.blindDraft) state.blindDraft = { lockedPlayerIds: [], revealedAt: null };
    state.blindDraft.revealedAt = revealedAt || new Date().toISOString();
    // Keeps isStarted() true and gives the same "picks made" figure the snake draft exposes. Not a
    // turn pointer here -- there are no turns to advance -- just a count of what landed.
    state.draftPicksMade = assigned;
    return true;
  }
}

// Same static shape as SnakeDraftStrategy so DraftLogic's dispatch needs no special-casing, but
// the parts that only mean something for a turn-based draft are inert: there is no turn order to
// sync or reorder, and picks arrive through the blind-draft routes rather than through pick().
class BlindDraftStrategy {
  static syncOrder(){ /* no turn order in a simultaneous draft */ }
  // `null` while picks are still being submitted -- same choice, for the same reason, as
  // NoDraftStrategy's: RosterLogic.addPlayer reads `turn && turn.isComplete` to decide whether a
  // new player starts inactive, and null keeps someone who joins mid-submission active so they
  // can still lock in (the reveal then waits on them, which is correct). Once revealed, the draft
  // really is complete, so a later joiner gets the same inactive-until-activated treatment a
  // post-snake-draft joiner does.
  static currentTurn(state){
    return BlindDraftLogic.isRevealed(state) ? { isComplete: true } : null;
  }
  // Identical rule to SnakeDraftStrategy: "started" means submissions are open.
  static isStarted(state){
    if(BlindDraftLogic.isRevealed(state)) return true;
    if(state.draftForceStarted) return true;
    const scheduled = state.settings.draftScheduledAt;
    return !!(scheduled && Date.now() >= new Date(scheduled).getTime());
  }
  static forceStart(state){ state.draftForceStarted = true; }
  static reorder(){ /* no turn order */ }
  static move(){ /* no turn order */ }
  static pick(){ /* submissions go through BlindDraftLogic + the blind-draft routes */ }
  // Deliberately inert: post-reveal a castaway may have several owners, and undo() only receives a
  // castawayId, so there'd be no way to say WHICH owner to strip. The frontend hides Undraft in
  // shared mode for the same reason.
  static undo(){ /* ambiguous with multiple owners -- see comment */ }
}

// ---------- Active Roster: event catalog, weekly lineups, event scoring ----------
// The 'active-roster' league type: you draft a roster like Classic Draft, but only some of it is
// ACTIVE each episode, and points come from what your active castaways DID that week (won immunity,
// found an idol, ...) rather than from elimination placement.
//
// The event catalog is the league's format's (formatOf(state).events -- see formats/survivor.js for
// Survivor's); these are the catalog defaults for a league that hasn't customised a type.
// A format may give one default for every league, or one per ownership mode ({exclusive, shared}):
// in an exclusive league one team owns the eventual winner outright, so categories that pile up on
// long-lasting, challenge-winning players are worth less there than when that player is shared.
function defaultPointsFor(def, mode){
  const d = def && def.defaultPoints;
  if(d && typeof d === 'object') return mode === 'shared' ? d.shared : d.exclusive;
  return typeof d === 'number' ? d : 0;
}
function ownershipModeOf(state){
  return state && state.settings && state.settings.ownershipMode === 'shared' ? 'shared' : 'exclusive';
}
function defaultEventPoints(state, mode){
  const m = mode || ownershipModeOf(state);
  const out = {};
  formatOf(state).events.forEach(e => { out[e.id] = defaultPointsFor(e, m); });
  return out;
}
// Points are decimals now (0.5 steps and the like); sums of them pick up float noise, so every total
// is rounded to hundredths where it's made.
function roundPoints(n){ return Math.round((Number(n) || 0) * 100) / 100; }

class ActiveRosterLogic {
  // Points for one event type: the league's own value if set, else the catalog default. A type
  // explicitly set to 0 stays 0 (that's how a commissioner switches a category off), which is why
  // this tests for a number rather than using `||`.
  static pointsFor(state, type){
    const configured = state.settings && state.settings.eventPoints ? state.settings.eventPoints[type] : undefined;
    if(typeof configured === 'number' && Number.isFinite(configured)) return configured;
    const def = formatOf(state).events.find(e => e.id === type);
    return defaultPointsFor(def, ownershipModeOf(state));
  }
  static activeSlots(state){ return (state.settings && state.settings.activeSlots) || 0; }
  static benchSlots(state){ return (state.settings && state.settings.benchSlots) || 0; }

  // ---- weekly lineups ----
  // Lineups are stored PER EPISODE (`episode.lineups[playerId] = castawayId[]`), never as one
  // mutable "current active set" plus a separate snapshot. That's the whole point, and it makes the
  // retroactive-scoring bug the plan warns about structurally impossible rather than merely avoided:
  // last week's lineup lives on last week's episode object, so editing this week's cannot reach back
  // and change what last week scored. There is no single "current" set to drift out of sync.
  //
  // `episode.lineupsLocked` is a SEPARATE, EXPLICIT commissioner action -- deliberately NOT derived
  // from "does this episode have eliminations yet" the way EpisodeLogic.ensureUpcoming infers "has
  // this episode happened". Deriving it would be backwards: the lock is meant to land BEFORE the
  // episode airs (you commit your lineup without knowing the outcome), while eliminations are
  // entered after, so a derived lock would leave a window in which someone could rewrite their
  // lineup already knowing what happened.
  // A player who never set a lineup for this episode fields their most recent earlier one -- only
  // what they still own and is still in the game (carriesInto), capped at the active slots. Resolved at READ time, so it holds however the
  // episodes came to exist (carryForwardLineups only copies at creation, and misses an episode created
  // before the previous lineup was set). Once set for an episode, even to empty, that's what counts.
  static lineupFor(state, epId, playerId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return [];
    if(ep.lineups && Object.prototype.hasOwnProperty.call(ep.lineups, playerId)) return ep.lineups[playerId] || [];
    const earlier = state.episodes
      .filter(e => e.number < ep.number && e.lineups && Object.prototype.hasOwnProperty.call(e.lineups, playerId))
      .sort((a,b) => b.number - a.number)[0];
    if(!earlier) return [];
    return (earlier.lineups[playerId] || [])
      .filter(cid => ActiveRosterLogic.carriesInto(state, cid, playerId, ep.number))
      .slice(0, ActiveRosterLogic.activeSlots(state) || undefined);
  }
  // Whether a starter from an earlier lineup carries into episode `number`: still owned, and not
  // eliminated before it. An eliminated starter leaves their slot EMPTY rather than sitting in it
  // scoring nothing -- the player sees a gap to fill. (Someone voted out IN episode `number` itself
  // still carries: they played it. validateLineup allows them for the same reason.)
  static carriesInto(state, castawayId, playerId, number){
    const c = Core.getCastaway(state, castawayId);
    if(!c || !ownerListOf(c).includes(playerId)) return false;
    if(c.status !== 'eliminated') return true;
    const exit = state.episodes.find(e => e.id === c.exitEpisodeId);
    return !!exit && exit.number >= number;
  }
  /** True when this episode's lineup was carried over from an earlier one rather than set for it. */
  static lineupIsCarried(state, epId, playerId){
    const ep = state.episodes.find(e => e.id === epId);
    return !!ep && !(ep.lineups && Object.prototype.hasOwnProperty.call(ep.lineups, playerId));
  }
  // Locked once the episode starts airing (ep.airsAt, stamped by the server from the season's
  // schedule -- src/lib/server/air-times.ts), once it has results (a league whose season has no
  // schedule), or when a commissioner locked it by hand (the same fallback, kept for old leagues).
  static isLineupLocked(state, epId){
    const ep = state.episodes.find(e => e.id === epId);
    return !!ep && (!!ep.lineupsLocked || hasAired(ep) || EpisodeLogic.hasResults(ep));
  }
  // Returns null if the lineup is acceptable, else a human-readable reason. Like blind draft (and
  // unlike most of this file) this reports WHY rather than silently no-opping -- a rejected lineup is
  // something the player needs to understand and fix.
  static validateLineup(state, epId, playerId, castawayIds){
    if(!getLeagueType(state).hasActiveRoster) return 'This league type has no active roster';
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return 'No such episode';
    if(ActiveRosterLogic.isLineupLocked(state, epId)) return 'This episode has started -- lineups are locked';
    if(!inPlay(state, ep.number)) return 'This league starts at episode ' + startEpisode(state);
    if(!Core.getPlayer(state, playerId)) return 'No such player';
    const ids = Array.isArray(castawayIds) ? castawayIds : [];
    if(new Set(ids).size !== ids.length) return 'Same castaway listed twice';
    const slots = ActiveRosterLogic.activeSlots(state);
    // "At most", not "exactly": late in a season a player may own fewer surviving castaways than they
    // have slots, and they shouldn't be blocked from fielding what they do have.
    if(ids.length > slots) return 'At most ' + slots + ' active castaway' + (slots === 1 ? '' : 's');
    for(const id of ids){
      const c = Core.getCastaway(state, id);
      if(!c) return 'Unknown castaway in lineup';
      // Ownership is the only real constraint. Eliminated castaways are deliberately still allowed:
      // someone voted out in THIS episode was on the field for it and may well have earned events
      // before going, so excluding them would lose real points.
      if(!ownerListOf(c).includes(playerId)) return c.name + " isn't on your roster";
    }
    return null;
  }
  static setLineup(state, epId, playerId, castawayIds){
    if(ActiveRosterLogic.validateLineup(state, epId, playerId, castawayIds)) return false;
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep.lineups) ep.lineups = {};
    ep.lineups[playerId] = [...castawayIds];
    return true;
  }
  static lockLineups(state, epId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep || ep.lineupsLocked) return false;
    ep.lineupsLocked = true;
    return true;
  }
  static unlockLineups(state, epId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep || !ep.lineupsLocked) return false;
    ep.lineupsLocked = false;
    return true;
  }
  // Seeds an episode's lineups from the previous episode's so players adjust rather than retype the
  // same lineup every week. Only fills players with no lineup for this episode yet, and never touches
  // a locked episode. Carries forward only what the player still OWNS -- a castaway lost to replenish
  // or swap since then isn't theirs to field any more.
  static carryForwardLineups(state, epId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep || ep.lineupsLocked) return false;
    const prev = state.episodes.filter(e => e.number < ep.number).sort((a,b) => b.number - a.number)[0];
    if(!prev || !prev.lineups) return false;
    if(!ep.lineups) ep.lineups = {};
    let filled = 0;
    Object.keys(prev.lineups).forEach(playerId => {
      if(ep.lineups[playerId]) return;
      const stillOwned = (prev.lineups[playerId] || []).filter(cid => ActiveRosterLogic.carriesInto(state, cid, playerId, ep.number));
      ep.lineups[playerId] = stillOwned;
      filled++;
    });
    return filled > 0;
  }

  // ---- per-episode scoring events ----
  // NOTE ON THE FIELD NAME: these live in `episode.scoringEvents`, NOT `episode.events`, even though
  // the plan doc sketched the latter. `episode.events` already exists and already means ELIMINATIONS
  // ({castawayId, method}) -- it drives placementOrder, is reset by EpisodeLogic.remove, and is the
  // "has this episode happened yet" signal for both EpisodeLogic.ensureUpcoming and
  // PickEmScoringStrategy. Writing an "immunity win" into it would make Pick'em score that castaway
  // as voted out and make episode deletion try to un-eliminate them. Two genuinely different things
  // (a structural season fact vs. a point-earning occurrence), so they get two fields.
  static addEvent(state, epId, type, castawayId){
    const ep = state.episodes.find(e => e.id === epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c || !type) return null;
    // Implied events (see episodeEvents) are never recorded: they'd score twice. Nor is one a season
    // rule change retired, from its retirement on (formats/season-changes.js).
    const def = formatOf(state).events.find(e => e.id === type);
    if(!def || def.implied) return null;
    if(Number.isInteger(def.retiredFrom) && ep.number >= def.retiredFrom) return null;
    if(!ep.scoringEvents) ep.scoringEvents = [];
    const ev = { id: Core.uid('sev'), type, castawayId };
    ep.scoringEvents.push(ev);
    return ev;
  }
  static removeEvent(state, epId, eventId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return;
    ep.scoringEvents = (ep.scoringEvents || []).filter(ev => ev.id !== eventId);
  }
  // Everything that scores in an episode: the recorded events plus any the format implies from the
  // episode's exits and roles (The Traitors: murdered, finalist, winner, caught, recruited). Implied
  // ones are derived on every read rather than stored, so correcting an exit or a role can't leave a
  // stale event behind. They carry `implied: true` and a stable id, and can't be removed by hand.
  static episodeEvents(state, ep){
    const recorded = ep.scoringEvents || [];
    const format = formatOf(state);
    if(!format.impliedEvents) return recorded;
    // An implied event can repeat (one per jury vote), so ids get a counter from the second on.
    const seen = {};
    const implied = format.impliedEvents(ep, { roleOf: (cid, n) => RoleLogic.roleOf(state, cid, n) })
      .map(ev => {
        const key = ev.type + '_' + ev.castawayId;
        const n = seen[key] = (seen[key] || 0) + 1;
        return { id: 'implied_' + key + (n > 1 ? '_' + n : ''), type: ev.type, castawayId: ev.castawayId, implied: true };
      });
    return [...recorded, ...implied];
  }
}

// ---------- GroupLogic: tribe/team changes during a season ----------
// Swaps, merges, new teams, weekly pairs, playing as individuals. Recorded per episode
// (episode.groups, [{castawayId, tribeId}] -- tribeId null means "no group now"), the same way roles
// and exile are, so they reach a league through the reveal-gated season decisions: a league catching
// up sees the swap when it reaches the swap episode.
//
// castaway.tribeId stays what everything reads (the board, the admin review) and always means the
// CURRENT group: it's recomputed from the latest change, or from castaway.startTribeId when there are
// none. startTribeId is captured the first time someone moves, which is why it can be absent: absent
// means tribeId is still their starting group.
class GroupLogic {
  static changesFor(state, castawayId){
    return [...state.episodes]
      .sort((a,b) => a.number - b.number)
      .flatMap(e => (e.groups || []).filter(g => g.castawayId === castawayId));
  }
  static recompute(state, castawayId){
    const c = Core.getCastaway(state, castawayId);
    if(!c) return;
    const changes = GroupLogic.changesFor(state, castawayId);
    if(changes.length){ c.tribeId = changes[changes.length - 1].tribeId; return; }
    if(c.startTribeId !== undefined){ c.tribeId = c.startTribeId; delete c.startTribeId; }
  }
  // The league's group with this name, created if it's new (a merged tribe, a new team, a pair).
  // Null for no name: playing as an individual.
  static tribeNamed(state, name){
    const wanted = String(name == null ? '' : name).trim();
    if(!wanted) return null;
    const existing = state.tribes.find(t => t.name.trim().toLowerCase() === wanted.toLowerCase());
    return existing || RosterLogic.addTribe(state, wanted, PALETTE[state.tribes.length % PALETTE.length]);
  }
  static add(state, epId, castawayId, groupName){
    const ep = state.episodes.find(e => e.id === epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c) return false;
    ep.groups = ep.groups || [];
    if(ep.groups.some(g => g.castawayId === castawayId)) return false;
    if(c.startTribeId === undefined) c.startTribeId = c.tribeId || null;
    const tribe = GroupLogic.tribeNamed(state, groupName);
    ep.groups.push({ castawayId, tribeId: tribe ? tribe.id : null });
    GroupLogic.recompute(state, castawayId);
    return true;
  }
  static remove(state, epId, castawayId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return;
    ep.groups = (ep.groups || []).filter(g => g.castawayId !== castawayId);
    GroupLogic.recompute(state, castawayId);
  }
}

// ---------- RoleLogic: secret roles (The Traitors) ----------
// A role is recorded per episode (episode.roles, [{castawayId, role}]) as the episode it took effect
// in, the same way exile is -- so it reaches a league through the reveal-gated season decisions, and a
// league catching up doesn't learn a role before it reaches the episode that showed it.
class RoleLogic {
  // The role someone holds as of episode `throughEpisode` (or now, when omitted): the latest recorded
  // at or before it, else the format's default. Null for a format without roles.
  static roleOf(state, castawayId, throughEpisode){
    const roles = formatOf(state).roles;
    if(!roles) return null;
    let latest = null;
    [...state.episodes]
      .filter(e => throughEpisode == null || e.number <= throughEpisode)
      .sort((a,b) => a.number - b.number)
      .forEach(e => (e.roles || []).forEach(r => { if(r.castawayId === castawayId) latest = r.role; }));
    return latest ? roles.roleFor(latest) : roles.default;
  }
  static add(state, epId, castawayId, role){
    const ep = state.episodes.find(e => e.id === epId);
    const c = Core.getCastaway(state, castawayId);
    const roles = formatOf(state).roles;
    if(!ep || !c || !roles || !roles.values.includes(role)) return false;
    ep.roles = ep.roles || [];
    if(ep.roles.some(r => r.castawayId === castawayId)) return false;
    ep.roles.push({ castawayId, role });
    return true;
  }
  static remove(state, epId, castawayId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return;
    ep.roles = (ep.roles || []).filter(r => r.castawayId !== castawayId);
  }
}

// ---------- ActiveRosterEventScoringStrategy: the 'active-roster' league type's scoring ----------
// Per episode, a player scores every scoring event whose castaway was in THAT episode's lineup for
// them. Elimination placement deliberately doesn't feature -- this league type scores what your
// active castaways did, not how long they lasted (survival is represented in the catalog instead, by
// the zero-votes-safe event).
//
// Reads each episode's own `lineups`, which is why editing a later episode's lineup can't change an
// earlier episode's score. Benched castaways score nothing by construction: "benched" just means
// "not in this episode's lineup", so there's no separate bench list to keep in sync.
class ActiveRosterEventScoringStrategy {
  static compute(state){
    const results = {};
    state.players.forEach(p=> results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:0, bonus:0, finale:0, total:0, roster:[], formerRoster:[]});
    state.players.forEach(p=>{
      Core.ownedCastawayIds(state, p.id).forEach(cid=>{
        results[p.id].roster.push(Core.getCastaway(state, cid));
      });
    });
    state.castaways.forEach(c=>{
      if(c.formerOwnerId && results[c.formerOwnerId]) results[c.formerOwnerId].formerRoster.push(c);
    });
    state.episodes.forEach(ep=>{
      if(!inPlay(state, ep.number)) return; // before this league started (settings.startEpisode)
      ActiveRosterLogic.episodeEvents(state, ep).forEach(ev=>{
        state.players.forEach(p=>{
          const lineup = ActiveRosterLogic.lineupFor(state, ep.id, p.id);
          if(lineup.includes(ev.castawayId)){
            results[p.id].locked = roundPoints(results[p.id].locked + ActiveRosterLogic.pointsFor(state, ev.type));
          }
        });
      });
    });
    // The same optional layers classic-draft carries: side bets and finale predictions are orthogonal
    // to how the main score is earned, so an Active Roster league can still use them.
    if(state.settings.bonusEnabled){
      state.episodes.forEach(ep=>{
        (ep.bets||[]).forEach(bet=>{
          if((bet.predictions||[]).length < 2) return;
          (bet.predictions||[]).forEach(pred=>{
            if(pred.correct===true && results[pred.playerId]) results[pred.playerId].bonus += (bet.points||0);
          });
        });
      });
    }
    if(state.finaleActual && state.finaleActual.winner){
      (state.finalePredictions||[]).forEach(fp=>{
        if(!results[fp.playerId]) return;
        const correctTop3 = (fp.top3||[]).filter(id=>id && (state.finaleActual.top3||[]).includes(id)).length;
        results[fp.playerId].finale += correctTop3*(state.settings.finaleTop3Points||0);
        if(fp.winner && fp.winner===state.finaleActual.winner) results[fp.playerId].finale += (state.settings.finaleWinnerPoints||0);
      });
    }
    Object.values(results).forEach(r=> r.total = roundPoints(r.locked + (state.settings.bonusEnabled? r.bonus:0) + r.finale));
    return Object.values(results).sort((a,b)=>b.total-a.total);
  }
}

// ---------- PickEmLogic: the 'pickem' league type's weekly pick mechanic ----------
// Each episode, each player picks one still-active castaway they think survives that episode's
// tribal -- unlike Feature A's blind draft, the plan never asks for these to be hidden from other
// players before the episode airs, so (unlike blind draft) this needs no private-storage design;
// everyone's pick can live in the ordinary broadcast `state` same as everything else. Stored
// per-episode
// (`episode.picks: {playerId, castawayId}[]`), one pick per player per episode, upserted in
// place rather than accumulating a history of guesses -- unlike BetLogic's predictions (which
// this class deliberately does NOT extend: BetLogic's guesses are free-text, manually graded by
// the commissioner, and only pay out with >=2 guessers; pickem picks are a specific castaway
// reference, auto-graded from ep.events, graded solo, and carry a no-repeat-previous-episode
// business rule with no equivalent in BetLogic -- different enough that reusing it would mean
// bending its semantics rather than sharing them).
//
// No stored "correct" -- see PickEmScoringStrategy's compute() for why.
class PickEmLogic {
  static findEpisode(state, epId){ return state.episodes.find(e=>e.id===epId); }
  static pickFor(state, epId, playerId){
    const ep = PickEmLogic.findEpisode(state, epId);
    return ep ? (ep.picks||[]).find(pk=>pk.playerId===playerId) || null : null;
  }
  // The episode picks are being made for. See the module-level currentEpisode() -- shared with
  // Active Roster's lineup grid and Overview's side bets.
  static upcomingEpisode(state){ return currentEpisode(state); }
  // An episode has "happened" for scoring once its eliminations are logged -- a pick for a future
  // episode would otherwise count as correct the moment it's made (nothing yet contradicts it).
  static decided(ep){ return !!ep && (ep.events||[]).length > 0; }

  // Who a player may pick for an episode, under both rules:
  //
  //   the cycle rule   -- no one twice until you've picked everyone still in the game once. Replayed
  //                       over the player's picks before this episode, in order: a cycle ends when it
  //                       covers everyone remaining, and the next pick starts a new one. "Remaining" is
  //                       who's still in the game NOW, so an eliminated person never holds a cycle open.
  //   no back-to-back  -- never the same person as your previous pick, even across a new cycle.
  //
  // Returns {available, blocked}: `blocked` maps each remaining person who can't be picked to the
  // episode they were picked in and why. If the rules would leave nobody (only your last pick is
  // left in the game), that person is allowed rather than making the episode unplayable.
  static eligibility(state, epId, playerId){
    const ep = PickEmLogic.findEpisode(state, epId);
    const remaining = state.castaways.filter(c => c.status === 'active').map(c => c.id);
    const blocked = {};
    if(!ep) return { available: remaining, blocked };
    const prior = [...state.episodes]
      .filter(e => e.number < ep.number)
      .sort((a,b) => a.number - b.number)
      .map(e => ({ number: e.number, pick: (e.picks||[]).find(pk => pk.playerId === playerId) }))
      .filter(x => x.pick);
    const covers = (cycle) => remaining.every(id => cycle.has(id));
    let cycle = new Map(); // castawayId -> episode number picked in, this cycle
    prior.forEach(x => {
      if(covers(cycle)) cycle = new Map();
      cycle.set(x.pick.castawayId, x.number);
    });
    if(covers(cycle)) cycle = new Map();
    const last = prior.length ? prior[prior.length - 1] : null;
    remaining.forEach(id => {
      if(cycle.has(id)) blocked[id] = { episode: cycle.get(id), reason: 'cycle' };
    });
    if(last && remaining.includes(last.pick.castawayId)){
      blocked[last.pick.castawayId] = { episode: last.number, reason: 'backToBack' };
    }
    let available = remaining.filter(id => !blocked[id]);
    if(!available.length && last && remaining.includes(last.pick.castawayId)){
      available = [last.pick.castawayId];
      delete blocked[last.pick.castawayId];
    }
    return { available, blocked };
  }

  // A player's season, episode by episode, with their streaks. A row per episode that has happened
  // (picked or not -- a missed one breaks the streak) plus any pick still waiting on its episode.
  static history(state, playerId){
    const perCorrect = typeof state.settings.pickemCorrectPoints === 'number' ? state.settings.pickemCorrectPoints : 1;
    const rows = [];
    let current = 0, longest = 0, total = 0;
    // Episodes before the league started are history, not missed picks (settings.startEpisode).
    // A late joiner's season starts at their own episode (GhostLogic.startFor).
    [...state.episodes].filter(ep => ep.number >= GhostLogic.startFor(state, playerId)).sort((a,b) => a.number - b.number).forEach(ep => {
      const pick = (ep.picks||[]).find(pk => pk.playerId === playerId) || null;
      if(!PickEmLogic.decided(ep)){
        if(pick) rows.push({ episode: ep.number, postMerge: !!ep.postMerge, castawayId: pick.castawayId, correct: null, points: 0, streak: current });
        return;
      }
      // Correct = the picked person isn't among this episode's eliminations. Derived live from
      // ep.events rather than stored, so logging or undoing an elimination can't leave it stale.
      const correct = !!pick && !ep.events.some(ev => ev.castawayId === pick.castawayId);
      if(correct){ current++; total += perCorrect; longest = Math.max(longest, current); }
      else current = 0;
      rows.push({ episode: ep.number, postMerge: !!ep.postMerge, castawayId: pick ? pick.castawayId : null, correct, points: correct ? perCorrect : 0, streak: current });
    });
    return { rows, total, longestStreak: longest, currentStreak: current };
  }

  // Silently no-ops on an invalid request (unknown episode/castaway/player, an already-eliminated
  // castaway, or one the cycle / back-to-back rules exclude -- see eligibility) rather than throwing,
  // matching this file's existing convention (see e.g. SnakeDraftStrategy.pick on an already-owned
  // castaway). The frontend is expected to not offer the invalid options in the first place; this is
  // the backstop, not the primary validation surface.
  // No lock once an episode's eliminations are logged -- a pick can still be changed after the
  // outcome is known, same trust model the rest of this app already uses for bet predictions
  // (also editable at any time, no lock tied to an episode airing). The plan doesn't ask for one
  // and this app has no adversarial-security posture anywhere else either; not adding a new kind
  // of protection unprompted.
  static setPick(state, epId, playerId, castawayId){
    const ep = PickEmLogic.findEpisode(state, epId);
    const c = Core.getCastaway(state, castawayId);
    const player = Core.getPlayer(state, playerId);
    if(!ep || !c || !player || c.status!=='active' || !inPlay(state, ep.number)) return;
    if(hasAired(ep) || PickEmLogic.decided(ep)) return; // picks close when the episode starts
    if(!PickEmLogic.eligibility(state, epId, playerId).available.includes(castawayId)) return;
    ep.picks = ep.picks || [];
    const existing = ep.picks.find(pk=>pk.playerId===playerId);
    if(existing) existing.castawayId = castawayId;
    else ep.picks.push({playerId, castawayId});
  }
  static removePick(state, epId, playerId){
    const ep = PickEmLogic.findEpisode(state, epId);
    if(!ep) return;
    ep.picks = (ep.picks||[]).filter(pk=>pk.playerId!==playerId);
  }
}

// ---------- League type + show registries ----------
// See the "League types" comment near the top of this file for the extension pattern. Both
// registries are plain data (id/name/description/etc.) so new entries are additive, not
// rewrites -- SHOWS today is display/terminology metadata only, not wired to any behavior yet
// (a future per-show wiki-sourcing config would attach here without changing this shape).
const LEAGUE_TYPES = {
  'classic-draft': {
    id: 'classic-draft',
    name: 'Classic',
    description: 'Commissioner sets a draft order, players snake-draft castaways, score by elimination placement.',
    draftStrategy: SnakeDraftStrategy,
    scoringStrategy: EliminationOrderScoringStrategy,
    supportsReplenish: true,
    supportsTrade: true,
    supportsFinalePredictions: true,
    // hasRoster/hasWeeklyPicks: orthogonal to the three supports* flags above, which are about
    // which MID-SEASON mechanics apply to an existing roster -- these two are about whether a
    // roster (and therefore a draft, Draft tab, Board grid) exists at all, and whether the
    // frontend owes this league type a per-episode pick UI. Both start here explicit-but-inert
    // for classic-draft (it has the roster, never the weekly picks) so a reader sees the full
    // axis rather than inferring "pickem is the only type these apply to" from a single entry.
    hasRoster: true,
    hasWeeklyPicks: false,
    hasActiveRoster: false
  },
  'pickem': {
    id: 'pickem',
    name: "Eliminator Pool",
    description: 'No draft, no roster -- every episode, each player picks one castaway they think survives. No repeats until you\'ve picked everyone still in the game, and never the same one twice in a row. Ranked by longest streak of correct picks, then total correct.',
    draftStrategy: NoDraftStrategy,
    scoringStrategy: PickEmScoringStrategy,
    supportsReplenish: false,
    supportsTrade: false,
    supportsFinalePredictions: false,
    hasRoster: false,
    hasWeeklyPicks: true,
    hasActiveRoster: false
  },
  'active-roster': {
    id: 'active-roster',
    name: 'Active Roster',
    description: 'Draft a roster, then each episode field only some of it. Points come from what your active castaways do that week (winning challenges, surviving a vote, the show\'s own moments), not from elimination placement.',
    // Same draft mechanics as classic-draft, including the ownershipMode override below -- Active
    // Roster changes what happens to a roster AFTER the draft, not how it's drafted.
    draftStrategy: SnakeDraftStrategy,
    scoringStrategy: ActiveRosterEventScoringStrategy,
    supportsReplenish: true,
    supportsTrade: true,
    supportsFinalePredictions: true,
    hasRoster: true,
    hasWeeklyPicks: false,
    hasActiveRoster: true
  }
};
// NOT the catalog, and no longer a default either: a new league starts with showId null and the
// commissioner picks from the catalog (defaultState / SetupLogic). The real catalog of shows and
// seasons lives in Postgres (db/migrations/0006_shows_and_seasons.sql), is managed by a super-admin
// in the Admin tab, and is what the UI reads over /api/shows -- including each show's terminology,
// via useShowTerms(). This file deliberately cannot read it, because keeping the game logic free of
// any DB dependency is what lets it stay a pure fork of the file the live app loads straight into a
// browser.
//
// What's left here is the DB-free fallback: the terms to use when there is no catalog to consult
// (the demo league, which is a Survivor season). Leagues store the show's SLUG, which is why
// 'survivor' here and the seeded row there are the same string.
const SHOWS = {
  survivor: { id: 'survivor', name: 'Survivor', castawayTerm: 'Castaway', tribeTerm: 'Tribe' }
};

// A roster league type running in shared-ownership mode. Same league type (same id, same scoring),
// but a different draft mechanic and two mid-season features switched off:
//
// - draftStrategy -> BlindDraftStrategy. `ownershipMode` is a fixed pairing with the mechanic, not
//   an independent choice: exclusive means snake, shared means blind-with-reveal.
// - supportsReplenish/supportsTrade -> false. Both are free-agent mechanics, and shared mode has no
//   free agents (nothing is ever removed from availability). Left on, they'd be live buttons that
//   silently accomplish nothing: ReplenishLogic.assign and TradeLogic.swap both refuse a castaway
//   that already has an owner, and in shared mode every castaway does. A shared-mode replenish
//   COULD instead mean "add any still-active castaway" -- that's a real design question this plan
//   doesn't answer, so it's left out rather than guessed at.
//
// Built once per roster league type rather than per call, since getLeagueType runs on nearly every
// render and every DraftLogic dispatch. Keyed by league type id so Active Roster gets the same
// treatment as Classic Draft without either needing to know about the other.
const SHARED_OWNERSHIP_VARIANTS = {};
// EXCEPT Active Roster, where shared replenish/swap now has a defined meaning: add anyone still in
// the game who isn't already yours (MidSeasonLogic.availableFor). Classic Draft's shared mode keeps
// them off -- its replenish replaces a loss 1-for-1 from a free-agent pool, which shared mode lacks.
Object.values(LEAGUE_TYPES).forEach(lt => {
  if(!lt.hasRoster) return;
  SHARED_OWNERSHIP_VARIANTS[lt.id] = {
    ...lt,
    draftStrategy: BlindDraftStrategy,
    supportsReplenish: !!lt.hasActiveRoster,
    supportsTrade: !!lt.hasActiveRoster
  };
});
// Resolves the active league type, applying the ownership-mode override above. Returns the registry
// entry itself in every other case, so `getLeagueType(state).id` and the supports*/has* flags stay
// the single thing callers read -- no call site needs to know ownershipMode exists.
function getLeagueType(state){
  const base = LEAGUE_TYPES[state.settings && state.settings.leagueTypeId] || LEAGUE_TYPES['classic-draft'];
  if(state.settings && state.settings.ownershipMode === 'shared' && SHARED_OWNERSHIP_VARIANTS[base.id]){
    return SHARED_OWNERSHIP_VARIANTS[base.id];
  }
  return base;
}

// How many castaways each player drafts. For Active Roster this is DERIVED from the slot settings
// rather than read from teamSize: the roster is by definition the active slots plus the bench, and
// keeping teamSize as an independent number would let a commissioner set 3 there against 3+2 slots
// and produce a roster that can never fill its lineup. Every draft mechanic asks through here.
function rosterSize(state){
  if(getLeagueType(state).hasActiveRoster){
    return ActiveRosterLogic.activeSlots(state) + ActiveRosterLogic.benchSlots(state);
  }
  return state.settings.teamSize;
}

// Whether Replenish / Swap are actually available right now. Two independent things have to be
// true, and keeping them separate matters:
//   1. CAPABILITY -- the league type/ownership mode can support it at all (supportsReplenish /
//      supportsTrade). Shared ownership can't: both are free-agent mechanics and shared mode has
//      no free agents. Not the commissioner's call, it just doesn't mean anything there.
//   2. CHOICE -- the commissioner turned it on (settings.replenishEnabled / tradeEnabled). Both
//      default OFF: they're optional mid-season mechanics, not something every league runs.
// Everything that shows or starts a round asks through here rather than reading either half on its
// own, so the UI can't offer a round the route would refuse (or vice versa).
function replenishAvailable(state){
  return !!getLeagueType(state).supportsReplenish && (state.settings && state.settings.replenishEnabled === true);
}
function tradeAvailable(state){
  return !!getLeagueType(state).supportsTrade && (state.settings && state.settings.tradeEnabled === true);
}
function finalePredictionsAvailable(state){
  return !!getLeagueType(state).supportsFinalePredictions && (state.settings && state.settings.finalePredictionsEnabled === true);
}

// ---------- DraftLogic ----------
// Thin dispatcher -- see the "League types" comment near the top of this file. Delegates every
// method to whichever league type's draftStrategy is active; today that's always
// SnakeDraftStrategy, so behavior is unchanged from before this split.
class DraftLogic {
  static syncOrder(state){ return getLeagueType(state).draftStrategy.syncOrder(state); }
  static currentTurn(state){ return getLeagueType(state).draftStrategy.currentTurn(state); }
  static isStarted(state){ return getLeagueType(state).draftStrategy.isStarted(state); }
  static forceStart(state){ return getLeagueType(state).draftStrategy.forceStart(state); }
  static reorder(state, fromIdx, toIdx){ return getLeagueType(state).draftStrategy.reorder(state, fromIdx, toIdx); }
  static move(state, idx, delta){ return getLeagueType(state).draftStrategy.move(state, idx, delta); }
  static pick(state, castawayId){ return getLeagueType(state).draftStrategy.pick(state, castawayId); }
  static undo(state, castawayId){ return getLeagueType(state).draftStrategy.undo(state, castawayId); }
}

// ---------- RosterLogic: players, tribes, castaways, league settings ----------
class RosterLogic {
  // Both of these are EXCLUSIVE-ownership concepts and stay that way: in a shared-ownership league
  // nothing is ever removed from availability (every pick offers the full cast every time), so
  // there is no such thing as a free agent. Shared-mode draft/roster UI simply doesn't call these.
  static freeAgents(state){ return state.castaways.filter(c=>leagueOwnersOf(state, c).length===0 && c.status==='active'); }
  static activeOwnedCount(state, playerId){ return state.castaways.filter(c=>ownerListOf(c).includes(playerId) && c.status==='active').length; }
  static totalCastCount(state){ return state.castaways.length; }

  // Joining after the draft has already fully concluded has no fair turn order to slot into, so
  // the new player starts inactive (no roster, excluded from draftOrder/scoring) until the
  // commissioner manually activates them via activatePlayer(). Joining before/during the draft
  // is unaffected -- they just fold into the normal snake order as always.
  // opts.automated: a computer player (src/lib/game/bot-logic.js), which makes its own moves until a
  // person takes the seat over.
  static addPlayer(state, name, opts){
    const newPlayer = { id:Core.uid('p'), name, color: PALETTE[state.players.length % PALETTE.length], disabled:false, active:true };
    if(opts && opts.automated) newPlayer.automated = true;
    const turn = DraftLogic.currentTurn(state); // reflects players/draftOrder BEFORE this one is added
    const late = !newPlayer.automated && GhostLogic.allowed(state) && GhostLogic.isUnderway(state);
    state.players.push(newPlayer);
    if(late){
      // A late joiner: invisible to the league, and they choose where to start (GhostLogic).
      newPlayer.ghost = true;
      newPlayer.lateJoin = { startEpisode: null, catchingUp: true };
    }else if(turn && turn.isComplete){
      newPlayer.active = false;
    }else{
      state.draftOrder.push(newPlayer.id);
    }
    return newPlayer;
  }
  // Commissioner-only override for a player who joined after the draft concluded: directly
  // assigns chosen free agents (not a live snake pick -- there's no fair turn order left) and
  // marks the player active, folding them into draftOrder for future Replenish/Trade rounds.
  static activatePlayer(state, playerId, castawayIds){
    const p = Core.getPlayer(state, playerId);
    if(!p) return null;
    (castawayIds||[]).forEach(cid=>{
      const c = Core.getCastaway(state, cid);
      if(c && leagueOwnersOf(state, c).length===0){ Core.setOwner(state, cid, playerId); c.acquiredVia = 'draft'; }
    });
    p.active = true;
    if(!state.draftOrder.includes(playerId)) state.draftOrder.push(playerId);
    return p;
  }
  static updatePlayer(state, id, field, value){ const p=Core.getPlayer(state,id); if(p) p[field]=value; }
  static removePlayer(state, id){
    state.castaways.forEach(c=>{ Core.removeOwner(state, c.id, id); });
    state.players = state.players.filter(p=>p.id!==id);
    state.draftOrder = state.draftOrder.filter(pid=>pid!==id);
  }
  // Used when a player leaves mid-draft (self-serve) or an admin removes them: the roster slot,
  // its history, and any points it already earned all stay intact and keep counting -- only the
  // name changes and the seat is flagged disabled, so nobody can draft/bet/predict as them again.
  // The original name and (when given) the account it was unlinked from are kept so the same
  // account can reclaim the seat later (reclaimPlayer). Disabling an already-disabled seat keeps
  // the first formerName rather than overwriting it with a disabled_player_#### name.
  static disablePlayer(state, playerId, disabledFromUserId){
    const p = Core.getPlayer(state, playerId);
    if(!p) return null;
    const suffix = Math.floor(1000 + Math.random()*9000);
    if(!p.disabled) p.formerName = p.name;
    p.name = 'disabled_player_' + suffix;
    p.disabled = true;
    if(disabledFromUserId) p.disabledFromUserId = disabledFromUserId;
    return p;
  }
  // Restores a disabled player's original name/active status when the same account (matched by
  // disabledFromUserId, not name -- names are guessable, account ids aren't) rejoins the league.
  // Does NOT touch ownerIds/status/placementOrder/points -- those were never cleared by
  // disablePlayer, so there's nothing to restore there; this only undoes the disable/rename.
  static reclaimPlayer(state, playerId){
    const p = Core.getPlayer(state, playerId);
    if(!p || !p.disabled) return null;
    p.name = p.formerName || p.name;
    delete p.formerName;
    delete p.disabledFromUserId;
    p.disabled = false;
    return p;
  }
  static addTribe(state, name, color){
    const t = {id:Core.uid('t'), name, color};
    state.tribes.push(t);
    return t;
  }
  static updateTribe(state, id, field, value){ const t=Core.getTribe(state,id); if(t) t[field]=value; }
  static removeTribe(state, id){
    state.castaways.forEach(c=>{
      if(c.tribeId===id) c.tribeId=null;
      if(c.startTribeId===id) c.startTribeId=null;
    });
    // Moves into it now read as "no group", so a later recompute can't point back at a tribe that's gone.
    state.episodes.forEach(ep=>(ep.groups||[]).forEach(g=>{ if(g.tribeId===id) g.tribeId=null; }));
    state.tribes = state.tribes.filter(t=>t.id!==id);
  }
  static addCastaway(state, name){
    const c = {id:Core.uid('c'), name, tribeId:null, ownerIds:[], photoUrl:'', status:'active', placementOrder:null, exitMethod:null, exitEpisodeId:null, replenishClaimed:false, acquiredVia:null, formerOwnerId:null, departedVia:null};
    state.castaways.push(c);
    return c;
  }
  // seasonCastId is refused here: this is the generic field setter the league's castaway PATCH route
  // calls with whatever the client sends, and the link to the season cast is only ever set by
  // matching (planSeasonCastLinks) -- a hand-set one would let a league claim to BE someone else.
  static updateCastaway(state, id, field, value){
    if(field === 'seasonCastId') return;
    const c=Core.getCastaway(state,id); if(c) c[field]=value;
  }
  static removeCastaway(state, id){ state.castaways = state.castaways.filter(c=>c.id!==id); }
  // Applies a commissioner-approved cast proposal from the wiki connector (see db/wiki-sync.js).
  //
  // ADDITIVE ONLY, matched on name case-insensitively: anything already in the league is left
  // exactly as it is, never overwritten. Two reasons, and the second is the important one:
  //   1. A commissioner may have already typed part of the cast by hand, possibly with their own
  //      spellings or photo URLs, and an import shouldn't discard that.
  //   2. Overwriting would mean deleting and recreating castaways, which changes their ids -- and
  //      ids are what castaway.ownerIds, episode.events, episode.picks, episode.lineups and
  //      episode.scoringEvents all reference. Replacing a drafted cast would silently orphan every
  //      one of those. Additive can't.
  // Returns what it actually added, so the route can tell the commissioner rather than making them
  // diff it themselves.
  //
  // A row carrying an `id` is a season_cast row (src/lib/server/season-cast.ts): someone already
  // linked to it (castaway.seasonCastId) is skipped whatever their name is now, and anyone created
  // from it is born linked. A row without one (a league's own "Import a cast" paste) matches by name
  // only, as it always has.
  static applyCastImport(state, proposal){
    const added = { tribes: [], castaways: [], skipped: [] };
    const sameName = (a, b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
    (proposal.tribes || []).forEach(t=>{
      if(!t || !t.name) return;
      if(state.tribes.some(x=>sameName(x.name, t.name))) return;
      const created = RosterLogic.addTribe(state, t.name, t.color || PALETTE[state.tribes.length % PALETTE.length]);
      added.tribes.push(created.name);
    });
    (proposal.castaways || []).forEach(c=>{
      if(!c || !c.name) return;
      if(c.id && state.castaways.some(x=>x.seasonCastId===c.id)){ added.skipped.push(c.name); return; }
      if(state.castaways.some(x=>sameName(x.name, c.name))){ added.skipped.push(c.name); return; }
      const created = RosterLogic.addCastaway(state, c.name);
      if(c.id) created.seasonCastId = c.id;
      if(c.photoUrl) created.photoUrl = c.photoUrl;
      if(c.tribeName){
        const t = state.tribes.find(x=>sameName(x.name, c.tribeName));
        if(t) created.tribeId = t.id;
      }
      added.castaways.push(created.name);
    });
    return added;
  }
  // Applies the starting-tribe half of a cast import to castaways ALREADY in the league.
  //
  // applyCastImport can't do this: it skips anyone already present (deliberately -- it must never
  // rewrite a castaway, because ids are referenced by rosters, picks and events), so a league that
  // received its cast without tribes and is later told what they were would get the tribes created
  // and nobody in them. That's the shape catch-up mode needs, though: a league playing from episode
  // 0 shouldn't be handed the starting division before the premiere reveals it, and should get it
  // the moment it does -- see season_cast.tribes_from_episode and the reveal route.
  //
  // Additive like everything else here: a castaway who already has a tribe keeps it (a commissioner
  // may have sorted them by hand), tribes that already exist are reused rather than duplicated, and
  // running it twice changes nothing the second time.
  static applyCastTribes(state, proposal){
    const result = { tribes: [], linked: [], unchanged: [] };
    const sameName = (a, b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
    (proposal.castaways || []).forEach(c=>{
      if(!c || !c.name || !c.tribeName) return;
      // A season_cast row (with an id) finds its castaway by the link first, so a rename can't lose it.
      const castaway = (c.id && state.castaways.find(x=>x.seasonCastId===c.id)) ||
        state.castaways.find(x=>sameName(x.name, c.name) && (!c.id || !x.seasonCastId));
      if(!castaway) return;                       // not in this league; nothing to link
      // Someone who has already moved (GroupLogic) with no starting group on record gets it filled in
      // underneath their moves; otherwise a group already set is left alone.
      const startMissing = castaway.startTribeId === null;
      if(castaway.tribeId && !startMissing){ result.unchanged.push(castaway.name); return; }
      let tribe = state.tribes.find(t=>sameName(t.name, c.tribeName));
      if(!tribe){
        tribe = RosterLogic.addTribe(state, c.tribeName, PALETTE[state.tribes.length % PALETTE.length]);
        result.tribes.push(tribe.name);
      }
      if(startMissing){ castaway.startTribeId = tribe.id; GroupLogic.recompute(state, castaway.id); }
      else castaway.tribeId = tribe.id;
      result.linked.push(castaway.name);
    });
    return result;
  }
  // ---- the link from a league's castaway to its season's cast (docs/PLAN-universal-season-cast.md) ----
  //
  // castaway.seasonCastId is the season_cast row a castaway IS. Once it's set, the season cast finds
  // its people by it rather than by name, so renaming someone in the season cast renames them here
  // instead of adding a second person. Nothing else keys on it: owners, picks, lineups and events
  // all reference the league's own castaway.id, which a link never changes.
  //
  // Works out which castaways go with which season_cast rows, without changing anything -- the
  // linking pass (db/link-season-cast.js) prints this as its dry-run report, and applySeasonCastLinks
  // writes it. Tiers, each strictly one-to-one:
  //   id        -- already linked; kept as it is.
  //   exact     -- the same name ignoring case and outer spaces (applyCastImport's own test for "this
  //                person is already here", so linking on it is no bolder than what an approve does).
  //   forgiving -- only with { forgiving: true }: Core.findCastawayByName, and only when it agrees in
  //                BOTH directions (the row's name finds exactly one free castaway, and that
  //                castaway's name finds exactly that row among every row in the cast). A one-way
  //                match is how "Jess" would end up as Jess White when the season also has a Jess
  //                Smith -- a wrong link hands someone's drafted castaway a different identity.
  // Anything left over is reported, never guessed: `unmatched` rows, `ambiguous` rows (with the
  // candidates), and `unlinked` castaways nobody claimed (an extra a league added by hand).
  static planSeasonCastLinks(state, cast, opts = {}){
    const sameName = (a, b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
    const castaways = state.castaways || [];
    const rows = (cast || []).filter(r => r && r.id && r.name);
    const plan = { links: [], unmatched: [], ambiguous: [], unlinked: [] };
    const claimed = new Set();
    const link = (row, c, how) => {
      claimed.add(c.id);
      plan.links.push({ seasonCastId: row.id, seasonName: row.name, castawayId: c.id, castawayName: c.name, how });
    };
    // Linked to a row that's no longer in the cast (an admin removed it) still counts as taken: that
    // person is somebody, just not anybody in this list, and must not be handed to another row.
    castaways.forEach(c => { if(c.seasonCastId) claimed.add(c.id); });

    let pending = [];
    rows.forEach(row => {
      const c = castaways.find(x => x.seasonCastId === row.id);
      if(c) link(row, c, 'id'); else pending.push(row);
    });

    // One tier at a time: collect every row's candidates first, so two rows reaching for the same
    // castaway both become ambiguous instead of the first one winning.
    // candidatesFor returns the castaways a row reaches, or { hits, refuse: true } for a match that
    // mustn't be taken even if it's the only one (it failed the reverse check) -- still reported as
    // ambiguous with its candidate, so whoever reviews it sees who it nearly was.
    const tier = (how, candidatesFor) => {
      const found = pending.map(row => {
        const got = candidatesFor(row, castaways.filter(c => !claimed.has(c.id)));
        return Array.isArray(got) ? { row, hits: got, refuse: false } : { row, hits: got.hits, refuse: true };
      });
      const reach = {};
      found.forEach(f => { if(f.hits.length === 1) reach[f.hits[0].id] = (reach[f.hits[0].id] || 0) + 1; });
      const left = [];
      found.forEach(f => {
        if(f.hits.length === 1 && !f.refuse && reach[f.hits[0].id] === 1) link(f.row, f.hits[0], how);
        else if(f.hits.length >= 1) plan.ambiguous.push({ seasonCastId: f.row.id, seasonName: f.row.name, how, candidates: f.hits.map(c => c.name) });
        else left.push(f.row);
      });
      // A row that's ambiguous at this tier stays ambiguous: a looser tier would only guess harder.
      pending = left;
    };
    tier('exact', (row, free) => free.filter(c => sameName(c.name, row.name)));
    if(opts.forgiving){
      const asCast = { castaways: rows.map(r => ({ id: r.id, name: r.name })) };
      tier('forgiving', (row, free) => {
        const found = Core.findCastawayByName({ castaways: free }, row.name);
        if(found.ambiguous) return free.filter(c => found.ambiguous.includes(c.name));
        if(!found.castaway) return [];
        const back = Core.findCastawayByName(asCast, found.castaway.name);
        return back.castaway && back.castaway.id === row.id ? [found.castaway] : { hits: [found.castaway] };
      });
    }
    plan.unmatched = pending.map(row => ({ seasonCastId: row.id, seasonName: row.name }));
    plan.unlinked = castaways.filter(c => !claimed.has(c.id)).map(c => ({ castawayId: c.id, castawayName: c.name }));
    return plan;
  }
  // Writes a plan's new links (everything but 'id', which is already there). Nothing else changes.
  static applySeasonCastLinks(state, plan){
    const done = [];
    (plan.links || []).forEach(l => {
      if(l.how === 'id') return;
      const c = Core.getCastaway(state, l.castawayId);
      if(!c || c.seasonCastId) return;
      c.seasonCastId = l.seasonCastId;
      done.push(c.name);
    });
    return done;
  }
  // Brings every LINKED castaway in line with their season_cast row: the name, the photo, and -- when
  // `withTribes` (the league may see starting tribes yet; see season-cast.ts's tribesDue) -- the
  // starting tribe. This is what makes the season cast the one copy: an admin's rename, new photo or
  // starting-tribe fix reaches every league in place.
  //
  // Careful in the ways the rest of this class is: it never touches anyone unlinked, never removes
  // anyone, never clears a photo the season has none for, never renames onto a name another castaway
  // already has (reported as a conflict instead), and a starting-tribe fix rewrites only the starting
  // group -- moves recorded since (GroupLogic) still decide where they are now. A castaway with no
  // starting tribe yet is applyCastTribes' job, not a fix, and is left to it.
  static syncSeasonCast(state, cast, opts = {}){
    const sameName = (a, b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
    const result = { renamed: [], photos: [], retribed: [], conflicts: [] };
    (cast || []).forEach(row => {
      if(!row || !row.id || !row.name) return;
      const c = state.castaways.find(x => x.seasonCastId === row.id);
      if(!c) return;
      if(c.name !== row.name){
        if(state.castaways.some(x => x !== c && sameName(x.name, row.name))) result.conflicts.push({ from: c.name, to: row.name });
        else { result.renamed.push({ from: c.name, to: row.name }); c.name = row.name; }
      }
      if(row.photoUrl && c.photoUrl !== row.photoUrl){ c.photoUrl = row.photoUrl; result.photos.push(c.name); }
      if(opts.withTribes && row.tribeName){
        const startId = c.startTribeId !== undefined ? c.startTribeId : c.tribeId;
        const start = startId ? Core.getTribe(state, startId) : null;
        if(start && !sameName(start.name, row.tribeName)){
          const tribe = GroupLogic.tribeNamed(state, row.tribeName);
          if(c.startTribeId !== undefined){ c.startTribeId = tribe.id; GroupLogic.recompute(state, c.id); }
          else c.tribeId = tribe.id;
          result.retribed.push({ name: c.name, from: start.name, to: tribe.name });
        }
      }
    });
    return result;
  }
  // Applies a season's cast (season_cast rows: { id, name, tribeName, photoUrl }) to one league:
  // src/lib/server/season-cast.ts's applyCastToState is this plus the tribes-due check, and
  // db/link-season-cast.js previews with it. In order, each step additive and idempotent:
  //   1. link anyone unlinked whose name is exactly a row's (planSeasonCastLinks, exact tier only);
  //   2. bring linked castaways in line with their row (syncSeasonCast: name, photo, starting tribe);
  //   3. add whoever the league doesn't have yet (applyCastImport), born linked -- EXCEPT a row an
  //      unlinked castaway here might already be (a forgiving or ambiguous match, "Jess" for "Jess
  //      White"): adding it would give the league the same person twice, so it's `needsReview`, for
  //      the reviewed linking pass, and arrives on a later apply once nobody unlinked could be them;
  //   4. give a starting tribe to anyone with none yet (applyCastTribes).
  // `withTribes` false strips the division entirely -- no tribe list, no tribeName -- which is what a
  // league that may not see the starting tribes yet gets. Empty tribes are never created: a tribe with
  // nobody in it is a spoiler of its own (it names the division and how many there are).
  static applySeasonCast(state, cast, opts = {}){
    const withTribes = !!opts.withTribes;
    const payload = (rows, tribes) => {
      const list = [];
      if(tribes) rows.forEach(c => {
        if(c.tribeName && !list.some(t => t.name.toLowerCase() === c.tribeName.toLowerCase())) list.push({ name: c.tribeName });
      });
      return { tribes: list, castaways: rows.map(c => ({ id: c.id, name: c.name, tribeName: tribes ? c.tribeName : null, photoUrl: c.photoUrl })) };
    };
    const linked = RosterLogic.applySeasonCastLinks(state, RosterLogic.planSeasonCastLinks(state, cast));
    const synced = RosterLogic.syncSeasonCast(state, cast, { withTribes });
    const maybe = RosterLogic.planSeasonCastLinks(state, cast, { forgiving: true });
    const held = new Set([
      ...maybe.links.filter(l => l.how === 'forgiving').map(l => l.seasonCastId),
      ...maybe.ambiguous.map(a => a.seasonCastId),
    ]);
    const added = RosterLogic.applyCastImport(state, payload(cast.filter(c => !held.has(c.id)), withTribes));
    const tribed = withTribes ? RosterLogic.applyCastTribes(state, payload(cast, true)).linked : [];
    const needsReview = cast.filter(c => held.has(c.id)).map(c => c.name);
    return { ...added, linked, synced, needsReview, tribed };
  }
  // Whether removing this castaway would strand anything: an owner, or any reference anywhere else in
  // the league -- results, picks, lineups, the mid-season log, finale picks, whatever comes next. A
  // castaway id is a random token (Core.uid), so "appears anywhere in the state outside its own record"
  // is an exact test that can't fall behind as new kinds of reference are added. Used before a season
  // cast removal reaches a league (season-cast.ts's removeUnlinkedRows).
  static castawayInUse(state, castawayId){
    const c = Core.getCastaway(state, castawayId);
    if(!c) return false;
    if((c.ownerIds || []).length) return true;
    const rest = { ...state, castaways: state.castaways.filter(x => x.id !== castawayId) };
    return JSON.stringify(rest).includes(JSON.stringify(castawayId));
  }
  // Whether a league may see its season's starting tribes yet. src/lib/server/season-cast.ts's
  // tribesDue documents the rule and is what the app calls; it lives here so the bare-node linking
  // pass (db/link-season-cast.js) reads the same one.
  static castTribesDue(state, tribesFromEpisode){
    if(tribesFromEpisode == null) return true;
    const revealed = RevealLogic.revealedThrough(state);
    if(revealed !== null) return revealed >= tribesFromEpisode;
    return (state.episodes || []).some(ep => ep.number >= tribesFromEpisode && EpisodeLogic.hasResults(ep));
  }
  // The secret-role half of a cast import (formats/cast-prompt.js), a sibling of applyCastTribes: for
  // each castaway matched by name, records their role as a fact at `episode` -- the same
  // { episode, name, role } fact traitors.js's wikiRoles() produces for an original Traitor, landing in
  // episode.roles, so the existing reveal-gating governs it with nothing new. Run it AFTER
  // applyCastImport in the same write: matching by name means anyone that call creates must exist first.
  //
  // Additive and safe to re-run: someone who already has a role at that episode keeps it, and a role
  // that isn't one of the format's values is refused (RoleLogic.add) rather than recorded as written.
  static applyCastRoles(state, proposal, episode = 1){
    const result = { recorded: [], unchanged: [], unresolved: [] };
    const roles = formatOf(state).roles;
    const sameName = (a, b) => String(a||'').trim().toLowerCase() === String(b||'').trim().toLowerCase();
    const rows = (proposal.castaways || []).filter(c => c && c.name && roles && roles.values.includes(c.role));
    if(!rows.length) return result;
    const ep = EpisodeLogic.ensureEpisodeNumber(state, episode, false);
    rows.forEach(c=>{
      const castaway = state.castaways.find(x=>sameName(x.name, c.name));
      if(!castaway){ result.unresolved.push(c.name); return; }
      if(RoleLogic.add(state, ep.id, castaway.id, c.role)) result.recorded.push(castaway.name);
      else result.unchanged.push(castaway.name);
    });
    return result;
  }
  static updateSettings(state, field, value){
    // Generic setter (the PATCH route passes whatever the UI sends), with one normalized field:
    // revealedThroughEpisode decides what a league is allowed to SEE, so a junk value must not
    // quietly become a number that lets more through than the commissioner picked. See RevealLogic.
    if(field === 'revealedThroughEpisode') value = RevealLogic.normalize(value);
    if(field === 'allowLateJoiners') value = value !== false;
    // Switching ownership moves every point value still at the OLD mode's default to the new mode's
    // default; anything a commissioner set by hand stays exactly as they set it.
    if(field === 'ownershipMode' && value !== state.settings.ownershipMode && state.settings.eventPoints){
      const before = defaultEventPoints(state, ownershipModeOf(state));
      const after = defaultEventPoints(state, value === 'shared' ? 'shared' : 'exclusive');
      const pts = { ...state.settings.eventPoints };
      Object.keys(after).forEach(id => { if(pts[id] === undefined || pts[id] === before[id]) pts[id] = after[id]; });
      state.settings.eventPoints = pts;
    }
    if(field === 'eventPoints' && value && typeof value === 'object'){
      const clean = {};
      Object.keys(value).forEach(id => {
        const n = Number(value[id]);
        clean[id] = Number.isFinite(n) ? roundPoints(n) : 0;
      });
      value = clean;
    }
    if(field === 'defaultBetPoints') value = clampBetPoints(value);
    if(field === 'startEpisode'){
      const n = Math.floor(Number(value));
      value = Number.isFinite(n) && n >= 1 ? n : 1;
    }
    state.settings[field]=value;
    // Active Roster defaults to shared ownership: nobody gets shut out of a castaway they wanted, and
    // lineups (not exclusivity) are where the skill is. Only while the league is still in guided
    // setup -- an established league never has its ownership changed under it -- and the commissioner
    // can still pick exclusive in the next setup step.
    if(field === 'leagueTypeId' && value === 'active-roster' && !SetupLogic.isComplete(state) && state.settings.ownershipMode !== 'shared'){
      RosterLogic.updateSettings(state, 'ownershipMode', 'shared');
    }
    // A start episode that isn't on the schedule yet is created, so picks and lineups have somewhere
    // to go before it airs.
    if(field === 'startEpisode') EpisodeLogic.ensureEpisodeNumber(state, value, false);
  }
}

// ---------- MidSeasonLogic: who may add whom, and in what order ----------
// Shared by Replenish and Swap.
//
// WHO IS AVAILABLE. Exclusive ownership: anyone still in the game that nobody owns (a free agent).
// Shared ownership has no free agents -- nobody is ever taken off the board -- so there it's anyone
// still in the game who isn't already on THIS player's roster. Same moves, one rule per mode.
//
// PRIORITY (settings.replenishOrderBy), for who goes first in a round:
//   'rolling'     -- the default. Starts in reverse draft order; whoever actually makes a move goes to
//                    the back, and the list carries over from round to round (a rolling waiver list:
//                    being patient keeps you near the front).
//   'leastPoints' -- standings, fewest points first, recomputed every round (a catch-up reset).
//   'mostPoints'  -- standings, most points first (the old default; rewards a strong draft).
// Order only decides anything when two players want the same castaway, which happens in exclusive
// leagues. In a shared league everyone can add the same person, so it just orders the queue.
class MidSeasonLogic {
  static isShared(state){ return !!(state.settings && state.settings.ownershipMode === 'shared'); }
  static availableFor(state, playerId){
    return state.castaways.filter(c => c.status === 'active' && (MidSeasonLogic.isShared(state)
      ? !ownerListOf(c).includes(playerId)
      : leagueOwnersOf(state, c).length === 0));
  }
  static isAvailableFor(state, castawayId, playerId){
    return MidSeasonLogic.availableFor(state, playerId).some(c => c.id === castawayId);
  }
  // Reverse draft order: last pick in the draft gets first dibs. A shared (blind) draft has no pick
  // order, so the player list stands in for it.
  static reverseDraftOrder(state){
    const active = state.players.filter(inLeagueRotation).map(p => p.id);
    const drafted = (state.draftOrder || []).filter(id => active.includes(id));
    const base = drafted.length ? [...drafted, ...active.filter(id => !drafted.includes(id))] : active;
    return [...base].reverse();
  }
  static priorityList(state){
    const active = state.players.filter(inLeagueRotation).map(p => p.id);
    const saved = ((state.midSeason && state.midSeason.priority) || []).filter(id => active.includes(id));
    const fresh = MidSeasonLogic.reverseDraftOrder(state).filter(id => !saved.includes(id));
    return [...saved, ...fresh];
  }
  // Orders a set of player ids by the league's priority rule.
  static order(state, playerIds){
    const mode = state.settings.replenishOrderBy || 'rolling';
    if(mode === 'rolling'){
      const list = MidSeasonLogic.priorityList(state);
      return [...playerIds].sort((a,b) => list.indexOf(a) - list.indexOf(b));
    }
    const scores = ScoringLogic.compute(state);
    const scoreOf = id => (scores.find(s => s.playerId === id) || { total: 0 }).total;
    const dir = mode === 'leastPoints' ? 1 : -1;
    const tiebreak = MidSeasonLogic.reverseDraftOrder(state);
    return [...playerIds].sort((a,b) => dir * (scoreOf(a) - scoreOf(b)) || tiebreak.indexOf(a) - tiebreak.indexOf(b));
  }
  // After a real move (not a skip) on a rolling list, that player goes to the back.
  static usedPriority(state, playerId){
    if((state.settings.replenishOrderBy || 'rolling') !== 'rolling') return;
    const list = MidSeasonLogic.priorityList(state).filter(id => id !== playerId);
    list.push(playerId);
    state.midSeason.priority = list;
  }

  // ---- Active Roster's replenish threshold ----
  // settings.replenishAt: a roster down to this many castaways still in the game may replenish back
  // up to one more than it (default: one fewer than the active slots, i.e. the moment you can no
  // longer field a full lineup -- replenish keeps everyone playing, it doesn't rebuild a bench).
  static replenishAt(state){
    const n = state.settings && state.settings.replenishAt;
    const slots = ActiveRosterLogic.activeSlots(state);
    if(Number.isInteger(n) && n >= 0) return Math.min(n, Math.max(0, rosterSize(state) - 1));
    return Math.max(0, slots - 1);
  }
  static inGameCount(state, playerId){
    return state.castaways.filter(c => c.status === 'active' && ownerListOf(c).includes(playerId)).length;
  }
  /** How many replenish picks this player is owed right now (Active Roster). */
  // Once nobody is left in the game (the season is over) there's nothing to replenish or swap for.
  static seasonOver(state){ return !state.castaways.some(c => c.status === 'active'); }
  static replenishNeed(state, playerId){
    if(MidSeasonLogic.seasonOver(state)) return 0;
    const inGame = MidSeasonLogic.inGameCount(state, playerId);
    const at = MidSeasonLogic.replenishAt(state);
    return inGame <= at ? (at + 1) - inGame : 0;
  }

  // ---- Active Roster's swap schedule ----
  // settings.swapEvery: a swap window opens after every Nth episode the league plays (default 3).
  // Weekly is too often: it turns the league into chasing whoever won immunity last week, and makes
  // the draft matter less. Every three episodes is four or five windows in a normal season -- enough
  // to fix a bad pick or react to the merge.
  static swapEvery(state){
    const n = Number(state.settings && state.settings.swapEvery);
    return Number.isInteger(n) && n >= 1 ? n : 3;
  }
  /** { due, afterEpisode, nextAfterEpisode } -- whether a swap window is open now, and the next one. */
  static swapWindow(state){
    const every = MidSeasonLogic.swapEvery(state);
    const start = startEpisode(state);
    const last = lastCompletedEpisode(state);
    const done = (state.midSeason && state.midSeason.lastSwapAfterEpisode) || 0;
    const windowAt = k => start - 1 + k * every;
    let latest = null;
    if(last !== null){
      const k = Math.floor((last - start + 1) / every);
      if(k >= 1) latest = windowAt(k);
    }
    const due = latest !== null && latest > done && !MidSeasonLogic.seasonOver(state);
    const nextAfterEpisode = due ? latest : windowAt((latest === null ? 0 : Math.floor((latest - start + 1) / every)) + 1);
    return { due, afterEpisode: due ? latest : null, nextAfterEpisode };
  }
}

// ---------- ReplenishLogic ----------
class ReplenishLogic {
  static start(state){
    const scores = ScoringLogic.compute(state);
    const scoreOf = playerId => (scores.find(s=>s.playerId===playerId)||{total:0}).total;
    const winnerMethod = formatOf(state).winnerExitMethod;
    const activeRoster = getLeagueType(state).hasActiveRoster;
    const counts = state.players.map(p=>{
      const losses = state.castaways.filter(c=> ownerListOf(c).includes(p.id) && c.status==='eliminated' && !c.replenishClaimed && c.exitMethod!==winnerMethod);
      if(!activeRoster) return {playerId:p.id, losses, picks: losses.length, score: scoreOf(p.id)};
      // Active Roster: only a roster down to the threshold is owed picks, and only enough to get back
      // above it. Each pick releases one of their eliminated castaways (oldest first) when they have
      // one, so a roster never grows past its size.
      const picks = MidSeasonLogic.replenishNeed(state, p.id);
      const oldestFirst = [...losses].sort((a,b) => (a.placementOrder||0) - (b.placementOrder||0));
      return {playerId:p.id, losses: oldestFirst.slice(0, picks), picks, score: scoreOf(p.id)};
    }).filter(x=>x.picks>0);
    if(counts.length===0) return false;
    // Order among them: the league's priority rule (see MidSeasonLogic).
    const ranked = MidSeasonLogic.order(state, counts.map(x=>x.playerId));
    counts.sort((a,b)=> ranked.indexOf(a.playerId) - ranked.indexOf(b.playerId));
    // Build one pick PER TURN in snake order across players -- not everyone's whole allotment
    // consecutively -- so someone owed 2+ picks can't claim the top 2 free agents before anyone
    // else gets a turn. Direction reverses each round exactly like the original draft, same reason:
    // whoever picks last in a round shouldn't also always pick last (or first) in every round.
    const order = counts.map(x=>x.playerId);
    const lossIdsByPlayer = {};
    const scoreByPlayer = {};
    const picksByPlayer = {};
    counts.forEach(x=>{ lossIdsByPlayer[x.playerId] = x.losses.map(c=>c.id); scoreByPlayer[x.playerId] = x.score; picksByPlayer[x.playerId] = x.picks; });
    const maxPicks = Math.max(...counts.map(x=>x.picks));
    const sequence = [];
    for(let round=0; round<maxPicks; round++){
      const roundOrder = round % 2 === 0 ? order : [...order].reverse();
      roundOrder.forEach(playerId=>{
        if(picksByPlayer[playerId] > round) sequence.push({playerId, scoreAtStart: scoreByPlayer[playerId]});
      });
    }
    // lossIdsByPlayer entries are only marked replenishClaimed as each pick is actually assigned
    // (see ReplenishLogic.assign), so canceling mid-round never burns an unused credit.
    state.midSeason.replenish = { sequence, index:0, lossIdsByPlayer };
    return true;
  }
  // Mirrors DraftLogic.currentTurn's shape (playerId/personalPickNumber/overallPickNumber/isComplete)
  // so the UI can reuse the same turn-banner treatment as the original draft.
  static currentTurn(state){
    const r = state.midSeason.replenish;
    if(!r) return null;
    if(r.index >= r.sequence.length) return { isComplete:true };
    const turn = r.sequence[r.index];
    const personalPickNumber = r.sequence.slice(0, r.index).filter(t=>t.playerId===turn.playerId).length + 1;
    return { isComplete:false, playerId: turn.playerId, personalPickNumber, overallPickNumber: r.index+1, scoreAtStart: turn.scoreAtStart };
  }
  static assign(state, castawayId){
    const r = state.midSeason.replenish;
    if(!r || r.index>=r.sequence.length) return;
    const c = Core.getCastaway(state, castawayId);
    const turn = r.sequence[r.index];
    if(!c || !MidSeasonLogic.isAvailableFor(state, castawayId, turn.playerId)) return;
    const shared = MidSeasonLogic.isShared(state);
    if(shared) Core.addOwner(state, castawayId, turn.playerId);
    else Core.setOwner(state, castawayId, turn.playerId);
    c.acquiredVia = 'replenish';
    const lossIds = r.lossIdsByPlayer[turn.playerId] || [];
    const lossId = lossIds.pop();
    const lostCastaway = lossId ? Core.getCastaway(state, lossId) : null;
    if(lostCastaway){
      lostCastaway.replenishClaimed = true;
      // The replenish pick replaces this slot, so its points no longer count for this player —
      // but formerOwnerId/departedVia keep the history so the Scoreboard can still show it.
      // formerOwnerId stays a single id (history display only, not scoring).
      lostCastaway.formerOwnerId = turn.playerId;
      lostCastaway.departedVia = 'replenish';
      // Shared: only this player lets go; anyone else who owns them keeps them.
      if(shared) Core.removeOwner(state, lostCastaway.id, turn.playerId);
      else Core.setOwner(state, lostCastaway.id, null);
    }
    MidSeasonLogic.usedPriority(state, turn.playerId);
    // `|| []`: league rows are read from Postgres without migrateLeagueState, so a league that
    // predates the log (and 0008's backfill) has no array to push onto yet.
    (state.midSeason.log = state.midSeason.log || []).push({
      id: Core.uid('tx'), type:'replenish', playerId: turn.playerId,
      addedCastawayId: castawayId, droppedCastawayId: lostCastaway ? lostCastaway.id : null,
      at: new Date().toISOString(), episode: lastCompletedEpisode(state)
    });
    r.index++;
  }
  static cancel(state){ state.midSeason.replenish=null; }
}

// ---------- TradeLogic ----------
class TradeLogic {
  // Active Roster runs swaps on a schedule (MidSeasonLogic.swapWindow): a round can only start while
  // a window is open, and starting it closes that window. Returns false when there's no window.
  static start(state){
    const activeRoster = getLeagueType(state).hasActiveRoster;
    if(activeRoster){
      const w = MidSeasonLogic.swapWindow(state);
      if(!w.due) return false;
      state.midSeason.lastSwapAfterEpisode = w.afterEpisode;
    }
    const active = state.players.filter(inLeagueRotation).map(p => p.id);
    const order = MidSeasonLogic.order(state, active);
    state.midSeason.trade = { queue: order.map(id=>({playerId:id})), index:0 };
    return true;
  }
  static swap(state, dropId, addId){
    const t = state.midSeason.trade;
    if(!t || t.index>=t.queue.length) return;
    const turn = t.queue[t.index];
    const drop = Core.getCastaway(state, dropId), add = Core.getCastaway(state, addId);
    // Both halves or neither: a swap that could only drop (or only add) isn't the swap asked for.
    const canDrop = drop && Core.isOwnedBy(state, dropId, turn.playerId) && drop.status==='active';
    const canAdd = add && MidSeasonLogic.isAvailableFor(state, addId, turn.playerId);
    if(!canDrop || !canAdd) return;
    drop.formerOwnerId = turn.playerId;
    drop.departedVia = 'trade';
    Core.removeOwner(state, dropId, turn.playerId);
    if(MidSeasonLogic.isShared(state)) Core.addOwner(state, addId, turn.playerId);
    else Core.setOwner(state, addId, turn.playerId);
    add.acquiredVia = 'trade';
    MidSeasonLogic.usedPriority(state, turn.playerId);
    (state.midSeason.log = state.midSeason.log || []).push({
      id: Core.uid('tx'), type:'trade', playerId: turn.playerId,
      addedCastawayId: addId, droppedCastawayId: dropId,
      at: new Date().toISOString(), episode: lastCompletedEpisode(state)
    });
    t.index++;
  }
  static skip(state){ const t=state.midSeason.trade; if(!t) return; t.index++; }
  static cancel(state){ state.midSeason.trade=null; }
}

// ---------- EpisodeLogic: episodes + eliminations ----------
class EpisodeLogic {
  // The shape of a new episode, in ONE place. add(), ensureUpcoming() and the wiki import all create
  // episodes, and they used to each spell out this literal -- so a new per-episode field had to be
  // remembered in three places or it would be missing from episodes created by two of the three
  // paths. Creating through here also always carries lineups forward, which is what the Active Roster
  // league type expects of any episode however it came to exist.
  static create(state, number, postMerge){
    // `events` is eliminations; `exiled` is the inert who-was-sent-away record (see addExiled);
    // `roles` is who took on a secret role this episode (see RoleLogic); `groups` is who changed tribe
    // or team (see GroupLogic).
    const ep = { id:Core.uid('ep'), number, postMerge: !!postMerge, events:[], exiled:[], roles:[], groups:[], bets:[], picks:[], scoringEvents:[], lineups:{}, lineupsLocked:false };
    state.episodes.push(ep);
    // Active Roster: start this episode's lineups from the previous one's so players adjust rather
    // than retype. No-op for every other league type (nothing has lineups to carry).
    ActiveRosterLogic.carryForwardLineups(state, ep.id);
    return ep;
  }
  static add(state){
    const maxNum = state.episodes.length ? Math.max(...state.episodes.map(e=>e.number)) : 0;
    const previousEp = state.episodes.find(e=>e.number===maxNum);
    // Once the season hits the merge, every later episode is post-merge too — carry the flag forward.
    return EpisodeLogic.create(state, maxNum+1, previousEp ? previousEp.postMerge : false);
  }
  // An episode "has results" once anything that happened in it is recorded: an elimination, a
  // scoring event, an exile, a role or a group change. That's what "this episode has been played"
  // means everywhere below.
  static hasResults(ep){
    return !!ep && ((ep.events||[]).length > 0 || (ep.scoringEvents||[]).length > 0 || (ep.exiled||[]).length > 0
      || (ep.roles||[]).length > 0 || (ep.groups||[]).length > 0);
  }
  // Whether THIS league has started playing -- the League Settings lock on show, league type and
  // ownership, which exists so a switch can't orphan what the league has done in its current setup:
  // a draft, Pick'em picks, Active Roster lineups.
  //
  // Episode results deliberately DON'T count. They arrive from the season's admin decisions the
  // moment a live league picks a season that has already aired, and they mean the same thing under
  // every league type -- counting them locked League Type before a new league had even chosen one.
  // (Changing the show or season takes back the old season's applied results; see the settings route.)
  static seasonUnderway(state){
    if(DraftLogic.isStarted(state)) return true;
    return state.episodes.some(ep =>
      (ep.picks||[]).length > 0 || Object.values(ep.lineups||{}).some(ids => (ids||[]).length > 0));
  }
  // Live mode's half of ensureNextEpisode: the latest episode is the upcoming one until it has
  // results, then the next one is created. Stops once a winner is crowned (the format's winner exit
  // method -- Survivor's is Sole Survivor).
  static ensureUpcoming(state){
    const winnerMethod = formatOf(state).winnerExitMethod;
    const seasonOver = state.castaways.some(c => c.exitMethod === winnerMethod);
    if(seasonOver) return false;
    const maxNum = state.episodes.length ? Math.max(...state.episodes.map(e=>e.number)) : 0;
    const latest = state.episodes.find(e=>e.number===maxNum);
    if(latest && !EpisodeLogic.hasResults(latest)) return false;
    EpisodeLogic.create(state, maxNum+1, latest ? latest.postMerge : false);
    return true;
  }
  // THE rule: there is always an episode to play next, so bets, picks and lineups always have
  // somewhere to go without anyone creating an episode by hand. Enforced server-side after every
  // league write (withLeagueLock), at league creation, and on load for leagues that predate it.
  //
  //   catching up -- the next episode is the one after the reveal pointer: it exists (so it can be
  //                  bet on) but its results stay hidden until it's revealed. Revealing it creates
  //                  the one after.
  //   live        -- the latest episode, until it has results; then the next one (ensureUpcoming).
  //
  // Once a winner is crowned nothing more is created, and any trailing episode that is completely
  // empty (no results, bets or picks) and numbered after the winner's episode is removed -- the
  // reveal of the finale creates a "next" episode before anyone has confirmed the winner, and it
  // shouldn't outlive that. Returns true if it changed anything.
  static ensureNextEpisode(state){
    if(!Array.isArray(state.episodes)) state.episodes = [];
    const winnerMethod = formatOf(state).winnerExitMethod;
    const winner = (state.castaways||[]).find(c => c.exitMethod === winnerMethod);
    if(winner){
      const finale = state.episodes.find(e => e.id === winner.exitEpisodeId);
      if(!finale) return false;
      const before = state.episodes.length;
      state.episodes = state.episodes.filter(e =>
        e.number <= finale.number || EpisodeLogic.hasResults(e) || (e.bets||[]).length > 0 || (e.picks||[]).length > 0);
      return state.episodes.length !== before;
    }
    const revealed = RevealLogic.revealedThrough(state);
    if(revealed !== null){
      const next = revealed + 1;
      if(state.episodes.some(e => e.number === next)) return false;
      const prev = state.episodes.find(e => e.number === revealed);
      EpisodeLogic.ensureEpisodeNumber(state, next, prev ? prev.postMerge : false);
      return true;
    }
    return EpisodeLogic.ensureUpcoming(state);
  }
  // ---------- wiki import: eliminations and scoring events (connector phase 2) ----------
  // Both of these are the apply half of a reviewed proposal (db/wiki-sync.js -> wiki_proposals ->
  // commissioner confirms). Both are ADDITIVE and IDEMPOTENT, for the same reason applyCastImport is:
  // re-running a scheduled import, or applying a second proposal that overlaps the first, must never
  // rewrite what's already there. Anything already recorded is reported as skipped, not replaced.
  //
  // Names are resolved HERE rather than being baked into the proposal as ids, matching cast import:
  // a proposal can sit pending while the cast changes, and a stale id would be silently wrong where a
  // stale name simply fails to resolve and gets reported.

  // Finds the league's episode with this number, creating it (and any gap before it) if missing.
  // Episodes are created in ascending order so postMerge and lineup carry-forward both inherit from
  // the right predecessor.
  static ensureEpisodeNumber(state, number, postMerge, created){
    const existing = state.episodes.find(e => e.number === number);
    if(existing) return existing;
    const maxNum = state.episodes.length ? Math.max(...state.episodes.map(e=>e.number)) : 0;
    for(let n = maxNum + 1; n <= number; n++){
      const prev = state.episodes.find(e => e.number === n - 1);
      // A filled gap inherits its predecessor's merge state; the requested episode uses what the
      // proposal says, since that's the one the wiki actually told us about.
      const flag = n === number ? postMerge : (prev ? prev.postMerge : false);
      const ep = EpisodeLogic.create(state, n, flag);
      if(created) created.push(ep.number);
    }
    return state.episodes.find(e => e.number === number);
  }

  static applyEliminationsImport(state, proposal){
    const result = { episodesCreated: [], eliminations: [], skipped: [], unresolved: [] };
    // Ascending, because addElimination assigns placementOrder sequentially from what's already
    // recorded -- applying episode 7 before episode 3 would invert the finishing order.
    const episodes = [...(proposal.episodes || [])].sort((a,b) => a.number - b.number);
    episodes.forEach(pe => {
      if(!pe || typeof pe.number !== 'number') return;
      const ep = EpisodeLogic.ensureEpisodeNumber(state, pe.number, pe.postMerge, result.episodesCreated);
      if(pe.title && !ep.title) ep.title = pe.title;
      if(pe.airDate && !ep.airDate) ep.airDate = pe.airDate;
      (pe.eliminations || []).forEach(el => {
        const { castaway } = Core.findCastawayByName(state, el && el.name);
        if(!castaway){ result.unresolved.push(String((el && el.name) || '?')); return; }
        // Already out -- from an earlier import, or entered by hand. Either way, leave it alone: its
        // placementOrder and exitEpisodeId are already correct and re-recording would double-count.
        if(castaway.status === 'eliminated'){ result.skipped.push(castaway.name); return; }
        EpisodeLogic.addElimination(state, ep.id, castaway.id, el.method);
        result.eliminations.push({ episode: ep.number, name: castaway.name, method: el.method });
      });
    });
    return result;
  }

  static applyScoringEventsImport(state, proposal){
    const result = { episodesCreated: [], events: [], skipped: [], unresolved: [] };
    const episodes = [...(proposal.episodes || [])].sort((a,b) => a.number - b.number);
    episodes.forEach(pe => {
      if(!pe || typeof pe.number !== 'number') return;
      const ep = EpisodeLogic.ensureEpisodeNumber(state, pe.number, pe.postMerge, result.episodesCreated);
      (pe.events || []).forEach(sev => {
        const { castaway } = Core.findCastawayByName(state, sev && sev.name);
        if(!castaway){ result.unresolved.push(String((sev && sev.name) || '?')); return; }
        // Idempotency is per (episode, type, castaway): the same person can legitimately have two
        // different event types in one episode, but not the same one twice.
        const already = (ep.scoringEvents || []).some(x => x.type === sev.type && x.castawayId === castaway.id);
        if(already){ result.skipped.push(`${castaway.name} (${sev.type}, ep ${ep.number})`); return; }
        // addEvent rejects a type that isn't in the format's catalog, so an unknown type can't land
        // here even if it survived the connector's own validation.
        const added = ActiveRosterLogic.addEvent(state, ep.id, sev.type, castaway.id);
        if(added) result.events.push({ episode: ep.number, name: castaway.name, type: sev.type });
        else result.skipped.push(`${castaway.name} (unknown event type "${sev.type}")`);
      });
    });
    return result;
  }

  static renumberPlacements(state){
    const eliminated = state.castaways.filter(c=>c.status==='eliminated' && typeof c.placementOrder==='number');
    eliminated.sort((a,b)=>a.placementOrder-b.placementOrder);
    eliminated.forEach((c,i)=> c.placementOrder = i+1);
  }
  static remove(state, epId){
    const ep = state.episodes.find(e=>e.id===epId);
    if(ep){
      ep.events.forEach(ev=>{
        const c = Core.getCastaway(state, ev.castawayId);
        if(c){ c.status='active'; c.placementOrder=null; c.exitMethod=null; c.exitEpisodeId=null; c.replenishClaimed=false; }
      });
    }
    state.episodes = state.episodes.filter(e=>e.id!==epId);
    EpisodeLogic.renumberPlacements(state);
  }
  static update(state, epId, field, value){ const ep=state.episodes.find(e=>e.id===epId); if(ep) ep[field]=value; }
  static nextPlacementOrder(state){
    const used = state.castaways.filter(c=>typeof c.placementOrder==='number').map(c=>c.placementOrder);
    return (used.length ? Math.max(...used) : 0) + 1;
  }
  // `juryVotes`: for a finalist (lost Final Tribal, or won it), the jury votes they received --
  // Survivor scores each one (format.impliedEvents). Omitted when unknown or not a finalist.
  static addElimination(state, epId, castawayId, method, juryVotes){
    const ep = state.episodes.find(e=>e.id===epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c || c.status==='eliminated') return;
    const order = EpisodeLogic.nextPlacementOrder(state);
    c.status='eliminated'; c.placementOrder=order; c.exitMethod=method; c.exitEpisodeId=epId;
    const ev = {castawayId, method};
    if(Number.isInteger(juryVotes) && juryVotes >= 0) ev.juryVotes = juryVotes;
    ep.events.push(ev);
  }
  // Sets (or clears, with null) a recorded elimination's jury votes -- research can know them after
  // the elimination itself was applied.
  static setJuryVotes(state, epId, castawayId, juryVotes){
    const ep = state.episodes.find(e=>e.id===epId);
    const ev = ep && (ep.events||[]).find(e => e.castawayId === castawayId);
    if(!ev) return false;
    if(Number.isInteger(juryVotes) && juryVotes >= 0) ev.juryVotes = juryVotes;
    else delete ev.juryVotes;
    return true;
  }
  static removeElimination(state, epId, castawayId){
    const ep = state.episodes.find(e=>e.id===epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c) return;
    ep.events = ep.events.filter(ev=>ev.castawayId!==castawayId);
    c.status='active'; c.placementOrder=null; c.exitMethod=null; c.exitEpisodeId=null; c.replenishClaimed=false;
    EpisodeLogic.renumberPlacements(state);
  }
  // Exile Island and its equivalents: sent away from their tribe for an episode, still very much in
  // the game. This records the fact and nothing else: no owner change, no tribe change, no
  // placement. The one thing that reads ep.exiled is the format's impliedEvents (Survivor's
  // wentToExile), which a league scores at whatever it chooses -- 0 by default.
  //
  // Why 0 by default: what exile is WORTH is a live question (the twist is new this season and its
  // effect on the game isn't settled), and the wiki connector -- an extraction tool -- is the wrong
  // place to invent an answer. Recording it as a fact means that when a league does settle on a
  // value, the history is already sitting in state instead of needing every past episode re-read.
  // It's also the honest reason a castaway can show up in an episode's wiki data without being
  // eliminated, which is exactly the confusion that produced the season 51 misread.
  static addExiled(state, epId, castawayId){
    const ep = state.episodes.find(e=>e.id===epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c) return;
    ep.exiled = ep.exiled || [];
    if(ep.exiled.some(x=>x.castawayId===castawayId)) return;
    ep.exiled.push({castawayId, at: new Date().toISOString()});
  }
  static removeExiled(state, epId, castawayId){
    const ep = state.episodes.find(e=>e.id===epId);
    if(!ep) return;
    ep.exiled = (ep.exiled||[]).filter(x=>x.castawayId!==castawayId);
  }
}

// ---------- BetLogic: side bets + predictions ----------
// A prediction is worth 1 to MAX_BET_POINTS (whole points). Predictions are near coin flips, so the
// spread they add to the standings grows with their value: at about one a week, 3 points each puts
// predictions at roughly a quarter of what decides a Classic league -- a real side game, not the
// decider -- while an uncapped 10-pointer would put a quarter of the league on a single question.
const MAX_BET_POINTS = 3;
function clampBetPoints(v){
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX_BET_POINTS, Math.max(1, n)) : 1;
}
class BetLogic {
  static add(state, epId, label, points, createdByPlayerId){
    const ep = state.episodes.find(e=>e.id===epId);
    if(!ep || !label) return;
    ep.bets = ep.bets || [];
    const bet = { id: Core.uid('bet'), label, points: clampBetPoints(points), predictions: [], createdByPlayerId: createdByPlayerId || null };
    ep.bets.push(bet);
    return bet;
  }
  // Only a prediction's wording and value are editable -- never its id or the guesses on it.
  static update(state, epId, betId, field, value){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    if(!bet) return;
    if(field === 'points') bet.points = clampBetPoints(value);
    else if(field === 'label' && typeof value === 'string' && value.trim()) bet.label = value.trim();
  }
  static remove(state, epId, betId){
    const ep = state.episodes.find(e=>e.id===epId);
    if(ep) ep.bets = ep.bets.filter(b=>b.id!==betId);
  }
  static addPrediction(state, epId, betId, playerId, guess){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    if(!bet || !guess) return;
    bet.predictions = bet.predictions || [];
    const pred = { id: Core.uid('pred'), playerId, guess, correct: null };
    bet.predictions.push(pred);
    return pred;
  }
  static removePrediction(state, epId, betId, predId){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    if(bet) bet.predictions = bet.predictions.filter(p=>p.id!==predId);
  }
  // Which episode a new side bet belongs to when someone proposes one from the Overview: the one
  // about to be played. A league catching up bets on the next episode it hasn't revealed yet; a live
  // league bets on its latest episode. Returns a NUMBER, not an episode, because in a brand-new league
  // there may be no episode at all yet -- see addToUpcoming.
  static upcomingEpisodeNumber(state){
    const next = RevealLogic.nextEpisode(state);
    if(next !== null) return next;
    const nums = state.episodes.map(e=>e.number);
    return nums.length ? Math.max(...nums) : 1;
  }
  // Proposing a bet from the Overview. Creates the target episode first if it doesn't exist -- a new
  // league has no episodes until the first one is opened or revealed, and a bet proposed before then
  // used to have nothing to attach to and failed with a bare "Request failed".
  static addToUpcoming(state, label, points, createdByPlayerId){
    const number = BetLogic.upcomingEpisodeNumber(state);
    const ep = EpisodeLogic.ensureEpisodeNumber(state, number, false);
    return BetLogic.add(state, ep.id, label, points, createdByPlayerId);
  }
  static setPredictionCorrect(state, epId, betId, predId, value){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    const pred = bet && bet.predictions.find(p=>p.id===predId);
    if(pred) pred.correct = value===true || value==='true' ? true : (value===false || value==='false' ? false : null);
  }
}

// ---------- FinaleLogic ----------
class FinaleLogic {
  static getOrCreatePrediction(state, playerId){
    let fp = state.finalePredictions.find(f=>f.playerId===playerId);
    if(!fp){ fp = {playerId, top3:[null,null,null], winner:null}; state.finalePredictions.push(fp); }
    return fp;
  }
  static setPick(state, playerId, idx, value){
    const fp=FinaleLogic.getOrCreatePrediction(state,playerId);
    // The same castaway can't fill two Top-3 slots -- ScoringLogic counts each slot independently,
    // so a duplicate would double-count one person's correct guess.
    if(value && fp.top3.some((id,i)=>i!==idx && id===value)) return;
    fp.top3[idx]=value;
  }
  static setWinnerPick(state, playerId, value){ const fp=FinaleLogic.getOrCreatePrediction(state,playerId); fp.winner=value; }
  static setActualTop3(state, idx, value){
    if(value && state.finaleActual.top3.some((id,i)=>i!==idx && id===value)) return;
    state.finaleActual.top3[idx]=value;
  }
  static setActualWinner(state, value){ state.finaleActual.winner=value; }
}

// ---------- SetupLogic: guided first-time setup ----------
// A brand-new league has to answer five questions before anything else in League Settings means
// much: what it's called, which show, which season, which league type, and (for roster types) how
// ownership works. Until those are answered, entering a cast is premature -- the cast depends on the
// season -- and the type/ownership pickers lock themselves the moment a draft runs or an episode is
// logged, so getting them wrong is expensive to undo.
//
// So the Setup tab reveals these one at a time, in this order, and hides the rest of the tab until
// they're done. This is the ORDERING and DONE-NESS logic for that, kept here rather than in the
// component so it's testable without React and so the same definition of "answered" is used by the
// reveal, the checklist and the gate.
//
// Backward compatibility: `setupComplete` is false only on leagues created after this shipped
// (defaultState sets it). Every league that predates it has no such key, and `isComplete` treats
// anything that isn't an explicit `false` as complete -- an established league is never sent back
// through setup just because it never set a wikiSeason.
// ---------- RevealLogic ----------
// Catch-up mode: how much of a season a league is allowed to see.
//
// The wiki connector reads a WHOLE season at once (db/wiki-sync.js), which is right for the data
// and wrong for a league that starts in week 4: its first sync would hand the commissioner every
// elimination to date before anyone has drafted. A league that wants to play episode 1 as though it
// were airing tonight needs the app to forget what it knows for a while.
//
// That's this: one integer per league, settings.revealedThroughEpisode.
//
//   null  -- LIVE. No gate. Every league behaved this way before catch-up existed, and every
//            existing league still does (absent reads as null, so there's no migration).
//   0..n  -- CATCHING UP. Episodes 1..n are visible; n+1 and beyond do not exist as far as this
//            league is concerned. 0 is the starting line -- nothing revealed yet.
//
// Deliberately NOT a per-episode snapshot of the wiki payload, which was the other way to do this.
// Snapshots only work for a season somebody was already tracking before it premiered, which is
// exactly the case this feature ISN'T for, and there's nothing spoiler-bearing to snapshot that
// isn't already keyed by episode: the episode extraction carries an episode number on every
// decision, and the cast extraction reads only name, original tribe and photo -- all pre-premiere
// facts (it never looks at the wiki's Finish column). So the gate derives from the one shared
// season extraction instead, which means one model call still serves a caught-up league and a
// spoiler-free one at the same time. See docs/PLAN-spoiler-free-catch-up.md.
//
// Enforced where results reach a league: src/lib/server/season-decisions.ts applies a season's
// accepted decisions only up to this pointer, and the reveal route -- the only thing that moves it,
// and only ever forward -- applies the newly revealed episode's.
class RevealLogic {
  // The pointer, or null for live mode. Anything stored that isn't a non-negative integer reads as
  // live, matching how an older league with no such setting at all behaves.
  static revealedThrough(state){
    const v = (state.settings || {}).revealedThroughEpisode;
    return Number.isInteger(v) && v >= 0 ? v : null;
  }
  static isCatchingUp(state){ return RevealLogic.revealedThrough(state) !== null; }
  // True once the revealed results have crowned a winner (results only land in state when their
  // episode is revealed, so a winner here is one the league has seen). Nothing is left to reveal
  // then -- without this the panel kept offering "episode N+1" past the finale.
  static isComplete(state){
    const winnerMethod = formatOf(state).winnerExitMethod;
    return (state.castaways||[]).some(c => c.exitMethod === winnerMethod);
  }
  // The episode a reveal would show next, or null in live mode (nothing to reveal -- it's already
  // all visible).
  static nextEpisode(state){
    const r = RevealLogic.revealedThrough(state);
    return r === null ? null : r + 1;
  }
  // Whether this league may see a given episode number. Live mode says yes to everything.
  static isRevealed(state, episodeNumber){
    const r = RevealLogic.revealedThrough(state);
    return r === null || Number(episodeNumber) <= r;
  }
  // Advances by one and returns the new pointer. Refuses in live mode rather than inventing a
  // starting point -- "reveal the next episode" means nothing when nothing is hidden. One-way by
  // design: once the room knows, it knows, and the decisions may already be applied.
  static revealNext(state){
    const r = RevealLogic.revealedThrough(state);
    if(r === null || RevealLogic.isComplete(state)) return null;
    state.settings.revealedThroughEpisode = r + 1;
    return r + 1;
  }
  // What updateSettings stores. null/''/undefined mean live; anything numeric is floored and
  // clamped at 0; anything else is refused back to live rather than guessed at.
  static normalize(value){
    if(value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if(!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  }
}

// ---------- SpoilerLogic: one viewer's results, held back until they tap Reveal ----------
// Per PERSON, unlike RevealLogic's per-league catch-up pointer: each member has a "seen through
// episode N" mark (league_memberships.results_seen_through), and the app displays the league as it
// stood then -- results of any later episode taken out of a COPY of the state, so standings,
// scoreboard, board, episode cards and grading all read as though those episodes hadn't been played.
// Nothing here is written back; the real state is untouched. Not a secret, a courtesy: the full
// state is still what the client holds.
class SpoilerLogic {
  // Episodes whose results this viewer hasn't seen yet, oldest first.
  static hiddenEpisodes(state, seenThrough){
    if(seenThrough === null || seenThrough === undefined) return [];
    return state.episodes.filter(e => e.number > seenThrough && EpisodeLogic.hasResults(e)).sort((a,b) => a.number - b.number);
  }
  // The latest episode with results, i.e. what "seen everything" means right now (0 when none).
  static latestWithResults(state){
    return state.episodes.filter(e => EpisodeLogic.hasResults(e)).reduce((m, e) => Math.max(m, e.number), 0);
  }
  // Chat's spoiler window: the first episode past what this viewer has revealed that has started
  // airing -- from its air time on, anyone watching live may be talking about it. { episode, since }
  // or null (opted out, nothing airing, or no schedule to tell when it started). Used by the chat tab
  // (blurs what was posted since) and chat pushes (leave the text out).
  static chatWindow(state, seenThrough, now){
    if(seenThrough === null || seenThrough === undefined) return null;
    const ep = state.episodes
      .filter(e => e.number > seenThrough && hasAired(e, now))
      .sort((a,b) => a.number - b.number)[0];
    return ep ? { episode: ep.number, since: ep.airsAt } : null;
  }
  static viewThrough(state, seenThrough){
    const hidden = SpoilerLogic.hiddenEpisodes(state, seenThrough);
    // A season rule change from an episode this viewer hasn't seen would say a twist is coming
    // (docs/PLAN-season-rule-changes.md, decided 2026-10-06): it's left out of their copy -- offered or
    // adopted -- until they've seen that episode. Scores can't differ for it: everything a change does
    // is gated to its effective episode, and those episodes' results are hidden here anyway.
    const changeHidden = c => Number.isInteger(seenThrough) && c && c.effectiveEpisode > seenThrough;
    const st = state.settings || {};
    const hidesChanges = ['seasonRuleChanges', 'adoptedRuleChanges'].some(k => (st[k] || []).some(changeHidden));
    if(!hidden.length && !hidesChanges) return state;
    const s = JSON.parse(JSON.stringify(state));
    ['seasonRuleChanges', 'adoptedRuleChanges'].forEach(k => {
      if(!s.settings[k]) return;
      s.settings[k] = s.settings[k].filter(c => !changeHidden(c));
      if(!s.settings[k].length) delete s.settings[k];
    });
    const ids = new Set(hidden.map(e => e.id));
    // A merge badge on a hidden episode would say a merge happened: carry the last visible value.
    const visible = s.episodes.filter(e => !ids.has(e.id) && e.number <= seenThrough).sort((a,b) => b.number - a.number)[0];
    s.episodes.forEach(ep => {
      if(!ids.has(ep.id)) return;
      ep.events = []; ep.scoringEvents = []; ep.exiled = []; ep.roles = []; ep.groups = [];
      ep.postMerge = visible ? !!visible.postMerge : false;
      (ep.bets || []).forEach(b => (b.predictions || []).forEach(p => { p.correct = null; }));
      ep.resultsHidden = true;
    });
    s.castaways.forEach(c => {
      if(c.exitEpisodeId && ids.has(c.exitEpisodeId)){
        c.status = 'active'; c.placementOrder = null; c.exitMethod = null; c.exitEpisodeId = null; c.replenishClaimed = false;
      }
      GroupLogic.recompute(s, c.id);
    });
    // The finale's real answers only exist once the winner is out; hidden, they'd spoil the finale.
    const winnerMethod = formatOf(s).winnerExitMethod;
    if(!s.castaways.some(c => c.exitMethod === winnerMethod)) s.finaleActual = { top3: [null, null, null], winner: null };
    return s;
  }
}

// ---------- GhostLogic: late joiners, playing the season from their own start (docs/PLAN-late-joiners.md) ----------
// Someone who joins a league that's already underway, when its commissioner allows late joiners
// (settings.allowLateJoiners). They pick an episode to start from, draft a team from the cast as it
// stood then, and play forward one episode at a time: picks or a lineup for "this week", then reveal
// that week's results, then the next. Or they jump straight to the latest episode.
//
// Two flags on the player, independent on purpose:
//   ghost: true      -- invisible. The rest of the league never sees them (GhostLogic.viewFor strips
//                       them from everyone else's copy); their team is private, so it takes nothing
//                       off the board (leagueOwnersOf) and they sit out the draft order, blind-draft
//                       lock-ins and pickup/swap rounds (inLeagueRotation). Cleared by the
//                       commissioner converting them; some ghosts are never converted, and that's fine.
//   lateJoin: { startEpisode, catchingUp }
//                    -- their own season. startEpisode is null until they've chosen one (and drafted);
//                       catchingUp is true while their "seen through" mark (league_memberships.
//                       results_seen_through) is behind the latest episode with results. Kept after
//                       a conversion, so a converted player still catches up safely.
//
// The spoiler guarantee while catching up lives in viewFor: their copy of the league ENDS at the
// episode after their mark. Nothing later exists for them -- no results, no titles, no episode
// numbers past it, no pickups made since -- and that one episode has no air time, so its lineups and
// picks are open as if it airs tonight. The ordinary reveal can therefore only ever reveal that one
// episode, and the server holds the same line (results-seen refuses to move a catching-up mark by more
// than one unless they asked to jump). Their moves are validated against that same copy (applyAs).
class GhostLogic {
  static isGhost(p){ return isGhost(p); }
  static lateJoinOf(state, playerId){
    const p = Core.getPlayer(state, playerId);
    return p && p.lateJoin ? p.lateJoin : null;
  }
  static isCatchingUp(state, playerId){
    const lj = GhostLogic.lateJoinOf(state, playerId);
    return !!(lj && lj.catchingUp);
  }
  // Whether they still have to pick a start episode (and draft) before they can play.
  static needsStart(state, playerId){
    const lj = GhostLogic.lateJoinOf(state, playerId);
    return !!lj && !Number.isInteger(lj.startEpisode);
  }
  // The episode a player's own season starts at: the league's, or a late joiner's own (later) one.
  static startFor(state, playerId){
    const lj = GhostLogic.lateJoinOf(state, playerId);
    const own = lj && Number.isInteger(lj.startEpisode) ? lj.startEpisode : 1;
    return Math.max(startEpisode(state), own);
  }
  // A league is underway -- too late to just slot in -- once its draft is done or an episode has results.
  static isUnderway(state){
    const turn = DraftLogic.currentTurn(state);
    return !!(turn && turn.isComplete) || SpoilerLogic.latestWithResults(state) > 0;
  }
  // On unless a commissioner switched it off (absent = on, so it covers every league that predates it).
  static allowed(state){ return !(state.settings && state.settings.allowLateJoiners === false); }
  // The episodes a late joiner may start at: the league's first through the one after the latest with
  // results (starting there means joining live, nothing to catch up on).
  static startChoices(state){
    const latest = SpoilerLogic.latestWithResults(state);
    const out = [];
    for(let n = startEpisode(state); n <= latest + 1; n++) out.push(n);
    return out;
  }
  // The cast a late joiner starting at `start` drafts from: everyone still in the game before that
  // episode, whoever in the league owns them (a ghost's team is private, so nothing is taken).
  static draftPool(state, start){
    const before = SpoilerLogic.viewThrough(state, Math.max(0, start - 1));
    return before.castaways.filter(c => c.status === 'active').map(c => c.id);
  }
  // How many they draft: the league's roster size, or none for a league type with no draft.
  static teamSize(state){
    return getLeagueType(state).draftStrategy === NoDraftStrategy ? 0 : rosterSize(state);
  }
  // Starts a late joiner's season: their start episode and their team. Returns a reason on refusal.
  static begin(state, playerId, start, castawayIds){
    const p = Core.getPlayer(state, playerId);
    if(!p || !p.lateJoin) return 'Not a late joiner';
    if(Number.isInteger(p.lateJoin.startEpisode)) return 'Already started';
    if(!GhostLogic.startChoices(state).includes(start)) return 'Pick an episode from the list';
    const ids = Array.isArray(castawayIds) ? castawayIds : [];
    const need = GhostLogic.teamSize(state);
    const pool = GhostLogic.draftPool(state, start);
    if(new Set(ids).size !== ids.length) return 'Same pick listed twice';
    if(ids.some(id => !pool.includes(id))) return 'Pick from who was still in the game';
    // Late in a season there may be fewer left than a full roster; take everyone then.
    if(ids.length !== Math.min(need, pool.length)) return 'Pick ' + Math.min(need, pool.length);
    ids.forEach(id => Core.addOwner(state, id, playerId));
    p.lateJoin.startEpisode = start;
    p.lateJoin.catchingUp = start - 1 < SpoilerLogic.latestWithResults(state);
    return null;
  }
  // Their mark reached the latest results (or they jumped there): from now on they play live.
  static markCaughtUp(state, playerId, seenThrough){
    const lj = GhostLogic.lateJoinOf(state, playerId);
    if(lj && lj.catchingUp && seenThrough >= SpoilerLogic.latestWithResults(state)) lj.catchingUp = false;
  }
  // The commissioner brings a ghost into the league: visible to everyone, in the draft order for
  // pickup/swap rounds. Their team and points come with them. In an exclusive-ownership league a
  // castaway they share with someone stays shared -- the one place exclusivity bends.
  static convert(state, playerId){
    const p = Core.getPlayer(state, playerId);
    if(!p || !p.ghost) return false;
    delete p.ghost;
    p.active = true;
    if(!state.draftOrder.includes(playerId)) state.draftOrder.push(playerId);
    return true;
  }

  // The league as one viewer may see it. `viewerId` is their player (null for none); `seenThrough`
  // their spoiler mark (null = sees everything). Never mutates `state`.
  //   - Everyone: every ghost but themselves taken out, as if they'd never joined.
  //   - A late joiner catching up: the league ends at the episode after their mark (see the class note).
  //   - Then the usual spoiler view (SpoilerLogic.viewThrough) at their mark.
  // opts.full: the copy the reveal works from instead (the client's fullState) -- the same, except
  // their week's results are still in it, so the reveal has something to show. Never later ones.
  static viewFor(state, viewerId, seenThrough, opts){
    const full = !!(opts && opts.full);
    const others = new Set((state.players || []).filter(p => isGhost(p) && p.id !== viewerId).map(p => p.id));
    const catchingUp = GhostLogic.isCatchingUp(state, viewerId) && Number.isInteger(seenThrough);
    if(!others.size && !catchingUp) return full ? state : SpoilerLogic.viewThrough(state, seenThrough);
    let s = JSON.parse(JSON.stringify(state));
    if(others.size) GhostLogic.stripPlayers(s, others);
    if(catchingUp || !full) s = SpoilerLogic.viewThrough(s, full ? seenThrough + 1 : seenThrough);
    if(catchingUp) GhostLogic.rewindTo(s, seenThrough);
    return s;
  }
  // The late joiners a commissioner manages (Players & invites), from the real state.
  static ghosts(state){ return (state.players || []).filter(p => isGhost(p) && !p.disabled); }
  static stripPlayers(s, ids){
    const keep = id => !ids.has(id);
    s.players = s.players.filter(p => keep(p.id));
    s.draftOrder = (s.draftOrder || []).filter(keep);
    s.castaways.forEach(c => {
      c.ownerIds = ownerListOf(c).filter(keep);
      if(c.formerOwnerId && !keep(c.formerOwnerId)) c.formerOwnerId = null;
    });
    s.episodes.forEach(ep => {
      ids.forEach(id => { if(ep.lineups) delete ep.lineups[id]; });
      ep.picks = (ep.picks || []).filter(pk => keep(pk.playerId));
      (ep.bets || []).forEach(b => { b.predictions = (b.predictions || []).filter(pr => keep(pr.playerId)); });
    });
    s.finalePredictions = (s.finalePredictions || []).filter(fp => keep(fp.playerId));
    if(s.midSeason){
      if(s.midSeason.log) s.midSeason.log = s.midSeason.log.filter(tx => keep(tx.playerId));
      if(s.midSeason.priority) s.midSeason.priority = s.midSeason.priority.filter(keep);
    }
  }
  // Ends a (spoiler-trimmed) copy at episode seen+1, which plays as though it airs tonight.
  static rewindTo(s, seen){
    const now = seen + 1;
    // A league in catch-up mode (RevealLogic) is somewhere ahead of them; to them it's simply live at
    // their week -- its pointer would say how far the season has run.
    if(s.settings) s.settings.revealedThroughEpisode = null;
    s.episodes = s.episodes.filter(ep => ep.number <= now);
    s.episodes.forEach(ep => {
      if(ep.number < now) return;
      delete ep.airsAt;
      ep.lineupsLocked = false;
      // A title can give the episode away ("The Blindside"); the number is enough.
      ep.title = null; ep.airDate = null;
    });
    // Pickups and swaps made after their mark: undone, newest first. A pickup says someone left.
    const ms = s.midSeason;
    if(ms){
      const later = (ms.log || []).filter(tx => Number.isInteger(tx.episode) && tx.episode > seen);
      [...later].reverse().forEach(tx => {
        const added = Core.getCastaway(s, tx.addedCastawayId);
        if(added) added.ownerIds = ownerListOf(added).filter(id => id !== tx.playerId);
        const dropped = tx.droppedCastawayId && Core.getCastaway(s, tx.droppedCastawayId);
        if(dropped && !ownerListOf(dropped).includes(tx.playerId)) dropped.ownerIds = [...ownerListOf(dropped), tx.playerId];
      });
      ms.log = (ms.log || []).filter(tx => !later.includes(tx));
      // A round open now was opened by results they haven't seen.
      ms.replenish = null; ms.trade = null;
    }
  }
  // Runs one of a late joiner's own moves (a lineup, a pick) against the league as THEY see it, then
  // copies just their part of the episode back. That's what makes their week's lineup open when the
  // real episode aired long ago, and their eligibility follow the cast as it stood then.
  static applyAs(state, playerId, seenThrough, epId, fn){
    const view = GhostLogic.viewFor(state, playerId, seenThrough);
    const vEp = view.episodes.find(e => e.id === epId);
    const ep = state.episodes.find(e => e.id === epId);
    if(!vEp || !ep) return 'That episode is ahead of you';
    if(vEp.number !== seenThrough + 1) return 'Only this week’s episode is open';
    const result = fn(view);
    if(vEp.lineups && Object.prototype.hasOwnProperty.call(vEp.lineups, playerId)){
      ep.lineups = ep.lineups || {};
      ep.lineups[playerId] = vEp.lineups[playerId];
    }
    ep.picks = [...(ep.picks || []).filter(pk => pk.playerId !== playerId), ...(vEp.picks || []).filter(pk => pk.playerId === playerId)];
    return typeof result === 'string' ? result : null;
  }
}

// ---------- RuleChangeLogic: a commissioner's say over season rule changes ----------
// docs/PLAN-season-rule-changes.md. An admin approves a change for a whole season; every league on it
// is OFFERED it (settings.seasonRuleChanges, server-written), and a league scores only what its
// commissioner ADOPTS (settings.adoptedRuleChanges, each a frozen snapshot) -- decided 2026-10-06: in a
// running league, whether a new rule scores, and for how much, is the commissioner's call. Declining is
// remembered per version (settings.declinedRuleChanges), so an admin's later edit is offered again.
//
// Pure: the league route (api/leagues/:id/rule-changes) wraps these with the database side -- applying
// the season's results again after an adopt, so ones that needed the new events land, and forgetting
// the ledger entries a remove takes back.
class RuleChangeLogic {
  static offered(state){ return (state.settings && state.settings.seasonRuleChanges) || []; }
  static adopted(state){ return (state.settings && state.settings.adoptedRuleChanges) || []; }
  static declined(state){ return (state.settings && state.settings.declinedRuleChanges) || []; }

  // Offered changes waiting on the commissioner: not adopted at this version, and not declined at it.
  static pending(state){
    const adopted = RuleChangeLogic.adopted(state);
    const declined = RuleChangeLogic.declined(state);
    return RuleChangeLogic.offered(state).filter(c =>
      !adopted.some(a => a.id === c.id && (a.version || 1) >= (c.version || 1)) &&
      !declined.some(d => d.id === c.id && (d.version || 1) >= (c.version || 1)));
  }
  // Each adopted change with where it stands against what's offered now: 'current', 'updated' (the
  // admin has edited it since; the league still plays the version it adopted) or 'withdrawn'.
  static adoptedStatus(state){
    const offered = RuleChangeLogic.offered(state);
    return RuleChangeLogic.adopted(state).map(a => {
      const o = offered.find(c => c.id === a.id);
      return { change: a, status: !o ? 'withdrawn' : (o.version || 1) > (a.version || 1) ? 'updated' : 'current' };
    });
  }
  // What adopting `change` would leave out, against this league's rules without it (its own copy may
  // already have something the change adds): [{ change, what, why }]. Throws for a malformed change.
  static fit(state, change){
    const others = RuleChangeLogic.adopted(state).filter(a => a.id !== change.id);
    const base = formatOf({ ...state, settings: { ...state.settings, adoptedRuleChanges: [] } });
    return Formats.applyChanges(base.data, [...others, change]).skipped.filter(s => s.change === change.id);
  }
  // The points a new event starts at in this league: the change's suggestion, by ownership mode.
  static suggestedPoints(state, ev){ return defaultPointsFor(ev, ownershipModeOf(state)); }

  // Adopts the OFFERED change `id` (its current version), replacing any older version this league
  // adopted, with `points` (eventId -> number) for the events it adds; an event left out keeps the
  // change's suggestion. Returns { change, skipped } or null when nothing like that is offered.
  static adopt(state, id, points){
    const change = RuleChangeLogic.offered(state).find(c => c.id === id);
    if(!change) return null;
    const skipped = RuleChangeLogic.fit(state, change);
    const s = state.settings;
    s.adoptedRuleChanges = [...RuleChangeLogic.adopted(state).filter(a => a.id !== id), JSON.parse(JSON.stringify(change))];
    s.declinedRuleChanges = RuleChangeLogic.declined(state).filter(d => d.id !== id);
    if(!s.declinedRuleChanges.length) delete s.declinedRuleChanges;
    const added = ((change.delta && change.delta.addEvents) || []).map(e => e.id);
    const next = { ...(s.eventPoints || {}) };
    for(const eid of added){
      const n = points ? Number(points[eid]) : NaN;
      if(Number.isFinite(n)) next[eid] = roundPoints(n);
    }
    s.eventPoints = next;
    return { change, skipped };
  }
  // Not for this league -- at this version. A later edit by the admin is offered again.
  static decline(state, id){
    const change = RuleChangeLogic.offered(state).find(c => c.id === id);
    if(!change) return false;
    state.settings.declinedRuleChanges = [...RuleChangeLogic.declined(state).filter(d => d.id !== id), { id, version: change.version || 1 }];
    return true;
  }
  // Stops scoring an adopted change: its snapshot goes, and so do the results of the events it added
  // (recorded ones -- implied ones are derived, and vanish with the rules), and their point values.
  // Returns the event ids it took back (the route forgets their ledger entries), or null.
  static remove(state, id){
    const a = RuleChangeLogic.adopted(state).find(x => x.id === id);
    if(!a) return null;
    const added = ((a.delta && a.delta.addEvents) || []).map(e => e.id);
    const s = state.settings;
    s.adoptedRuleChanges = RuleChangeLogic.adopted(state).filter(x => x.id !== id);
    if(!s.adoptedRuleChanges.length) delete s.adoptedRuleChanges;
    if(s.eventPoints){
      const next = { ...s.eventPoints };
      added.forEach(eid => { delete next[eid]; });
      s.eventPoints = next;
    }
    const gone = new Set(added);
    state.episodes.forEach(ep => { if(ep.scoringEvents) ep.scoringEvents = ep.scoringEvents.filter(ev => !gone.has(ev.type)); });
    return added;
  }
}

class SetupLogic {
  // Ordered, and the order is the point: each step is only offered once its predecessor is answered.
  //
  // `applies` lets a step drop out entirely for a league type it's meaningless for, rather than
  // asking a Pick'em commissioner to answer an ownership question that has no effect.
  //
  // `defaulted` marks the two steps that arrive pre-filled. Name/show/season are genuinely blank
  // until someone answers them; league type and ownership can't be, because getLeagueType() and
  // every strategy lookup have to resolve to something from the first render. So they count as done
  // -- the reveal shouldn't stall on them -- but the UI says "(default)" rather than showing a tick
  // that implies a human chose it. Confirming setup is what turns that into a real decision.
  //
  // `value` is what's currently selected, so the checklist can double as a summary of the answers.
  static steps(state, leagueName){
    const st = state.settings || {};
    const hasSeason = st.wikiSeason !== null && st.wikiSeason !== undefined && st.wikiSeason !== '';
    return [
      { id:'name', label:'Name your league', done: !!(leagueName && String(leagueName).trim()),
        value: leagueName || null },
      { id:'show', label:'Pick the show', done: !!st.showId, value: st.showId || null },
      { id:'season', label:'Pick the season', done: hasSeason, value: hasSeason ? String(st.wikiSeason) : null },
      { id:'type', label:'Choose a league type', done: !!st.leagueTypeId, defaulted: true,
        value: getLeagueType(state).name },
      { id:'ownership', label:'Choose how ownership works', done: !!st.ownershipMode, defaulted: true,
        value: st.ownershipMode, applies: getLeagueType(state).hasRoster },
      // Only worth asking once there IS a season to be behind, and defaulted like type/ownership so
      // it can never stall the guide. It's asked here rather than left to League Settings because
      // it's a decision about a season already in progress -- the answer stops mattering the moment
      // the connector has filed the results the league was trying not to see.
      { id:'pace', label:'Choose when results arrive', done: true, defaulted: true,
        applies: hasSeason,
        value: RevealLogic.isCatchingUp(state)
          ? `catching up, through episode ${RevealLogic.revealedThrough(state)}`
          : 'live' }
    ].filter(s => s.applies !== false);
  }
  // True once a commissioner has confirmed the basics -- or for any league predating guided setup.
  static isComplete(state){ return (state.settings || {}).setupComplete !== false; }
  // Every step answered. Distinct from isComplete: answered-but-not-confirmed is the state in which
  // the "finish setup" affordance appears.
  static basicsAnswered(state, leagueName){ return SetupLogic.steps(state, leagueName).every(s => s.done); }
  // The id of the first unanswered step, or null. Everything after it stays hidden.
  static nextStep(state, leagueName){
    const s = SetupLogic.steps(state, leagueName).find(x => !x.done);
    return s ? s.id : null;
  }
  // Whether a given step's control should be shown yet: answered steps stay visible (so an answer
  // can be changed), and exactly one unanswered step is offered at a time.
  static isStepVisible(state, leagueName, stepId){
    if(SetupLogic.isComplete(state)) return true;
    const steps = SetupLogic.steps(state, leagueName);
    const i = steps.findIndex(s => s.id === stepId);
    if(i < 0) return false;
    return steps.slice(0, i).every(s => s.done);
  }
  // Marks setup done. Idempotent, and deliberately one-way: there's no "unfinish", because the gate
  // exists to guide a new league, not to be a mode someone toggles.
  static complete(state){ state.settings.setupComplete = true; }
}

// ---------- Migrations: default state + backward-compat upgrades for older saved leagues ----------
// Migrates an episode from the old fixed-category prediction schema (predictions[]
// keyed by a settings.bonusCategories id, plus a single actual{} per category) to
// free-text bets: one bet per old category, one prediction per player guess.
// Not part of the public API (never called directly by app.js or any server route) -- only
// Migrations.migrateLeagueState calls it, so it stays a plain function, not a class method.
function migrateEpisodeToBets(ep, oldCategories, castaways, tribes){
  ep.bets = [];
  if(ep.predictions && ep.predictions.length){
    const byCategory = {};
    ep.predictions.forEach(pred=>{
      (byCategory[pred.category] = byCategory[pred.category] || []).push(pred);
    });
    Object.keys(byCategory).forEach(catId=>{
      const catDef = (oldCategories||[]).find(c=>c.id===catId);
      const actualVal = ep.actual ? ep.actual[catId] : null;
      const resolveText = id => {
        const cw = (castaways||[]).find(c=>c.id===id);
        if(cw) return cw.name;
        const tb = (tribes||[]).find(t=>t.id===id);
        return tb ? tb.name : String(id);
      };
      ep.bets.push({
        id: Core.uid('bet'),
        label: catDef ? catDef.label : 'Prediction',
        points: catDef ? catDef.points : 1,
        predictions: byCategory[catId].map(p=>({
          id: Core.uid('pred'),
          playerId: p.playerId,
          guess: resolveText(p.guess),
          correct: actualVal ? (actualVal === p.guess) : null
        }))
      });
    });
  }
  delete ep.predictions;
  delete ep.actual;
}
class Migrations {
  // A brand-new league, with NOTHING assumed about what it's for.
  //
  // This used to seed SEED_CASTAWAYS -- the Survivor 51 cast -- so every new league, whatever show
  // it was actually for, opened with 21 strangers already in it that a commissioner had to delete by
  // hand. A real league's cast comes from the commissioner or the wiki connector; the demo builds
  // its own (buildMockSeasonState). SEED_CASTAWAYS stays exported but is no longer auto-applied.
  //
  // showId is likewise null rather than 'survivor', because nobody has chosen yet and pretending
  // otherwise is what made "pick your show" invisible. leagueTypeId/ownershipMode DO keep working
  // defaults, because getLeagueType() and every strategy lookup must always resolve to something;
  // setupComplete is what tracks whether a commissioner has actually confirmed them -- see
  // setupChecklist below.
  static defaultState(){
    const players = [];
    return {
      players,
      tribes: [],
      castaways: [],
      episodes: [],
      finalePredictions: [],
      finaleActual: { top3: [], winner: null },
      midSeason: { replenish:null, trade:null, log:[] },
      draftOrder: players.map(p=>p.id),
      draftPicksMade: 0,
      draftForceStarted: false,
      // The PUBLIC half of a blind draft (shared ownership mode only, inert otherwise) -- who has
      // locked in and whether the reveal has happened. The picks themselves are deliberately not
      // here; see BlindDraftLogic's comment and db/migrations/0004_blind_draft_picks.sql.
      blindDraft: { lockedPlayerIds: [], revealedAt: null },
      settings: {
        teamSize: 3,
        bonusEnabled: true,
        replenishOrderBy: 'rolling',
        defaultBetPoints: 1,
        finaleTop3Points: 1,
        finaleWinnerPoints: 3,
        finalePredictionScope: 'open',
        draftScheduledAt: null,
        leagueTypeId: 'classic-draft',
        // Null until a commissioner picks one from the admin-managed catalog (/api/shows). Existing
        // leagues hold 'survivor', which is why no migration is needed; only leagues created from
        // here on start unanswered.
        showId: null,
        // The show's format id (shows.format), cached here by the server whenever showId is set, so
        // formatOf() can answer without a database. Null reads as the default format.
        showFormat: null,
        // False ONLY on leagues created after the guided-setup change; absent on every league that
        // predates it, and `!== false` is what the UI tests, so an existing league is never sent
        // back through setup. Flipped true when the commissioner confirms the basics.
        setupComplete: false,
        // Which real season this league is tracking, for the wiki connector (db/wiki-sync.js) to
        // know what to fetch -- e.g. 44 means the "Survivor 44" wiki page. Null until a
        // commissioner sets it; the connector refuses to run without it rather than guessing.
        wikiSeason: null,
        // Catch-up mode (see RevealLogic): null means live -- whatever the wiki knows is offered
        // for review as soon as the connector reads it, which is what every league did before this
        // existed. An integer means the league is deliberately behind: it may see episodes 1..n and
        // nothing past that, so a league formed in week 4 can still play episode 1 as though it
        // were airing tonight. 0 is the starting line.
        revealedThroughEpisode: null,
        // Late joiners (GhostLogic): someone joining once the league is underway plays the season
        // from an episode of their choosing, unseen by the league until the commissioner adds them.
        allowLateJoiners: true,
        // Optional mid-season mechanics, both OFF until a commissioner turns them on -- plenty of
        // leagues never run either. Gated together with the league type's own capability; see
        // replenishAvailable/tradeAvailable above.
        replenishEnabled: false,
        tradeEnabled: false,
        // Same opt-in shape, gated with supportsFinalePredictions; see finalePredictionsAvailable above.
        finalePredictionsEnabled: false,
        // 'exclusive' (one owner per castaway, snake draft) or 'shared' (many owners, blind draft).
        // Roster league types only; see SHARED_OWNERSHIP_VARIANTS for what flipping it changes.
        ownershipMode: 'exclusive',
        // Active Roster only. rosterSize() derives the draft's per-player total from these two for
        // that league type, so they replace teamSize there rather than sitting alongside it.
        activeSlots: 3,
        benchSlots: 2,
        eventPoints: defaultEventPoints(),
        // Pick'em-only, but defaulted for every league (same as finaleTop3Points/etc above being
        // defaulted even for classic-draft leagues that will never read them): a league can
        // switch leagueTypeId, so this should already be sane if it does. Value per the plan doc:
        // "assumed +1 for a correct pick... never explicitly confirmed" -- flagged there, not
        // resolved here; change this default if the real answer turns out to be something else.
        pickemCorrectPoints: 1
      }
    };
  }
  // Applies all backward-compat migrations to a raw parsed state object (from localStorage,
  // an uploaded JSON backup, or a league row) and returns it. Pure — no localStorage access.
  static migrateLeagueState(raw){
    const s = raw;
    // Scalar `ownerId` -> `ownerIds` array (see Core's ownership comment). Runs FIRST because
    // everything below that reads ownership (draftPicksMade, acquiredVia) expects the new shape.
    // Old saves are all exclusive-ownership, so a scalar owner becomes a one-element array.
    // Note this only covers uploaded JSON backups and freshly-imported state -- league rows
    // already in Postgres are converted once by db/migrations/0003_castaway_owner_ids.sql, since
    // withLeagueLock reads leagues.state straight out of the JSONB column without migrating.
    (s.castaways||[]).forEach(c=>{
      if(!Array.isArray(c.ownerIds)) c.ownerIds = c.ownerId ? [c.ownerId] : [];
      delete c.ownerId;
    });
    if(!s.midSeason) s.midSeason = {replenish:null, trade:null, log:[]};
    if(!Array.isArray(s.midSeason.log)) s.midSeason.log = [];
    if(!s.finalePredictions) s.finalePredictions = [];
    if(!s.finaleActual) s.finaleActual = {top3:[], winner:null};
    if(!s.settings.replenishOrderBy) s.settings.replenishOrderBy = 'mostPoints';
    if(!s.settings.defaultBetPoints) s.settings.defaultBetPoints = 1;
    if(!s.settings.finalePredictionScope) s.settings.finalePredictionScope = 'open';
    if(!s.settings.leagueTypeId) s.settings.leagueTypeId = 'classic-draft';
    if(!s.settings.showId) s.settings.showId = 'survivor';
    if(typeof s.settings.pickemCorrectPoints !== 'number') s.settings.pickemCorrectPoints = 1;
    // Every pre-existing league is exclusive-ownership by construction (it's the only mode that
    // existed), so defaulting rather than inferring is correct here.
    if(!s.settings.ownershipMode) s.settings.ownershipMode = 'exclusive';
    if(typeof s.settings.wikiSeason === 'undefined') s.settings.wikiSeason = null;
    // Default OFF like a new league, EXCEPT where a round is already running -- backfilling those
    // to false would strand an in-flight replenish/swap with no UI left to finish or cancel it.
    if(typeof s.settings.activeSlots !== 'number') s.settings.activeSlots = 3;
    if(typeof s.settings.benchSlots !== 'number') s.settings.benchSlots = 2;
    // Merge rather than replace, so a league that customised some types keeps those and picks up
    // catalog defaults for any type added since.
    s.settings.eventPoints = { ...defaultEventPoints(s), ...(s.settings.eventPoints || {}) };
    if(typeof s.settings.replenishEnabled !== 'boolean') s.settings.replenishEnabled = !!(s.midSeason && s.midSeason.replenish);
    if(typeof s.settings.tradeEnabled !== 'boolean') s.settings.tradeEnabled = !!(s.midSeason && s.midSeason.trade);
    // Default OFF like a new league, EXCEPT where predictions already exist -- same reasoning as
    // replenishEnabled/tradeEnabled above, backfilling those to false would strand picks already made.
    if(typeof s.settings.finalePredictionsEnabled !== 'boolean'){
      s.settings.finalePredictionsEnabled = (s.finalePredictions && s.finalePredictions.length > 0)
        || !!(s.finaleActual && (s.finaleActual.winner || (s.finaleActual.top3||[]).some(Boolean)));
    }
    if(!s.blindDraft) s.blindDraft = { lockedPlayerIds: [], revealedAt: null };
    if(!s.draftOrder) s.draftOrder = (s.players||[]).map(p=>p.id);
    if(typeof s.draftPicksMade !== 'number') s.draftPicksMade = (s.castaways||[]).filter(c=>ownerListOf(c).length).length;
    if(typeof s.draftForceStarted !== 'boolean') s.draftForceStarted = false;
    if(typeof s.settings.draftScheduledAt === 'undefined') s.settings.draftScheduledAt = null;
    (s.players||[]).forEach(p=>{ if(typeof p.active !== 'boolean') p.active = true; });
    (s.castaways||[]).forEach(c=>{
      // Migrate the old boolean flag to the richer acquiredVia/formerOwnerId/departedVia model.
      // Best-effort only: existing saves can't fully recover pre-replenish/trade history.
      if(typeof c.acquiredVia === 'undefined') c.acquiredVia = c.draftedViaSnake ? 'draft' : (ownerListOf(c).length ? 'draft' : null);
      if(typeof c.formerOwnerId === 'undefined') c.formerOwnerId = null;
      if(typeof c.departedVia === 'undefined') c.departedVia = null;
      delete c.draftedViaSnake;
    });
    (s.episodes||[]).forEach(ep=>{
      if(!ep.bets) migrateEpisodeToBets(ep, s.settings.bonusCategories, s.castaways, s.tribes);
      if(!ep.picks) ep.picks = [];
      // Active Roster's per-episode fields. scoringEvents is deliberately separate from events
      // (eliminations) -- see ActiveRosterLogic.addEvent's note on why.
      if(!ep.scoringEvents) ep.scoringEvents = [];
      if(!ep.lineups) ep.lineups = {};
      if(typeof ep.lineupsLocked !== 'boolean') ep.lineupsLocked = false;
      // Exile Island records (see addExiled). An old save without them had nobody exiled, so
      // starting empty is correct -- there's no history to reconstruct.
      if(!ep.exiled) ep.exiled = [];
      if(!ep.roles) ep.roles = [];
      if(!ep.groups) ep.groups = [];
    });
    delete s.settings.bonusCategories;
    return s;
  }
}

return {
  // ---- constants ----
  PALETTE, SEED_CASTAWAYS,
  LEAGUE_TYPES, SHOWS, getLeagueType, replenishAvailable, tradeAvailable, finalePredictionsAvailable, rosterSize, originalDraftPicks,
  formatOf, startEpisode, inPlay, hasAired,

  // ---- flat API: exact same names as before this reorganization, so no existing call site
  // (public/app.js's 95+ call sites, every server route) needs to change. Each is a direct
  // alias to a class static -- see the class definitions above for the real implementation. ----
  uid: Core.uid, getPlayer: Core.getPlayer, getCastaway: Core.getCastaway, getTribe: Core.getTribe,
  defaultState: Migrations.defaultState, migrateLeagueState: Migrations.migrateLeagueState,
  defaultEventPoints, roundPoints,
  freeAgents: RosterLogic.freeAgents, activeOwnedCount: RosterLogic.activeOwnedCount, totalCastCount: RosterLogic.totalCastCount,
  nextPlacementOrder: EpisodeLogic.nextPlacementOrder,
  syncDraftOrder: DraftLogic.syncOrder, currentDraftTurn: DraftLogic.currentTurn, isDraftStarted: DraftLogic.isStarted, forceStartDraft: DraftLogic.forceStart,
  computeScores: ScoringLogic.compute,
  addPlayer: RosterLogic.addPlayer, updatePlayer: RosterLogic.updatePlayer, removePlayer: RosterLogic.removePlayer,
  disablePlayer: RosterLogic.disablePlayer, reclaimPlayer: RosterLogic.reclaimPlayer, activatePlayer: RosterLogic.activatePlayer,
  addTribe: RosterLogic.addTribe, updateTribe: RosterLogic.updateTribe, removeTribe: RosterLogic.removeTribe,
  addCastaway: RosterLogic.addCastaway, updateCastaway: RosterLogic.updateCastaway, removeCastaway: RosterLogic.removeCastaway,
  applyCastImport: RosterLogic.applyCastImport, applyCastTribes: RosterLogic.applyCastTribes, applyCastRoles: RosterLogic.applyCastRoles,
  planSeasonCastLinks: RosterLogic.planSeasonCastLinks, applySeasonCastLinks: RosterLogic.applySeasonCastLinks, syncSeasonCast: RosterLogic.syncSeasonCast,
  castTribesDue: RosterLogic.castTribesDue, castawayInUse: RosterLogic.castawayInUse, applySeasonCast: RosterLogic.applySeasonCast,
  applyEliminationsImport: EpisodeLogic.applyEliminationsImport,
  applyScoringEventsImport: EpisodeLogic.applyScoringEventsImport,
  updateSettings: RosterLogic.updateSettings,
  reorderDraft: DraftLogic.reorder, moveDraftOrder: DraftLogic.move, draftToCurrentTurn: DraftLogic.pick, undraft: DraftLogic.undo,
  startReplenish: ReplenishLogic.start, currentReplenishTurn: ReplenishLogic.currentTurn, replenishAssign: ReplenishLogic.assign, cancelReplenish: ReplenishLogic.cancel,
  startTrade: TradeLogic.start, tradeSwap: TradeLogic.swap, tradeSkip: TradeLogic.skip, cancelTrade: TradeLogic.cancel,
  MidSeasonLogic, availableFor: MidSeasonLogic.availableFor, swapWindow: MidSeasonLogic.swapWindow, replenishNeed: MidSeasonLogic.replenishNeed,
  addEpisode: EpisodeLogic.add, removeEpisode: EpisodeLogic.remove, updateEpisode: EpisodeLogic.update,
  renumberPlacements: EpisodeLogic.renumberPlacements, addElimination: EpisodeLogic.addElimination, removeElimination: EpisodeLogic.removeElimination,
  setJuryVotes: EpisodeLogic.setJuryVotes,
  addExiled: EpisodeLogic.addExiled, removeExiled: EpisodeLogic.removeExiled,
  RuleChangeLogic,
  RoleLogic, roleOf: RoleLogic.roleOf, addRole: RoleLogic.add, removeRole: RoleLogic.remove,
  GroupLogic, addGroupChange: GroupLogic.add, removeGroupChange: GroupLogic.remove,
  ensureUpcomingEpisode: EpisodeLogic.ensureUpcoming, ensureEpisodeNumber: EpisodeLogic.ensureEpisodeNumber,
  ensureNextEpisode: EpisodeLogic.ensureNextEpisode, seasonUnderway: EpisodeLogic.seasonUnderway, episodeHasResults: EpisodeLogic.hasResults,
  addBet: BetLogic.add, addBetToUpcoming: BetLogic.addToUpcoming, updateBet: BetLogic.update, removeBet: BetLogic.remove,
  MAX_BET_POINTS,
  addBetPrediction: BetLogic.addPrediction, removeBetPrediction: BetLogic.removePrediction, setBetPredictionCorrect: BetLogic.setPredictionCorrect,
  getOrCreateFinalePred: FinaleLogic.getOrCreatePrediction, setFinalePick: FinaleLogic.setPick, setFinaleWinnerPick: FinaleLogic.setWinnerPick,
  setActualTop3: FinaleLogic.setActualTop3, setActualWinner: FinaleLogic.setActualWinner,
  // Named setPickEmPick/removePickEmPick rather than the shorter setPick/removePick -- "pick" is
  // already heavily overloaded in this file (draft picks, blind-draft picks) and the longer name
  // keeps call sites unambiguous about which kind.
  activeRosterLineupFor: ActiveRosterLogic.lineupFor, setActiveRosterLineup: ActiveRosterLogic.setLineup,
  lockActiveRosterLineups: ActiveRosterLogic.lockLineups, unlockActiveRosterLineups: ActiveRosterLogic.unlockLineups,
  addScoringEvent: ActiveRosterLogic.addEvent, removeScoringEvent: ActiveRosterLogic.removeEvent,
  pickEmPickFor: PickEmLogic.pickFor, pickEmEligibility: PickEmLogic.eligibility, pickEmHistory: PickEmLogic.history,
  pickEmUpcomingEpisode: PickEmLogic.upcomingEpisode, currentEpisode,
  setPickEmPick: PickEmLogic.setPick, removePickEmPick: PickEmLogic.removePick,

  // ---- domain classes: reference these directly in new code instead of the flat aliases above ----
  // ScoringLogic/DraftLogic are thin league-type dispatchers (see the "League types" comment near
  // the top of this file); SnakeDraftStrategy/BlindDraftStrategy/NoDraftStrategy and
  // EliminationOrderScoringStrategy/PickEmScoringStrategy are their registered implementations,
  // exported directly for code that wants to bypass the dispatch.
  Core, ScoringLogic, DraftLogic, RosterLogic, ReplenishLogic, TradeLogic, EpisodeLogic, BetLogic, FinaleLogic, PickEmLogic, BlindDraftLogic, ActiveRosterLogic, SetupLogic, RevealLogic, SpoilerLogic, GhostLogic, Migrations,
  SnakeDraftStrategy, EliminationOrderScoringStrategy, NoDraftStrategy, PickEmScoringStrategy, BlindDraftStrategy, ActiveRosterEventScoringStrategy
};

});
