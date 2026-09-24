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
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.StateLogic = factory();
})(typeof self !== 'undefined' ? self : this, function(){

const PALETTE = ['#45a89a','#d9704a','#a76bb0','#5089c4','#86a34c','#c99a3e','#b0563f','#6b8fc9'];
// No longer seeded into new leagues (see Migrations.defaultState) -- a fresh league starts with an
// empty cast so it isn't pre-filled with the wrong show's people. Kept as sample data.
const SEED_CASTAWAYS = ['Aaliyah','Alexis','Ana','Brady','Carter','Cristian','Devin','Eric','Jelly','Jenna','Kilby','Kristin','Lewis','Linnea','Maggie','Mike','Ori','Patt','Rob','Sharonda','Thien An'];
const EXIT_METHODS = ['Voted Out','Medically Evacuated','Quit','Lost Fire-Making','Lost Final Tribal (Jury Vote)','Sole Survivor','Other'];

// Reads a castaway object's owner list, tolerating a castaway that predates the field. Kept
// module-private: the filter predicates below already hold the castaway object, so going through
// Core.ownersOf (which looks it up by id) would be pointless indirection -- see the ownership
// comment in Core for which call sites are expected to use the helpers instead.
function ownerListOf(c){ return (c && c.ownerIds) || []; }

// ---------- Core: id generation + basic entity lookups, used by every other class ----------
class Core {
  static uid(prefix){ return prefix+'_'+Math.random().toString(36).slice(2,9); }
  static getPlayer(state, id){ return state.players.find(p=>p.id===id); }
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
    if(c) c.ownerIds = playerId ? [playerId] : [];
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
// Points = sum of your own eliminated castaways' placementOrder, plus an optional side-bet bonus
// layer and an optional finale-prediction layer. A future league type (e.g. weekly pick'em) would
// almost certainly need an entirely different formula here -- see LEAGUE_TYPES below.
class EliminationOrderScoringStrategy {
  static compute(state){
    const results = {};
    state.players.forEach(p=> results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:0, bonus:0, finale:0, total:0, roster:[], formerRoster:[]});
    // Per-player, via Core.ownedCastawayIds rather than a single scalar owner per castaway, so a
    // castaway with several owners (shared-ownership league types) contributes its placement to
    // each of them. In exclusive-ownership leagues every castaway has at most one owner, so this
    // sums to exactly what the old single-owner pass produced.
    state.players.forEach(p=>{
      Core.ownedCastawayIds(state, p.id).forEach(cid=>{
        const c = Core.getCastaway(state, cid);
        results[p.id].roster.push(c);
        if(c.status==='eliminated' && typeof c.placementOrder==='number'){
          results[p.id].locked += c.placementOrder;
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
class PickEmScoringStrategy {
  static compute(state){
    const results = {};
    state.players.forEach(p=> results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:0, bonus:0, finale:0, total:0, roster:[], formerRoster:[]});
    const pointsPerCorrect = typeof state.settings.pickemCorrectPoints === 'number' ? state.settings.pickemCorrectPoints : 1;
    state.episodes.forEach(ep=>{
      // An episode with zero elimination events logged hasn't happened yet as far as this app's
      // data model is concerned -- same heuristic EpisodeLogic.ensureUpcoming already uses to
      // decide which episode is "upcoming" (events.length===0). Without this gate, a pick
      // submitted for a future episode would score as "correct" the instant it's submitted
      // (nothing in ep.events yet to contradict it), before that episode has even aired.
      if(ep.events.length===0) return;
      (ep.picks||[]).forEach(pk=>{
        const r = results[pk.playerId];
        if(!r) return;
        // Correct = the picked castaway does NOT appear among this episode's elimination events
        // (i.e. they survived that tribal). No stored `correct` flag -- always derived live from
        // ep.events, same reasoning EliminationOrderScoringStrategy sums `locked` live from
        // castaway.status rather than caching a point value: a stored flag would need explicit
        // invalidation everywhere addElimination/removeElimination can touch this episode's
        // events, and this sidesteps that whole bug class.
        const survived = !ep.events.some(ev=>ev.castawayId===pk.castawayId);
        if(survived) r.locked += pointsPerCorrect;
      });
    });
    Object.values(results).forEach(r=> r.total = r.locked);
    return Object.values(results).sort((a,b)=>b.total-a.total);
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
    state.players.forEach(p=>{ if(p.active !== false && !state.draftOrder.includes(p.id)) state.draftOrder.push(p.id); });
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
    if(!turn || turn.isComplete || !c || ownerListOf(c).length) return;
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
    return state.players.filter(p => p.active !== false && !p.disabled);
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
// Candidate v1 catalog. Ordered so the settings UI renders one point input per row in a stable
// order, and every default is commissioner-editable -- including down to 0, which is how you switch
// a category off without needing the catalog itself to change (same shape as the existing side-bet
// point inputs). Adding a type here automatically gives it a settings input and makes it selectable
// in the event-entry UI; `eventPoints` falls back to the catalog default for any type a league
// hasn't customised, so adding one never needs a migration.
const ACTIVE_ROSTER_EVENTS = [
  { id: 'individualImmunity', label: 'Individual immunity win', defaultPoints: 5 },
  { id: 'tribeImmunity', label: 'Tribe/team immunity win', defaultPoints: 2 },
  { id: 'rewardWin', label: 'Reward win', defaultPoints: 2 },
  { id: 'idolFound', label: 'Idol/advantage found', defaultPoints: 3 },
  { id: 'idolPlayed', label: 'Idol/advantage played', defaultPoints: 2 },
  { id: 'zeroVotesSafe', label: 'Safe at Tribal, zero votes against', defaultPoints: 1 }
];
function defaultEventPoints(){
  const out = {};
  ACTIVE_ROSTER_EVENTS.forEach(e => { out[e.id] = e.defaultPoints; });
  return out;
}

class ActiveRosterLogic {
  // Points for one event type: the league's own value if set, else the catalog default. A type
  // explicitly set to 0 stays 0 (that's how a commissioner switches a category off), which is why
  // this tests for a number rather than using `||`.
  static pointsFor(state, type){
    const configured = state.settings && state.settings.eventPoints ? state.settings.eventPoints[type] : undefined;
    if(typeof configured === 'number') return configured;
    const def = ACTIVE_ROSTER_EVENTS.find(e => e.id === type);
    return def ? def.defaultPoints : 0;
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
  static lineupFor(state, epId, playerId){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep || !ep.lineups) return [];
    return ep.lineups[playerId] || [];
  }
  static isLineupLocked(state, epId){
    const ep = state.episodes.find(e => e.id === epId);
    return !!(ep && ep.lineupsLocked);
  }
  // Returns null if the lineup is acceptable, else a human-readable reason. Like blind draft (and
  // unlike most of this file) this reports WHY rather than silently no-opping -- a rejected lineup is
  // something the player needs to understand and fix.
  static validateLineup(state, epId, playerId, castawayIds){
    if(!getLeagueType(state).hasActiveRoster) return 'This league type has no active roster';
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return 'No such episode';
    if(ep.lineupsLocked) return 'Lineups for this episode are locked';
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
      const stillOwned = (prev.lineups[playerId] || []).filter(cid => {
        const c = Core.getCastaway(state, cid);
        return c && ownerListOf(c).includes(playerId);
      });
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
    if(!ACTIVE_ROSTER_EVENTS.some(e => e.id === type)) return null;
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
      (ep.scoringEvents || []).forEach(ev=>{
        state.players.forEach(p=>{
          const lineup = (ep.lineups && ep.lineups[p.id]) || [];
          if(lineup.includes(ev.castawayId)){
            results[p.id].locked += ActiveRosterLogic.pointsFor(state, ev.type);
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
    Object.values(results).forEach(r=> r.total = r.locked + (state.settings.bonusEnabled? r.bonus:0) + r.finale);
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
  // The episode immediately before this one BY NUMBER, not by array position -- episodes can be
  // added/removed out of order (EpisodeLogic.remove renumbers placements, not episode numbers).
  static previousEpisode(state, ep){
    return state.episodes.find(e=>e.number === ep.number - 1) || null;
  }
  static pickFor(state, epId, playerId){
    const ep = PickEmLogic.findEpisode(state, epId);
    return ep ? (ep.picks||[]).find(pk=>pk.playerId===playerId) || null : null;
  }
  // For the frontend to know which castaway to exclude from the picker (the no-repeat rule) --
  // keeps that business logic here rather than reimplemented in a component.
  static previousPickFor(state, epId, playerId){
    const ep = PickEmLogic.findEpisode(state, epId);
    if(!ep) return null;
    const prevEp = PickEmLogic.previousEpisode(state, ep);
    return prevEp ? (prevEp.picks||[]).find(pk=>pk.playerId===playerId) || null : null;
  }
  // Silently no-ops on an invalid request (unknown episode/castaway/player, an already-eliminated
  // castaway, or a repeat of the immediately-previous episode's pick) rather than throwing --
  // matches this file's existing convention (see e.g. SnakeDraftStrategy.pick on an
  // already-owned castaway). The frontend is expected to not offer the invalid options in the
  // first place; this is the backstop, not the primary validation surface.
  // No lock once an episode's eliminations are logged -- a pick can still be changed after the
  // outcome is known, same trust model the rest of this app already uses for bet predictions
  // (also editable at any time, no lock tied to an episode airing). The plan doesn't ask for one
  // and this app has no adversarial-security posture anywhere else either; not adding a new kind
  // of protection unprompted.
  static setPick(state, epId, playerId, castawayId){
    const ep = PickEmLogic.findEpisode(state, epId);
    const c = Core.getCastaway(state, castawayId);
    const player = Core.getPlayer(state, playerId);
    if(!ep || !c || !player || c.status!=='active') return;
    const prevEp = PickEmLogic.previousEpisode(state, ep);
    const prevPick = prevEp ? (prevEp.picks||[]).find(pk=>pk.playerId===playerId) : null;
    if(prevPick && prevPick.castawayId===castawayId) return;
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
    name: 'Classic Snake Draft',
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
    name: "Pick'em",
    description: 'No draft, no roster -- every episode, each player picks one castaway they think survives. A correct pick scores points; picking the same castaway two episodes running is not allowed.',
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
    description: 'Draft a roster, then each episode field only some of it. Points come from what your active castaways do that week (immunity, idols, rewards), not from elimination placement.',
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
Object.values(LEAGUE_TYPES).forEach(lt => {
  if(!lt.hasRoster) return;
  SHARED_OWNERSHIP_VARIANTS[lt.id] = {
    ...lt,
    draftStrategy: BlindDraftStrategy,
    supportsReplenish: false,
    supportsTrade: false
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
  static freeAgents(state){ return state.castaways.filter(c=>ownerListOf(c).length===0 && c.status==='active'); }
  static activeOwnedCount(state, playerId){ return state.castaways.filter(c=>ownerListOf(c).includes(playerId) && c.status==='active').length; }
  static totalCastCount(state){ return state.castaways.length; }

  // Joining after the draft has already fully concluded has no fair turn order to slot into, so
  // the new player starts inactive (no roster, excluded from draftOrder/scoring) until the
  // commissioner manually activates them via activatePlayer(). Joining before/during the draft
  // is unaffected -- they just fold into the normal snake order as always.
  static addPlayer(state, name){
    const newPlayer = { id:Core.uid('p'), name, color: PALETTE[state.players.length % PALETTE.length], disabled:false, active:true };
    const turn = DraftLogic.currentTurn(state); // reflects players/draftOrder BEFORE this one is added
    state.players.push(newPlayer);
    if(turn && turn.isComplete){
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
      if(c && ownerListOf(c).length===0){ Core.setOwner(state, cid, playerId); c.acquiredVia = 'draft'; }
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
    state.castaways.forEach(c=>{ if(c.tribeId===id) c.tribeId=null; });
    state.tribes = state.tribes.filter(t=>t.id!==id);
  }
  static addCastaway(state, name){
    const c = {id:Core.uid('c'), name, tribeId:null, ownerIds:[], photoUrl:'', status:'active', placementOrder:null, exitMethod:null, exitEpisodeId:null, replenishClaimed:false, acquiredVia:null, formerOwnerId:null, departedVia:null};
    state.castaways.push(c);
    return c;
  }
  static updateCastaway(state, id, field, value){ const c=Core.getCastaway(state,id); if(c) c[field]=value; }
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
      if(state.castaways.some(x=>sameName(x.name, c.name))){ added.skipped.push(c.name); return; }
      const created = RosterLogic.addCastaway(state, c.name);
      if(c.photoUrl) created.photoUrl = c.photoUrl;
      if(c.tribeName){
        const t = state.tribes.find(x=>sameName(x.name, c.tribeName));
        if(t) created.tribeId = t.id;
      }
      added.castaways.push(created.name);
    });
    return added;
  }
  static updateSettings(state, field, value){ state.settings[field]=value; }
}

// ---------- ReplenishLogic ----------
class ReplenishLogic {
  static start(state){
    const scores = ScoringLogic.compute(state);
    const scoreOf = playerId => (scores.find(s=>s.playerId===playerId)||{total:0}).total;
    const counts = state.players.map(p=>{
      const losses = state.castaways.filter(c=> ownerListOf(c).includes(p.id) && c.status==='eliminated' && !c.replenishClaimed && c.exitMethod!=='Sole Survivor');
      return {playerId:p.id, losses, score: scoreOf(p.id)};
    }).filter(x=>x.losses.length>0);
    if(counts.length===0) return false;
    // Who needs a player = anyone with unclaimed losses. Order among them is by current total
    // score, direction set in League Settings (most points first rewards strong drafts; least
    // points first is a catch-up mechanic).
    const dir = state.settings.replenishOrderBy === 'leastPoints' ? 1 : -1;
    counts.sort((a,b)=> dir * (a.score - b.score));
    // Build one pick PER TURN in snake order across players -- not everyone's whole allotment
    // consecutively -- so someone owed 2+ picks can't claim the top 2 free agents before anyone
    // else gets a turn. Direction reverses each round exactly like the original draft, same reason:
    // whoever picks last in a round shouldn't also always pick last (or first) in every round.
    const order = counts.map(x=>x.playerId);
    const lossIdsByPlayer = {};
    const scoreByPlayer = {};
    counts.forEach(x=>{ lossIdsByPlayer[x.playerId] = x.losses.map(c=>c.id); scoreByPlayer[x.playerId] = x.score; });
    const maxPicks = Math.max(...counts.map(x=>x.losses.length));
    const sequence = [];
    for(let round=0; round<maxPicks; round++){
      const roundOrder = round % 2 === 0 ? order : [...order].reverse();
      roundOrder.forEach(playerId=>{
        if(lossIdsByPlayer[playerId].length > round) sequence.push({playerId, scoreAtStart: scoreByPlayer[playerId]});
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
    if(!c || ownerListOf(c).length) return;
    const turn = r.sequence[r.index];
    Core.setOwner(state, castawayId, turn.playerId);
    c.acquiredVia = 'replenish';
    const lossIds = r.lossIdsByPlayer[turn.playerId];
    const lossId = lossIds.pop();
    const lostCastaway = lossId ? Core.getCastaway(state, lossId) : null;
    if(lostCastaway){
      lostCastaway.replenishClaimed = true;
      // The replenish pick replaces this slot, so its points no longer count for this player —
      // but formerOwnerId/departedVia keep the history so the Scoreboard can still show it.
      // formerOwnerId stays a single id (history display only, not scoring) -- in exclusive mode
      // there is exactly one owner to record here.
      lostCastaway.formerOwnerId = ownerListOf(lostCastaway)[0] || null;
      lostCastaway.departedVia = 'replenish';
      Core.setOwner(state, lostCastaway.id, null);
    }
    r.index++;
  }
  static cancel(state){ state.midSeason.replenish=null; }
}

// ---------- TradeLogic ----------
class TradeLogic {
  static start(state){
    const order = [...state.players].reverse().map(p=>p.id);
    state.midSeason.trade = { queue: order.map(id=>({playerId:id})), index:0 };
  }
  static swap(state, dropId, addId){
    const t = state.midSeason.trade;
    if(!t || t.index>=t.queue.length) return;
    const turn = t.queue[t.index];
    const drop = Core.getCastaway(state, dropId), add = Core.getCastaway(state, addId);
    if(drop && Core.isOwnedBy(state, dropId, turn.playerId) && drop.status==='active'){
      drop.formerOwnerId = turn.playerId;
      drop.departedVia = 'trade';
      Core.removeOwner(state, dropId, turn.playerId);
    }
    if(add && ownerListOf(add).length===0 && add.status==='active'){
      Core.setOwner(state, addId, turn.playerId);
      add.acquiredVia = 'trade';
    }
    t.index++;
  }
  static skip(state){ const t=state.midSeason.trade; if(!t) return; t.index++; }
  static cancel(state){ state.midSeason.trade=null; }
}

// ---------- EpisodeLogic: episodes + eliminations ----------
class EpisodeLogic {
  static add(state){
    const maxNum = state.episodes.length ? Math.max(...state.episodes.map(e=>e.number)) : 0;
    const previousEp = state.episodes.find(e=>e.number===maxNum);
    // Once the season hits the merge, every later episode is post-merge too — carry the flag forward.
    const postMerge = previousEp ? previousEp.postMerge : false;
    const newEp = { id:Core.uid('ep'), number: maxNum+1, postMerge, events:[], bets:[], picks:[], scoringEvents:[], lineups:{}, lineupsLocked:false };
    state.episodes.push(newEp);
    // Active Roster: start this episode's lineups from last episode's so players adjust rather than
    // retype. No-op for every other league type (nothing has lineups to carry).
    ActiveRosterLogic.carryForwardLineups(state, newEp.id);
    return newEp;
  }
  // Keeps there always being an "upcoming" episode (one with no eliminations logged yet) so
  // members always have somewhere to post/guess bets, without the commissioner needing to
  // remember to add one right after every tribal. Stops once a Sole Survivor is crowned.
  static ensureUpcoming(state){
    const seasonOver = state.castaways.some(c => c.exitMethod === 'Sole Survivor');
    if(seasonOver) return false;
    const maxNum = state.episodes.length ? Math.max(...state.episodes.map(e=>e.number)) : 0;
    const latest = state.episodes.find(e=>e.number===maxNum);
    if(latest && latest.events.length === 0) return false;
    const postMerge = latest ? latest.postMerge : false;
    const created = { id:Core.uid('ep'), number: maxNum+1, postMerge, events:[], bets:[], picks:[], scoringEvents:[], lineups:{}, lineupsLocked:false };
    state.episodes.push(created);
    ActiveRosterLogic.carryForwardLineups(state, created.id);
    return true;
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
  static addElimination(state, epId, castawayId, method){
    const ep = state.episodes.find(e=>e.id===epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c || c.status==='eliminated') return;
    const order = EpisodeLogic.nextPlacementOrder(state);
    c.status='eliminated'; c.placementOrder=order; c.exitMethod=method; c.exitEpisodeId=epId;
    ep.events.push({castawayId, method});
  }
  static removeElimination(state, epId, castawayId){
    const ep = state.episodes.find(e=>e.id===epId);
    const c = Core.getCastaway(state, castawayId);
    if(!ep || !c) return;
    ep.events = ep.events.filter(ev=>ev.castawayId!==castawayId);
    c.status='active'; c.placementOrder=null; c.exitMethod=null; c.exitEpisodeId=null; c.replenishClaimed=false;
    EpisodeLogic.renumberPlacements(state);
  }
}

// ---------- BetLogic: side bets + predictions ----------
class BetLogic {
  static add(state, epId, label, points, createdByPlayerId){
    const ep = state.episodes.find(e=>e.id===epId);
    if(!ep || !label) return;
    ep.bets = ep.bets || [];
    const bet = { id: Core.uid('bet'), label, points, predictions: [], createdByPlayerId: createdByPlayerId || null };
    ep.bets.push(bet);
    return bet;
  }
  static update(state, epId, betId, field, value){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    if(bet) bet[field]=value;
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
  static setPick(state, playerId, idx, value){ const fp=FinaleLogic.getOrCreatePrediction(state,playerId); fp.top3[idx]=value; }
  static setWinnerPick(state, playerId, value){ const fp=FinaleLogic.getOrCreatePrediction(state,playerId); fp.winner=value; }
  static setActualTop3(state, idx, value){ state.finaleActual.top3[idx]=value; }
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
        value: st.ownershipMode, applies: getLeagueType(state).hasRoster }
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
        label: catDef ? catDef.label : 'Side Bet',
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
      midSeason: { replenish:null, trade:null },
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
        replenishOrderBy: 'mostPoints',
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
        // False ONLY on leagues created after the guided-setup change; absent on every league that
        // predates it, and `!== false` is what the UI tests, so an existing league is never sent
        // back through setup. Flipped true when the commissioner confirms the basics.
        setupComplete: false,
        // Which real season this league is tracking, for the wiki connector (db/wiki-sync.js) to
        // know what to fetch -- e.g. 44 means the "Survivor 44" wiki page. Null until a
        // commissioner sets it; the connector refuses to run without it rather than guessing.
        wikiSeason: null,
        // Optional mid-season mechanics, both OFF until a commissioner turns them on -- plenty of
        // leagues never run either. Gated together with the league type's own capability; see
        // replenishAvailable/tradeAvailable above.
        replenishEnabled: false,
        tradeEnabled: false,
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
    if(!s.midSeason) s.midSeason = {replenish:null, trade:null};
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
    s.settings.eventPoints = { ...defaultEventPoints(), ...(s.settings.eventPoints || {}) };
    if(typeof s.settings.replenishEnabled !== 'boolean') s.settings.replenishEnabled = !!(s.midSeason && s.midSeason.replenish);
    if(typeof s.settings.tradeEnabled !== 'boolean') s.settings.tradeEnabled = !!(s.midSeason && s.midSeason.trade);
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
    });
    delete s.settings.bonusCategories;
    return s;
  }
}

return {
  // ---- constants ----
  PALETTE, SEED_CASTAWAYS, EXIT_METHODS,
  LEAGUE_TYPES, SHOWS, getLeagueType, replenishAvailable, tradeAvailable, rosterSize,
  ACTIVE_ROSTER_EVENTS,

  // ---- flat API: exact same names as before this reorganization, so no existing call site
  // (public/app.js's 95+ call sites, every server route) needs to change. Each is a direct
  // alias to a class static -- see the class definitions above for the real implementation. ----
  uid: Core.uid, getPlayer: Core.getPlayer, getCastaway: Core.getCastaway, getTribe: Core.getTribe,
  defaultState: Migrations.defaultState, migrateLeagueState: Migrations.migrateLeagueState,
  freeAgents: RosterLogic.freeAgents, activeOwnedCount: RosterLogic.activeOwnedCount, totalCastCount: RosterLogic.totalCastCount,
  nextPlacementOrder: EpisodeLogic.nextPlacementOrder,
  syncDraftOrder: DraftLogic.syncOrder, currentDraftTurn: DraftLogic.currentTurn, isDraftStarted: DraftLogic.isStarted, forceStartDraft: DraftLogic.forceStart,
  computeScores: ScoringLogic.compute,
  addPlayer: RosterLogic.addPlayer, updatePlayer: RosterLogic.updatePlayer, removePlayer: RosterLogic.removePlayer,
  disablePlayer: RosterLogic.disablePlayer, reclaimPlayer: RosterLogic.reclaimPlayer, activatePlayer: RosterLogic.activatePlayer,
  addTribe: RosterLogic.addTribe, updateTribe: RosterLogic.updateTribe, removeTribe: RosterLogic.removeTribe,
  addCastaway: RosterLogic.addCastaway, updateCastaway: RosterLogic.updateCastaway, removeCastaway: RosterLogic.removeCastaway,
  applyCastImport: RosterLogic.applyCastImport,
  updateSettings: RosterLogic.updateSettings,
  reorderDraft: DraftLogic.reorder, moveDraftOrder: DraftLogic.move, draftToCurrentTurn: DraftLogic.pick, undraft: DraftLogic.undo,
  startReplenish: ReplenishLogic.start, currentReplenishTurn: ReplenishLogic.currentTurn, replenishAssign: ReplenishLogic.assign, cancelReplenish: ReplenishLogic.cancel,
  startTrade: TradeLogic.start, tradeSwap: TradeLogic.swap, tradeSkip: TradeLogic.skip, cancelTrade: TradeLogic.cancel,
  addEpisode: EpisodeLogic.add, removeEpisode: EpisodeLogic.remove, updateEpisode: EpisodeLogic.update,
  renumberPlacements: EpisodeLogic.renumberPlacements, addElimination: EpisodeLogic.addElimination, removeElimination: EpisodeLogic.removeElimination,
  ensureUpcomingEpisode: EpisodeLogic.ensureUpcoming,
  addBet: BetLogic.add, updateBet: BetLogic.update, removeBet: BetLogic.remove,
  addBetPrediction: BetLogic.addPrediction, removeBetPrediction: BetLogic.removePrediction, setBetPredictionCorrect: BetLogic.setPredictionCorrect,
  getOrCreateFinalePred: FinaleLogic.getOrCreatePrediction, setFinalePick: FinaleLogic.setPick, setFinaleWinnerPick: FinaleLogic.setWinnerPick,
  setActualTop3: FinaleLogic.setActualTop3, setActualWinner: FinaleLogic.setActualWinner,
  // Named setPickEmPick/removePickEmPick rather than the shorter setPick/removePick -- "pick" is
  // already heavily overloaded in this file (draft picks, blind-draft picks) and the longer name
  // keeps call sites unambiguous about which kind.
  activeRosterLineupFor: ActiveRosterLogic.lineupFor, setActiveRosterLineup: ActiveRosterLogic.setLineup,
  lockActiveRosterLineups: ActiveRosterLogic.lockLineups, unlockActiveRosterLineups: ActiveRosterLogic.unlockLineups,
  addScoringEvent: ActiveRosterLogic.addEvent, removeScoringEvent: ActiveRosterLogic.removeEvent,
  pickEmPickFor: PickEmLogic.pickFor, previousPickEmPickFor: PickEmLogic.previousPickFor,
  setPickEmPick: PickEmLogic.setPick, removePickEmPick: PickEmLogic.removePick,

  // ---- domain classes: reference these directly in new code instead of the flat aliases above ----
  // ScoringLogic/DraftLogic are thin league-type dispatchers (see the "League types" comment near
  // the top of this file); SnakeDraftStrategy/BlindDraftStrategy/NoDraftStrategy and
  // EliminationOrderScoringStrategy/PickEmScoringStrategy are their registered implementations,
  // exported directly for code that wants to bypass the dispatch.
  Core, ScoringLogic, DraftLogic, RosterLogic, ReplenishLogic, TradeLogic, EpisodeLogic, BetLogic, FinaleLogic, PickEmLogic, BlindDraftLogic, ActiveRosterLogic, SetupLogic, Migrations,
  SnakeDraftStrategy, EliminationOrderScoringStrategy, NoDraftStrategy, PickEmScoringStrategy, BlindDraftStrategy, ActiveRosterEventScoringStrategy
};

});
