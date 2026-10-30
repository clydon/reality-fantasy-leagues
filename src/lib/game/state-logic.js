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
// MidSeasonLogic, WaiverLogic, EpisodeLogic, BetLogic, FinaleLogic, Migrations). This is
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
// bottom. Cross-domain calls are plain `OtherClass.method(state, ...)` — see MidSeasonLogic
// calling ScoringLogic, or RosterLogic calling DraftLogic, for the existing pattern.
//
// Games as data (docs/PLAN-start-a-game-gpt.md step A2): what kind of game a league is, and every
// setting of it, is its game spec (./game-spec/), read through gameOf(state): settings.game when the
// league carries one (the game-specs flag), else read from its settings. Nothing below reads a game
// setting from state.settings itself, and RosterLogic.setGame is the one way a game changes (every
// settings write goes through it: the spec's validator, then today's fields written with withSpec).
//
// The pieces (step R1): DraftLogic and ScoringLogic below are thin dispatchers, not the real
// implementations -- they delegate to the pieces the game's spec is made of (piecesOf: its draft
// mechanic by how it gets its castaways, its scorer by how it scores), never to a league type.
// getLeagueType still names the kind for the screens (its words and flags, until R3 takes it out);
// nothing plays through it (tests/pieces.test.js holds its flags the pieces'). LEAGUE_TYPES has five
// entries: 'classic-draft' (Outlast: EliminationOrderScoringStrategy, a real roster draft),
// 'active-roster' (Weekly Lineup), 'pickem' (Survival Pool: NoDraftStrategy + PickEmScoringStrategy
// -- no roster, no draft at all; see PickEmLogic for the actual weekly-pick mechanic, which is NOT
// behind this dispatch since it doesn't fit the DraftStrategy shape below, per the note two
// sentences down), 'weekly-calls' and 'weekly-bingo'. Their flags (hasRoster, supportsReplenish,
// ...) are worked out from each one's preset spec (game-spec flagsOf), not written by hand.
//
// A draft's mechanic is its spec's order (get.order: a snake for an exclusive draft, a blind draft
// for a shared one, a draw, an auction), so the same scorer plays under any of them; getLeagueType
// mirrors that with its ownership, draw and auction variants -- see SHARED_OWNERSHIP_VARIANTS.
//
// Adding a further piece means: give the game spec the mechanics (game-spec/schema.js VOCAB,
// typeOf/playsAs), write a new strategy class implementing the same static method shape as
// SnakeDraftStrategy (syncOrder/currentTurn/isStarted/forceStart/reorder/move/pick/undo) and/or
// EliminationOrderScoringStrategy (compute) -- or reuse NoDraftStrategy as-is if it has no
// draft either -- and name it in DRAFT_PIECES or SCORE_PIECES (and, while the screens still read
// one, a LEAGUE_TYPES key with its preset); its flags come from the spec. MidSeasonLogic/WaiverLogic
// deliberately are NOT behind this dispatch -- they're mid-season features of a draft, gated by
// the spec's support flags, not an independently-varying axis on their own. A "weekly pick'em" league (no persistent
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
  if(typeof module === 'object' && module.exports) module.exports = factory(require('./formats/index.js'), require('./game-spec/index.js'));
  else root.StateLogic = factory(root.GameFormats, root.GameSpec);
})(typeof self !== 'undefined' ? self : this, function(Formats, Spec){

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
// A compiled rulebook (settings.rulebook: { data, reader }, written by the server from step R3 on,
// docs/PLAN-rulebooks-implementation.md decision 3) wins over everything: it already holds whatever
// the league follows or made its own.
//
// On top of whichever base that is go the season rule changes this league's commissioner adopted
// (settings.adoptedRuleChanges, docs/PLAN-season-rule-changes.md): additive, and gated by episode, so
// nothing before a change's effective episode scores differently. A league with none -- every league
// until one is adopted -- gets the base itself, untouched.
function formatOf(state){
  const s = state && state.settings ? state.settings : {};
  const base = s.rulebook && s.rulebook.data
    ? Formats.formatForRulebook(s.rulebook.data, s.rulebook.reader)
    : s.leagueRulesetData
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

// The game this league plays, as data (docs/PLAN-start-a-game-gpt.md step A2): its game spec, settings.game when it
// carries one (the game-specs flag), else read from its settings (game-spec gameOf). Every game setting below is read
// through here. Read only: RosterLogic.setGame is how a game changes.
function gameOf(state){ return Spec.gameOf(state && state.settings); }

// The episode this league starts playing at (the spec's span.from; settings.startEpisode, default 1). A league formed
// mid-season -- "we've all watched episode 1, we'll draft before episode 2" -- starts at 2: earlier
// episodes are history everyone has seen, so they're shown but nothing in them scores, and no picks
// or lineups are made for them.
//
// A game can start when a phase of the season's rulebook does instead (step A3: "when Merged starts", span.from
// { phase }): while it waits for that phase this is null -- no episode is in play, nothing is asked or scored, no waiver
// window opens, and it isn't over unless the season ends first (over, never started); the draft room and joining are as
// before any start. Once data says where the phase starts (RosterLogic.settleStart), it's the episode it plays from.
function startEpisode(state){ return Spec.spanStart(gameOf(state).span); }
// The phase this league starts at (its id), or null: it starts at an episode.
function startPhase(state){ return Spec.spanPhase(gameOf(state).span); }
// Waiting for its phase to start: a phase start with no episode yet.
function waitsForPhase(state){ return startEpisode(state) === null; }
// The episode this league plays through (span.to; settings.endEpisode): a game over a span -- one game, a series, a
// stretch of the season (docs/PLAN-sports-data.md step 6) -- ends there. Nothing after it scores, no picks or
// lineups are made for it, and the game is over once it has results. Null (the default): to the season's end. A game that
// ends before a phase starts (step A12 part 1: span.to { phase }) ends at the episode before it once data says where that is
// (RosterLogic.settleStart), and runs on (null) until then.
function endEpisode(state){ return Spec.spanEnd(gameOf(state).span); }
// The phase this league ends before (its id), or null (step A12 part 1).
function endPhase(state){ return Spec.spanEndPhase(gameOf(state).span); }
// The episode the game plays through, as the data has it: its span's end, or earlier where a draft's race was won or its cuts
// left one (step A11 part 1: KnockoutLogic.endsAt), or where head to head's playoffs end (part 4: MatchupLogic.endsAt). It's over there (gameOver) and scores as it stood then (spanView); the
// span's end (endEpisode) stays what the game was made with, for what it says and for Game settings.
function lastEpisode(state){
  const to = endEpisode(state);
  // A12 part 1: a game in stages ends with its last stage, which may end early (StageLogic.endsAt).
  const ends = [KnockoutLogic.endsAt(state), StageLogic.endsAt(state)].filter(n => n !== null);
  const early = ends.length ? Math.min(...ends) : null;
  return early === null ? to : to === null ? early : Math.min(to, early);
}
function inPlay(state, episodeNumber){
  const span = gameOf(state).span;
  const from = Spec.spanStart(span);
  const to = Spec.spanEnd(span);
  return from !== null && episodeNumber >= from && (to === null || episodeNumber <= to);
}
// The league as its span saw it: results after its last episode taken out (as the spoiler guard takes out what
// someone hasn't seen), so a game over a span scores, and is shown, as it stood at its end, whatever came after
// -- Outlast's boot order, a pool's streaks and a lineup's points alike. The state itself when there's nothing
// after it.
function spanView(state){
  const end = lastEpisode(state);
  if(end === null || !(state.episodes || []).some(e => e.number > end && EpisodeLogic.hasResults(e))) return state;
  const view = SpoilerLogic.viewThrough(state, end);
  // A11 part 2b: a game of questions' walk holds for its copy cut at the game's end (nothing it read is after it).
  return state.answerWalk && view !== state ? AnswerLogic.withWalk(view, state.answerWalk) : view;
}
// The game is over: its season is (seasonEnded), or its span's last episode has results.
function gameOver(state){
  if(seasonEnded(state)) return true;
  const end = lastEpisode(state);
  return end !== null && (state.episodes || []).some(e => e.number >= end && EpisodeLogic.hasResults(e));
}

// Who won, and when the season is over. The format's winner exit method crowns the winner (Survivor's
// Sole Survivor). A format nobody wins -- a series, a talk show, a sport's standings: winnerExitMethod
// null (formats/rulebook-compile.js) -- crowns no one, and someone still in the game (exitMethod null)
// never matches. Such a season is over once nobody is left in it (everyone has left, by an ending, a
// finish or a way out); one nobody leaves (a talk show) runs on.
function isWinnerExit(state, method){
  const w = formatOf(state).winnerExitMethod;
  return w != null && method === w;
}
function seasonWinner(state){ return (state.castaways || []).find(c => isWinnerExit(state, c.exitMethod)) || null; }
// An episode's night as the games grade it (R1 part 3: the Decisions table's "A pool's finale", only the winner survives the
// finale): { gone, won }, Sets of castaway ids, the exits its results record as going home and as winning (each winner, on a
// show with several). On a night with a winner everyone else in it went home, a losing finalist's exit or none; on any other
// night (every night, on a show nobody wins) whoever isn't among its exits stayed (wentHome).
function nightOf(state, ep){
  const w = formatOf(state).winnerExitMethod;
  const gone = new Set(), won = new Set();
  ((ep && ep.events) || []).forEach(ev => (w != null && ev.method === w ? won : gone).add(ev.castawayId));
  return { gone, won };
}
function wentHome(night, castawayId){ return night.won.size ? !night.won.has(castawayId) : night.gone.has(castawayId); }
function seasonEnded(state){
  if(formatOf(state).winnerExitMethod != null) return !!seasonWinner(state);
  const cast = state.castaways || [];
  return cast.length > 0 && cast.every(c => c.status === 'eliminated');
}
// The episode that ended the season: the winner's, or (nobody wins) the last one anyone left in.
// Null while it runs, or when that episode is missing.
function finaleEpisodeOf(state){
  const episodes = state.episodes || [];
  const winner = seasonWinner(state);
  if(winner) return episodes.find(e => e.id === winner.exitEpisodeId) || null;
  if(!seasonEnded(state)) return null;
  const exits = new Set((state.castaways || []).map(c => c.exitEpisodeId));
  return episodes.filter(e => exits.has(e.id)).sort((a,b) => b.number - a.number)[0] || null;
}

// Whether an episode has started airing: ep.airsAt is stamped by the server from the season's
// schedule (src/lib/server/air-times.ts) and absent when there's no schedule or the league is
// catching up -- then nothing is "aired" by the clock, only by its results.
function hasAired(ep, now){ return !!(ep && ep.airsAt) && (now || Date.now()) >= Date.parse(ep.airsAt); }
// Whether an episode's lineups and picks are closed: at its start, unless whoever runs the game overrode that (Backstage ›
// Settings' lock, 2026-10-27): ep.lineupsLocked locks it early, ep.openPastAir keeps it open past its start (the honour
// system: a couch that sat down after it began, or Start a game's Include it). Results close it whatever the lock says
// (isLineupLocked, PickEmLogic.decided).
function closedForPlay(ep, now){
  if(!ep) return false;
  if(ep.lineupsLocked) return true;
  return hasAired(ep, now) && !ep.openPastAir;
}

// The most recent in-play episode that has actually aired/been logged (EpisodeLogic.hasResults) --
// what a pickup or add/drop made "now" is really tied to: the episode whose results just created the
// opening (an elimination) or window (an active-roster upgrade), not some future episode number that
// may not even exist yet. Null before anything has happened. Used to stamp MidSeasonLogEntry.episode
// (MidSeasonLogic.log) so the transaction history can show "Episode N" instead
// of a bare timestamp.
function lastCompletedEpisode(state){
  const played = [...state.episodes].filter(e => inPlay(state, e.number) && EpisodeLogic.hasResults(e)).sort((a,b) => b.number - a.number);
  return played.length ? played[0].number : null;
}

// The episode "this week's choice" is being made for -- Eliminator Pool's pick, Active Roster's
// lineup, Overview's side bets: the next one to reveal when catching up, otherwise the latest, but
// never before the league's own start episode (a league set to start later picks/fields for that
// one first). One shared definition so all three agree on which episode is "now": its number
// (null past a span's last episode: nothing left to choose for), and the episode itself.
function currentEpisodeNumber(state){
  const start = startEpisode(state);
  if(start === null) return null; // waiting for its phase: nothing to choose for yet
  const number = Math.max(BetLogic.upcomingEpisodeNumber(state), start);
  return inPlay(state, number) ? number : null;
}
function currentEpisode(state){
  const number = currentEpisodeNumber(state);
  if(number === null) return null;
  return state.episodes.find(e => e.number === number) || null;
}

// Reads a castaway object's owner list, tolerating a castaway that predates the field. Kept
// module-private: the filter predicates below already hold the castaway object, so going through
// Core.ownersOf (which looks it up by id) would be pointless indirection -- see the ownership
// comment in Core for which call sites are expected to use the helpers instead.
function ownerListOf(c){ return (c && c.ownerIds) || []; }
function leagueGhostOwners(state, c){ const g = ownersAside(state); return ownerListOf(c).filter(id => g.has(id)); }

// Late joiners (GhostLogic, docs/PLAN-late-joiners.md): a ghost's team lives in ownerIds like anyone
// else's, but it's private -- the rest of the league never sees it -- so it must never take a castaway
// off the board for them. Exclusivity ("is this castaway free?") asks about the league's own players
// only; scoring and "is this mine?" keep reading ownerListOf as before.
function isGhost(p){ return !!(p && p.ghost); }
function ghostIdSet(state){ return new Set((state.players || []).filter(isGhost).map(p => p.id)); }
function leagueOwnersOf(state, c, aside){
  const skip = aside || ownersAside(state);
  return ownerListOf(c).filter(id => !skip.has(id));
}
// The owners the league's own exclusivity looks past: late joiners (their private teams), and (step A11 part 1) players knocked
// out of an exclusive draft, whose castaways are back in the pool (KnockoutLogic.frees) while they keep them for their own
// history. A loop over the cast works it out once and hands it to leagueOwnersOf.
function ownersAside(state){
  const set = ghostIdSet(state);
  if(KnockoutLogic.frees(state)) KnockoutLogic.outs(state).forEach((_, id) => set.add(id));
  return set;
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
    // A ghost's private ownership survives the league's own moves (see leagueOwnersOf), and so does a knocked-out player's (A11
    // part 1: their history; their castaways are free for everyone else).
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
//
// In reverse (A9 part 2, the spec's score.reverse: "the earlier your castaways go home, the more you score"), each castaway
// earns 1 plus 1 for everyone who outlasts them: the cast's size + 1 less their Outlast points, so out first of 18 = 18, the
// winner 1. Counted live the same way: someone still in after k eliminations counts what they'd score if they went home next
// (the cast less k), shrinking by 1 for each boot they outlast, so a mid-season table ranks as the end would if everyone went
// home next.
class EliminationOrderScoringStrategy {
  /** Whether the game scores the boot order in reverse (A9 part 2). */
  static reversed(state){ const score = gameOf(state).score; return score.by === 'place' && score.reverse === true; }
  /** One castaway's Classic points so far, on whatever (spoiler-trimmed) state the viewer sees. */
  static castawayPoints(state, c){
    if(c.status==='eliminated'){
      if(typeof c.placementOrder!=='number') return 0;
      return EliminationOrderScoringStrategy.reversed(state) ? state.castaways.length + 1 - c.placementOrder : c.placementOrder;
    }
    return EliminationOrderScoringStrategy.stillInPoints(state);
  }
  /** What every castaway still in has earned so far: 1 + the eliminations they've outlasted (in reverse: the cast less them). */
  static stillInPoints(state){
    const out = state.castaways.filter(x=>x.status==='eliminated' && typeof x.placementOrder==='number').length;
    return EliminationOrderScoringStrategy.reversed(state) ? state.castaways.length - out : out + 1;
  }
  static compute(state){
    const results = {};
    state.players.forEach(p=> results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:0, banked:0, bonus:0, finale:0, total:0, roster:[], formerRoster:[]});
    const stillInPoints = EliminationOrderScoringStrategy.stillInPoints(state);
    // In reverse, a castaway out at place p earns the cast's size + 1 - p.
    const reverse = EliminationOrderScoringStrategy.reversed(state) ? state.castaways.length + 1 : 0;
    // Per-player, via Core.ownedCastawayIds rather than a single scalar owner per castaway, so a
    // castaway with several owners (shared-ownership league types) contributes its placement to
    // each of them. In exclusive-ownership leagues every castaway has at most one owner, so this
    // sums to exactly what the old single-owner pass produced.
    state.players.forEach(p=>{
      Core.ownedCastawayIds(state, p.id).forEach(cid=>{
        const c = Core.getCastaway(state, cid);
        results[p.id].roster.push(c);
        if(c.status==='eliminated'){
          if(typeof c.placementOrder==='number'){
            const pts = reverse ? reverse - c.placementOrder : c.placementOrder;
            results[p.id].locked += pts; results[p.id].banked += pts;
          }
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
    const bets = addSideLayers(state, results);
    Object.values(results).forEach(r=> r.total = r.locked + (bets? r.bonus:0) + r.finale);
    return Object.values(results).sort((a,b)=>b.total-a.total);
  }
}
// The layers both drafts carry over how they score, as the spec says them: side bets while they're on (extras.bets: a bet
// needs company, it won't pay out unless two guessed), and finale predictions while they're on (the spec's two finale
// questions, A4), at their points, settled by the results (AnswerLogic). Adds each player's into `bonus` and `finale`;
// true when side bets count.
function addSideLayers(state, results){
  const extras = gameOf(state).extras;
  if(extras.bets){
    state.episodes.forEach(ep=>{
      // Only the game's own episodes: nothing before its start scores (a bet made there before the start moved later), and
      // one past a span's end has had its results taken out (spanView).
      if(!inPlay(state, ep.number)) return;
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
  AnswerLogic.finalePoints(state).forEach((pts, playerId) => { if(results[playerId]) results[playerId].finale += pts; });
  return !!extras.bets;
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
//
// A pool with lives (A10 part 2: PickEmLogic.parts) adds each player's lives left, the episode they went out in for good (null
// while they're in), their mulligans and buybacks left; ranked by last one standing (rank 'standing': standingKey) or, as
// today, by streak.
class PickEmScoringStrategy {
  static compute(state){
    const results = {};
    const parts = PickEmLogic.parts(state);
    // A11 part 2: a pool whose end is the pool's walks everyone together, once.
    const all = PickEmLogic.histories(state);
    state.players.forEach(p=> {
      const h = all.get(p.id);
      results[p.id] = {playerId:p.id, name:p.name, color:p.color, locked:h.total, bonus:0, finale:0, total:h.total,
        longestStreak:h.longestStreak, currentStreak:h.currentStreak, roster:[], formerRoster:[]};
      if(parts) Object.assign(results[p.id], { lives: h.lives, out: h.out, mulligans: h.mulligans, buybacks: h.buybacks });
      // A11 part 2: out the night everyone left went out, sharing the win (allOut 'share').
      if(h.shared) results[p.id].shared = true;
    });
    const rows = Object.values(results);
    if(parts && parts.standing) return rows.sort((a,b) => PickEmScoringStrategy.compareKeys(PickEmScoringStrategy.standingKey(b), PickEmScoringStrategy.standingKey(a)));
    return rows.sort((a,b)=> b.longestStreak - a.longestStreak || b.total - a.total);
  }
  // Last one standing's order, as a key compared from its first number on (higher first): whoever's still in before whoever's
  // out; those in by their points, then lives left; those out by the episode they went out in (later first), then their points.
  // A11 part 2: those who share the win (out the night everyone left went out, allOut 'share') tie, whatever their points.
  static standingKey(r){
    const out = Number.isInteger(r.out) ? r.out : null;
    return out === null ? [1, r.total, r.lives || 0] : [0, out, r.shared ? 0 : r.total];
  }
  static compareKeys(a, b){
    for(let i = 0; i < Math.max(a.length, b.length); i++){
      const d = (a[i] || 0) - (b[i] || 0);
      if(d) return d;
    }
    return 0;
  }
}
// The order a game's table ranks a score row in, as a key compared from its first number on (higher first, compareKeys): a
// pool's last one standing (standingKey) or longest streak, then its points; a stock market ranked by worth (A10 part 3c), its
// worth, then its points; anything else, its points. One definition for the engine's own sorts, the table (game-view.ts
// tableOf) and the waivers' order by standings (Weekly Calls' and Weekly Bingo's tables rank by what's counted outside the state).
function rankKey(state, r){
  const g = gameOf(state);
  // A12 part 1: a game in stages ranks by its overall: points; points for places, then points; stages won, then places, then points.
  if(g.score.by === 'stages'){
    const by = g.overall && g.overall.by;
    return by === 'wins' ? [r.wins || 0, r.placePoints || 0, r.stagePoints || 0] : by === 'places' ? [r.placePoints || 0, r.stagePoints || 0] : [r.total || 0];
  }
  if(g.get.by === 'pick') return g.rank.by === 'standing' ? PickEmScoringStrategy.standingKey(r) : [r.longestStreak || 0, r.total];
  if(g.rank.by === 'worth' && MarketLogic.on(state)) return [r.worth || 0, r.total];
  // A11 part 1: a draft that knocks players out, last one standing (its rows carry `out`: KnockoutLogic.apply); part 2b, a game of
  // questions' (AnswerLogic.applyWalk).
  if((g.get.by === 'draft' || g.score.by === 'answers') && g.rank.by === 'standing') return PickEmScoringStrategy.standingKey(r);
  // A11 part 3: co-op, won or lost by all: everyone shares one place, whatever their points.
  if(g.rank.by === 'coop') return [0];
  // A11 part 5: teams of players ranked by their points, every member sharing their team's place (TeamLogic.apply puts it on its
  // rows); someone never on a team after every team, by their own points. Head to head between teams ranks by the team's record.
  if(g.rank.by === 'total' && TeamLogic.on(state)) return r.team ? [1, r.team.points] : [0, r.total || 0];
  // A11 part 4: head to head, how far you went in the playoffs, then the standings: wins (a tie half), then the regular season's
  // points (MatchupLogic.apply puts them on its rows).
  // The playoffs' seats, level on all of it, by their seed (the one tie the seeding broke by who joined first).
  if(g.rank.by === 'matchups' && MatchupLogic.on(state)) {
    const m = r.matchups;
    return m ? [m.tier, m.wins * 2 + m.ties, m.for, m.seed ? -m.seed : 0] : [0, 0, r.total || 0, 0];
  }
  return [r.total];
}
// Weekly Calls (docs/PLAN-new-design.md step 12 part 2): a talk show's season game, scored from each person's calls
// (Call it), which live in the episode_calls table, not in a league's state, as a couch's calls are one per person and
// episode whatever game reads them. So in here everyone is level at 0; the server's game view counts the calls
// (src/lib/server/calls.ts callRights) and ranks the table by them (game-view.ts tableOf). Weekly Bingo (part 3) is the
// same, scored from each person's bingo lines (bingo_cards, src/lib/server/bingo.ts bingoLines).
class CallsScoringStrategy {
  static compute(state){
    return state.players.map(p => ({playerId:p.id, name:p.name, color:p.color, locked:0, bonus:0, finale:0, total:0, roster:[], formerRoster:[]}));
  }
}
// A game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 1): its table is the overall, worked out from its stages' tables
// as the server hands them over (StageLogic), sorted as rankKey ranks it.
class StagesScoringStrategy {
  static compute(state){
    const by = new Map(StageLogic.overall(state).map(r => [r.playerId, r]));
    const rows = state.players.map(p => {
      const r = by.get(p.id) || { overall: 0, points: 0, placePoints: 0, wins: 0, stages: [] };
      return { playerId: p.id, name: p.name, color: p.color, locked: r.overall, bonus: 0, finale: 0, total: r.overall, roster: [], formerRoster: [],
        stages: r.stages, stagePoints: r.points, placePoints: r.placePoints, wins: r.wins };
    });
    return rows.sort((a, b) => PickEmScoringStrategy.compareKeys(rankKey(state, b), rankKey(state, a)));
  }
}
// Thin dispatcher -- see "The pieces" comment near the top of this file. Delegates to the scorer the
// spec's score.by names (scorePiece): EliminationOrderScoringStrategy (the boot order: Outlast),
// ActiveRosterEventScoringStrategy (moments: Weekly Lineup, best ball), PickEmScoringStrategy (who
// survives: Survival Pool), StagesScoringStrategy (stages) or CallsScoringStrategy (answers and bingo
// lines, scored outside the state).
class ScoringLogic {
  // A game over a span scores as it stood at its last episode (spanView). A11 part 1: a draft that knocks players out freezes
  // each one's points at their last episode in and ranks last one standing (KnockoutLogic.apply).
  static compute(state){
    const view = spanView(state);
    // A11 part 5b: a draft's handicap on its rows (a game of questions' is on its walk), before anything below ranks them.
    const rows = HandicapLogic.apply(view, scorePiece(state).compute(view));
    if(KnockoutLogic.on(view)) return KnockoutLogic.apply(view, rows);
    // A11 part 2b: a game of questions' walk, its points and who's out, as the server worked them out (AnswerLogic.walk).
    const walk = AnswerLogic.walkOf(view);
    // A11 part 4: head to head's records and playoffs (MatchupLogic); part 4b, on a game of questions' points from its walk. Part 5:
    // between teams of players, each row carrying its team (TeamLogic.label) and its team's record.
    if(MatchupLogic.on(view)){
      const own = walk ? AnswerLogic.walkRows(rows, walk) : rows;
      return MatchupLogic.apply(view, TeamLogic.on(view) ? TeamLogic.label(view, own) : own);
    }
    const scored = walk ? AnswerLogic.applyWalk(view, rows, walk) : rows;
    // A11 part 5: teams of players, ranked by their teams' points.
    return TeamLogic.on(view) ? TeamLogic.apply(view, scored) : scored;
  }
}

// ---------- KnockoutLogic: a draft's race and players knocked out (docs/PLAN-start-a-game-gpt.md step A11 part 1) ----------
// The spec's rank.race (the first to `to` points wins, and the game ends after that episode) and rank.cut (players knocked out:
// every n episodes by their points over them, the guillotine; after an episode, or before a phase starts, by their total).
// Worked out from the data on every read, as a pool's lives are (PickEmLogic.history): nothing is stored, so a corrected result
// works everything after it out again, and a viewer's copy (spoiler-trimmed) knocks out only what they've seen.
//   - Only final results move it: the walk stops at the newest episode while its results are still early (who went home, before
//     the scoring: EpisodeLogic.resultsStage), so nothing is called on part of an episode; an earlier one still marked early once
//     a later one has results (nothing scored in it, so nothing marked it final) counts as it stands.
//   - Who's in it: everyone playing the league's own season, from their own start (GhostLogic.startFor); not a late joiner's
//     private season (a ghost), nor someone not yet brought in. Someone still catching up is in it but can't be cut or finish a
//     race until they've caught up (they haven't played those episodes yet). Someone out stays out, and nobody new joins once
//     someone is (GhostLogic.allowed).
//   - A cut every n episodes falls after each n of the game's episodes from its start, on each one's points over those n, ties
//     to the total (the lower goes); a cut after an episode, or before a phase, on the total. A cut before a phase falls after
//     the episode before it starts (state.phaseStarts, the desk's: RosterLogic.settlePhases), so where that's known only once
//     the phase has begun, it lands then, its first episode no longer counting for whoever it cut (the fallback).
//   - How many go: `out`, or the bottom half rounded down, never everyone left. A tie at the line keeps everyone tied there (tie
//     'keep') or sends them all (tie 'all', unless that's everyone left). A night nobody goes home (ep.noExit) is cut like any
//     other, or skipped (quiet 'skip').
//   - The game ends once one is left (of two or more), or after the episode a race was won (the most points then win; a season
//     that ends first is won on the most points): lastEpisode, so it's over (gameOver) and scores as it stood then (spanView),
//     as a span's end does.
//   - Someone out scores nothing after their last episode in (`out`: that episode), makes no more moves (lineups, captains,
//     group slots, waivers, side bets: KnockoutLogic.moveProblem, isOut), and in an exclusive draft their castaways are back in
//     the pool for everyone else (leagueOwnersOf; they keep them for their own history, as a late joiner keeps a private team).
// What it reads is each player's total through each episode as the table counts it, with each team as it stood then: a
// lineup's points episode by episode, Outlast's points from whoever was held then (the mid-season log), side bets and finale
// predictions as they settle.
let knockoutsRunning = false;
class KnockoutLogic {
  static parts(state){ return Spec.knockoutParts(gameOf(state)); }
  static on(state){ return !!KnockoutLogic.parts(state); }
  // Each scored episode the game plays, in order: { number, quiet, totals, rows } with every player's total through it (Map
  // playerId -> points) and its parts as a score row has them (Map playerId -> { locked, banked, bonus, finale }). The episodes
  // from its start to its span's end that have results; one whose results are still early stops it while it's the newest (an
  // episode where nothing scored can stay early for good: once a later one has results, it's as final as it will be).
  static series(state){
    const game = gameOf(state);
    const from = Spec.spanStart(game.span);
    if(from === null) return [];
    const to = Spec.spanEnd(game.span);
    const episodes = (state.episodes || []).filter(e => e.number >= from && (to === null || e.number <= to) && EpisodeLogic.hasResults(e)).sort((a,b) => a.number - b.number);
    const players = state.players || [];
    const outlast = game.score.by === 'place';
    const reverse = outlast && EliminationOrderScoringStrategy.reversed(state);
    const numberOf = new Map((state.episodes || []).map(e => [e.id, e.number]));
    const log = (state.midSeason && state.midSeason.log) || [];
    // Who a player held for episode n (Outlast): who they hold now, with every move from that episode on taken back, newest
    // first (a move made after episode k counts from k + 1, as best ball's teamFor reads it).
    const heldAt = (playerId, n) => {
      const held = new Set(Core.ownedCastawayIds(state, playerId));
      for(let i = log.length - 1; i >= 0; i--){
        const tx = log[i];
        if(tx.playerId !== playerId || !Number.isInteger(tx.episode) || tx.episode < n) continue;
        if(tx.addedCastawayId) held.delete(tx.addedCastawayId);
        if(tx.droppedCastawayId) held.add(tx.droppedCastawayId);
      }
      return [...held].map(id => Core.getCastaway(state, id)).filter(Boolean);
    };
    const finaleEp = finaleEpisodeOf(state);
    const finale = finaleEp ? AnswerLogic.finalePoints(state) : new Map();
    const slots = !outlast && GroupSlotLogic.config(state) ? GroupSlotLogic.index(state) : undefined;
    // A11 part 5b: a handicap, each newcomer's points through each episode.
    const tally = HandicapLogic.tally(state, episodes.map(e => e.number));
    const running = new Map(players.map(p => [p.id, 0]));
    const bets = new Map(players.map(p => [p.id, 0]));
    let finaleIn = false;
    const out = [];
    const newest = episodes.length ? episodes[episodes.length - 1].number : null;
    for(const ep of episodes){
      if(EpisodeLogic.resultsStage(ep) === 'early' && ep.number === newest) break;
      // Side bets settled in it (addSideLayers' rule: a bet needs company).
      if(game.extras.bets) (ep.bets || []).forEach(bet => {
        if((bet.predictions || []).length < 2) return;
        bet.predictions.forEach(pred => { if(pred.correct === true && bets.has(pred.playerId)) bets.set(pred.playerId, bets.get(pred.playerId) + (bet.points || 0)); });
      });
      if(finaleEp && finaleEp.id === ep.id) finaleIn = true;
      const totals = new Map();
      const rows = new Map();
      // Outlast: a castaway out by then counts their place (one with no episode recorded, from the start), anyone still in 1 + the
      // boots so far.
      const outBy = c => c.status === 'eliminated' && typeof c.placementOrder === 'number' && (numberOf.has(c.exitEpisodeId) ? numberOf.get(c.exitEpisodeId) : 0) <= ep.number;
      const size = (state.castaways || []).length;
      const boots = outlast ? (state.castaways || []).filter(outBy).length : 0;
      const stillIn = reverse ? size - boots : boots + 1;
      const pre = outlast ? null : { events: ActiveRosterLogic.episodeEvents(state, ep), times: ActiveRosterLogic.timesFor(state, ep.number), slots };
      const handicaps = tally ? tally(ep.number) : null;
      players.forEach(p => {
        let locked = 0, banked = 0;
        if(outlast){
          heldAt(p.id, ep.number).forEach(c => {
            const placed = outBy(c) ? (reverse ? size + 1 - c.placementOrder : c.placementOrder) : null;
            locked += placed === null ? stillIn : placed;
            if(placed !== null) banked += placed;
          });
        } else {
          running.set(p.id, roundPoints(running.get(p.id) + ActiveRosterLogic.episodeScore(state, ep, p.id, pre).total));
          locked = running.get(p.id);
        }
        const bonus = game.extras.bets ? bets.get(p.id) : 0;
        const fin = finaleIn ? (finale.get(p.id) || 0) : 0;
        const handicap = handicaps ? (handicaps.get(p.id) || 0) : 0;
        rows.set(p.id, tally ? { locked, banked, bonus, finale: fin, handicap } : { locked, banked, bonus, finale: fin });
        totals.set(p.id, roundPoints(locked + bonus + fin + handicap));
      });
      out.push({ number: ep.number, quiet: !!ep.noExit, totals, rows });
    }
    return out;
  }
  // The walk: who's out after which episode (Map playerId -> the last episode that counts for them), and where the game ends
  // (the episode a race was won or one was left, else null), with the series it walked. Nothing while a walk is already under
  // way (a read inside it sees the game as its span has it).
  static run(state){
    const parts = KnockoutLogic.parts(state);
    if(!parts || knockoutsRunning) return { out: new Map(), ends: null, series: [] };
    knockoutsRunning = true;
    try { return KnockoutLogic.walk(state, parts); }
    finally { knockoutsRunning = false; }
  }
  static walk(state, parts){
    const series = KnockoutLogic.series(state);
    const start = Spec.spanStart(gameOf(state).span);
    const everyone = (state.players || []).filter(p => !isGhost(p) && !p.disabled && p.active !== false);
    const catching = new Set(everyone.filter(p => GhostLogic.isCatchingUp(state, p.id)).map(p => p.id));
    const startOf = new Map(everyone.map(p => [p.id, GhostLogic.startFor(state, p.id)]));
    const out = new Map();
    // Who can be cut, or finish a race, after episode k: in, started by then, and caught up.
    const inAt = k => everyone.filter(p => !out.has(p.id) && !catching.has(p.id) && (startOf.get(p.id) || start) <= k);
    let ends = null;
    for(let i = 0; i < series.length && ends === null; i++){
      const { number: k, quiet, totals } = series[i];
      const total = id => totals.get(id) || 0;
      if(parts.race && inAt(k).some(p => total(p.id) >= parts.race.to)){ ends = k; break; }
      // The points through the last episode scored at or before n (a window's start).
      const before = n => { const x = series.slice(0, i).filter(y => y.number <= n).pop(); return x ? x.totals : null; };
      KnockoutLogic.cutAfter(state, parts.cuts, { k, start, quiet, inAt, total, before, out });
      // One left of everyone (whatever their start; someone catching up counts): it's over, unless the game plays on (A11 part
      // 2: oneLeft 'plays', the last one's points still growing).
      if(parts.cuts.length && parts.oneLeft === 'ends' && everyone.length >= 2 && everyone.filter(p => !out.has(p.id)).length <= 1) ends = k;
    }
    return { out, ends, series };
  }
  // The cuts after episode k, each in turn on who's left then (A11 part 1; part 2b, a game of questions' too, on its answers' points):
  // every n episodes of the game by the points over them (`before(n)`: the totals through the last episode walked at or before n),
  // ties to the total; after an episode, or the episode before a phase starts (once data says where, as a phase's multiplier reads
  // it: timesFor), by the total. A night nobody goes home (`quiet`) has no cut where the cut skips it. Who goes is set in `out`.
  //   o: { k, start, quiet, inAt(k) (who can be cut), total(id) (through k), before(n), out (Map) }
  static cutAfter(state, cuts, o){
    cuts.forEach(c => {
      const left = o.inAt(o.k);
      if(left.length < 2) return;
      const skip = o.quiet && c.quiet === 'skip';
      let key = null;
      if(Number.isInteger(c.at.every)){
        if((o.k - o.start + 1) % c.at.every !== 0 || skip) return;
        const before = o.before(o.k - c.at.every);
        key = id => [o.total(id) - (before ? before.get(id) || 0 : 0), o.total(id)];
      } else if(Number.isInteger(c.at.episode)){
        if(o.k !== c.at.episode || skip) return;
        key = id => [o.total(id)];
      } else if(typeof c.at.phase === 'string'){
        const from = state.phaseStarts && state.phaseStarts[c.at.phase];
        if(!Number.isInteger(from) || o.k !== from - 1 || skip) return;
        key = id => [o.total(id)];
      }
      if(key) KnockoutLogic.cut(left, key, c).forEach(id => o.out.set(id, o.k));
    });
  }
  // Who a cut sends home: the bottom `out` (or half, rounded down) of those left by `key` (lowest first), never everyone; a tie
  // at the line keeps them all, or sends them all (tie 'all') unless that's everyone left.
  static cut(left, key, c){
    const n = left.length;
    const count = Math.min(c.out === 'half' ? Math.floor(n / 2) : c.out, n - 1);
    if(!(count >= 1)) return [];
    const ranked = left.map(p => ({ id: p.id, key: key(p.id) })).sort((a,b) => PickEmScoringStrategy.compareKeys(a.key, b.key));
    const line = ranked[count - 1].key;
    const below = ranked.filter(r => PickEmScoringStrategy.compareKeys(r.key, line) < 0);
    const at = ranked.filter(r => PickEmScoringStrategy.compareKeys(r.key, line) === 0);
    if(below.length + at.length <= count) return [...below, ...at].map(r => r.id);
    if(c.tie === 'all' && below.length + at.length < n) return [...below, ...at].map(r => r.id);
    return below.map(r => r.id);
  }
  // Where the game ends early: the episode a race was won or one was left, else null. A11 part 2: a pool's too, where one or none
  // left ends it (PickEmLogic.endsAt), so lastEpisode, gameOver, spanView and endedBefore read both; part 2b, a game of questions'
  // as the walk its state carries has it (AnswerLogic.walkOf: none, the span's end).
  static endsAt(state){
    if(KnockoutLogic.on(state)) return KnockoutLogic.run(state).ends;
    // A11 part 4: head to head ends with its playoffs' final.
    if(MatchupLogic.on(state)) return MatchupLogic.endsAt(state);
    const walk = AnswerLogic.walkOf(state);
    return walk ? walk.ends : PickEmLogic.endsAt(state);
  }
  // Each player knocked out, and the last episode that counts for them (Map playerId -> episode number). A11 part 2b: a game of
  // questions' as its walk has it.
  static outs(state){
    if(KnockoutLogic.on(state)) return KnockoutLogic.run(state).out;
    const walk = AnswerLogic.walkOf(state);
    return walk ? new Map(Object.entries(walk.out)) : new Map();
  }
  // The last episode that counts for someone knocked out, or null while they're in.
  static outOf(state, playerId){
    const n = KnockoutLogic.outs(state).get(playerId);
    return Number.isInteger(n) ? n : null;
  }
  static isOut(state, playerId){ return KnockoutLogic.outOf(state, playerId) !== null; }
  // Whether the game ended early before episode `number` (a race won, one left): nothing is played in it.
  static endedBefore(state, number){
    const end = KnockoutLogic.endsAt(state);
    return end !== null && number > end;
  }
  // Why someone can't make a move for episode `number` (a lineup, a captain, a group slot): the game ended before it (a race won,
  // one left), or they're out. Null when they can, or the game knocks nobody out.
  static moveProblem(state, playerId, number){
    // A11 part 4: nor after head to head's final.
    if(!KnockoutLogic.on(state)) return MatchupLogic.on(state) ? MatchupLogic.moveProblem(state, number) : null;
    const { out, ends } = KnockoutLogic.run(state);
    if(ends !== null && number > ends) return 'This game ended with episode ' + ends;
    return out.has(playerId) ? 'You’re out of this game' : null;
  }
  // Whether a knocked-out player's castaways are back in the pool: an exclusive draft's (a shared draft's were never theirs alone).
  static frees(state){
    const g = gameOf(state);
    return g.get.by === 'draft' && g.get.own === 'exclusive' && Array.isArray(g.rank.cut) && g.rank.cut.length > 0;
  }
  // The score rows with each one's `out` (the last episode that counts for them, null while in) and their points frozen there;
  // ranked last one standing when it cuts (standingKey: whoever's still in by their points, then whoever went out last).
  static apply(state, rows){
    const { out, series } = KnockoutLogic.run(state);
    const at = new Map(series.map(x => [x.number, x]));
    rows.forEach(r => {
      const k = out.get(r.playerId);
      r.out = Number.isInteger(k) ? k : null;
      if(r.out === null || !at.has(k)) return;
      // Frozen there, its parts with it: what they had then.
      const was = at.get(k).rows.get(r.playerId);
      if(was){
        r.locked = was.locked;
        if('banked' in r) r.banked = was.banked;
        r.bonus = was.bonus;
        r.finale = was.finale;
        // A11 part 5b: a handicap's, as it stood then.
        if(r.handicap !== undefined && was.handicap !== undefined) r.handicap = was.handicap;
      }
      r.total = at.get(k).totals.get(r.playerId) || 0;
    });
    if(!KnockoutLogic.parts(state).cuts.length) return rows;
    return rows.sort((a,b) => PickEmScoringStrategy.compareKeys(PickEmScoringStrategy.standingKey(b), PickEmScoringStrategy.standingKey(a)) || b.total - a.total);
  }
}

// ---------- MatchupLogic: head to head, with playoffs (docs/PLAN-start-a-game-gpt.md step A11 part 4) ----------
// The spec's rank.by 'matchups' (Spec.matchupParts), a draft's: each episode the game plays, everyone plays one of the others on
// that episode's points by the game's own scoring (KnockoutLogic.series: a lineup's or best ball's points that episode, Outlast's
// growth, side bets and finale predictions as they settle, each team as it stood then), and more points wins it. Part 4b, a game
// of questions': each episode's points what its answers settled by then add (its walk's series, the server's: AnswerLogic.walk;
// a state without the walk plays nobody, the safe fallback a reader not taught yet gets). Both through MatchupLogic.series. Worked out from
// the data on every read, as the knockouts are, so a corrected result works everything after it out again and a viewer's copy
// plays only what they've seen; the one thing kept is where the playoffs began, once they have (settle, below).
//   - The schedule: a round robin (the circle method) over the seats in the game at each episode, in the order they joined, a
//     round an episode from the game's first: the same on every read. In it: everyone playing the league's own season, from when
//     they joined it (state.matchupSeats, kept on every write: settle), a disabled seat too (its team plays on and its points
//     keep counting, as disablePlayer has it); not a ghost (a late joiner's private season), a seat still to be brought in, or one
//     still catching up. A seat that comes in later (brought in mid-season, a late joiner once caught up) plays from the first
//     episode still to play then: the round robin over the new list from that episode, the ones played as they were. The first
//     time the seats are kept (a game made head to head, or one before they were), everyone there is in from their own start
//     (GhostLogic.startFor), as they are on a copy that's never been written (a state without them).
//   - An odd number of seats: whoever the round robin leaves out plays the median of everyone else's points that episode (odd
//     'median', the default: a win, a loss or a tie on their record alone) or sits it out (odd 'bye').
//   - A matchup: more points that episode wins it, the same points is a tie (half a win). A night nobody in it scores (everyone on
//     0: nobody went home in an Outlast) counts for nobody (quiet 'skip', the default) or ties everyone (quiet 'tie'). Results still
//     early wait: the series stops at the newest episode while its results are early, as a cut does.
//   - The standings: wins (a tie half), then the points over the regular season, then the order they joined.
//   - The playoffs (rank.playoffs): the top `teams` by the standings through the episode before them, seeded, a bracket of
//     `rounds` rounds (the best seed against the lowest), one an episode, over the game's last episodes: its span's end, else the
//     season's last episode as its schedule says (state.seasonEpisodes, the server's: air-times.ts), the earlier of the two when
//     both are known; or from `from` when the spec says it. A bracket short of seeds (fewer of you than it takes) gives the top
//     seeds byes; a playoff tie, or a night nobody scores, goes to the better seed. Where they begin is kept once their first
//     round has results (state.playoffsFrom: settle, on every write), so the season's schedule changing after that moves nothing:
//     a season longer than it said ends the game with its final, and one that ends first (the season over with rounds still to
//     play, its finale earlier than its schedule said, or a schedule that counts a reunion) is won by the best seed still in:
//     nothing after the finale plays. Where nothing says the game's end (no span's end, no schedule), there are no
//     playoffs until something does, and a season that ends first is the standings'. Nor does a regular-season week after the
//     season's finale (a schedule that counts a reunion: part 4b).
//   - The game ends with its final (endsAt, through KnockoutLogic.endsAt and lastEpisode): over there (gameOver), scored as it
//     stood then (spanView), and no move is made for an episode after it (moveProblem).
// Its rows (apply) carry `matchups`: { wins, losses, ties, for, against, seed, tier, alive, champion }, ranked by rankKey: how far
// they went in the playoffs (tier: 0 out of them or before them, 1 in them, one more for each round won, the champion one past the
// last round), then the standings.
let matchupsRunning = false;
class MatchupLogic {
  static parts(state){ return Spec.matchupParts(gameOf(state)); }
  static on(state){ return !!MatchupLogic.parts(state); }
  // Whether the game places its playoffs by the game's end as the data has it (no `from` of its own): what the server stamps the
  // season's length for (state.seasonEpisodes, air-times.ts).
  static readsSeasonLength(state){
    const parts = MatchupLogic.parts(state);
    return !!(parts && parts.playoffs && parts.playoffs.from === null);
  }
  // The game's last episode as the data has it, for its playoffs: its span's end, else the season's from its schedule, the earlier
  // of the two when both are known; null when neither is.
  static lastOf(state){
    const to = endEpisode(state);
    const n = Number.isInteger(state.seasonEpisodes) && state.seasonEpisodes >= 1 ? state.seasonEpisodes : null;
    return to === null ? n : n === null ? to : Math.min(to, n);
  }
  // The episode the playoffs' first round is, or null (none, or nothing says the game's end yet): the spec's `from`; else where they
  // began (state.playoffsFrom, once their first round has results); else the game's last `rounds` episodes, as long as at least
  // one episode of matchups comes before them.
  static playoffsFrom(state, parts){
    const p = (parts || MatchupLogic.parts(state) || {}).playoffs;
    if(!p) return null;
    if(p.from !== null) return p.from;
    if(Number.isInteger(state.playoffsFrom)) return state.playoffsFrom;
    const last = MatchupLogic.lastOf(state);
    const start = startEpisode(state);
    if(last === null || start === null) return null;
    const from = last - p.rounds + 1;
    return from > start ? from : null;
  }
  // Where the game ends: the episode its playoffs' final is played in, or null (no playoffs, or not placed yet: its span's end).
  static endsAt(state){
    const parts = MatchupLogic.parts(state);
    const from = parts ? MatchupLogic.playoffsFrom(state, parts) : null;
    return from === null ? null : from + parts.playoffs.rounds - 1;
  }
  // Where the game ended, once it has (A11 part 4b, for what says so: answers.ts): its final played, or the season over before it
  // (nothing after the finale plays: the finale's episode); null while it plays (its final's results still early, or a question
  // about it still to settle), or with nothing placing its end.
  static endedAt(state){
    const end = MatchupLogic.endsAt(state);
    const w = end === null ? null : MatchupLogic.run(state);
    if(!w) return null;
    const last = w.rounds[w.rounds.length - 1];
    if(last && last.number === end && last.played) return end;
    const finale = seasonEnded(state) ? finaleEpisodeOf(state) : null;
    return finale && finale.number < end ? finale.number : null;
  }
  // Why a move for episode `number` can't be made: the game ended with its final before it. Null when it can.
  static moveProblem(state, number){
    const end = MatchupLogic.endsAt(state);
    return end !== null && number > end ? 'This game ended with episode ' + end : null;
  }
  // The seats in the game at episode k, in the order they joined: playing the league's own season (not a ghost), brought in, and in
  // its schedule by k (state.matchupSeats: from when it joined; without them, from its own start, and not while catching up). A
  // disabled seat stays: its team plays on, its points counting (disablePlayer).
  static seatsAt(state, k){
    // A11 part 5: between teams of players, the sides are the teams with someone on them then.
    if(TeamLogic.on(state)) return TeamLogic.teamsAt(state, k);
    const start = startEpisode(state);
    const kept = MatchupLogic.kept(state);
    return (state.players || []).filter(p => {
      if(isGhost(p) || p.active === false) return false;
      if(kept) return Number.isInteger(kept[p.id]) && kept[p.id] <= k;
      return !GhostLogic.isCatchingUp(state, p.id) && (GhostLogic.startFor(state, p.id) || start) <= k;
    }).map(p => p.id);
  }
  // Each episode the game has played, in order, with everyone's points through it ({ number, totals: Map playerId -> points }): a
  // draft's from its own scoring (KnockoutLogic.series), a game of questions' from its answers' walk (A11 part 4b: AnswerLogic.walk's
  // series, on the copy the server walked; none without it, so nobody has played).
  // A11 part 5: between teams of players, each team's (TeamLogic.series: what its members on it earned).
  static series(state){
    return TeamLogic.on(state) ? TeamLogic.series(state) : MatchupLogic.seatSeries(state);
  }
  // Each seat's points through each episode played, whatever the sides: a draft's, or a game of questions' walk's.
  static seatSeries(state){
    if(!Spec.questionsGame(gameOf(state))) return KnockoutLogic.series(state);
    const walk = AnswerLogic.walkOf(state);
    return walk && Array.isArray(walk.series) ? walk.series.map(x => ({ number: x.number, totals: new Map(Object.entries(x.totals)) })) : [];
  }
  // When each seat joined the schedule (state.matchupSeats, settle's: playerId -> the first episode it plays), or null.
  static kept(state){ const m = state.matchupSeats; return m && typeof m === 'object' && !Array.isArray(m) ? m : null; }
  // Round r of a round robin over `ids` (the circle method: the first stays put, the rest turn a place each round), as pairs [a, b],
  // b null for whoever an odd list leaves out that round. One seat alone plays nobody.
  static round(ids, r){
    if(ids.length < 2) return [];
    const list = ids.length % 2 ? [...ids, null] : ids.slice();
    const n = list.length;
    const turn = ((r % (n - 1)) + (n - 1)) % (n - 1);
    const rest = list.slice(1);
    const circle = [list[0], ...rest.slice(rest.length - turn), ...rest.slice(0, rest.length - turn)];
    const pairs = [];
    for(let i = 0; i < n / 2; i++){
      const a = circle[i], b = circle[n - 1 - i];
      pairs.push(a === null ? [b, null] : [a, b]);
    }
    return pairs;
  }
  // The middle of some points (the mean of the middle two of an even count); 0 for none.
  static median(values){
    const v = values.slice().sort((a,b) => a - b);
    if(!v.length) return 0;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : roundPoints((v[m - 1] + v[m]) / 2);
  }
  // A bracket's first-round order of seeds for `size` places (a power of two): the best against the lowest, the top two meeting only
  // in the final ([1, 4, 2, 3]; [1, 8, 4, 5, 2, 7, 3, 6]). Consecutive places play each other.
  static bracket(size){
    let order = [1];
    while(order.length < size){
      const n = order.length * 2;
      order = order.flatMap(s => [s, n + 1 - s]);
    }
    return order;
  }
  // The walk, once a read (nothing while one is already under way: a read inside it sees the game as its span has it), or null for
  // a game that isn't head to head.
  static run(state){
    const parts = MatchupLogic.parts(state);
    if(!parts || matchupsRunning) return null;
    matchupsRunning = true;
    try { return MatchupLogic.walk(state, parts); }
    finally { matchupsRunning = false; }
  }
  // Each regular-season episode's matchups, everyone's record, and the playoffs as far as they've gone, as plain data:
  //   weeks     [{ number, quiet, games: [{ a, b (a seat, or null: nobody to play), aPoints, bPoints (b's, the median's, or null
  //             for a bye), result: 'a' | 'b' | 'tie' | null (counts for nobody: a bye, a quiet night skipped) }] }]
  //   records   Map playerId -> { wins, losses, ties, for (their points over the regular season), against }
  //   from      the playoffs' first round, or null
  //   seeds     [playerId], best first, once every episode before the playoffs has been played (or the season ended first); else null
  //   rounds    [{ number, played, games: [{ a, b (a seed's seat, or null: a bye), aSeed, bSeed, aPoints, bPoints, winner }] }],
  //             up to the first still to play
  //   alive     Set of the seeds still in; champion, the final's winner (or the best seed still in, the season over first), or null
  //   tiers     Map playerId -> how far they went (rankKey's first number)
  static walk(state, parts){
    const series = MatchupLogic.series(state);
    const start = startEpisode(state);
    const from = MatchupLogic.playoffsFrom(state, parts);
    // Nothing after the season's finale plays (a schedule that counts a reunion), the playoffs' rounds nor a regular-season week.
    const ended = seasonEnded(state);
    const finale = ended ? finaleEpisodeOf(state) : null;
    // The sides: the seats, or (A11 part 5) the teams of players.
    const sides = TeamLogic.on(state) ? TeamLogic.ids(state) : (state.players || []).map(p => p.id);
    const records = new Map();
    const rec = id => {
      if(!records.has(id)) records.set(id, { wins: 0, losses: 0, ties: 0, for: 0, against: 0 });
      return records.get(id);
    };
    const tally = (id, theirs, result) => {
      const r = rec(id);
      r.against = roundPoints(r.against + theirs);
      if(result === 'win') r.wins++;
      else if(result === 'loss') r.losses++;
      else r.ties++;
    };
    const weeks = [];
    const playoff = new Map();
    let before = null;
    for(const x of series){
      const k = x.number;
      const pts = new Map(sides.map(id => [id, roundPoints((x.totals.get(id) || 0) - (before ? before.totals.get(id) || 0 : 0))]));
      before = x;
      if(from !== null && k >= from){ playoff.set(k, pts); continue; }
      if(finale && k > finale.number) continue;
      const seats = MatchupLogic.seatsAt(state, k);
      seats.forEach(id => { const r = rec(id); r.for = roundPoints(r.for + (pts.get(id) || 0)); });
      const quiet = seats.length > 0 && seats.every(id => !pts.get(id));
      const games = MatchupLogic.round(seats, k - start).map(([a, b]) => {
        const aPoints = pts.get(a) || 0;
        if(b === null && parts.odd === 'bye') return { a, b: null, aPoints, bPoints: null, result: null };
        const bPoints = b === null ? MatchupLogic.median(seats.filter(id => id !== a).map(id => pts.get(id) || 0)) : pts.get(b) || 0;
        const result = quiet ? (parts.quiet === 'tie' ? 'tie' : null) : aPoints > bPoints ? 'a' : bPoints > aPoints ? 'b' : 'tie';
        if(result !== null){
          tally(a, bPoints, result === 'a' ? 'win' : result === 'b' ? 'loss' : 'tie');
          if(b !== null) tally(b, aPoints, result === 'b' ? 'win' : result === 'a' ? 'loss' : 'tie');
        }
        return { a, b, aPoints, bPoints, result };
      });
      weeks.push({ number: k, quiet, games });
    }
    const out = { weeks, records, from, seeds: null, rounds: [], alive: new Set(), champion: null, tiers: new Map() };
    // Seeded once every episode before the playoffs has been played (the series reached the one before their first), or once the
    // season ended first: the standings as they are.
    const reached = series.length ? series[series.length - 1].number : null;
    if(from === null || !((reached !== null && reached >= from - 1) || ended)) return out;
    const key = id => { const r = records.get(id); return r ? [r.wins * 2 + r.ties, r.for] : [0, 0]; };
    const ranked = MatchupLogic.seatsAt(state, from).map((id, i) => ({ id, i, key: key(id) }))
      .sort((a,b) => PickEmScoringStrategy.compareKeys(b.key, a.key) || a.i - b.i);
    const n = Math.min(parts.playoffs.teams, ranked.length);
    if(n < 2) return out;
    const seeds = ranked.slice(0, n).map(r => r.id);
    out.seeds = seeds;
    seeds.forEach(id => out.tiers.set(id, 1));
    // A bracket of the spec's size; a seed past the field's is a bye. Nothing after the season's finale plays (a schedule that counts
    // a reunion, or a finale earlier than it said): the season over first, the best seed still in wins.
    let alive = MatchupLogic.bracket(2 ** parts.playoffs.rounds).map(s => (s <= n ? s : null));
    for(let j = 0; j < parts.playoffs.rounds; j++){
      const number = from + j;
      const pts = finale && number > finale.number ? null : playoff.get(number) || null;
      const games = [];
      const next = [];
      for(let g = 0; g < alive.length; g += 2){
        const a = alive[g], b = alive[g + 1];
        const game = { a: a === null ? null : seeds[a - 1], b: b === null ? null : seeds[b - 1], aSeed: a, bSeed: b, aPoints: null, bPoints: null, winner: null };
        let w;
        if(a === null || b === null){
          // A bye: the seed there goes through.
          w = a === null ? b : a;
        } else if(pts){
          game.aPoints = pts.get(game.a) || 0;
          game.bPoints = pts.get(game.b) || 0;
          // A tie, or a night nobody scores, goes to the better seed.
          w = game.aPoints > game.bPoints ? a : game.bPoints > game.aPoints ? b : Math.min(a, b);
        }
        if(Number.isInteger(w) && (pts || a === null || b === null)) game.winner = seeds[w - 1];
        next.push(pts ? (Number.isInteger(w) ? w : null) : undefined);
        games.push(game);
      }
      out.rounds.push({ number, played: !!pts, games });
      if(!pts) break;
      next.forEach(s => { if(Number.isInteger(s)) out.tiers.set(seeds[s - 1], j + 2); });
      alive = next;
    }
    const still = alive.filter(s => Number.isInteger(s));
    still.forEach(s => out.alive.add(seeds[s - 1]));
    const last = out.rounds[out.rounds.length - 1];
    if(out.rounds.length === parts.playoffs.rounds && last.played) out.champion = last.games[0].winner;
    // The season over with rounds still to play: the best seed still in.
    else if(ended && still.length) out.champion = seeds[Math.min(...still) - 1];
    if(out.champion){
      out.tiers.set(out.champion, parts.playoffs.rounds + 1);
      out.alive = new Set([out.champion]);
    }
    return out;
  }
  // The score rows with each one's `matchups` (their record, seed, how far they went), ranked as the game ranks (rankKey), then by
  // their points.
  static apply(state, rows){
    const w = MatchupLogic.run(state);
    if(!w) return rows;
    // A row that's no seat (a ghost's own, on their copy) has no record: it's in nobody's schedule. A11 part 5: between teams of
    // players, a row's record is its team's (the one it plays for: TeamLogic.sideOf), none for someone on no team.
    const seats = new Set(MatchupLogic.seatsAt(state, Number.MAX_SAFE_INTEGER));
    const sideOf = MatchupLogic.sideOf(state);
    rows.forEach(r => {
      const side = sideOf(r.playerId);
      if(side === null || (!seats.has(side) && !w.records.has(side))){ r.matchups = null; return; }
      const rec = w.records.get(side) || { wins: 0, losses: 0, ties: 0, for: 0, against: 0 };
      const seed = w.seeds ? w.seeds.indexOf(side) + 1 : 0;
      r.matchups = { ...rec, seed: seed || null, tier: w.tiers.get(side) || 0, alive: w.alive.has(side), champion: w.champion === side };
    });
    return rows.sort((a,b) => PickEmScoringStrategy.compareKeys(rankKey(state, b), rankKey(state, a)) || b.total - a.total);
  }
  // Whose side a seat is on (playerId -> side): itself, or (A11 part 5) the team of players it plays for (null: none).
  static sideOf(state){
    return TeamLogic.on(state) ? (id => TeamLogic.sideOf(state, id)) : (id => id);
  }
  // Who a seat plays at episode n, from a walk: { episode, round (the playoffs' round, 1 the first; null in the regular season),
  // opponent (a seat, or null), stand ('median' | 'bye' with no opponent in the regular season; 'bye' in the playoffs) }, or null
  // (not in it then: out of the playoffs, or never in them, or the game over).
  static gameAt(state, w, parts, playerId, n){
    const end = MatchupLogic.endsAt(state);
    if(end !== null && n > end) return null;
    if(w.from !== null && n >= w.from){
      const r = w.rounds[n - w.from];
      const g = r && r.games.find(x => x.a === playerId || x.b === playerId);
      if(!g) return null;
      const opponent = g.a === playerId ? g.b : g.a;
      return { episode: n, round: n - w.from + 1, opponent, stand: opponent === null ? 'bye' : null };
    }
    const start = startEpisode(state);
    if(start === null || n < start) return null;
    const seats = MatchupLogic.seatsAt(state, n);
    const pair = MatchupLogic.round(seats, n - start).find(([a, b]) => a === playerId || b === playerId);
    if(!pair) return null;
    const opponent = pair[0] === playerId ? pair[1] : pair[0];
    return { episode: n, round: null, opponent, stand: opponent === null ? parts.odd : null };
  }
  // What a seat sees of it (the Games tab's, game-view.ts), from their own copy: their record; their next matchup (the first of the
  // game's episodes without its full results) and the latest played, with its points and result; the playoffs (where they are,
  // the seeds once known, the bracket so far, the champion). Null for a game that isn't head to head.
  static view(state, seatId){
    const w = MatchupLogic.run(state);
    if(!w) return null;
    const parts = MatchupLogic.parts(state);
    // A11 part 5: between teams of players, the seat's team is what plays (its record, its matchups); a seat on none plays nobody.
    const playerId = MatchupLogic.sideOf(state)(seatId);
    const record = (playerId !== null && w.records.get(playerId)) || { wins: 0, losses: 0, ties: 0, for: 0, against: 0 };
    const played = [...w.weeks.map(x => x.number), ...w.rounds.filter(r => r.played).map(r => r.number)];
    const start = startEpisode(state);
    const newest = played.length ? Math.max(...played) : null;
    const n = newest !== null ? newest + 1 : start;
    const next = n === null || gameOver(state) || playerId === null ? null : MatchupLogic.gameAt(state, w, parts, playerId, n);
    // Their latest matchup played: the newest episode they were in one (someone out of the playoffs, their last game).
    let last = null;
    for(const k of playerId === null ? [] : played.slice().sort((a,b) => b - a)){
      const week = w.weeks.find(x => x.number === k);
      const round = w.rounds.find(r => r.number === k && r.played);
      const g = (week || round).games.find(x => x.a === playerId || x.b === playerId);
      if(!g) continue;
      const mine = g.a === playerId;
      const opponent = mine ? g.b : g.a;
      const points = mine ? g.aPoints : g.bPoints, against = mine ? g.bPoints : g.aPoints;
      if(week){
        const result = g.result === null ? null : g.result === 'tie' ? 'tie' : (g.result === 'a') === mine ? 'win' : 'loss';
        last = { episode: k, round: null, opponent, stand: opponent === null ? parts.odd : null, points, against, result };
      } else {
        last = { episode: k, round: k - w.from + 1, opponent, stand: opponent === null ? 'bye' : null, points, against, result: g.winner === playerId ? 'win' : 'loss' };
      }
      break;
    }
    const playoffs = w.from === null ? null : {
      from: w.from, rounds: parts.playoffs.rounds, teams: parts.playoffs.teams, seeds: w.seeds,
      bracket: w.rounds.map(r => ({ episode: r.number, played: r.played, games: r.games.map(g => ({ ...g })) })),
      champion: w.champion,
    };
    return { record, next, last, playoffs, side: TeamLogic.on(state) ? playerId : null };
  }
  // On every write (db.ts withLeagueLock): keeps when each seat joined the schedule (state.matchupSeats: the first time, everyone
  // there from their own start; after that, a seat new to it, or caught up, from the first episode still to play, never one
  // played), and where the playoffs began once their first round has results (state.playoffsFrom), so the season's schedule
  // changing after that moves nothing; lets the playoffs' go when those results are taken back, or the game no longer places its
  // playoffs itself (none, or a `from` of its own), and both go when it's no longer head to head. True when anything changed.
  static settle(state){
    const seats = MatchupLogic.settleSeats(state);
    return MatchupLogic.settlePlayoffs(state) || seats;
  }
  static settleSeats(state){
    const start = MatchupLogic.on(state) ? startEpisode(state) : null;
    const kept = MatchupLogic.kept(state);
    if(start === null){
      if(state.matchupSeats === undefined) return false;
      delete state.matchupSeats;
      return true;
    }
    const map = kept ? { ...kept } : {};
    const open = Math.max(start, SpoilerLogic.latestWithResults(state) + 1);
    let changed = !kept;
    (state.players || []).forEach(p => {
      if(isGhost(p) || p.active === false || Number.isInteger(map[p.id]) || GhostLogic.isCatchingUp(state, p.id)) return;
      const own = GhostLogic.startFor(state, p.id) || start;
      map[p.id] = kept ? Math.max(own, open) : own;
      changed = true;
    });
    if(changed) state.matchupSeats = map;
    return changed;
  }
  static settlePlayoffs(state){
    const parts = MatchupLogic.parts(state);
    const had = state.playoffsFrom;
    const placed = !!(parts && parts.playoffs && parts.playoffs.from === null);
    const resultsAt = n => { const ep = (state.episodes || []).find(e => e.number === n); return !!ep && EpisodeLogic.hasResults(ep); };
    if(had !== undefined){
      if(placed && Number.isInteger(had) && resultsAt(had)) return false;
      delete state.playoffsFrom;
    }
    if(placed){
      const from = MatchupLogic.playoffsFrom(state, parts);
      if(from !== null && resultsAt(from)){ state.playoffsFrom = from; return from !== had; }
    }
    return had !== undefined;
  }
}

// ---------- TeamLogic: teams of players (docs/PLAN-start-a-game-gpt.md step A11 part 5) ----------
// The spec's rank.teams (Spec.teamParts): the couch split into teams that score together. Each of you still plays your own game
// (your own draft, lineup or answers); your points go to your team while you're on it, and the game ranks the teams: by their points
// (rank.by 'total'), or head to head between them (rank.by 'matchups': MatchupLogic plays the teams in place of the seats). Worked
// out from the data on every read, as the knockouts are, so a corrected result works it all out again and a viewer's copy counts
// only what they've seen; what's kept is who's on which team.
//   - Who's on which team (state.teamSeats, kept on every write: settle): each seat's spells, [{ team, from }] (team null: on none),
//     the latest at or before an episode its team then. Nothing is kept for a drawn game until it starts: its draw is worked out on
//     every read from its seed (state.teamDraw.seed, set as it's made in teams: setGame; a state without one draws from a fixed
//     one), over the seats in the game's rotation there from its start, dealt in the seed's order a team each in turn (sizes one
//     apart at most), so the same seats give the same teams on every read, and someone joining or leaving before the start can
//     deal others onto other teams. Once the game has started (its first episode locked, or with results) the draw as it stood is
//     kept, each from their own start. A game made in teams mid-season keeps it at once, counting its past.
//   - Chosen (made 'choose'): each seat picks its team before the game starts (choose: the seat, or whoever runs the game); kept as
//     chosen, from their start.
//   - Someone on no team when they start counting (unplaced): a seat that didn't choose by the start, a late joiner once caught up,
//     a seat brought in later, one whose team the spec no longer has: onto the smallest team then (the first of them on a tie),
//     from their start at the game's start and from the first episode still to play after it; or onto none (unplaced 'none': they
//     play for nobody, ranked after every team). A ghost (a late joiner's private season) never joins one; someone still catching up
//     joins once caught up.
//   - A disabled seat leaves its team from the first episode still to play, its points before staying with the team; reclaimed, it
//     goes back to that team from the first episode still to play then. A seat removed outright is gone, its points with it.
//   - Whoever runs the game can move a seat to another team (choose): before the start, as chosen; after it, from the first episode
//     still to play (not locked, nor with results: openFor), so nothing played or in play changes. A late joiner, a disabled seat
//     and one reclaimed are placed from there too.
//   - A team's points: each episode the game has played (its series: MatchupLogic.seatSeries, a draft's from its own scoring, a
//     game of questions' from its answers' walk), what its members on it then earned in it, summed (score 'sum') or their mean
//     (score 'mean': over the members on it that episode, so a team of three and one of two weigh the same); then what they've
//     earned since the last episode walked as the table has it (results still early, a question settled since), on the team
//     they're on now. A team nobody's on scores nothing.
//   - Ranked: every member shares their team's place (rankKey: its points; head to head, its record and how far it went in the
//     playoffs, as MatchupLogic ranks it), listed by their own points; a seat's team is the last it played for. Someone never on a
//     team ranks after every team.
// A draw before it's kept, memoised by state: its seats, start and seed say whether it's still the one worked out.
const teamDraws = new WeakMap();
class TeamLogic {
  static parts(state){ return Spec.teamParts(gameOf(state)); }
  static on(state){ return !!TeamLogic.parts(state); }
  // The teams' ids, in order ('t1', 't2', ...), and each one's name as the spec gives it (null: none given; the words call it Team N).
  static ids(state){ const p = TeamLogic.parts(state); return p ? Array.from({ length: p.of }, (_, i) => 't' + (i + 1)) : []; }
  static nameOf(state, id){
    const p = TeamLogic.parts(state);
    const i = typeof id === 'string' && /^t\d+$/.test(id) ? Number(id.slice(1)) - 1 : -1;
    return p && i >= 0 && i < p.of ? p.names[i] : null;
  }
  // The kept spells (state.teamSeats: playerId -> [{ team, from, left? }]), or null.
  static kept(state){ const m = state.teamSeats; return m && typeof m === 'object' && !Array.isArray(m) ? m : null; }
  // Whether the teams are kept for good (the game has started and settle kept them): anyone with no spell is on none yet.
  static fixed(state){ return !!(state.teamDraw && state.teamDraw.kept); }
  // Whether the game has started: its first episode has results, or has locked (closedForPlay, its air time stamped).
  static started(state, now){
    const start = startEpisode(state);
    if(start === null) return false;
    if(SpoilerLogic.latestWithResults(state) >= start) return true;
    const ep = (state.episodes || []).find(e => e.number === start);
    return !!ep && closedForPlay(ep, now);
  }
  // The seats a team can hold: in the game's rotation playing the league's own season (not a ghost, not one still to be brought in),
  // in the order they joined; `all` keeps a disabled one.
  static seats(state, all){
    return (state.players || []).filter(p => !isGhost(p) && p.active !== false && (all || !p.disabled));
  }
  // The draw's seed, set once (setGame, as a game is made in teams; settle, for a state without one): true when it was set now.
  static seed(state){
    if(state.teamDraw && typeof state.teamDraw.seed === 'string') return false;
    state.teamDraw = { ...(state.teamDraw || {}), seed: Core.uid('teams') };
    return true;
  }
  // A draw's teams before it's kept (Map playerId -> team): the seats there from the game's start, not catching up, in the order the
  // seed deals them, a team each in turn. Worked out once for the same seats, start and seed.
  static drawn(state){
    const ids = TeamLogic.ids(state);
    const start = startEpisode(state);
    const seed = state.teamDraw && typeof state.teamDraw.seed === 'string' ? state.teamDraw.seed : 'teams';
    const seats = TeamLogic.seats(state).filter(p => !GhostLogic.isCatchingUp(state, p.id) && (start === null || (GhostLogic.startFor(state, p.id) || start) <= start)).map(p => p.id);
    const sig = `${seed}|${start}|${ids.length}|${seats.join(',')}`;
    const was = teamDraws.get(state);
    if(was && was.sig === sig) return was.map;
    const order = [...seats].sort((a, b) => hashUnit(`${seed}|team|${a}`) - hashUnit(`${seed}|team|${b}`) || (a < b ? -1 : a > b ? 1 : 0));
    const map = new Map(ids.length ? order.map((id, i) => [id, ids[i % ids.length]]) : []);
    teamDraws.set(state, { sig, map });
    return map;
  }
  // A seat's team at episode n: its kept spell then (none before its first), else, before they're kept, a draw's provisional team.
  static teamAt(state, playerId, n){
    if(!TeamLogic.on(state)) return null;
    const ids = TeamLogic.ids(state);
    const spells = (TeamLogic.kept(state) || {})[playerId];
    if(Array.isArray(spells) && spells.length){
      let t = null;
      for(const s of spells) if(Number.isInteger(s.from) && s.from <= n) t = s.team;
      return ids.includes(t) ? t : null;
    }
    if(TeamLogic.fixed(state) || TeamLogic.parts(state).made !== 'draw') return null;
    return TeamLogic.drawn(state).get(playerId) || null;
  }
  // The team a seat plays for: the last one it was on (a disabled seat's, the one it left), or null for none.
  static sideOf(state, playerId){
    if(!TeamLogic.on(state)) return null;
    const ids = TeamLogic.ids(state);
    const spells = (TeamLogic.kept(state) || {})[playerId];
    if(Array.isArray(spells) && spells.length){
      const last = spells.filter(s => ids.includes(s.team)).pop();
      return last ? last.team : null;
    }
    return TeamLogic.teamAt(state, playerId, Number.MAX_SAFE_INTEGER);
  }
  // Who's on each team at episode n (Map team -> [playerId]), every team listed.
  static membersAt(state, n){
    const out = new Map(TeamLogic.ids(state).map(t => [t, []]));
    (state.players || []).forEach(p => { const t = TeamLogic.teamAt(state, p.id, n); if(t) out.get(t).push(p.id); });
    return out;
  }
  // The teams with someone on them at episode n, in order: head to head's sides (MatchupLogic.seatsAt).
  static teamsAt(state, n){
    return [...TeamLogic.membersAt(state, n)].filter(([, m]) => m.length).map(([t]) => t);
  }
  // Adds one step's points to each team (`run`, Map team -> points): each member on a team at episode k, what they earned since
  // `before` (Map playerId -> points; null: from nothing), summed or their mean.
  static addStep(state, parts, now, before, k, run){
    const by = new Map();
    (state.players || []).forEach(p => {
      const t = TeamLogic.teamAt(state, p.id, k);
      if(!t || !run.has(t)) return;
      const grown = roundPoints((now.get(p.id) || 0) - (before ? before.get(p.id) || 0 : 0));
      if(!by.has(t)) by.set(t, []);
      by.get(t).push(grown);
    });
    by.forEach((gs, t) => {
      const sum = gs.reduce((a, b) => a + b, 0);
      run.set(t, roundPoints(run.get(t) + (parts.score === 'sum' ? sum : sum / gs.length)));
    });
  }
  // Each episode the game has played, with each team's points through it ({ number, totals: Map team -> points }): head to head's
  // series between the teams (MatchupLogic.series), an episode's points a team's growth.
  static series(state){
    const parts = TeamLogic.parts(state);
    if(!parts) return [];
    const run = new Map(TeamLogic.ids(state).map(t => [t, 0]));
    const out = [];
    let before = null;
    for(const x of MatchupLogic.seatSeries(state)){
      TeamLogic.addStep(state, parts, x.totals, before, x.number, run);
      before = x.totals;
      out.push({ number: x.number, totals: new Map(run) });
    }
    return out;
  }
  // The teams as they stand, given the score rows (each one's points as the table shows them): [{ id, name, points, place, rank,
  // members: [playerId] (on it now), played: [playerId] (whose team it is: sideOf) }], best first, ties sharing a place: by their
  // points, or head to head (MatchupLogic) as it ranks them (how far in the playoffs, then wins, then the regular season's points,
  // then the seed).
  static standings(state, rows){
    const parts = TeamLogic.parts(state);
    if(!parts) return null;
    const ids = TeamLogic.ids(state);
    const run = new Map(ids.map(t => [t, 0]));
    const base = MatchupLogic.seatSeries(state);
    let before = null;
    for(const x of base){
      TeamLogic.addStep(state, parts, x.totals, before, x.number, run);
      before = x.totals;
    }
    // What's been earned since the last episode walked, as the table has it, on the team each is on then.
    const start = startEpisode(state);
    const last = base.length ? base[base.length - 1].number : null;
    const k = last !== null ? last + 1 : start !== null ? start : 1;
    const now = new Map((rows || []).map(r => [r.playerId, Number(r.total) || 0]));
    TeamLogic.addStep(state, parts, now, before, k, run);
    const members = TeamLogic.membersAt(state, k);
    const played = new Map(ids.map(t => [t, []]));
    (state.players || []).forEach(p => { const t = TeamLogic.sideOf(state, p.id); if(t && played.has(t)) played.get(t).push(p.id); });
    const w = MatchupLogic.on(state) ? MatchupLogic.run(state) : null;
    const keyOf = t => {
      if(!w) return [t.points];
      const r = w.records.get(t.id) || { wins: 0, ties: 0, for: 0 };
      const seed = w.seeds ? w.seeds.indexOf(t.id) + 1 : 0;
      return [w.tiers.get(t.id) || 0, r.wins * 2 + r.ties, r.for, seed ? -seed : 0];
    };
    const list = ids.map((id, i) => ({ id, name: parts.names[i], points: run.get(id) || 0, members: members.get(id) || [], played: played.get(id) || [] }));
    const keys = new Map(list.map(t => [t.id, keyOf(t)]));
    const cmp = (a, b) => PickEmScoringStrategy.compareKeys(keys.get(b.id), keys.get(a.id));
    const sorted = [...list].sort((a, b) => cmp(a, b) || ids.indexOf(a.id) - ids.indexOf(b.id));
    return sorted.map(t => {
      const place = 1 + sorted.filter(x => cmp(x, t) < 0).length;
      const tied = sorted.filter(x => cmp(x, t) === 0).length > 1;
      return { ...t, place, rank: `${tied ? 'T' : ''}${place}` };
    });
  }
  // Each score row's team (`team`: { id, name, points, place, rank, now (on it at the next episode to play) }, or null on none), from the
  // standings; not ranked (head to head ranks them itself).
  static label(state, rows, standings){
    const st = standings || TeamLogic.standings(state, rows);
    if(!st) return rows;
    const byId = new Map(st.map(t => [t.id, t]));
    rows.forEach(r => {
      const t = byId.get(TeamLogic.sideOf(state, r.playerId));
      r.team = t ? { id: t.id, name: t.name, points: t.points, place: t.place, rank: t.rank, now: t.members.includes(r.playerId) } : null;
    });
    return rows;
  }
  // The score rows with their teams, ranked as the game ranks (rankKey: the team's points), then by their own points.
  static apply(state, rows){
    TeamLogic.label(state, rows);
    return rows.sort((a, b) => PickEmScoringStrategy.compareKeys(rankKey(state, b), rankKey(state, a)) || b.total - a.total);
  }
  // What a seat sees of the teams (the Games tab's, game-view.ts), from their own copy: how they're made and scored, whether
  // they're set yet, their own, and every team as it stands (its members now, its points, its place). Null for a game without them.
  // `rows`: the score rows the table ranked (each with its `team`, label's: the standings read from them, not worked out again),
  // or rows of points alone ({ playerId, total }); left out, the scores.
  static view(state, playerId, rows){
    const parts = TeamLogic.parts(state);
    if(!parts) return null;
    const list = rows || ScoringLogic.compute(state);
    const st = (list.some(r => r && 'team' in r) ? TeamLogic.fromRows(state, list) : TeamLogic.standings(state, list)) || [];
    return {
      made: parts.made, score: parts.score, of: parts.of,
      set: TeamLogic.fixed(state),
      yours: playerId ? TeamLogic.sideOf(state, playerId) : null,
      teams: st.map(t => ({ id: t.id, name: t.name, members: t.members.slice(), points: t.points, place: t.place, rank: t.rank })),
    };
  }
  // The teams as labelled rows say them (label's `team` on each, as compute ranked them): each team its points, place and rank,
  // whose team it is and who's on it now; a team nobody plays for, its points 0, after the rest.
  static fromRows(state, rows){
    const parts = TeamLogic.parts(state);
    if(!parts) return null;
    const ids = TeamLogic.ids(state);
    const seen = new Map();
    rows.forEach(r => {
      const t = r && r.team;
      if(!t || !ids.includes(t.id)) return;
      if(!seen.has(t.id)) seen.set(t.id, { id: t.id, name: t.name, points: t.points, place: t.place, rank: t.rank, members: [], played: [] });
      const x = seen.get(t.id);
      x.played.push(r.playerId);
      if(t.now) x.members.push(r.playerId);
    });
    const after = seen.size ? Math.max(...[...seen.values()].map(x => x.place)) + 1 : 1;
    const empty = ids.filter(id => !seen.has(id));
    empty.forEach((id) => seen.set(id, { id, name: parts.names[ids.indexOf(id)], points: 0, place: after, rank: `${empty.length > 1 ? 'T' : ''}${after}`, members: [], played: [] }));
    return [...seen.values()].sort((a, b) => a.place - b.place || ids.indexOf(a.id) - ids.indexOf(b.id));
  }
  // The first episode that hasn't been played or locked: from the latest with results on, past any that has locked (closedForPlay),
  // never before the game's start. Null while it waits for its phase.
  static openEpisode(state, now){
    const start = startEpisode(state);
    if(start === null) return null;
    let n = Math.max(start, SpoilerLogic.latestWithResults(state) + 1);
    for(;;){
      const ep = (state.episodes || []).find(e => e.number === n);
      if(!ep || !(EpisodeLogic.hasResults(ep) || closedForPlay(ep, now))) return n;
      n++;
    }
  }
  // The first episode a move made now counts from: the seat's own start before the game has started, else the first not played or
  // locked (openEpisode), never before the seat's own start.
  static openFor(state, playerId, now){
    const start = startEpisode(state);
    if(start === null) return null;
    const own = GhostLogic.startFor(state, playerId) || start;
    if(!TeamLogic.started(state, now)) return own;
    return Math.max(own, TeamLogic.openEpisode(state, now));
  }
  // Why a seat can't be put on `team` now, or null: by itself (`opts.by` 'self': only in a game whose teams are chosen, before it
  // starts) or by whoever runs the game ('runs': before the start in a chosen game, and from the next episode once it's started).
  static chooseProblem(state, playerId, team, opts){
    const parts = TeamLogic.parts(state);
    if(!parts) return "This game isn't played in teams";
    const p = Core.getPlayer(state, playerId);
    if(!p) return 'No such player';
    if(isGhost(p)) return 'A late joiner playing their own season is on no team';
    if(p.active === false) return "They aren't in the game yet";
    if(p.disabled) return "They've left the game";
    if(!TeamLogic.ids(state).includes(team)) return 'No such team';
    if(startEpisode(state) === null) return "This game hasn't started: it waits for its phase of the season";
    const now = opts && opts.now;
    const started = TeamLogic.started(state, now);
    const self = !opts || opts.by !== 'runs';
    if(self){
      if(parts.made !== 'choose') return "The teams are drawn at the game's start";
      if(started) return 'The teams are set: the game has started';
    } else if(!started && parts.made !== 'choose') return "The teams are drawn at the game's start: move someone once it has";
    if(GhostLogic.isCatchingUp(state, playerId)) return "They're still catching up: they join a team once they have";
    const over = KnockoutLogic.moveProblem(state, playerId, TeamLogic.openFor(state, playerId, now));
    return over;
  }
  // Puts a seat on `team` (chooseProblem's rules): before the start, from its start; after, from the first episode still to play.
  static choose(state, playerId, team, opts){
    if(TeamLogic.chooseProblem(state, playerId, team, opts)) return false;
    const from = TeamLogic.openFor(state, playerId, opts && opts.now);
    const kept = { ...(TeamLogic.kept(state) || {}) };
    kept[playerId] = TeamLogic.withSpell(kept[playerId], team, from);
    state.teamSeats = kept;
    return true;
  }
  // A seat's spells with `team` from `from` on: a spell from then or later is replaced, the same team as before changes nothing.
  static withSpell(spells, team, from, extra){
    const list = (Array.isArray(spells) ? spells : []).filter(s => Number.isInteger(s.from) && s.from < from);
    const prev = list.length ? list[list.length - 1] : null;
    if(prev && prev.team === team && !extra) return list;
    return [...list, { team, from, ...(extra || {}) }];
  }
  // On every write (db.ts withLeagueLock): a seed for the draw; once the game has started, the teams kept (the draw as it stood, or
  // the choices, everyone unplaced placed by the spec's fallback), a seat new to the game (a late joiner caught up, one brought in)
  // placed from the first episode still to play, a disabled seat off its team from then and back on reclaimed, a seat whose team the
  // spec no longer has placed again. Everything goes when the game isn't played in teams. True when anything changed.
  static settle(state, now){
    const parts = TeamLogic.parts(state);
    if(!parts){
      const had = state.teamSeats !== undefined || state.teamDraw !== undefined;
      delete state.teamSeats;
      delete state.teamDraw;
      return had;
    }
    let changed = TeamLogic.seed(state);
    const start = startEpisode(state);
    if(start === null || !TeamLogic.started(state, now)) return changed;
    const ids = TeamLogic.ids(state);
    const first = !TeamLogic.fixed(state);
    const draw = first && parts.made === 'draw' ? TeamLogic.drawn(state) : null;
    const kept = { ...(TeamLogic.kept(state) || {}) };
    const open = TeamLogic.openEpisode(state, now);
    // Who's on each team at `open`, as the spells stand so far: the smallest is counted on them.
    const size = () => {
      const n = new Map(ids.map(t => [t, 0]));
      TeamLogic.seats(state).forEach(p => {
        const spells = kept[p.id];
        let t = null;
        if(Array.isArray(spells)) for(const s of spells) if(s.from <= open) t = s.team;
        if(n.has(t)) n.set(t, n.get(t) + 1);
      });
      return n;
    };
    const place = () => {
      if(parts.unplaced === 'none') return null;
      const n = size();
      return ids.reduce((best, t) => (best === null || n.get(t) < n.get(best) ? t : best), null);
    };
    // Those with a team already (kept, or the draw's) first, so whoever's placed is counted against them.
    const all = TeamLogic.seats(state, true);
    const has = p => (Array.isArray(kept[p.id]) && kept[p.id].length > 0) || (!!draw && draw.has(p.id));
    [...all.filter(has), ...all.filter(p => !has(p))].forEach(p => {
      if(GhostLogic.isCatchingUp(state, p.id)) return;
      const own = GhostLogic.startFor(state, p.id) || start;
      const from = first ? own : Math.max(own, open);
      const spells = Array.isArray(kept[p.id]) ? kept[p.id] : [];
      const last = spells.length ? spells[spells.length - 1] : null;
      let want;
      if(p.disabled){
        // Off their team from the first episode still to play (their points before stay with it).
        if(!last || last.team === null) return;
        kept[p.id] = TeamLogic.withSpell(spells, null, from, { left: last.team });
        changed = true;
        return;
      }
      if(last && last.team === null && last.left){
        // Reclaimed: back to the team they left (or placed, if the spec no longer has it).
        want = ids.includes(last.left) ? last.left : place();
      } else if(last && (last.team === null || ids.includes(last.team))){
        return;
      } else if(!last && draw && draw.has(p.id)){
        want = draw.get(p.id);
      } else {
        want = place();
      }
      const next = TeamLogic.withSpell(spells, want, from);
      if(JSON.stringify(next) !== JSON.stringify(spells)){ kept[p.id] = next; changed = true; }
    });
    if(first){ state.teamDraw = { ...state.teamDraw, kept: true }; changed = true; }
    if(changed) state.teamSeats = kept;
    return changed;
  }
}

// ---------- HandicapLogic: a handicap (docs/PLAN-start-a-game-gpt.md step A11 part 5b) ----------
// The spec's rank.handicap: `points` each episode the game plays, from a seat's own start, added to what it scores, for whoever it
// names: newcomers, by the couch's history. Who's new is data the server works out (src/lib/server/handicaps.ts stampSeatHistory:
// for each seat, how many games its accounts have had on this couch, and of this show on it, on a season that premiered before this
// game's), stamped into the state on writes (state.seatHistory: { playerId: { couch, show } }), never a person's word; and kept once
// the game has started (state.handicapSeats: { newTo, seats: { playerId: true | false }, from: { playerId: episode } }), so the
// history changing mid-season (a game deleted, a membership moved, an account added to a seat) changes nothing that counts. The
// points are worked out from the data on every read, as the teams' are, so a corrected result works them out again and a viewer's
// copy counts only what they've seen.
//   - A seat is new when the history has it with no game before for any account on it (a team two people share is new only if
//     both are: the server stamps the most of its accounts'). A seat the history doesn't have is not new: an empty seat, or a
//     history the server couldn't read (the stamp absent: it fails closed, no points from data nobody read). A computer player is
//     never new and never kept, so a person who takes its seat over is read as they take it.
//   - Kept for each seat the history has, once the game has started (TeamLogic.started: its first episode locked or with results);
//     before then it's the history as it stands. A seat kept later (a late joiner, one brought in, a computer player's taken over, a
//     history read late) is kept at the first write that reads it, counting from its own start for a late joiner (their season),
//     else from the first episode still to play then (`from`: the episodes before it were someone else's, or nobody's). The spec
//     changing what newcomers are new to keeps them all again from the history then (their `from` kept).
//   - Its points: `points` for each episode with results in the game's span from the seat's start (GhostLogic.startFor, or its
//     `from`; nothing for one still choosing where to start, or not yet brought in), up to where the game ends (spanView: a race
//     won, one left, a span's end; the season's finale, whatever comes after it); a seat that left keeps earning it, as its team
//     plays on. Someone knocked out keeps what they had
//     at their last episode in (KnockoutLogic.apply, the walk's `out`). On each row as `handicap`, and in `total`.
//   - A draft's: on its rows (ScoringLogic.compute: apply) and its series (KnockoutLogic.series, which head to head and teams of
//     players read); a game of questions': on its walk's series and totals (AnswerLogic.walk), so the table, the hub and the couch's
//     numbers read it as they read the points.
class HandicapLogic {
  static parts(state){ return Spec.handicapParts(gameOf(state)); }
  static on(state){ return !!HandicapLogic.parts(state); }
  // The server's stamp (playerId -> { couch, show }: games before this one), or null when it's absent (not read, or no handicap).
  static history(state){ const h = state && state.seatHistory; return h && typeof h === 'object' && !Array.isArray(h) ? h : null; }
  // What's kept ({ newTo, seats: { playerId: true | false }, from? }), or null before the game starts.
  static kept(state){
    const k = state && state.handicapSeats;
    return k && typeof k === 'object' && k.seats && typeof k.seats === 'object' && !Array.isArray(k.seats) ? k : null;
  }
  // Whether the history makes a seat new (no game before, to the couch or to the show as the spec says), or null where the history
  // doesn't have it.
  static fromHistory(state, playerId, parts){
    const h = HandicapLogic.history(state);
    const row = h && Object.prototype.hasOwnProperty.call(h, playerId) ? h[playerId] : null;
    if(!row || typeof row !== 'object') return null;
    const n = parts.newTo === 'show' ? row.show : row.couch;
    return Number.isInteger(n) && n >= 0 ? n === 0 : null;
  }
  // Whether a seat is one the handicap names: as kept once the game has started, else as the history has it now.
  static isNew(state, playerId, parts = HandicapLogic.parts(state)){
    if(!parts) return false;
    const k = HandicapLogic.kept(state);
    if(k && k.newTo === parts.newTo && typeof k.seats[playerId] === 'boolean') return k.seats[playerId];
    const p = Core.getPlayer(state, playerId);
    if(!p || p.automated) return false;
    return HandicapLogic.fromHistory(state, playerId, parts) === true;
  }
  // The seats the handicap pays, each with the episode it counts from: new, playing their season (not still choosing where to start,
  // nor not yet brought in), from their own start or the episode they were kept from, whichever is later.
  static named(state, parts = HandicapLogic.parts(state)){
    if(!parts) return [];
    const k = HandicapLogic.kept(state);
    const from = k && k.from && typeof k.from === 'object' ? k.from : {};
    return (state.players || [])
      .filter(p => p.active !== false && !GhostLogic.needsStart(state, p.id) && HandicapLogic.isNew(state, p.id, parts))
      .map(p => {
        const own = GhostLogic.startFor(state, p.id);
        return { id: p.id, from: own === null ? null : Number.isInteger(from[p.id]) ? Math.max(own, from[p.id]) : own };
      })
      .filter(x => x.from !== null);
  }
  // The game's episodes with results, in order (its span's: what a handicap counts on).
  static played(state){
    const from = startEpisode(state);
    if(from === null) return [];
    const to = endEpisode(state);
    return (state.episodes || []).filter(e => e.number >= from && (to === null || e.number <= to) && EpisodeLogic.hasResults(e)).map(e => e.number).sort((a,b) => a - b);
  }
  // Each newcomer's handicap through each of `numbers` (the game's episodes walked): (k) => Map playerId -> points through episode
  // k (Infinity: all of them); null when nobody gets one. Nothing after the season's finale (a reunion with results of its own, as
  // The Challenge's schedule counts): the game is over there.
  static tally(state, numbers){
    const parts = HandicapLogic.parts(state);
    const seats = HandicapLogic.named(state, parts);
    if(!seats.length) return null;
    const finale = finaleEpisodeOf(state);
    const list = numbers.filter(e => !finale || e <= finale.number).sort((a,b) => a - b);
    return k => {
      const out = new Map();
      seats.forEach(x => {
        const n = list.filter(e => e >= x.from && e <= k).length;
        if(n) out.set(x.id, roundPoints(n * parts.points));
      });
      return out;
    };
  }
  // A draft's score rows with each one's handicap on them (`handicap`, in `total`), ranked by their points again; any other game's
  // as they are (a game of questions' handicap is on its walk).
  static apply(state, rows){
    if(!HandicapLogic.on(state) || gameOf(state).get.by !== 'draft') return rows;
    const tally = HandicapLogic.tally(state, HandicapLogic.played(state));
    const all = tally ? tally(Infinity) : new Map();
    rows.forEach(r => {
      const n = all.get(r.playerId) || 0;
      r.handicap = n;
      r.total = roundPoints(r.total + n);
    });
    return rows.sort((a,b) => b.total - a.total);
  }
  // What a game's handicap is, for its screens (U1's to show): its points an episode, what newcomers are new to, the seats it pays
  // (as the copy has them: `named`), whether `playerId` is one, and whether who's new is kept yet (once the game has started); null
  // without one.
  static view(state, playerId){
    const parts = HandicapLogic.parts(state);
    if(!parts) return null;
    const k = HandicapLogic.kept(state);
    const newcomers = HandicapLogic.named(state, parts).map(x => x.id);
    return { points: parts.points, newTo: parts.newTo, newcomers, yours: !!playerId && newcomers.includes(playerId), kept: !!k && k.newTo === parts.newTo };
  }
  // Whether a write still needs the couch's history (the server reads it only then: handicaps.ts): a game with a handicap before it
  // starts (who's new is the history as it stands), or after it with a seat a person holds, still in the game, that isn't kept yet (a
  // seat that left isn't waited for; reclaimed, it is).
  static needsHistory(state, now){
    const parts = HandicapLogic.parts(state);
    if(!parts) return false;
    if(!TeamLogic.started(state, now)) return true;
    const k = HandicapLogic.kept(state);
    if(!k || k.newTo !== parts.newTo) return true;
    return (state.players || []).some(p => !p.automated && !p.disabled && typeof k.seats[p.id] !== 'boolean');
  }
  // On every write (db.ts, after the server's stamp): once the game has started, each seat's status kept as the history has it then;
  // a seat kept after the first keep (not a late joiner, whose season is their own) counts from the first episode still to play
  // (`from`). A computer player is never kept, a seat the history doesn't have yet waits for a write that does. Everything kept goes
  // when the game has no handicap, and again when what newcomers are new to changes. True when anything changed.
  static settle(state, now){
    const parts = HandicapLogic.parts(state);
    if(!parts){
      const had = state.handicapSeats !== undefined;
      delete state.handicapSeats;
      return had;
    }
    if(!TeamLogic.started(state, now)) return false;
    const was = HandicapLogic.kept(state);
    const first = !was || was.newTo !== parts.newTo;
    const seats = first ? {} : { ...was.seats };
    const from = { ...(was && was.from && typeof was.from === 'object' ? was.from : {}) };
    let changed = !!was && was.newTo !== parts.newTo;
    const open = first ? null : TeamLogic.openEpisode(state, now);
    (state.players || []).forEach(p => {
      if(p.automated || typeof seats[p.id] === 'boolean') return;
      const v = HandicapLogic.fromHistory(state, p.id, parts);
      if(v === null) return;
      seats[p.id] = v;
      if(open !== null && !GhostLogic.lateJoinOf(state, p.id) && !Number.isInteger(from[p.id])) from[p.id] = open;
      changed = true;
    });
    if(changed) state.handicapSeats = Object.keys(from).length ? { newTo: parts.newTo, seats, from } : { newTo: parts.newTo, seats };
    return changed;
  }
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
    // A10 part 4: with keepers, a seat takes a turn only in the rounds its keepers leave it (KeeperLogic.turns).
    if(KeeperLogic.anyKept(state)){
      const turns = KeeperLogic.turns(state, order);
      if(state.draftPicksMade >= turns.length) return { isComplete:true };
      const t = turns[state.draftPicksMade];
      return { isComplete:false, playerId: t.playerId, personalPickNumber: t.round + 1, overallPickNumber: state.draftPicksMade + 1 };
    }
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
    return draftTimeCame(state);
  }
  static forceStart(state){ state.draftForceStarted = true; stampDraftTurn(state, true); }
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
  // `opts.by`: the account that made the pick for whoever's on the clock (a commissioner or Game admin helping someone
  // over the phone); `opts.auto`: the pick timer ran out and it came from their queue. Both go in the draft's log.
  static pick(state, castawayId, opts){
    // A10 part 4: keepers lock before the first pick (the server's writes lock them already: KeeperLogic.settle).
    KeeperLogic.settle(state);
    const turn = SnakeDraftStrategy.currentTurn(state);
    const c = Core.getCastaway(state, castawayId);
    if(!turn || turn.isComplete || !c || leagueOwnersOf(state, c).length) return;
    // A10 part 3: a draft spread across the cast's groups takes only a pick that keeps the team spread (pickProblem says why).
    if(SpreadLogic.pickProblem(state, turn.playerId, castawayId)) return;
    // Part 3b: a salary cap takes only a pick that keeps the team within it (pickProblem says why); its price goes in the log.
    const prices = BudgetLogic.cap(state) === null ? null : PriceLogic.prices(state);
    if(prices && BudgetLogic.pickProblem(state, turn.playerId, castawayId, prices)) return;
    const price = prices ? prices.get(castawayId) : null;
    Core.setOwner(state, castawayId, turn.playerId);
    c.acquiredVia = 'draft';
    state.draftPicksMade++;
    const entry = { n: turn.overallPickNumber, playerId: turn.playerId, castawayId, at: new Date().toISOString() };
    if(price != null) entry.price = price;
    if(opts && opts.by) entry.by = opts.by;
    if(opts && opts.auto) entry.auto = true;
    if(!Array.isArray(state.draftLog)) state.draftLog = [];
    state.draftLog.push(entry);
    stampDraftTurn(state);
  }
  static undo(state, castawayId){
    const c = Core.getCastaway(state, castawayId);
    // A10 part 4: a keeper isn't a pick, so it isn't taken back as one.
    if(!c || c.status!=='active' || c.acquiredVia==='keeper') return;
    if(c.acquiredVia==='draft'){
      state.draftPicksMade = Math.max(0, state.draftPicksMade - 1);
      if(Array.isArray(state.draftLog)) state.draftLog = state.draftLog.filter(e => e.castawayId !== castawayId);
      stampDraftTurn(state);
    }
    Core.setOwner(state, castawayId, null);
    c.acquiredVia = null;
  }
}

// A draft's scheduled start (the spec's draft room: extras.draft.at) has come.
function draftTimeCame(state){
  const room = gameOf(state).extras.draft;
  const scheduled = room && room.at;
  return !!(scheduled && Date.now() >= new Date(scheduled).getTime());
}

// The turn-based draft's clock (the new design's draft room): when the turn now on the clock began, which a pick timer
// counts from, stamped by the start, each pick and each take-back; a nudge belongs to one turn, so it goes with it.
// `started` also records when the draft was opened by hand. The log of picks (draftLog) is the draft's own record, in
// order, kept beside ownership: who took whom at which pick, and who made a pick for someone. Drafts from before it have
// none, and their picks show without names.
function stampDraftTurn(state, started){
  const now = new Date().toISOString();
  state.draftTurnAt = now;
  if(started && !state.draftStartedAt) state.draftStartedAt = now;
  delete state.draftNudge;
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
  // A blind draft: a shared draft people pick in private (not A10 part 3's shared draw, which nobody picks in). What every
  // "is this a blind draft" asks, rather than reading the ownership alone.
  static on(state){ const g = gameOf(state).get; return g.by === 'draft' && g.own === 'shared' && g.order === 'blind'; }
  // Who must lock in before the reveal fires. Excludes inactive seats (joined after a draft
  // concluded, not yet activated) and disabled ones (player left or was removed) -- a disabled
  // seat can never lock in, so counting it would deadlock the draft for everyone else forever.
  static eligiblePlayers(state){
    // A10 part 4: a seat its keepers filled has nothing to pick.
    return state.players.filter(p => inLeagueRotation(p) && KeeperLogic.places(state, p.id) > 0);
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
    if(!BlindDraftLogic.on(state)) return 'This league is not running a blind draft';
    if(!DraftLogic.isStarted(state)) return "The draft hasn't started yet";
    if(BlindDraftLogic.isRevealed(state)) return 'The draft has already been revealed';
    const player = Core.getPlayer(state, playerId);
    if(!player) return 'No such player';
    if(player.disabled) return 'That seat has been disabled';
    if(player.active === false) return 'That player is not active in this draft';
    const ids = Array.isArray(castawayIds) ? castawayIds : [];
    // A10 part 4: the places its keepers leave.
    const keep = KeeperLogic.keptIds(state, playerId);
    const teamSize = KeeperLogic.places(state, playerId);
    if(ids.length !== teamSize) return `Pick exactly ${teamSize} castaway${teamSize===1?'':'s'}${keep.length ? ` beside your keeper${keep.length === 1 ? '' : 's'}` : ''}`;
    if(new Set(ids).size !== ids.length) return 'Same castaway picked more than once';
    for(const id of ids){
      const c = Core.getCastaway(state, id);
      if(!c) return 'Unknown castaway in submission';
      if(keep.includes(id)) return `${c.name} is one of your keepers already`;
      // No free-agent check: shared mode never removes anyone from availability, so the whole
      // active cast is offered to every player every time (see RosterLogic.freeAgents' comment).
      if(c.status !== 'active') return `${c.name} is already eliminated`;
    }
    // A10 part 3: spread across the cast's groups, as the data has them now; part 3b: within a salary cap at today's prices.
    return SpreadLogic.teamProblem(state, ids, keep) || BudgetLogic.teamProblem(state, ids, keep);
  }
  // Applies every player's picks at once. `picksByPlayer` is {[playerId]: castawayId[]}, read from
  // blind_draft_picks by the caller inside the same transaction that holds the league row lock.
  // Uses addOwner (not setOwner) because shared mode is the whole point -- several players can and
  // will land on the same castaway.
  static reveal(state, picksByPlayer, revealedAt){
    if(BlindDraftLogic.isRevealed(state)) return false;
    // A10 part 4: keepers lock before the reveal (the server's writes lock them as the draft opens); keepers that filled every
    // team reveal it as they lock.
    KeeperLogic.settle(state);
    if(BlindDraftLogic.isRevealed(state)) return false;
    let assigned = 0;
    // A10 part 3c: under a salary cap, what each team cost at the reveal (a blind draft has no log; a stock market's cash reads it).
    const prices = BudgetLogic.cap(state) === null ? null : PriceLogic.prices(state);
    const paid = {};
    Object.keys(picksByPlayer).forEach(playerId => {
      if(!Core.getPlayer(state, playerId)) return; // seat removed between locking and reveal
      (picksByPlayer[playerId] || []).forEach(castawayId => {
        const c = Core.getCastaway(state, castawayId);
        if(!c) return;
        Core.addOwner(state, castawayId, playerId);
        c.acquiredVia = 'draft';
        assigned++;
        if(prices) paid[playerId] = roundPoints((paid[playerId] || 0) + (prices.get(castawayId) || 0));
      });
    });
    if(!state.blindDraft) state.blindDraft = { lockedPlayerIds: [], revealedAt: null };
    state.blindDraft.revealedAt = revealedAt || new Date().toISOString();
    if(prices) state.blindDraft.paid = paid;
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
    return draftTimeCame(state);
  }
  static forceStart(state){ state.draftForceStarted = true; stampDraftTurn(state, true); }
  static reorder(){ /* no turn order */ }
  static move(){ /* no turn order */ }
  static pick(){ /* submissions go through BlindDraftLogic + the blind-draft routes */ }
  // Deliberately inert: post-reveal a castaway may have several owners, and undo() only receives a
  // castawayId, so there'd be no way to say WHICH owner to strip. The frontend hides Undraft in
  // shared mode for the same reason.
  static undo(){ /* ambiguous with multiple owners -- see comment */ }
}

// ---------- SpreadLogic: a draft spread across the cast's groups (A10 part 3: the spec's get.across) ----------
// "Everyone drafts one castaway from each tribe" (docs/PLAN-start-a-game-gpt.md step A10 part 3). The groups are the league's
// own as the data has them when it drafts: each castaway's group now (castaway.tribeId: the season cast's starting tribes and
// research's moves since, GroupLogic), the ones the draft room shows the cast by. A team of `each` over k groups takes no
// more than ceil(each / k) from one and at least floor(each / k) from each while that group has someone it could take
// (game-spec spreadBounds). Its fallbacks, from the start: a show not divided when it drafts (fewer than two groups among
// those still in) drafts plainly; a group with too few left (taken in an exclusive draft, or small) asks only what it has; and
// the spread never blocks a draft: when nobody left keeps a team spread, anyone can be taken. After the draft a castaway is
// yours wherever they go (then: keep): a swap or the merge changes nobody's team, and a replacement comes from anyone.
class SpreadLogic {
  static config(state){
    const g = gameOf(state).get;
    return g.by === 'draft' && g.across && typeof g.across === 'object' ? g.across : null;
  }
  // The groups now: { of: castawayId -> its group (null: none), for everyone still in; groups: the ids in play; least; most },
  // or null when the draft isn't spread across groups, or the show isn't divided.
  static groupsNow(state){
    const a = SpreadLogic.config(state);
    if(!a || a.of !== 'group') return null;
    const tribes = new Set((state.tribes || []).map(t => t.id));
    const of = new Map();
    (state.castaways || []).forEach(c => { if(c.status === 'active') of.set(c.id, c.tribeId && tribes.has(c.tribeId) ? c.tribeId : null); });
    const groups = [...new Set([...of.values()].filter(Boolean))].sort();
    const each = rosterSize(state);
    const bounds = Spec.spreadBounds(each, groups.length);
    return bounds ? { of, groups, each, least: bounds.least, most: bounds.most } : null;
  }
  // A team with `picked`, and who it could take now (`candidates`): what each group has given it, and has left to give.
  static tally(g, picked, candidates){
    const counts = new Map(g.groups.map(x => [x, 0]));
    const free = new Map(g.groups.map(x => [x, 0]));
    const taken = new Set(picked);
    picked.forEach(p => { const t = g.of.get(p); if(t) counts.set(t, counts.get(t) + 1); });
    candidates.forEach(c => { const t = g.of.get(c); if(t && !taken.has(c)) free.set(t, free.get(t) + 1); });
    return { counts, free, left: g.each - picked.length - 1 };
  }
  // Whether taking `id` (one of the tally's candidates) keeps the team spread: no group past its most, and each group's share
  // still owed, as far as it has people left to give, no more than the picks left after it.
  static keeps(g, tally, id){
    const mine = g.of.get(id);
    if(mine && tally.counts.get(mine) + 1 > g.most) return false;
    let owed = 0;
    g.groups.forEach(x => {
      const has = tally.counts.get(x) + (x === mine ? 1 : 0);
      const free = tally.free.get(x) - (x === mine ? 1 : 0);
      owed += Math.max(0, Math.min(g.least, has + free) - has);
    });
    return owed <= tally.left;
  }
  // `candidates` (castaway ids that could be taken now) that keep a team with `picked` spread, in their order: all of them
  // when nothing is spread, or when none does (the spread never blocks a draft). `g`: groupsNow, when it's read once a pass.
  static allowed(state, picked, candidates, g){
    const now = g === undefined ? SpreadLogic.groupsNow(state) : g;
    if(!now) return candidates.slice();
    const tally = SpreadLogic.tally(now, picked, candidates);
    const ok = candidates.filter(id => SpreadLogic.keeps(now, tally, id));
    return ok.length ? ok : candidates.slice();
  }
  // Who a turn-based draft's player could take next and keep their team spread, of `candidates` (the free agents when left out).
  static allowedFor(state, playerId, candidates){
    return SpreadLogic.allowed(state, Core.ownedCastawayIds(state, playerId), candidates || RosterLogic.freeAgents(state).map(c => c.id));
  }
  static reason(state, g){
    const word = String(formatOf(state).terms.tribe || 'group').toLowerCase();
    return g.least
      ? `Spread your team across the ${word}s: at least ${g.least} from each, and no more than ${g.most} from one`
      : `Spread your team across the ${word}s: no more than ${g.most} from one`;
  }
  // Why a turn-based pick (an exclusive draft's: SnakeDraftStrategy) doesn't keep its team spread, or null: the pick itself
  // tested first, the rest only when it fails (a pick is refused only while someone else would keep the team spread).
  static pickProblem(state, playerId, castawayId){
    const g = SpreadLogic.groupsNow(state);
    if(!g) return null;
    const free = RosterLogic.freeAgents(state).map(c => c.id);
    if(!free.includes(castawayId)) return null;
    const tally = SpreadLogic.tally(g, Core.ownedCastawayIds(state, playerId), free);
    if(SpreadLogic.keeps(g, tally, castawayId) || !free.some(id => SpreadLogic.keeps(g, tally, id))) return null;
    return SpreadLogic.reason(state, g);
  }
  // Why a whole team chosen at once (a blind draft's submission, everyone still in on offer) isn't spread, or null. A team spread
  // as a whole passes in any order.
  // A10 part 4: `keep`, the seat's keepers, already on the team.
  static teamProblem(state, castawayIds, keep){
    const g = SpreadLogic.groupsNow(state);
    if(!g) return null;
    const cast = (state.castaways || []).filter(c => c.status === 'active').map(c => c.id);
    const picked = [...(keep || [])];
    for(const id of castawayIds){
      if(!SpreadLogic.allowed(state, picked, cast.filter(c => !picked.includes(c)), g).includes(id)) return SpreadLogic.reason(state, g);
      picked.push(id);
    }
    return null;
  }
}

// ---------- DrawLogic + DrawDraftStrategy: names out of a hat (A10 part 3: the spec's get.order 'draw') ----------
// Nobody picks: when the draft starts (the Commissioner's Start, or its scheduled time, drawn at the next write or read of the
// league), every seat in the rotation is dealt `each` at random. The draw is seeded and recorded (state.draw: its seed, when,
// the order it dealt in, who it came up short for), and who draws whom is a pure function of the seed and the league as it was
// (outcome), so the same seed deals the same teams, and every read after reads them from ownership. Exclusive: one hat for
// everyone, nobody shares, and a team the hat runs out on is short (the fallback: carry on with what's left; the
// exclusive-or-shared count refuses such a game where it knows the couch); shared: each seat's own hat, the whole cast still
// in. A spread draw (get.across) takes from each hat the first that keeps the team spread, and one with a salary cap (part 3b)
// the first that keeps it within the cap (BudgetLogic: with nobody who does, the next in the hat). Someone who joins after the draw
// joins as after any finished draft (inactive until whoever runs it adds them, or a late joiner).
class DrawLogic {
  static on(state){ const g = gameOf(state).get; return g.by === 'draft' && g.order === 'draw'; }
  static drawn(state){ return !!(state.draw && state.draw.at); }
  // Who draws whom from `seed`, changing nothing: { order: the seats in the order they're dealt to, teams: { playerId:
  // [castawayId] } in the order drawn, short: seats dealt fewer than `each` }.
  static outcome(state, seed, priced){
    const each = rosterSize(state);
    const shared = gameOf(state).get.own === 'shared';
    // A10 part 4: each team starts with its keepers, and nobody else draws someone kept in an exclusive draw.
    const aside = ownersAside(state);
    const kept = new Set((state.castaways || []).filter(c => leagueOwnersOf(state, c, aside).length).map(c => c.id));
    const shuffled = (ids, key) => [...ids].sort((a, b) => hashUnit(`${seed}|${key}|${a}`) - hashUnit(`${seed}|${key}|${b}`) || (a < b ? -1 : a > b ? 1 : 0));
    // The seats in the rotation, in the order the seed deals to (whatever order the league lists them in).
    const order = shuffled((state.players || []).filter(inLeagueRotation).map(p => p.id), 'seat');
    const cast = (state.castaways || []).filter(c => c.status === 'active').map(c => c.id).sort();
    const g = SpreadLogic.groupsNow(state);
    // `priced`: a salary cap's prices when the caller read them already (draw records them in the log).
    const prices = priced !== undefined ? priced : BudgetLogic.cap(state) === null ? null : PriceLogic.prices(state);
    const teams = Object.fromEntries(order.map(id => [id, KeeperLogic.keptIds(state, id)]));
    const dealt = Object.fromEntries(order.map(id => [id, []]));
    const common = shared ? null : shuffled(cast.filter(id => !kept.has(id)), 'hat');
    const hats = shared ? Object.fromEntries(order.map(id => [id, shuffled(cast, id)])) : null;
    for(let round = 0; round < each; round++){
      order.forEach(pid => {
        if(teams[pid].length >= each) return;
        const left = shared ? hats[pid].filter(id => !teams[pid].includes(id)) : common;
        if(!left.length) return;
        const take = draftFits(state, teams[pid], left, g, prices || undefined)[0];
        teams[pid].push(take);
        dealt[pid].push(take);
        if(!shared) common.splice(common.indexOf(take), 1);
      });
    }
    return { order, teams, dealt, short: order.filter(id => teams[id].length < each) };
  }
  // Draws, once: ownership as the outcome deals it, each a line in the draft's log in the order dealt (drawn: true), and the
  // draw's order as the draft's (the waivers' priority reads it). `seed`: the draw's own (a fresh one when left out).
  static draw(state, seed){
    // A10 part 4: keepers lock before the draw deals the rest.
    KeeperLogic.settle(state);
    if(!DrawLogic.ready(state)) return false;
    const s = seed || Core.uid('draw');
    // A10 part 3c: under a salary cap each one's price goes in the log, as a snake pick's does (a stock market's cash reads it).
    const prices = BudgetLogic.cap(state) === null ? null : PriceLogic.prices(state);
    const out = DrawLogic.outcome(state, s, prices);
    const shared = gameOf(state).get.own === 'shared';
    const at = new Date().toISOString();
    if(!Array.isArray(state.draftLog)) state.draftLog = [];
    let n = 0;
    for(let round = 0; round < rosterSize(state); round++){
      out.order.forEach(pid => {
        const cid = out.dealt[pid][round];
        if(!cid) return;
        if(shared) Core.addOwner(state, cid, pid);
        else Core.setOwner(state, cid, pid);
        Core.getCastaway(state, cid).acquiredVia = 'draft';
        state.draftLog.push(prices ? { n: ++n, playerId: pid, castawayId: cid, at, drawn: true, price: prices.get(cid) || 0 } : { n: ++n, playerId: pid, castawayId: cid, at, drawn: true });
      });
    }
    state.draftPicksMade = n;
    state.draftOrder = [...out.order, ...(state.draftOrder || []).filter(id => !out.order.includes(id))];
    state.draw = { seed: s, at, order: out.order, short: out.short };
    stampDraftTurn(state, true);
    return true;
  }
  // A draw that can deal: not drawn, a cast and someone to deal to, and nobody on a team yet (a league whose teams were made
  // another way before it became a draw keeps them: it's never dealt over).
  static ready(state){
    // A12 part 1: never before a draft that opens at its game's start has opened (DraftLogic.waits).
    return DrawLogic.on(state) && !DrawLogic.drawn(state) && !state.draftPicksMade && !DraftLogic.waits(state)
      && (state.castaways || []).some(c => c.status === 'active') && (state.players || []).some(inLeagueRotation)
      && !KeeperLogic.draftedAny(state);
  }
  // A draw that's started, by its scheduled time or the Commissioner's Start (one that couldn't deal then: nobody in the
  // rotation yet), and can deal now.
  static due(state){
    return DrawLogic.ready(state) && (!!state.draftForceStarted || draftTimeCame(state));
  }
  // Every write to a league (withLeagueLock) and every read that finds it due (readyLeague) draws it: nobody has to start it.
  static settle(state){ return DrawLogic.due(state) ? DrawLogic.draw(state) : false; }
  // A11 part 5c: whether a late joiner is dealt their team (GhostLogic.begin): a draw that has dealt (before it, they're in it).
  static dealsLate(state){ return DrawLogic.on(state) && DrawLogic.drawn(state); }
  // A late joiner's team out of a hat (A10 part 3's item 7, as recommended): as many as the draft deals each, from who was still in
  // before their start (GhostLogic.draftPool: owned or not for a late joiner playing their own season; `freeAgents`, nobody's for
  // someone let straight into an exclusive game), shuffled by the draw's own seed and their seat, so the same join deals the same
  // team; a shared draw's own hat, an exclusive one what's left. A spread (get.across) and a salary cap (at the prices as of their
  // start) take the first that keeps the team within them, as the draw did. Short when fewer are left.
  static lateDeal(state, playerId, start, freeAgents){
    const seed = (state.draw && state.draw.seed) || 'draw';
    const pool = GhostLogic.draftPool(state, start, !!freeAgents)
      .sort((a, b) => hashUnit(`${seed}|late|${playerId}|${a}`) - hashUnit(`${seed}|late|${playerId}|${b}`) || (a < b ? -1 : a > b ? 1 : 0));
    const then = SpoilerLogic.viewThrough(state, Math.max(0, start - 1));
    const prices = BudgetLogic.cap(state) === null ? undefined : PriceLogic.prices(then);
    const g = SpreadLogic.groupsNow(then);
    const team = [];
    const each = GhostLogic.teamSize(state);
    while(team.length < each){
      const left = pool.filter(id => !team.includes(id));
      if(!left.length) break;
      team.push(draftFits(then, team, left, g, prices)[0]);
    }
    return team;
  }
}

// The same static shape as the other draft strategies. Nothing to pick or take back: the draw deals the teams.
class DrawDraftStrategy {
  static syncOrder(state){ SnakeDraftStrategy.syncOrder(state); }
  // null until the draw (someone joining then is in it, as before a blind reveal), complete after it.
  static currentTurn(state){ return DrawLogic.drawn(state) ? { isComplete: true } : null; }
  static isStarted(state){ return DrawLogic.drawn(state) || !!state.draftForceStarted || draftTimeCame(state); }
  static forceStart(state){ state.draftForceStarted = true; stampDraftTurn(state, true); DrawLogic.draw(state); }
  static reorder(){ /* the draw decides the order */ }
  static move(){ /* the draw decides the order */ }
  static pick(){ /* nobody picks: the draw deals */ }
  static undo(){ /* a draw isn't taken back pick by pick */ }
}

// ---------- PriceLogic, BudgetLogic, AuctionLogic: a draft's prices (A10 part 3b: the spec's get.budget) ----------
// "Auction draft: everyone gets $100 to bid on castaways", "Salary cap: couples cost more the better they're doing"
// (docs/PLAN-start-a-game-gpt.md step A10 part 3b). What a castaway costs comes from data, never a person's word: in an auction,
// the bids (AuctionLogic: sealed, settled at once, the highest first, ties by a seed); in a salary cap, each castaway's points
// so far by the game's own rules (PriceLogic: where they stand, the best at the highest price and the last at the lowest, and
// before anyone's scored everyone the same), which move with every episode's results. A cap (BudgetLogic) holds a team's prices
// together to the budget when it's drafted and whenever it changes after (waivers, free agency, a replacement filled for them);
// its fallbacks, from the start: the cap never blocks a draft (with nobody left who fits, anyone can be taken), and a team that
// went over as its prices moved keeps its team, though a change can't take it further over.
class PriceLogic {
  static config(state){ return Spec.budgetParts(gameOf(state)); }
  // A salary cap: a budget beside any draft but an auction, its prices from the data.
  static capOn(state){ const b = PriceLogic.config(state); return !!b && !b.auction; }
  // Each castaway's points so far by the game's own rules: the moments recorded for them in every episode with results through
  // `through` (the whole season's, not only the game's span: how they're doing), at the game's points for each.
  static points(state, through){
    const out = new Map((state.castaways || []).map(c => [c.id, 0]));
    (state.episodes || []).forEach(ep => {
      if(ep.resultsHidden || !EpisodeLogic.hasResults(ep) || (through != null && ep.number > through)) return;
      ActiveRosterLogic.episodeEvents(state, ep).forEach(ev => {
        if(out.has(ev.castawayId)) out.set(ev.castawayId, out.get(ev.castawayId) + ActiveRosterLogic.eventPoints(state, ev));
      });
    });
    out.forEach((v, k) => out.set(k, roundPoints(v)));
    return out;
  }
  // The latest episode with results (0: none yet).
  static latest(state){
    return (state.episodes || []).filter(ep => !ep.resultsHidden && EpisodeLogic.hasResults(ep)).reduce((n, ep) => Math.max(n, ep.number), 0);
  }
  // A salary cap's prices as of episode `through` (the latest with results when left out), as { castawayId -> price }: those still
  // in then by their points so far, the best at the highest price and the last at the lowest, evenly between, ties sharing the
  // middle of their places (before anyone's scored everyone costs the middle), whole numbers; someone gone home by then by the
  // cap's gone rule (nothing, or what they cost going into the episode they went home in). Empty without a cap.
  static prices(state, through){
    const b = PriceLogic.config(state);
    // A10 part 3c: an auction that trades (a stock market) prices from the data after its bids, as a cap does.
    if(!b || (b.auction && !b.trade)) return new Map();
    const at = through == null ? PriceLogic.latest(state) : through;
    const number = new Map((state.episodes || []).map(e => [e.id, e.number]));
    const exitOf = c => (c.status === 'eliminated' ? number.get(c.exitEpisodeId) || 0 : null);
    const standings = new Map();
    const standing = (n) => {
      if(standings.has(n)) return standings.get(n);
      const pts = PriceLogic.points(state, n);
      const inThen = (state.castaways || []).filter(c => { const e = exitOf(c); return e === null || e > n; });
      const sorted = [...inThen].sort((x, y) => pts.get(y.id) - pts.get(x.id) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
      const k = sorted.length;
      const out = new Map();
      for(let i = 0; i < k;){
        let j = i;
        while(j + 1 < k && pts.get(sorted[j + 1].id) === pts.get(sorted[i].id)) j++;
        const place = (i + j) / 2;
        const price = k <= 1 ? b.ceiling : Math.round(b.floor + (b.ceiling - b.floor) * (k - 1 - place) / (k - 1));
        for(let x = i; x <= j; x++) out.set(sorted[x].id, price);
        i = j + 1;
      }
      standings.set(n, out);
      return out;
    };
    const now = new Map(standing(at));
    (state.castaways || []).forEach(c => {
      if(now.has(c.id)) return;
      const e = exitOf(c) || 0;
      now.set(c.id, b.gone === 'last' && e > 0 ? (standing(e - 1).get(c.id) ?? b.floor) : 0);
    });
    return now;
  }
}

class BudgetLogic {
  // A salary cap's budget, or null (no cap: an auction's budget is spent in the auction). A stock market drafted under a cap (A10
  // part 3c) has one at its draft too: a team costs no more than the budget it starts with.
  static cap(state){ return PriceLogic.capOn(state) ? PriceLogic.config(state).total : null; }
  // Whether a change to a team is checked against prices: a salary cap's, or a stock market's cash (part 3c).
  static priced(state){ return BudgetLogic.cap(state) !== null || MarketLogic.on(state); }
  static cost(ids, prices){ return roundPoints(ids.reduce((n, id) => n + (prices.get(id) || 0), 0)); }
  // `candidates` (castaway ids that could be taken now) that keep a team with `picked` within the cap, with room left to fill its
  // other places at the cheapest of the rest, in their order: all of them without a cap, or when none does (the cap never blocks
  // a draft: the team goes over, and its changes after can't take it further over).
  // `pool`: everyone who could fill the team's other places (`candidates` when left out; the spread can narrow the next pick's
  // candidates, not who fills the places after it).
  static allowed(state, picked, candidates, prices, pool){
    const cap = BudgetLogic.cap(state);
    if(cap === null) return candidates.slice();
    const p = prices || PriceLogic.prices(state);
    const ok = candidates.filter(id => BudgetLogic.least(state, picked, id, pool || candidates, p) <= cap);
    return ok.length ? ok : candidates.slice();
  }
  // The least a team with `picked` costs once it takes `id`: its prices, and the cheapest of the rest of `pool` for each place
  // still to fill.
  static least(state, picked, id, pool, prices){
    const left = rosterSize(state) - picked.length - 1;
    const rest = pool.filter(c => c !== id && !picked.includes(c)).map(c => prices.get(c) || 0).sort((a, b) => a - b).slice(0, Math.max(0, left));
    return roundPoints(BudgetLogic.cost(picked, prices) + (prices.get(id) || 0) + rest.reduce((n, v) => n + v, 0));
  }
  static reason(state, cost, more){
    return `Your team would cost ${more ? 'at least ' : ''}${cost}${more ? `, with ${more} more to pick at the cheapest` : ''}: the cap is ${BudgetLogic.cap(state)}`;
  }
  // Why a turn-based pick takes a team past the cap, or null: refused only while someone else who keeps the team spread (the
  // spread's own check comes first) would keep it within, with room for the rest of the team at the cheapest.
  static pickProblem(state, playerId, castawayId, p){
    if(BudgetLogic.cap(state) === null) return null;
    const free = RosterLogic.freeAgents(state).map(c => c.id);
    if(!free.includes(castawayId)) return null;
    const mine = Core.ownedCastawayIds(state, playerId);
    const prices = p || PriceLogic.prices(state);
    const spread = SpreadLogic.allowed(state, mine, free);
    if(!spread.includes(castawayId) || BudgetLogic.allowed(state, mine, spread, prices, free).includes(castawayId)) return null;
    return BudgetLogic.reason(state, BudgetLogic.least(state, mine, castawayId, free, prices), Math.max(0, rosterSize(state) - mine.length - 1));
  }
  // Why a whole team chosen at once (a blind draft's) costs more than the cap, or null; never when even the cheapest team (kept
  // spread) would (the cap never blocks a draft).
  // A10 part 4: `keep`, the seat's keepers, already on the team (and counted against the cap). A11 part 5c: `pool`, who the team could
  // be made of (a late joiner's: GhostLogic.draftPool), the cheapest team counted from them (every castaway still in when left out).
  static teamProblem(state, castawayIds, keep, pool){
    const cap = BudgetLogic.cap(state);
    if(cap === null) return null;
    const prices = PriceLogic.prices(state);
    const mine = keep || [];
    const cost = BudgetLogic.cost([...mine, ...castawayIds], prices);
    if(cost <= cap) return null;
    const g = SpreadLogic.groupsNow(state);
    const from = Array.isArray(pool) ? new Set(pool) : null;
    const cheap = (state.castaways || []).filter(c => c.status === 'active' && !mine.includes(c.id) && (!from || from.has(c.id))).map(c => c.id).sort((x, y) => (prices.get(x) || 0) - (prices.get(y) || 0));
    const team = [...mine];
    while(team.length < rosterSize(state)){
      const next = SpreadLogic.allowed(state, team, cheap.filter(id => !team.includes(id)), g)[0];
      if(!next) break;
      team.push(next);
    }
    return BudgetLogic.cost(team, prices) > cap ? null : BudgetLogic.reason(state, cost);
  }
  // Why a change to a team after the draft (a waiver claim's pair, free agency, a replacement filled for them: drop `dropId`, add
  // `addId`) takes it past the cap at today's prices, or null: within the cap, or no further over than it is (a team that went
  // over as its prices moved keeps its team; a change can't take it further over).
  static moveProblem(state, playerId, dropId, addId, prices){
    // A10 part 3c: a stock market's moves are bought with cash, not held to a cap.
    if(MarketLogic.on(state)) return MarketLogic.moveProblem(state, playerId, dropId, addId, prices);
    const cap = BudgetLogic.cap(state);
    if(cap === null) return null;
    const p = prices || PriceLogic.prices(state);
    const team = Core.ownedCastawayIds(state, playerId);
    const before = BudgetLogic.cost(team, p);
    const after = roundPoints(before - (dropId && team.includes(dropId) ? (p.get(dropId) || 0) : 0) + (p.get(addId) || 0));
    if(after <= cap || after <= before) return null;
    // A replacement for someone gone home is never refused when nobody they could take is cheaper: the cap never leaves a place
    // empty (the same one autoPick would fill it with).
    const drop = dropId ? Core.getCastaway(state, dropId) : null;
    if(!drop || drop.status !== 'active'){
      const cheapest = Math.min(...MidSeasonLogic.availableFor(state, playerId).map(c => p.get(c.id) || 0));
      if((p.get(addId) || 0) <= cheapest) return null;
    }
    const c = Core.getCastaway(state, addId);
    return `${c ? c.name : 'They'} cost${c ? 's' : ''} ${p.get(addId) || 0}: your team would cost ${after}, and the cap is ${cap}`;
  }
}

// ---------- MarketLogic: buying and selling each week (A10 part 3c: the spec's get.budget.trade, a stock market) ----------
// "Stock market: buy and sell castaways each week" (docs/PLAN-start-a-game-gpt.md step A10 part 3c), on part 3b's prices: each
// castaway's price is where they stand on points so far by the game's own rules (PriceLogic), moving with every episode's results.
// Everyone starts with the budget and buys a team at the draft (a salary cap's draft, within the budget, or an auction's bids);
// after it they trade in the waiver weeks (open after an episode's results until the next airs, closed while one is on): a
// trade is one of the waivers' moves (a swap sells someone still in, a replacement someone gone home), selling at today's price
// and buying at theirs, each paying the trade's fee; how often trading opens and how many trades a week are the waiver windows'.
// Cash is never stored: it's a ledger worked out from the logs, the budget (or nothing, when what the draft left is lost) less
// what the draft's log recorded each castaway at, plus what each move's log entry recorded it sold for, less what it paid and its
// fee. So Undo last waiver run and the spoiler views take it back with the move. Its fallbacks, from the start: nobody spends
// more than they have (a move that would take cash below nothing, or lower when it's already below, is refused, and a
// replacement nobody can afford isn't filled: they hold who they have); someone who doesn't trade keeps what they have; someone
// gone home sells for nothing or their last price (the budget's gone); whether two can hold the same castaway is the draft's
// ownership. Worth (rank 'worth') is cash plus the team at today's prices.
class MarketLogic {
  static config(state){ const b = PriceLogic.config(state); return b && b.trade ? b : null; }
  static on(state){ return Spec.marketOf(gameOf(state)); }
  // What a player paid at the draft: the prices its log recorded (a snake's picks and a draw's under a cap, an auction's bids),
  // and a blind draft's, recorded at its reveal (it has no log).
  static draftPaid(state, playerId){
    // A10 part 4: and what its keepers cost, where they cost their price. A11 part 5c: and what a late joiner's team cost them, or
    // castaways given to a seat after the draft (player.joinPaid: GhostLogic.begin, RosterLogic.activatePlayer).
    const pl = Core.getPlayer(state, playerId);
    let n = KeeperLogic.paid(state, playerId) + (pl && typeof pl.joinPaid === 'number' ? pl.joinPaid : 0);
    (state.draftLog || []).forEach(e => { if(e.playerId === playerId && typeof e.price === 'number') n += e.price; });
    const paid = state.blindDraft && state.blindDraft.paid;
    if(paid && typeof paid[playerId] === 'number') n += paid[playerId];
    return roundPoints(n);
  }
  // A player's cash: the budget less what the draft cost (nothing, when the draft's money left over is lost), and every move's
  // sale less what it bought and its fee. Null without a market.
  static cash(state, playerId){
    const all = MarketLogic.cashAll(state, [playerId]);
    return all ? all.get(playerId) : null;
  }
  // Everyone's cash (`playerIds`, every seat when left out) in one pass over the logs, as { playerId -> cash }, or null.
  static cashAll(state, playerIds){
    const b = MarketLogic.config(state);
    if(!b) return null;
    const kept = b.left !== 'lost';
    const out = new Map((playerIds || (state.players || []).map(p => p.id)).map(id => [id, kept ? b.total : 0]));
    // What the draft cost each (draftPaid: its log, a blind draft's, keepers and, A11 part 5c, a team given after it).
    if(kept) out.forEach((n, id) => out.set(id, n - MarketLogic.draftPaid(state, id)));
    ((state.midSeason && state.midSeason.log) || []).forEach(tx => {
      if(out.has(tx.playerId)) out.set(tx.playerId, out.get(tx.playerId) + (tx.sold || 0) - (tx.paid || 0) - (tx.fee || 0));
    });
    out.forEach((n, id) => out.set(id, roundPoints(n)));
    return out;
  }
  // What a move sells and buys at, at today's prices (`prices`: read once a pass), and its fee: what its log entry records.
  static terms(state, dropId, addId, prices){
    const b = MarketLogic.config(state);
    const p = prices || PriceLogic.prices(state);
    const out = { sold: dropId ? (p.get(dropId) || 0) : 0, paid: p.get(addId) || 0 };
    if(b && b.trade.fee) out.fee = b.trade.fee;
    return out;
  }
  // Why a player can't make a move (sell `dropId`, buy `addId`), or null: what they'd have after it is nothing or more, or no
  // less than they have now (cash below nothing, only ever from a draft that went over or a result corrected after a move, can't
  // go lower).
  static moveProblem(state, playerId, dropId, addId, prices){
    const drop = dropId ? Core.getCastaway(state, dropId) : null;
    const t = MarketLogic.terms(state, drop && ownerListOf(drop).includes(playerId) ? dropId : null, addId, prices);
    const before = MarketLogic.cash(state, playerId);
    const after = roundPoints(before + t.sold - t.paid - (t.fee || 0));
    if(after >= 0 || after >= before) return null;
    const c = Core.getCastaway(state, addId);
    return `${c ? c.name : 'They'} cost${c ? 's' : ''} ${t.paid}${t.fee ? `, and a trade ${t.fee}` : ''}: you'd have ${roundPoints(before + t.sold)} to spend`;
  }
  // Cash plus the team at today's prices (someone gone home by the budget's gone rule). `prices` and `cash`, when read once a pass.
  static worth(state, playerId, prices, cash){
    const p = prices || PriceLogic.prices(state);
    return roundPoints((cash == null ? MarketLogic.cash(state, playerId) : cash) + BudgetLogic.cost(Core.ownedCastawayIds(state, playerId), p));
  }
  // The market as it stands, for the screens and the checks: { prices: { castawayId: price }, cash and worth: { playerId: n } },
  // or null without one. On a viewer's copy (GhostLogic.viewFor) it's as of their mark.
  static view(state){
    if(!MarketLogic.on(state)) return null;
    const prices = PriceLogic.prices(state);
    const ids = (state.players || []).filter(p => !isGhost(p)).map(p => p.id);
    const cash = MarketLogic.cashAll(state, ids);
    return {
      prices: Object.fromEntries(prices),
      cash: Object.fromEntries(cash),
      worth: Object.fromEntries(ids.map(id => [id, MarketLogic.worth(state, id, prices, cash.get(id))])),
    };
  }
}

// ---------- KeeperLogic: keepers across seasons (A10 part 4: the spec's get.keep) ----------
// "Dynasty: keep 2 of your players when they come back next season" (docs/PLAN-start-a-game-gpt.md step A10 part 4). A game that
// continues last season's (get.keep.from: the couch's game on an earlier season of the show): before the draft, each seat names
// up to `each` of its team there who are on this season's cast. Who can be kept is never a name a person types: the server works
// each seat's options out from the two leagues (src/lib/server/keepers.ts: the same account's seat last season, its team as it
// stands there, matched to this league's cast by name as each season's cast records it (nameKey), best first by last season's
// points: optionsFrom) and writes them in (setOptions) until the keepers lock. They lock when the draft starts (its scheduled
// time, the Commissioner's Start, the first pick: settle, on every write and on the read that finds it due), before anything is
// drafted: each seat's keepers become its own (acquiredVia 'keeper'), recorded with what they cost under a budget that charges
// one, and the draft fills the rest of each team, whatever its kind (a snake passes over a full team, or sits a seat out of its
// first rounds: turns; a blind sheet, a draw, an auction and a salary cap each fill only the places left: places). Its fallbacks,
// from the start: someone not back can't be kept, and their place goes to the draft (an option that leaves the cast before the
// lock is dropped); someone who names nobody keeps their best who are back, or nobody (the spec's fallback); in an exclusive game
// nobody keeps someone another seat named first; a seat with no options (new to the couch, a computer player, last season's game
// not found) keeps nobody and drafts a whole team; a game whose teams were made before its keepers locked keeps its teams.
//   state.keepers  { options: { playerId: [castawayId] } best first, chosen: { playerId: { ids, at, by } } (by: the account that
//                  named them), kept: { playerId: [{ castawayId, price? }] }, at: when they locked }
class KeeperLogic {
  static config(state){ return Spec.keepParts(gameOf(state)); }
  static locked(state){ return !!(state.keepers && state.keepers.at); }
  static options(state, playerId){ return ((state.keepers && state.keepers.options) || {})[playerId] || []; }
  // The keepers a seat named (null: none named yet, so the fallback decides at the lock; [] is keeping nobody).
  static chosen(state, playerId){ const c = state.keepers && state.keepers.chosen && state.keepers.chosen[playerId]; return c && Array.isArray(c.ids) ? c.ids : null; }
  // A seat's keepers once they're locked ([] before): [{ castawayId, price? }].
  static kept(state, playerId){ return (KeeperLogic.locked(state) && state.keepers.kept && state.keepers.kept[playerId]) || []; }
  static keptIds(state, playerId){ return KeeperLogic.kept(state, playerId).map(k => k.castawayId); }
  static anyKept(state){ return KeeperLogic.locked(state) && Object.values(state.keepers.kept || {}).some(list => Array.isArray(list) && list.length); }
  // The places a seat's draft fills: the team's size less its keepers.
  static places(state, playerId){ return Math.max(0, rosterSize(state) - KeeperLogic.kept(state, playerId).length); }
  // What a seat's keepers cost from its budget (a price each, where the game charges one), for an auction's bids and a market's cash.
  static paid(state, playerId){ return roundPoints(KeeperLogic.kept(state, playerId).reduce((n, k) => n + (typeof k.price === 'number' ? k.price : 0), 0)); }
  // Whether anyone holds a castaway other than as a keeper: a draft has made teams (a draw and an auction never deal over them).
  static draftedAny(state){
    const keep = new Set();
    if(KeeperLogic.locked(state)) Object.entries(state.keepers.kept || {}).forEach(([pid, list]) => (list || []).forEach(k => keep.add(`${pid}|${k.castawayId}`)));
    const aside = ownersAside(state);
    return (state.castaways || []).some(c => leagueOwnersOf(state, c, aside).some(pid => !keep.has(`${pid}|${c.id}`)));
  }
  // Each seat's options (the server's: keepers.ts), `{ playerId: [castawayId] }` best first, written while the keepers are open:
  // only castaways on this league's cast and still in. What a seat named stays as it named it (one bad read of last season's game
  // never erases it): the lock keeps only those still among its options (someone who left the cast frees the place). Whether
  // anything changed.
  static setOptions(state, options){
    if(!KeeperLogic.config(state) || KeeperLogic.locked(state)) return false;
    const was = JSON.stringify(state.keepers || null);
    const rec = state.keepers || (state.keepers = { options: {}, chosen: {} });
    const inCast = id => { const c = Core.getCastaway(state, id); return !!c && c.status === 'active'; };
    rec.options = {};
    Object.entries(options || {}).forEach(([pid, ids]) => {
      if(!Core.getPlayer(state, pid) || !Array.isArray(ids)) return;
      const list = [...new Set(ids.filter(inCast))];
      if(list.length) rec.options[pid] = list;
    });
    rec.chosen = rec.chosen || {};
    return JSON.stringify(state.keepers) !== was;
  }
  // What a seat named that it can still keep (its named keepers among its options now), or null when it named none.
  static named(state, playerId){
    const ids = KeeperLogic.chosen(state, playerId);
    if(ids === null) return null;
    const opts = KeeperLogic.options(state, playerId);
    return ids.filter(id => opts.includes(id));
  }
  // Why a seat can't name these keepers, or null (and they're named, `by` the account that named them): before the draft, up to
  // `each` of its options (none is keeping nobody), and in an exclusive game nobody another seat named first.
  static choose(state, playerId, castawayIds, by){
    const k = KeeperLogic.config(state);
    if(!k) return "This game doesn't keep anyone from last season";
    if(KeeperLogic.locked(state)) return 'The keepers are locked: the draft has started';
    const p = Core.getPlayer(state, playerId);
    if(!p || p.disabled) return 'No such player';
    const ids = Array.isArray(castawayIds) ? castawayIds : null;
    if(!ids) return 'Keepers are a list of castaways';
    const most = Math.min(k.each, rosterSize(state));
    if(ids.length > most) return `Keep up to ${most}`;
    if(new Set(ids).size !== ids.length) return 'The same one is in your keepers twice';
    const opts = KeeperLogic.options(state, playerId);
    for(const id of ids){
      const c = Core.getCastaway(state, id);
      if(!opts.includes(id)) return `${c ? c.name : 'They'} ${c ? "isn't" : "aren't"} one of yours from last season who's back`;
    }
    if(gameOf(state).get.own !== 'shared'){
      const chosen = (state.keepers && state.keepers.chosen) || {};
      for(const id of ids){
        const other = Object.keys(chosen).find(pid => pid !== playerId && (KeeperLogic.named(state, pid) || []).includes(id));
        if(other){ const c = Core.getCastaway(state, id); const o = Core.getPlayer(state, other); return `${c.name} is kept by ${o ? o.name : 'someone else'} already`; }
      }
    }
    const rec = state.keepers || (state.keepers = { options: {}, chosen: {} });
    rec.chosen = rec.chosen || {};
    rec.chosen[playerId] = { ids: [...ids], at: new Date().toISOString(), ...(by ? { by } : {}) };
    return null;
  }
  // Keepers that should lock now: the draft has started.
  static due(state){ return !!KeeperLogic.config(state) && !KeeperLogic.locked(state) && DraftLogic.isStarted(state); }
  // Locks them, once: seats that named theirs first (in the order they named them), then the fallback's (in the draft's order),
  // each keeping up to `each` of its options still in, in an exclusive game none another seat has. Their price under a budget that
  // charges one is today's. Nobody keeps anyone in a game whose teams were made before.
  static lock(state){
    const k = KeeperLogic.config(state);
    if(!k || KeeperLogic.locked(state)) return false;
    const rec = state.keepers || (state.keepers = { options: {}, chosen: {} });
    const drafted = state.draftPicksMade || KeeperLogic.draftedAny(state);
    rec.kept = {};
    rec.at = new Date().toISOString();
    if(drafted) return true;
    const shared = gameOf(state).get.own === 'shared';
    const prices = k.cost === 'price' ? PriceLogic.prices(state) : null;
    const most = Math.min(k.each, rosterSize(state));
    const taken = new Set();
    const order = [...(state.draftOrder || []), ...(state.players || []).map(p => p.id).filter(id => !(state.draftOrder || []).includes(id))]
      .filter(id => inLeagueRotation(Core.getPlayer(state, id)));
    const named = order.filter(id => KeeperLogic.chosen(state, id) !== null)
      .sort((a, b) => String(rec.chosen[a].at || '').localeCompare(String(rec.chosen[b].at || '')));
    const rest = order.filter(id => KeeperLogic.chosen(state, id) === null);
    [...named, ...rest].forEach(pid => {
      const opts = KeeperLogic.options(state, pid).filter(id => { const c = Core.getCastaway(state, id); return !!c && c.status === 'active'; });
      const want = KeeperLogic.chosen(state, pid) !== null ? KeeperLogic.named(state, pid).filter(id => opts.includes(id)) : k.fallback === 'best' ? opts : [];
      const list = [];
      for(const id of want){
        if(list.length >= most) break;
        if(!shared && taken.has(id)) continue;
        taken.add(id);
        if(shared) Core.addOwner(state, id, pid);
        else Core.setOwner(state, id, pid);
        Core.getCastaway(state, id).acquiredVia = 'keeper';
        list.push(prices ? { castawayId: id, price: prices.get(id) || 0 } : { castawayId: id });
      }
      if(list.length) rec.kept[pid] = list;
    });
    // A blind draft or an auction whose every seat its keepers filled has nobody to wait for: done at once (a snake's turns and a
    // draw's deal come out empty by themselves).
    if(!(state.players || []).some(p => inLeagueRotation(p) && KeeperLogic.places(state, p.id) > 0)){
      if(BlindDraftLogic.on(state)) BlindDraftLogic.reveal(state, {});
      else if(AuctionLogic.on(state)) AuctionLogic.settle(state, {});
    }
    return true;
  }
  static settle(state){ return KeeperLogic.due(state) ? KeeperLogic.lock(state) : false; }
  // A snake's turns with keepers: round by round in the snake's order, a seat taking a turn in a round its keepers leave it one
  // (cost 'round': it sits out its first rounds, one a keeper; else it's passed over once its team is full, its last rounds).
  static turns(state, order){
    const each = rosterSize(state);
    // A game whose keepers came out of its spec after they locked: their places stay taken, its last rounds.
    const k = KeeperLogic.config(state);
    const byRound = !!k && k.cost === 'round';
    const kept = new Map(order.map(pid => [pid, KeeperLogic.kept(state, pid).length]));
    const out = [];
    for(let r = 0; r < each; r++){
      (r % 2 === 0 ? order : [...order].reverse()).forEach(pid => {
        const k = kept.get(pid);
        if(byRound ? r >= k : r < each - k) out.push({ playerId: pid, round: r });
      });
    }
    return out;
  }
  // A name as each season's cast records it, made comparable across seasons: accents, case, punctuation, a nickname in double
  // quotes and a Jr. or Sr. left out ('Johnny "Bananas" Devenanzio' and "Johnny Devenanzio" are one person). Nothing looser: two
  // names match only when these are the same, so a near miss is someone not back (the fallback), never somebody else.
  static nameKey(name){
    return normalizeName(String(name || '').replace(/["“”„][^"“”„]*["“”„]/g, ' ')).replace(/ (jr|sr|ii|iii|iv)$/, '');
  }
  // Last season's castaways, best first: a game scored by place by how long they lasted, then their points by its rules; any other
  // by their points, then how long they lasted; ties by name.
  static rankFrom(old){
    const pts = PriceLogic.points(old);
    const number = new Map((old.episodes || []).map(e => [e.id, e.number]));
    const lasted = c => (c.status === 'active' ? Infinity : number.get(c.exitEpisodeId) || 0);
    const byPlace = gameOf(old).score.by === 'place';
    return [...(old.castaways || [])].sort((a, b) => {
      const p = (pts.get(b.id) || 0) - (pts.get(a.id) || 0);
      const l = lasted(b) - lasted(a);
      return (byPlace ? (l || p) : (p || l)) || String(a.name).localeCompare(String(b.name));
    }).map(c => c.id);
  }
  // A seat's options from last season's game: the team its seats there (`oldPlayerIds`: the same account's) hold as it stands,
  // best first, each matched by nameKey to someone on this league's cast still in. Pure: the server reads the two leagues.
  static optionsFrom(old, oldPlayerIds, state){
    const seats = new Set(oldPlayerIds || []);
    const mine = new Set((old.castaways || []).filter(c => ownerListOf(c).some(id => seats.has(id))).map(c => c.id));
    const here = new Map();
    (state.castaways || []).forEach(c => { if(c.status === 'active'){ const key = KeeperLogic.nameKey(c.name); if(key && !here.has(key)) here.set(key, c.id); } });
    const out = [];
    KeeperLogic.rankFrom(old).forEach(id => {
      if(!mine.has(id)) return;
      const match = here.get(KeeperLogic.nameKey(Core.getCastaway(old, id).name));
      if(match && !out.includes(match)) out.push(match);
    });
    return out;
  }
}

// What a team with `picked` could take next of `candidates`, kept spread across the cast's groups (SpreadLogic) and within a
// salary cap (BudgetLogic), in their order: every candidate when neither applies, and never none while there's someone to take
// (each one's fallback). `g` and `prices`, when they're read once a pass.
function draftFits(state, picked, candidates, g, prices){
  return BudgetLogic.allowed(state, picked, SpreadLogic.allowed(state, picked, candidates, g), prices, candidates);
}
// Who a turn-based draft's player could take next, of `candidates` (the free agents when left out).
function draftFitsFor(state, playerId, candidates){
  return draftFits(state, Core.ownedCastawayIds(state, playerId), candidates || RosterLogic.freeAgents(state).map(c => c.id));
}

// An auction (the spec's get.order 'auction', exclusive): once the bidding opens (the draft's start: its scheduled time or the
// Commissioner's Start), everyone bids in private on whom they want, as many as three for each place on their team, each bid a
// whole number from the lowest price up to what's left after the lowest price for every other place. The bids live outside the
// state (blind_draft_picks, as a blind draft's picks do: src/lib/server/auction.ts); the state holds who has locked in. It
// settles at once, the moment everyone has locked in, or when the game's first episode starts with bids still out (the
// fallback: nobody waits for someone; whoever runs the game can also lock in an empty sheet for them): every bid from the
// highest down, each won at what was bid (ties: a seeded order, recorded, so the same bids settle the same way), and a team its
// bids didn't fill is filled from what's left at the lowest price, or left short (the spec's fallback). Someone who joins after
// it joins as after any finished draft.
class AuctionLogic {
  static on(state){ const g = gameOf(state).get; return g.by === 'draft' && g.order === 'auction'; }
  static settled(state){ return !!(state.auction && state.auction.at); }
  static lockedPlayerIds(state){ return (state.auction && state.auction.lockedPlayerIds) || []; }
  static hasLocked(state, playerId){ return AuctionLogic.lockedPlayerIds(state).includes(playerId); }
  static setLockedPlayerIds(state, playerIds){
    if(!state.auction) state.auction = { lockedPlayerIds: [] };
    state.auction.lockedPlayerIds = [...playerIds];
  }
  // A10 part 4: a seat its keepers filled has nothing to bid on.
  static eligiblePlayers(state){ return (state.players || []).filter(p => inLeagueRotation(p) && KeeperLogic.places(state, p.id) > 0); }
  static waitingOn(state){
    const locked = AuctionLogic.lockedPlayerIds(state);
    return AuctionLogic.eligiblePlayers(state).filter(p => !locked.includes(p.id));
  }
  static allLockedIn(state, lockedPlayerIds){
    const eligible = AuctionLogic.eligiblePlayers(state);
    return eligible.length > 0 && eligible.every(p => lockedPlayerIds.includes(p.id));
  }
  // The most one bid can be: the budget, less the lowest price for every other place on the team.
  // A10 part 4: for a seat with keepers (`playerId`), the places they leave and what they cost.
  static maxBid(state, playerId){
    const b = PriceLogic.config(state);
    if(playerId === undefined) return b.total - b.floor * Math.max(0, rosterSize(state) - 1);
    return b.total - KeeperLogic.paid(state, playerId) - b.floor * Math.max(0, KeeperLogic.places(state, playerId) - 1);
  }
  // How many bids a sheet holds: three for each place on the team (backups), up to the spec's most.
  static maxBids(state){ return Math.min(Spec.MAX_BIDS, Math.max(1, rosterSize(state) * 3)); }
  // Why one player's sealed bids can't be locked in, or null: [{ castawayId, bid }], none (fill me) up to maxBids, each on someone
  // still in and on nobody's team, once, a whole number from the lowest price to maxBid.
  static validateBids(state, playerId, bids){
    if(!AuctionLogic.on(state)) return 'This game is not an auction';
    if(!DraftLogic.isStarted(state)) return "The bidding hasn't opened yet";
    if(AuctionLogic.settled(state)) return 'The auction is over';
    if(!AuctionLogic.ready(state)) return 'The teams are made already';
    const player = Core.getPlayer(state, playerId);
    if(!player) return 'No such player';
    if(player.disabled) return 'That seat has been disabled';
    if(!inLeagueRotation(player)) return 'That player is not in this auction';
    if(!Array.isArray(bids)) return 'Bids are a list of { castawayId, bid }';
    const b = PriceLogic.config(state);
    const most = AuctionLogic.maxBids(state);
    if(bids.length > most) return `Bid on up to ${most}`;
    const max = AuctionLogic.maxBid(state, playerId);
    const seen = new Set();
    for(const x of bids){
      const c = x && typeof x === 'object' ? Core.getCastaway(state, x.castawayId) : null;
      if(!c) return 'Unknown castaway in your bids';
      if(seen.has(c.id)) return `${c.name} is in your bids twice`;
      seen.add(c.id);
      if(c.status !== 'active') return `${c.name} is already out`;
      if(leagueOwnersOf(state, c).length) return `${c.name} is on a team already`;
      if(!Number.isInteger(x.bid) || x.bid < b.floor || x.bid > max) return `A bid is a whole number from ${b.floor} to ${max} (you need ${b.floor} for each other place on your team)`;
    }
    return null;
  }
  // A sheet from an order of castaways (best first): the budget spread over the first team's worth by rank (the first the most),
  // the rest of the order (up to maxBids) as backups at the lowest price, every bid within maxBid. How computer players bid
  // (bot-logic.js auctionBids) and the replays' seats (playtest.js), each by its own order.
  // A10 part 4: `playerId`, a seat's sheet for the places its keepers leave, from what they leave of the budget.
  static sheetFor(state, order, playerId){
    const b = PriceLogic.config(state);
    const size = playerId === undefined ? rosterSize(state) : KeeperLogic.places(state, playerId);
    const max = AuctionLogic.maxBid(state, playerId);
    const list = order.slice(0, AuctionLogic.maxBids(state));
    const weights = list.slice(0, size).map((_, i) => size - i);
    const sum = weights.reduce((n, w) => n + w, 0) || 1;
    const spare = b.total - (playerId === undefined ? 0 : KeeperLogic.paid(state, playerId)) - b.floor * size;
    return list.map((id, i) => ({ castawayId: id, bid: i < size ? Math.min(max, b.floor + Math.floor((spare * weights[i]) / sum)) : b.floor }));
  }
  // Who wins whom from everyone's sealed bids ({ playerId: [{ castawayId, bid }] }), changing nothing: { order (the seats in the
  // seed's order, the order a fill goes round in), won: [{ playerId, castawayId, price, filled? }] in the order settled, spent:
  // { playerId: n }, short: the seats with fewer than a team }. Every bid from the highest down, ties in the seed's order; each
  // won at what was bid while its castaway is still free, the bidder's team has a place, they can still pay the lowest price
  // for every place after it, and it keeps a spread team spread. Then, with the fallback 'fill', every team still short takes,
  // a round at a time, the first in a seeded hat of what's left that keeps it spread, at the lowest price.
  static outcome(state, bidsByPlayer, seed){
    const b = PriceLogic.config(state);
    const each = rosterSize(state);
    const rank = key => hashUnit(`${seed}|${key}`);
    const byRank = prefix => (x, y) => rank(`${prefix}|${x}`) - rank(`${prefix}|${y}`) || (x < y ? -1 : x > y ? 1 : 0);
    const order = AuctionLogic.eligiblePlayers(state).map(p => p.id).sort(byRank('seat'));
    const aside = ownersAside(state);
    const free = new Set((state.castaways || []).filter(c => c.status === 'active' && !leagueOwnersOf(state, c, aside).length).map(c => c.id));
    const g = SpreadLogic.groupsNow(state);
    // A10 part 4: each team starts with its keepers, and what they cost.
    const teams = Object.fromEntries(order.map(id => [id, KeeperLogic.keptIds(state, id)]));
    const spent = Object.fromEntries(order.map(id => [id, KeeperLogic.paid(state, id)]));
    const won = [];
    const canPay = (pid, price) => price <= b.total - spent[pid] - b.floor * (each - teams[pid].length - 1);
    const take = (pid, cid, price, filled) => {
      teams[pid].push(cid);
      spent[pid] += price;
      free.delete(cid);
      won.push(filled ? { playerId: pid, castawayId: cid, price, filled: true } : { playerId: pid, castawayId: cid, price });
    };
    const bids = [];
    order.forEach(pid => ((bidsByPlayer && bidsByPlayer[pid]) || []).forEach(x => {
      if(x && free.has(x.castawayId) && Number.isInteger(x.bid) && x.bid >= b.floor) bids.push({ pid, cid: x.castawayId, bid: x.bid });
    }));
    bids.sort((x, y) => y.bid - x.bid || rank(`bid|${x.cid}|${x.pid}`) - rank(`bid|${y.cid}|${y.pid}`));
    bids.forEach(x => {
      if(!free.has(x.cid) || teams[x.pid].length >= each || !canPay(x.pid, x.bid)) return;
      if(!SpreadLogic.allowed(state, teams[x.pid], [...free], g).includes(x.cid)) return;
      take(x.pid, x.cid, x.bid, false);
    });
    if(b.fallback === 'fill'){
      const hat = [...free].sort(byRank('hat'));
      for(let round = 0; round < each; round++){
        order.forEach(pid => {
          if(teams[pid].length >= each || !canPay(pid, b.floor)) return;
          const left = hat.filter(id => free.has(id));
          if(left.length) take(pid, SpreadLogic.allowed(state, teams[pid], left, g)[0], b.floor, true);
        });
      }
    }
    return { order, won, spent, short: order.filter(id => teams[id].length < each) };
  }
  // Settles it, once: ownership as the outcome says, each a line in the draft's log in the order settled (its price, and filled:
  // true for one the bids didn't win), the seed's seat order as the draft's (the waivers' priority reads it), and state.auction's
  // record (when, the seed, the order, what each spent, who's short). `seed`: its own (a fresh one when left out).
  // An auction that can settle: open, someone to sell to, and nobody on a team yet (a league whose teams were made another way
  // before it became an auction keeps them: it's never settled over, as a draw is never dealt over).
  static ready(state){
    return AuctionLogic.on(state) && !AuctionLogic.settled(state) && !state.draftPicksMade && (state.players || []).some(inLeagueRotation)
      && !KeeperLogic.draftedAny(state);
  }
  static settle(state, bidsByPlayer, seed){
    // A10 part 4: keepers lock before the bids are settled.
    KeeperLogic.settle(state);
    if(!AuctionLogic.ready(state)) return false;
    const s = seed || Core.uid('auction');
    const out = AuctionLogic.outcome(state, bidsByPlayer || {}, s);
    const at = new Date().toISOString();
    if(!Array.isArray(state.draftLog)) state.draftLog = [];
    out.won.forEach((x, i) => {
      Core.setOwner(state, x.castawayId, x.playerId);
      Core.getCastaway(state, x.castawayId).acquiredVia = 'draft';
      state.draftLog.push({ n: i + 1, playerId: x.playerId, castawayId: x.castawayId, at, price: x.price, ...(x.filled ? { filled: true } : {}) });
    });
    state.draftPicksMade = out.won.length;
    state.draftOrder = [...out.order, ...(state.draftOrder || []).filter(id => !out.order.includes(id))];
    state.auction = { lockedPlayerIds: [], at, seed: s, order: out.order, spent: out.spent, short: out.short };
    stampDraftTurn(state, true);
    return true;
  }
  // The bidding's close with bids still out: once the game's first episode has started (its lock), an auction still open
  // settles with the bids it has (the server reads them: auction.ts), so no game waits for someone.
  static due(state, now){
    if(!AuctionLogic.ready(state) || !DraftLogic.isStarted(state) || !(state.castaways || []).some(c => c.status === 'active')) return false;
    const first = startEpisode(state);
    const ep = first === null ? null : (state.episodes || []).find(e => e.number === first);
    return !!ep && closedForPlay(ep, now);
  }
}

// The same static shape as the other draft strategies. Nothing to pick, order or take back: the bids settle the teams.
class AuctionDraftStrategy {
  static syncOrder(state){ SnakeDraftStrategy.syncOrder(state); }
  // null while the bidding's open (someone joining then bids too, as before a blind reveal), complete once it's settled.
  static currentTurn(state){ return AuctionLogic.settled(state) ? { isComplete: true } : null; }
  static isStarted(state){ return AuctionLogic.settled(state) || !!state.draftForceStarted || draftTimeCame(state); }
  static forceStart(state){ state.draftForceStarted = true; stampDraftTurn(state, true); }
  static reorder(){ /* the bids decide */ }
  static move(){ /* the bids decide */ }
  static pick(){ /* bids go through AuctionLogic and the auction's routes */ }
  static undo(){ /* an auction isn't taken back pick by pick */ }
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
// A draft's ownership (the spec's get.own); a game with no draft has nobody's castaways, so exclusive's defaults.
function ownershipModeOf(state){
  const get = gameOf(state).get;
  return get.by === 'draft' && get.own === 'shared' ? 'shared' : 'exclusive';
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
  // Points for one event type: the league's own value if set (the spec's points: settings.eventPoints, in a game that
  // scores by moments), else the catalog default. A type
  // explicitly set to 0 stays 0 (that's how a commissioner switches a category off), which is why
  // this tests for a number rather than using `||`. A game that doesn't score by moments (a Survival Pool that survives
  // by scoring asks whether a pick scored) has no points of its own: the catalog's.
  //
  // A league playing by a rulebook (settings.rulebook) scores nothing for a moment its rules don't have, whatever
  // its points say: a couch's own copy that stopped counting a moment (docs/PLAN-new-design.md step 6b part 3)
  // keeps the results it recorded, so counting it again is only switching it back on. Leagues on a show's format
  // or a ruleset copy are as they always were.
  static pointsFor(state, type){
    if(state.settings && state.settings.rulebook && !formatOf(state).events.some(e => e.id === type)) return 0;
    const score = gameOf(state).score;
    const configured = score.by === 'moments' && score.points ? score.points[type] : undefined;
    if(typeof configured === 'number' && Number.isFinite(configured)) return configured;
    const def = formatOf(state).events.find(e => e.id === type);
    return defaultPointsFor(def, ownershipModeOf(state));
  }
  // Points for one recorded or implied event: its type's points, times its units when it counts more
  // than one (a `per` rule's count, formats/rules.js: 3 home runs, 6.67 innings). One unit is the type's
  // points exactly.
  static eventPoints(state, ev){
    // One of a couch's own moments (Make it ours) counts only while the league's rules have it: following the
    // season's rulebook again leaves the couch's answers in place, scoring nothing, so Undo can count them again.
    if(ev && ev.couch && !formatOf(state).events.some(e => e.id === ev.type)) return 0;
    const units = ev && Number.isFinite(ev.units) && ev.units > 0 ? ev.units : 1;
    const points = ActiveRosterLogic.pointsFor(state, ev.type);
    return units === 1 ? points : points * units;
  }
  // A lineup's starters (the spec's count.start) and its bench (the rest of the team); none outside a Weekly Lineup.
  static activeSlots(state){
    const g = gameOf(state);
    return g.get.by === 'draft' && g.count && g.count.start ? g.count.start : 0;
  }
  static benchSlots(state){
    const g = gameOf(state);
    return g.get.by === 'draft' && g.count && g.count.start ? Math.max(0, (g.get.each || 0) - g.count.start) : 0;
  }

  // ---- scoring that combines, per lineup (docs/PLAN-start-a-game-gpt.md step A9 part 2) ----
  // Best ball's n (the spec's count.best: your best n each episode, no lineups), else 0.
  static bestOf(state){
    const g = gameOf(state);
    return g.get.by === 'draft' && g.count && g.count.best ? g.count.best : 0;
  }
  // A lineup's captain (the spec's score.captain): what their points multiply by, else 0 (no captain in this game).
  static captainTimes(state){
    const g = gameOf(state);
    return g.score.by === 'moments' && g.count && g.count.start && g.score.captain ? g.score.captain.times : 0;
  }
  // Whether the game's lineups score any way but plainly (a captain, best ball, points that multiply by when, group slots: A10
  // part 1): compute's own path. A plain lineup keeps the arithmetic it always had.
  static combines(state){
    const g = gameOf(state);
    return g.score.by === 'moments' && (!!ActiveRosterLogic.bestOf(state) || !!ActiveRosterLogic.captainTimes(state) || Array.isArray(g.score.times) || !!GroupSlotLogic.config(state));
  }
  // What an episode's points multiply by (the spec's score.times): each window it's in, together -- an episode, a run of them,
  // a phase of the season, the finale -- else 1. A phase counts from where data says it starts (state.phaseStarts, the desk's:
  // RosterLogic.settlePhases) to where the next one known does, once this copy is up to the episode before its start (as a
  // phase window shows: nobody behind learns a phase began); the finale is the episode that ended the season (finaleEpisodeOf),
  // known once its results are. Scoring only reads episodes with results, so the guard never changes a score.
  static timesFor(state, number){
    const list = gameOf(state).score.times;
    if(!Array.isArray(list) || gameOf(state).score.by !== 'moments') return 1;
    const seen = SpoilerLogic.latestWithResults(state);
    const starts = Object.values(state.phaseStarts || {}).filter(n => Number.isInteger(n) && n <= seen + 1);
    const inPhase = id => {
      const from = state.phaseStarts && state.phaseStarts[id];
      if(!Number.isInteger(from) || from > seen + 1 || number < from) return false;
      const next = starts.filter(n => n > from);
      return !next.length || number < Math.min(...next);
    };
    let finale;
    const finaleNumber = () => {
      if(finale === undefined){ const f = finaleEpisodeOf(state); finale = f ? f.number : null; }
      return finale;
    };
    let x = 1;
    list.forEach(t => {
      const hit = Number.isInteger(t.episode) ? number === t.episode
        : Number.isInteger(t.from) ? number >= t.from && (t.to === undefined || t.to === null || number <= t.to)
        : typeof t.phase === 'string' ? inPhase(t.phase)
        : t.finale === true ? number === finaleNumber()
        : false;
      if(hit) x *= t.times;
    });
    return x;
  }
  // The team a player held for an episode (best ball, which has no lineups to store it): who they hold now, with every move
  // from that episode on taken back, newest first (the mid-season log: a move made after episode k counts from k + 1, as the
  // spoiler view and the waiver weeks have it), less anyone out before it. In the cast's order.
  static teamFor(state, ep, playerId){
    const team = new Set(Core.ownedCastawayIds(state, playerId));
    const log = (state.midSeason && state.midSeason.log) || [];
    for(let i = log.length - 1; i >= 0; i--){
      const tx = log[i];
      if(tx.playerId !== playerId || !Number.isInteger(tx.episode) || tx.episode < ep.number) continue;
      if(tx.addedCastawayId) team.delete(tx.addedCastawayId);
      if(tx.droppedCastawayId) team.add(tx.droppedCastawayId);
    }
    return state.castaways.filter(c => {
      if(!team.has(c.id)) return false;
      if(c.status !== 'eliminated') return true;
      const exit = state.episodes.find(e => e.id === c.exitEpisodeId);
      return !!exit && exit.number >= ep.number;
    }).map(c => c.id);
  }
  // One player's points for one episode, as the game counts them: { total, lines: [{ castawayId, points, counted, captain }],
  // captain, times, slots }. A lineup's starters, a captain's points times its multiplier; best ball's whole team, its best n
  // counted; a game's group slots (A10 part 1: GroupSlotLogic.episodeLines, each slot's group's points); and the episode's own
  // multiplier (timesFor) on all of it. `pre`: the episode's events and multiplier, when the caller has them already (compute,
  // every player).
  static episodeScore(state, ep, playerId, pre){
    const best = ActiveRosterLogic.bestOf(state);
    const ids = best ? ActiveRosterLogic.teamFor(state, ep, playerId) : ActiveRosterLogic.lineupFor(state, ep.id, playerId);
    const captain = best ? null : ActiveRosterLogic.captainFor(state, ep.id, playerId);
    const times = pre && pre.times !== undefined ? pre.times : ActiveRosterLogic.timesFor(state, ep.number);
    const raw = new Map(ids.map(id => [id, 0]));
    ((pre && pre.events) || ActiveRosterLogic.episodeEvents(state, ep)).forEach(ev => {
      if(raw.has(ev.castawayId)) raw.set(ev.castawayId, roundPoints(raw.get(ev.castawayId) + ActiveRosterLogic.eventPoints(state, ev)));
    });
    const cap = captain ? ActiveRosterLogic.captainTimes(state) : 1;
    const lines = ids.map(id => ({ castawayId: id, points: roundPoints(raw.get(id) * (id === captain ? cap : 1) * times), counted: !best, captain: id === captain }));
    // Best ball: the n highest count (a tie can't change the total; the cast's order breaks it).
    if(best) [...lines].sort((a,b) => b.points - a.points).slice(0, best).forEach(l => { l.counted = true; });
    const slots = GroupSlotLogic.episodeLines(state, ep, playerId, (pre && pre.events) || undefined, times, pre && pre.slots);
    const total = roundPoints(lines.reduce((t, l) => t + (l.counted ? l.points : 0), 0) + slots.reduce((t, l) => t + l.points, 0));
    return { total, lines, captain, times, slots };
  }

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
    return !!ep && (closedForPlay(ep) || EpisodeLogic.hasResults(ep));
  }
  // Returns null if the lineup is acceptable, else a human-readable reason. Like blind draft (and
  // unlike most of this file) this reports WHY rather than silently no-opping -- a rejected lineup is
  // something the player needs to understand and fix.
  static validateLineup(state, epId, playerId, castawayIds){
    if(!piecesOf(state).hasActiveRoster) return 'This league type has no active roster';
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return 'No such episode';
    if(ActiveRosterLogic.isLineupLocked(state, epId)) return 'This episode has started -- lineups are locked';
    if(!inPlay(state, ep.number)){
      const start = startEpisode(state);
      if(start === null) return "This game hasn't started: it waits for its phase of the season";
      return ep.number < start ? 'This league starts at episode ' + start : 'This game ended with episode ' + endEpisode(state);
    }
    if(!Core.getPlayer(state, playerId)) return 'No such player';
    const over = KnockoutLogic.moveProblem(state, playerId, ep.number);
    if(over) return over;
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
    // A captain named for this episode is one of its starters: benching them takes the armband off.
    if(ep.captains && ep.captains[playerId] && !castawayIds.includes(ep.captains[playerId])) ep.captains[playerId] = null;
    return true;
  }

  // ---- a lineup's captain (A9 part 2: the spec's score.captain) ----
  // Stored per episode like the lineup it's one of (`episode.captains[playerId] = castawayId`, null for none), and locked with
  // it. Nobody named for an episode: the last one they named before it carries, as a lineup does (the Fan Who Forgets), and either
  // way only while they're in that episode's lineup (a captain benched or gone counts as none).
  static captainFor(state, epId, playerId){
    if(!ActiveRosterLogic.captainTimes(state)) return null;
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return null;
    const named = e => !!e.captains && Object.prototype.hasOwnProperty.call(e.captains, playerId);
    const from = named(ep) ? ep : state.episodes.filter(e => e.number < ep.number && named(e)).sort((a,b) => b.number - a.number)[0];
    const id = from ? from.captains[playerId] : null;
    return id && ActiveRosterLogic.lineupFor(state, epId, playerId).includes(id) ? id : null;
  }
  // Null when naming `castawayId` captain for the episode is fine (null: no captain), else why not -- as validateLineup says
  // it (the episode, its lock, the game's span, the player), against `lineup` (the one being set with it) or the one they have.
  static validateCaptain(state, epId, playerId, castawayId, lineup){
    if(!ActiveRosterLogic.captainTimes(state)) return 'This game has no captain';
    const ids = Array.isArray(lineup) ? lineup : ActiveRosterLogic.lineupFor(state, epId, playerId);
    const problem = ActiveRosterLogic.validateLineup(state, epId, playerId, ids);
    if(problem) return problem;
    if(castawayId === null || castawayId === undefined) return null;
    if(!ids.includes(castawayId)) return 'Your captain is one of your starters';
    return null;
  }
  static setCaptain(state, epId, playerId, castawayId){
    if(ActiveRosterLogic.validateCaptain(state, epId, playerId, castawayId)) return false;
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep.captains) ep.captains = {};
    ep.captains[playerId] = castawayId || null;
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
  // `units`: how many it counts for, when more than one (a count research reported, eventPoints).
  static addEvent(state, epId, type, castawayId, units){
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
    if(Number.isFinite(units) && units > 0 && units !== 1) ev.units = units;
    ep.scoringEvents.push(ev);
    return ev;
  }
  // A recorded event's count, corrected (a re-research found 3 home runs, not 2). 1 or nothing clears it.
  static setEventUnits(state, epId, eventId, units){
    const ep = state.episodes.find(e => e.id === epId);
    const ev = ep && (ep.scoringEvents || []).find(x => x.id === eventId);
    if(!ev) return false;
    if(Number.isFinite(units) && units > 0 && units !== 1) ev.units = units;
    else delete ev.units;
    return true;
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

// ---------- GroupSlotLogic: group slots (docs/PLAN-start-a-game-gpt.md step A10 part 1, "When a grouping lasts") ----------
// The user's third idea: a solo draft, plus a +1 or +2 slot on each team that holds a pair or a team the show forms. When the
// show announces its groups, the slots open for the next episode; while a group lasts you ride with it (its members' points
// are the slot's); when it ends, its slot drops, and a new pick opens with the next groups. Pairs that last make it a side
// draft, pairs that change every episode a pick each episode: one mechanic, nothing to predict.
//
// The groups are the show's as the season's format state over time has them (formats/format-timeline.js, from each episode's
// research), never the league's own tribes. The season sync writes each episode's into the league (`episode.formatGroups`,
// settle below: only on an episode with results, and wholesale, so a corrected report reaches it at the next sync), and
// everything here reads only those, so it's pure. A group is its exact members (F1's Q1 and Q4, as F3 takes them: a tribe
// losing someone carries on, a pair down to one doesn't, any join or move ends it, the same people again later are a new
// group); a slot opens after the episode that showed its groups and scores from the next, so a group revealed partway can't be
// picked before it; a group shown that changed before it played (F1's Q2) is void for that episode, no points either way, and
// its slot reopens for the next; a change partway through an episode leaves it to the group in force at its start (Q3). When
// the show re-pairs everyone or goes each for themselves, every slot drops at once. Each pick is stored on the episode it's
// for (`episode.groupSlots[playerId][slot]`) and carried, like a lineup, until a later one.
//
// The spec's get.groups says the rest (their defaults are the user's: the plan's Noticed for A10): `slots`, 1 or 2; `own`,
// shared (anyone can hold the same group) or exclusive (one team's at a time, first come, and only while the groups on offer
// cover every team's slots: otherwise that opening is shared and says why, the 9:10 PM decision); `swap`, whether a slot can
// change its group while it lasts; `fallback`, what a slot does in an episode whose groups at the lock or as played aren't
// sure (void: nothing either way; carry-on: it scores anyway, and a group that didn't play as picked is followed by its
// people); `points`, a group's points as its members' mean (a slot scores like one more person) or their sum.
class GroupSlotLogic {
  /** The game's group slots (the spec's get.groups), or null: a draft scored by moments only. */
  static config(state){
    const g = gameOf(state);
    return g.get.by === 'draft' && g.get.groups && typeof g.get.groups === 'object' && g.score.by === 'moments' ? g.get.groups : null;
  }
  /** What every reader below looks up, worked out once a pass (compute passes it for every player and episode): the episodes
   *  by number, and each castaway out by the episode they went home in. */
  static index(state){
    const eps = new Map(state.episodes.map(e => [e.number, e]));
    const at = new Map(state.episodes.map(e => [e.id, e.number]));
    const exits = new Map(state.castaways.filter(c => c.status === 'eliminated' && at.has(c.exitEpisodeId)).map(c => [c.id, at.get(c.exitEpisodeId)]));
    return { eps, exits };
  }
  /** Episode n's groups as the sync wrote them, or null: nothing written (no results yet, or the timeline knows nothing). */
  static record(state, n, ix){
    const ep = ix ? ix.eps.get(n) : state.episodes.find(e => e.number === n);
    return ep && ep.formatGroups && EpisodeLogic.hasResults(ep) ? ep.formatGroups : null;
  }
  /** The group in `groups` a pick is: by its id, else by its members as picked, less anyone out before episode k (a corrected
   *  report can move a group's id: the episode that first showed it). */
  static find(groups, pick, exits, k){
    // exits: each castaway out, by the episode they went home in (index().exits).
    if(!pick || !Array.isArray(groups)) return null;
    const byId = groups.find(g => g.id === pick.id);
    if(byId) return byId;
    const key = ids => [...ids].sort().join('|');
    const want = key(pick.members);
    const left = key(pick.members.filter(m => !(exits.has(m) && exits.get(m) < k)));
    return groups.find(g => g.members.length > 1 && (key(g.members) === want || key(g.members) === left)) || null;
  }
  /**
   * What a slot can pick going into episode n: the groups at episode n - 1's end, while the show is divided into them.
   * { groups, sure, why, shared }: at an unsure lock nothing is offered (void, the default) or the groups as known (carry-on,
   * flagged); `shared`: an exclusive game's opening plays shared, the groups on offer not covering every team's slots. A group
   * none of whose members is on the league's cast can't be picked (nothing of theirs scores here).
   */
  static offered(state, n, ix){
    const cfg = GroupSlotLogic.config(state);
    const none = (why, sure) => ({ groups: [], sure: !!sure, why, shared: false });
    if(!cfg) return none(['This game has no group slots']);
    const prev = GroupSlotLogic.record(state, n - 1, ix);
    if(!prev) return none(['Nothing is known yet about who is with whom going into it']);
    const end = prev.end;
    if(!end.divided) return none(["The show isn't divided into groups going into it"], end.sure);
    if(!end.sure && cfg.fallback !== 'carry-on') return none(end.why.length ? end.why : ["Who is with whom going into it isn't sure"]);
    const groups = end.groups.filter(g => g.members.length);
    // A11 part 1: nobody knocked out of the game counts (they hold no slot any more).
    const outs = KnockoutLogic.outs(state);
    const people = state.players.filter(p => inLeagueRotation(p) && !outs.has(p.id)).length;
    const shared = cfg.own === 'exclusive' && !Spec.covers({ pool: groups.length, people, each: cfg.slots });
    return { groups, sure: end.sure, why: end.sure ? [] : end.why, shared };
  }
  /** The latest pick for a player's slot at or before episode n: { pick (null: emptied), from }, or null for none. */
  static latestPick(state, playerId, slot, n){
    const has = e => !!e.groupSlots && !!e.groupSlots[playerId] && Object.prototype.hasOwnProperty.call(e.groupSlots[playerId], slot);
    const ep = state.episodes.filter(e => e.number <= n && has(e)).sort((a,b) => b.number - a.number)[0];
    return ep ? { pick: ep.groupSlots[playerId][slot] || null, from: ep.number } : null;
  }
  /**
   * What a player's slot holds in episode n, as the records say: { pick, from, status, members, unsure, why }.
   *   held     its group played n as picked (or, following the people, its members did): it scores, `members` its people
   *   void     it doesn't count in n either way: the lock or the episode's play wasn't sure, or the group was shown but changed
   *            before n started (it drops after n)
   *   dropped  its group ended before n (it didn't play an episode since it was picked as picked, or isn't among the groups
   *            going into n): the slot is empty, open for a pick from the groups going into n
   *   waiting  n has no record yet (no results); empty: nothing picked
   */
  static standing(state, playerId, slot, n, ix){
    const cfg = GroupSlotLogic.config(state);
    const latest = cfg ? GroupSlotLogic.latestPick(state, playerId, slot, n) : null;
    const base = { pick: latest ? latest.pick : null, from: latest ? latest.from : null, members: [], size: 0, unsure: false, why: [] };
    if(!latest || !latest.pick) return { ...base, status: 'empty' };
    const pick = latest.pick;
    const at = ix || GroupSlotLogic.index(state);
    const out = at.exits;
    // From the lock it was picked at to n's: it played every episode in between as picked, and was still one of the groups
    // at each one's end (a group can end at an episode's end: a re-pairing).
    for(let k = latest.from - 1; k < n; k++){
      const r = GroupSlotLogic.record(state, k, at);
      if(!r) continue;
      if(k >= latest.from && r.played && (r.played.apart || !GroupSlotLogic.find(r.played.groups, pick, out, k))) return { ...base, status: 'dropped', endedAt: k };
      if(!r.end.divided || !GroupSlotLogic.find(r.end.groups, pick, out, k + 1)){
        // Not among the groups it was picked from, as the records say now (a corrected report): void for the episode it was
        // picked for, and gone after it.
        if(k === latest.from - 1 && n === latest.from) return { ...base, status: 'void', why: ["It isn't one of the groups going into this episode, as research now says"] };
        return { ...base, status: 'dropped', endedAt: k };
      }
    }
    const r = GroupSlotLogic.record(state, n, at);
    if(!r) return { ...base, status: 'waiting' };
    const lock = GroupSlotLogic.record(state, n - 1, at);
    const lockSure = !!lock && lock.end.sure;
    const played = r.played && !r.played.apart ? GroupSlotLogic.find(r.played.groups, pick, out, n) : null;
    const follow = () => pick.members.filter(m => !(out.has(m) && out.get(m) < n));
    if(!played){
      const why = !r.played ? ["How this episode was played isn't known"] : r.played.apart ? ['It was played without groups'] : ["The group didn't play it as it was picked"];
      // Following the people: the pick's as it was offered, its size as it was (anyone not on the league's cast, or gone home
      // since, counting for nothing).
      if(cfg.fallback === 'carry-on') return { ...base, status: 'held', members: follow(), size: pick.size || pick.members.length, unsure: true, why };
      return { ...base, status: 'void', why };
    }
    const sure = lockSure && r.played.sure;
    if(!sure && cfg.fallback !== 'carry-on') return { ...base, status: 'void', why: lockSure ? ["How this episode was played isn't sure"] : ["Who was with whom going into it wasn't sure"] };
    return { ...base, status: 'held', members: played.members.slice(), size: Math.max(played.members.length, played.size || 0), unsure: !sure };
  }
  /**
   * A player's slots in episode n, each with its points: [{ slot, status, pick, from, members, size, unsure, why, points }]. A
   * held slot scores its members' points by the game's rules (the episode's events, `events` when the caller has them), their
   * sum, or their mean over the group as research has it (`size`: someone not on the league's cast scores nothing here, and
   * still counts in the mean), times the episode's multiplier (`times`). `ix`: index(), when the caller has it.
   */
  static episodeLines(state, ep, playerId, events, times, ix){
    const cfg = GroupSlotLogic.config(state);
    if(!cfg) return [];
    const evs = events || ActiveRosterLogic.episodeEvents(state, ep);
    const x = times === undefined ? ActiveRosterLogic.timesFor(state, ep.number) : times;
    const at = ix || GroupSlotLogic.index(state);
    const out = [];
    for(let i = 0; i < cfg.slots; i++){
      const st = GroupSlotLogic.standing(state, playerId, i, ep.number, at);
      let points = 0;
      if(st.status === 'held' && st.members.length){
        const mine = new Set(st.members);
        const sum = evs.filter(ev => mine.has(ev.castawayId)).reduce((t, ev) => t + ActiveRosterLogic.eventPoints(state, ev), 0);
        points = roundPoints((cfg.points === 'sum' ? sum : sum / Math.max(st.size, st.members.length)) * x);
      }
      out.push({ slot: i, ...st, points });
    }
    return out;
  }
  /** Null when a player's slot can take `groupId` for the episode (null: empty it), else why not. */
  static validatePick(state, epId, playerId, slot, groupId){
    const cfg = GroupSlotLogic.config(state);
    if(!cfg) return 'This game has no group slots';
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return 'No such episode';
    // Locked as its lineups are.
    if(ActiveRosterLogic.isLineupLocked(state, epId)) return 'This episode has started: its slots are locked';
    if(!inPlay(state, ep.number)){
      const start = startEpisode(state);
      if(start === null) return "This game hasn't started: it waits for its phase of the season";
      return ep.number < start ? 'This league starts at episode ' + start : 'This game ended with episode ' + endEpisode(state);
    }
    if(!Core.getPlayer(state, playerId)) return 'No such player';
    const over = KnockoutLogic.moveProblem(state, playerId, ep.number);
    if(over) return over;
    if(!(Number.isInteger(slot) && slot >= 0 && slot < cfg.slots)) return `A team has ${cfg.slots} group slot${cfg.slots === 1 ? '' : 's'}`;
    const n = ep.number;
    const ix = GroupSlotLogic.index(state);
    const now = GroupSlotLogic.standing(state, playerId, slot, n, ix);
    // A slot rides with its group while it lasts, unless the game lets it change (a pick made for this episode can, until its
    // lock: it hasn't started).
    const rides = s => !!s.pick && s.from < n && (s.status === 'waiting' || s.status === 'held' || s.status === 'void');
    if(!cfg.swap && rides(now)) return 'Your slot rides with its group while that group lasts';
    if(groupId === null || groupId === undefined) return null;
    const offer = GroupSlotLogic.offered(state, n, ix);
    if(!offer.groups.length) return offer.why[0] || 'No groups to pick from going into this episode';
    const g = offer.groups.find(x => x.id === groupId);
    if(!g) return "That group isn't one going into this episode";
    const holds = (pid, i) => {
      const s = GroupSlotLogic.standing(state, pid, i, n, ix);
      return !!s.pick && s.status !== 'dropped' && s.status !== 'empty' && !!GroupSlotLogic.find([g], s.pick, ix.exits, n);
    };
    for(let i = 0; i < cfg.slots; i++) if(i !== slot && holds(playerId, i)) return 'That group is already in your other slot';
    // Exclusive while the groups cover every team's slots: one team's at a time, first come. The teams that count are the ones
    // in the game's rotation, as offered counts them: a late joiner's picks are private, as their team is.
    if(cfg.own === 'exclusive' && !offer.shared){
      const outs = KnockoutLogic.outs(state);
      const other = state.players.filter(p => p.id !== playerId && inLeagueRotation(p) && !outs.has(p.id)).find(p => Array.from({ length: cfg.slots }, (_, i) => i).some(i => holds(p.id, i)));
      if(other) return `${other.name} has that group`;
    }
    return null;
  }
  static setPick(state, epId, playerId, slot, groupId){
    if(GroupSlotLogic.validatePick(state, epId, playerId, slot, groupId)) return false;
    const ep = state.episodes.find(e => e.id === epId);
    const g = groupId === null || groupId === undefined ? null : GroupSlotLogic.offered(state, ep.number).groups.find(x => x.id === groupId);
    ep.groupSlots = ep.groupSlots || {};
    ep.groupSlots[playerId] = ep.groupSlots[playerId] || {};
    ep.groupSlots[playerId][slot] = g ? { id: g.id, members: g.members.slice(), size: Math.max(g.size || 0, g.members.length) } : null;
    return true;
  }
  /**
   * Writes each episode's groups (`records`: episode number -> { end, played }, the season sync's from the timeline, members as
   * the league's castaway ids) onto the episodes that have results, and takes them off any other (results taken back, or a
   * report gone). Wholesale, so a corrected report reaches every episode after it. A game without group slots keeps none. True
   * when anything changed.
   */
  static settle(state, records){
    const slots = !!GroupSlotLogic.config(state);
    const get = n => (slots && (records instanceof Map ? records.get(n) : records && records[n])) || null;
    let changed = false;
    state.episodes.forEach(ep => {
      const want = EpisodeLogic.hasResults(ep) ? get(ep.number) : null;
      if(JSON.stringify(ep.formatGroups || null) === JSON.stringify(want)) return;
      if(want) ep.formatGroups = JSON.parse(JSON.stringify(want));
      else delete ep.formatGroups;
      changed = true;
    });
    return changed;
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
    // A9 part 2: a captain, best ball or points that multiply by when, each episode as ActiveRosterLogic.episodeScore counts it.
    // A plain lineup scores below, event by event, as it always has.
    if(ActiveRosterLogic.combines(state)){
      // Group slots (A10 part 1): what their readers look up, once for the whole pass.
      const slots = GroupSlotLogic.config(state) ? GroupSlotLogic.index(state) : undefined;
      state.episodes.forEach(ep=>{
        if(!inPlay(state, ep.number)) return;
        const events = ActiveRosterLogic.episodeEvents(state, ep);
        if(!events.length) return;
        const pre = { events, times: ActiveRosterLogic.timesFor(state, ep.number), slots };
        state.players.forEach(p=>{
          results[p.id].locked = roundPoints(results[p.id].locked + ActiveRosterLogic.episodeScore(state, ep, p.id, pre).total);
        });
      });
    } else state.episodes.forEach(ep=>{
      if(!inPlay(state, ep.number)) return; // before this league started (settings.startEpisode)
      ActiveRosterLogic.episodeEvents(state, ep).forEach(ev=>{
        const points = ActiveRosterLogic.eventPoints(state, ev);
        state.players.forEach(p=>{
          const lineup = ActiveRosterLogic.lineupFor(state, ep.id, p.id);
          if(lineup.includes(ev.castawayId)){
            results[p.id].locked = roundPoints(results[p.id].locked + points);
          }
        });
      });
    });
    // The same optional layers classic-draft carries: side bets and finale predictions are orthogonal
    // to how the main score is earned, so an Active Roster league can still use them.
    const bets = addSideLayers(state, results);
    Object.values(results).forEach(r=> r.total = roundPoints(r.locked + (bets? r.bonus:0) + r.finale));
    // A10 part 3c: a stock market's cash and worth beside each row, ranked by worth when the game ranks by it (ties to the points).
    if(MarketLogic.on(state)){
      const prices = PriceLogic.prices(state);
      const cash = MarketLogic.cashAll(state);
      Object.values(results).forEach(r => { r.cash = cash.get(r.playerId); r.worth = MarketLogic.worth(state, r.playerId, prices, r.cash); });
      if(gameOf(state).rank.by === 'worth') return Object.values(results).sort((a,b) => PickEmScoringStrategy.compareKeys(rankKey(state, b), rankKey(state, a)));
    }
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
  // episode would otherwise count as correct the moment it's made (nothing yet contradicts it) -- or
  // once it's known nobody went home (ep.noExit, step 6c), when every pick survives. A pool that survives by scoring (a
  // sport, settings.poolSurvive 'scores': docs/PLAN-new-design.md step 10 part 2b) is decided once its scores are in.
  static decided(ep, state){
    if(!ep) return false;
    if(ep.noExit || (ep.events||[]).length > 0) return true;
    return PickEmLogic.byScore(state) && (ep.scoringEvents||[]).length > 0;
  }
  // Nobody goes home in a sport: a pick survives an event by scoring in it (a driver in the points), not by staying in.
  static byScore(state){ return gameOf(state).score.means === 'scores'; }
  static scored(state, ep, castawayId){
    const points = ActiveRosterLogic.episodeEvents(state, ep).filter(ev => ev.castawayId === castawayId).reduce((n, ev) => n + ActiveRosterLogic.eventPoints(state, ev), 0);
    return points > 0;
  }

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
  //
  // A pool's second pick (A10 part 2) counts in the cycle, and blocks back to back, once its episode is decided and it counted
  // (a night two went home, or always with fallback 'counts'): a void one never played. Someone out of a pool with lives
  // (history's `out`, before this episode) can pick nobody: { available: [], blocked: {}, out }.
  //
  // A11 part 2: a pick that never repeats (parts.never) blocks everyone they've picked in their own season (reason 'used'), with no
  // fallback here: once they've picked everyone still in there's nobody to pick (its fallback is history's: a miss, or a night
  // that doesn't count). After a pool's early end (one or none left) nobody picks: { available: [], blocked: {}, ended }.
  static eligibility(state, epId, playerId){
    const ep = PickEmLogic.findEpisode(state, epId);
    const remaining = state.castaways.filter(c => c.status === 'active').map(c => c.id);
    const blocked = {};
    if(!ep) return { available: remaining, blocked };
    const parts = PickEmLogic.parts(state);
    const ended = parts && parts.oneLeft === 'ends' ? PickEmLogic.endsAt(state) : null;
    if(ended !== null && ep.number > ended) return { available: [], blocked, ended };
    if(parts && parts.lives !== null){
      const out = PickEmLogic.history(state, playerId, parts).out;
      if(out !== null && out < ep.number) return { available: [], blocked, out };
    }
    const prior = [...state.episodes]
      .filter(e => e.number < ep.number)
      .sort((a,b) => a.number - b.number)
      .flatMap(e => {
        const pick = (e.picks||[]).find(pk => pk.playerId === playerId);
        if(!pick) return [];
        const made = [{ number: e.number, castawayId: pick.castawayId }];
        if(pick.second && PickEmLogic.secondCounted(state, e, parts)) made.push({ number: e.number, castawayId: pick.second });
        return made;
      });
    if(parts && parts.never){
      // Only the picks their own season played (from their start, in the game's span), as history counts them.
      const from = GhostLogic.startFor(state, playerId);
      const picked = new Map(prior.filter(x => from !== null && x.number >= from && inPlay(state, x.number)).map(x => [x.castawayId, x.number]));
      remaining.forEach(id => { if(picked.has(id)) blocked[id] = { episode: picked.get(id), reason: 'used' }; });
      return { available: remaining.filter(id => !picked.has(id)), blocked };
    }
    const covers = (cycle) => remaining.every(id => cycle.has(id));
    let cycle = new Map(); // castawayId -> episode number picked in, this cycle
    prior.forEach(x => {
      if(covers(cycle)) cycle = new Map();
      cycle.set(x.castawayId, x.number);
    });
    if(covers(cycle)) cycle = new Map();
    // The last episode picked in: its pick (and a second that counted) can't be picked again straight away.
    const lastNumber = prior.length ? prior[prior.length - 1].number : null;
    const last = prior.filter(x => x.number === lastNumber && remaining.includes(x.castawayId));
    remaining.forEach(id => {
      if(cycle.has(id)) blocked[id] = { episode: cycle.get(id), reason: 'cycle' };
    });
    last.forEach(x => { blocked[x.castawayId] = { episode: x.number, reason: 'backToBack' }; });
    let available = remaining.filter(id => !blocked[id]);
    if(!available.length && last.length){
      available = last.map(x => x.castawayId);
      last.forEach(x => { delete blocked[x.castawayId]; });
    }
    return { available, blocked };
  }

  // A10 part 2: a pool's lives, buyback, mulligans and second pick (the spec's score.lives, .buyback, .mulligans, get.second),
  // or null for a pool with none of them (today's: a streak nobody is knocked out of). lives null: nobody's out.
  // Read the one way the words read them (game-spec poolParts), a buyback's defaults filled even on settings written by hand.
  static parts(state){ return Spec.poolParts(gameOf(state)); }
  // Whether two or more went home in an episode: a night a second pick counts. Known only from its results (nothing at a lock
  // says a night is a double: the schedule doesn't, nor does a rulebook); a winner's exit isn't one going home.
  static double(state, ep){ return nightOf(state, ep).gone.size >= 2; }
  // Whether a pick went home in an episode, as the pool grades it (nightOf: on the finale, anyone but the winner did). False
  // before its results; a pool that survives by scoring grades by points instead (scored), so this is a staying-in pool's.
  static wentHome(state, ep, castawayId){ return wentHome(nightOf(state, ep), castawayId); }
  // Whether an episode's second picks counted: it's decided, and two or more went home in it (or the pool's second pick counts
  // every night: fallback 'counts'). `parts`: the pool's, when the caller has them (a walk over every episode reads them once).
  static secondCounted(state, ep, parts){
    if(parts === undefined) parts = PickEmLogic.parts(state);
    if(!parts || !parts.second || !PickEmLogic.decided(ep, state)) return false;
    return parts.second.fallback === 'counts' || PickEmLogic.double(state, ep);
  }
  // Whether someone out in episode `number` can buy back: before the buyback's episode, or before its phase's first episode
  // where data says it starts (state.phaseStarts, the desk's: RosterLogic.settlePhases). A phase whose start isn't known yet
  // hasn't started as far as data says, so the buyback stands; a start confirmed later takes it back (history is worked out
  // live, as every result is).
  static canBuyBack(state, buyback, number){
    const b = buyback && buyback.before;
    if(!b) return true;
    if(Number.isInteger(b.episode)) return number < b.episode;
    const from = state.phaseStarts && state.phaseStarts[b.phase];
    return !Number.isInteger(from) || number < from;
  }

  // A player's season, episode by episode, with their streaks. A row per episode that has happened
  // (picked or not -- a missed one breaks the streak) plus any pick still waiting on its episode.
  //
  // A pool's parts (A10 part 2: parts), each on a row only when the pool has them, and on the history: `lives` left (null
  // without lives), `out` the episode they went out in for good (null while in: no rows after it, nothing more counts),
  // `mulligans` and `buybacks` left, `cost` what buybacks took off the total. A wrong pick (or none) a mulligan doesn't forgive
  // resets the streak and costs a life; a night that empties them ends with a buyback (before its deadline, while one's left:
  // back in from the next episode with one life, its cost off their total, `boughtBack` on the row) or out (`out` on the row),
  // once, however many of its picks were wrong. A second pick (`second` on the row: { castawayId, correct, points } and `void`
  // when it didn't count) is judged with the first: a night's right picks count first, then its wrong ones, so a night with a
  // wrong pick ends the streak whichever it was; a missing second pick is nothing, never a miss (nobody knew it was a double).
  // `parts`: the pool's, when the caller has them.
  //
  // A11 part 2: a pick that never repeats (parts.never), on a night they'd picked everyone still in at its start: with its
  // fallback 'miss' it's a missed pick, as any night without one; with 'skip' nothing counts that night (a row with `skipped`,
  // correct null: no points, no life lost, the streak holds). And a pool whose end is the pool's, not each player's (together:
  // one left ends it, or the night everyone left goes out isn't all of them out by their points) reads each one's season from
  // the pool's walk (PickEmLogic.walk): nothing after the episode it ended, and a night everyone left went out spared (`spared`
  // on its row: back with the lives they had that night) or shared (`shared` on the history: they share the win).
  static history(state, playerId, parts){
    if(parts === undefined) parts = PickEmLogic.parts(state);
    if(!PickEmLogic.together(parts)) return PickEmLogic.solo(state, playerId, parts, null);
    const w = PickEmLogic.walk(state, parts);
    return w.of.has(playerId) ? w.of.get(playerId) : PickEmLogic.solo(state, playerId, parts, w.ends);
  }
  // One player's season on its own: every episode it plays, in order, through `to` (null: its span's end).
  static solo(state, playerId, parts, to){
    const st = PickEmLogic.stepper(state, playerId, parts, to);
    [...state.episodes].sort((a,b) => a.number - b.number).forEach(st.step);
    return st.result();
  }
  // One player's season walked an episode at a time (history's): `step(ep)` plays an episode, in order; `t` what it carries
  // (lives, out, ...); `spare(n, was)` takes back the night that sent them out (the lives and mulligans they had before it);
  // `result()` the history. `to`: the episode the pool ended at, nothing after it played (null: its span's end).
  static stepper(state, playerId, parts, to){
    const score = gameOf(state).score;
    const perCorrect = score.by === 'survive' && typeof score.points === 'number' ? score.points : 1;
    const byScore = PickEmLogic.byScore(state);
    const t = { rows: [], current: 0, longest: 0, total: 0, lives: parts ? parts.lives : null, mulligans: parts ? parts.mulligans : 0,
      buybacks: parts && parts.buyback ? parts.buyback.times : 0, cost: 0, out: null, shared: false };
    // One pick's outcome: right (the streak grows), or wrong: a mulligan forgives it, else the streak resets and, with lives
    // left, it costs one.
    const settle = (right) => {
      if(right){ t.current++; t.total += perCorrect; t.longest = Math.max(t.longest, t.current); return { correct: true, points: perCorrect }; }
      if(t.mulligans > 0){ t.mulligans--; return { correct: false, points: 0, forgiven: true }; }
      t.current = 0;
      if(t.lives === null || t.lives === 0) return { correct: false, points: 0 };
      t.lives--;
      return { correct: false, points: 0, lifeLost: true };
    };
    // Episodes before the league started are history, not missed picks (settings.startEpisode).
    // A late joiner's season starts at their own episode (GhostLogic.startFor).
    const from = GhostLogic.startFor(state, playerId);
    // A11 part 5c: someone still catching up has played only as far as their own week (the episode after their mark, kept on
    // their lateJoin by the server: seenThrough; or the latest they've picked in, should that mark lag), in every copy of the
    // league: an episode past it isn't theirs yet, and their week with no pick in it is still open, so neither is a missed pick
    // (nor a life lost), whatever results everyone else has.
    const lj = GhostLogic.lateJoinOf(state, playerId);
    let reach = null;
    if(lj && lj.catchingUp && from !== null){
      const picked = (state.episodes || []).filter(e => (e.picks || []).some(pk => pk.playerId === playerId)).map(e => e.number);
      reach = Math.max(Number.isInteger(lj.seenThrough) ? lj.seenThrough + 1 : from, from, ...picked);
    }
    // A pick that never repeats: who they've used (a first pick once made, a second once it counted), and who was still in at an
    // episode's start (nobody who'd left in one before it).
    const never = parts && parts.never;
    const used = new Set();
    const epNo = never ? new Map((state.episodes || []).map(e => [e.id, e.number])) : null;
    const spent = (ep) => !(state.castaways || []).some(c => !used.has(c.id) && !(c.status === 'eliminated' && (epNo.get(c.exitEpisodeId) || 0) < ep.number));
    const step = (ep) => {
      if(t.out !== null || from === null || ep.number < from || !inPlay(state, ep.number) || (Number.isInteger(to) && ep.number > to)) return null;
      if(reach !== null && ep.number > reach) return null;
      const pick = (ep.picks||[]).find(pk => pk.playerId === playerId) || null;
      if(reach !== null && ep.number === reach && !pick) return null;
      const second = parts && parts.second && pick && pick.second ? pick.second : null;
      if(!PickEmLogic.decided(ep, state)){
        if(pick){
          const row = { episode: ep.number, postMerge: !!ep.postMerge, castawayId: pick.castawayId, correct: null, points: 0, streak: t.current };
          if(second) row.second = { castawayId: second, correct: null, points: 0 };
          t.rows.push(row);
          used.add(pick.castawayId);
        }
        return null;
      }
      // Nobody left they could pick (a pick that never repeats, skipped): nothing counts that night.
      if(!pick && never && never.fallback === 'skip' && spent(ep)){
        const row = { episode: ep.number, postMerge: !!ep.postMerge, castawayId: null, correct: null, points: 0, streak: t.current, skipped: true };
        if(t.lives !== null) row.lives = t.lives;
        t.rows.push(row);
        return row;
      }
      // Correct = the picked person isn't among this episode's eliminations (or, surviving by scoring, scored in it). Derived
      // live from the episode rather than stored, so logging or undoing a result can't leave it stale. R1 part 3: only the
      // winner survives the finale (nightOf); a show nobody wins keeps the rule of every night.
      const night = byScore ? null : nightOf(state, ep);
      const survived = (id) => !!id && (byScore ? PickEmLogic.scored(state, ep, id) : !wentHome(night, id));
      const row = { episode: ep.number, postMerge: !!ep.postMerge, castawayId: pick ? pick.castawayId : null, correct: false, points: 0, streak: 0 };
      const counts = !!second && PickEmLogic.secondCounted(state, ep, parts);
      if(pick) used.add(pick.castawayId);
      if(counts) used.add(second);
      const judged = [['first', survived(pick && pick.castawayId)]];
      if(counts) judged.push(['second', survived(second)]);
      const outcome = {};
      // The night's right picks first, then its wrong ones.
      judged.filter(([, right]) => right).forEach(([k]) => { outcome[k] = settle(true); });
      judged.filter(([, right]) => !right).forEach(([k]) => { outcome[k] = settle(false); });
      Object.assign(row, outcome.first);
      if(second) row.second = counts ? { castawayId: second, ...outcome.second } : { castawayId: second, correct: null, points: 0, void: true };
      row.streak = t.current;
      // A night that emptied their lives: bought back from the next episode, or out for good.
      if(t.lives === 0){
        if(t.buybacks > 0 && PickEmLogic.canBuyBack(state, parts.buyback, ep.number)){
          t.buybacks--; t.lives = 1; t.cost += parts.buyback.cost; t.total -= parts.buyback.cost;
          row.boughtBack = parts.buyback.cost;
        } else {
          t.out = ep.number;
          row.out = true;
        }
      }
      if(t.lives !== null) row.lives = t.lives;
      t.rows.push(row);
      return row;
    };
    // The night taken back: its lives, mulligans and streak as they were before it (a right second pick's points stay).
    const spare = (n, was) => {
      const row = t.rows[t.rows.length - 1];
      if(t.out !== n || !row || row.episode !== n) return;
      t.out = null;
      t.lives = was.lives;
      t.mulligans = was.mulligans;
      t.current = was.current;
      for(const r of [row, row.second]) if(r){ delete r.lifeLost; delete r.forgiven; }
      delete row.out;
      row.streak = was.current;
      row.lives = was.lives;
      row.spared = true;
    };
    const result = () => {
      const h = { rows: t.rows, total: t.total, longestStreak: t.longest, currentStreak: t.current };
      if(parts) Object.assign(h, { lives: t.lives, out: t.out, mulligans: t.mulligans, buybacks: t.buybacks, cost: t.cost });
      if(t.shared) h.shared = true;
      return h;
    };
    return { t, step, spare, result };
  }
  // A11 part 2: whether a pool's end is the pool's, not each player's: one left ends it, or the night everyone left goes out
  // isn't all of them out by their points (parts.oneLeft, parts.allOut, a pool with lives ranked by who's still standing).
  static together(parts){ return !!(parts && parts.oneLeft && (parts.oneLeft === 'ends' || parts.allOut !== 'points')); }
  // The pool's walk (A11 part 2), everyone together an episode at a time, worked out from the data on every read as a draft's
  // knockouts are: { of: Map playerId -> history, ends: the episode the game ended at (one or none left), else null }.
  //   - Who's in it: everyone playing the league's own season (not a late joiner's private one, a ghost, nor someone not yet
  //     brought in), as KnockoutLogic's. Someone still catching up counts as still in (their season isn't played yet), so they
  //     hold the end off and nobody else's night is everyone's.
  //   - The night everyone left goes out (two or more still in at its start, none catching up, all of them out after it): allOut
  //     'back', they're all back in for the next episode with the lives, mulligans and streak they had before it; 'share', all
  //     out, sharing the win (standingKey ties them); 'points', all out, ranked by their points. One left going out is just
  //     going out.
  //   - oneLeft 'ends': once one or none of everyone is left (of two or more), the game ends after that episode (lastEpisode,
  //     through KnockoutLogic.endsAt): it's over (gameOver), scores as it stood then (spanView), and nothing after it is played.
  //   - It reads who went home, as every pool pick is graded (A10 part 2): an episode's early results (who went home, before the
  //     scoring) decide its picks, so they can end the game too; a correction at its final results works it out again.
  static walk(state, parts){
    const everyone = (state.players || []).filter(p => !isGhost(p) && !p.disabled && p.active !== false);
    const catching = new Set(everyone.filter(p => GhostLogic.isCatchingUp(state, p.id)).map(p => p.id));
    const steps = new Map(everyone.map(p => [p.id, PickEmLogic.stepper(state, p.id, parts)]));
    const isIn = p => catching.has(p.id) || steps.get(p.id).t.out === null;
    let ends = null;
    const episodes = [...(state.episodes || [])].filter(ep => inPlay(state, ep.number)).sort((a,b) => a.number - b.number);
    for(const ep of episodes){
      const before = everyone.filter(isIn);
      const was = new Map(before.map(p => { const t = steps.get(p.id).t; return [p.id, { lives: t.lives, mulligans: t.mulligans, current: t.current }]; }));
      steps.forEach(st => st.step(ep));
      if(!PickEmLogic.decided(ep, state)) continue;
      const went = before.filter(p => !catching.has(p.id) && steps.get(p.id).t.out === ep.number);
      if(went.length >= 2 && went.length === before.length){
        if(parts.allOut === 'back') went.forEach(p => steps.get(p.id).spare(ep.number, was.get(p.id)));
        else if(parts.allOut === 'share') went.forEach(p => { steps.get(p.id).t.shared = true; });
      }
      if(parts.oneLeft === 'ends' && everyone.length >= 2 && everyone.filter(isIn).length <= 1){ ends = ep.number; break; }
    }
    const of = new Map([...steps].map(([id, st]) => [id, st.result()]));
    return { of, ends };
  }
  // Every player's history at once (Map playerId -> history), one walk for a pool that walks everyone together: the table's.
  static histories(state){
    const parts = PickEmLogic.parts(state);
    const w = PickEmLogic.together(parts) ? PickEmLogic.walk(state, parts) : null;
    return new Map((state.players || []).map(p => [p.id, w ? (w.of.get(p.id) || PickEmLogic.solo(state, p.id, parts, w.ends)) : PickEmLogic.solo(state, p.id, parts, null)]));
  }
  // Where a pool ends early (A11 part 2: one or none left, with oneLeft 'ends'), else null.
  static endsAt(state){
    const parts = PickEmLogic.parts(state);
    return parts && parts.oneLeft === 'ends' ? PickEmLogic.walk(state, parts).ends : null;
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
  //
  // A pool's second pick (A10 part 2: opts.second, a pool with get.second): beside a first pick already made, never the same
  // person, by the same rules (`pick.second`). Changing the first to the second's person drops the second. Someone out (a
  // pool with lives) can pick nobody (eligibility).
  static setPick(state, epId, playerId, castawayId, opts){
    const ep = PickEmLogic.findEpisode(state, epId);
    const c = Core.getCastaway(state, castawayId);
    const player = Core.getPlayer(state, playerId);
    if(!ep || !c || !player || c.status!=='active' || !inPlay(state, ep.number)) return;
    if(closedForPlay(ep) || PickEmLogic.decided(ep, state)) return; // picks close when the episode starts (or its lock says)
    if(!PickEmLogic.eligibility(state, epId, playerId).available.includes(castawayId)) return;
    ep.picks = ep.picks || [];
    const existing = ep.picks.find(pk=>pk.playerId===playerId);
    if(opts && opts.second){
      const parts = PickEmLogic.parts(state);
      if(!parts || !parts.second || !existing || existing.castawayId === castawayId) return;
      existing.second = castawayId;
      return;
    }
    if(existing){
      existing.castawayId = castawayId;
      if(existing.second === castawayId) delete existing.second;
    }
    else ep.picks.push({playerId, castawayId});
  }
  // opts.second: only the second pick (A10 part 2); else the whole pick, a second with it. In a pool with a second pick, neither
  // once the episode is locked or decided: a missing second pick counts nothing, so clearing a wrong one after the results
  // would take back what it cost (in a pool without one, a cleared pick is a miss, which changes nothing in anyone's favour).
  static removePick(state, epId, playerId, opts){
    const ep = PickEmLogic.findEpisode(state, epId);
    if(!ep) return;
    const parts = PickEmLogic.parts(state);
    if(parts && parts.second && (closedForPlay(ep) || PickEmLogic.decided(ep, state))) return;
    if(opts && opts.second){
      const existing = (ep.picks||[]).find(pk=>pk.playerId===playerId);
      if(existing) delete existing.second;
      return;
    }
    ep.picks = (ep.picks||[]).filter(pk=>pk.playerId!==playerId);
  }

  // Who goes home? (a public pool's prediction, docs/PLAN-new-design.md step 9 part 3; settings.calls): beside the pick of
  // who survives, one call a week of who leaves. Since step 12 part 2 the call itself is a person's Call it (the
  // episode_calls table, src/lib/server/calls.ts), the same call whatever reads it, so a pool only says it takes one.
  static callsOn(state){ return !!gameOf(state).extras.calls; }
}

// ---------- League type + show registries ----------
// See the "League types" comment near the top of this file for the extension pattern. Both
// registries are plain data (id/name/description/etc.) so new entries are additive, not
// rewrites -- SHOWS today is display/terminology metadata only, not wired to any behavior yet
// (a future per-show wiki-sourcing config would attach here without changing this shape).
//
// Each type's flags are its preset spec's (game-spec flagsOf: hasRoster, hasActiveRoster, hasWeeklyPicks, hasCalls,
// hasBingo, supportsReplenish, supportsTrade, supportsFinalePredictions), filled in below the table, so what a game
// can do comes from what it is. The table says only what the spec doesn't: the name and the words. Step R1: no strategies
// here, a game plays the pieces its spec names (piecesOf).
const LEAGUE_TYPES = {
  'classic-draft': {
    id: 'classic-draft',
    name: 'Classic',
    description: 'Commissioner sets a draft order, players snake-draft castaways, score by elimination placement.'
  },
  'pickem': {
    id: 'pickem',
    name: "Eliminator Pool",
    description: 'No draft, no roster -- every episode, each player picks one castaway they think survives. No repeats until you\'ve picked everyone still in the game, and never the same one twice in a row. Ranked by longest streak of correct picks, then total correct.'
  },
  // A talk show's season game (docs/PLAN-new-design.md step 12 part 2): no draft and no cast to own, two calls about each
  // show before it starts (Call it), most right by the finale wins. The calls aren't in the state (CallsScoringStrategy).
  'weekly-calls': {
    id: 'weekly-calls',
    name: 'Weekly Calls',
    description: 'No draft, no team -- before each show, two calls about what will happen in it. Most right by the finale wins.'
  },
  // A game of questions (docs/PLAN-start-a-game-gpt.md step A4): no draft and no team, the spec's own questions answered
  // before their lock and settled by the results (AnswerLogic), most points wins. The answers live in game_answers, not
  // the state (private until each locks), so the server's game view grades and ranks them (answers.ts); in here everyone
  // is level at 0, as in Weekly Calls.
  'questions': {
    id: 'questions',
    name: 'Questions',
    description: 'No draft, no team -- questions answered before they lock, settled by the results. Most points wins.'
  },
  // The talk show's other season game (step 12 part 3): no draft and no team, a new bingo card every show (bingo.ts), most
  // lines by the finale wins. The cards aren't in the state either (CallsScoringStrategy).
  'weekly-bingo': {
    id: 'weekly-bingo',
    name: 'Weekly Bingo',
    description: 'No draft, no team -- a new bingo card every show, ticked as it happens. Most lines by the finale wins.'
  },
  // A game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 1): no draft and no team of its own, each stage a game played as a
  // league of its own (stages.ts), its table the overall from the stages' tables (StageLogic).
  'stages': {
    id: 'stages',
    name: 'Stages',
    description: 'A game in stages, each a game of its own with its own rules and its own draft; the overall adds them up.'
  },
  'active-roster': {
    id: 'active-roster',
    name: 'Active Roster',
    description: 'Draft a roster, then each episode field only some of it. Points come from what your active castaways do that week (winning challenges, surviving a vote, the show\'s own moments), not from elimination placement.'
  }
};
// The flags, from each type's preset (its exclusive draft, for the two drafts: the shared variants below are the other).
// A game of questions has no preset: its flags are any such game's (nothing held, scored by its own answers).
// A game in stages (A12 part 1) has its own: nothing held, scored by its stages.
Object.values(LEAGUE_TYPES).forEach(lt => Object.assign(lt, Spec.flagsOf(Spec.PRESETS[Spec.TYPE_PRESETS[lt.id]] || (lt.id === 'stages' ? { get: { by: 'none' }, count: null, score: { by: 'stages' }, ask: [] } : { get: { by: 'none' }, count: null, score: { by: 'answers' }, ask: [] }))));
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
// but a different draft mechanic (the spec's get.order follows get.own: a blind draft, draftPiece) and
// two mid-season features switched off:
//
// - supportsReplenish/supportsTrade -> false. Both are free-agent mechanics, and shared mode has no
//   free agents (nothing is ever removed from availability). Left on, they'd be live buttons that
//   silently accomplish nothing: a pickup or add/drop takes only a castaway nobody owns, and in
//   shared mode every castaway is owned. A shared-mode replenish
//   COULD instead mean "add any still-active castaway" -- that's a real design question this plan
//   doesn't answer, so it's left out rather than guessed at.
//
// Built once per roster league type rather than per call, since getLeagueType runs on nearly every
// render. Keyed by league type id so Active Roster gets the same treatment as Classic Draft without
// either needing to know about the other.
const SHARED_OWNERSHIP_VARIANTS = {};
// Its flags are the shared draft's (flagsOf): waivers stay on for Active Roster, where shared replenish/swap has a
// defined meaning (add anyone still in the game who isn't already yours: MidSeasonLogic.availableFor), and go off for
// Classic Draft, whose replenish replaces a loss 1-for-1 from a free-agent pool, which shared mode lacks.
Object.values(LEAGUE_TYPES).forEach(lt => {
  if(!lt.hasRoster) return;
  const preset = Spec.PRESETS[Spec.TYPE_PRESETS[lt.id]];
  SHARED_OWNERSHIP_VARIANTS[lt.id] = {
    ...lt,
    ...Spec.flagsOf({ ...preset, get: { ...preset.get, own: 'shared', order: 'blind' } })
  };
});
// Best ball (docs/PLAN-start-a-game-gpt.md step A9 part 2: count { best: n }): Weekly Lineup's league type, the same id and
// scorer (ActiveRosterEventScoringStrategy, through ActiveRosterLogic.episodeScore), with no lineups to set -- each
// episode a team's best n count. Its flags are its spec's (flagsOf: no active roster, hasBestBall), for each ownership, as the
// variants above are built once.
const BEST_BALL_VARIANTS = {};
['exclusive', 'shared'].forEach(own => {
  const lt = own === 'shared' ? SHARED_OWNERSHIP_VARIANTS['active-roster'] : LEAGUE_TYPES['active-roster'];
  const preset = Spec.PRESETS['weekly-lineup'];
  BEST_BALL_VARIANTS[own] = { ...lt, ...Spec.flagsOf({ ...preset, get: { ...preset.get, own, order: Spec.ORDER_OF[own] }, count: { best: 1 } }) };
});
// Resolves the league type the game's spec plays (game-spec playsAs: from its mechanics, never a stored name), applying
// the ownership override above: its name, its words and its flags, which the screens still read (step R3 takes them to
// the spec). Returns the registry entry itself in every other case, so `getLeagueType(state).id` and the supports*/has*
// flags stay the single thing those callers read. Nothing plays through it: drafting and scoring are the spec's pieces
// (piecesOf). A spec no game plays yet can't be stored (setGame refuses it), so the fallback, Outlast, is only for a league
// with no settings. A10 part 3's draw and 3b's auction play the type their ownership and count make (their draft is a piece).
function getLeagueType(state){
  const g = gameOf(state);
  const base = LEAGUE_TYPES[Spec.playsAs(g)] || LEAGUE_TYPES['classic-draft'];
  if(base.id === 'active-roster' && Spec.countKind(g.count) === 'best') return BEST_BALL_VARIANTS[g.get.own === 'shared' ? 'shared' : 'exclusive'];
  if(g.get.by === 'draft' && g.get.own === 'shared' && SHARED_OWNERSHIP_VARIANTS[base.id]) return SHARED_OWNERSHIP_VARIANTS[base.id];
  return base;
}

// ---------- The pieces a game is made of (docs/PLAN-start-a-game-gpt.md step R1) ----------
// A game plays the composition its spec names, never a league type: its draft mechanic from how it gets its castaways (a draft's
// order: a snake, a blind draft, a draw or an auction; nothing to draft otherwise), its scorer from how it scores (score.by: the
// boot order, moments, who survives, answers and bingo lines counted outside the state, stages), and what it has from the rest of
// it (game-spec flagsOf: a lineup is a draft whose starters count, best ball one whose best n do, a pool a pick each episode;
// waivers, side bets and finale predictions beside a draft). Drafting and scoring ask this, and so does everything outside this
// file that scores a game or reads what it holds (the Games tab's table, an episode's lines, the couch's standings, the computer
// players). A spec no game plays can't be stored (setGame refuses it), so the fallback, an Outlast drafted the way the spec
// says (a shared draft blind, a draw or an auction as such, as the league types' fallback played it), is only for a league
// with no settings.
const DRAFT_PIECES = { snake: SnakeDraftStrategy, blind: BlindDraftStrategy, draw: DrawDraftStrategy, auction: AuctionDraftStrategy };
const SCORE_PIECES = {
  place: EliminationOrderScoringStrategy, moments: ActiveRosterEventScoringStrategy, survive: PickEmScoringStrategy,
  answers: CallsScoringStrategy, lines: CallsScoringStrategy, stages: StagesScoringStrategy,
};
let OUTLAST_GAME = null;
// The game a league's pieces come from: its own, or (no game plays it) Outlast, drafted with the spec's ownership and, for a
// draw or an auction, its order.
function playedGame(state){
  const g = gameOf(state);
  if(Spec.playsAs(g)) return g;
  const outlast = OUTLAST_GAME || (OUTLAST_GAME = Spec.fullSpec({ preset: 'outlast' }));
  if(!g || !g.get || g.get.by !== 'draft') return outlast;
  const own = g.get.own === 'shared' ? 'shared' : 'exclusive';
  const order = g.get.order === 'draw' || g.get.order === 'auction' ? g.get.order : Spec.ORDER_OF[own];
  return { ...outlast, get: { ...outlast.get, own, order } };
}
function draftOf(g){
  return (g.get.by === 'draft' && Object.prototype.hasOwnProperty.call(DRAFT_PIECES, g.get.order) && DRAFT_PIECES[g.get.order]) || NoDraftStrategy;
}
/** The draft mechanic the game's spec names (NoDraftStrategy for a game with nothing to draft). */
function draftPiece(state){ return draftOf(playedGame(state)); }
/** The scorer the game's spec names (its score.by). */
function scorePiece(state){ return SCORE_PIECES[playedGame(state).score.by]; }
/**
 * Everything a game is made of: { draft, scorer } (the two strategies), { holds, counts, scores, ranks } (its spec's get.by,
 * count's kind, score.by and rank.by) and its flags (game-spec flagsOf: hasRoster, hasActiveRoster, hasWeeklyPicks, ...,
 * supportsReplenish, supportsFinalePredictions). Frozen and kept per game: a carried spec (settings.game) is replaced, never
 * changed in place, so its pieces are worked out once; a game read from its fields is read fresh on each call, as gameOf is.
 */
const PIECES = new WeakMap();
function piecesOf(state){
  const g = playedGame(state);
  let p = PIECES.get(g);
  if(!p){
    p = Object.freeze({
      draft: draftOf(g), scorer: SCORE_PIECES[g.score.by],
      holds: g.get.by, counts: Spec.countKind(g.count), scores: g.score.by, ranks: g.rank.by,
      ...Spec.flagsOf(g),
    });
    PIECES.set(g, p);
  }
  return p;
}

// How many castaways each player drafts: the spec's get.each (none without a draft). For Active Roster that's the
// active slots plus the bench, by definition (the spec's team is the lineup and the bench together), so a commissioner
// can't set a team that could never fill its lineup. Every draft mechanic asks through here.
function rosterSize(state){
  const get = gameOf(state).get;
  return get.by === 'draft' ? get.each : 0;
}

// Whether replacements (pre-v2 "pickups") / swaps (pre-v2 "add/drops") happen in this league. Two
// independent things have to be true, and keeping them separate matters:
//   1. CAPABILITY -- the league type/ownership mode can support it at all (supportsReplenish /
//      supportsTrade). Shared Classic and Eliminator Pool can't. Not the commissioner's call.
//   2. CHOICE -- the league's waiver settings (WaiverLogic.config, docs/PLAN-waivers-v2.md):
//      replacements unless replaceRule is 'never'; swaps when windows with swaps open on a schedule,
//      or a window the commissioner opened allows them right now.
// Everything that shows or opens waivers asks through here (or WaiverLogic) rather than reading the
// settings itself, so the UI can't offer a move the route would refuse (or vice versa).
function replenishAvailable(state){
  return WaiverLogic.replaceRule(state) !== 'never';
}
function tradeAvailable(state){
  if(!WaiverLogic.supported(state)) return false;
  const w = WaiverLogic.windows(state);
  return (w.schedule !== 'manual' && w.swaps > 0) || WaiverLogic.swapsAllowed(WaiverLogic.current(state)) > 0;
}
function finalePredictionsAvailable(state){
  return !!finaleOfGame(state);
}
// A draft's finale predictions, as the spec's two questions say them ({ top3, winner, from }: their points), or null.
function finaleOfGame(state){
  const g = gameOf(state);
  return g.get.by === 'draft' ? Spec.finaleOf(g.ask) : null;
}
// Side bets, where they count ({ points }: each new one's), or null: only beside a draft (A4: a pool, Weekly Calls and
// Weekly Bingo never scored them, so they don't offer them). What everything that shows or takes a bet asks.
function betsOn(state){
  const g = gameOf(state);
  return Spec.betsFit(g) ? g.extras.bets : null;
}

// ---------- DraftLogic ----------
// Thin dispatcher -- see "The pieces" comment near the top of this file. Delegates every method to
// the draft mechanic the spec names (draftPiece: a snake, a blind draft, a draw, an auction, or
// NoDraftStrategy for a game with nothing to draft).
class DraftLogic {
  // A12 part 1: a draft that opens at its game's start (the draft room's opens 'start': a later stage's, by default) drafts from
  // who's still in then. Why it isn't open yet, or null (open, or a draft that opens any time): it opens once the game's start is
  // known and the episode before it has results, and stays open once anyone is on a team from it, whatever those results do after.
  // A Start before then waits for it (isStarted stays false; a draw deals and an auction settles only once it's open).
  static waits(state){
    const g = gameOf(state);
    const room = g.get.by === 'draft' ? g.extras.draft : null;
    if(!room || room.opens !== 'start' || DraftLogic.begun(state)) return null;
    const first = startEpisode(state);
    if(first === null) return "The draft opens once it's known where the game starts";
    if(first <= 1) return null;
    const before = (state.episodes || []).find(e => e.number === first - 1);
    return before && EpisodeLogic.hasResults(before) ? null : `The draft opens once Episode ${first - 1}'s results are in`;
  }
  // Anyone is on a team from the draft: a pick, a draw, a blind draft's reveal, an auction settled.
  static begun(state){ return (state.draftPicksMade || 0) > 0 || DrawLogic.drawn(state) || BlindDraftLogic.isRevealed(state) || AuctionLogic.settled(state); }
  static syncOrder(state){ return draftPiece(state).syncOrder(state); }
  static currentTurn(state){ return draftPiece(state).currentTurn(state); }
  static isStarted(state){ return !DraftLogic.waits(state) && draftPiece(state).isStarted(state); }
  // A10 part 4: keepers lock as the draft starts (a draw locks them itself, before it deals).
  static forceStart(state){ const out = draftPiece(state).forceStart(state); KeeperLogic.settle(state); return out; }
  static reorder(state, fromIdx, toIdx){ return draftPiece(state).reorder(state, fromIdx, toIdx); }
  static move(state, idx, delta){ return draftPiece(state).move(state, idx, delta); }
  static pick(state, castawayId, opts){ if(DraftLogic.waits(state)) return; return draftPiece(state).pick(state, castawayId, opts); }
  static undo(state, castawayId){ return draftPiece(state).undo(state, castawayId); }
}

// ---------- StageLogic: a game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 1: the spec's stages and overall) ----------
// "Pre-merge and post-merge are separate games with their own drafts, plus an overall winner", "a second draft at the merge". A game
// in stages is a league whose spec names its stages, each a game of its own played as a league of its own tied to it
// (src/lib/server/stages.ts: leagues.stage_of), so every stage plays exactly as that game does alone; this league holds the seats (a
// seat joining it joins every stage) and its table is the overall. The stages' tables reach it as the server reads them (stageWalk,
// as a game of questions' answers do: answer-points.ts asItStands), each as it stood after every episode it played, so a viewer's
// copy reads the overall at their mark (SpoilerLogic.viewThrough cuts the walk too):
//   state.stageWalk  { stages: [{ key, leagueId, from, to, entries: [{ episode, over, rows: [{ playerId, points, place }] }] }] }
// The overall (spec.overall): points (each stage's total as its table shows it, added up, every stage as it stands), places (for
// each stage that's over, points for your place there: `places` [1st, 2nd, ...], else one for each of you below you plus one; ties
// share the higher place) or wins (stages won, ties all win; level on that, places, then points). A stage not started for the viewer
// counts nothing, and someone not in a stage's table scores nothing from it. Nothing is stored: the walk is worked out on each read.
//
// A12 part 2, a stage a format change starts (a stage's `on`): its copies are leagues the server makes when the change comes
// (change-stages.ts), each keyed `<stage id>@<the change's id>` (format-timeline.js stageTriggers: `<episode>:<kind>`), one for the
// first such change after the stage before it started, or one at every such change ("again"); the walk carries each copy, and the
// standings each in order. Where each starts and ends is the plan (changePlan), worked out from the season's format state over time
// each time the server settles: only a change research is sure of, from the episode it takes effect or the first still open; the
// stage before ends where the copy starts; a change no longer in the data (a corrected report) takes its copy away. What the game
// remembers of it (the server writes it; the plan reads it):
//   state.changeStages { seen: { key: the first episode still open when the change was first seen }, decided: { key: { do: 'start' |
//                        'skip', by, at } } (the maker's), told: [what Recent changes has said], undone: [copies taken away] }
//
// A12 part 3, a side stage (a stage's `side` { held }): it plays beside the game's own stages, a copy of it for each spell of a grouping
// research is sure has held `held` episodes and goes on (format-timeline.js sideTriggers), keyed `<stage id>@<the spell's id>` (`s<the
// episode that showed it>`), from the episode after (or the first still open; never before the game starts), until research is sure the
// grouping changed (the later of its last episode and the one whose research said so: a side stage carries on while research isn't
// sure), or its own end. The game's own stages are untouched by it; its copies count in the overall as any stage's, and the game ends
// with its own last stage. Taken as a format change is (extras.changes), through the same record.
class StageLogic {
  static on(state){ return !!state && scorePiece(state) === StagesScoringStrategy; }
  static stages(state){ return StageLogic.on(state) ? gameOf(state).stages : []; }
  static overallOf(state){ const o = gameOf(state).overall; return o && typeof o === 'object' ? o : Spec.OVERALL; }
  static walkOf(state){ return state && state.stageWalk && Array.isArray(state.stageWalk.stages) ? state.stageWalk : null; }
  static withWalk(state, walk){ return walk ? { ...state, stageWalk: walk } : state; }
  // The walk as a viewer through episode n sees it: each stage's tables through n.
  static cutWalk(walk, n){
    if(!walk || !Array.isArray(walk.stages) || !Number.isInteger(n)) return walk;
    return { ...walk, stages: walk.stages.map(st => ({ ...st, entries: (st.entries || []).filter(e => e.episode <= n) })) };
  }
  // Each stage as it stood after the latest episode this copy has results for: { key, name, leagueId, from, to, started, over,
  // rows }, in the spec's order.
  static standings(state){
    const walk = StageLogic.walkOf(state);
    const latest = SpoilerLogic.latestWithResults(state);
    const row = (st, w, copy) => {
      const entries = w ? (w.entries || []).filter(e => e.episode <= latest) : [];
      const last = entries.length ? entries[entries.length - 1] : null;
      return { key: w ? w.key : st.id, stage: st.id, copy, side: !!Spec.stageSide(st), name: st.name || null, leagueId: w ? w.leagueId : null, from: w ? w.from : null, to: w ? w.to : null, started: !!last, over: !!(last && last.over), rows: last ? last.rows : [] };
    };
    // A12 part 2: a stage a format change starts is its copies, in the order they start (none until its change comes); A12 part 3: a
    // side stage too (none until a grouping lasts).
    return StageLogic.stages(state).flatMap(st => {
      if(!Spec.stageOn(st) && !Spec.stageSide(st)) return [row(st, walk ? walk.stages.find(x => x.key === st.id) : null, null)];
      const mine = (walk ? walk.stages : []).filter(x => StageLogic.copyOf(x.key) === st.id).sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity));
      return mine.map((w, i) => row(st, w, i + 1));
    });
  }
  // A12 part 2: the stage a copy's key is of (`<stage id>@<change id>`), or null for a stage's own key.
  static copyOf(key){ const at = String(key || '').indexOf('@'); return at > 0 ? String(key).slice(0, at) : null; }
  static copyKey(stageId, changeId){ return `${stageId}@${changeId}`; }
  // The stages a format change starts (their `on` whole).
  static onStages(state){ return StageLogic.stages(state).filter(st => !!Spec.stageOn(st)); }
  // A12 part 2b: the stages the one before's 'next-stage' fallback starts (Spec.nextStageAts): that stage ends where its group
  // question or its group slots can't be played as the groups stand, and this one starts then (format-timeline.js groupsGone,
  // one more of its triggers: the server's, change-stages.ts).
  static fallbackStarts(state){
    const list = StageLogic.stages(state);
    return new Set(list.filter((st, i) => !!Spec.stageOn(st) && Spec.fallsTo(list, i)).map(st => st.id));
  }
  // A12 part 3: the side stages (their `side` whole).
  static sideStages(state){ return StageLogic.stages(state).filter(st => !!Spec.stageSide(st)); }
  // How the game takes a format change (extras.changes, its defaults Spec.CHANGES), or null for a game no change moves (A12 part 3: a
  // side stage is taken the same way).
  static changesOf(state){
    if(!StageLogic.onStages(state).length && !StageLogic.sideStages(state).length) return null;
    const c = gameOf(state).extras.changes;
    return { ...Spec.CHANGES, ...(c && typeof c === 'object' ? c : {}) };
  }
  // What the game remembers of its format changes (state.changeStages), whole.
  static changeRecord(state){
    const r = state && state.changeStages && typeof state.changeStages === 'object' ? state.changeStages : {};
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    return { seen: obj(r.seen), decided: obj(r.decided), told: Array.isArray(r.told) ? r.told : [], undone: Array.isArray(r.undone) ? r.undone : [] };
  }
  // The maker's answer on a change that starts a stage (`key`, a copy's): 'start' or 'skip' (an undo, once it's started), by whom
  // and when. A problem (in words), or null once it's recorded.
  static decide(state, key, what, by, at){
    if(what !== 'start' && what !== 'skip') return "Say 'start' or 'skip'";
    const stage = StageLogic.copyOf(key);
    if(!stage || ![...StageLogic.onStages(state), ...StageLogic.sideStages(state)].some(st => st.id === stage)) return "That isn't one of this game's format changes";
    const rec = StageLogic.changeRecord(state);
    rec.decided = { ...rec.decided, [key]: { do: what, by: by || null, at: at || null } };
    state.changeStages = rec;
    return null;
  }
  /**
   * Where the stages a format change starts play (A12 part 2), worked out from the season's format state over time each time the
   * server settles (change-stages.ts), never stored: pure. `input`:
   *   triggers  { stageId: format-timeline.js stageTriggers(timeline, its on.change) }: `act` the changes research is sure of,
   *             `held` the ones it isn't (flagged, never acted on)
   *   starts    { stageId: the episode it plays from (its league's), or null while it waits } for the stages before
   *   copies    { key: { from } } the copies made and still live (their leagues' starts)
   *   open      the first episode still open for moves (the one after the latest that's aired or has results)
   *   last      the season's last episode, when it's known
   * A stage a change starts begins at the first change of its kinds research is sure of after the stage before it started (one per
   * episode: two in one episode start one copy); with `again`, a copy at every such change after it, until the next stage a change
   * starts begins (at most Spec.MAX_COPIES). Each plays from the episode its change takes effect or the first still open, whichever
   * is later, and never moves once that's aired; the stage before (or the copy before) ends with the episode before it. With the
   * maker's OK (extras.changes.ok 'maker'), a change nobody has answered waits until the lock of the episode it would start with
   * (`until`: from when it was first seen), then the game's default (unanswered: 'start' from the first episode still open, or
   * 'carry-on'); a skip is never started (and takes a started copy away). Two still to come that both start at the first episode
   * still open: the later change is the format now, so it alone starts. Returns { entries: [{ key, stage, copy (1, 2, ... for a
   * copy; null for a stage before them), trigger, from, to (the plan's end: an episode, the stage's own end for the last copy;
   * undefined where the plan says nothing), side (A12 part 3) }], pending, lapsed, skipped, held, late (past the season's end),
   * capped, superseded, unplayed (A12 part 3: a side copy whose grouping changed before it could play), seen: { key: open } first
   * seen now }.
   * A12 part 3, a side stage: its triggers are format-timeline.js sideTriggers' (a spell that held `held` episodes, research sure it
   * goes on), a copy for each, once the game's first stage has started: from the spell's next episode or the first still open (never
   * before the game's start), never moving once that's aired, with the maker's OK as a change's; to where research is sure the grouping
   * changed (`closes`: the later of its last episode and the one whose research said so), else the stage's own end; unsure (`closing`),
   * it plays on, held and said. The game's own stages are never moved by one.
   */
  static changePlan(state, input){
    const inp = input || {};
    const open = Number(inp.open);
    const last = Number.isInteger(inp.last) ? inp.last : null;
    const out = { entries: [], pending: [], lapsed: [], skipped: [], held: [], late: [], capped: [], superseded: [], unplayed: [], seen: {} };
    const stages = StageLogic.stages(state);
    const first = stages.findIndex(st => !!Spec.stageOn(st));
    const sides = StageLogic.sideStages(state);
    if((first < 1 && !sides.length) || !Number.isInteger(open)) return out;
    const conf = StageLogic.changesOf(state);
    const rec = StageLogic.changeRecord(state);
    const starts = inp.starts || {};
    const made = inp.copies || {};
    // Where a copy for change `c` plays from: its start once that's aired, else the change's or the first still open (or `floor`);
    // null while the maker's OK holds it, once it lapsed, or when it's skipped (each recorded in `out` when `record`).
    const startOf = (st, c, key, record, floor) => {
      const d = rec.decided[key];
      const had = made[key];
      if(d && d.do === 'skip'){ if(record) out.skipped.push({ key, stage: st.id, trigger: c }); return null; }
      if(had && Number.isInteger(had.from) && had.from < open) return had.from;
      if(conf.ok !== 'auto' && !(d && d.do === 'start') && !had){
        const seen = Number.isInteger(rec.seen[key]) ? rec.seen[key] : open;
        if(record && !Number.isInteger(rec.seen[key])) out.seen[key] = open;
        const until = Math.max(c.from, seen);
        if(open <= until){ if(record) out.pending.push({ key, stage: st.id, trigger: c, until }); return null; }
        if(conf.unanswered !== 'start'){ if(record) out.lapsed.push({ key, stage: st.id, trigger: c, until }); return null; }
      }
      return Math.max(c.from, open, Number.isInteger(floor) ? floor : 0);
    };
    if(first >= 1) StageLogic.chainPlan(inp, out, { stages, first, last, made, startOf });
    // A12 part 3: the side stages, once the game's first stage has started.
    const gameStart = stages.length && Number.isInteger(starts[stages[0].id]) ? starts[stages[0].id] : null;
    if(gameStart !== null) for(const st of sides) out.entries.push(...StageLogic.sidePlan(st, inp, out, { open, last, gameStart, made, startOf }));
    return out;
  }
  // A12 part 2's plan for the stages a format change starts (changePlan's), into `out`.
  static chainPlan(inp, out, { stages, first, last, made, startOf }){
    const starts = inp.starts || {};
    stages.slice(0, first).forEach(st => {
      const from = Number.isInteger(starts[st.id]) ? starts[st.id] : null;
      out.entries.push({ key: st.id, stage: st.id, copy: null, trigger: null, from, to: undefined });
    });
    // The stage right before: nothing starts on a change until it has (a phase start not known yet holds everything back).
    const base = out.entries[out.entries.length - 1];
    let after = base ? base.from : null;
    // A stage's copies after episode `after` (its outcomes recorded in `out` only when `record`: the look ahead doesn't).
    const copiesOf = (st, from0, record) => {
      const o = Spec.stageOn(st);
      const t = (inp.triggers && inp.triggers[st.id]) || { act: [], held: [] };
      const byFrom = new Map();
      (t.act || []).filter(c => Number.isInteger(c.from) && c.from > from0).sort((a, b) => a.from - b.from).forEach(c => { if(!byFrom.has(c.from)) byFrom.set(c.from, c); });
      let cands = [...byFrom.values()];
      if(record) (t.held || []).filter(c => Number.isInteger(c.from) && c.from > from0).forEach(c => out.held.push({ stage: st.id, trigger: c }));
      // Once: a copy already made stays the stage's (a change that turns sure later doesn't take its place).
      if(!o.again){
        const had = cands.find(c => made[StageLogic.copyKey(st.id, c.id)]);
        if(had) cands = [had];
      }
      const mine = [];
      for(const c of cands){
        const key = StageLogic.copyKey(st.id, c.id);
        const from = startOf(st, c, key, record);
        if(from === null) continue;
        if(last !== null && from > last){ if(record) out.late.push({ key, stage: st.id, trigger: c }); continue; }
        const prev = mine[mine.length - 1];
        if(prev && prev.from >= from){
          mine.pop();
          if(record) out.superseded.push({ key: prev.key, stage: st.id, trigger: prev.trigger, by: key });
        }
        if(mine.length >= Spec.MAX_COPIES){ if(record) out.capped.push({ key, stage: st.id, trigger: c }); continue; }
        mine.push({ key, stage: st.id, copy: 0, trigger: c, from, to: undefined });
        if(!o.again) break;
      }
      return mine;
    };
    const on = stages.slice(first).filter(st => !Spec.stageSide(st));
    const copies = [];
    for(let j = 0; j < on.length && after !== null; j++){
      let mine = copiesOf(on[j], after, true);
      if(!mine.length) break;
      // Until the next stage a change starts begins: a change of this stage's kinds after that is no longer this stage's.
      const next = on[j + 1] ? copiesOf(on[j + 1], mine[0].from, false)[0] : null;
      if(next) mine = mine.filter(x => x.from < next.from);
      mine.forEach((x, i) => { x.copy = i + 1; });
      copies.push(...mine);
      after = mine[0].from;
    }
    copies.forEach((x, i) => {
      const nx = copies[i + 1];
      const st = stages.find(s => s.id === x.stage);
      const own = st.game.span ? st.game.span.to : null;
      x.to = nx ? nx.from - 1 : own && typeof own === 'object' ? { ...own } : own;
    });
    if(base) base.to = copies.length ? copies[0].from - 1 : null;
    out.entries.push(...copies);
  }
  // A12 part 3: a side stage's copies (changePlan's): one for each grouping its triggers say lasted, in the order they open. Its end
  // never past the game's own (its own episode, else the game's once known: `inp.end`, a phase end settled).
  static sidePlan(st, inp, out, { open, last, gameStart, made, startOf }){
    const t = (inp.triggers && inp.triggers[st.id]) || { act: [], held: [] };
    (t.held || []).forEach(c => out.held.push({ stage: st.id, trigger: c }));
    const own = st.game.span ? st.game.span.to : null;
    const ends = [own, inp.end].filter(x => Number.isInteger(x));
    const ownEnd = ends.length ? Math.min(...ends) : null;
    const mine = [];
    for(const c of (t.act || []).filter(x => Number.isInteger(x.from)).sort((a, b) => a.from - b.from)){
      const key = StageLogic.copyKey(st.id, c.id);
      // Where it would play from (startOf's, before the maker is asked): past the season or the game's end, or its grouping changed
      // before then, it never plays, and nobody is asked about it.
      const had = made[key];
      const first = had && Number.isInteger(had.from) && had.from < open ? had.from : Math.max(c.from, open, gameStart);
      if((last !== null && first > last) || (ownEnd !== null && first > ownEnd)){ out.late.push({ key, stage: st.id, trigger: c }); continue; }
      let to = own && typeof own === 'object' ? { ...own } : own;
      if(ownEnd !== null && !(own && typeof own === 'object')) to = ownEnd;
      if(c.closes){
        const at = Math.max(c.closes.at, c.closes.episode);
        to = ownEnd !== null ? Math.min(at, ownEnd) : at;
        if(to < first){ out.unplayed.push({ key, stage: st.id, trigger: { ...c, episode: c.closes.episode } }); continue; }
      }
      const from = startOf(st, c, key, true, gameStart);
      if(from === null) continue;
      // Research isn't sure its grouping changed: it plays on, said.
      if(c.closing) out.held.push({ key, stage: st.id, trigger: { ...c, episode: c.closing.episode } });
      if(mine.length >= Spec.MAX_COPIES){ out.capped.push({ key, stage: st.id, trigger: c }); continue; }
      mine.push({ key, stage: st.id, copy: mine.length + 1, trigger: c, from, to, side: true });
    }
    return mine;
  }
  // Points for a place in a stage that's over: the overall's `places`, else one for each of `count` below it, plus one.
  static placePoints(o, place, count){
    if(!Number.isInteger(place) || place < 1) return 0;
    if(Array.isArray(o.places) && o.places.length) return Number(o.places[place - 1]) || 0;
    return Math.max(0, count - place + 1);
  }
  // The overall, a row for each seat playing the game's own season: { playerId, overall, points, placePoints, wins, stages: [{ key,
  // points, place, over }] }.
  static overall(state){
    const o = StageLogic.overallOf(state);
    const stands = StageLogic.standings(state);
    return (state.players || []).filter(p => !isGhost(p)).map(p => {
      let points = 0;
      let placePoints = 0;
      let wins = 0;
      const stages = stands.map(st => {
        const r = st.rows.find(x => x.playerId === p.id);
        if(!r) return { key: st.key, points: null, place: null, over: st.over };
        points += Number(r.points) || 0;
        if(st.over){
          placePoints += StageLogic.placePoints(o, r.place, st.rows.length);
          if(r.place === 1) wins += 1;
        }
        return { key: st.key, points: r.points, place: r.place, over: st.over };
      });
      const overall = o.by === 'places' ? roundPoints(placePoints) : o.by === 'wins' ? wins : roundPoints(points);
      return { playerId: p.id, overall, points: roundPoints(points), placePoints: roundPoints(placePoints), wins, stages };
    });
  }
  // Every stage is over, as far as this copy has seen.
  static over(state){ const st = StageLogic.standings(state); return st.length > 0 && st.every(x => x.over); }
  // The episode the game ends with once its last stage is over (where that stage ended: early, if it did), else null.
  static endsAt(state){
    if(!StageLogic.on(state)) return null;
    // A12 part 3: the game's own last stage (a side stage plays inside it).
    const st = StageLogic.standings(state).filter(x => !x.side);
    const last = st[st.length - 1];
    return last && last.over && Number.isInteger(last.to) ? last.to : null;
  }
  // Its first stage has started: the game's first episode has results, or has aired. Nobody new joins then (GhostLogic.allowed).
  static started(state){
    if(!StageLogic.on(state)) return false;
    const first = startEpisode(state);
    if(first === null) return false;
    if(SpoilerLogic.latestWithResults(state) >= first) return true;
    return hasAired((state.episodes || []).find(e => e.number === first));
  }
}

// ---------- RosterLogic: players, tribes, castaways, league settings ----------
class RosterLogic {
  // Both of these are EXCLUSIVE-ownership concepts and stay that way: in a shared-ownership league
  // nothing is ever removed from availability (every pick offers the full cast every time), so
  // there is no such thing as a free agent. Shared-mode draft/roster UI simply doesn't call these.
  static freeAgents(state){ const aside = ownersAside(state); return state.castaways.filter(c=>leagueOwnersOf(state, c, aside).length===0 && c.status==='active'); }
  static activeOwnedCount(state, playerId){ return state.castaways.filter(c=>ownerListOf(c).includes(playerId) && c.status==='active').length; }
  static totalCastCount(state){ return state.castaways.length; }

  // Joining after the draft has already fully concluded has no fair turn order to slot into, so
  // the new player starts inactive (no roster, excluded from draftOrder/scoring) until the
  // commissioner manually activates them via activatePlayer(). Joining before/during the draft
  // is unaffected -- they just fold into the normal snake order as always.
  // opts.automated: a computer player (src/lib/game/bot-logic.js), which makes its own moves until a
  // person takes the seat over.
  // A11 part 5c: once someone is out of the game (GhostLogic.someoneOut; `opts.someoneOut` when the caller read it as it stands: a
  // game of questions' walk isn't in its state), nobody new plays in it: the seat waits, inactive, as one after a finished draft does,
  // never playing from the start (a pool's or a game of questions' missed episodes would knock it out at once).
  static addPlayer(state, name, opts){
    const newPlayer = { id:Core.uid('p'), name, color: PALETTE[state.players.length % PALETTE.length], disabled:false, active:true };
    if(opts && opts.automated) newPlayer.automated = true;
    const turn = DraftLogic.currentTurn(state); // reflects players/draftOrder BEFORE this one is added
    const underway = GhostLogic.isUnderway(state);
    // A12 part 1: a game in stages whose first stage has started takes nobody new either (a code join, which nothing else gates,
    // waits inactive, as one once someone's out does).
    const out = (underway && (opts && typeof opts.someoneOut === 'boolean' ? opts.someoneOut : GhostLogic.someoneOut(state))) || StageLogic.started(state);
    const late = !newPlayer.automated && !out && GhostLogic.allowed(state) && underway;
    state.players.push(newPlayer);
    if(late){
      // A late joiner: invisible to the league, and they choose where to start (GhostLogic).
      newPlayer.ghost = true;
      newPlayer.lateJoin = { startEpisode: null, catchingUp: true };
    }else if((turn && turn.isComplete) || (out && !newPlayer.automated)){
      newPlayer.active = false;
    }else{
      state.draftOrder.push(newPlayer.id);
    }
    return newPlayer;
  }
  // Commissioner-only override for a player who joined after the draft concluded: directly
  // assigns chosen free agents (not a live snake pick -- there's no fair turn order left) and
  // marks the player active, folding them into draftOrder for future Replenish/Trade rounds.
  // A11 part 5c: under a price (a salary cap's, a stock market's cash), they pay what each costs now (player.joinPaid, which a
  // market's cash counts); whoever runs the game gives them, so the cap doesn't refuse it (the plan's Noticed).
  static activatePlayer(state, playerId, castawayIds){
    const p = Core.getPlayer(state, playerId);
    if(!p) return null;
    const prices = BudgetLogic.priced(state) ? PriceLogic.prices(state) : null;
    const given = [];
    (castawayIds||[]).forEach(cid=>{
      const c = Core.getCastaway(state, cid);
      if(c && leagueOwnersOf(state, c).length===0){ Core.setOwner(state, cid, playerId); c.acquiredVia = 'draft'; given.push(cid); }
    });
    if(prices && given.length) p.joinPaid = roundPoints((p.joinPaid || 0) + BudgetLogic.cost(given, prices));
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
  // Generic setter (the PATCH route passes whatever the UI sends). A field of the game (game-spec OWNED, and the waiver
  // suggestion) is a change to the game: written the way it always was on a copy (writeSetting), then checked and
  // written through setGame, so a change that would leave a game nobody can play is refused. Returns the problems it
  // was refused for ([] when it's written; game-spec specProblems' { at, problem }). Anything else (the show, the
  // season, what it reveals, setup) is the league's, written as it's given, with one normalized field:
  // revealedThroughEpisode decides what a league is allowed to SEE, so a junk value must not
  // quietly become a number that lets more through than the commissioner picked. See RevealLogic.
  static updateSettings(state, field, value){
    if(GAME_WRITES.has(field)) return RosterLogic.editSettings(state, s => writeSetting(s, field, value));
    if(field === 'revealedThroughEpisode') value = RevealLogic.normalize(value);
    // The teams a waiver suggestion is for (WaiverLogic.teamsFor): checked there, not part of the game.
    if(field === 'expectedTeams'){ WaiverLogic.updateSetting(state, field, value); return []; }
    state.settings[field]=value;
    return [];
  }

  // ---- Writing a league's game (docs/PLAN-start-a-game-gpt.md step A2) ----
  // Every write to a game setting comes here: setGame for a whole spec (Start a game, the GPT's games later), editSettings
  // for a change made the way the settings always were (updateSettings, a waiver suggestion). Either way the spec it
  // leaves is checked first (game-spec specProblems, as a league's own: what the league already plays stays as it is, and
  // the one set of size limits holds for what grows), and nothing is written when that finds a problem the league didn't
  // already have: the problems come back instead ([] when it's written). Then today's fields are written from the spec
  // (game-spec withSpec: only the parts that change), which classic still reads, and the league's settings.game while it
  // carries one (the game-specs flag). What a change does to the rest of the league happens here too: a draft changing
  // hands (every point still at the old ownership's default moves to the new one's; anything set by hand stays), a later
  // start (its episode is made, so picks and lineups have somewhere to go before it airs), and the waiver suggestion
  // still to be fitted at the draft (given up when the waivers change: withSpec).
  //
  //   opts.base   the settings to write onto (editSettings' copy, with its change made); default the league's
  //   opts.ctx    what the spec refers to, for the data-can-settle rule (game-spec specProblems' ctx)
  static setGame(state, spec, opts){
    const o = opts || {};
    const st = state.settings;
    const was = gameOf(state);
    const want = Spec.fullSpec(spec);
    const ctx = o.ctx || null;
    // The data-can-settle rule holds for every question (A4): a game's own questions are checked against what the show's
    // results can settle, so writing new or changed ones needs what the show is (ctx: its moments, whether it crowns a
    // winner). The presets' questions (a draft's finale predictions, the show's calls) are today's games.
    if(!ctx && ownQuestions(want) && !Spec.sameValue(want.ask, was.ask)){
      return [{ at: 'ask', problem: "A game's own questions are checked against what the show's results can settle: write them with the show's moments" }];
    }
    const had = new Set(Spec.specProblems(was, ctx, { league: true, was }).map(problemKey));
    const problems = Spec.specProblems(want, ctx, { league: true, was }).filter(p => !had.has(problemKey(p)));
    if(problems.length) return problems;
    // Only the game's own fields go through withSpec: the rest of the settings (the show and its rules, which can be
    // big) stay where they are.
    const base = o.base || st;
    const fields = {};
    GAME_FIELDS.forEach(k => { if(Object.prototype.hasOwnProperty.call(base, k)) fields[k] = base[k]; });
    let out = Spec.withSpec(fields, want);
    if(!out){
      // Nothing plays it, or it keeps a problem the league already had (an Outlast that never had a team size): a change
      // made the old way is written as it was made, as it always was; a whole spec isn't.
      const waits = Spec.specWaitsFor(want).map(w => ({ at: w.at, problem: w.problem }));
      if(!o.base || waits.length || !Spec.playsAs(want)) return waits.length ? waits : Spec.specProblems(want, ctx, { league: true, was });
      out = fields;
    }
    const ownBefore = st.ownershipMode === 'shared' ? 'shared' : 'exclusive';
    const ownAfter = out.ownershipMode === 'shared' ? 'shared' : 'exclusive';
    // The points the league stores (its spec's, or a copy a game that doesn't score by moments keeps), unless this
    // change set them itself.
    if(ownBefore !== ownAfter && out.eventPoints && Spec.sameValue(out.eventPoints, st.eventPoints)){
      const before = defaultEventPoints(state, ownBefore);
      const after = defaultEventPoints(state, ownAfter);
      const pts = { ...out.eventPoints };
      Object.keys(after).forEach(id => { if(pts[id] === undefined || pts[id] === before[id]) pts[id] = after[id]; });
      out.eventPoints = pts;
    }
    GAME_FIELDS.forEach(k => {
      if(Object.prototype.hasOwnProperty.call(out, k)) st[k] = out[k];
      else delete st[k];
    });
    RosterLogic.syncGame(state);
    const first = Spec.spanStart(want.span);
    if(first !== null && first !== Spec.spanStart(was.span)) EpisodeLogic.ensureEpisodeNumber(state, first, false);
    // A11 part 5: a game made in teams gets its draw's seed now (a league made outside a write's settle has one too), so the same
    // seats give the same teams from its first read.
    if(TeamLogic.on(state)) TeamLogic.seed(state);
    return [];
  }
  // Where a game that starts at a phase plays from (step A3: docs/PLAN-start-a-game-gpt.md, "The phase start, decided"),
  // written through setGame. `where.from`: the phase's first episode by the league's rulebook (rulebook-compile.js
  // phaseRanges: a start a person confirmed on the desk, or one the rulebook fixes), or null while that's unknown;
  // `where.open`: the first episode still open for moves (the one after the latest that's aired or has results). It plays
  // from the later of the two -- a phase confirmed once its first episode has aired starts with the next, so nobody is
  // scored on an episode they couldn't make moves for -- or waits again when the phase's start is cleared. Never once the
  // episode it plays from has aired. An end the new start passes goes (to the season's end), and so does any end when it
  // waits again: a game waiting for its phase has none (Start a game and Game settings set one only once it's settled), so it
  // can't be over before it starts. Returns setGame's problems ([] when it's written, or when there's nothing to change: a
  // game that starts at an episode, or one already right).
  //
  // A12 part 1: an end at a phase (span.to { phase }) settles the same way, from `where.end` (that phase's first episode, or
  // null): the game's last episode is the one before where a game starting at that phase would play from, so a stage that ends
  // before a phase and the next that starts at it always meet. It never moves once the episode after it has aired (the next stage
  // has started), waits again (runs on) when the phase's start is cleared, and is never before its own start (a game whose end's
  // phase came first never plays: its last episode the one before its first). An end at a phase stays when the start waits again.
  static settleStart(state, where){
    const game = gameOf(state);
    const open = Number(where && where.open);
    if(!Number.isInteger(open) || open < 1) return [];
    const span = { ...game.span };
    const phase = Spec.spanPhase(span);
    if(phase){
      const at = Spec.spanStart(span);
      const known = where && Number.isInteger(where.from) && where.from >= 1 ? where.from : null;
      const want = known === null ? null : Math.max(known, open);
      if(!(at !== null && at < open) && want !== at){
        span.from = want === null ? { phase } : { phase, at: want };
        if(!Spec.spanEndPhase(span) && (want === null || (span.to !== null && span.to < want))) span.to = null;
      }
    }
    const endPhase = Spec.spanEndPhase(span);
    if(endPhase){
      const last = Spec.spanEnd(span);
      const known = where && Number.isInteger(where.end) && where.end >= 1 ? where.end : null;
      const first = Spec.spanStart(span);
      let want = known === null ? null : Math.max(known, open) - 1;
      if(want !== null && first !== null && want < first - 1) want = first - 1;
      if(want !== null && want < 1) want = null;
      if(!(last !== null && last + 1 < open) && want !== last) span.to = want === null ? { phase: endPhase } : { phase: endPhase, at: want };
    }
    if(Spec.sameValue(span, game.span)) return [];
    return RosterLogic.setGame(state, { ...game, span });
  }
  // A12 part 1: a draft that opens at its game's start (DraftLogic.waits) drafts from who's still in then, so whether an exclusive
  // one covers every pick is counted as it opens (the 9:10 PM decision: shared whenever the math says so, counted where the game
  // drafts and as the pool shrinks): when the seats in its rotation times the picks each are more than who's still in, it's
  // played shared from then on (a snake becomes a private draft revealed at once, a draw deals each seat from its own hat; an
  // auction stays as it is and fills what it can, its own fallback; waivers go where a shared draft has none). Once, before anyone
  // is on a team, written through setGame. What it did ({ was, pool, teams, each }) for whoever runs the game to be told, or null.
  static settleDraftShare(state){
    const g = gameOf(state);
    if(g.get.by !== 'draft' || g.get.own !== 'exclusive' || g.get.order === 'auction' || !g.extras.draft || g.extras.draft.opens !== 'start') return null;
    if(DraftLogic.waits(state) || DraftLogic.begun(state)) return null;
    const pool = (state.castaways || []).filter(c => c.status === 'active').length;
    const teams = (state.players || []).filter(inLeagueRotation).length;
    const each = g.get.each;
    if(!teams || Spec.covers({ pool, people: teams, each })) return null;
    const next = { ...g, get: { ...g.get, own: 'shared', order: g.get.order === 'draw' ? 'draw' : 'blind' } };
    if(!Spec.waiversFit(next)) next.extras = { ...g.extras, waivers: null };
    if(RosterLogic.setGame(state, next).length) return null;
    return { was: g.get.order, pool, teams, each };
  }
  // A game that asks by phase (A7, AnswerLogic.byPhase) records what it needs of the season's phases, as a start at a phase
  // does (settleStart): `where` { phases: [{ id, from }] in order (the rulebook it plays by: phase-starts.ts), open: the first
  // episode still open for moves }.
  //   state.phaseStarts  { phaseId: the episode it starts } for each start known (the grader counts one only once the viewer has
  //                      seen it: AnswerLogic.facts)
  //   state.phaseWindows { phaseId: the episode its window opens at }, for each later phase that starts inside the game: where it
  //                      starts, or the first episode still open when that's only known once it's begun (an answer is never
  //                      given after what it's about has aired). One that's opened (this week's, or past) never moves, and
  //                      keeps its start, so answers given for it are always graded.
  // Whether anything changed.
  // A draft whose points multiply in a phase (A9 part 2: score.times) records the starts alone (ActiveRosterLogic.timesFor reads
  // them), and so does a pool whose buyback lasts until a phase (A10 part 2: PickEmLogic.canBuyBack); only questions have windows.
  static settlePhases(state, where){
    if(!readsPhases(state)) return false;
    const list = (where && Array.isArray(where.phases) ? where.phases : []).filter(p => p && typeof p.id === 'string');
    const open = Number(where && where.open);
    const starts = {};
    list.forEach(p => { if(Number.isInteger(p.from) && p.from >= 1) starts[p.id] = p.from; });
    const first = startEpisode(state);
    const last = endEpisode(state);
    const was = state.phaseWindows || {};
    const windows = {};
    if(AnswerLogic.byPhase(state)) list.forEach((p, i) => {
      const had = was[p.id];
      // Opened (this week's, or past): it stays where it is, answers and all, and so does the start it opened for.
      if(Number.isInteger(had) && Number.isInteger(open) && had <= open){
        windows[p.id] = had;
        if(!Number.isInteger(starts[p.id]) && state.phaseStarts && Number.isInteger(state.phaseStarts[p.id])) starts[p.id] = state.phaseStarts[p.id];
        return;
      }
      const from = starts[p.id];
      if(i === 0 || !Number.isInteger(from) || first === null || from <= first) return;
      const at = Math.max(from, Number.isInteger(open) ? open : from);
      if(last === null || at <= last) windows[p.id] = at;
    });
    const changed = !Spec.sameValue(starts, state.phaseStarts || {}) || !Spec.sameValue(windows, was);
    state.phaseStarts = starts;
    state.phaseWindows = windows;
    return changed;
  }
  // A change made the way the settings always were: `fn(copy)` changes a copy of the league (its settings a copy, without
  // the spec it carries, so everything reads the change), and what the copy's settings then play is written through
  // setGame. What it changed outside the game (the teams a suggestion is for, ...) is written as it was made. Returns
  // setGame's problems ([] when it's written).
  static editSettings(state, fn, opts){
    const settings = state.settings;
    const copy = { ...state, settings: { ...settings } };
    delete copy.settings.game;
    fn(copy);
    const after = copy.settings;
    const problems = RosterLogic.setGame(state, Spec.specOf(after), { ...opts, base: after });
    if(problems.length) return problems;
    Object.keys(after).forEach(k => { if(!GAME_FIELD_SET.has(k) && after[k] !== settings[k]) settings[k] = after[k]; });
    Object.keys(settings).forEach(k => { if(!GAME_FIELD_SET.has(k) && k !== 'game' && !(k in after)) delete settings[k]; });
    return [];
  }
  // A league that carries its spec (settings.game: the game-specs flag) carries the one its fields play, after they were
  // written some other way (an Undo putting fields back as they were, setGame's ownership change). Nothing when it
  // carries none.
  static syncGame(state){
    const st = state && state.settings;
    if(st && st.game !== undefined) st.game = Spec.specOf(st);
  }
}

// Whether a game reads the season's phase starts, so the settle passes record them (RosterLogic.settlePhases: phase-starts.ts,
// the season sync, Start a game, the lab): it asks by phase (A7, AnswerLogic.byPhase), or its points multiply in a phase (A9
// part 2, score.times).
function readsPhases(state){
  if(AnswerLogic.byPhase(state)) return true;
  const score = gameOf(state).score;
  // A pool's buyback until a phase starts (A10 part 2: PickEmLogic.canBuyBack).
  if(score.by === 'survive' && score.buyback && score.buyback.before && typeof score.buyback.before.phase === 'string') return true;
  // A draft that cuts players before a phase starts (A11 part 1: KnockoutLogic).
  const rank = gameOf(state).rank;
  if(Array.isArray(rank.cut) && rank.cut.some(c => c && c.at && typeof c.at.phase === 'string')) return true;
  return score.by === 'moments' && Array.isArray(score.times) && score.times.some(t => t && typeof t.phase === 'string');
}

// A game's own questions (A4): any but the presets' (a draft's finale predictions, Weekly Calls' calls).
function ownQuestions(spec){
  const ask = Array.isArray(spec.ask) ? spec.ask : [];
  return ask.length > 0 && !Spec.callsAsk(ask) && !(spec.get && spec.get.by === 'draft' && Spec.finaleOf(ask));
}

// The settings fields a game is made of (game-spec OWNED) and the waiver suggestion's mark (waiverFit, which withSpec
// takes away when the waivers change): what setGame writes. GAME_WRITES: what updateSettings writes through it.
const GAME_FIELDS = [...Spec.OWNED, 'waiverFit'];
const GAME_FIELD_SET = new Set(GAME_FIELDS);
const GAME_WRITES = new Set([...Spec.OWNED, 'waiverRecommendation']);
const problemKey = p => p.at + '|' + p.problem;

// One settings field written the way it always was (whatever the UI sends): each field's own normalizing, and what
// moves with it. Only on editSettings' copy: what the change means for the game is then checked and written by setGame
// (which also moves a draft's points when its ownership changes, and makes a later start's episode).
function writeSetting(state, field, value){
  if(field === 'allowLateJoiners') value = value !== false;
  if(field === 'lockedDown') value = value === true;
  // Who can join (step 9): open, ask or locked. Classic's late-joiner switch follows it, so a game nobody new may
  // join is closed in classic too (its join code gives an inactive seat).
  if(field === 'joinMode'){
    value = value === 'open' || value === 'ask' || value === 'locked' ? value : GhostLogic.recommendedJoinMode(state);
    state.settings.allowLateJoiners = value !== 'locked';
  }
  // Waiver settings, new and pre-v2, are checked and kept in step there.
  if(WaiverLogic.updateSetting(state, field, value)) return;
  if(field === 'eventPoints' && value && typeof value === 'object'){
    const clean = {};
    Object.keys(value).forEach(id => {
      const n = Number(value[id]);
      clean[id] = Number.isFinite(n) ? roundPoints(n) : 0;
    });
    value = clean;
  }
  if(field === 'defaultBetPoints') value = clampBetPoints(value);
  // The turn-based draft's pick timer (seconds: off, 2 minutes or 60 seconds) and what happens when it runs out
  // (wait for them, or pick from their queue). Casual first: off and wait.
  if(field === 'draftTimer') value = Spec.DRAFT_TIMERS.includes(Number(value)) ? Number(value) : 0;
  if(field === 'draftAway') value = value === 'queue' ? 'queue' : 'wait';
  // Where it starts: an episode (a phase start it had goes), or a phase of the season's rulebook (startPhase: it waits for
  // that phase until RosterLogic.settleStart says where it plays from, with no end until then; an empty phase starts it at
  // Episode 1).
  if(field === 'startEpisode'){
    const n = Math.floor(Number(value));
    value = Number.isFinite(n) && n >= 1 ? n : 1;
    delete state.settings.startPhase;
  }
  if(field === 'startPhase'){
    if(typeof value !== 'string' || !value){
      delete state.settings.startPhase;
      state.settings.startEpisode = 1;
      return;
    }
    state.settings.startEpisode = null;
    state.settings.endEpisode = null;
  }
  // A span's last episode (endEpisode): a whole number, else none (to the season's end).
  if(field === 'endEpisode'){
    const n = Math.floor(Number(value));
    value = value !== null && value !== '' && Number.isFinite(n) && n >= 1 ? n : null;
  }
  state.settings[field]=value;
  // Active Roster defaults to shared ownership: nobody gets shut out of a castaway they wanted, and
  // lineups (not exclusivity) are where the skill is. Only while the league is still in guided
  // setup -- an established league never has its ownership changed under it -- and the commissioner
  // can still pick exclusive in the next setup step. (setGame moves its points with it.)
  if(field === 'leagueTypeId' && value === 'active-roster' && !SetupLogic.isComplete(state) && state.settings.ownershipMode !== 'shared'){
    state.settings.ownershipMode = 'shared';
  }
}

// ---------- MidSeasonLogic: who may add whom, and in what order ----------
// The moves waivers (WaiverLogic) are made of: pickups and add/drops.
//
// WHO IS AVAILABLE. Exclusive ownership: anyone still in the game that nobody owns (a free agent).
// Shared ownership has no free agents -- nobody is ever taken off the board -- so there it's anyone
// still in the game who isn't already on THIS player's roster. Same moves, one rule per mode.
//
// WAIVER ORDER (settings.replenishOrderBy):
//   'rolling'     -- the default. Starts in reverse draft order; whoever's claim goes through goes to
//                    the back, and the list carries over from week to week (being patient keeps you
//                    near the front). WaiverLogic.process writes it.
//   'leastPoints' -- standings, fewest points first, recomputed every week (a catch-up reset).
//   'mostPoints'  -- standings, most points first (the old default; rewards a strong draft).
// Order only decides anything when two players want the same castaway, which happens in exclusive
// leagues. In a shared league everyone can add the same person, so it just orders the run.
// The castaway fields a pickup or add/drop overwrites (MidSeasonLogic.applyPickup/applyAddDrop), kept
// on its log entry as they were -- only the keys the castaway had, so undoing it puts back exactly what
// was there: a key it didn't have is removed again, even after the state's trip through JSON.
const ADDED_KEYS = ['acquiredVia'];
const DROPPED_KEYS = ['replenishClaimed', 'formerOwnerId', 'departedVia'];
function fieldsOf(c, keys){
  const out = {};
  keys.forEach(k => { if(Object.prototype.hasOwnProperty.call(c, k)) out[k] = c[k]; });
  return out;
}
function restoreFields(c, was, keys){
  keys.forEach(k => { if(was && Object.prototype.hasOwnProperty.call(was, k)) c[k] = was[k]; else delete c[k]; });
}
class MidSeasonLogic {
  static isShared(state){ return ownershipModeOf(state) === 'shared'; }
  static availableFor(state, playerId){
    const aside = MidSeasonLogic.isShared(state) ? null : ownersAside(state);
    return state.castaways.filter(c => c.status === 'active' && (MidSeasonLogic.isShared(state)
      ? !ownerListOf(c).includes(playerId)
      : leagueOwnersOf(state, c, aside).length === 0));
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
    const mode = WaiverLogic.waivers(state).order;
    if(mode === 'rolling'){
      const list = MidSeasonLogic.priorityList(state);
      return [...playerIds].sort((a,b) => list.indexOf(a) - list.indexOf(b));
    }
    // By the game's own standings (rankKey: its points, or a stock market's worth: A10 part 3c).
    const scores = ScoringLogic.compute(state);
    const keyOf = id => rankKey(state, scores.find(s => s.playerId === id) || { total: 0 });
    const dir = mode === 'leastPoints' ? 1 : -1;
    const tiebreak = MidSeasonLogic.reverseDraftOrder(state);
    return [...playerIds].sort((a,b) => dir * PickEmScoringStrategy.compareKeys(keyOf(a), keyOf(b)) || tiebreak.indexOf(a) - tiebreak.indexOf(b));
  }
  // ---- Active Roster's replenish threshold ----
  // The spec's waivers.short (settings.replenishAt): a roster down to this many castaways still in the game may replenish
  // back up to one more than it (default: one fewer than the active slots, i.e. the moment you can no longer field a full
  // lineup -- replenish keeps everyone playing, it doesn't rebuild a bench). One definition: WaiverLogic.shortAt.
  static replenishAt(state){ return WaiverLogic.shortAt(state); }
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

  // ---- The add/drop schedule ----
  // An add/drop week comes after every Nth episode the league plays (default 3): the spec's waiver windows (every
  // episode is 1); a league with no waivers reads the pre-v2 switch it stored (settings.swapEvery).
  // Weekly is too often: it turns the league into chasing whoever won immunity last week, and makes
  // the draft matter less. Every three episodes is four or five windows in a normal season -- enough
  // to fix a bad pick or react to the merge.
  static swapEvery(state){
    const w = gameOf(state).extras.waivers;
    if(w) return w.windows.schedule === 'everyEpisode' ? 1 : w.windows.every;
    return Spec.swapEveryOf(state.settings || {});
  }
  // ---- The moves themselves, written in one place ----
  // A pickup: the free agent joins, and the loss it replaces leaves this player's roster (its points
  // stop counting; formerOwnerId/departedVia keep the history for the Scoreboard). An add/drop: one
  // still in the game leaves (their points go with them), a free agent joins. Each appends one
  // MidSeasonLogEntry, with `prev` -- the castaway fields it overwrote -- so revert() can undo it
  // exactly. `extra` lands on the entry too (waivers' via/periodId/episode/at). Callers validate first.
  static applyPickup(state, playerId, addId, lossId, extra){
    const add = Core.getCastaway(state, addId);
    const lost = lossId ? Core.getCastaway(state, lossId) : null;
    const shared = MidSeasonLogic.isShared(state);
    const prev = { added: fieldsOf(add, ADDED_KEYS), dropped: lost ? fieldsOf(lost, DROPPED_KEYS) : null };
    if(shared) Core.addOwner(state, addId, playerId);
    else Core.setOwner(state, addId, playerId);
    add.acquiredVia = 'replenish';
    if(lost){
      lost.replenishClaimed = true;
      // formerOwnerId stays a single id (history display only, not scoring).
      lost.formerOwnerId = playerId;
      lost.departedVia = 'replenish';
      // Shared: only this player lets go; anyone else who owns them keeps them.
      if(shared) Core.removeOwner(state, lost.id, playerId);
      else Core.setOwner(state, lost.id, null);
    }
    return MidSeasonLogic.log(state, { type:'replenish', playerId, addedCastawayId: addId, droppedCastawayId: lost ? lost.id : null, prev, ...extra });
  }
  static applyAddDrop(state, playerId, dropId, addId, extra){
    const drop = Core.getCastaway(state, dropId), add = Core.getCastaway(state, addId);
    const prev = { added: fieldsOf(add, ADDED_KEYS), dropped: fieldsOf(drop, DROPPED_KEYS) };
    drop.formerOwnerId = playerId;
    drop.departedVia = 'trade';
    Core.removeOwner(state, dropId, playerId);
    if(MidSeasonLogic.isShared(state)) Core.addOwner(state, addId, playerId);
    else Core.setOwner(state, addId, playerId);
    add.acquiredVia = 'trade';
    return MidSeasonLogic.log(state, { type:'trade', playerId, addedCastawayId: addId, droppedCastawayId: dropId, prev, ...extra });
  }
  static log(state, entry){
    // `|| []`: league rows are read from Postgres without migrateLeagueState, so a league that
    // predates the log (and 0008's backfill) has no array to push onto yet.
    const tx = { id: Core.uid('tx'), at: new Date().toISOString(), episode: lastCompletedEpisode(state), ...entry };
    // A10 part 3c: a stock market's move records what it sold for and paid, at today's prices, and its fee (MarketLogic.cash
    // reads them; a caller that read the prices once a pass passes them in `entry`).
    if(tx.paid === undefined && MarketLogic.on(state)) Object.assign(tx, MarketLogic.terms(state, tx.droppedCastawayId, tx.addedCastawayId));
    (state.midSeason.log = state.midSeason.log || []).push(tx);
    return tx;
  }
  // Undoes one logged move (several: newest first). Used by Undo last waiver run and by the spoiler
  // views, which take back moves from episodes the viewer hasn't seen. Entries from before `prev` was
  // recorded get their ownership back and lose the departure marks the move made.
  static revert(state, tx){
    const added = Core.getCastaway(state, tx.addedCastawayId);
    if(added){
      Core.removeOwner(state, added.id, tx.playerId);
      if(tx.prev) restoreFields(added, tx.prev.added, ADDED_KEYS);
    }
    const dropped = tx.droppedCastawayId ? Core.getCastaway(state, tx.droppedCastawayId) : null;
    if(dropped){
      Core.addOwner(state, dropped.id, tx.playerId);
      const was = tx.prev && tx.prev.dropped;
      if(was) restoreFields(dropped, was, DROPPED_KEYS);
      else {
        if(tx.type === 'replenish') dropped.replenishClaimed = false;
        dropped.formerOwnerId = null;
        dropped.departedVia = null;
      }
    }
  }
}

// ---------- WaiverLogic: mid-season moves as waivers (docs/PLAN-midseason-waivers.md, PLAN-waivers-v2.md) ----------
// Private, ranked claims made while waivers are open, all processed at once in waiver order, then free
// agency -- first come, first served -- until the next episode airs. Replaced the live one-at-a-time
// Pickups and Swap rounds (2026-10-16).
//
// A claim is ranked pairs, "add X, drop Y" (v2). Dropping someone out of the game REPLACES them;
// dropping someone still in SWAPS them. Three settings say when each may happen:
//   replaceRule   -- 'always' (after any episode), 'whenShort' (after any episode, only back up to
//                    replenishAt + 1 still in), 'windows' (only when a waiver window opens), 'never'.
//   waiverWindows -- { schedule: 'everyEpisode' | 'every' | 'manual', every, swaps }: when windows open
//                    on their own (manual: only when the commissioner opens one) and how many swaps
//                    each allows (0 = replacements only).
//   autoFill      -- replacements still owed at airtime are filled automatically (default on).
// recommend() works out good values for all of them from the league's shape; waiverFeel (Casual ·
// Balanced · Competitive) moves that recommendation a step. Leagues from before v2 read their old
// switches (replenishEnabled, tradeEnabled, swapEvery) through the game spec (legacyWaivers) until backfilled; both
// sets are kept in step for one release (mirrorLegacy), and the pre-v2 claim shape
// { pickupIds, dropId, addIds } is still accepted and turned into pairs (pairsOf).
//
// The CLAIMS never enter `state`: they're private, and state is returned wholesale by every route (the
// reasoning is db/migrations/0060's, the same as blind draft's). So process() takes them as an argument,
// and the server (src/lib/server/waivers.js) reads them from waiver_claims. What state holds is public:
// each waiver week (midSeason.waivers.periods), who has claims in, and once processed, every outcome
// and why.
//
// The clock is passed in (`now`, ms). due() says which step is waiting -- open, process, close or
// cancel -- and the server runs it under the league lock, lazily, on any write or load.
const HOUR_MS = 3600 * 1000;
// The vocabularies are the game spec's (one definition). REPLACE_RULES is most generous first: Casual moves one step
// left, Competitive (and Classic) one step right.
const { REPLACE_RULES, WAIVER_FEELS } = Spec;
// A sanity limit on one claim's pairs (the real limit is on distinct adds, checkClaim).
const MAX_CLAIM_PAIRS = 60;
// FNV-1a scaled to [0, 1): the "random" free agent an unfilled pickup gets, fixed per week and player
// so processing the same state twice can never give two answers.
function hashUnit(text){
  let h = 0x811c9dc5;
  for(let i = 0; i < text.length; i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 0x100000000;
}
const isId = v => typeof v === 'string' && !!v;
const uniqIds = v => Array.isArray(v) ? [...new Set(v.filter(isId))] : [];
const hasKey = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
class WaiverLogic {
  // ---- The league's settings ----
  /** The game has mid-season moves at all (a draft's, but never a shared Outlast's: game-spec waiversFit). */
  static supported(state){
    const t = piecesOf(state);
    return !!(t.supportsReplenish || t.supportsTrade);
  }
  static normalizeWindows(state, w){ return Spec.normalizeWindows(rosterSize(state), w); }
  // The league's waivers as the spec says them (extras.waivers: { feel, replace, short, windows, order, hours,
  // freeAgency, autoFill }); a league from before waivers v2 reads what its old switches meant (game-spec legacyWaivers:
  // add/drops off means no swaps at all, so a league with both switches off stays off), which the backfill
  // (migrateLeagueState, db/migrations/0063) writes. A game with none (no draft, or a shared Outlast) reads what its
  // settings store, as the spec would for a draft: nothing plays it, but the waiver screens and writes still start from it.
  static waivers(state){
    return gameOf(state).extras.waivers || Spec.waiversOf(state.settings || {}, !!piecesOf(state).hasActiveRoster, rosterSize(state));
  }
  static config(state){
    const w = WaiverLogic.waivers(state);
    // Classic has no lineup to be short of: "only when short" (N = roster - 1) is replace-every-loss (the spec says so).
    return { replaceRule: w.replace, waiverWindows: w.windows, waiverFeel: w.feel, autoFill: w.autoFill };
  }
  static replaceRule(state){ return WaiverLogic.supported(state) ? WaiverLogic.config(state).replaceRule : 'never'; }
  static windows(state){ return WaiverLogic.supported(state) ? WaiverLogic.config(state).waiverWindows : { schedule: 'manual', every: 3, swaps: 0 }; }
  static autoFillOn(state){ return WaiverLogic.config(state).autoFill; }
  /** Replacements happen after every episode (always/whenShort), so a week runs after every episode. */
  static weekly(state){ const r = WaiverLogic.replaceRule(state); return r === 'always' || r === 'whenShort'; }
  // Waivers are on unless nothing could ever happen: no replacements and no swaps. A window the
  // commissioner opens anyway keeps them on while it runs.
  static enabled(state){
    if(!WaiverLogic.supported(state)) return false;
    if(WaiverLogic.replaceRule(state) !== 'never' || WaiverLogic.windows(state).swaps > 0) return true;
    const cur = WaiverLogic.current(state);
    return !!(cur && cur.openedBy === 'commissioner');
  }
  static processHours(state){ return WaiverLogic.waivers(state).hours; }
  static freeAgencyOn(state){ return WaiverLogic.waivers(state).freeAgency; }
  static rolling(state){ return WaiverLogic.waivers(state).order === 'rolling'; }
  /** whenShort's N: replace once down to this many still in (the spec's waivers.short; default: starting spots - 1;
   *  Classic: roster - 1). */
  static shortAt(state){
    const short = WaiverLogic.waivers(state).short;
    if(Number.isInteger(short)) return short;
    const R = rosterSize(state) || 0;
    const S = piecesOf(state).hasActiveRoster ? ActiveRosterLogic.activeSlots(state) : R;
    return Math.max(0, S - 1);
  }

  // Writes the v2 keys a league doesn't have yet from what its old switches meant, and marks its weeks'
  // windows. Idempotent. migrateLeagueState runs it; db/migrations/0063 did the same to stored leagues.
  static backfill(state){
    const st = state.settings;
    if(!st) return;
    const c = WaiverLogic.config(state);
    if(!REPLACE_RULES.includes(st.replaceRule)) st.replaceRule = c.replaceRule;
    if(!st.waiverWindows || typeof st.waiverWindows !== 'object') st.waiverWindows = c.waiverWindows;
    if(!WAIVER_FEELS.includes(st.waiverFeel)) st.waiverFeel = 'balanced';
    if(typeof st.autoFill !== 'boolean') st.autoFill = true;
    WaiverLogic.periods(state).forEach(p => {
      if(typeof p.window !== 'boolean') p.window = !!p.addDrop;
      if(typeof p.swaps !== 'number') p.swaps = p.addDrop ? 1 : 0;
    });
  }
  // The pre-v2 switches, kept in step with the v2 settings for one release: anything still reading them
  // (the phase-2 screens, db/waivers.js's league query) sees what the league really does.
  static mirrorLegacy(state){
    const st = state.settings;
    const c = WaiverLogic.config(state);
    st.replenishEnabled = c.replaceRule !== 'never';
    st.tradeEnabled = c.waiverWindows.schedule !== 'manual' && c.waiverWindows.swaps > 0;
    st.swapEvery = c.waiverWindows.schedule === 'everyEpisode' ? 1 : c.waiverWindows.every;
  }
  // RosterLogic.updateSettings hands every waiver setting here; true when it was one. The v2 keys are
  // checked and stored; the pre-v2 switches (still sent by the phase-2 settings screen) move the v2
  // setting they map to. 'waiverRecommendation' applies recommend() for the feel it's given.
  static updateSetting(state, field, value){
    const st = state.settings;
    const c = WaiverLogic.config(state);
    const w = c.waiverWindows;
    // A setting changed by hand: the league is no longer on a suggestion to re-fit when the draft starts.
    if(['replaceRule', 'waiverWindows', 'autoFill', 'replenishAt', 'waiverProcessHours', 'replenishOrderBy', 'freeAgencyEnabled',
      'replenishEnabled', 'tradeEnabled', 'swapEvery'].includes(field)) delete st.waiverFit;
    switch(field){
      case 'replaceRule':
        if(!REPLACE_RULES.includes(value)) return true;
        st.replaceRule = value === 'whenShort' && !piecesOf(state).hasActiveRoster ? 'always' : value;
        break;
      case 'expectedTeams': {
        const n = Math.floor(Number(value));
        if(Number.isFinite(n) && n >= 1 && n <= 30) st.expectedTeams = n;
        return true;
      }
      case 'waiverWindows':
        st.waiverWindows = WaiverLogic.normalizeWindows(state, { ...w, ...(value && typeof value === 'object' ? value : {}) });
        break;
      case 'waiverFeel':
        if(!WAIVER_FEELS.includes(value)) return true;
        st.waiverFeel = value;
        break;
      case 'autoFill':
        st.autoFill = value !== false;
        break;
      case 'waiverRecommendation':
        WaiverLogic.applyRecommendation(state, WAIVER_FEELS.includes(value) ? value : c.waiverFeel);
        return true;
      case 'replenishEnabled':
        st.replaceRule = value === true
          ? (c.replaceRule !== 'never' ? c.replaceRule : (piecesOf(state).hasActiveRoster ? 'whenShort' : 'always'))
          : 'never';
        break;
      case 'tradeEnabled':
        st.waiverWindows = value === true
          ? { schedule: w.schedule !== 'manual' ? w.schedule : (st.swapEvery === 1 ? 'everyEpisode' : 'every'), every: w.every, swaps: Math.max(1, w.swaps) }
          : { ...w, schedule: 'manual', swaps: 0 };
        break;
      case 'swapEvery': {
        const n = Math.floor(Number(value));
        if(!(n >= 1)) return true;
        st.waiverWindows = { ...w, every: Math.max(2, n), schedule: w.schedule === 'manual' ? 'manual' : (n === 1 ? 'everyEpisode' : 'every') };
        break;
      }
      default:
        return false;
    }
    WaiverLogic.mirrorLegacy(state);
    return true;
  }

  // ---- The recommendation (PLAN-waivers-v2.md "Defaults") ----
  // Pure. { C: cast size, T: teams, R: roster size, S: starting spots (Classic: R), E: episodes, start,
  // shared, scores: the game's score.by ('place': Outlast, 'moments': a lineup), feel, market }. null where there are
  // no waivers (a pool, shared Classic); { feasible: false, need, have } when the teams can't be drafted from the cast;
  // else { feasible: true, s, freeAgents, settings } with settings ready to write onto the league.
  // The thresholds (0.3, 1, the clamp) are first guesses: tune after a season.
  static recommend(input){
    const o = input || {};
    // Step R1: by how the game scores, never a league type: the boot order (Outlast) or moments (a lineup).
    const outlast = o.scores === 'place', lineup = o.scores === 'moments', shared = !!o.shared;
    const C = Number(o.C), T = Number(o.T), R = Number(o.R);
    if(!outlast && !lineup) return null;
    if(outlast && shared) return null;
    if(!(C > 0 && T > 0 && R > 0)) return null;
    const S = lineup ? Number(o.S) || R : R;
    const E = Number(o.E) || 13;
    const feel = WAIVER_FEELS.includes(o.feel) ? o.feel : 'balanced';
    // Feasibility: exclusive teams all come out of one cast, and an exclusive Active Roster league needs
    // a free agent per team even with every lineup full.
    if(shared ? R > C : T * R > C) return { feasible: false, need: shared ? R : T * R, have: C };
    if(lineup && !shared && T * S > C - T) return { feasible: false, need: T * (S + 1), have: C };

    // Free agents per drafted spot, with about half of everyone gone by the merge.
    const s = C / (T * R) - 1;
    const step = (r, d, ladder) => ladder[Math.min(ladder.length - 1, Math.max(0, ladder.indexOf(r) + d))];
    let rule = shared ? 'whenShort' : s >= 1 ? 'always' : s >= 0.3 ? 'whenShort' : s > 0 ? 'windows' : 'never';
    // Classic: one step stricter (its scoring is about outlasting), on a ladder without "only when
    // short", which for Classic is replace-every-loss (config()).
    const ladder = outlast ? ['always', 'windows', 'never'] : REPLACE_RULES;
    if(outlast){ rule = step(rule, 1, REPLACE_RULES); if(rule === 'whenShort') rule = 'always'; }
    if(feel === 'casual') rule = step(rule, -1, ladder);
    if(feel === 'competitive') rule = step(rule, 1, ladder);

    let waiverWindows;
    if(!shared && s <= 0) waiverWindows = { schedule: 'manual', every: 3, swaps: 0 };
    // Classic: the commissioner opens windows (the sheet suggests the whole team: a rebuild after the merge).
    else if(outlast) waiverWindows = { schedule: 'manual', every: 3, swaps: R };
    else {
      // Every X episodes, X = how often a typical team loses someone.
      const r = Math.max(0.1, (C - 3) / Math.max(1, E - 1));
      let X = Math.min(4, Math.max(2, Math.round(C / (R * r))));
      if(feel === 'casual') X += 1;
      if(feel === 'competitive') X -= 1;
      waiverWindows = X <= 1 ? { schedule: 'everyEpisode', every: 2, swaps: 1 } : { schedule: 'every', every: X, swaps: 1 };
    }
    // A10 part 3c: a stock market trades: a window after every episode, the whole team each, and someone gone home sold and
    // replaced whenever, whatever the feel (game-spec marketWaivers).
    if(o.market){
      rule = 'always';
      waiverWindows = { schedule: 'everyEpisode', every: 3, swaps: R };
    }
    const waiverProcessHours = feel === 'casual' ? 48 : feel === 'competitive' ? (T <= 4 ? 12 : 24) : (T > 6 ? 48 : 24);
    return {
      feasible: true, s, freeAgents: shared ? null : C - T * R,
      settings: {
        replaceRule: rule, replenishAt: Math.max(0, S - 1), waiverWindows, waiverProcessHours,
        // Simple waivers (docs/PLAN-new-design.md step 6a): lowest score picks first whatever the feel, and forgetting
        // to pick gets you the most points left (the fallback) except in Competitive, where the spot stays empty.
        // Leagues already running keep what they have until their commissioner picks a feel.
        replenishOrderBy: 'leastPoints', freeAgencyEnabled: true,
        autoFill: feel !== 'competitive', waiverFeel: feel,
      },
    };
  }
  // recommend() for a league as it stands. The cast is everyone still in at the league's first episode;
  // `episodes` (the season's episode count, which only the catalog knows) defaults to the schedule's
  // length, at least 13.
  // Teams the recommendation is for: everyone in waivers once the draft has started; before then, the
  // count the commissioner gave when creating the league (settings.expectedTeams), while fewer have joined.
  static teamsFor(state, opts){
    if(opts && opts.teams > 0) return opts.teams;
    const n = WaiverLogic.rotation(state).length || state.players.length;
    const e = Number(state.settings && state.settings.expectedTeams);
    return Number.isInteger(e) && e > n && !DraftLogic.isStarted(state) ? e : n;
  }
  static recommendFor(state, feel, opts){
    const o = opts || {};
    // A game waiting for its phase (step A3) starts after the latest results at the earliest.
    const start = startEpisode(state) ?? SpoilerLogic.latestWithResults(state) + 1;
    const numberOf = id => { const e = state.episodes.find(x => x.id === id); return e ? e.number : Infinity; };
    const C = o.castSize || state.castaways.filter(c => !(c.status === 'eliminated' && numberOf(c.exitEpisodeId) < start)).length;
    const pieces = piecesOf(state);
    const roster = !!pieces.hasActiveRoster;
    const R = rosterSize(state);
    return WaiverLogic.recommend({
      C, T: WaiverLogic.teamsFor(state, o), R,
      S: roster ? ActiveRosterLogic.activeSlots(state) : R,
      E: o.episodes || Math.max(13, ...state.episodes.map(e => e.number)), start,
      shared: MidSeasonLogic.isShared(state),
      scores: pieces.scores,
      feel: feel || WaiverLogic.config(state).waiverFeel,
      market: MarketLogic.on(state),
    });
  }
  /** Writes the recommendation for `feel` onto the league. False when there's none (or it can't fit). */
  static applyRecommendation(state, feel, opts){ return !WaiverLogic.writeRecommendation(state, feel, opts).length; }
  // applyRecommendation, saying why when it's refused: the cast too small for it, or the game's writer's problems.
  static writeRecommendation(state, feel, opts){
    const r = WaiverLogic.recommendFor(state, feel, opts);
    if(!r || !r.feasible) return [{ at: 'extras.waivers', problem: 'The cast is too small for that' }];
    const started = DraftLogic.isStarted(state);
    // Through the game's writer, like any change to it (RosterLogic.setGame).
    return RosterLogic.editSettings(state, s => {
      Object.assign(s.settings, r.settings);
      WaiverLogic.mirrorLegacy(s);
      // Before the draft a suggestion is provisional (the teams, the ownership and the roster can all still
      // change): it is fitted again to the league as it really is when the draft starts.
      if(!started) s.settings.waiverFit = true;
      else delete s.settings.waiverFit;
    });
  }
  // The draft has started: a league still on the suggestion it got at creation (never touched by hand)
  // gets the suggestion for the teams, ownership and cast it really has. Run by the server's waiver clock (waivers.js
  // syncWaivers) on every write. True when it changed the settings.
  static refit(state){
    const st = state.settings;
    if(!st || !st.waiverFit || !DraftLogic.isStarted(state)) return false;
    delete st.waiverFit;
    return WaiverLogic.applyRecommendation(state);
  }
  /** Whether the league's settings are its recommendation, for its feel (else the card says "Customized"). */
  static isRecommended(state, opts){
    const c = WaiverLogic.config(state);
    const r = WaiverLogic.recommendFor(state, c.waiverFeel, opts);
    if(!r || !r.feasible) return false;
    const want = r.settings;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    return want.replaceRule === c.replaceRule && same(want.waiverWindows, c.waiverWindows) && want.autoFill === c.autoFill
      && want.waiverProcessHours === WaiverLogic.processHours(state) && want.replenishOrderBy === WaiverLogic.waivers(state).order
      && WaiverLogic.freeAgencyOn(state) && (c.replaceRule !== 'whenShort' || want.replenishAt === WaiverLogic.shortAt(state));
  }

  // ---- Weeks and windows ----
  static periods(state){ return (state.midSeason && state.midSeason.waivers && state.midSeason.waivers.periods) || []; }
  /** The waiver week still running (open or in free agency), or null. */
  static current(state){
    const ps = WaiverLogic.periods(state);
    const p = ps[ps.length - 1];
    return p && p.phase !== 'closed' ? p : null;
  }
  // A11 part 1: nobody knocked out of the game (KnockoutLogic): they make no more moves.
  static rotation(state){ const outs = KnockoutLogic.outs(state); return state.players.filter(p => inLeagueRotation(p) && !outs.has(p.id)).map(p => p.id); }
  // A window opens on its own after episode n of the league's own season: every episode, or every
  // `every`. Not when it would allow nothing (no swaps, and replacements don't wait for windows).
  static isWindowEpisode(state, n){
    const w = WaiverLogic.windows(state);
    if(w.schedule === 'manual' || !Number.isInteger(n)) return false;
    const end = endEpisode(state);
    if(end !== null && n >= end) return false;
    if(!(w.swaps > 0 || WaiverLogic.replaceRule(state) === 'windows')) return false;
    const start = startEpisode(state);
    if(start === null) return false; // waiting for its phase (step A3): no windows before it starts
    const k = n - start + 1;
    return k >= 1 && (w.schedule === 'everyEpisode' || k % w.every === 0);
  }
  /** A window with swaps opens after episode n (pre-v2's "add/drop week"). */
  static isAddDropEpisode(state, n){
    return WaiverLogic.isWindowEpisode(state, n) && WaiverLogic.windows(state).swaps > 0;
  }
  /** The next episode after `after` that opens a window on its own, or null (manual only, or none left). */
  static nextWindowEpisode(state, after, total){
    const last = total || Math.max(13, ...state.episodes.map(e => e.number));
    for(let n = after + 1; n < last; n++) if(WaiverLogic.isWindowEpisode(state, n)) return n;
    return null;
  }
  // A week from before v2 has no `window`: its add/drop flag was one, with one swap.
  static isWindow(period){ return !!period && (typeof period.window === 'boolean' ? period.window : !!period.addDrop); }
  static swapsAllowed(period){
    if(!WaiverLogic.isWindow(period)) return 0;
    return typeof period.swaps === 'number' ? period.swaps : (period.addDrop ? 1 : 0);
  }
  // A swap from the old live rounds after the same episode counts too (no periodId), so a league that
  // switched to waivers mid-window can't swap twice.
  static swapsMade(state, period, playerId){
    return ((state.midSeason && state.midSeason.log) || []).filter(tx => tx.type === 'trade' && tx.playerId === playerId
      && (tx.periodId === period.id || (!tx.periodId && tx.episode === period.episode))).length;
  }
  /** Whether replacements happen in this week: its own say (a window the commissioner opened), else the rule. */
  static windowReplaces(state, period){
    if(WaiverLogic.isWindow(period) && typeof period.replace === 'boolean') return period.replace;
    const rule = WaiverLogic.replaceRule(state);
    return rule === 'always' || rule === 'whenShort' || (rule === 'windows' && WaiverLogic.isWindow(period));
  }
  static swapsLeft(state, period, playerId){
    return period ? Math.max(0, WaiverLogic.swapsAllowed(period) - WaiverLogic.swapsMade(state, period, playerId)) : 0;
  }
  /** Every swap this window allows is made (pre-v2: "made this week's add/drop"). */
  static addDropUsed(state, period, playerId){
    const made = WaiverLogic.swapsMade(state, period, playerId);
    return made > 0 && made >= WaiverLogic.swapsAllowed(period);
  }

  // ---- Replacements ----
  // { count, lossIds, outIds }: how many castaways this player may replace in `period` (null: no week
  // running), the oldest `count` losses (lossIds, what's replaced first), and every loss a claim may
  // name (outIds). A loss is a castaway of theirs out of the game (not the winner), not yet replaced.
  //   always    -- every loss
  //   whenShort -- only once down to shortAt() still in, and only back up to one more than that
  //   windows   -- every loss, but only in a window
  //   never     -- none
  // A window the commissioner opened may say otherwise (period.replace, windowReplaces): on, every loss
  // can be replaced in it whatever the rule; off, none can. And nothing's owed while nobody is free to
  // come in (every castaway still in on a team: late in a season, the five left all drafted), so no
  // screen asks for a replacement nobody can make; { ..., nobodyFree: true } says that's why.
  static replacementsOwed(state, playerId, period){
    const none = { count: 0, lossIds: [], outIds: [] };
    let rule = WaiverLogic.replaceRule(state);
    const own = WaiverLogic.isWindow(period) && typeof period.replace === 'boolean' ? period.replace : null;
    if(own === false) return none;
    // On: everyone who's out, in this window, whatever the rule (only when short included: the one-off
    // "replace everyone" window, e.g. after the merge).
    if(own === true) rule = 'always';
    if(rule === 'never' || MidSeasonLogic.seasonOver(state)) return none;
    if(!inLeagueRotation(Core.getPlayer(state, playerId))) return none;
    if(rule === 'windows' && !WaiverLogic.isWindow(period)) return none;
    const losses = state.castaways
      .filter(c => ownerListOf(c).includes(playerId) && c.status === 'eliminated' && !c.replenishClaimed && !isWinnerExit(state, c.exitMethod))
      .sort((a,b) => (a.placementOrder || 0) - (b.placementOrder || 0))
      .map(c => c.id);
    let count = losses.length;
    if(rule === 'whenShort'){
      const inGame = MidSeasonLogic.inGameCount(state, playerId);
      const at = WaiverLogic.shortAt(state);
      count = Math.min(losses.length, inGame <= at ? at + 1 - inGame : 0);
    }
    if(count && !MidSeasonLogic.availableFor(state, playerId).length) return { ...none, nobodyFree: true };
    return { count, lossIds: losses.slice(0, count), outIds: count ? losses : [] };
  }
  /** replacementsOwed in the week running now (pre-v2's "pickups owed"). */
  static pickupsOwed(state, playerId){
    return WaiverLogic.replacementsOwed(state, playerId, WaiverLogic.current(state));
  }
  /** Pre-v2 pickup lists: up to 3 ranked; owed more than one, two spare beyond what's owed. */
  static maxPickupClaims(owed){ return owed > 0 ? owed + 2 : 0; }

  // ---- The clock ----
  // processAt: waiverProcessHours before the next episode airs (or, results having come late, halfway
  // between opening and airtime); closesAt: when it airs. With no air time to go by (no schedule, a
  // catch-up league, or it already aired): processAt is waiverProcessHours after opening, and closesAt
  // is null -- free agency then runs until the next episode's results arrive.
  static schedule(state, period){
    const H = WaiverLogic.processHours(state) * HOUR_MS;
    const opened = Date.parse(period.openedAt);
    const next = state.episodes.find(e => e.number === period.episode + 1);
    const airs = next && next.airsAt ? Date.parse(next.airsAt) : NaN;
    if(Number.isFinite(airs) && airs > opened){
      const at = airs - H >= opened ? airs - H : opened + (airs - opened) / 2;
      return { processAt: new Date(at).toISOString(), closesAt: new Date(airs).toISOString() };
    }
    return { processAt: new Date(opened + H).toISOString(), closesAt: null };
  }
  // Air times are stamped fresh on every read and write, so the running week's times follow them.
  static refresh(state){
    const p = WaiverLogic.current(state);
    if(!p) return;
    const s = WaiverLogic.schedule(state, p);
    if(p.phase === 'open') p.processAt = s.processAt;
    p.closesAt = s.closesAt;
  }
  /** The step waiting at `now`: 'open' | 'process' | 'close' | 'cancel' | null. */
  static due(state, now){
    // An archived game (settings.archivedAt, step 10 part 2b) stands still: nothing runs.
    if(state.settings && state.settings.archivedAt) return null;
    const cur = WaiverLogic.current(state);
    const last = lastCompletedEpisode(state);
    if(cur){
      if(!WaiverLogic.enabled(state)) return 'close';
      // A later episode's results are in: this week is over, whatever the clock says.
      const later = last !== null && last > cur.episode;
      const { closesAt } = WaiverLogic.schedule(state, cur);
      const closing = later || (!!closesAt && now >= Date.parse(closesAt));
      if(cur.phase === 'open'){
        const ep = state.episodes.find(e => e.number === cur.episode);
        if(!later && !EpisodeLogic.hasResults(ep)) return 'cancel';
        const { processAt } = WaiverLogic.schedule(state, cur);
        return closing || (!cur.hold && now >= Date.parse(processAt)) ? 'process' : null;
      }
      return closing ? 'close' : null;
    }
    if(!WaiverLogic.enabled(state) || last === null || MidSeasonLogic.seasonOver(state)) return null;
    // A game over a span opens no week after its last episode: nothing's left to play (A11 part 1: nor after a race won or one
    // left).
    const end = lastEpisode(state);
    if(end !== null && last >= end) return null;
    const ps = WaiverLogic.periods(state);
    const prev = ps[ps.length - 1];
    if(prev && prev.episode >= last) return null;
    // Replacements that don't wait for windows: every week, owed or not (a week that only opened when
    // someone lost a castaway would say someone had). Otherwise only the scheduled windows open.
    if(!WaiverLogic.weekly(state) && !WaiverLogic.isWindowEpisode(state, last)) return null;
    return 'open';
  }
  // opts: { window, swaps, by: 'commissioner' } -- Open a waiver window (openWindow) opening one itself.
  static open(state, now, opts){
    const o = opts || {};
    const n = lastCompletedEpisode(state);
    if(!state.midSeason.waivers) state.midSeason.waivers = { periods: [] };
    const window = !!o.window || WaiverLogic.isWindowEpisode(state, n);
    const swaps = window ? (Number.isInteger(o.swaps) ? o.swaps : WaiverLogic.windows(state).swaps) : 0;
    const p = {
      id: Core.uid('wv'), episode: n, openedAt: new Date(now).toISOString(), processAt: null, closesAt: null,
      // addDrop: whether it allows swaps, for one release (pre-v2 readers); `window`/`swaps` are the truth.
      phase: 'open', window, swaps, addDrop: swaps > 0, claimsIn: [], run: null, autoFills: []
    };
    if(o.by === 'commissioner') p.openedBy = 'commissioner';
    if(window && typeof o.replace === 'boolean') p.replace = o.replace;
    Object.assign(p, WaiverLogic.schedule(state, p));
    state.midSeason.waivers.periods.push(p);
    return p;
  }
  // The results that opened it were taken back (entered by mistake): the week never happened.
  static cancel(state){
    const p = WaiverLogic.current(state);
    if(!p || p.phase !== 'open') return null;
    state.midSeason.waivers.periods = WaiverLogic.periods(state).filter(x => x !== p);
    return p;
  }
  static setClaimsIn(state, period, playerIds){ period.claimsIn = [...playerIds]; }

  // ---- Commissioner: Open a waiver window ----
  // `swaps` (0 .. roster size, "Whole team") each player may make. The week already open for the latest
  // episode becomes a window (or changes its swaps); with none open, one opens now on the normal clock.
  // `swaps: null` turns the open week's window off: it goes on as a plain week if replacements run
  // weekly, else it's over (closed on the spot, `turnedOff`, so the schedule doesn't open it again).
  // Never once the week has processed. { period, closed? } or { error }. The server trims claims that no
  // longer fit (waivers.js openWindow).
  // opts.replace (the sheet's "Replace castaways who are out"): true or false is this window's own say
  // on replacements (replacementsOwed); left out, the league's rule decides. A window that would allow
  // nothing -- no swaps, replacements off -- is refused.
  static openWindow(state, swaps, now, opts){
    if(!WaiverLogic.supported(state)) return { error: 'This league doesn’t use waivers' };
    const R = rosterSize(state);
    if(swaps !== null && !(Number.isInteger(swaps) && swaps >= 0 && swaps <= R)) return { error: `Choose 0 to ${R} swaps` };
    const replace = opts && typeof opts.replace === 'boolean' ? opts.replace : undefined;
    if(swaps === 0 && replace === false) return { error: 'Allow replacements or swaps: this window has nothing to claim' };
    const cur = WaiverLogic.current(state);
    const done = 'This episode’s waivers have processed: open a window after the next episode';
    if(cur && cur.phase !== 'open') return { error: done };
    if(cur){
      if(swaps === null){
        if(!WaiverLogic.isWindow(cur)) return { error: 'There’s no waiver window to turn off' };
        Object.assign(cur, { window: false, swaps: 0, addDrop: false, openedBy: 'commissioner' });
        delete cur.replace;
        if(!WaiverLogic.weekly(state)){
          cur.phase = 'closed';
          cur.turnedOff = true;
          return { period: cur, closed: true };
        }
        return { period: cur };
      }
      Object.assign(cur, { window: true, swaps, addDrop: swaps > 0, openedBy: 'commissioner' });
      if(replace === undefined) delete cur.replace;
      else cur.replace = replace;
      delete cur.turnedOff;
      return { period: cur };
    }
    if(swaps === null) return { error: 'There’s no waiver window to turn off' };
    const last = lastCompletedEpisode(state);
    if(last === null) return { error: 'Open a waiver window once an episode has results' };
    if(MidSeasonLogic.seasonOver(state)) return { error: 'The season is over' };
    const ps = WaiverLogic.periods(state);
    const prev = ps[ps.length - 1];
    if(prev && prev.episode >= last) return { error: done };
    return { period: WaiverLogic.open(state, now === undefined ? Date.now() : now, { window: true, swaps, replace, by: 'commissioner' }) };
  }

  // ---- Claims ----
  // One player's claim as ranked pairs, without checking them. The v2 shape is { pairs: [{ addId,
  // dropId }] }; the pre-v2 one, { pickupIds, dropId, addIds } (any of those keys, and no pairs), becomes
  // each pickup paired with every loss it could replace (oldest first, so rounds take them in the old
  // order), then the add/drop's adds paired with its drop. A stored row carries both: pairs win.
  static pairsOf(state, period, playerId, input){
    const i = input || {};
    const legacy = !(Array.isArray(i.pairs) && i.pairs.length) && ['pickupIds', 'dropId', 'addIds'].some(k => hasKey(i, k));
    if(!legacy){
      const seen = new Set(), pairs = [];
      (Array.isArray(i.pairs) ? i.pairs : []).forEach(x => {
        if(!x || !isId(x.addId) || !isId(x.dropId) || seen.has(x.addId + '|' + x.dropId)) return;
        seen.add(x.addId + '|' + x.dropId);
        pairs.push({ addId: x.addId, dropId: x.dropId });
      });
      return { pairs, legacy: false };
    }
    const pickupIds = uniqIds(i.pickupIds), addIds = uniqIds(i.addIds);
    const dropId = isId(i.dropId) ? i.dropId : null;
    const outIds = WaiverLogic.replacementsOwed(state, playerId, period).outIds;
    const pairs = [];
    pickupIds.forEach(a => outIds.forEach(d => pairs.push({ addId: a, dropId: d })));
    if(dropId) addIds.filter(a => !pairs.some(x => x.addId === a && x.dropId === dropId)).forEach(a => pairs.push({ addId: a, dropId }));
    return { pairs, legacy: true, pickupIds, dropId, addIds };
  }
  // Why one pair can't be claimed this week, or null. owed/swapsLeft: the player's, passed in.
  static pairProblem(state, period, playerId, pair, owed, swapsLeft, prices){
    const drop = Core.getCastaway(state, pair.dropId);
    if(!drop || !ownerListOf(drop).includes(playerId)) return 'Drop someone on your team';
    if(drop.status === 'active'){
      if(!WaiverLogic.swapsAllowed(period)) return 'No swaps this week';
      if(!swapsLeft) return 'You’ve used this window’s swaps';
    } else {
      if(!owed.count) return 'You can’t replace anyone this week';
      if(!owed.outIds.includes(drop.id)) return `${drop.name} can’t be replaced`;
    }
    if(!MidSeasonLogic.isAvailableFor(state, pair.addId, playerId)) return 'Claim free agents only';
    // A10 part 3b: within a salary cap at today's prices, or no further over (`prices`: read once a claim).
    return BudgetLogic.moveProblem(state, playerId, pair.dropId, pair.addId, prices);
  }
  // The stored claim: its pairs, and the pre-v2 view of them for one release (what GET /waivers gives the
  // phase-2 screens): the replacements' adds, and the first swap's drop and its adds.
  static claimOf(state, pairs){
    const out = id => { const c = Core.getCastaway(state, id); return !!c && c.status !== 'active'; };
    const swaps = pairs.filter(x => !out(x.dropId));
    const dropId = swaps.length ? swaps[0].dropId : null;
    return {
      pairs,
      pickupIds: uniqIds(pairs.filter(x => out(x.dropId)).map(x => x.addId)),
      dropId,
      addIds: swaps.filter(x => x.dropId === dropId).map(x => x.addId),
    };
  }
  // Normalizes one player's claim against the league as it stands: { claim } or { error }. Each pair must
  // drop someone of theirs -- out of the game and replaceable this week, or still in with a swap left --
  // and add a free agent. Up to owed + swaps left + 2 different adds (two spare). An empty claim is
  // valid; the server deletes the row then.
  static checkClaim(state, period, playerId, input){
    if(!period || period.phase !== 'open') return { error: 'Claims are closed for this week' };
    if(!inLeagueRotation(Core.getPlayer(state, playerId))) return { error: 'Not in this league’s waivers' };
    if(KnockoutLogic.isOut(state, playerId)) return { error: 'You’re out of this game' };
    const parsed = WaiverLogic.pairsOf(state, period, playerId, input);
    const owed = WaiverLogic.replacementsOwed(state, playerId, period);
    const swapsLeft = WaiverLogic.swapsLeft(state, period, playerId);
    // A10 part 3b: a salary cap's prices, read once a claim (part 3c: a stock market's too).
    const prices = BudgetLogic.priced(state) ? PriceLogic.prices(state) : undefined;
    if(parsed.legacy){
      // The pre-v2 shape keeps its own limits: a pickup list, and one add/drop of up to 3 adds.
      if(parsed.pickupIds.length){
        if(!owed.count) return { error: 'You can’t replace anyone this week' };
        const max = WaiverLogic.maxPickupClaims(owed.count);
        if(parsed.pickupIds.length > max) return { error: `Claim up to ${max}` };
      }
      if(parsed.dropId || parsed.addIds.length){
        if(!WaiverLogic.swapsAllowed(period)) return { error: 'No swaps this week' };
        if(!swapsLeft) return { error: 'You’ve used this window’s swaps' };
        if(!parsed.dropId) return { error: 'Choose who to drop' };
        if(!parsed.addIds.length) return { error: 'Choose who to add' };
        if(parsed.addIds.length > 3) return { error: 'Claim up to 3' };
      }
    } else if(parsed.pairs.length > MAX_CLAIM_PAIRS) return { error: `Claim up to ${MAX_CLAIM_PAIRS} pairs` };
    for(const x of parsed.pairs){
      const why = WaiverLogic.pairProblem(state, period, playerId, x, owed, swapsLeft, prices);
      if(why) return { error: why };
    }
    if(!parsed.legacy){
      const max = owed.count + swapsLeft + 2;
      if(new Set(parsed.pairs.map(x => x.addId)).size > max) return { error: `Claim up to ${max}` };
    }
    return { claim: WaiverLogic.claimOf(state, parsed.pairs) };
  }
  // ---- Claims by spot (PLAN-waivers-v2.md "2A") ----
  // What a person ranks is one spot at a time: "replacing Patt: Sharonda, then Rob"; "swap: Maggie for
  // Lewis, then Kilby for Mike". As pairs, in the order processing tries them: each replacement's group
  // (oldest loss first), then the swaps, each group in its own order. A pair whose drop is out of the
  // game is a replacement; any other, a swap.
  static groupPairs(state, period, playerId, pairs){
    const outIds = WaiverLogic.replacementsOwed(state, playerId, period).outIds;
    const isOut = id => { const c = Core.getCastaway(state, id); return !!c && c.status !== 'active'; };
    const reps = pairs.filter(x => isOut(x.dropId));
    const rank = id => { const i = outIds.indexOf(id); return i < 0 ? outIds.length : i; };
    const drops = [...new Set(reps.map(x => x.dropId))].sort((a, b) => rank(a) - rank(b));
    return [...drops.flatMap(d => reps.filter(x => x.dropId === d)), ...pairs.filter(x => !isOut(x.dropId))];
  }
  // One spot's choices set (an empty list clears it): every pair dropping `dropId` goes, and its adds,
  // in order, take their place -- a swap's where its first pair was, else after the other swaps.
  // Used by the claim screen and by the commissioner's Claim for, which can't see the rest of the claim.
  static setSpot(state, period, playerId, pairs, dropId, addIds){
    const fresh = uniqIds(addIds).map(addId => ({ addId, dropId }));
    const at = pairs.findIndex(x => x.dropId === dropId);
    const rest = pairs.filter(x => x.dropId !== dropId);
    const i = at < 0 ? rest.length : at; // nothing before the first of them dropped `dropId`
    return WaiverLogic.groupPairs(state, period, playerId, [...rest.slice(0, i), ...fresh, ...rest.slice(i)]);
  }
  static isEmptyClaim(claim){
    return !claim || !((claim.pairs || []).length || (claim.pickupIds || []).length || claim.dropId || (claim.addIds || []).length);
  }
  // A saved claim after the week changed under it (a window turned off, fewer swaps): the pairs that
  // still fit, in order, and how many went. Used by the server when the commissioner changes a window.
  static trimClaim(state, period, playerId, claim){
    const { pairs } = WaiverLogic.pairsOf(state, period, playerId, claim);
    const owed = WaiverLogic.replacementsOwed(state, playerId, period);
    const swapsLeft = WaiverLogic.swapsLeft(state, period, playerId);
    const max = owed.count + swapsLeft + 2;
    const adds = new Set();
    const prices = BudgetLogic.priced(state) ? PriceLogic.prices(state) : undefined;
    const keep = pairs.filter(x => {
      if(WaiverLogic.pairProblem(state, period, playerId, x, owed, swapsLeft, prices)) return false;
      if(!adds.has(x.addId) && adds.size >= max) return false;
      adds.add(x.addId);
      return true;
    });
    return { claim: WaiverLogic.claimOf(state, keep), removed: pairs.length - keep.length };
  }

  // ---- Processing ----
  // Runs every claim at once. claimsByPlayer: { playerId: claim } in either shape (pairsOf); a player
  // with no row has no claim. One waiver order, frozen at the start, and no priority for replacements:
  // in ROUNDS, each player in order gets their first pair that can still go through, then everyone's
  // next, until nobody has one. A pair can't go through when its add was taken (or isn't free), its
  // drop already went, or the week's limit for its kind is used (replacements owed; swaps left).
  // Exclusive: someone dropped in the run waits for free agency. Rolling waivers: everyone with a
  // successful claim goes to the back once, in their order. Returns the run (also stored on the week),
  // or null when there's no open week.
  static process(state, claimsByPlayer, opts){
    const p = WaiverLogic.current(state);
    if(!p || p.phase !== 'open') return null;
    const at = new Date((opts && opts.now) || Date.now()).toISOString();
    const meta = { via: 'waivers', periodId: p.id, episode: p.episode, at };
    const orderBefore = MidSeasonLogic.order(state, WaiverLogic.rotation(state));
    const shared = MidSeasonLogic.isShared(state);
    const results = [];
    const movers = new Set();
    const firstTaker = {};
    const justDropped = new Set();
    // A pair's kind is fixed for the run: nobody's status changes in it.
    const isOut = id => { const c = Core.getCastaway(state, id); return !!c && c.status !== 'active'; };
    const kindOf = x => (isOut(x.dropId) ? 'pickup' : 'addDrop');
    // A10 part 3b: a salary cap's prices, read once (nothing's results change in a run). Part 3c: a stock market's, each move
    // recording what it sold and bought at; a pass for want of cash says so ('cash').
    const prices = BudgetLogic.priced(state) ? PriceLogic.prices(state) : null;
    const market = MarketLogic.on(state);
    const run = {};
    orderBefore.forEach(pid => {
      const c = claimsByPlayer && claimsByPlayer[pid];
      const repLeft = WaiverLogic.replacementsOwed(state, pid, p).count;
      const swapLeft = WaiverLogic.swapsLeft(state, p, pid);
      run[pid] = { claimed: !!c, pairs: c ? WaiverLogic.pairsOf(state, p, pid, c).pairs : [], done: new Set(), why: {}, told: new Set(), mine: new Set(), repLeft, swapLeft, couldSwap: swapLeft > 0, swapped: 0 };
    });
    // null when the pair can go through now; { silent } when it's simply not needed any more (its drop
    // went, or its kind's limit is used); else why not, as a WaiverPass.
    const blocked = (pid, x) => {
      const r = run[pid];
      const drop = Core.getCastaway(state, x.dropId);
      if(!drop || !ownerListOf(drop).includes(pid)) return { silent: true };
      if(drop.status !== 'active' ? r.repLeft <= 0 : r.swapLeft <= 0) return { silent: true };
      if((shared || !justDropped.has(x.addId)) && MidSeasonLogic.isAvailableFor(state, x.addId, pid)){
        return prices && BudgetLogic.moveProblem(state, pid, x.dropId, x.addId, prices) ? { castawayId: x.addId, reason: market ? 'cash' : 'cap' } : null;
      }
      if(r.mine.has(x.addId)) return { castawayId: x.addId, reason: 'yours' };
      if(firstTaker[x.addId]) return { castawayId: x.addId, reason: 'ahead', byPlayerId: firstTaker[x.addId] };
      return { castawayId: x.addId, reason: 'gone' };
    };
    for(let round = 1; round <= 500; round++){
      let moved = false;
      orderBefore.forEach(pid => {
        const r = run[pid];
        for(let i = 0; i < r.pairs.length; i++){
          if(r.done.has(i)) continue;
          const x = r.pairs[i];
          const why = blocked(pid, x);
          if(why){ if(!why.silent) r.why[i] = why; continue; }
          const kind = kindOf(x);
          const m = market ? { ...meta, ...MarketLogic.terms(state, x.dropId, x.addId, prices) } : meta;
          const tx = kind === 'pickup'
            ? MidSeasonLogic.applyPickup(state, pid, x.addId, x.dropId, m)
            : MidSeasonLogic.applyAddDrop(state, pid, x.dropId, x.addId, m);
          r.done.add(i);
          // Why the ones ranked above it for the same drop didn't go (each told once), and which choice
          // it was among that drop's adds.
          const passed = [];
          const above = new Set();
          for(let j = 0; j < i; j++){
            if(r.pairs[j].dropId !== x.dropId) continue;
            if(r.pairs[j].addId !== x.addId) above.add(r.pairs[j].addId);
            if(r.why[j] && !r.told.has(j)){ passed.push(r.why[j]); r.told.add(j); }
          }
          results.push({ playerId: pid, kind, outcome: 'got', castawayId: x.addId, droppedCastawayId: x.dropId, choice: above.size + 1, round, passed, txId: tx.id });
          if(!firstTaker[x.addId]) firstTaker[x.addId] = pid;
          r.mine.add(x.addId);
          if(kind === 'pickup') r.repLeft--;
          else { r.swapLeft--; r.swapped++; justDropped.add(x.dropId); }
          movers.add(pid);
          moved = true;
          break;
        }
      });
      if(!moved) break;
    }
    // What didn't happen, and why: a row per replacement still owed, and one for a window's swap not made.
    orderBefore.forEach(pid => {
      const r = run[pid];
      const untold = kind => {
        const seen = new Set();
        return r.pairs.map((x, i) => [x, i])
          .filter(([x, i]) => r.why[i] && !r.told.has(i) && kindOf(x) === kind)
          .map(([, i]) => r.why[i])
          .filter(w => !seen.has(w.castawayId) && seen.add(w.castawayId));
      };
      const reps = r.pairs.some(x => kindOf(x) === 'pickup');
      for(let k = 0; k < r.repLeft; k++){
        results.push({ playerId: pid, kind: 'pickup', outcome: r.claimed && reps ? 'missed' : 'noClaim', passed: k === 0 ? untold('pickup') : [] });
      }
      if(r.couldSwap && !r.swapped){
        const swaps = r.pairs.some(x => kindOf(x) === 'addDrop');
        results.push({ playerId: pid, kind: 'addDrop', outcome: !r.claimed ? 'noClaim' : swaps ? 'missed' : 'skipped', passed: untold('addDrop') });
      }
    });

    const orderAfter = WaiverLogic.rolling(state)
      ? [...orderBefore.filter(id => !movers.has(id)), ...orderBefore.filter(id => movers.has(id))]
      : MidSeasonLogic.order(state, WaiverLogic.rotation(state));
    if(WaiverLogic.rolling(state)) state.midSeason.priority = orderAfter;
    p.run = { at, by: (opts && opts.by) || 'schedule', orderBefore, orderAfter, results };
    p.phase = 'processed';
    delete p.hold;
    return p.run;
  }

  // ---- Free agency ----
  // Instant, first come, first served, and it never touches the waiver order. The same pair as a claim,
  // against the same limits: drop someone out of the game you may replace, or someone still in with a
  // swap left. No dropId (the pre-v2 shape) replaces your oldest loss. A reason on refusal, else null.
  static freeAgencyMove(state, playerId, addId, dropId, now){
    const p = WaiverLogic.current(state);
    if(!p || p.phase !== 'processed') return 'Free agency isn’t open';
    if(!WaiverLogic.freeAgencyOn(state)) return 'This league has no free agency';
    if(!inLeagueRotation(Core.getPlayer(state, playerId))) return 'Not in this league’s waivers';
    if(KnockoutLogic.isOut(state, playerId)) return 'You’re out of this game';
    if(!addId || !MidSeasonLogic.isAvailableFor(state, addId, playerId)) return 'They’re not a free agent any more';
    const meta = { via: 'freeAgency', periodId: p.id, episode: p.episode, at: new Date(now || Date.now()).toISOString() };
    // A10 part 3b and 3c: a salary cap's or a stock market's prices, read once (a market's move records what it sold and paid).
    const prices = BudgetLogic.priced(state) ? PriceLogic.prices(state) : undefined;
    const entryOf = (sold) => (MarketLogic.on(state) ? { ...meta, ...MarketLogic.terms(state, sold, addId, prices) } : meta);
    const owed = WaiverLogic.replacementsOwed(state, playerId, p);
    if(!dropId){
      if(!owed.count) return 'Choose who to drop';
      dropId = owed.lossIds[0];
    }
    const drop = Core.getCastaway(state, dropId);
    if(!drop || !ownerListOf(drop).includes(playerId)) return 'Drop someone on your team';
    if(drop.status !== 'active'){
      if(!owed.count) return 'You can’t replace anyone this week';
      if(!owed.outIds.includes(drop.id)) return `${drop.name} can’t be replaced`;
      // A10 part 3b: within a salary cap at today's prices, or no further over; part 3c: a stock market's, within cash.
      const over = BudgetLogic.moveProblem(state, playerId, drop.id, addId, prices);
      if(over) return over;
      MidSeasonLogic.applyPickup(state, playerId, addId, drop.id, entryOf(drop.id));
      return null;
    }
    if(!WaiverLogic.swapsAllowed(p)) return 'No swaps this week';
    if(!WaiverLogic.swapsLeft(state, p, playerId)) return 'You’ve used this window’s swaps';
    const over = BudgetLogic.moveProblem(state, playerId, dropId, addId, prices);
    if(over) return over;
    MidSeasonLogic.applyAddDrop(state, playerId, dropId, addId, entryOf(dropId));
    return null;
  }

  // ---- Closing ----
  // The next episode is airing (or its results are in). With autoFill on, any replacement still owed is
  // filled automatically, in waiver order, so nobody plays a castaway short. Classic: a free agent at
  // random (hashUnit, so fixed); Active Roster: the free agent with the most points. Nobody left at all:
  // it stays empty. Off (Competitive's default), a missed deadline plays short. Only after a real free
  // agency, though: a week that processes and closes at the same moment (the next episode's results were
  // already in -- e.g. the first week a league ever had, opened late) gave nobody a chance to choose, so
  // what's owed carries over to the next week's claims instead. Under 'windows', replacements are only
  // owed in a window, so only a window's close fills them.
  static close(state, now){
    const p = WaiverLogic.current(state);
    if(!p) return null;
    const at = now || Date.now();
    const hadFreeAgency = !!p.run && Date.parse(p.run.at) < at;
    if(p.phase === 'processed' && hadFreeAgency && WaiverLogic.enabled(state) && WaiverLogic.autoFillOn(state)){
      const meta = { via: 'auto', periodId: p.id, episode: p.episode, at: new Date(at).toISOString() };
      MidSeasonLogic.order(state, WaiverLogic.rotation(state)).forEach(pid => {
        for(let n = 0; n < 50; n++){
          const owed = WaiverLogic.replacementsOwed(state, pid, p);
          const pick = owed.count ? WaiverLogic.autoPick(state, p, pid, n, owed.lossIds[0] || null) : null;
          if(!pick) break;
          p.autoFills.push(MidSeasonLogic.applyPickup(state, pid, pick, owed.lossIds[0] || null, meta).id);
        }
      });
    }
    p.phase = 'closed';
    return p;
  }
  static autoPick(state, period, playerId, n, dropId){
    let pool = MidSeasonLogic.availableFor(state, playerId).map(c => c.id).sort();
    if(!pool.length) return null;
    // A10 part 3b: a salary cap fills with someone who keeps the team within it (or no further over); with nobody who does, the
    // cheapest, so nobody plays short (the cap's fallback: it never leaves a place empty). Part 3c: a stock market fills only
    // with someone they can afford; with nobody, nobody (its fallback: they hold who they have, and nobody spends what they
    // haven't got).
    if(BudgetLogic.priced(state)){
      const prices = PriceLogic.prices(state);
      const fits = pool.filter(id => !BudgetLogic.moveProblem(state, playerId, dropId, id, prices));
      if(MarketLogic.on(state)){
        if(!fits.length) return null;
        pool = fits;
      } else {
        const cheapest = Math.min(...pool.map(id => prices.get(id) || 0));
        pool = fits.length ? fits : pool.filter(id => (prices.get(id) || 0) === cheapest);
      }
    }
    // A game scored by moments (a lineup, best ball) takes the free agent with the most points.
    if(gameOf(state).score.by === 'moments'){
      const pts = {};
      pool.forEach(id => { pts[id] = WaiverLogic.castawayPoints(state, id); });
      return [...pool].sort((a,b) => pts[b] - pts[a] || hashUnit(period.id + a) - hashUnit(period.id + b))[0];
    }
    return pool[Math.floor(hashUnit(`${period.id}|${playerId}|${n}`) * pool.length)];
  }
  /** Active Roster: a castaway's points so far, from every in-play episode's events. */
  static castawayPoints(state, castawayId){
    let total = 0;
    state.episodes.forEach(ep => {
      if(!inPlay(state, ep.number)) return;
      ActiveRosterLogic.episodeEvents(state, ep).forEach(ev => {
        if(ev.castawayId === castawayId) total += ActiveRosterLogic.eventPoints(state, ev);
      });
    });
    return roundPoints(total);
  }

  // ---- Commissioner: Undo last waiver run ----
  // While free agency is still open: every move of the week (the run's and free agency's) is taken
  // back, newest first, the waiver order is put back, and claims reopen. The week is then held: it
  // processes on Process now, or at the latest when the next episode airs. A reason on refusal.
  static undo(state){
    const p = WaiverLogic.current(state);
    if(!p || p.phase !== 'processed' || !p.run) return 'There’s no waiver run to undo';
    const log = state.midSeason.log || [];
    log.filter(tx => tx.periodId === p.id).reverse().forEach(tx => MidSeasonLogic.revert(state, tx));
    state.midSeason.log = log.filter(tx => tx.periodId !== p.id);
    if(WaiverLogic.rolling(state)) state.midSeason.priority = p.run.orderBefore;
    p.run = null;
    p.phase = 'open';
    p.hold = true;
    p.autoFills = [];
    return null;
  }

  // ---- Spoilers ----
  // One viewer's copy (SpoilerLogic.viewThrough) as of their mark: every move from an episode they
  // haven't revealed is taken back (a pickup says someone left), the waiver order is put back to before
  // the first such run, and those weeks keep only their existence and times -- no claims in, no run.
  // Mutates `s`, which must be a copy.
  static redact(s, seenThrough){
    if(!Number.isInteger(seenThrough) || !s.midSeason) return;
    const ms = s.midSeason;
    const later = (ms.log || []).filter(tx => Number.isInteger(tx.episode) && tx.episode > seenThrough);
    [...later].reverse().forEach(tx => MidSeasonLogic.revert(s, tx));
    if(later.length) ms.log = ms.log.filter(tx => !later.includes(tx));
    let restored = false;
    WaiverLogic.periods(s).forEach(p => {
      if(p.episode <= seenThrough) return;
      if(p.run && !restored && WaiverLogic.rolling(s)){ ms.priority = p.run.orderBefore; restored = true; }
      p.hidden = true;
      p.claimsIn = [];
      // Who was nudged hints at who has a pickup to make.
      delete p.nudged;
      p.run = null;
      p.autoFills = [];
    });
  }
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
  // scoring event, an exile, a role or a group change, or the word that nobody went home (`noExit`,
  // docs/PLAN-new-design.md step 6c: a shared fact the season sync applies). That's what "this
  // episode has been played" means everywhere below.
  static hasResults(ep){
    return !!ep && (!!ep.noExit || (ep.events||[]).length > 0 || (ep.scoringEvents||[]).length > 0 || (ep.exiled||[]).length > 0
      || (ep.roles||[]).length > 0 || (ep.groups||[]).length > 0);
  }
  // Nobody went home in this episode (on), or that's taken back (off). Only the season sync's shared
  // "nobody went home" fact sets it (decision-apply.ts).
  static setNoExit(state, epId, on){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return false;
    if(on) ep.noExit = true;
    else delete ep.noExit;
    return true;
  }
  // Results arrive in stages (docs/PLAN-new-design.md step 2): 'early' while only who went home is in (a quick
  // check: Survival Pool and Outlast settle, Weekly Lineup scores so far), 'final' once the full results are
  // (every scoring moment). Null with nothing in yet. The mark (ep.resultsStage = 'early') is set by whoever
  // applies the early results and taken off when the full ones are applied; absent means final, which is every
  // episode from before stages existed and any entered by hand.
  static resultsStage(ep){
    if(!EpisodeLogic.hasResults(ep)) return null;
    return ep.resultsStage === 'early' ? 'early' : 'final';
  }
  static setResultsStage(state, epId, stage){
    const ep = state.episodes.find(e => e.id === epId);
    if(!ep) return false;
    if(stage === 'early') ep.resultsStage = 'early';
    else delete ep.resultsStage;
    return true;
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
  // results, then the next one is created. Stops once the season is over (seasonEnded: a winner is
  // crowned by the format's winner exit method -- Survivor's is Sole Survivor -- or, where nobody wins,
  // nobody is left).
  static ensureUpcoming(state){
    if(gameOver(state)) return false;
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
  // Once the season is over (a winner crowned, or, where nobody wins, nobody left) nothing more is
  // created, and any trailing episode that is completely empty (no results, bets or picks) and
  // numbered after the finale is removed -- the reveal of the finale creates a "next" episode before
  // anyone has confirmed the winner, and it shouldn't outlive that. Returns true if it changed anything.
  static ensureNextEpisode(state){
    if(!Array.isArray(state.episodes)) state.episodes = [];
    // A game over a span that's over makes no more episodes (its season's results still arrive as they're accepted).
    if(!seasonEnded(state) && gameOver(state)) return false;
    if(seasonEnded(state)){
      const finale = finaleEpisodeOf(state);
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
        // here even if it survived the connector's own validation. `units`: a count research reported.
        const added = ActiveRosterLogic.addEvent(state, ep.id, sev.type, castaway.id, sev.units);
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
// The game spec's (extras.bets: one definition).
const MAX_BET_POINTS = Spec.MAX_BET_POINTS;
const clampBetPoints = Spec.clampBet;
class BetLogic {
  // A bet's lock (A4): its episode's, as a lineup's (closedForPlay: at its start, unless whoever runs the game kept it open
  // or locked it early), and for good once it has results. Nothing is bet, guessed or taken back after it.
  static closed(ep){ return !!ep && (closedForPlay(ep) || EpisodeLogic.hasResults(ep)); }
  // A bet goes on an episode this game plays (inPlay): one before its start or after a span's last episode would never pay.
  // Never once it's locked.
  static add(state, epId, label, points, createdByPlayerId){
    const ep = state.episodes.find(e=>e.id===epId);
    if(!ep || !label || !inPlay(state, ep.number) || KnockoutLogic.endedBefore(state, ep.number) || BetLogic.closed(ep)) return;
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
  // A guess on a bet this game plays (one on an episode now outside its span, its start moved past it, never pays), until
  // its episode locks.
  static addPrediction(state, epId, betId, playerId, guess){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    if(!bet || !guess || !inPlay(state, ep.number) || KnockoutLogic.endedBefore(state, ep.number) || BetLogic.closed(ep)) return;
    bet.predictions = bet.predictions || [];
    const pred = { id: Core.uid('pred'), playerId, guess, correct: null };
    bet.predictions.push(pred);
    return pred;
  }
  // Taken back only until its episode locks.
  static removePrediction(state, epId, betId, predId){
    const ep = state.episodes.find(e=>e.id===epId);
    const bet = ep && (ep.bets||[]).find(b=>b.id===betId);
    if(bet && !BetLogic.closed(ep)) bet.predictions = bet.predictions.filter(p=>p.id!==predId);
  }
  // Which episode a new side bet belongs to when someone proposes one from the Overview: the one
  // about to be played. A league catching up bets on the next episode it hasn't revealed yet; a live
  // league bets on its latest episode. Returns a NUMBER, not an episode, because in a brand-new league
  // there may be no episode at all yet -- see addToUpcoming.
  // Live, never past the one after the latest with results: an episode made ahead of that (a game's start moved later
  // makes every episode up to it, and the start can move back) is still to come, not this week's.
  static upcomingEpisodeNumber(state){
    const next = RevealLogic.nextEpisode(state);
    if(next !== null) return next;
    const nums = state.episodes.map(e=>e.number);
    return nums.length ? Math.min(Math.max(...nums), SpoilerLogic.latestWithResults(state) + 1) : 1;
  }
  // The episode a bet proposed now goes on: the one about to be played, never before the game's start (a game that
  // starts later takes bets on its first episode, as currentEpisode asks for its picks), and null once a span's last
  // episode is past (docs/BACKLOG.md item 10: a bet after the end went on a later episode and never paid), or the game is
  // over (gameOver: its last episode has results, which a live league's latest episode can be until the next is made).
  static target(state){
    return gameOver(state) ? null : currentEpisodeNumber(state);
  }
  // Proposing a bet from the Overview. Creates the target episode first if it doesn't exist -- a new
  // league has no episodes until the first one is opened or revealed, and a bet proposed before then
  // used to have nothing to attach to and failed with a bare "Request failed". Nothing once the game is over.
  static addToUpcoming(state, label, points, createdByPlayerId){
    const number = BetLogic.target(state);
    if(number === null) return;
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
  // The finale's real answers come from the results (AnswerLogic.finaleActual, step A4): state.finaleActual, where whoever
  // ran the game used to type them in, is read by nothing now.
}

// ---------- AnswerLogic: a game's questions (docs/PLAN-start-a-game-gpt.md step A4) ----------
// The spec's `ask` (game-spec schema.js): a draft's finale predictions, Weekly Calls' calls (Call it's, graded in
// src/lib/server/calls.ts) or a game of questions' own. Graded from the league's own results, as the viewer's state says
// them (pass the spoiler guard's view, and nothing past their mark is graded), by game-spec answers.js; never stored.
// Answers to a game of questions live in game_answers (src/lib/server/answers.ts reads them in); a draft's finale
// predictions in state.finalePredictions, where classic's finale panel writes them.
class AnswerLogic {
  // What the results say, for grading (answers.js's facts): the game's own episodes with results (who went home in each,
  // who was still in at its start and the group each person was on in it; once the full results are in, every moment's
  // count, who each one happened to and how many times, and everyone's secret role as of it), the season's winner and, once
  // it's over, the order everyone finished in. All of it from the state it's given: the viewer's copy (the spoiler guard's
  // view) has no swap, role or result past their mark, so none is graded or named.
  static facts(state){
    const span = gameOf(state).span;
    const from = Spec.spanStart(span);
    const episodes = new Map();
    const eps = [...(state.episodes || [])].sort((a, b) => a.number - b.number);
    const epNo = new Map(eps.map(e => [e.id, e.number]));
    const cast = state.castaways || [];
    // Each person's group episode by episode: where they started (GroupLogic: startTribeId once they've moved), then each
    // change an episode recorded (a swap, the merge), from that episode on.
    const group = new Map(cast.map(c => [c.id, (c.startTribeId !== undefined ? c.startTribeId : c.tribeId) || null]));
    // Each person's secret role the same way (RoleLogic.roleOf, in one pass): the latest an episode recorded, else the default.
    const roles = formatOf(state).roles;
    const role = new Map();
    eps.forEach(ep => {
      (ep.groups || []).forEach(g => group.set(g.castawayId, g.tribeId || null));
      (ep.roles || []).forEach(r => role.set(r.castawayId, r.role));
      if(!inPlay(state, ep.number)) return;
      const stage = EpisodeLogic.resultsStage(ep);
      if(!stage) return;
      // Still in at its start: nobody who left in an episode before it.
      const stillIn = cast.filter(c => !(c.status === 'eliminated' && (epNo.get(c.exitEpisodeId) || 0) < ep.number)).map(c => c.id);
      // Who went home in it, as a pool grades it (R1 part 3, nightOf): its exits but a winner's, and on the winner's night
      // anyone else still in whose exit isn't recorded.
      const night = nightOf(state, ep);
      const out = [...night.gone, ...(night.won.size ? stillIn.filter(id => !night.won.has(id) && !night.gone.has(id)) : [])];
      let events = null;
      let who = null;
      let roleOf = null;
      let points = null;
      if(stage === 'final'){
        events = new Map();
        who = new Map();
        points = new Map();
        ActiveRosterLogic.episodeEvents(state, ep).forEach(ev => {
          const n = Number.isFinite(ev.units) && ev.units > 0 ? ev.units : 1;
          events.set(ev.type, (events.get(ev.type) || 0) + n);
          if(!ev.castawayId) return;
          if(!who.has(ev.type)) who.set(ev.type, new Map());
          const m = who.get(ev.type);
          m.set(ev.castawayId, (m.get(ev.castawayId) || 0) + n);
          // Each person's points by the game's rules (A8: a points leaderboard), as the engine scores a moment.
          points.set(ev.castawayId, (points.get(ev.castawayId) || 0) + ActiveRosterLogic.eventPoints(state, ev));
        });
        roleOf = new Map(roles ? cast.map(c => [c.id, role.has(c.id) ? roles.roleFor(role.get(c.id)) : roles.default]) : []);
      }
      episodes.set(ep.number, { out, events, who, in: stillIn, groups: new Map(group), roles: roleOf, points });
    });
    const winner = seasonWinner(state);
    const ended = seasonEnded(state);
    // The episode the season ended in (A11 part 2b: what was known through an episode, answers.js factsThrough).
    const finaleEp = ended ? finaleEpisodeOf(state) : null;
    // Where each phase started (A7: state.phaseStarts, recorded from the season's confirmed starts), once the viewer has seen
    // that episode: a start confirmed ahead, or past their mark, says nothing yet.
    const seen = SpoilerLogic.latestWithResults(state);
    const starts = state.phaseStarts || {};
    const phases = new Map(Object.entries(starts).filter(([, n]) => Number.isInteger(n) && n <= seen));
    // The game's phase windows (state.phaseWindows), in order, each with the start it opened for: one ends where the next opens,
    // once the viewer has seen that next phase begin.
    const windows = Object.entries(state.phaseWindows || {})
      .filter(([, at]) => Number.isInteger(at))
      .map(([phase, at]) => ({ phase, at, from: Number.isInteger(starts[phase]) ? starts[phase] : at }))
      .sort((a, b) => a.at - b.at);
    return {
      from, to: Spec.spanEnd(span), over: gameOver(state), episodes,
      winner: winner ? winner.id : null, ended, order: ended ? AnswerLogic.finishOrder(state) : null,
      endedAt: finaleEp ? finaleEp.number : null,
      names: new Map(cast.map(c => [c.id, c.name])),
      groupNames: new Map((state.tribes || []).map(t => [t.id, t.name])),
      phases, windows, seen,
      startIn: AnswerLogic.startIn(state),
      // The finalists' jury votes (A8: the split), once the season is over.
      jury: ended ? new Map(eps.flatMap(e => (e.events || []).filter(ev => Number.isInteger(ev.juryVotes)).map(ev => [ev.castawayId, ev.juryVotes]))) : null,
    };
  }
  // Everyone by where they finished, the winner first: the later they left the better, and in the same episode a finalist
  // (the format's endgame exits: lost the final vote, or won it) above whoever left before the final vote, the finalists by
  // their jury votes; then the order their results came in (placementOrder). Only who has left.
  static finishOrder(state){
    const f = formatOf(state);
    const endgame = new Set(f.endgameExitMethods || []);
    const epNo = new Map((state.episodes || []).map(e => [e.id, e.number]));
    const votes = new Map();
    (state.episodes || []).forEach(e => (e.events || []).forEach(ev => { if(Number.isInteger(ev.juryVotes)) votes.set(ev.castawayId, ev.juryVotes); }));
    const key = c => [isWinnerExit(state, c.exitMethod) ? 1 : 0, epNo.get(c.exitEpisodeId) || 0, endgame.has(c.exitMethod) ? 1 : 0, votes.get(c.id) || 0, c.placementOrder];
    return (state.castaways || [])
      .filter(c => c.status === 'eliminated' && typeof c.placementOrder === 'number')
      .map(c => ({ id: c.id, k: key(c) }))
      .sort((a, b) => { for(let i = 0; i < a.k.length; i++){ if(a.k[i] !== b.k[i]) return b.k[i] - a.k[i]; } return 0; })
      .map(x => x.id);
  }
  // The spec's questions, whole (each with its defaults).
  static questions(state){ return gameOf(state).ask; }
  // Who was in at the game's first episode (A8: a pairs question's pairs are drawn from them, by the grader and the server
  // alike): nobody who'd left in an episode before it. None while it waits for its phase.
  static startIn(state){
    const first = startEpisode(state);
    if(first === null) return [];
    const epNo = new Map((state.episodes || []).map(e => [e.id, e.number]));
    return (state.castaways || []).filter(c => !(c.status === 'eliminated' && (epNo.get(c.exitEpisodeId) || 0) < first)).map(c => c.id);
  }
  // Whether the game asks anything by phase (A7: asked once a phase, or settled by where a phase starts): what the season sync
  // and the desk record phase starts and windows for (phase-starts.ts settleIn, StateLogic.settlePhases).
  static byPhase(state){ return AnswerLogic.questions(state).some(q => q.asked === 'phase' || (q.settle && q.settle.by === 'phase')); }
  // Where a question's windows open (A7), in order: asked each, every episode the game plays; every N, each run of N from its
  // first; by phase, its first, then where each later phase's opened (state.phaseWindows); asked once, none (its key is 0).
  // `seen` (a viewer's mark; none: everything): a phase window shows only once they're up to the episode before it, so someone
  // further behind never learns a phase began.
  static windowStarts(state, q, seen){
    const first = startEpisode(state);
    if(q.asked === 'once' || first === null) return [];
    const last = endEpisode(state);
    const upTo = last !== null ? last : Math.max(first, ...(state.episodes || []).map(e => e.number));
    if(q.asked === 'phase'){
      const shown = (n) => !Number.isInteger(seen) || n <= seen + 1;
      const later = Object.values(state.phaseWindows || {}).filter(n => Number.isInteger(n) && n > first && (last === null || n <= last) && shown(n));
      return [first, ...[...new Set(later)].sort((a, b) => a - b)];
    }
    const step = q.asked === 'every' ? q.every : 1;
    const out = [];
    for(let n = first; n <= upTo; n += step) out.push(n);
    return out;
  }
  // Whether a question's window opens at `episode` (its answers' key), and the one an episode is in (the latest that opens at or
  // before it), or null.
  static opensAt(state, q, episode){
    if(q.asked === 'once') return episode === 0;
    if(q.asked === 'each') return inPlay(state, episode);
    return inPlay(state, episode) && AnswerLogic.windowStarts(state, q).includes(episode);
  }
  static windowAt(state, q, episode, seen){
    if(q.asked === 'once' || !Number.isInteger(episode)) return null;
    if(q.asked === 'each') return inPlay(state, episode) ? episode : null;
    const at = AnswerLogic.windowStarts(state, q, seen).filter(n => n <= episode);
    return at.length ? at[at.length - 1] : null;
  }
  // The episode whose start closes a question's answers: its window's first (asked each, every N or by phase: `episode`, the
  // answers' key), the game's first (asked once: null while it waits for its phase), or the season's last (closes at the
  // finale: `finale`, from its schedule; null when unknown).
  static closesAt(state, q, episode, finale){
    if(q.asked !== 'once') return episode;
    if(q.closes === 'finale') return Number.isInteger(finale) ? finale : null;
    return startEpisode(state);
  }
  // Whether a question's answers are closed (for an episode, asked each): at the start of the episode that closes it
  // (closedForPlay, so whoever runs the game can keep it open past its start or lock it early; `airAt` that episode's air
  // time from the schedule, for one the league hasn't made yet, never for a league catching up at its own pace, which
  // air-times.ts leaves off the broadcast's clock), once it has results, once the game is over, and for an episode the game
  // doesn't play. Nothing settles a question before it closes (each episode's closes at its start; one asked once at the
  // game's first, or, for who wins or makes the final few, the season's last: specProblems), so the lock never needs the
  // results, and says nothing of them to someone who hasn't seen them. A finale nobody's listed yet: at the game's end.
  // A game with a late lock (A7: extras.lateLock) keeps a question open for someone who hasn't seen the episode that closes it
  // (`mark`, their spoiler mark, before it) until its air time plus the lock's hours: they answer before they watch.
  //   o: { now, finale (the season's last episode, from its schedule), airAt, mark (the one answering's; null: sees all) }
  static closed(state, q, episode, o){
    const opt = o || {};
    if(q.asked !== 'once' && !AnswerLogic.opensAt(state, q, episode)) return true;
    if(gameOver(state)) return true;
    const at = AnswerLogic.closesAt(state, q, episode, opt.finale);
    if(at === null) return false;
    const ep = state.episodes.find(e => e.number === at) || { number: at };
    const airsAt = ep.airsAt || (RevealLogic.isCatchingUp(state) ? null : opt.airAt || null);
    const late = gameOf(state).extras.lateLock;
    if(late && Number.isInteger(opt.mark) && opt.mark < at && airsAt && !ep.lineupsLocked){
      const now = opt.now !== undefined ? Number(opt.now) : Date.now();
      if(now < Date.parse(airsAt) + late.hours * 3600 * 1000) return false;
    }
    return EpisodeLogic.hasResults(ep) || closedForPlay({ ...ep, airsAt }, opt.now);
  }
  // The episode someone answers for now with a late lock (A7): the one after their mark while it's still open for them, else
  // this week's (episodeNow).
  //   o: { now, airAtOf (an episode's air time from the schedule, for one the league hasn't stamped) }
  static lateEpisode(state, mark, o){
    const now = AnswerLogic.episodeNow(state);
    if(!gameOf(state).extras.lateLock || !Number.isInteger(mark) || now === null || mark + 1 >= now) return now;
    const next = mark + 1;
    const opt = { now: o && o.now, airAt: o && o.airAtOf ? o.airAtOf(next) : null, mark };
    const open = AnswerLogic.questions(state).some(q => q.asked !== 'once' && AnswerLogic.opensAt(state, q, next) && !AnswerLogic.closed(state, q, next, opt));
    return open ? next : now;
  }
  // The episode a question asked each episode is answered for now: this week's (currentEpisodeNumber: the one picks and
  // lineups are for), or null (waiting for its phase, past its end).
  static episodeNow(state){ return currentEpisodeNumber(state); }
  // Grading a set of answers ([{ playerId, question, episode, answer, late?, changes? }]: episode 0 for one asked once; late
  // and changes, when it was made: game_answers') to the spec's questions: { points: Map playerId -> points, verdicts: Map
  // 'question|episode' -> verdict, earned: Map 'question|episode' -> Map playerId -> points (each window's, A9's ways of
  // combining in), worth: Map 'question|episode' -> a rollover's window's points with its jackpot }. An answer to a question
  // the game doesn't ask, or for an episode it doesn't play, earns nothing.
  //   A9: a question that rolls over is graded window by window from its first (one nobody answered rolls over too), each
  //   one's points what the windows before it left unclaimed; a window still to settle stops it there, so nothing after it
  //   counts until it does. A parlay multiplies the points of whoever's right on every one of its questions in a window.
  static grade(state, answers, facts){
    const f = facts || AnswerLogic.facts(state);
    const qs = new Map(AnswerLogic.questions(state).filter(q => !Spec.isCalls(q)).map(q => [q.id, q]));
    // Only the players this copy of the league has: a viewer's has the late joiners they can't see taken out (viewFor).
    const seats = new Set((state.players || []).map(p => p.id));
    const groups = new Map();
    // Each question's windows, worked out once (A7).
    const starts = new Map();
    const windows = q => {
      if(!starts.has(q.id)){ const list = AnswerLogic.windowStarts(state, q); starts.set(q.id, { list, set: new Set(list) }); }
      return starts.get(q.id);
    };
    const opens = (q, ep) => (q.asked === 'each' ? inPlay(state, ep) : windows(q).set.has(ep) && inPlay(state, ep));
    (answers || []).forEach(a => {
      const q = qs.get(a.question);
      if(!q || !seats.has(a.playerId)) return;
      // An answer is for its window (the episode it opens at; 0 asked once): one that opens nowhere earns nothing.
      const ep = q.asked === 'once' ? 0 : a.episode;
      if(q.asked !== 'once' && !opens(q, ep)) return;
      const key = q.id + '|' + ep;
      if(!groups.has(key)) groups.set(key, { q, ep, list: [] });
      const row = { playerId: a.playerId, answer: a.answer };
      // When it was made (A9's shrinking calls), only when it's said.
      if(Number.isInteger(a.late)) row.late = a.late;
      if(Number.isInteger(a.changes)) row.changes = a.changes;
      groups.get(key).list.push(row);
    });
    const verdicts = new Map();
    const earned = new Map();
    const worth = new Map();
    groups.forEach(({ q, ep, list }, key) => {
      const v = Spec.verdictOf(q, ep, f);
      verdicts.set(key, v);
      if(!q.rollover) earned.set(key, Spec.windowPoints(q, v, list, f));
    });
    // A9: each question that rolls over, window by window.
    qs.forEach(q => {
      if(!q.rollover || q.asked === 'once') return;
      let carry = 0;
      for(const ep of windows(q).list.filter(n => inPlay(state, n))){
        const key = q.id + '|' + ep;
        const v = verdicts.get(key) || Spec.verdictOf(q, ep, f);
        // The first window still to settle has its jackpot (what the read shows it's for); nothing after it is known yet.
        const w = q.points + carry;
        worth.set(key, w);
        if(v.state === 'waiting') break;
        const got = Spec.windowPoints(q, v, groups.has(key) ? groups.get(key).list : [], f, { worth: w });
        if(groups.has(key)) earned.set(key, got);
        carry = [...got.values()].some(n => n > 0) ? 0 : w;
      }
    });
    // A9: the parlays, each window their questions share.
    (gameOf(state).score.parlays || []).forEach(p => {
      const legs = p.of.map(id => qs.get(id));
      if(legs.some(q => !q)) return;
      const eps = new Set([...groups.values()].filter(g => g.q === legs[0]).map(g => g.ep));
      eps.forEach(ep => {
        const keys = legs.map(q => q.id + '|' + ep);
        if(keys.some(k => !groups.has(k))) return;
        const right = Spec.allRight(legs.map((q, i) => ({ q, v: verdicts.get(keys[i]), answers: groups.get(keys[i]).list })), f);
        right.forEach(pid => keys.forEach(k => {
          const m = earned.get(k);
          if(m && m.has(pid)) m.set(pid, roundPoints(m.get(pid) * p.times));
        }));
      });
    });
    const points = new Map();
    // To the cent: a split pot's shares are.
    earned.forEach(m => m.forEach((n, pid) => points.set(pid, roundPoints((points.get(pid) || 0) + n))));
    return { points, verdicts, earned, worth };
  }
  // ---------- A11 part 2b: a game of questions' race, cuts and lives (game-spec answerParts) ----------
  // A game of questions is scored from its answers, which live outside the state (game_answers), so its race, its cuts on points
  // and its lives (a wrong answer, or none, costs one; at none you're out) are walked over its graded answers by whoever holds
  // them: the server (src/lib/server/answer-points.ts), on each copy of the league it reads, the viewer's own (spoiler-trimmed, so
  // nobody is knocked out by what they haven't seen) and the league as it stands (for the refusals). It hands the result to the
  // engine on a copy of that state (withWalk: `answerWalk`, plain data, never stored), so lastEpisode, gameOver, spanView, the
  // scores' `out` and the rank read it as they read a draft's (KnockoutLogic). A copy that hides anything drops it (viewThrough,
  // viewFor): the walk is that copy's to work out again. A state without one reads as the game would without its knockouts (its
  // span's end, nobody out): the safe fallback.
  //   - Episode by episode, the game's with results, as part 1's series: through each, every player's points from the windows
  //     settled by then (factsThrough: rollovers, shares and parlays as the grade has them).
  //   - A race: the first to `to` points ends it after that episode (the most points then win, a tie sharing it).
  //   - Lives: each question it rides on, asked that episode, once settled: a wrong answer, or none, costs a life (each wrong one
  //     its own). Off (nobody went home, nothing settles it), or a void answer (a group that didn't play as offered), costs
  //     nothing. Everyone left losing their last life the same night: rank.allOut (all out by points, all out sharing it, or all
  //     back with the lives they had), as a pool's.
  //   - Cuts: as a draft's (KnockoutLogic.cut), on the answers' points.
  //   - The newest episode with results waits while it's early (a race or cuts: points still to come) or a question a life rides
  //     on is still to settle there; an earlier one, once a later episode has results, counts as it stands (still to settle costs
  //     nothing). One left of everyone (oneLeft 'ends') ends it.
  //   - Who's in it: as part 1's (a ghost outside; someone catching up in, never losing a life or cut until caught up; a late start
  //     from their start). Someone out answers nothing more (answers.ts refuses it): an answer of theirs for a later episode counts
  //     for nobody (liveAnswers), and their points stay at their last episode in.
  //   - A11 part 3, co-op (parts.coop: rank.by 'coop'): the lives are the couch's together and nobody is knocked out. Each question
  //     a life rides on, settled at an episode, costs the couch one unless enough of it saw it coming (coop.saves: one right answer
  //     among those who answered, more than half of them, or all of them; a void answer counts as none, a night every answer was
  //     void costs nothing, and silence neither helps nor hurts, though a night nobody answered costs one: nobody saw it coming).
  //     Off costs nothing, as above. Whoever's answers count: everyone in it from their start and caught up (a late joiner's from
  //     theirs; a ghost's never). At none
  //     left the game ends there, lost by all; at its end (the span's last episode, or the season's, walked with nothing still to
  //     settle) with one left, won by all. Everyone shares the result (`shared`: all of them), each with the couch's lives.
  //   - A11 part 4b, head to head (parts.matchups: rank.by 'matchups'): nobody is knocked out; the walk hands over its series, each
  //     episode's points through it, for MatchupLogic (an episode's points are what the answers settled by then add: a question about
  //     the whole game, or over several episodes, in the one it settles in). The newest episode waits while its results are early or
  //     a question asked about it alone is still to settle (research unsure); nothing after the game's final (MatchupLogic.endsAt), or
  //     the season's finale once it's over, plays, and the totals stand there once it's walked.
  // Returns { ends, out: { playerId: last episode in }, lives: { playerId: left } (with lives), shared: [playerId] (out together,
  // sharing it), totals: { playerId: points as the table shows them }, coop (co-op only: { lives: left, of: lives at the start,
  // lost: [{ episode, question }], result: 'won' | 'lost' | null while it plays }), series (head to head only: [{ number, totals:
  // { playerId: points through it } }], each episode walked) }, or null for a game with none of it.
  static walk(state, answers, facts){
    const parts = Spec.answerParts(gameOf(state));
    if(!parts) return null;
    const rows = Array.isArray(answers) ? answers : [];
    const start = startEpisode(state);
    const everyone = (state.players || []).filter(p => !isGhost(p) && !p.disabled && p.active !== false);
    const catching = new Set(everyone.filter(p => GhostLogic.isCatchingUp(state, p.id)).map(p => p.id));
    const startOf = new Map(everyone.map(p => [p.id, GhostLogic.startFor(state, p.id)]));
    const qs = new Map(AnswerLogic.questions(state).map(q => [q.id, q]));
    const lifeQs = parts.on.map(id => qs.get(id)).filter(Boolean);
    const to = endEpisode(state);
    const eps = start === null ? [] : (state.episodes || []).filter(e => e.number >= start && (to === null || e.number <= to) && EpisodeLogic.hasResults(e)).sort((a,b) => a.number - b.number);
    const newest = eps.length ? eps[eps.length - 1].number : null;
    const out = new Map();
    const lives = new Map(everyone.map(p => [p.id, parts.lives || 0]));
    const shared = new Set();
    const series = new Map();
    let ends = null;
    const live = () => AnswerLogic.liveRows(state, rows, out);
    // Who can lose a life, be cut or finish a race after episode k: in, started by then, and caught up.
    const inAt = k => everyone.filter(p => !out.has(p.id) && !catching.has(p.id) && (startOf.get(p.id) || start) <= k);
    // A11 part 3: co-op's lives, the couch's together, and the nights they went; whose answers count there at k (in it from their
    // start and caught up, as everywhere in the walk: someone catching up answers nothing yet, answers.ts refuses it); whether the
    // walk reached its newest episode with nothing still to settle.
    const coop = parts.coop;
    let couch = parts.lives || 0;
    const nights = [];
    const counted = k => everyone.filter(p => !catching.has(p.id) && (startOf.get(p.id) || start) <= k);
    let walkedAll = true;
    // A11 part 4b: head to head's last episode, its final's (MatchupLogic.endsAt), or the season's finale once it's over if that came
    // first (a schedule that counts a reunion); the questions asked each episode about it alone, which its newest episode waits on.
    const finale = parts.matchups && seasonEnded(state) ? finaleEpisodeOf(state) : null;
    const endAt = parts.matchups ? MatchupLogic.endsAt(state) : null;
    const stop = finale && (endAt === null || finale.number < endAt) ? finale.number : endAt;
    const aboutOne = parts.matchups ? [...qs.values()].filter(Spec.livesQuestion) : [];
    // A11 part 5b: a handicap, each newcomer's points through each episode walked.
    const tally = parts.handicap ? HandicapLogic.tally(state, eps.map(e => e.number)) : null;
    for(const ep of eps){
      const k = ep.number;
      if(stop !== null && k > stop) break;
      const fk = Spec.factsThrough(facts, k);
      // Lives lost at k: each question a life rides on, settled there.
      const lost = new Map();
      const couchLost = [];
      let waiting = false;
      for(const q of lifeQs){
        const v = Spec.verdictOf(q, k, fk);
        if(v.state === 'waiting'){ waiting = true; continue; }
        if(v.state !== 'known') continue;
        const list = rows.filter(a => a.question === q.id && a.episode === k).map(a => ({ playerId: a.playerId, answer: a.answer }));
        if(coop){
          // The couch's night: of those who answered (a void answer is none), how many saw it coming. A night every answer was void
          // costs nothing, as a void pick does; a night nobody answered at all costs one.
          let said = 0, right = 0, voids = 0;
          counted(k).forEach(p => {
            const mine = list.find(a => a.playerId === p.id);
            if(!mine) return;
            const r = Spec.isRight(q, v, mine, list, fk);
            if(r === null){ voids++; return; }
            said++;
            if(r) right++;
          });
          if(!said && voids) continue;
          const saved = coop.saves === 'all' ? said > 0 && right === said : coop.saves === 'most' ? right * 2 > said : right > 0;
          if(!saved) couchLost.push(q.id);
          continue;
        }
        inAt(k).forEach(p => {
          const mine = list.find(a => a.playerId === p.id);
          if((mine ? Spec.isRight(q, v, mine, list, fk) : false) === false) lost.set(p.id, (lost.get(p.id) || 0) + 1);
        });
      }
      if(parts.matchups && k === newest && !waiting) waiting = aboutOne.some(q => Spec.verdictOf(q, k, fk).state === 'waiting');
      if(k === newest && (waiting || ((parts.race || parts.cuts.length || parts.matchups) && EpisodeLogic.resultsStage(ep) === 'early'))){ walkedAll = false; break; }
      // Head to head's final is the game's end: its questions about the game settle there, as the table's totals have them.
      const totals = AnswerLogic.grade(state, live(), k === stop ? { ...fk, over: true } : fk).points;
      if(tally) tally(k).forEach((n, id) => totals.set(id, roundPoints((totals.get(id) || 0) + n)));
      series.set(k, totals);
      const total = id => totals.get(id) || 0;
      if(coop){
        couchLost.forEach(question => nights.push({ episode: k, question }));
        couch = Math.max(0, couch - couchLost.length);
        if(couch === 0){ ends = k; break; }
        continue;
      }
      if(parts.race && inAt(k).some(p => total(p.id) >= parts.race.to)){ ends = k; break; }
      if(parts.lives && lost.size){
        const left = everyone.filter(p => !out.has(p.id));
        const gone = inAt(k).filter(p => lives.get(p.id) - (lost.get(p.id) || 0) <= 0);
        // Everyone left going out the same night (two or more, nobody catching up still in): the game's allOut.
        const all = gone.length >= 2 && gone.length === left.length;
        if(!(all && parts.allOut === 'back')){
          lost.forEach((n, id) => lives.set(id, Math.max(0, lives.get(id) - n)));
          gone.forEach(p => { out.set(p.id, k); if(all && parts.allOut === 'share') shared.add(p.id); });
        }
      }
      // Its cuts, as a draft's (the points through the last episode walked at or before a window's start).
      const before = n => { const at = [...series.keys()].filter(x => x <= n && x < k).pop(); return at === undefined ? null : series.get(at); };
      KnockoutLogic.cutAfter(state, parts.cuts, { k, start, quiet: !!ep.noExit, inAt, total, before, out });
      if((parts.lives || parts.cuts.length) && parts.oneLeft === 'ends' && everyone.length >= 2 && everyone.filter(p => !out.has(p.id)).length <= 1){ ends = k; break; }
    }
    // The points the table shows: at the game's end (a race won, one left, head to head's final walked: its questions about the game
    // settle there), or as they stand; someone out, as they stood at their last episode in.
    const at = ends !== null ? ends : stop !== null && series.has(stop) ? stop : null;
    const final = at === null ? facts : { ...Spec.factsThrough(facts, at), over: true };
    const points = AnswerLogic.grade(state, live(), final).points;
    const totals = {};
    // A11 part 5b: the handicap through the game's end, else every episode with results (as the points stand); someone out, through
    // their last episode in.
    const handicap = tally ? tally(at === null ? Infinity : at) : null;
    const handicaps = {};
    (state.players || []).forEach(p => {
      const k = out.get(p.id);
      const frozen = Number.isInteger(k) && series.has(k);
      totals[p.id] = frozen ? series.get(k).get(p.id) || 0 : roundPoints((points.get(p.id) || 0) + (handicap ? handicap.get(p.id) || 0 : 0));
      if(tally) handicaps[p.id] = (frozen ? tally(k) : handicap).get(p.id) || 0;
    });
    if(coop){
      // Won by all once the game is over (its span's last episode in, or the season's end) with a life left and nothing still to
      // settle, having played at least one episode; lost by all where the last one went; else still playing. Everyone shares it,
      // each with the couch's lives.
      const result = ends !== null ? 'lost' : facts && facts.over && walkedAll && eps.length > 0 ? 'won' : null;
      return {
        ends,
        out: {},
        lives: Object.fromEntries(everyone.map(p => [p.id, couch])),
        shared: everyone.map(p => p.id),
        totals,
        coop: { lives: couch, of: parts.lives, lost: nights, result },
      };
    }
    return {
      ends,
      out: Object.fromEntries(out),
      lives: parts.lives ? Object.fromEntries(lives) : {},
      shared: [...shared],
      totals,
      // A11 part 4b: head to head's episodes, for MatchupLogic.series; part 5, teams of players' (TeamLogic, through seatSeries).
      ...(parts.matchups || parts.teams ? { series: [...series].map(([number, t]) => ({ number, totals: Object.fromEntries(t) })) } : {}),
      // A11 part 5b: each one's handicap, as their points have it.
      ...(parts.handicap ? { handicap: handicaps } : {}),
    };
  }
  // A copy of `state` carrying a game of questions' walk (AnswerLogic.walk, worked out on exactly this state's data): never the
  // state itself, so nothing that's saved carries it.
  static withWalk(state, walk){ return walk ? { ...state, answerWalk: walk } : state; }
  // The walk a state carries (a game of questions that races or knocks players out), or null.
  static walkOf(state){
    const w = state && state.answerWalk;
    return w && Spec.answerParts(gameOf(state)) ? w : null;
  }
  // A game of questions' answers that count: someone out keeps only their answers to windows settled by their last episode in (an
  // episode's own, a run of them that ended by then); one about the game (asked once) or a window still open then counts for
  // nobody, so their points stay where they were and they take no share of anyone else's. `out`: Map or { playerId: episode }.
  static liveRows(state, rows, out){
    const at = id => (out instanceof Map ? out.get(id) : out && out[id]);
    const qs = new Map(AnswerLogic.questions(state).map(q => [q.id, q]));
    const starts = new Map();
    // Where a window opening at `ep` ends: its own end (over N, every N), else where the next phase's opens (null: not known yet).
    const endOf = (q, ep) => {
      if(q.asked === 'each') return ep + (Number.isInteger(q.over) && q.over > 1 ? q.over - 1 : 0);
      if(q.asked === 'every') return ep + q.every - 1;
      if(!starts.has(q.id)) starts.set(q.id, AnswerLogic.windowStarts(state, q));
      const next = starts.get(q.id).find(n => n > ep);
      return next === undefined ? null : next - 1;
    };
    return (rows || []).filter(a => {
      const k = at(a.playerId);
      if(!Number.isInteger(k)) return true;
      const q = qs.get(a.question);
      if(!q) return true;
      if(q.asked === 'once') return false;
      const end = endOf(q, a.episode);
      return end !== null && end <= k;
    });
  }
  // The answers that count as a state's walk has it (all of them without one).
  static liveAnswers(state, rows){
    const w = AnswerLogic.walkOf(state);
    return w ? AnswerLogic.liveRows(state, rows, w.out) : rows || [];
  }
  // The score rows with a game of questions' walk on them: each one's `out`, their points as the walk has them (frozen once out),
  // lives left, and `shared` for those who went out together sharing it; ranked as the game ranks (rankKey).
  static applyWalk(state, rows, walk){
    AnswerLogic.walkRows(rows, walk);
    // A11 part 3: co-op's rows share one place, listed by their points (who called the most).
    return rows.sort((a,b) => PickEmScoringStrategy.compareKeys(rankKey(state, b), rankKey(state, a)) || (walk.coop ? b.total - a.total : 0));
  }
  // The walk's fields on each score row (its `out`, points, lives left, `shared`), not ranked: applyWalk ranks them, head to head
  // ranks them itself (A11 part 4b: MatchupLogic.apply).
  static walkRows(rows, walk){
    rows.forEach(r => {
      const k = walk.out[r.playerId];
      r.out = Number.isInteger(k) ? k : null;
      r.total = walk.totals[r.playerId] || 0;
      if(walk.lives && r.playerId in walk.lives) r.lives = walk.lives[r.playerId];
      if(walk.shared.includes(r.playerId)) r.shared = true;
      // A11 part 5b: a handicap's points, in the total already.
      if(walk.handicap) r.handicap = walk.handicap[r.playerId] || 0;
    });
    return rows;
  }
  // How many of the game's episodes had started at `o.now` (A9: when an answer was made, for a call whose points shrink), from
  // its first: each one's lock (closedForPlay, the schedule's air time `o.airAtOf(n)` for one the league hasn't made yet,
  // never for a league catching up at its own pace), or its results. None while it waits for its phase.
  //   o: { now, airAtOf }
  static started(state, o){
    const first = startEpisode(state);
    if(first === null) return 0;
    const last = endEpisode(state);
    const now = o && o.now !== undefined ? Number(o.now) : Date.now();
    const catching = RevealLogic.isCatchingUp(state);
    let n = 0;
    for(let at = first; last === null || at <= last; at++){
      const ep = state.episodes.find(e => e.number === at) || { number: at };
      const airsAt = ep.airsAt || (catching || !(o && o.airAtOf) ? null : o.airAtOf(at));
      if(!(EpisodeLogic.hasResults(ep) || closedForPlay({ ...ep, airsAt }, now))) break;
      n++;
    }
    return n;
  }
  // A draft's finale predictions as answers to its two questions (state.finalePredictions: the final three and the winner
  // each player named), or none when it has no finale predictions.
  static finaleAnswers(state){
    if(!finaleOfGame(state)) return [];
    const out = [];
    (state.finalePredictions || []).forEach(fp => {
      const top3 = (fp.top3 || []).filter(Boolean);
      if(top3.length) out.push({ playerId: fp.playerId, question: 'top3', episode: 0, answer: top3 });
      if(fp.winner) out.push({ playerId: fp.playerId, question: 'winner', episode: 0, answer: fp.winner });
    });
    return out;
  }
  // A draft's finale predictions graded: Map playerId -> points. Settled by the results once the season is over (before A4,
  // by the result whoever ran it entered by hand). Read on every score, so only what the season's end says is worked out:
  // its two questions are the season's (who wins, who makes the final three), never an episode's.
  static finalePoints(state){
    const answers = AnswerLogic.finaleAnswers(state);
    if(!answers.length) return new Map();
    const winner = seasonWinner(state);
    const ended = seasonEnded(state);
    const facts = { from: null, to: null, over: ended, episodes: new Map(), winner: winner ? winner.id : null, ended, order: ended ? AnswerLogic.finishOrder(state) : null, names: new Map() };
    return AnswerLogic.grade(state, answers, facts).points;
  }
  // The finale's real answers, as the results say them (the season's winner, and its final three by where they finished),
  // or nulls while the season runs: what classic's finale panel shows, where whoever ran it used to type them in.
  static finaleActual(state){
    const f = AnswerLogic.facts(state);
    const top3 = f.order ? f.order.slice(0, 3) : [];
    return { top3: [0, 1, 2].map(i => top3[i] || null), winner: f.winner };
  }
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
  // episode is revealed, so a winner here is one the league has seen), or a game over a span has revealed
  // its last episode (gameOver). Nothing is left to reveal then -- without this the panel kept offering
  // "episode N+1" past the finale, and past a span's end (docs/BACKLOG.md item 10).
  static isComplete(state){
    const end = endEpisode(state);
    const r = RevealLogic.revealedThrough(state);
    return gameOver(state) || (end !== null && r !== null && r >= end);
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
    // A game of questions' walk (A11 part 2b) was worked out on more than this copy holds: it's the copy's to work out again.
    delete s.answerWalk;
    // A12 part 1: a game in stages' walk, each stage's tables through this mark only.
    if(s.stageWalk) s.stageWalk = StageLogic.cutWalk(s.stageWalk, seenThrough);
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
      ep.events = []; ep.scoringEvents = []; ep.exiled = []; ep.roles = []; ep.groups = []; delete ep.formatGroups;
      delete ep.resultsStage; delete ep.noExit;
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
    // Pickups and add/drops since their mark, and those weeks' waivers (docs/PLAN-midseason-waivers.md).
    WaiverLogic.redact(s, seenThrough);
    // The finale's real answers only exist once the winner is out; hidden, they'd spoil the finale.
    if(!seasonWinner(s)) s.finaleActual = { top3: [null, null, null], winner: null };
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
//                       lock-ins and waivers (inLeagueRotation). Cleared by the
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
  // The episode a player's own season starts at: the league's, or a late joiner's own (later) one. Null while the
  // league waits for its phase (step A3): nobody's season has started.
  static startFor(state, playerId){
    const start = startEpisode(state);
    if(start === null) return null;
    const lj = GhostLogic.lateJoinOf(state, playerId);
    const own = lj && Number.isInteger(lj.startEpisode) ? lj.startEpisode : 1;
    return Math.max(start, own);
  }
  // A league is underway -- too late to just slot in -- once its draft is done or an episode has results.
  static isUnderway(state){
    const turn = DraftLogic.currentTurn(state);
    // Results before the league's own start are history, not play: a game started mid-season (step 10 part 2b) takes
    // newcomers into its draft until it has a result of its own.
    // One waiting for its phase (step A3) has no results of its own yet.
    const start = startEpisode(state);
    return !!(turn && turn.isComplete) || (start !== null && SpoilerLogic.latestWithResults(state) >= start);
  }
  // On unless a commissioner switched it off (absent = on, so it covers every league that predates it), or locked the game down.
  // A11 part 1: nor once someone is knocked out of the game (a newcomer would join a field already cut: the fallback). Part 5c: the
  // same rule for every game that knocks people out (someoneOut).
  // A12 part 1: nor once a game in stages' first stage has started (a seat joins it to join every stage: StageLogic.started).
  static allowed(state){ return gameOf(state).extras.join !== 'locked' && !GhostLogic.lockedDown(state) && !GhostLogic.someoneOut(state) && !StageLogic.started(state); }
  // Whether anyone playing the league's own season is out of the game for good: a draft's cuts and a game of questions' walk
  // (KnockoutLogic.outs; a game of questions' only where the state carries its walk, which the server's copy as it stands does:
  // answer-points.ts asItStands, so whatever reads joining walks it first), or a pool's lives run out with no buyback left
  // (PickEmLogic: their history's `out`). A late joiner's private season (a ghost) or a seat that left doesn't count.
  static someoneOut(state){
    if(KnockoutLogic.outs(state).size) return true;
    const parts = PickEmLogic.parts(state);
    if(!parts || parts.lives === null) return false;
    // The pool's walk once when it walks everyone together, else each seat's own season until someone's out.
    const w = PickEmLogic.together(parts) ? PickEmLogic.walk(state, parts) : null;
    return (state.players || []).some(p => {
      if(isGhost(p) || p.disabled || p.active === false) return false;
      const h = w ? w.of.get(p.id) : PickEmLogic.solo(state, p.id, parts, null);
      return !!h && Number.isInteger(h.out);
    });
  }
  // Lock it down (the new design's competitive mode, step 15 part 4): no late joins, no catch-up, rules frozen for the season.
  // Joining closes here (allowed, so joinMode and classic's join code agree); the rest is the new design's Game settings and
  // Scoring rules refusing changes (backstage-games.ts). Kept apart from allowLateJoiners, so turning it off leaves Who can
  // join as it was.
  static lockedDown(state){ return gameOf(state).extras.lockedDown === true; }
  // Whether castaways can be on several teams here (shared ownership, or a game with no teams at all: Survival Pool),
  // so a new player takes nothing from anyone and may catch up on what they missed.
  static sharedJoin(state){
    return !piecesOf(state).hasRoster || ownershipModeOf(state) === 'shared';
  }
  // Who can join (the new design's Game settings, step 9): 'open' anyone on the couch joins on their own, 'ask' they
  // ask and whoever runs the game lets them in, 'locked' nobody new. settings.joinMode when set; else a game closed to
  // late joiners is locked, and the recommended one for its ownership otherwise (shared open, exclusive ask). An exclusive
  // game is never open (its castaways are one team's each), so it falls back to ask.
  static joinMode(state){
    // Classic's late-joiner switch off closes it, whatever was chosen here (the spec reads it as locked: extras.join).
    if(!GhostLogic.allowed(state)) return 'locked';
    const m = gameOf(state).extras.join;
    if(m === 'open' && GhostLogic.sharedJoin(state)) return m;
    if(m === 'ask') return m;
    return GhostLogic.recommendedJoinMode(state);
  }
  // Shared ownership (or no teams): anyone on the couch; exclusive: ask first.
  static recommendedJoinMode(state){ return GhostLogic.sharedJoin(state) ? 'open' : 'ask'; }
  // The episodes a late joiner may start at: the league's first through the one after the latest with
  // results (starting there means joining live, nothing to catch up on). While the league waits for its phase (step A3)
  // there's nothing to catch up on: they join live, with the league's own start.
  static startChoices(state){
    const latest = SpoilerLogic.latestWithResults(state);
    const start = startEpisode(state);
    if(start === null) return [latest + 1];
    const out = [];
    for(let n = start; n <= latest + 1; n++) out.push(n);
    return out;
  }
  // The cast a late joiner starting at `start` drafts from: everyone still in the game before that
  // episode, whoever in the league owns them (a ghost's team is private, so nothing is taken). `freeAgents`: only
  // those nobody in the league owns, for someone let straight into an exclusive game (step 9: they're seen at once).
  static draftPool(state, start, freeAgents){
    const before = SpoilerLogic.viewThrough(state, Math.max(0, start - 1));
    const aside = freeAgents ? ownersAside(state) : null;
    return before.castaways
      .filter(c => c.status === 'active' && !(freeAgents && leagueOwnersOf(state, Core.getCastaway(state, c.id) || c, aside).length))
      .map(c => c.id);
  }
  // How many they draft: the league's roster size, or none for a league type with no draft.
  static teamSize(state){
    return draftPiece(state) === NoDraftStrategy ? 0 : rosterSize(state);
  }
  // Starts a late joiner's season: their start episode and their team. Returns a reason on refusal.
  // opts.freeAgents: their team only from castaways nobody in the league owns (draftPool).
  // A11 part 5c: a game whose teams came out of a hat deals theirs too (DrawLogic.lateDeal: `castawayIds` aren't read, nobody
  // picks); under a price (a salary cap, a stock market's cash: BudgetLogic.priced) the team costs what it did at their start, the
  // prices as of the episode before it (as the draft paid then): within the cap (teamProblem: never when even the cheapest team
  // would be over) and paid for (player.joinPaid, which a market's cash counts as it counts the draft's log).
  static begin(state, playerId, start, castawayIds, opts){
    const p = Core.getPlayer(state, playerId);
    if(!p || !p.lateJoin) return 'Not a late joiner';
    if(Number.isInteger(p.lateJoin.startEpisode)) return 'Already started';
    if(!GhostLogic.startChoices(state).includes(start)) return 'Pick an episode from the list';
    const free = !!(opts && opts.freeAgents);
    const ids = DrawLogic.dealsLate(state) ? DrawLogic.lateDeal(state, playerId, start, free) : Array.isArray(castawayIds) ? castawayIds : [];
    const need = GhostLogic.teamSize(state);
    const pool = GhostLogic.draftPool(state, start, free);
    if(new Set(ids).size !== ids.length) return 'Same pick listed twice';
    if(ids.some(id => !pool.includes(id))) return 'Pick from who was still in the game';
    // Late in a season there may be fewer left than a full roster; take everyone then.
    if(ids.length !== Math.min(need, pool.length)) return 'Pick ' + Math.min(need, pool.length);
    let paid = null;
    if(ids.length && BudgetLogic.priced(state)){
      const then = SpoilerLogic.viewThrough(state, Math.max(0, start - 1));
      const over = BudgetLogic.teamProblem(then, ids, [], pool);
      if(over) return over;
      paid = BudgetLogic.cost(ids, PriceLogic.prices(then));
    }
    if(paid !== null) p.joinPaid = roundPoints((p.joinPaid || 0) + paid);
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
  // The commissioner brings a ghost into the league: visible to everyone, in the waiver order. Their team and points come with them. In an exclusive-ownership league a
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
    // A game of questions' walk (A11 part 2b) was worked out on more than this copy holds: it's the copy's to work out again.
    delete s.answerWalk;
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
      [...later].reverse().forEach(tx => MidSeasonLogic.revert(s, tx));
      ms.log = (ms.log || []).filter(tx => !later.includes(tx));
      // A later waiver week was opened by results they haven't seen.
      if(ms.waivers) ms.waivers.periods = WaiverLogic.periods(s).filter(p => p.episode <= seen);
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
    // A lineup's captain (A9 part 2), as their lineup.
    if(vEp.captains && Object.prototype.hasOwnProperty.call(vEp.captains, playerId)){
      ep.captains = ep.captains || {};
      ep.captains[playerId] = vEp.captains[playerId];
    }
    // Group slots (A10 part 1), as their lineup.
    if(vEp.groupSlots && Object.prototype.hasOwnProperty.call(vEp.groupSlots, playerId)){
      ep.groupSlots = ep.groupSlots || {};
      ep.groupSlots[playerId] = vEp.groupSlots[playerId];
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
        value: st.ownershipMode, applies: piecesOf(state).hasRoster },
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
      midSeason: { log:[] },
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
    if(!s.midSeason) s.midSeason = {log:[]};
    if(!Array.isArray(s.midSeason.log)) s.midSeason.log = [];
    if(!s.finalePredictions) s.finalePredictions = [];
    if(!s.finaleActual) s.finaleActual = {top3:[], winner:null};
    // Not the engine's default ('rolling', which defaultState writes into every league made here): a save from before
    // 'rolling' existed (SurvivorDraft's, which this file was forked from) ordered waivers by most points when it had no
    // order, so that's what it keeps. Every league made here has the field, so the engine's default never meets one.
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
    // Waivers v2's settings from the old switches (db/migrations/0063 did the same to stored leagues).
    WaiverLogic.backfill(s);
    // A league carrying its spec (the game-specs flag) carries what the fields above play (the points map grows).
    RosterLogic.syncGame(s);
    return s;
  }
}

return {
  // ---- constants ----
  PALETTE, SEED_CASTAWAYS,
  LEAGUE_TYPES, SHOWS, getLeagueType, piecesOf, gameOf, replenishAvailable, tradeAvailable, finalePredictionsAvailable, finaleOfGame, betsOn, rosterSize, originalDraftPicks,
  formatOf, startEpisode, startPhase, waitsForPhase, endEpisode, endPhase, lastEpisode, inPlay, spanView, gameOver, hasAired, closedForPlay, isWinnerExit, seasonWinner, seasonEnded,
  readsPhases,

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
  updateSettings: RosterLogic.updateSettings, setGame: RosterLogic.setGame, syncGame: RosterLogic.syncGame, settleStart: RosterLogic.settleStart, settlePhases: RosterLogic.settlePhases,
  settleDraftShare: RosterLogic.settleDraftShare,
  reorderDraft: DraftLogic.reorder, moveDraftOrder: DraftLogic.move, draftToCurrentTurn: DraftLogic.pick, undraft: DraftLogic.undo,
  MidSeasonLogic, availableFor: MidSeasonLogic.availableFor, replenishNeed: MidSeasonLogic.replenishNeed,
  addEpisode: EpisodeLogic.add, removeEpisode: EpisodeLogic.remove, updateEpisode: EpisodeLogic.update,
  renumberPlacements: EpisodeLogic.renumberPlacements, addElimination: EpisodeLogic.addElimination, removeElimination: EpisodeLogic.removeElimination,
  setJuryVotes: EpisodeLogic.setJuryVotes,
  addExiled: EpisodeLogic.addExiled, removeExiled: EpisodeLogic.removeExiled,
  RuleChangeLogic,
  RoleLogic, roleOf: RoleLogic.roleOf, addRole: RoleLogic.add, removeRole: RoleLogic.remove,
  GroupLogic, addGroupChange: GroupLogic.add, removeGroupChange: GroupLogic.remove,
  ensureUpcomingEpisode: EpisodeLogic.ensureUpcoming, ensureEpisodeNumber: EpisodeLogic.ensureEpisodeNumber,
  ensureNextEpisode: EpisodeLogic.ensureNextEpisode, seasonUnderway: EpisodeLogic.seasonUnderway, episodeHasResults: EpisodeLogic.hasResults,
  resultsStage: EpisodeLogic.resultsStage, setResultsStage: EpisodeLogic.setResultsStage, setNoExit: EpisodeLogic.setNoExit,
  addBet: BetLogic.add, addBetToUpcoming: BetLogic.addToUpcoming, betTarget: BetLogic.target, updateBet: BetLogic.update, removeBet: BetLogic.remove,
  MAX_BET_POINTS,
  addBetPrediction: BetLogic.addPrediction, removeBetPrediction: BetLogic.removePrediction, setBetPredictionCorrect: BetLogic.setPredictionCorrect,
  getOrCreateFinalePred: FinaleLogic.getOrCreatePrediction, setFinalePick: FinaleLogic.setPick, setFinaleWinnerPick: FinaleLogic.setWinnerPick,
  // Named setPickEmPick/removePickEmPick rather than the shorter setPick/removePick -- "pick" is
  // already heavily overloaded in this file (draft picks, blind-draft picks) and the longer name
  // keeps call sites unambiguous about which kind.
  activeRosterLineupFor: ActiveRosterLogic.lineupFor, setActiveRosterLineup: ActiveRosterLogic.setLineup, setActiveRosterCaptain: ActiveRosterLogic.setCaptain,
  lockActiveRosterLineups: ActiveRosterLogic.lockLineups, unlockActiveRosterLineups: ActiveRosterLogic.unlockLineups,
  addScoringEvent: ActiveRosterLogic.addEvent, removeScoringEvent: ActiveRosterLogic.removeEvent, setScoringEventUnits: ActiveRosterLogic.setEventUnits,
  pickEmPickFor: PickEmLogic.pickFor, pickEmEligibility: PickEmLogic.eligibility, pickEmHistory: PickEmLogic.history,
  pickEmUpcomingEpisode: PickEmLogic.upcomingEpisode, pickEmDecided: (ep, state) => PickEmLogic.decided(ep, state), currentEpisode,
  setPickEmPick: PickEmLogic.setPick, removePickEmPick: PickEmLogic.removePick,
  pickEmCallsOn: PickEmLogic.callsOn,

  // ---- domain classes: reference these directly in new code instead of the flat aliases above ----
  // ScoringLogic/DraftLogic are thin dispatchers to the game's pieces (see "The pieces" comment near
  // the top of this file); SnakeDraftStrategy/BlindDraftStrategy/NoDraftStrategy and
  // EliminationOrderScoringStrategy/PickEmScoringStrategy are those pieces,
  // exported directly for code that wants to bypass the dispatch.
  Core, ScoringLogic, DraftLogic, RosterLogic, WaiverLogic, EpisodeLogic, BetLogic, FinaleLogic, AnswerLogic, PickEmLogic, BlindDraftLogic, ActiveRosterLogic, GroupSlotLogic, SetupLogic, RevealLogic, SpoilerLogic, GhostLogic, Migrations,
  SpreadLogic, DrawLogic, PriceLogic, BudgetLogic, MarketLogic, AuctionLogic, KeeperLogic, KnockoutLogic, MatchupLogic, TeamLogic, HandicapLogic, StageLogic, draftFits, draftFitsFor, rankKey,
  SnakeDraftStrategy, StagesScoringStrategy, EliminationOrderScoringStrategy, NoDraftStrategy, PickEmScoringStrategy, BlindDraftStrategy, ActiveRosterEventScoringStrategy, DrawDraftStrategy, AuctionDraftStrategy
};

});
