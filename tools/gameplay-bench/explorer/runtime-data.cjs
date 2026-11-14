const S = require('../../../src/lib/game/state-logic'), G = require('../../../src/lib/game/game-spec'), F = require('../../../src/lib/game/formats');
const J = require('./json.cjs'), Stages = require('./stages.cjs');
const DAY = 86400000;
const number = (seed, ...parts) => parseInt(J.digest([seed, ...parts]).slice(0, 8), 16);
// Who goes out in an episode's results, from those still in (`still`, ids) and a seeded number (`pick(key)`).
// An ordinary episode: one vote exit (none for a format without one). The season's last episode, on a format that crowns a
// winner: the field is cut to its final three (vote exits, or the format's first exit), the losing finalists leave by the
// format's endgame exit (Survivor's jury loss) and one wins; in that order, so the results' order ranks the finalists.
function outcome(format, still, pick, finale) {
  const vote = F.voteExits(format)[0];
  if (!(finale && format.winnerExitMethod)) return vote && still.length > 1 ? [{ castawayId: still[pick('exit') % still.length], method: vote }] : [];
  const rest = still.slice(), finals = [];
  for (let i = 0; i < Math.min(3, rest.length); i++) finals.push(rest.splice(pick('final-' + i) % rest.length, 1)[0]);
  const cut = vote || format.exitMethods.find(m => m !== format.winnerExitMethod && !(format.endgameExitMethods || []).includes(m));
  const lost = (format.endgameExitMethods || []).find(m => m !== format.winnerExitMethod) || cut;
  return [...rest.map(id => ({ castawayId: id, method: cut })), ...finals.slice(1).map(id => ({ castawayId: id, method: lost })), { castawayId: finals[0], method: format.winnerExitMethod }];
}
const released = e => ['partial', 'final', 'corrected'].includes(e.resultStatus);
// A bounty's votes (score.bounty, formats/votes.js): who voted for whom at an episode's vote, as research's combined answer gives
// them. Made only for a world one of whose games has a bounty (so every other world's facts, and their hashes, stay as they were).
// `still`: everyone at the vote; `outs`: the episode's exits. Each votes for someone voted out (most do) or someone else; their
// counts are research's own, and one episode in six miscounts against who went home, so the record isn't sure and moves nothing.
const bounties = document => document.games.some(g => G.bountyOf(G.fullSpec(g.spec)));
function voteFacts(format, still, outs, pick) {
  const exits = new Set(F.voteExits(format)), out = outs.filter(o => exits.has(o.method)).map(o => o.castawayId);
  if (!out.length || still.length < 2) return undefined;
  const votes = still.map((id, i) => {
    const others = still.filter(x => x !== id), at = pick('vote-' + i) % 4 ? out[pick('at-' + i) % out.length] : null;
    return { castawayId: id, votedFor: at && at !== id ? at : others[pick('stray-' + i) % others.length] };
  });
  const miscount = pick('miscount') % 6 === 0;
  for (const v of votes) v.votesReceived = votes.filter(x => x.votedFor === v.castawayId).length + (miscount && out.includes(v.castawayId) ? 1 : 0);
  return votes;
}
// The world's votes as the season's stored research answer (episode_research, source 'combined': payload.castaways), in the
// format's own keys (Survivor's votedFor / votesReceived), names for ids; null without votes or a vote on the format.
// With pairs on the world (context.pairs), the answer's format section too (formatState, format-state.js's shape: who is with whom
// at the episode's end, pairsOf) and who left (castaways with leftTheGame), as format-timeline.js reads the stored answers. `n`: the
// episode's number (the pairs need it).
function researchOf(world, data, n) {
  const def = F.votesOf(F.formatFor(world.context.format.id))[0], name = new Map(world.participants.map(p => [p.id, p.name])), left = new Map((data.events || []).map(e => [e.castawayId, e.method]));
  const votes = def && Array.isArray(data.votes) ? data.votes.map(v => ({ name: name.get(v.castawayId), leftTheGame: left.has(v.castawayId) ? 'yes' : 'no', exitMethod: left.get(v.castawayId) || null, [def.key]: v.votedFor ? name.get(v.votedFor) : null, ...(def.count ? { [def.count]: v.votesReceived } : {}) })) : null;
  if (!world.context.pairs || !Number.isInteger(n)) return votes ? { castaways: votes } : null;
  const p = pairsOf(world, n), castaways = votes || [...left].map(([id, method]) => ({ name: name.get(id), leftTheGame: 'yes', exitMethod: method }));
  return { castaways, formatState: { playedAs: 'pairs', phase: null, groups: p.groups.map(g => ({ name: null, members: g.map(id => name.get(id)) })), alone: p.alone.map(id => name.get(id)), newcomers: [], wentHomeAs: left.size ? 'individuals' : 'nobody', changes: p.groups.length < 2 && (n === 1 || pairsOf(world, n - 1).groups.length >= 2) ? [{ kind: 'split-into-individuals', when: 'end', from: n + 1, what: 'Fewer than two pairs left', sure: 'high' }] : p.repaired ? [{ kind: 'swap', when: 'end', from: n + 1, what: 'Everyone re-paired', sure: 'high' }] : [] } };
}
// The pairs the show forms (the world's opt-in context.pairs { every }): everyone still in is paired at the premiere and again at the
// end of every `every`th episode (re-paired: a swap going into the next), each time in a seeded order of its own; between, a pair
// keeps its people, and one down to one is on their own (a pair down to one is no group). An odd one out is on their own too. Who is
// with whom at episode n's end (going into the next), from the world's own exits through n: { groups: [[id, id]], alone: [id],
// repaired }. The night the show stops being divided (fewer than two pairs left: one pair among people on their own reads as no
// longer divided, as a merge does; a finale, everyone gone), the answer says so (a split into individuals), as research would: an
// unstated change makes the timeline unsure of how the night was played. Pure.
function pairsOf(world, n) {
  const every = world.context.pairs.every, gone = new Map();
  for (const e of world.events) { const f = world.facts.find(x => x.eventId === e.id); if (f && released(e)) for (const x of f.data.events || []) if (!gone.has(x.castawayId)) gone.set(x.castawayId, e.number); }
  const inAfter = m => world.participants.map(p => p.id).filter(id => !(gone.has(id) && gone.get(id) <= m));
  const pairUp = (ids, round) => { const o = [...ids].sort((x, y) => J.digest([world.context.id, 'pairs', round, x]) < J.digest([world.context.id, 'pairs', round, y]) ? -1 : 1), groups = []; for (let i = 0; i + 1 < o.length; i += 2) groups.push([o[i], o[i + 1]]); return { groups, alone: o.length % 2 ? [o.at(-1)] : [] }; };
  const repaired = n % every === 0, round = Math.floor(n / every), still = new Set(inAfter(n));
  if (repaired) return { ...pairUp(still, round), repaired: true };
  // The pairs formed last (at the premiere, round 0, from everyone; else at the end of episode round * every), less who's gone since.
  const formed = pairUp(round === 0 ? world.participants.map(p => p.id) : inAfter(round * every), round);
  const groups = [], alone = formed.alone.filter(id => still.has(id));
  for (const g of formed.groups) { const kept = g.filter(id => still.has(id)); if (kept.length === 2) groups.push(kept); else alone.push(...kept); }
  return { groups, alone, repaired: false };
}
function people(document) {
  if (document.world.people.length) {
    if (document.world.people.length > 64 || document.world.people.some(p => typeof p.name !== 'string' || !p.name.trim())) throw Error('Provide up to 64 named actors (tool budget)');
    return J.clone(document.world.people);
  }
  const count = Math.max(...document.world.contexts.map(c => c.engine.couch ?? 2));
  if (!Number.isInteger(count) || count < 1 || count > 64) throw Error('Actor generation budget exceeded (1 to 64); not a game limit');
  return Array.from({ length: count }, (_, i) => ({ id: 'person-' + (i + 1), name: label(document, 'Player ' + (i + 1)) }));
}
// Generated cast names: distinct, realistic first names (a cast rarely shares one), so a label defect shows only when a
// content profile asks for it. labels:'shared' pairs first names on purpose (two contestants called the same).
const FIRST = ['Avery', 'Blake', 'Cameron', 'Devon', 'Emery', 'Finley', 'Harper', 'Indigo', 'Jordan', 'Kai', 'Logan', 'Marlowe', 'Noor', 'Oakley', 'Parker', 'Quinn', 'Rowan', 'Sage', 'Tatum', 'Uma', 'Vida', 'Wren', 'Xavi', 'Yael', 'Zion', 'Ari', 'Bea', 'Cruz', 'Dana', 'Eli', 'Faye', 'Gio', 'Hana', 'Ivo', 'Jules', 'Kit', 'Lux', 'Mika', 'Nico', 'Oren'];
const LAST = ['Alvarez', 'Brooks', 'Chen', 'Diallo', 'Evans', 'Fischer', 'Garcia', 'Hughes', 'Ito', 'Jensen', 'Khan', 'Lopez', 'Moreau', 'Nakamura', 'Okafor', 'Patel', 'Quint', 'Rossi', 'Silva', 'Tanaka'];
function participantName(document, i) {
  const f = FIRST[(document.content.labels === 'shared' ? i >> 1 : i) % FIRST.length], round = Math.floor(i / (FIRST.length * 2));
  return label(document, f + ' ' + LAST[i % LAST.length] + (round ? ' ' + (round + 1) : ''));
}
function label(document, value) {
  return document.content.labels === 'long' ? value + ' de la Cruz Montgomery-Wellington' : document.content.labels === 'unbroken' ? value + 'UnbrokenName'.repeat(5) : value;
}
function contextData(document, context, actors) {
  const participants = J.clone(document.world.participants.filter(p => p.contextId === context.id));
  if (!participants.length) {
    const count = context.engine.pool || 18;
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw Error('Participant generation budget exceeded (1000); not a game limit');
    for (let i = 0; i < count; i++) participants.push({ id: context.id + '-participant-' + (i + 1), contextId: context.id, name: participantName(document, i), photoUrl: null });
  }
  if (participants.length > 1000 || participants.some(p => typeof p.name !== 'string' || !p.name.trim())) throw Error('Provide up to 1000 named participants (tool budget)');
  // Tribes (the world's opt-in context.tribes, 2 to 4: a show divided into groups, as a draft spread across them reads them): each
  // participant on one, in turn. Only a world that asks has them, so every other world's facts and hashes are unchanged.
  const tribes = context.tribes;
  if (tribes !== undefined && !(Number.isInteger(tribes) && tribes >= 2 && tribes <= 4)) throw Error('context.tribes is 2 to 4');
  // Pairs the show forms (the world's opt-in context.pairs: { every: 1 to 4 }): see pairsOf.
  if (context.pairs !== undefined && !(J.object(context.pairs) && Number.isInteger(context.pairs.every) && context.pairs.every >= 1 && context.pairs.every <= 4 && Object.keys(context.pairs).every(k => k === 'every'))) throw Error('context.pairs is { every: 1 to 4 }');
  // (In blocks, as a cast lists each tribe together: a draft taken in the cast's order isn't spread by itself.)
  if (tribes) participants.forEach((p, i) => { if (!p.tribeId) p.tribeId = 'tribe-' + (Math.floor(i * tribes / participants.length) + 1); });
  const events = J.clone(document.world.events.filter(e => e.contextId === context.id)).sort((a, b) => a.number - b.number);
  if (!events.length) {
    const completed = document.content.completedEvents ?? 2, count = document.content.eventCount ?? completed + 1;
    if (!Number.isInteger(count) || !Number.isInteger(completed) || completed < 0 || count < 1 || count > 60 || completed > count) throw Error('Invalid event generation profile or 60-event tool budget exceeded');
    for (let i = 1; i <= count; i++) events.push({ id: context.id + '-event-' + i, contextId: context.id, number: i, title: 'Synthetic round ' + i, airAt: new Date(Date.parse(document.situation.clock) + (i <= completed ? -(completed + 1 - i) : i - completed) * DAY).toISOString(), resultStatus: i <= completed ? 'final' : 'unavailable' });
  }
  if (events.some((e, i) => e.number !== i + 1 || (e.airAt != null && !Number.isFinite(Date.parse(e.airAt))))) throw Error('Runtime events need consecutive numbers from 1 and valid air times');
  let unavailable = false;
  for (const event of events) { if (!released(event)) unavailable = true; else if (unavailable) throw Error('Released results must form a consecutive prefix'); }
  const facts = J.clone(document.world.facts.filter(f => f.contextId === context.id));
  const existing = new Set(facts.map(f => f.eventId));
  const active = new Set(participants.map(p => p.id));
  const format = F.formatFor(context.format.id);
  const moments = (context.engine.moments || []).filter(m => !m.auto && !m.off).map(m => m.id);
  for (const event of events) {
    if (!released(event)) continue;
    if (existing.has(event.id)) { for (const f of facts.filter(f => f.eventId === event.id)) for (const out of f.data?.events || []) active.delete(out.castawayId); continue; }
    const ids = [...active];
    const pick = k => number(document.seed, context.id, event.number, k);
    const outs = context.engine.results ? outcome(format, ids, pick, event.number === events.length) : [];
    const votes = bounties(document) ? voteFacts(format, ids, outs, pick) : undefined;
    const scoringEvents = moments.length ? participants.filter(p => active.has(p.id)).map((p, i) => ({ id: 'moment-' + J.digest([context.id, event.number, p.id]).slice(0, 16), type: moments[number(document.seed, event.number, i) % moments.length], castawayId: p.id })) : [];
    facts.push({ id: 'fact-' + event.id, eventId: event.id, contextId: context.id, source: 'seeded-synthetic-v2', data: { events: outs, scoringEvents, noExit: !outs.length, ...(votes ? { votes } : {}), ...(event.resultStatus === 'partial' ? { resultsStage: 'early' } : {}) } });
    for (const out of outs) active.delete(out.castawayId);
  }
  const last = Math.max(0, ...events.filter(released).map(e => e.number));
  const marks = actors.map(p => ({ personId: p.id, contextId: context.id, through: document.situation.marks.find(m => m.personId === p.id && m.contextId === context.id)?.through ?? last }));
  if (marks.some(m => m.through > last)) throw Error('Viewing mark exceeds materialized released events');
  if (facts.some(f => !events.some(e => e.id === f.eventId && released(e)))) throw Error('Facts require a released event in the same context');
  return { context: J.clone(context), participants, events, facts, marks };
}
// What the server does after every write to a league (db.ts withLeagueLock): head to head reads the season's length for its
// playoffs (air-times.ts stampSeasonLength: show_seasons.episode_count, which the materializer sets to the world's event count),
// then keeps when each seat joined its schedule and where the playoffs began (MatchupLogic.settle). Its inputs (results, who's
// catching up) change only on writes, so running it after each action that changed the game's state matches the server.
function settleWrite(world, state, o = {}) {
  if (S.MatchupLogic.readsSeasonLength(state)) state.seasonEpisodes = world.events.length; else delete state.seasonEpisodes;
  // Teams of players: the server settles them before the mutation and again after head to head's settle (db.ts withLeagueLock):
  // once the game has started (by the scenario clock), the draw kept as it stood.
  const now = Date.parse(o.clock || '');
  if (Number.isFinite(now)) S.TeamLogic.settle(state, now);
  S.MatchupLogic.settle(state);
  if (Number.isFinite(now)) S.TeamLogic.settle(state, now);
  if (o.phases) settlePhasesIn(world, state, o.clock);
  if (S.GroupSlotLogic.config(state)) settleGroupsIn(world, state);
}
// Group slots (get.groups) as the server settles them on every write (group-slots.ts settleGroupSlots): the season's format timeline
// from its stored answers (here researchOf, the payload the materializer stores, for each released episode), its groups by episode
// (slotRecords, names matched to the game's castaways the forgiving way), written onto the episodes with results.
function settleGroupsIn(world, state) {
  const T = require('../../../src/lib/game/formats/format-timeline.js');
  const reports = world.events.filter(released).sort((a, b) => a.number - b.number).map(e => { const f = world.facts.find(x => x.eventId === e.id), p = f && researchOf(world, f.data, e.number); return p?.formatState ? T.reportFrom(e.number, p) : null; }).filter(Boolean);
  if (!reports.length) return;
  S.GroupSlotLogic.settle(state, T.slotRecords(T.buildTimeline(reports, { cast: [] }), { resolve: name => S.Core.findCastawayByName(state, name).castaway?.id ?? null }));
}
// The season's phases as the server reads them (phase-starts.ts phasesOf over the season's rulebook and its confirmed starts):
// the first from Episode 1; a later one (the world's opt-in context.phaseStarts, its first episode) once that episode has results,
// as the desk confirms a start from accepted post-merge results (db/rulebooks.js knownPhaseStarts). The world's phases are the
// context's engine.phases.
function phaseList(world) {
  const starts = world.context.phaseStarts || {};
  return (world.context.engine.phases || []).map((p, i) => {
    const at = starts[p.id], known = i === 0 ? 1 : Number.isInteger(at) && world.events.some(e => e.number === at && released(e)) ? at : null;
    return { id: p.id, from: known, first: i === 0 };
  });
}
// phase-starts.ts settleIn, as the server runs it when a game is made and after every result (season sync): where a game that
// starts or ends at a phase plays (StateLogic.settleStart), then its phase starts and windows (settlePhases), from the first
// episode still open for moves (the one after the latest with results or aired, by the scenario clock).
function settlePhasesIn(world, state, clock) {
  if (!S.startPhase(state) && !S.endPhase(state) && !S.readsPhases(state)) return;
  const now = Date.parse(clock), aired = Math.max(0, ...world.events.filter(e => e.airAt && Date.parse(e.airAt) <= now).map(e => e.number));
  const open = Math.max(S.SpoilerLogic.latestWithResults(state), aired) + 1, phases = phaseList(world);
  const start = S.startPhase(state), end = S.endPhase(state);
  if (start || end) {
    const p = start ? phases.find(x => x.id === start && !x.first) : undefined, e = end ? phases.find(x => x.id === end && !x.first) : undefined;
    if (S.settleStart(state, { from: p?.from ?? null, end: e?.from ?? null, open }).length) return; // the server logs and leaves it
    // settleStart makes the episode a game starts at when it's past the world's (a phase confirmed by its last episode): the engine
    // names it at random (Core.uid); here it's named by its number so a replay reaches the same state.
    for (const ep of state.episodes) if (!world.events.some(x => x.id === ep.id) && /^ep_/.test(ep.id)) ep.id = world.context.id + '-made-' + ep.number;
  }
  S.settlePhases(state, { phases: phases.map(({ id, from }) => ({ id, from })), open });
}
function syncMarks(world, game, state) {
  const last = Math.max(0, ...world.events.filter(released).map(e => e.number));
  // As production stores it (GhostLogic): true for own pace, absent for live only (never false).
  if (game.timing === 'own-pace') state.settings.ownPace = true; else delete state.settings.ownPace;
  // Live only is live and strict here (GhostLogic.pace, 2026-11-13): everything locks at airtime, as a live game always did in the
  // explorer. A live game whose moves stay open late (the product's default now) isn't a timing here yet: its late moves need the
  // routes' late path (own-pace-seats.ts lateMark, applyAs late) as actions.
  if (game.timing === 'live-only') state.settings.lockAtAir = true; else delete state.settings.lockAtAir;
  for (const p of state.players) {
    const mark = world.marks.find(m => m.personId === p.id)?.through ?? 0;
    if (game.timing === 'own-pace') p.lateJoin = { ...(p.lateJoin || {}), startEpisode: S.startEpisode(state) || 1, seenThrough: mark, catchingUp: mark < last };
  }
}
function applyFacts(world, state) {
  for (const c of state.castaways) { c.status = 'active'; c.placementOrder = null; c.exitEpisodeId = null; c.exitMethod = null; }
  for (const ep of state.episodes) {
    const event = world.events.find(e => e.id === ep.id);
    ep.events = []; ep.scoringEvents = []; delete ep.noExit; delete ep.resultsStage; delete ep.voteRecord;
    if (!event || !released(event)) continue;
    const facts = world.facts.filter(f => f.eventId === event.id);
    if (facts.length !== 1) throw Error('A released event needs exactly one coherent fact bundle: ' + event.id);
    const data = facts[0].data;
    if (!data || !Array.isArray(data.events) || !Array.isArray(data.scoringEvents)) throw Error('Event facts need events and scoringEvents arrays');
    if (Object.keys(data).some(k => !['events', 'scoringEvents', 'noExit', 'resultsStage', 'votes'].includes(k))) throw Error('Event fact contains an unconnected field');
    if (data.votes !== undefined && (!Array.isArray(data.votes) || data.votes.some(v => !J.object(v) || Object.keys(v).some(k => !['castawayId', 'votedFor', 'votesReceived'].includes(k)) || !state.castaways.some(c => c.id === v.castawayId) || (v.votedFor != null && !state.castaways.some(c => c.id === v.votedFor)) || (v.votesReceived !== undefined && !Number.isInteger(v.votesReceived))))) throw Error('Votes name participants: { castawayId, votedFor, votesReceived }');
    if (data.noExit !== undefined && typeof data.noExit !== 'boolean') throw Error('noExit must be boolean');
    if (data.noExit && data.events.length) throw Error('noExit contradicts an elimination');
    if (data.resultsStage !== undefined && data.resultsStage !== (event.resultStatus === 'partial' ? 'early' : 'final')) throw Error('Fact stage contradicts event availability');
    const eliminated = new Set();
    for (const out of data.events) {
      if (Object.keys(out).some(k => !['castawayId', 'method', 'juryVotes'].includes(k))) throw Error('Unconnected elimination fact field');
      const participant = state.castaways.find(c => c.id === out.castawayId);
      if (!participant || participant.status === 'eliminated' || eliminated.has(out.castawayId) || !S.formatOf(state).exitMethods.includes(out.method)) throw Error('Unknown, duplicate or already eliminated participant, or exit method in facts');
      if (out.juryVotes !== undefined && (!Number.isInteger(out.juryVotes) || out.juryVotes < 0)) throw Error('Invalid jury votes');
      eliminated.add(out.castawayId);
      S.addElimination(state, ep.id, out.castawayId, out.method, out.juryVotes);
    }
    ep.scoringEvents = J.clone(data.scoringEvents);
    const ids = new Set();
    for (const item of ep.scoringEvents) {
      if (Object.keys(item).some(k => !['id', 'type', 'castawayId'].includes(k))) throw Error('Unconnected scoring fact field');
      if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || !state.castaways.some(c => c.id === item.castawayId) || !(S.formatOf(state).events || []).some(e => e.id === item.type)) throw Error('Unknown participant or moment, or duplicate scoring fact');
      ids.add(item.id);
    }
    if (data.noExit) S.setNoExit(state, ep.id, true);
    // As the server stamps it on every read and write (vote-records.ts): a game with a bounty, an episode with exits, the record
    // read from research's answer by names (Core.findCastawayByName), sure or not.
    if (data.votes && S.BountyLogic.of(state) && ep.events.length) {
      const rec = F.voteRecordOf(researchOf(world, data), S.formatOf(state), n => S.Core.findCastawayByName(state, n).castaway?.id ?? null);
      if (rec) ep.voteRecord = rec;
    }
    // Results after the merge are post-merge (the desk's decisions carry it): with the world's opt-in merge start.
    if (Number.isInteger(world.context.phaseStarts?.merged) && ep.number >= world.context.phaseStarts.merged) ep.postMerge = true;
    S.setResultsStage(state, ep.id, event.resultStatus === 'partial' ? 'early' : 'final');
    if (!S.episodeHasResults(ep)) throw Error('Released event has no result facts');
  }
}
function gameData(document, game, world, actors) {
  const spec = G.fullSpec(game.spec);
  const seats = game.seats.length ? game.seats : actors.slice(0, world.context.engine.couch || actors.length).map(p => p.id);
  const ctx = { ...world.context.engine, ...game.contextOverrides, couch: seats.length, pool: world.participants.length };
  // A later stage's own game is checked with no pool, as the server writes it (engine-lab.ts makeStages: its exclusive count waits
  // for its draft to open, settleDraftShare).
  if (game.stageOf !== undefined && Stages.indexIn(document.games, game) > 0) delete ctx.pool;
  // A draft that opens at its game's start (a later stage's: DraftLogic.waits) isn't made here: nobody is on a team until it opens
  // (below, and after the results that open it: stages.cjs draftAtStart).
  const opensAtStart = spec.get.by === 'draft' && spec.extras?.draft?.opens === 'start';
  const problems = G.specProblems(spec, ctx);
  if (problems.length) throw Error('Materialized game context rejected: ' + J.canonical(problems));
  if (document.setup.gameStates[game.id]) throw Error('Head snapshot reconciliation requires its own adapter');
  let state = S.defaultState();
  Object.assign(state.settings, { showId: world.context.key || world.context.id, showFormat: world.context.format.id, setupComplete: true, bonusEnabled: false, tradeEnabled: false, replenishEnabled: false });
  state.players = actors.filter(p => seats.includes(p.id)).map((p, i) => ({ id: p.id, name: p.name, color: p.color || ['#ce6e42', '#568f96', '#ae86b8'][i % 3], active: true }));
  state.castaways = world.participants.map(p => ({ id: p.id, name: p.name, photoUrl: document.content.images === 'missing' ? null : p.photoUrl || null, status: 'active', ownerIds: [], acquiredVia: spec.get.by === 'draft' && !opensAtStart ? 'draft' : null, ...(p.tribeId ? { tribeId: p.tribeId } : {}) }));
  // The world's tribes (state.tribes: what SpreadLogic reads as the cast's groups), named in turn.
  if (world.context.tribes) state.tribes = Array.from({ length: world.context.tribes }, (_, i) => ({ id: 'tribe-' + (i + 1), name: ['Luvu', 'Gata', 'Yase', 'Vatu'][i] }));
  // (An auction's teams are settled from its bids below, once the game's settings carry its budget: settleAuctionIn.)
  if (opensAtStart) state.draftOrder = state.players.map(p => p.id);
  else if (spec.get.by === 'draft' && spec.get.order !== 'auction') {
    // A draft spread across the tribes (get.across, on a world with tribes): each team drafted as the rule requires (SpreadLogic: no
    // tribe past its most, each its least while it has someone), shared teams each from the whole cast, exclusive ones from what's
    // left, in the cast's order; else every team the next each of the cast.
    const specd = spec.get.across && state.tribes ? { ...state, settings: G.withSpec(state.settings, spec) } : null, spread = specd ? S.SpreadLogic.groupsNow(specd) : null;
    if (spread) {
      // In rounds, a snake (one pick a seat, the order reversed each round), as a real draft goes: exclusive teams share the tribes.
      const taken = new Set(), teams = new Map(state.players.map(p => [p.id, []]));
      for (let k = 0; k < spec.get.each; k++) for (const player of k % 2 ? [...state.players].reverse() : state.players) {
        const mine = teams.get(player.id), free = state.castaways.map(c => c.id).filter(id => !mine.includes(id) && !(spec.get.own === 'exclusive' && taken.has(id)));
        const id = S.SpreadLogic.allowed(specd, mine, free, spread)[0];
        if (id) { mine.push(id); taken.add(id); }
      }
      for (const [pid, mine] of teams) for (const id of mine) state.castaways.find(c => c.id === id).ownerIds.push(pid);
    } else for (const [index, player] of state.players.entries()) for (let k = 0; k < spec.get.each; k++) state.castaways[(index * spec.get.each + k) % state.castaways.length].ownerIds.push(player.id);
    state.draftOrder = state.players.map(p => p.id); state.draftPicksMade = state.players.length * spec.get.each;
    state.blindDraft = { lockedPlayerIds: state.draftOrder, revealedAt: document.situation.clock };
    // Names out of a hat (get.order 'draw'): recorded as a real draw records itself (DrawLogic.draw: its seed, when, the order it
    // dealt in), so the server never deals again and a late joiner is dealt from its seed (DrawLogic.dealsLate).
    if (spec.get.order === 'draw') state.draw = { seed: 'zt-' + game.id, at: document.situation.clock, order: state.draftOrder.slice(), short: [] };
  }
  state.episodes = world.events.map(e => ({ id: e.id, number: e.number, title: e.title || null, airsAt: e.airAt || null, events: [], scoringEvents: [], bets: [], picks: [], lineups: {}, lineupsLocked: document.situation.lifecycle === 'locked' && !released(e) }));
  state.settings = G.withSpec(state.settings, spec);
  if (!state.settings) throw Error('Engine refused game settings');
  state = S.migrateLeagueState(state);
  // Teams of players drawn at random: the server seeds the draw once (TeamLogic.seed: Core.uid, random); here it's seeded from the
  // game's id, so a replay draws the same teams. The materialized state carries it, so the server keeps the same draw.
  if (S.TeamLogic.on(state)) state.teamDraw = { seed: 'zt-' + game.id };
  // Made as the server makes a game (start-game.ts settleIn): a span from or to a phase placed from what's known now.
  settlePhasesIn(world, state, document.situation.clock);
  if (S.AuctionLogic.on(state)) settleAuctionIn(document, game, state);
  // Use production setters against each historical pre-result state; this respects pick cycles/repeats.
  // These are generated setup operations, never claimed as browser submissions.
  for (const event of world.events) {
    const history = released(event);
    if (!history && document.situation.lifecycle !== 'saved') continue;
    const now = event.airAt ? Date.parse(event.airAt) - 1 : Date.parse(document.situation.clock);
    for (const player of state.players) {
      const mark = world.marks.find(m => m.personId === player.id).through;
      if (history && mark < event.number) continue;
      if (!history && mark < Math.max(0, ...world.events.filter(released).map(e => e.number))) continue;
      // No move outside the game's span (one waiting for a phase hasn't started), nor after someone's out or the game has ended
      // (a race won, a cut): the setter would refuse it, as the server does.
      { const first = S.startEpisode(state), last = S.endEpisode(state); if (first === null || event.number < first || (last !== null && event.number > last)) continue; }
      if (S.KnockoutLogic.moveProblem(state, player.id, event.number)) continue;
      if (spec.count?.start) {
        const ids = state.castaways.filter(c => c.ownerIds.includes(player.id)).slice(0, spec.count.start).map(c => c.id);
        if (!S.setActiveRosterLineup(state, event.id, player.id, ids, now)) throw Error('Generated historic lineup was rejected');
      }
      if (spec.get.by === 'pick') {
        const ids = S.pickEmEligibility(state, event.id, player.id).available.slice(0, spec.get.each);
        if (ids.length) {
          S.setPickEmPick(state, event.id, player.id, ids[0], { picks: ids, now });
          if (J.canonical(S.PickEmLogic.picked(S.pickEmPickFor(state, event.id, player.id))) !== J.canonical(ids)) throw Error('Generated historic picks were rejected');
        }
      }
    }
    if (history) applyFacts({ ...world, events: world.events.map(e => e.number <= event.number ? e : { ...e, resultStatus: 'unavailable' }) }, state);
  }
  syncMarks(world, game, state);
  settleWrite(world, state, { phases: true, clock: document.situation.clock });
  // A draft that opens at its start, open already (its game's start known and the episode before it played): made now.
  if (opensAtStart) Stages.draftAtStart(document, game, state, document.situation.clock);
  return { state, source: 'seeded-post-acquisition-setup' };
}
// An auction (get.order 'auction'): each seat's sealed bids (auctionBids), settled as the server settles them once everyone has
// locked in (AuctionLogic.settle: every bid from the highest down, won at what was bid, ties in a seeded order; a team its bids didn't
// fill filled from what's left at the lowest price, or left short), seeded from the game's id. Its moments (the settle's, the draft's
// start and turn) are the scenario's clock, so a replay settles the same. The materialized state carries the settled auction, so the
// server never settles it again.
function settleAuctionIn(document, game, state) {
  if (!S.AuctionLogic.settle(state, auctionBids(document, game, state), 'zt-' + game.id)) throw Error('The auction would not settle');
  const at = document.situation.clock;
  state.auction.at = at; state.draftTurnAt = at; state.draftStartedAt = at;
  for (const x of state.draftLog) x.at = at;
}
// Each seat's sealed bids (as the auction's route takes them: [{ castawayId, bid }]), seeded from the document and the game: from
// none (fill me) to three for each place, each on someone it wants most, a whole number from the lowest price to the most one bid
// can be (AuctionLogic.maxBid). The engine skips any it can't pay once it has won others. Pure.
function auctionBids(document, game, state) {
  const b = S.PriceLogic.config(state), most = S.AuctionLogic.maxBid(state), n = S.AuctionLogic.maxBids(state), ids = state.castaways.map(c => c.id), bids = {};
  for (const p of state.players) {
    const k = number(document.seed, game.id, p.id, 'count') % (n + 1), want = [...ids].sort((x, y) => number(document.seed, game.id, p.id, 'want', x) - number(document.seed, game.id, p.id, 'want', y));
    bids[p.id] = want.slice(0, k).map(id => ({ castawayId: id, bid: b.floor + number(document.seed, game.id, p.id, 'bid', id) % (most - b.floor + 1) }));
  }
  return bids;
}
module.exports = { auctionBids, voteFacts, researchOf, pairsOf, bounties, phaseList, settleWrite, outcome, people, contextData, gameData, applyFacts, syncMarks, released };
