// One campaign case on the engine/state tier: generate, open the shared runtime, walk seeded actions, check
// invariants after every step, then prove the exported run replays to the same hash. Pure function of
// (manifest, index); also replays an explicit action list (reproducers and minimization).
const R = require('../explorer/runtime.cjs'), J = require('../explorer/json.cjs'), Gen = require('./generator.cjs');

// Who held whom before each waiver week ran, per session (the undo check's measure).
const HELD = new WeakMap();
class Violation extends Error { constructor(signature, message, step) { super(message); this.signature = signature; this.step = step; } }

// `known` (a Set): known product defects the case reproduces (BACKLOG), counted apart from failures, as the API tier's are.
function invariants(session, document, before, record, step, inject, known = new Set()) {
  const snap = session.snapshot(), world = snap.contexts.show;
  if (record.status !== 'accepted' && record.before !== record.after) throw new Violation('rejected-changed-state', 'A ' + record.status + ' ' + record.action.type + ' changed the state hash', step);
  if (record.action.type === 'reveal' && record.status === 'accepted') {
    for (const m of world.marks) if (m.personId !== record.action.personId && m.through !== before.contexts.show.marks.find(x => x.personId === m.personId).through) throw new Violation('reveal-moved-someone-else', 'A reveal by ' + record.action.personId + ' moved ' + m.personId, step);
  }
  for (const person of snap.people) {
    const seen = world.marks.find(m => m.personId === person.id).through;
    for (const game of document.games) {
      const v = session.project(game.id, person.id).game, member = snap.games[game.id].state.players.some(p => p.id === person.id);
      // A game in stages (proof-family-46; stages.cjs), recounted here from each stage's own table and the world's facts, never from
      // StageLogic. For each viewer ('stages-overall'): the game's table is, seat by seat, the sum of each stage's own table as this
      // viewer sees that stage, counting a stage only once an episode it plays has results they've seen (one that hasn't started for
      // them counts nothing, whatever its own table says); and the game is over exactly when its last stage is.
      // Once a step ('stages-meet', 'stage-draft'): each stage ends the episode before the next starts, and neither is settled without
      // the other; nobody is on a team in a later stage until the episode before its start has results; on the step its teams appear
      // (a results step: the draft is made as it opens) every seat has a whole team drawn only from who's still in, and an
      // exclusive draft is still exclusive exactly when everyone's places fit among them (else it's played shared, nobody refused).
      if (game.spec.stages) {
        const SL = require('../../../src/lib/game/state-logic'), kids = document.games.filter(g => g.stageOf === game.id), rel = e => ['partial', 'final', 'corrected'].includes(e.resultStatus);
        const total = Object.fromEntries(v.table.map(r => [r.playerId, r.total])), want = Object.fromEntries(v.table.map(r => [r.playerId, 0])), views = kids.map(k => session.project(k.id, person.id).game);
        kids.forEach((k, i) => {
          const from = SL.startEpisode(snap.games[k.id].state);
          if (from === null || from > seen || !world.events.some(e => e.number === from && rel(e))) return;
          for (const r of views[i].table) want[r.playerId] = (want[r.playerId] ?? 0) + r.total;
        });
        for (const id of Object.keys(total)) if (Math.abs(total[id] - (want[id] ?? 0)) > 1e-9) throw new Violation('stages-overall', person.id + ' sees ' + id + ' on ' + total[id] + ' overall in ' + game.id + ', but their stages add up to ' + want[id] + ' (' + kids.map((k, i) => k.stageKey + ' ' + (views[i].table.find(r => r.playerId === id)?.total ?? '-')).join(', ') + ')', step);
        // Known (BACKLOG 61, counted apart): someone behind is shown a later stage whose draft came after their mark (where it
        // starts, and their team, drawn only from who was still in after episodes they haven't seen).
        if (kids.some((k, i) => i > 0 && Number.isInteger(views[i].from) && views[i].from - 1 > seen && (views[i].you?.team || []).length)) known.add('known:later-stage-past-mark');
        if (kids.length && v.over !== views[kids.length - 1].over) throw new Violation('stages-overall', person.id + ' sees ' + game.id + (v.over ? ' over' : ' still on') + ' while its last stage is ' + (views[kids.length - 1].over ? 'over' : 'still on'), step);
        if (person === snap.people[0]) {
          const stillIn = w => { const gone = new Set(w.facts.filter(x => w.events.some(e => e.id === x.eventId && rel(e))).flatMap(x => (x.data.events || []).map(e => e.castawayId))); return w.participants.map(p => p.id).filter(id => !gone.has(id)); };
          const latest = Math.max(0, ...world.events.filter(rel).map(e => e.number));
          kids.forEach((k, i) => {
            const st = snap.games[k.id].state, from = SL.startEpisode(st), next = kids[i + 1] && snap.games[kids[i + 1].id].state;
            if (next) { const end = SL.endEpisode(st), start = SL.startEpisode(next); if ((end === null) !== (start === null) || (end !== null && end + 1 !== start)) throw new Violation('stages-meet', game.id + ': ' + k.stageKey + ' ends with ' + end + ' and ' + kids[i + 1].stageKey + ' starts with ' + start, step); }
            if (k.spec.extras?.draft?.opens !== 'start') return;
            const held = x => x.castaways.filter(c => c.ownerIds.length), mine = held(st), was = held(before.games[k.id].state), fail = m => { throw new Violation('stage-draft', game.id + ' ' + k.stageKey + ': ' + m, step); };
            if (mine.length && (from === null || from - 1 > latest)) fail('teams before the episode before its start (' + from + ') has results');
            // Open (its start known, the episode before it played) and still unmade: only where nobody can lock a sheet in, fewer
            // still in than a team takes (BACKLOG 60, counted apart: the server refuses every sheet there too).
            if (!mine.length && from !== null && from - 1 <= latest) {
              const left = stillIn(world).length, each = SL.gameOf(st).get.each;
              if (left >= each) fail('its draft is open and unmade with ' + left + ' still in for teams of ' + each);
              known.add('known:stage-draft-short');
            }
            // The teams as they were first made: at setup (seen on the first step, against the world as it was then), or on this step.
            const made = !was.length && mine.length ? { at: snap, list: mine, state: st } : step === 0 && was.length ? { at: before, list: was, state: before.games[k.id].state } : null;
            if (!made) return;
            if (made.at === snap && !(record.action.type === 'results' && record.status === 'accepted')) fail('teams appeared on a ' + record.status + ' ' + record.action.type);
            const pool = stillIn(made.at.contexts.show), g = SL.gameOf(made.state).get, seats = made.state.players.filter(p => p.active !== false && !p.disabled);
            const out = made.list.filter(c => !pool.includes(c.id));
            if (out.length) fail('drafted ' + out.map(c => c.id).join(', ') + ', who had gone home');
            for (const p of seats) { const n = made.list.filter(c => c.ownerIds.includes(p.id)).length; if (n !== g.each) fail(p.id + ' has ' + n + ' of ' + g.each); }
            const fits = seats.length * g.each <= pool.length, own = k.spec.get.own === 'exclusive' && fits ? 'exclusive' : 'shared';
            if (g.own !== own) fail('played ' + g.own + ' with ' + seats.length + ' seats of ' + g.each + ' and ' + pool.length + ' still in (written ' + k.spec.get.own + ')');
            if (g.own === 'exclusive' && made.list.some(c => c.ownerIds.length > 1)) fail('someone is on two teams in an exclusive draft');
          });
        }
      }
      if (member && v.table.filter(r => r.you).length !== 1) throw new Violation('you-row', person.id + ' has ' + v.table.filter(r => r.you).length + ' own rows in ' + game.id, step);
      if (v.table.some(r => !Number.isFinite(r.total))) throw new Violation('non-finite-total', 'A non-finite total in ' + game.id, step);
      if (v.table.some(r => (r.weeks || []).some(w => w.episode > seen))) throw new Violation('history-past-mark', person.id + ' sees ' + game.id + ' history past episode ' + seen, step);
      // Shared points: a split pot pays out no more than its points across everyone; only the only one right scores 'only'.
      // (A stake is a line of its own, never shared: a wagered question's payout is checked by the wager bounds below instead.)
      const qs = new Map((game.spec.ask || []).filter(q => q.share && q.wager === undefined).map(q => [q.id, q])), windows = new Map();
      // Wagers: a wrong answer loses at most its stake; at even odds a right one gains at most the question's points plus the stake.
      const wagered = new Map((game.spec.ask || []).filter(q => q.wager !== undefined).map(q => [q.id, q]));
      // (A staked leg of a parlay that pays has its points and its stake's winnings multiplied: the schema's order.)
      const legTimes = id => (game.spec.score?.parlays || []).find(p => p.of.includes(id))?.times ?? 1;
      for (const d of session.project(game.id, person.id).decided || []) {
        const q = wagered.get(d.question), stake = d.answer?.stake; if (!q || !Number.isInteger(stake)) continue;
        if (d.points < -stake - 1e-9 || ((q.odds || 'even') === 'even' && d.points > (q.points + stake) * legTimes(q.id) + 1e-9)) throw new Violation('wager-out-of-bounds', person.id + ' sees ' + game.id + ' ' + d.question + '|' + d.episode + ' pay ' + d.points + ' on a stake of ' + stake, step);
      }
      // Parlays: on legs that are plain (no share, stake or rollover), right is points > 0, so in each window a seat is either right on
      // every leg, each paid its points times the parlay's, or multiplied on none (each leg its points or nothing).
      const plainQ = new Map((game.spec.ask || []).filter(q => q.share === undefined && q.wager === undefined && !q.rollover).map(q => [q.id, q]));
      for (const p of game.spec.score?.parlays || []) {
        if (!p.of.every(id => plainQ.has(id))) continue;
        const paid = new Map();
        for (const d of session.project(game.id, person.id).decided || []) if (p.of.includes(d.question)) paid.set(d.playerId + '|' + d.episode + '|' + d.question, d.points);
        for (const key of new Set([...paid.keys()].map(k => k.split('|').slice(0, 2).join('|')))) {
          const pts = p.of.map(id => paid.get(key + '|' + id) ?? 0), base = p.of.map(id => plainQ.get(id).points);
          const all = pts.every((x, i) => Math.abs(x - base[i] * p.times) < 1e-9), none = pts.every((x, i) => Math.abs(x) < 1e-9 || Math.abs(x - base[i]) < 1e-9) && !pts.every(x => x > 0);
          if (!all && !none) throw new Violation('parlay-paid', person.id + ' sees ' + game.id + ' parlay ' + p.of.join('+') + ' x' + p.times + ' at ' + key + ' pay ' + JSON.stringify(pts), step);
        }
      }
      // Rollovers: each window's worth is its points, plus the window before's worth when nobody earned anything on it (the jackpot
      // carried); the first window in play is worth its points. Through the open window, as this viewer sees them.
      const rolling = (game.spec.ask || []).filter(q => q.rollover);
      if (rolling.length) {
        const v = session.project(game.id, person.id);
        for (const q of rolling) {
          const eps = Object.keys(v.worth).filter(k => k.split('|')[0] === q.id).map(k => Number(k.split('|')[1])).sort((a, b) => a - b);
          eps.forEach((n, i) => {
            const prev = eps[i - 1], got = prev === undefined ? null : Object.values(v.earned[q.id + '|' + prev] || {}).reduce((a, b) => a + b, 0);
            const want = q.points + (got !== null && Math.abs(got) < 1e-9 ? v.worth[q.id + '|' + prev] : 0);
            if (Math.abs(v.worth[q.id + '|' + n] - want) > 1e-9) throw new Violation('rollover-carry', person.id + ' sees ' + game.id + ' ' + q.id + '|' + n + ' worth ' + v.worth[q.id + '|' + n] + ', expected ' + want + ' (window before earned ' + got + ')', step);
          });
        }
      }
      // Weekly Calls: each player's total, as this viewer sees it, is their right calls through the viewer's mark, recounted from the
      // world's accepted results (final or corrected): who goes home right if they went (not the winner leaving by winning); a moment
      // called yes or no right once the episode's results have any moment (they're final then). Nothing from runtime-calls.cjs.
      if (game.spec.preset === 'weekly-calls') {
        const v = session.project(game.id, person.id), world = session.snapshot().contexts.show, seen = world.marks.find(m => m.personId === person.id).through;
        const settled = new Map(world.events.filter(e => e.number <= seen && ['final', 'corrected'].includes(e.resultStatus)).map(e => [e.number, world.facts.find(f => f.eventId === e.id)?.data]).filter(([, d]) => d));
        const right = c => { const d = settled.get(c.episode); if (!d) return false; const moments = (d.scoringEvents || []).map(m => m.type);
          if (c.question === 'out') return (d.events || []).some(x => x.method !== WINNER && x.castawayId === c.answer);
          return moments.length > 0 && (moments.includes(c.question.slice(2)) ? 'yes' : 'no') === c.answer; };
        const calls = session.snapshot().stores.calls?.show || [];
        for (const r of v.game.table) { const want = calls.filter(c => c.personId === r.playerId && c.episode >= 1 && c.episode <= seen && right(c)).length;
          if (r.total !== want) throw new Violation('calls-tally', person.id + ' sees ' + game.id + ' ' + r.playerId + ' with ' + r.total + ' right calls, recount ' + want, step); }
      }
      // The weekly card (a card drawn in turn from the spec's list; only its moments count that week, each a hit once for each pick):
      // each seat's square each episode, as this viewer sees it, is for each of their picks the number of that week's card moments
      // that castaway had, recounted from the world's facts (the card's lines: Spec.cardLines, the rule's own source of truth).
      if (game.spec.card && game.spec.score?.only === 'card' && game.spec.score?.hits === 'pick' && game.spec.get?.by === 'pick') {
        const Spec = require('../../../src/lib/game/game-spec'), card = Spec.cardOf(Spec.fullSpec(game.spec)), S = require('../../../src/lib/game/state-logic');
        const world = session.snapshot().contexts.show, st = session.snapshot().games[game.id].state, rows = session.project(game.id, person.id).game.plays?.rows || {};
        for (const [seat, list] of Object.entries(rows)) for (const w of list) {
          if (w.points === null) continue; // a square this viewer isn't shown yet (a seat at its own pace that hasn't played it)
          const ev = world.events.find(e => e.number === w.episode), data = ev && world.facts.find(f => f.eventId === ev.id)?.data, lines = new Set(Spec.cardLines(card, w.episode, null));
          const epId = st.episodes.find(e => e.number === w.episode)?.id, picked = epId ? S.PickEmLogic.picked(S.pickEmPickFor(st, epId, seat)) : [];
          const want = picked.reduce((s, id) => s + new Set((data?.scoringEvents || []).filter(m => m.castawayId === id && lines.has(m.type)).map(m => m.type)).size, 0);
          if (Math.abs(w.points - want) > 1e-9) throw new Violation('card-only', person.id + ' sees ' + game.id + ' ' + seat + ' episode ' + w.episode + ': ' + w.points + ', recount ' + want + ' (card ' + [...lines].join(',') + ')', step);
        }
      }
      // A survival pool's riders (score.mulligans, score.buyback, get.second; with or without lives): the viewer's own season recounted
      // a night at a time from their decided picks. A second pick (get.second) counts on a night two or more went home (recounted from
      // the world's facts; a winner's exit isn't one) or every night (fallback 'counts'), right when that castaway didn't go home (on the
      // finale, when they won). A night's right picks first (each grows the streak and scores), then its wrong ones: a mulligan forgives
      // one; else the streak resets and, with lives, it costs one. A night that empties the lives ends with a buyback (one left, before
      // its episode: back with one life for its cost) or out, after which nothing counts. Their lives, mulligans left and the night they
      // went out (the page's pool), never a "you can buy back" once out (a buyback is automatic), their points, best and current streak.
      // Mid-season waivers (extras.waivers), checked once a step (the first person): no castaway on two teams in an exclusive game; no
      // claim's contents anywhere in the league's state (claims are private: the runtime's store, the server's waiver_claims); and on
      // the step a week processes, every claim it says was won is one of that seat's stored pairs, the seat now holds who it added and
      // no longer holds who it dropped, and a replacement drops someone who went home.
      if ((game.spec.extras?.waivers || snap.stores.waivers?.[game.id]) && person === snap.people[0]) {
        const st = snap.games[game.id].state, store = snap.stores.waivers?.[game.id], prior = before.games[game.id]?.state, fail = m => { throw new Violation('waivers-honored', game.id + ': ' + m, step); };
        if (require('../../../src/lib/game/state-logic').gameOf(st).get.own === 'exclusive' && !game.spec.extras?.waivers?.own && st.castaways.some(c => c.ownerIds.length > 1)) fail('a castaway on two teams: ' + st.castaways.filter(c => c.ownerIds.length > 1).map(c => c.id).join(','));
        for (const w of Object.values(store?.weeks || {})) for (const x of Object.values(w)) for (const pair of x.claim.pairs || []) if (JSON.stringify(st).includes(JSON.stringify(pair))) fail('a claim is in the league state');
        for (const p of st.midSeason?.waivers?.periods || []) {
          const was = (prior?.midSeason?.waivers?.periods || []).find(x => x.id === p.id);
          if (!(was && was.phase === 'open' && p.phase === 'processed')) continue;
          const claims = before.stores.waivers?.[game.id]?.weeks?.[p.id] || {};
          for (const x of (p.run?.results || []).filter(x => x.outcome === 'got')) {
            const mine = claims[x.playerId]?.claim?.pairs || [], c = st.castaways.find(y => y.id === x.castawayId), d = st.castaways.find(y => y.id === x.droppedCastawayId);
            if (claims[x.playerId] && !mine.some(y => y.addId === x.castawayId && y.dropId === x.droppedCastawayId)) fail(x.playerId + ' won ' + x.castawayId + ' for ' + x.droppedCastawayId + ', not one of their pairs');
            if (!c?.ownerIds.includes(x.playerId)) fail(x.playerId + ' won ' + x.castawayId + ' but doesn\'t hold them');
            if (d && d.ownerIds.includes(x.playerId) && !game.spec.extras?.waivers?.own) fail(x.playerId + ' still holds ' + d.id + ', whom they dropped');
            if (x.kind === 'pickup' && d && d.status !== 'eliminated') fail(x.playerId + ' replaced ' + d.id + ', who is still in');
          }
        }
      }
      // Known (BACKLOG 57): the lineup that counted for an episode a seat has already played is worked out from who they hold now when
      // it was never saved for that episode (carried from an earlier one), so a later waiver move rewrites it. Checked once a step on
      // a lineup game: a played episode's lineup that changed on a step that isn't that seat's own lineup for it, or new results.
      // (Played by anyone: at its own pace a seat behind hasn't reached a week others have already seen, and a waiver week's fill
      // rewrites the lineup it carried into that week all the same; a bounty on it then moves for everyone who saw it.)
      if (game.spec.count?.start !== undefined && person === snap.people[0] && before.games[game.id] && record.status === 'accepted' && record.action.type !== 'results') {
        const S0 = require('../../../src/lib/game/state-logic'), st = snap.games[game.id].state, prior = before.games[game.id].state, a = record.action;
        if ((st.midSeason?.log || []).length !== (prior.midSeason?.log || []).length) for (const p of st.players) {
          const seenBy = id => Math.min(before.contexts.show.marks.find(m => m.personId === id)?.through ?? 0, world.marks.find(m => m.personId === id)?.through ?? 0), through = Math.max(...st.players.map(q => seenBy(q.id)));
          for (const e of prior.episodes.filter(e => e.number <= through && S0.EpisodeLogic.hasResults(e))) {
            if (a.type === 'lineup' && a.personId === p.id && a.eventId === e.id) continue;
            if (JSON.stringify(S0.ActiveRosterLogic.lineupFor(prior, e.id, p.id)) !== JSON.stringify(S0.ActiveRosterLogic.lineupFor(st, e.id, p.id))) known.add('known:carried-lineup-rewritten');
          }
        }
      }
      // What whoever runs the game does with its waivers (the waiverWindow, waiverRun and waiverUndo actions, and a claim sent for
      // someone), checked once a step from the step's own before and after, not WaiverLogic ('waivers-by-hand'):
      //  - only whoever runs the game (the commissioner its roles name, else its first seat) is ever taken up on one;
      //  - a game with no waivers of its own has only weeks opened by hand, each on a window step;
      //  - a window step leaves the week as asked: its swaps and its say on replacements, or, turned off, a plain week (where weeks
      //    run after every episode) or over on the spot with no claim left. A claim still stored is what its seat had, in order, less
      //    only what the window no longer allows: no swap once it allows none, no replacement once it says none, and nothing gone at
      //    all when the window didn't shrink. Who has claims in is who has one stored;
      //  - a run by hand is the open week's own (by 'commissioner', at the clock);
      //  - an undo puts every castaway back with whoever held them before the week ran (its free-agency moves too), leaves no move of
      //    that week in the log and its claims as they were, and the week open and held;
      //  - a held week runs again only by hand, or once it closes (its closing time passed, or a later episode's results in);
      //  - a claim sent for someone is that one spot of theirs, the rest of their claim kept, sent by someone who has revealed the
      //    week's episode; and a claim or a free-agency move of your own waits for that reveal too.
      // Known (BACKLOG 56): in a game at its own pace with exclusive teams these run on the league as it stands at its latest
      // results, not the copy at everyone's episode, and its waiver clock ignores a hold: a window that isn't there after the step
      // that opened it, a run undone and made again in one step, a run that counts a loss nobody has seen or passes a claim over
      // as "gone" for someone still in at everyone's episode. There a failed check is `known:waivers-own-pace-by-hand`.
      if ((game.spec.extras?.waivers || snap.stores.waivers?.[game.id] || ['waiverWindow', 'waiverRun', 'waiverUndo'].includes(record.action.type)) && person === snap.people[0]) {
        const S0 = require('../../../src/lib/game/state-logic'), st = snap.games[game.id].state, prior = before.games[game.id]?.state, a = record.action, mineStep = a.gameId === game.id && record.status === 'accepted';
        const paced = S0.GhostLogic.draftsTogether(st), fail = m => { if (paced) { known.add('known:waivers-own-pace-by-hand'); return; } throw new Violation('waivers-by-hand', game.id + ': ' + m, step); };
        const weeks = x => x?.midSeason?.waivers?.periods || [], cur = x => { const p = weeks(x).at(-1); return p && p.phase !== 'closed' ? p : null; };
        const p0 = cur(prior), p1 = p0 ? weeks(st).find(p => p.id === p0.id) || null : null, claimsAt = (snapshot, id) => snapshot.stores.waivers?.[game.id]?.weeks?.[id] || {};
        const pairsOf = x => (x?.claim?.pairs || []).map(y => y.addId + '>' + y.dropId), hasResults = e => !!e && (!!e.noExit || (e.events || []).length > 0 || (e.scoringEvents || []).length > 0);
        const boss = Object.entries(game.roles || {}).find(([, r]) => r === 'commissioner')?.[0] ?? st.players[0]?.id, byHand = ['waiverWindow', 'waiverRun', 'waiverUndo'].includes(a.type) || (a.type === 'claim' && a.forId !== undefined);
        const markOf = id => world.marks.find(m => m.personId === id)?.through ?? 0;
        if (mineStep && byHand && a.personId !== boss) throw new Violation('waivers-by-hand', game.id + ': ' + a.personId + ' ran the waivers of a game ' + boss + ' runs (' + a.type + ')', step);
        if (!game.spec.extras?.waivers) {
          for (const p of weeks(st)) {
            if (p.openedBy !== 'commissioner') fail('a week opened by itself in a game with no waivers of its own (episode ' + p.episode + ')');
            if (!weeks(prior).some(x => x.id === p.id) && !(mineStep && a.type === 'waiverWindow')) fail('a week appeared on a ' + a.type + ' step');
          }
        }
        if (mineStep && a.type === 'waiverWindow') {
          const p = p0 ? p1 : weeks(st).at(-1), weekly = ['always', 'whenShort'].includes(game.spec.extras?.waivers?.replace), before0 = claimsAt(before, p0?.id), after0 = claimsAt(snap, p?.id);
          if (!p) fail('the window isn\'t there after the step that opened it');
          else if (a.swaps === null) {
            if (p.window || p.swaps) fail('a window turned off is still one');
            if (weekly ? p.phase !== 'open' : !(p.phase === 'closed' && p.turnedOff && !Object.keys(after0).length && !p.claimsIn.length)) fail('a window turned off left the week ' + p.phase + (weekly ? '' : ' with ' + Object.keys(after0).length + ' claims'));
          } else {
            if (!(p.window && p.swaps === a.swaps && p.openedBy === 'commissioner' && (a.replace === undefined ? !('replace' in p) : p.replace === a.replace))) fail('the window isn\'t as asked: ' + JSON.stringify([p.window, p.swaps, p.replace ?? null]) + ' for ' + JSON.stringify([a.swaps, a.replace ?? null]));
            // (Open, unless its time had come already: a week's claims run a set number of hours before the next episode airs, so a
            // window opened at or just past that moment runs at once. Noticed, BACKLOG 58.)
            if (!(p.phase === 'open' || (p.phase === 'processed' && p.run?.by === 'schedule' && !p0?.hold && Date.parse(p.processAt) <= Date.parse(snap.clock)))) fail('a window opened or changed isn\'t open');
          }
          if (p && !(a.swaps === null && !weekly)) {
            const status = id => st.castaways.find(c => c.id === id)?.status, shrank = !p0 ? false : a.swaps === null || a.swaps < (p0.swaps ?? 0) || (a.replace === false && p0.replace !== false) || (a.replace === undefined && p0.replace === true);
            for (const [seat, was] of Object.entries(before0)) {
              const old = pairsOf(was), now = pairsOf(after0[seat]);
              let i = 0; for (const x of now) { i = old.indexOf(x, i) + 1; if (!i) { fail(seat + '\'s claim gained or reordered ' + x + ' when the window changed'); break; } }
              // (A window that didn't shrink keeps every pair that can still be claimed at all: its add still in, its drop still theirs.)
              const still = old.filter(x => { const [add, drop] = x.split('>'), d = st.castaways.find(c => c.id === drop); return status(add) === 'active' && d && d.ownerIds.includes(seat) && (d.status === 'active' ? p.swaps > 0 : p.replace !== false); });
              if (!shrank && JSON.stringify(still) !== JSON.stringify(now)) fail(seat + '\'s claim was trimmed by a window that didn\'t shrink: ' + JSON.stringify(old) + ' to ' + JSON.stringify(now));
            }
            for (const [seat, x] of Object.entries(after0)) for (const y of x.claim.pairs) {
              if (!before0[seat]) fail(seat + ' has a claim the window step made');
              if (status(y.dropId) === 'active' && !(p.swaps > 0)) fail(seat + ' still claims a swap (' + y.addId + ' for ' + y.dropId + ') in a window with none');
              if (status(y.dropId) !== 'active' && p.replace === false) fail(seat + ' still claims a replacement in a window with none');
            }
            if (JSON.stringify([...p.claimsIn].sort()) !== JSON.stringify(Object.keys(after0).sort())) fail('who has claims in (' + p.claimsIn + ') isn\'t who has one stored (' + Object.keys(after0) + ')');
          }
        }
        if (mineStep && a.type === 'waiverRun') {
          if (!(p0 && p0.phase === 'open' && p1 && p1.phase === 'processed' && p1.run && p1.run.by === 'commissioner' && p1.run.at === snap.clock)) fail('a run by hand didn\'t run the open week: ' + JSON.stringify([p0?.phase, p1?.phase, p1?.run?.by, p1?.run?.at]));
          // (BACKLOG 56, at its own pace: against everyone's episode, the lowest mark.)
          if (paced && p1?.run) {
            const lowest = Math.min(...st.players.map(x => markOf(x.id))), epOf = c => st.episodes.find(e => e.id === c.exitEpisodeId)?.number ?? null;
            for (const x of p1.run.results) {
              if (x.kind === 'pickup' && !st.castaways.some(c => (c.ownerIds.includes(x.playerId) || c.formerOwnerId === x.playerId) && epOf(c) !== null && epOf(c) <= lowest)) fail('a replacement counted for ' + x.playerId + ', nobody of whose has left through ' + lowest);
              for (const w of x.passed || []) { const c = st.castaways.find(y => y.id === w.castawayId); if (w.reason === 'gone' && c && epOf(c) !== null && epOf(c) > lowest) fail(x.playerId + '\'s claim for ' + c.id + ' passed over as gone'); }
            }
          }
        }
        // Who held whom before each week ran, kept from the step it ran on (for an undo to be measured against).
        const memo = HELD.get(session) || HELD.set(session, new Map()).get(session);
        for (const p of weeks(st)) { const was = weeks(prior).find(x => x.id === p.id); if (was && was.phase === 'open' && p.phase === 'processed') memo.set(game.id + '|' + p.id, Object.fromEntries(prior.castaways.map(c => [c.id, [...c.ownerIds].sort().join(',')]))); }
        if (mineStep && a.type === 'waiverUndo') {
          if (!(p0 && p0.phase === 'processed' && p1)) fail('an undo with no run to take back');
          else if (p1.phase !== 'open' || !p1.hold || p1.run || (p1.autoFills || []).length) fail('after an undo the week is ' + p1.phase + (p1.hold ? ', held' : ', not held') + (p1.run ? ', its run still there' : ''));
          else {
            if ((st.midSeason.log || []).some(t => t.periodId === p1.id)) fail('a move of the week is still in the log after its undo');
            const held = memo.get(game.id + '|' + p1.id), off = held ? st.castaways.filter(c => [...c.ownerIds].sort().join(',') !== held[c.id]) : [];
            if (off.length) fail('after the undo ' + off.map(c => c.id + ' is with ' + (c.ownerIds.join(',') || 'nobody') + ', not ' + (held[c.id] || 'nobody')).join('; '));
            if (JSON.stringify(claimsAt(before, p1.id)) !== JSON.stringify(claimsAt(snap, p1.id))) fail('the undo changed the claims');
          }
        }
        // A held week (an undo's) that ran on this step: by hand, or because it closed.
        if (p0 && p0.phase === 'open' && p0.hold && p1 && p1.phase !== 'open' && !(mineStep && (a.type === 'waiverRun' || a.type === 'waiverWindow'))) {
          const closing = (p1.closesAt && Date.parse(snap.clock) >= Date.parse(p1.closesAt)) || st.episodes.some(e => e.number > p1.episode && hasResults(e));
          if (!closing) fail('a held week ran by itself before it closed (' + a.type + ')');
        }
        if (mineStep && a.type === 'claim' && a.forId !== undefined) {
          const week = p0 ? claimsAt(snap, p0.id) : {}, was = p0 ? pairsOf(claimsAt(before, p0.id)[a.forId]) : [], now = pairsOf(week[a.forId]), want = [...new Set(a.spot.addIds)].map(x => x + '>' + a.spot.dropId);
          if (!p0 || p0.phase !== 'open') fail('a claim sent for someone with no week open');
          else {
            if (markOf(a.personId) < p0.episode) throw new Violation('waivers-by-hand', game.id + ': ' + a.personId + ' sent a claim for episode ' + p0.episode + '\'s week before revealing it', step);
            if (JSON.stringify(now.filter(x => x.endsWith('>' + a.spot.dropId))) !== JSON.stringify(want)) fail('the spot sent for ' + a.forId + ' is ' + JSON.stringify(now.filter(x => x.endsWith('>' + a.spot.dropId))) + ', not ' + JSON.stringify(want));
            if (JSON.stringify(now.filter(x => !x.endsWith('>' + a.spot.dropId)).sort()) !== JSON.stringify(was.filter(x => !x.endsWith('>' + a.spot.dropId)).sort())) fail('the rest of ' + a.forId + '\'s claim changed when one spot was sent for them');
          }
        }
        if (mineStep && (a.type === 'freeAgency' || (a.type === 'claim' && a.forId === undefined)) && p0 && markOf(a.personId) < p0.episode) throw new Violation('waivers-by-hand', game.id + ': ' + a.personId + ' made a ' + a.type + ' in episode ' + p0.episode + '\'s week before revealing it', step);
      }
      // A pool that never repeats (get.repeat 'never'): a night with no pick of theirs is skipped (nothing counts: get.fallback 'skip')
      // exactly when they had used everyone still in at its start (their earlier first picks; a game with a second pick not checked
      // here), else it's a miss (wrong).
      if (member && game.spec.score?.by === 'survive' && (game.spec.score.mulligans || game.spec.score.buyback || game.spec.get?.second || game.spec.get?.repeat === 'never')) {
        const sc = game.spec.score, by = sc.buyback, sec = game.spec.get.second, mine = v.table.find(r => r.you), pool = v.twists?.pool, full = snap.games[game.id].state;
        if (game.spec.get.repeat === 'never' && !sec) for (const p of (mine?.picks || []).filter(p => !p.castawayId)) {
          const used = new Set((mine.picks || []).filter(x => x.episode < p.episode && x.castawayId).map(x => x.castawayId));
          const goneBefore = new Set(world.events.filter(e => e.number < p.episode).flatMap(e => (world.facts.find(x => x.eventId === e.id)?.data.events || []).map(x => x.castawayId)));
          const spent = world.participants.every(x => goneBefore.has(x.id) || used.has(x.id)), want = spent && game.spec.get.fallback === 'skip' ? null : false;
          if (p.correct !== want) throw new Violation('pool-riders', person.id + ' sees ' + game.id + ' episode ' + p.episode + ' with no pick ' + (p.correct === null ? 'skipped' : 'a miss') + ', recount ' + (want === null ? 'skipped' : 'a miss') + ' (everyone still in used: ' + spent + ')', step);
        }
        let lives = sc.lives ?? null, mull = sc.mulligans || 0, buys = by ? by.times ?? 1 : 0, total = 0, out = null, current = 0, longest = 0;
        for (const p of (mine?.picks || []).filter(p => p.correct !== null).sort((a, b) => a.episode - b.episode)) {
          if (out !== null) break;
          const judged = [p.correct], ev = world.events.find(x => x.number === p.episode), exits = (ev && world.facts.find(x => x.eventId === ev.id)?.data.events) || [];
          const second = sec && full.episodes.find(x => x.number === p.episode)?.picks?.find(x => x.playerId === person.id)?.second;
          const winner = exits.find(x => x.method === WINNER)?.castawayId, gone = new Set(exits.filter(x => x.method !== WINNER).map(x => x.castawayId));
          if (second && (sec.fallback === 'counts' || gone.size >= 2)) judged.push(winner ? second === winner : !gone.has(second));
          for (const right of [...judged.filter(x => x), ...judged.filter(x => !x)]) {
            if (right) { current++; longest = Math.max(longest, current); total += sc.points ?? 1; continue; }
            if (mull > 0) { mull--; continue; }
            current = 0;
            if (lives !== null && lives > 0) lives--;
          }
          if (lives !== 0) continue;
          if (buys > 0 && (!by.before || !Number.isInteger(by.before.episode) || p.episode < by.before.episode)) { buys--; lives = 1; total -= by.cost ?? 0; }
          else out = p.episode;
        }
        const has = sc.lives || sc.mulligans || by, got = pool ? [pool.lives, pool.mulligans, pool.out, pool.buyBack] : null, want = has ? [sc.lives ? lives : null, sc.mulligans ? mull : null, out, false] : null;
        const streaks = ['streak', 'standing'].includes(game.spec.rank?.by) ? [mine?.total, mine?.week] : null, wantStreaks = streaks && [longest, current];
        if (JSON.stringify(got) !== JSON.stringify(want) || Math.abs(mine.points - total) > 1e-9 || JSON.stringify(streaks) !== JSON.stringify(wantStreaks)) throw new Violation('pool-riders', person.id + ' sees ' + game.id + ' lives/mulligans/out/buyBack ' + JSON.stringify(got) + ' points ' + mine?.points + ' streaks ' + JSON.stringify(streaks) + ', recount ' + JSON.stringify(want) + ' points ' + total + ' streaks ' + JSON.stringify(wantStreaks), step);
      }
      // Beat the bot: on a settled window, a right answer scores its points unless the bot's call for that window (its store, read
      // here, never through the runtime's facts) matches it: a person it named, or a yes or no it got right. No call: the window plays,
      // or is void ('none': 'void'). Person questions here take one pick.
      for (const q of (game.spec.ask || []).filter(q => q.beat && ['person', 'yesNo'].includes(q.answer) && (q.pick || 1) === 1)) {
        const calls = session.snapshot().stores.bot?.[game.id] || [];
        for (const d of (session.project(game.id, person.id).decided || []).filter(d => d.question === q.id && d.verdict?.state === 'known')) {
          const call = calls.find(c => c.question === q.id && c.episode === d.episode), right = (d.verdict.right || []).includes(d.answer);
          const botRight = call !== undefined && (d.verdict.right || []).includes(call.answer), named = call !== undefined && call.answer === d.answer;
          const scores = !right ? false : call === undefined ? q.beat.none !== 'void' : q.answer === 'person' ? !named : !botRight;
          const want = scores ? q.points : 0;
          if (Math.abs(d.points - want) > 1e-9) throw new Violation('beat-paid', person.id + ' sees ' + game.id + ' ' + q.id + '|' + d.episode + ' for ' + d.playerId + ' ' + JSON.stringify(d.answer) + ' (bot ' + JSON.stringify(call?.answer ?? null) + ', right ' + JSON.stringify(d.verdict.right) + '): ' + d.points + ', want ' + want, step);
        }
      }
      // Confidence picks (who goes home, ranked surest first): a settled ranking pays its points times the weight of each right pick
      // (the first `pick`, then one less each), recounted from who went home in the world's facts (not the winner, leaving by winning).
      for (const q of (game.spec.ask || []).filter(q => q.answer === 'confidence')) {
        const world = session.snapshot().contexts.show;
        for (const d of (session.project(game.id, person.id).decided || []).filter(d => d.question === q.id && d.verdict?.state === 'known' && Array.isArray(d.answer))) {
          const ev = world.events.find(e => e.number === d.episode), data = ev && world.facts.find(f => f.eventId === ev.id)?.data;
          const out = new Set((data?.events || []).filter(x => x.method !== WINNER).map(x => x.castawayId));
          const want = d.answer.reduce((s, id, i) => s + (out.has(id) ? q.points * (q.pick - i) : 0), 0);
          if (Math.abs(d.points - want) > 1e-9) throw new Violation('confidence-paid', person.id + ' sees ' + game.id + ' ' + q.id + '|' + d.episode + ' for ' + d.playerId + ' ' + JSON.stringify(d.answer) + ': ' + d.points + ', recount ' + want, step);
        }
      }
      // Whole-game moment questions (asked once, settled by a moment), as the sheet settles them (decided: the viewer's copy cut at the
      // game's end, as answer-points.ts walked builds it), recounted from the world's facts through this viewer's mark and the game's
      // end (game.over, through game.through: the finale, a race won, a couch out of lives): happened is right once it's seen ('no'
      // at the end); first, whoever had it in the earliest episode it happened in; who and how many at the end, over every episode (a
      // number: the closest wins, ties all). Who or first that never happened is void ('off'). A question is left alone while any
      // episode has early (partial) results only: they can still change.
      const whole = (game.spec.ask || []).filter(q => q.asked === 'once' && q.settle?.by === 'moment');
      if (whole.length) {
        const v = session.project(game.id, person.id), world = session.snapshot().contexts.show, seen = world.marks.find(m => m.personId === person.id).through;
        const finale = world.events.some(e => e.number <= seen && (world.facts.find(f => f.eventId === e.id)?.data.events || []).some(x => x.method === WINNER));
        const ended = !!v.game.over || finale, last = v.game.over ? Math.min(seen, v.game.through ?? seen) : seen;
        const shown = world.events.filter(e => e.number <= last).map(e => ({ n: e.number, status: e.resultStatus, data: world.facts.find(f => f.eventId === e.id)?.data })).filter(x => x.data);
        if (!shown.some(x => x.status === 'partial')) for (const q of whole) {
          const hits = shown.flatMap(x => (x.data.scoringEvents || []).filter(m => m.type === q.settle.moment).map(m => ({ n: x.n, id: m.castawayId, units: m.units ?? 1 })));
          const firstN = hits.length ? Math.min(...hits.map(h => h.n)) : null, take = q.settle.take, total = hits.reduce((t, h) => t + h.units, 0);
          const known = take === 'happened' ? hits.length > 0 || ended : take === 'first' ? firstN !== null || ended : ended;
          const off = known && ['who', 'first'].includes(take) && !hits.length;
          const rows = (v.decided || []).filter(d => d.question === q.id), closest = Math.min(...rows.map(d => Math.abs(Number(d.answer) - total)));
          for (const d of rows) {
            const picks = [d.answer].flat();
            const want = !known || off ? 0 : take === 'happened' ? ((hits.length ? 'yes' : 'no') === d.answer ? q.points : 0) : take === 'first' ? picks.filter(id => hits.some(h => h.n === firstN && h.id === id)).length * q.points
              : take === 'who' ? picks.filter(id => hits.some(h => h.id === id)).length * q.points : (Math.abs(Number(d.answer) - total) === closest ? q.points : 0);
            const state = d.verdict?.state || 'none', wantState = !known ? 'waiting' : off ? 'off' : 'known';
            if (state !== wantState || Math.abs(d.points - want) > 1e-9) throw new Violation('once-moment', person.id + ' sees ' + game.id + ' ' + q.id + ' (' + take + ') for ' + d.playerId + ': ' + state + ' ' + d.points + ', recount ' + wantState + ' ' + want, step);
          }
        }
      }
      for (const d of session.project(game.id, person.id).decided || []) if (qs.has(d.question) && d.points) { const k = d.question + '|' + d.episode; windows.set(k, [...(windows.get(k) || []), { points: d.points, answer: JSON.stringify(d.answer) }]); }
      // 'only' on a person answer pays each right pick nobody else named (a finale or a double boot can have several): no two paid
      // people share a pick; on anything else, one person at most.
      for (const [k, paid] of windows) { const q = qs.get(k.split('|')[0]), pts = paid.map(x => x.points); if (q.share === 'only' ? (q.answer === 'person' ? new Set(paid.map(x => x.answer)).size < paid.length : paid.length > 1) : pts.reduce((a, b) => a + b, 0) > q.points + 1e-9) throw new Violation('share-overpaid', person.id + ' sees ' + game.id + ' ' + k + ' pay ' + JSON.stringify(pts) + ' (' + q.share + ', ' + q.points + ')', step); }
      // Head to head: no matchup played past their mark (their last result, their record, the playoff rounds played).
      // Weeks won: at most one a week, so nobody's count can run past the episodes this viewer has seen.
      if (v.weeksWon && Object.values(v.weeksWon).some(n => n > seen)) throw new Violation('week-past-mark', person.id + ' sees ' + game.id + ' weeks won past episode ' + seen, step);
      // Bounties move points between seats: they add up to nothing, and count only the episodes this viewer has seen (worked out
      // again here from the full state's records, through their mark).
      if (v.twists?.bounty) {
        const b = v.twists.bounty, sum = Object.values(b).reduce((a, x) => a + x, 0);
        if (Math.abs(sum) > 1e-9) throw new Violation('bounty-not-zero-sum', person.id + ' sees ' + game.id + ' bounties add up to ' + sum, step);
        // On the game as its span saw it (StateLogic.spanView): nothing after a race was won or the game's last episode counts.
        const S = require('../../../src/lib/game/state-logic'), fullState = S.spanView(snap.games[game.id].state), rule = S.BountyLogic.of(fullState), want = {};
        for (const ep of fullState.episodes.filter(e => e.number <= seen)) for (const [pid, pts] of S.BountyLogic.episodeLines(fullState, ep, rule) || []) want[pid] = (want[pid] || 0) + pts;
        // Known (BACKLOG 57): once a seat's waiver move has rewritten the lineups it carried into weeks already played, the full state's
        // bounties for those weeks are no longer what someone behind the move still sees.
        if (Object.keys({ ...b, ...want }).some(k => Math.abs((b[k] || 0) - (want[k] || 0)) > 1e-9) && !(known.has('known:carried-lineup-rewritten') && game.spec.count?.start !== undefined)) throw new Violation('bounty-past-mark', person.id + ' sees ' + game.id + ' bounties ' + JSON.stringify(b) + ', through episode ' + seen + ' they are ' + JSON.stringify(want), step);
      }
      // Teams of players: everyone listed on one team at most, finite points, and a seat's own team is the one listing them.
      // BACKLOG 48: a team game with a cut ends at its first night when nobody is on a team yet (all catching up as it started).
      const S0 = require('../../../src/lib/game/state-logic'), mine = S0.GhostLogic.viewFor(snap.games[game.id].state, member ? person.id : null, seen);
      const ko = v.teams && S0.TeamLogic.knocks(mine) ? S0.KnockoutLogic.run(mine) : null;
      if (ko && ko.ends !== null && !S0.TeamLogic.teamsAt(mine, ko.ends).length) known.add('known:teams-none-left');
      else if (v.teams) {
        const listed = v.teams.teams.flatMap(t => t.members);
        if (new Set(listed).size !== listed.length || v.teams.teams.some(t => !Number.isFinite(t.points))) throw new Violation('team-members', person.id + ' sees ' + game.id + ' teams ' + JSON.stringify(v.teams.teams.map(t => [t.id, t.members, t.points])), step);
        // (Someone still catching up when the game started joins from the first episode still to play once caught up: their team
        // is theirs before it lists them, so only a seat kept on it from an episode already played must be listed. A game that ended
        // before they joined (a race won, a cut's last team, head to head's final, its span's end: lastEpisode) lists them nowhere.)
        const spells = snap.games[game.id].state.teamSeats?.[person.id] || [], played = Math.max(0, ...snap.games[game.id].state.episodes.filter(e => (e.events || []).length || (e.scoringEvents || []).length).map(e => e.number));
        if (member && v.teams.yours && v.teams.set && spells.some(x => x.team === v.teams.yours && x.from <= Math.min(played, seen, S0.lastEpisode(mine) ?? Infinity)) && !v.teams.teams.find(t => t.id === v.teams.yours)?.members.includes(person.id)) throw new Violation('team-members', person.id + "'s team " + v.teams.yours + ' in ' + game.id + " doesn't list them", step);
      }
      const h = v.matchups;
      if (h && ((h.last && h.last.episode > seen) || h.record.wins + h.record.losses + h.record.ties > seen || (h.playoffs?.bracket || []).some(r => r.played && r.episode > seen))) throw new Violation('matchup-past-mark', person.id + ' sees a ' + game.id + ' matchup past episode ' + seen, step);
      // Nobody sees someone else's guess on a side bet while it's still open (its episode hasn't locked or got results).
      const full = snap.games[game.id].state, now = Date.parse(snap.clock), text = JSON.stringify(v);
      for (const e of full.episodes) if (!(e.airsAt && Date.parse(e.airsAt) <= now) && !(e.events || []).length && !(e.scoringEvents || []).length)
        for (const b of e.bets || []) for (const q of b.predictions || []) if (q.playerId !== person.id && text.includes(q.guess)) throw new Violation('guess-visible', person.id + ' sees ' + q.playerId + "'s open guess on " + game.id, step);
    }
  }
  if (inject && inject.step === step) throw new Violation('injected', 'Injected failure (campaign self-test)', step);
}

// Multipliers (score.times), checked against a twin: the same definition without them, walked with the same actions. Every action
// gets the same outcome there, and each seat's points on each episode (the season grid, as each viewer sees it) are the twin's
// times that episode's windows: an episode's own, the finale's (the episode whose results named a winner).
const WINNER = require('../../../src/lib/game/formats').formatFor('survivor').winnerExitMethod;
// Known (BACKLOG 49): with hits counted once each ('pick', 'objective'), a game without a multiplier's grid adds up every hit while
// its standings don't, so the twin's grid can't be the measure there: `known:hits-grid-plain` when its grid and standings disagree.
function pairedTimes(session, doc, actions, statuses, known) {
  const timed = doc.games.filter(g => Array.isArray(g.spec.score?.times));
  if (!timed.length) return;
  const twin = R.open({ ...doc, games: doc.games.map(g => g.spec.score?.times ? { ...g, spec: { ...g.spec, score: Object.fromEntries(Object.entries(g.spec.score).filter(([k]) => k !== 'times')) } } : g) });
  try {
    actions.forEach((a, i) => { const s = twin.apply(a, 'campaign').status; if (s !== statuses[i]) throw new Violation('times-twin-diverged', a.type + ' was ' + statuses[i] + ' with times and ' + s + ' without', i); });
    const snap = session.snapshot(), world = snap.contexts.show;
    const finale = world.events.find(e => (world.facts.find(x => x.eventId === e.id)?.data.events || []).some(x => x.method === WINNER))?.number ?? null;
    for (const g of timed) {
      const factor = n => g.spec.score.times.reduce((x, w) => x * (w.episode === n || (w.finale && n === finale) ? w.times : 1), 1);
      for (const person of snap.people) {
        const a = session.project(g.id, person.id).game.plays?.rows || {}, tv = twin.project(g.id, person.id).game, b = tv.plays?.rows || {};
        if (['pick', 'objective'].includes(g.spec.score.hits) && tv.table.some(r => b[r.playerId] && Math.abs(b[r.playerId].reduce((t, w) => t + w.points, 0) - r.total) > 1e-9)) { known.add('known:hits-grid-plain'); continue; }
        if (J.canonical(Object.entries(a).map(([s, x]) => [s, x.length]).sort()) !== J.canonical(Object.entries(b).map(([s, x]) => [s, x.length]).sort())) throw new Violation('times-paired', person.id + ' sees ' + g.id + "'s grid with different seats or episodes than its twin", actions.length);
        // (A side bet's points sit beside the draft's, never multiplied: the table's weeks carry them, the same on both.)
        const bets = new Map(session.project(g.id, person.id).game.table.flatMap(r => (r.weeks || []).map(w => [r.playerId + '|' + w.episode, w.predictions || 0])));
        for (const [seat, rows] of Object.entries(a)) for (const w of rows) {
          const base = (b[seat] || []).find(x => x.episode === w.episode), bet = bets.get(seat + '|' + w.episode) || 0;
          if (!base || Math.abs(w.points - bet - (base.points - bet) * factor(w.episode)) > 1e-9) throw new Violation('times-paired', person.id + ' sees ' + g.id + ' ' + seat + ' episode ' + w.episode + ': ' + w.points + ' with times, ' + (base ? base.points : 'none') + ' without, x' + factor(w.episode), actions.length);
        }
      }
    }
  } finally { twin.dispose(); }
}

// Outlast in reverse, checked against a twin: the same definition played forward, walked with the same actions. Every action gets
// the same outcome there, and each seat's total, as each viewer sees it, is the cast's size + 1 for every holding (gone home or still
// in) less the twin's: in reverse a holding is worth the size + 1 less its forward place.
function pairedReverse(session, doc, actions, statuses) {
  const rev = doc.games.filter(g => g.spec.score?.by === 'place' && g.spec.score.reverse === true && !g.spec.score.bounty && !g.spec.score.multiply && !g.spec.score.roles); // (roles' points sit beside the total: roles-paired checks those games)
  if (!rev.length) return;
  const twin = R.open({ ...doc, games: doc.games.map(g => rev.includes(g) ? { ...g, spec: { ...g.spec, score: Object.fromEntries(Object.entries(g.spec.score).filter(([k]) => k !== 'reverse')) } } : g) });
  try {
    actions.forEach((a, i) => { const s = twin.apply(a, 'campaign').status; if (s !== statuses[i]) throw new Violation('reverse-twin-diverged', a.type + ' was ' + statuses[i] + ' in reverse and ' + s + ' forward', i); });
    const snap = session.snapshot(), size = snap.contexts.show.participants.length;
    for (const g of rev) for (const person of snap.people) {
      const forward = new Map(twin.project(g.id, person.id).game.table.map(r => [r.playerId, r.total]));
      for (const r of session.project(g.id, person.id).game.table) {
        const want = (size + 1) * r.team.length - forward.get(r.playerId);
        if (Math.abs(r.total - want) > 1e-9) throw new Violation('reverse-paired', person.id + ' sees ' + g.id + ' ' + r.playerId + ': ' + r.total + ' in reverse, ' + forward.get(r.playerId) + ' forward, ' + r.team.length + ' held of ' + size, actions.length);
      }
    }
  } finally { twin.dispose(); }
}

// The top scorer's twist, checked against a twin: the same definition without it, walked with the same actions but the twist
// choices (which only the twisted game takes). Every other action gets the same outcome; each seat's square, as each viewer sees it,
// is the twin's times the twist stamped on that episode (none: 1); and a twist filed as chosen was chosen by episode n - 1's
// unique top scorer (its points that episode, a tie broken by the standings through it), recounted from the grid.
// Known (BACKLOG 52): in an own-pace game a twist is filed once its choice closes even while some seats haven't played the episode
// that decides who chooses, so a seat catching up later can change that episode's standings: `known:twist-own-pace` there.
function pairedTwist(session, doc, actions, statuses, known) {
  const tw = doc.games.filter(g => g.spec.score?.twist);
  if (!tw.length) return;
  const twin = R.open({ ...doc, games: doc.games.map(g => tw.includes(g) ? { ...g, spec: { ...g.spec, score: Object.fromEntries(Object.entries(g.spec.score).filter(([k]) => k !== 'twist')) } } : g) });
  try {
    // (Twist choices are replayed too, refused there, so ids derived from the trace's length, a side bet's, stay the same.)
    actions.forEach((a, i) => { const s = twin.apply(a, 'campaign').status; if (a.type !== 'twist' && s !== statuses[i]) throw new Violation('twist-twin-diverged', a.type + ' was ' + statuses[i] + ' with the twist and ' + s + ' without', i); });
    const snap = session.snapshot();
    for (const g of tw) {
      const eps = snap.games[g.id].state.episodes, timesOf = n => { const id = eps.find(e => e.number === n)?.twist?.id; return id ? g.spec.score.twist.of.find(x => x.id === id)?.times ?? 1 : 1; };
      let full = null;
      for (const person of snap.people) {
        const a = session.project(g.id, person.id).game.plays?.rows || {}, b = twin.project(g.id, person.id).game.plays?.rows || {};
        if (!full || Object.values(a).flat().length > Object.values(full).flat().length) full = a;
        for (const [seat, rows] of Object.entries(a)) for (const w of rows) {
          if (w.points === null) continue;
          const base = (b[seat] || []).find(x => x.episode === w.episode);
          if (!base || base.points === null || Math.abs(w.points - base.points * timesOf(w.episode)) > 0.011) throw new Violation('twist-paired', person.id + ' sees ' + g.id + ' ' + seat + ' episode ' + w.episode + ': ' + w.points + ' with the twist, ' + (base ? base.points : 'none') + ' without, x' + timesOf(w.episode), actions.length);
        }
      }
      for (const ep of eps.filter(e => e.twist?.how === 'chosen')) {
        const at = (seat, n) => (full[seat] || []).find(w => w.episode === n), seats = Object.keys(full).filter(s => at(s, ep.number - 1));
        // (A bounty's points sit on no square of the grid, Designs needed item 12, but the engine's standings count them: added here,
        // each episode's lines through the one before, as the bounty check reads them.)
        const Sb = require('../../../src/lib/game/state-logic'), stb = Sb.spanView(snap.games[g.id].state), rule = g.spec.score.bounty ? Sb.BountyLogic.of(stb) : null;
        const bountyOf = (s, upTo, only) => rule ? stb.episodes.filter(e => only ? e.number === upTo : e.number <= upTo).reduce((t, e) => t + ([...(Sb.BountyLogic.episodeLines(stb, e, rule) || [])].filter(([pid]) => pid === s).reduce((u, [, p]) => u + p, 0)), 0) : 0;
        const week = s => at(s, ep.number - 1).points + bountyOf(s, ep.number - 1, true), total = s => at(s, ep.number - 1).total + bountyOf(s, ep.number - 1, false);
        let top = seats.filter(s => week(s) === Math.max(...seats.map(week)));
        if (top.length > 1) top = top.filter(s => total(s) === Math.max(...top.map(total)));
        if ((top.length !== 1 || top[0] !== ep.twist.by) && g.timing === 'own-pace') { known.add('known:twist-own-pace'); continue; }
        if (top.length !== 1 || top[0] !== ep.twist.by) throw new Violation('twist-chooser', g.id + ' episode ' + ep.number + ' chosen by ' + ep.twist.by + ', top scorer of ' + (ep.number - 1) + ': ' + top.join(','), actions.length);
      }
    }
  } finally { twin.dispose(); }
}

// Group slots (get.groups), checked against a twin: the same definition without them, walked with the same actions (its group-slot
// actions refused, the rest's outcomes the same). Each seat's square, as each viewer sees it, is the twin's plus each slot's points,
// recounted here: the slot's latest pick (stored on the episode it was for, carried) holds in episode n only while its exact pair is
// one the world's own pairs (runtime-data pairsOf, not the timeline) had at the end of every episode from the one before its pick
// through n - 1 (a re-pairing or a pair down to one ends it); held, it scores its two people's moments at the game's points (the
// scoring primitive, ActiveRosterLogic.scoredEvents), their mean or sum, times the episode's multiplier.
function pairedGroups(session, doc, actions, statuses) {
  // (Not a game with the top scorer's twist: slot points change who scores most, so who chooses the twist; the twin can't replay it.)
  const slotted = doc.games.filter(g => g.spec.get?.groups && !g.spec.score?.twist);
  if (!slotted.length) return;
  const S = require('../../../src/lib/game/state-logic'), Data = require('../../../tools/gameplay-bench/explorer/runtime-data.cjs');
  const twin = R.open({ ...doc, games: doc.games.map(g => slotted.includes(g) ? { ...g, spec: { ...g.spec, get: Object.fromEntries(Object.entries(g.spec.get).filter(([k]) => k !== 'groups')) } } : g) });
  try {
    actions.forEach((a, i) => { const s = twin.apply(a, 'campaign').status; if (a.type !== 'groupSlot' && s !== statuses[i]) throw new Violation('groups-twin-diverged', a.type + ' was ' + statuses[i] + ' with group slots and ' + s + ' without', i); });
    const snap = session.snapshot();
    for (const g of slotted) {
      const st = snap.games[g.id].state, world = snap.contexts[g.contextId], cfg = { slots: 1, points: 'mean', ...g.spec.get.groups }, key = ids => [...ids].sort().join('|');
      const pairsAt = new Map(), pairs = k => { if (!pairsAt.has(k)) { const gs = Data.pairsOf(world, k).groups; pairsAt.set(k, new Set(gs.length >= 2 ? gs.map(key) : [])); } return pairsAt.get(k); }; // (one pair among people on their own isn't a show divided into pairs: no group holds)
      const slotPoints = (seat, n) => {
        const ep = st.episodes.find(e => e.number === n); if (!ep) return 0;
        const scored = S.ActiveRosterLogic.scoredEvents(st, S.ActiveRosterLogic.episodeEvents(st, ep), n), x = S.ActiveRosterLogic.timesFor(st, n);
        let total = 0;
        for (let i = 0; i < cfg.slots; i++) {
          const from = st.episodes.filter(e => e.number <= n && e.groupSlots?.[seat] && Object.prototype.hasOwnProperty.call(e.groupSlots[seat], i)).sort((a, b) => b.number - a.number)[0];
          const pick = from?.groupSlots[seat][i];
          if (!pick || pick.members.length !== 2) continue;
          let held = true; for (let k = from.number - 1; k <= n - 1 && held; k++) held = k >= 1 && pairs(k).has(key(pick.members));
          if (!held) continue;
          const sum = scored.filter(e => pick.members.includes(e.castawayId)).reduce((t, e) => t + e.points, 0);
          total += (cfg.points === 'sum' ? sum : sum / 2) * x;
        }
        return total;
      };
      // Each person's own slots going into their next episode (the page's): nothing picked, empty; its pair held at every end from the one
      // before its pick through the last, waiting; else dropped.
      for (const person of snap.people) {
        const tw = session.project(g.id, person.id).game.twists, n = tw?.offered ? st.episodes.find(e => e.id === tw.offered.epId)?.number : null;
        if (!tw?.slots || !Number.isInteger(n)) continue;
        for (const s of tw.slots) {
          const from = st.episodes.filter(e => e.number <= n && e.groupSlots?.[person.id] && Object.prototype.hasOwnProperty.call(e.groupSlots[person.id], s.slot)).sort((x, y) => y.number - x.number)[0], pick = from?.groupSlots[person.id][s.slot];
          let held = !!pick; for (let k = from ? from.number - 1 : 0; k <= n - 1 && held; k++) held = k >= 1 && pairs(k).has(key(pick.members));
          // (Held: waiting, or held once that episode has results in their copy, as at their own pace.)
          const want = !pick ? 'empty' : held ? 'waiting' : 'dropped';
          if (s.status !== want && !(want === 'waiting' && s.status === 'held')) throw new Violation('groups-paired', person.id + "'s " + g.id + ' slot ' + s.slot + ' going into episode ' + n + ' is ' + s.status + ', recount ' + want, actions.length);
        }
      }
      for (const person of snap.people) {
        const a = session.project(g.id, person.id).game.plays?.rows || {}, b = twin.project(g.id, person.id).game.plays?.rows || {};
        for (const [seat, rows] of Object.entries(a)) for (const w of rows) {
          if (w.points === null) continue;
          const base = (b[seat] || []).find(x => x.episode === w.episode), want = base && base.points !== null ? base.points + slotPoints(seat, w.episode) : null;
          if (want === null || Math.abs(w.points - want) > 0.011) throw new Violation('groups-paired', person.id + ' sees ' + g.id + ' ' + seat + ' episode ' + w.episode + ': ' + w.points + ' with group slots, ' + (base ? base.points : 'none') + ' without, slots recounted ' + slotPoints(seat, w.episode), actions.length);
        }
      }
    }
  } finally { twin.dispose(); }
}

// A captain, checked against a twin: the same definition without it, the lineup actions without their captainId (one refused here,
// for its captain or not, refused there too, so ids derived from the trace's length stay the same). Every action gets the same outcome;
// each seat's square, as each viewer sees it, is the twin's plus (times - 1) times their captain's line in the twin that episode
// (the captain as the episode keeps it, ActiveRosterLogic.captainFor: named, carried, and only while a starter).
function pairedCaptain(session, doc, actions, statuses) {
  // (Not a game with the top scorer's twist: a captain changes who scores most, so who chooses the twist; the twin can't replay it.)
  const caps = doc.games.filter(g => g.spec.score?.captain && !g.spec.score.twist);
  if (!caps.length) return;
  const S = require('../../../src/lib/game/state-logic');
  const twin = R.open({ ...doc, games: doc.games.map(g => caps.includes(g) ? { ...g, spec: { ...g.spec, score: Object.fromEntries(Object.entries(g.spec.score).filter(([k]) => k !== 'captain')) } } : g) });
  try {
    actions.forEach((a, i) => {
      const b = a.type === 'lineup' && 'captainId' in a ? (({ captainId, ...rest }) => statuses[i] === 'accepted' ? rest : { ...rest, ids: ['missing-participant'] })(a) : a;
      const s = twin.apply(b, 'campaign').status; if (s !== statuses[i]) throw new Violation('captain-twin-diverged', a.type + ' was ' + statuses[i] + ' with a captain and ' + s + ' without', i);
    });
    const snap = session.snapshot();
    for (const g of caps) {
      const st = snap.games[g.id].state, times = g.spec.score.captain.times;
      for (const person of snap.people) {
        const a = session.project(g.id, person.id).game.plays?.rows || {}, tt = twin.project(g.id, person.id).game, b = tt.plays?.rows || {};
        for (const [seat, rows] of Object.entries(a)) for (const w of rows) {
          if (w.points === null) continue;
          const base = (b[seat] || []).find(x => x.episode === w.episode), ep = st.episodes.find(e => e.number === w.episode), cap = ep ? S.ActiveRosterLogic.captainFor(st, ep.id, seat) : null;
          const line = cap ? (tt.table.find(r => r.playerId === seat)?.weeks || []).find(x => x.episode === w.episode)?.started?.find(l => l.id === cap)?.points ?? 0 : 0;
          if (!base || base.points === null || Math.abs(w.points - (base.points + (times - 1) * line)) > 0.011) throw new Violation('captain-paired', person.id + ' sees ' + g.id + ' ' + seat + ' episode ' + w.episode + ': ' + w.points + ' with a captain (' + cap + ', line ' + line + ' x' + times + '), ' + (base ? base.points : 'none') + ' without', actions.length);
        }
      }
    }
  } finally { twin.dispose(); }
}

// Secret roles, checked against a twin without them (the same walk). For every viewer: before they've seen the reveal, every seat's
// total is the twin's (nothing of the role on the table); from it, a seat with the role has the twin's plus its points for each castaway
// gone home (any way out but winning; on 'votedOut', a vote's) whom some seat without the role held then, through what they've seen;
// everyone else the twin's. The holders are the deal's (its store); who held whom, each episode's lineup (BountyLogic.heldFor).
function pairedRoles(session, doc, actions, statuses) {
  const rg = doc.games.filter(g => g.spec.score?.roles);
  if (!rg.length) return;
  const S = require('../../../src/lib/game/state-logic');
  const twin = R.open({ ...doc, games: doc.games.map(g => rg.includes(g) ? { ...g, spec: { ...g.spec, score: Object.fromEntries(Object.entries(g.spec.score).filter(([k]) => k !== 'roles')) } } : g) });
  try {
    actions.forEach((a, i) => { const s = twin.apply(a, 'campaign').status; if (s !== statuses[i]) throw new Violation('roles-twin-diverged', a.type + ' was ' + statuses[i] + ' with roles and ' + s + ' without', i); });
    const snap = session.snapshot();
    for (const g of rg) {
      const st = snap.games[g.id].state, cfg = S.SecretRoleLogic.of(st), deal = snap.stores.roles?.[g.id], holders = new Set(deal?.holders || []), exits = S.BountyLogic.exitsOf(st);
      for (const person of snap.people) {
        const v = session.project(g.id, person.id), forward = new Map(twin.project(g.id, person.id).game.table.map(r => [r.playerId, r.total])), seen = snap.contexts.show.marks.find(m => m.personId === person.id).through;
        const revealed = !!v.roles?.revealed;
        let owed = 0;
        if (revealed) for (const ep of st.episodes.filter(e => e.number <= seen && S.inPlay(st, e.number))) {
          const gone = (ep.events || []).filter(e => e.method !== WINNER && (cfg.on !== 'votedOut' || exits.has(e.method))).map(e => e.castawayId);
          for (const id of gone) if (st.players.some(p => !holders.has(p.id) && S.BountyLogic.heldFor(st, ep, p.id).includes(id))) owed += cfg.points;
        }
        for (const r of v.game.table) {
          const want = forward.get(r.playerId) + (revealed && holders.has(r.playerId) ? owed : 0);
          if (Math.abs(r.total - want) > 0.011) throw new Violation('roles-paired', person.id + ' sees ' + g.id + ' ' + r.playerId + ': ' + r.total + ' with roles, ' + forward.get(r.playerId) + ' without' + (revealed ? ', role points ' + (holders.has(r.playerId) ? owed : 0) : ', not revealed'), actions.length);
        }
      }
    }
  } finally { twin.dispose(); }
}

/** Run case `index`. `steps` replays an explicit action list instead of the seeded walk. */
function runCase(manifest, index, { steps: given = null, keep = false } = {}) {
  const started = Date.now(), id = Gen.caseId(manifest, index), seed = Gen.caseSeed(manifest, index);
  const inject = (manifest.inject || []).find(x => x.index === index) || null;
  let document, session;
  const base = { caseId: id, index, seed, generator: Gen.VERSION };
  try { document = Gen.definition(manifest, index); }
  catch (e) { return { ...base, outcome: 'generator-defect', signature: 'definition', message: e.message, ms: Date.now() - started }; }
  try {
    try { session = R.open(document); }
    catch (e) { return { ...base, outcome: e instanceof R.Blocked ? 'generator-defect' : 'error', signature: 'open:' + (e.report?.category || 'error'), message: e.message, ms: Date.now() - started }; }
    // An auction (get.order 'auction'), replayed here from the same sealed bids (runtime-data auctionBids), not AuctionLogic: every bid
    // from the highest down, won at what was bid while the team has room and can still pay the lowest price for each place left after
    // it; then a team its bids didn't fill takes what's left at the lowest price ('fill') or stays short. Each seat's team and what it
    // spent must be that (with two bids of one amount, the engine's seeded tie order decides: then only each win's price, the totals,
    // the sizes and nobody sharing are checked).
    for (const g of document.games.filter(g => g.spec.get?.order === 'auction')) {
      const Data = require('../explorer/runtime-data.cjs'), st = session.snapshot().games[g.id].state, doc0 = session.export().input, b = { total: 100, floor: 1, fallback: 'fill', ...g.spec.get.budget }, each = g.spec.get.each;
      const bids = Data.auctionBids(doc0, g, st), all = Object.entries(bids).flatMap(([pid, xs]) => xs.map(x => ({ pid, cid: x.castawayId, bid: x.bid })));
      const log = st.draftLog || [], teamOf = pid => st.castaways.filter(c => c.ownerIds.includes(pid)).map(c => c.id).sort(), fail = m => { throw new Violation('auction-settled', g.id + ': ' + m, 0); };
      if (st.castaways.some(c => c.ownerIds.length > 1)) fail('someone is on two teams');
      for (const p of st.players) {
        const mine = log.filter(x => x.playerId === p.id), spent = mine.reduce((t, x) => t + x.price, 0);
        if (spent > b.total || spent !== (st.auction?.spent?.[p.id] ?? 0)) fail(p.id + ' spent ' + spent + ' (recorded ' + st.auction?.spent?.[p.id] + ', budget ' + b.total + ')');
        if (mine.length > each || (b.fallback === 'fill' && mine.length < Math.min(each, st.castaways.length / st.players.length | 0))) fail(p.id + ' has ' + mine.length + ' of ' + each);
        for (const x of mine) if (x.filled ? x.price !== b.floor : x.price !== bids[p.id].find(y => y.castawayId === x.castawayId)?.bid) fail(p.id + ' won ' + x.castawayId + ' at ' + x.price + (x.filled ? ' (filled)' : ', not its bid'));
      }
      if (new Set(all.map(x => x.bid)).size === all.length) {
        const teams = Object.fromEntries(st.players.map(p => [p.id, []])), spent = Object.fromEntries(st.players.map(p => [p.id, 0])), free = new Set(st.castaways.map(c => c.id));
        for (const x of [...all].sort((p, q) => q.bid - p.bid)) if (free.has(x.cid) && teams[x.pid].length < each && x.bid <= b.total - spent[x.pid] - b.floor * (each - teams[x.pid].length - 1)) { teams[x.pid].push(x.cid); spent[x.pid] += x.bid; free.delete(x.cid); }
        for (const p of st.players) {
          const won = log.filter(x => x.playerId === p.id && !x.filled).map(x => x.castawayId).sort(), want = teams[p.id].sort();
          if (JSON.stringify(won) !== JSON.stringify(want)) fail(p.id + ' won ' + JSON.stringify(won) + ' by bidding, replayed ' + JSON.stringify(want));
          if (log.some(x => x.playerId === p.id && x.filled && !free.has(x.castawayId))) fail(p.id + ' was filled with someone a bid had taken');
          if (b.fallback === 'short' && log.some(x => x.playerId === p.id && x.filled)) fail(p.id + ' was filled in an auction that leaves teams short');
        }
      }
    }
    // A draft spread across the tribes (get.across): each team as drafted, recounted from the castaways' tribes (not SpreadLogic), has
    // no tribe past ceil(each / tribes) and each at least floor(each / tribes), as far as that tribe had people to give it (in an exclusive draft, its castaways nobody else took).
    for (const g of document.games.filter(g => g.spec.get?.across)) {
      const st = session.snapshot().games[g.id].state, tribes = (st.tribes || []).map(x => x.id), each = g.spec.get.each;
      if (tribes.length < 2) continue;
      const least = Math.floor(each / tribes.length), most = Math.ceil(each / tribes.length);
      for (const p of st.players) {
        const mine = st.castaways.filter(c => c.ownerIds.includes(p.id));
        for (const tr of tribes) { const n = mine.filter(c => c.tribeId === tr).length, had = st.castaways.filter(c => c.tribeId === tr && !c.ownerIds.some(o => o !== p.id && g.spec.get.own === 'exclusive')).length; if (n > most || n < Math.min(least, had)) throw new Violation('spread-draft', g.id + ' ' + p.id + ' drafted ' + n + ' from ' + tr + ' (each ' + each + ' across ' + tribes.length + ': ' + least + ' to ' + most + ')', 0); }
      }
    }
    const doc = session.export().input, r = Gen.rng([seed, 'walk']), depth = Math.min(manifest.limits?.depth ?? 12, 200), actions = [];
    const counts = { accepted: 0, rejected: 0, blocked: 0 }, known = new Set(), statuses = [];
    for (let step = 0; step < (given ? given.length : depth); step++) {
      const before = session.snapshot(), action = given ? given[step] : Gen.nextAction(r, before, doc, (g, p) => session.project(g, p));
      actions.push(action);
      const record = session.apply(action, 'campaign');
      counts[record.status] = (counts[record.status] || 0) + 1; statuses.push(record.status);
      invariants(session, doc, before, record, step, inject, known);
    }
    const exported = session.export(), replay = R.resume(exported);
    try { if (replay.hash() !== exported.stateHash) throw new Violation('replay-diverged', 'The exported run replays to a different hash', actions.length); } finally { replay.dispose(); }
    pairedTimes(session, doc, actions, statuses, known);
    pairedReverse(session, doc, actions, statuses);
    pairedTwist(session, doc, actions, statuses, known);
    pairedCaptain(session, doc, actions, statuses);
    pairedRoles(session, doc, actions, statuses);
    pairedGroups(session, doc, actions, statuses);
    const passed = { ...base, outcome: 'pass', counts, actions: actions.length, finalHash: exported.stateHash, ms: Date.now() - started, ...(known.size ? { known: [...known] } : {}) };
    if (keep) { const kept = session; session = null; return { ...passed, session: kept, doc }; }
    return passed;
  } catch (e) {
    if (e instanceof Violation) return { ...base, outcome: 'fail', signature: e.signature, message: e.message, step: e.step, ms: Date.now() - started };
    return { ...base, outcome: 'error', signature: 'runtime:' + (e.message || '').slice(0, 60), message: e.message, ms: Date.now() - started };
  } finally { session?.dispose(); }
}

/** A standalone reproducer: the definition plus the exact action list the failing walk took. */
function reproducer(manifest, index) {
  const document = Gen.definition(manifest, index), session = R.open(document), doc = session.export().input, seed = Gen.caseSeed(manifest, index);
  const r = Gen.rng([seed, 'walk']), depth = Math.min(manifest.limits?.depth ?? 12, 200), steps = [], executeSteps = [];
  try { for (let step = 0; step < depth; step++) { const a = Gen.nextAction(r, session.snapshot(), doc, (g, p) => session.project(g, p)); steps.push(a); executeSteps.push({ action: a, expect: session.apply(a, 'campaign').status }); } }
  finally { session.dispose(); }
  // executeSteps is what `gameplay-bench.js execute --steps-file` takes: each action with its recorded outcome.
  return { document, steps, executeSteps };
}

/** Drop steps one at a time while the same failure signature persists (a simple, deterministic minimizer). */
function minimize(manifest, index, steps, signature) {
  let current = steps.slice();
  for (let i = current.length - 1; i >= 0; i--) {
    const candidate = current.slice(0, i).concat(current.slice(i + 1)), result = runCase(manifest, index, { steps: candidate });
    if (result.outcome === 'fail' && result.signature === signature) current = candidate;
  }
  return current;
}
/**
 * API tier (plan §6A item 2): the engine walk, then its final state materialized as zt-gb rows (with social seeding) and
 * every person's real routes checked for agreement and spoilers (api-checks.cjs). `onLease(key)` is told the rows' key
 * before any DB write, so a crashed attempt's rows can be removed on resume. Needs the app (manifest.app) and local DB.
 */
async function runApiCase(manifest, index, { onLease } = {}) {
  const engine = runCase(manifest, index, { keep: true });
  if (engine.outcome !== 'pass') return { ...engine, tier: 'engine' };
  const Live = require('../live-db.cjs'), { checkCase } = require('../api-checks.cjs'), { session, doc, ...result } = engine, started = Date.now();
  let ids = null;
  try {
    const snap = session.snapshot(), shift = Date.now() - Date.parse(snap.clock);
    ids = await Live.up(snap, doc, undefined, onLease);
    await Live.sync(ids, snap, doc, shift); await Live.seedSocial(ids, snap, doc, shift);
    const all = await checkCase({ app: manifest.app || 'http://localhost:3000', ids, snap, document: doc, project: (g, p) => session.project(g, p) });
    const problems = all.filter(p => !p.signature.startsWith('known:')), known = [...new Set(all.filter(p => p.signature.startsWith('known:')).map(p => p.signature))];
    if (known.length || result.known) result.known = [...new Set([...(result.known || []), ...known])];
    return problems.length
      ? { ...result, outcome: 'fail', tier: 'api', signature: problems[0].signature, message: JSON.stringify(problems.slice(0, 3)).slice(0, 600), problems: problems.length, apiMs: Date.now() - started }
      : { ...result, tier: 'api', apiMs: Date.now() - started };
  } catch (e) {
    return { ...result, outcome: 'infrastructure', tier: 'api', signature: 'api:' + (e.code || e.message || '').slice(0, 40), message: e.message };
  } finally {
    session.dispose();
    if (ids) await Live.down(ids.key).catch(() => {});
    await Live.close().catch(() => {});
  }
}
module.exports = { runCase, runApiCase, reproducer, minimize, Violation };
