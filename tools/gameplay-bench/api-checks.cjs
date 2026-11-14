// Real-route checks for a materialized case (plan §6A item 2), shared by scripts/dev-test/check-bench-live-db.js and
// the campaign API tier. For each person, as their own zt user:
//   agreement: /games standings, catch-up flag and open lineup/pick episodes equal the runtime's production projection, and
//              head to head's record, last and next matchups, playoff seeds and champion; weeks won and the table's order;
//              a multiplied game's season grid (each seat's points on each episode);
//              questions about the whole game: what each closed one paid each seat;
//              parlays and rollovers: what each past window's sheet paid each seat, and a rolling question's jackpot, past
//              windows and the open one;
//   spoilers:  no route they read contains a token that exists only past their mark (after-air chat lines, later
//              scoring-moment IDs, recap sentences), with a positive control that the chat probe does see allowed ones.
//   bets:      nobody's routes carry someone else's guess on a side bet that's still open.
//   stakes:    the most an open question lets you stake (your points or a bank, less what's still riding) agrees;
//   season-long questions (asked once): the question sheet agrees on whether each is closed and on your own answer, and shows
//              nobody else's answer while it's open.
//   waivers:   each person's week as their waivers screen reads it, and Backstage › Waivers for whoever runs the game (the week, opened
//              by hand or not, who has picks in, the last run and whether it can be undone); nobody else sees a game there.
//   stages:    a game in stages' overall is the server's own (built from its stage leagues); each stage names its game; spans and
//              ends agree. Known (BACKLOG 61, `known:later-stage-past-mark`): someone behind is shown a later stage's start and team.
//   known:     the classic GET /api/leagues/{id}/state returns the whole league state (results past a person's mark);
//              reported as `known:classic-state-spoiler` so a fix can be proven, not counted as a new failure.
// Returns a list of { signature, person, detail }; empty means clean (callers treat `known:` signatures apart). Needs the app and the materialized rows (live-db.cjs).
const { signIn } = require('../ui-atlas/data.cjs');
const Spec = require('../../src/lib/game/game-spec');
const released = e => ['partial', 'final', 'corrected'].includes(e.resultStatus);
// The waivers screen's production view (src/lib/game/waiver-view.ts), loaded when a case first needs it.
let weekViewFn = null; const weekView = () => weekViewFn || (weekViewFn = require('jiti')(__filename, { alias: { '@': require('path').resolve(__dirname, '../../src') } })('../../src/lib/game/waiver-view.ts').waiverWeek);

async function checkCase({ app = 'http://localhost:3000', ids, snap, document, project, password = 'zt-pass-12345' }) {
  const problems = [], add = (signature, person, detail) => problems.push({ signature, person, detail });
  for (const person of snap.people) {
    const cookie = await signIn(app, ids.users[person.id].username, password);
    const get = async url => { const r = await fetch(app + url, { headers: { cookie } }); return { status: r.status, text: await r.text() }; };
    for (const [contextId, season] of Object.entries(ids.seasons)) {
      const world = snap.contexts[contextId], mark = world.marks.find(m => m.personId === person.id).through, q = '?couch=' + ids.couchId;
      const who = new Map(world.participants.map(x => [x.id, x.name])), games = document.games.filter(g => g.contextId === contextId);
      const facts = e => world.facts.find(x => x.eventId === e.id)?.data || { events: [], scoringEvents: [] };
      const chatLine = id => 'believe ' + who.get(id) + ' went home';
      // Agreement with the runtime's projection.
      const real = await get('/api/seasons/' + season.id + '/games' + q);
      if (real.status !== 200) { add('games-status', person.id, real.status); continue; }
      const list = JSON.parse(real.text).games || [];
      let waiverWeeks = null, waiverAdmin = null;
      for (const game of games) {
        const r = list.find(x => x.leagueId === ids.leagues[game.id]), m = project(game.id, person.id).game;
        if (!r) { add('game-missing', person.id, game.id); continue; }
        if (JSON.stringify(r.table.map(x => [x.playerId, x.total])) !== JSON.stringify(m.table.map(x => [x.playerId, x.total]))) add('standings-disagree', person.id, { game: game.id, server: r.table.map(x => x.total), runtime: m.table.map(x => x.total) });
        if (!!r.catchingUp !== !!m.catchingUp) add('catch-up-disagree', person.id, { game: game.id, server: r.catchingUp, runtime: m.catchingUp });
        if ((r.lineup?.episode ?? null) !== (m.lineup?.episode ?? null)) add('lineup-episode-disagree', person.id, { game: game.id, server: r.lineup?.episode, runtime: m.lineup?.episode });
        if ((r.pick?.episode ?? null) !== (m.pick?.episode ?? null)) add('pick-episode-disagree', person.id, { game: game.id, server: r.pick?.episode, runtime: m.pick?.episode });
        if (JSON.stringify(r.weeksWon ?? null) !== JSON.stringify(m.weeksWon ?? null) || JSON.stringify(r.table.map(x => x.playerId)) !== JSON.stringify(m.table.map(x => x.playerId))) add('weeks-or-order-disagree', person.id, { game: game.id, server: [r.weeksWon ?? null, r.table.map(x => x.playerId)], runtime: [m.weeksWon ?? null, m.table.map(x => x.playerId)] });
        // A game in stages (explorer/stages.cjs): each stage a league tied to its game. The server's view of a stage names its game
        // (stageOf: the game's league) and the game's own names none ('stage-of-disagree'); where each starts and ends, and whether
        // it's over, agree ('stage-span-disagree'). The game's table is the overall the server builds from the stage leagues
        // (answer-points.ts stageWalk): the standings check above compares it.
        if (game.spec.stages || game.stageOf !== undefined) {
          const want = game.stageOf !== undefined ? ids.leagues[game.stageOf] : null, span = x => [x.from ?? null, x.to ?? null, !!x.over];
          if ((r.stageOf ?? null) !== want) add('stage-of-disagree', person.id, { game: game.id, server: r.stageOf ?? null, runtime: want });
          if (JSON.stringify(span(r)) !== JSON.stringify(span(m))) add('stage-span-disagree', person.id, { game: game.id, server: span(r), runtime: span(m) });
          // Known (BACKLOG 61): someone behind is shown a later stage whose draft came after their mark: where it starts (so when the
          // merge came) and their team (drawn only from who was still in after episodes they haven't seen).
          if (game.stageOf !== undefined && Number.isInteger(r.from) && r.from - 1 > mark && (r.you?.team || []).length) add('known:later-stage-past-mark', person.id, { game: game.id, mark, from: r.from, team: r.you.team.length });
        }
        // Bounties: what each seat has taken or lost (the server stamps who voted for whom from the season's research rows).
        const moved = x => x ? Object.entries(x).filter(([, v]) => v).sort(([a], [b]) => a < b ? -1 : 1) : null;
        if (game.spec.score?.bounty && JSON.stringify(moved(r.twists?.bounty)) !== JSON.stringify(moved(m.twists?.bounty))) add('bounty-disagree', person.id, { game: game.id, server: r.twists?.bounty ?? null, runtime: m.twists?.bounty ?? null });
        // Multipliers (score.times) and the weekly card: the season grid, each seat's points on each episode (an episode's or the finale's
        // multiplied; only that week's card counting).
        const grid = x => x?.rows ? Object.entries(x.rows).sort(([a], [b]) => a < b ? -1 : 1).map(([p, rows]) => [p, rows.map(w => [w.episode, w.points])]) : null;
        if ((game.spec.score?.times || game.spec.card || game.spec.score?.captain || game.spec.get?.groups) && JSON.stringify(grid(r.plays)) !== JSON.stringify(grid(m.plays))) add('grid-disagree', person.id, { game: game.id, server: grid(r.plays), runtime: grid(m.plays) });
        // A survival pool's riders (mulligans, a buyback, a second pick, a skipped night): the viewer's lives, mulligans left, out and buy-back line, each seat's
        // points (a buyback's cost off them) and current streak, and the season grid.
        if (game.spec.score?.by === 'survive' && (game.spec.score.mulligans || game.spec.score.buyback || game.spec.get?.second || game.spec.get?.fallback === 'skip')) {
          const pool = x => [x.twists?.pool ?? null, x.table.map(t => [t.playerId, t.points, t.week, t.picks]), grid(x.plays)];
          if (JSON.stringify(pool(r)) !== JSON.stringify(pool(m))) add('pool-disagree', person.id, { game: game.id, server: pool(r), runtime: pool(m) });
        }
        // Group slots (get.groups): what the viewer's slots hold and what's on offer going into their next episode (the groups the game
        // has settled from the season's stored answers).
        if (game.spec.get?.groups) { const slots = x => [x.twists?.slots ?? null, x.twists?.offered ?? null]; if (JSON.stringify(slots(r)) !== JSON.stringify(slots(m))) add('slots-disagree', person.id, { game: game.id, server: slots(r), runtime: slots(m) }); }
        // An auction (get.order 'auction'): each seat's team as it settled (the server never settles a materialized one again).
        if (game.spec.get?.order === 'auction' || game.spec.extras?.waivers || snap.stores.waivers?.[game.id]) { const teams = x => x.table.map(t => [t.playerId, [...(t.team || [])].sort()]).sort((a, b) => a[0] < b[0] ? -1 : 1); if (JSON.stringify(teams(r)) !== JSON.stringify(teams(m))) add(game.spec.get?.order === 'auction' ? 'auction-teams-disagree' : 'waiver-teams-disagree', person.id, { game: game.id, server: teams(r), runtime: teams(m) }); }
        // Mid-season waivers: your own claim for the week that's open, as the waivers route reads it back (yours only; held back until
        // you've revealed the week's episode), against the runtime's store; and (above) each seat's team.
        if (game.spec.extras?.waivers || snap.stores.waivers?.[game.id]) {
          const W = require('../../src/lib/game/state-logic').WaiverLogic, st = snap.games[game.id].state, period = W.current(require('./explorer/runtime-waivers.cjs').pacedCopy(st) || st), seen = (snap.contexts[game.contextId].marks.find(x => x.personId === person.id)?.through ?? 0);
          const want = !period || !st.players.some(p => p.id === person.id) ? { periodId: period?.id ?? null, claim: null, hidden: false } : seen < period.episode ? { periodId: period.id, claim: null, hidden: true } : (pairs => pairs ? { periodId: period.id, pairs, hidden: false } : { periodId: period.id, claim: null, hidden: false })(snap.stores.waivers?.[game.id]?.weeks?.[period.id]?.[person.id]?.claim?.pairs);
          const w = await get('/api/leagues/' + ids.leagues[game.id] + '/waivers'), got = w.status === 200 ? JSON.parse(w.text) : null, have = got && (got.hidden || !got.claim ? { periodId: got.periodId, claim: got.claim, hidden: got.hidden } : { periodId: got.periodId, pairs: got.claim.pairs, hidden: false });
          if (JSON.stringify(have) !== JSON.stringify(want)) add('waiver-claim-disagree', person.id, { game: game.id, server: have ?? w.status, runtime: want });
        }
        // The week as each person's waivers screen reads it (GET /api/seasons/{S}/waivers): the production view (waiver-view.ts waiverWeek)
        // of the runtime's state at their mark against the real route. Its stage, the week's window and swaps (a window opened by
        // hand shows on a game with no waivers of its own), who they may replace, their swaps left, their own spots, the picking
        // order, and every run they may see, who got whom ('waiver-week-disagree').
        // And Backstage › Waivers (GET .../backstage/waivers) for whoever runs the game: the week and whether it was opened by hand,
        // who has picks in (never what they are), the last run and whether it can still be undone ('waiver-admin-disagree'); a game
        // someone doesn't run isn't theirs to see there ('waiver-admin-open').
        {
          const S = require('../../src/lib/game/state-logic'), W = S.WaiverLogic, st = snap.games[game.id].state;
          if (W.supported(st) && st.players.some(p => p.id === person.id)) {
            const league = ids.leagues[game.id], current = W.current(st), claim = current && current.phase === 'open' && mark >= current.episode ? snap.stores.waivers?.[game.id]?.weeks?.[current.id]?.[person.id]?.claim : null;
            const week = x => x && { stage: x.stage, revealFirst: x.revealFirst, period: x.period && [x.period.id, x.period.episode, x.period.window, x.period.swaps], replace: x.replace, outIds: x.outIds, nobodyFree: x.nobodyFree, swapsAllowed: x.swapsAllowed, swapsLeft: x.swapsLeft, team: x.team.map(c => c.id), free: x.free.map(c => c.id).sort(), spots: x.spots, order: x.order.map(o => o.playerId),
              runs: x.runs.map(r => [r.periodId, r.episode, r.moves.map(m => [m.playerId, m.kind, m.outcome, m.add?.id ?? null, m.drop?.id ?? null, m.choice ?? null]), r.freeAgency.map(m => [m.playerId, m.kind, m.add?.id ?? null, m.drop?.id ?? null])]) };
            waiverWeeks ??= JSON.parse((await get('/api/seasons/' + season.id + '/waivers' + q)).text || '{}').games || [];
            const want = week(weekView()({ leagueId: league, name: game.name || game.id, gameType: st.settings.leagueTypeId, gameName: game.name || game.id, yourRole: 'member' }, st, person.id, mark, () => null, claim?.pairs ?? null, null)), have = week(waiverWeeks.find(x => x.leagueId === league) ?? null);
            if (JSON.stringify(have) !== JSON.stringify(want)) add('waiver-week-disagree', person.id, { game: game.id, server: have, runtime: want });
            const boss = Object.entries(game.roles || {}).find(([, r]) => r === 'commissioner')?.[0] ?? st.players[0]?.id;
            waiverAdmin ??= await get('/api/seasons/' + season.id + '/backstage/waivers' + q);
            const mine = waiverAdmin.status === 200 ? (JSON.parse(waiverAdmin.text).games || []).find(x => x.leagueId === league) ?? null : null;
            if (boss !== person.id) { if (mine) add('waiver-admin-open', person.id, { game: game.id, status: waiverAdmin.status }); }
            else {
              const ran = W.periods(st).filter(p => p.run).at(-1);
              const wantAdmin = { period: current && ['open', 'processed'].includes(current.phase) ? [current.id, current.episode, current.phase, !!current.window, current.swaps ?? 0, current.openedBy === 'commissioner'] : null, revealFirst: current && current.episode > mark ? current.episode : null,
                claims: current ? W.rotation(st).map(id => [id, current.claimsIn.includes(id)]) : [], run: ran ? [ran.id, ran.episode, current?.id === ran.id && current.phase === 'processed'] : null };
              const haveAdmin = mine && { period: mine.period && [mine.period.id, mine.period.episode, mine.period.phase, mine.period.window, mine.period.swaps, mine.period.byHand], revealFirst: mine.revealFirst, claims: mine.claims.map(c => [c.playerId, c.in]), run: mine.run && [mine.run.periodId, mine.run.episode, mine.run.undoable] };
              if (JSON.stringify(haveAdmin) !== JSON.stringify(wantAdmin)) add('waiver-admin-disagree', person.id, { game: game.id, server: haveAdmin ?? waiverAdmin.status, runtime: wantAdmin });
            }
          }
        }
        // Beat the bot: how the couch did against it (the bot line: its calls settled, right, and each seat's beat and beaten).
        if ((game.spec.ask || []).some(q => q.beat) && JSON.stringify(r.bot ?? null) !== JSON.stringify(m.bot ?? null)) add('bot-line-disagree', person.id, { game: game.id, server: r.bot ?? null, runtime: m.bot ?? null });
        // Secret roles: the roles route's GET as this person reads it (dealt, their own role and its points, the reveal) against the runtime's.
        if (game.spec.score?.roles) {
          const ro = await get('/api/leagues/' + ids.leagues[game.id] + '/roles'), mr = project(game.id, person.id).roles ?? null;
          const shape = x => x && { dealt: x.dealt, mine: x.mine && [x.mine.role, x.mine.points, (x.mine.mates || []).map(p => p.playerId)], revealed: x.revealed && [x.revealed.at, x.revealed.holders.map(p => p.playerId)] };
          if (ro.status !== 200) add('roles-status', person.id, { game: game.id, status: ro.status });
          else if (JSON.stringify(shape(JSON.parse(ro.text))) !== JSON.stringify(shape(mr))) add('roles-disagree', person.id, { game: game.id, server: shape(JSON.parse(ro.text)), runtime: shape(mr) });
        }
        // The top scorer's twist: the twist route's GET as this person reads it (the episode being chosen, whether they choose it and
        // their choice; each filed twist, who chose it and how) against the runtime's.
        if (game.spec.score?.twist) {
          const tw = await get('/api/leagues/' + ids.leagues[game.id] + '/twist'), mt = project(game.id, person.id).twist ?? null;
          const shape = x => x && { next: x.next && [x.next.episode, x.next.youChoose, x.next.choice], played: (x.played || []).map(p => [p.episode, p.twist, p.by?.playerId ?? null, p.how]) };
          if (tw.status !== 200) add('twist-status', person.id, { game: game.id, status: tw.status });
          else if (JSON.stringify(shape(JSON.parse(tw.text))) !== JSON.stringify(shape(mt))) add('twist-disagree', person.id, { game: game.id, server: shape(JSON.parse(tw.text)), runtime: shape(mt) });
        }
        // Teams of players: who's on each (as the server kept the draw), its points and place.
        const sides = x => x && { set: x.set, yours: x.yours, teams: x.teams.map(t => [t.id, t.members.slice().sort(), t.points, t.place]) };
        if (JSON.stringify(sides(r.teams ?? null)) !== JSON.stringify(sides(m.teams ?? null))) add('teams-disagree', person.id, { game: game.id, server: sides(r.teams ?? null), runtime: sides(m.teams ?? null) });
        const h2h = x => x && { record: x.record, last: x.last && [x.last.episode, x.last.opponent, x.last.result], next: x.next && [x.next.episode, x.next.opponent], seeds: x.playoffs?.seeds ?? null, champion: x.playoffs?.champion ?? null, from: x.playoffs?.from ?? null };
        if (JSON.stringify(h2h(r.matchups ?? null)) !== JSON.stringify(h2h(m.matchups ?? null))) add('matchups-disagree', person.id, { game: game.id, server: h2h(r.matchups ?? null), runtime: h2h(m.matchups ?? null) });
      }
      // Season-long questions on the real question sheet.
      // Parlays and rollovers: each past window's sheet (the episode's, "for how it went") pays each seat what the runtime's grade does,
      // and a rolling question's jackpot there is the runtime's worth less its points.
      for (const game of games.filter(g => g.spec.score?.parlays || (g.spec.ask || []).some(q => q.rollover || q.answer === 'confidence' || q.beat))) {
        const m = project(game.id, person.id);
        for (const e of world.events.filter(e => e.number >= 1 && e.number <= mark && released(e))) {
          const r = await get('/api/seasons/' + season.id + '/answers?league=' + ids.leagues[game.id] + '&episode=' + e.number);
          if (r.status === 400) continue; // not in play (before its start, or after it ended early)
          if (r.status !== 200) { add('answers-status', person.id, { game: game.id, episode: e.number, status: r.status }); continue; }
          for (const v of JSON.parse(r.text).questions || []) {
            if (v.asked === 'once' || v.episode !== e.number) continue;
            const key = v.id + '|' + e.number, want = m.earned[key] || {};
            if (v.status === 'closed') for (const x of v.people || []) if (Math.abs((x.earned ?? 0) - (want[x.playerId] ?? 0)) > 1e-9) add('earned-disagree', person.id, { game: game.id, window: key, seat: x.playerId, server: x.earned, runtime: want[x.playerId] ?? 0 });
            if (v.rollover && (v.jackpot ?? null) !== (key in m.worth ? m.worth[key] - v.points : null)) add('jackpot-disagree', person.id, { game: game.id, window: key, server: v.jackpot ?? null, runtime: key in m.worth ? m.worth[key] - v.points : null });
          }
        }
        // The open window, as the sheet opens before you answer: a rolling question's jackpot as it stands for this viewer.
        if ((game.spec.ask || []).some(q => q.rollover)) {
          const r = await get('/api/seasons/' + season.id + '/answers?league=' + ids.leagues[game.id]);
          if (r.status === 200) for (const v of JSON.parse(r.text).questions || []) {
            const q = m.questions.find(x => x.id === v.id);
            if (!v.rollover || v.status !== 'open' || !q || q.closed || q.episode !== v.episode) continue;
            const key = v.id + '|' + v.episode, runtime = key in m.worth ? m.worth[key] - v.points : null;
            if ((v.jackpot ?? null) !== runtime) add('open-jackpot-disagree', person.id, { game: game.id, window: key, server: v.jackpot ?? null, runtime });
          }
        }
      }
      // Weekly Calls: each episode's calls as the calls route gives them to this person (calls.ts readCalls), through the one after
      // their mark: open, behind or closed, the two questions and their options, their own calls and how each stands; or the same
      // refusal. A cast call is compared by name (the server stores season_cast ids, the runtime the world's).
      for (const game of games.filter(g => Spec.callsAsk(Spec.fullSpec(g.spec).ask))) {
        const m = project(game.id, person.id), named = new Map(world.participants.map(x => [x.id, x.name]));
        for (let n = 1; n <= Math.min(world.events.length, mark + 1); n++) {
          const r = await get('/api/seasons/' + season.id + '/calls/' + n + '?couch=' + ids.couchId), want = m.calls?.[n];
          if (!want || want.refused) { if (r.status !== (want?.refused ?? 200)) add('calls-status-disagree', person.id, { game: game.id, episode: n, server: r.status, runtime: want?.refused ?? null }); continue; }
          if (r.status !== 200) { add('calls-status-disagree', person.id, { game: game.id, episode: n, server: r.status, runtime: 200 }); continue; }
          const v = JSON.parse(r.text), label = (x, key, a) => x.questions.find(q => q.key === key)?.options.find(o => o.key === a)?.label ?? (named.get(a) || a);
          const shape = (x, ours) => ({ status: x.status, catchUp: x.catchUp ?? null, questions: (x.questions || []).map(q => [q.key, q.options.map(o => o.label)]),
            // (A cast call on an episode not shown to them, someone behind: that they called it, since the server's id has no name there.)
            mine: Object.fromEntries(Object.entries(x.mine || {}).map(([k, a]) => [k, k === 'out' ? (!(x.questions || []).some(q => q.key === 'out') ? 'called' : ours ? named.get(a) : label(x, k, a)) : a])),
            verdicts: x.verdicts ? Object.fromEntries(Object.entries(x.verdicts).map(([k, s]) => [k, s.state === 'known' ? s.right.map(a => (k === 'out' ? (ours ? named.get(a) : label(x, k, a)) : a)) : s.state])) : null });
          if (JSON.stringify(shape(v, false)) !== JSON.stringify(shape(want, true))) add('calls-disagree', person.id, { game: game.id, episode: n, server: shape(v, false), runtime: shape(want, true) });
        }
      }
      // (And stakes: the most each open question lets you stake, where it draws on your points or a bank.)
      for (const game of games.filter(g => (g.spec.ask || []).some(q => q.asked === 'once' || q.wager !== undefined))) {
        const r = await get('/api/seasons/' + season.id + '/answers?league=' + ids.leagues[game.id]);
        if (r.status !== 200) { add('answers-status', person.id, { game: game.id, status: r.status }); continue; }
        const sheet = JSON.parse(r.text);
        for (const q of project(game.id, person.id).questions.filter(q => q.wager !== null && q.wager !== undefined && !q.closed)) {
          const v = (sheet.questions || []).find(x => x.id === q.id);
          if (v && v.status === 'open' && (v.stakeMost ?? null) !== (q.stakeMost ?? null)) add('stake-limit-disagree', person.id, { game: game.id, question: q.id, server: v.stakeMost ?? null, runtime: q.stakeMost ?? null });
        }
        for (const q of project(game.id, person.id).questions.filter(q => q.asked === 'once')) {
          const v = (sheet.questions || []).find(x => x.id === q.id);
          if (!v) { add('question-missing', person.id, { game: game.id, question: q.id }); continue; }
          if ((v.status === 'closed') !== q.closed) add('question-lock-disagree', person.id, { game: game.id, question: q.id, server: v.status, runtime: q.closed });
          if (JSON.stringify(v.mine ?? null) !== JSON.stringify(q.mine ?? null)) add('question-answer-disagree', person.id, { game: game.id, question: q.id, server: v.mine ?? null, runtime: q.mine ?? null });
          if (v.status !== 'closed' && (v.people || []).some(x => !x.you && x.answer != null)) add('answer-visible', person.id, { game: game.id, question: q.id });
          // What a closed question about the whole game paid each seat (a moment's who, first, whether, how many; the season's
          // winner), against the runtime's grade (episode 0).
          const want = project(game.id, person.id).earned[q.id + '|0'] || {};
          if (v.status === 'closed') for (const x of v.people || []) if (Math.abs((x.earned ?? 0) - (want[x.playerId] ?? 0)) > 1e-9) add('once-earned-disagree', person.id, { game: game.id, question: q.id, seat: x.playerId, server: x.earned ?? null, runtime: want[x.playerId] ?? 0 });
        }
      }
      // Spoilers: tokens that exist only past this person's mark.
      const later = world.events.filter(e => e.number > mark && released(e));
      const secrets = later.flatMap(e => ['Synthetic recap of episode ' + e.number, ...facts(e).events.map(x => chatLine(x.castawayId)), ...facts(e).scoringEvents.map(x => x.id)]);
      // Others' guesses on bets still open (by the case's clock; the server's schedule is shifted to match).
      const now = Date.parse(snap.clock), openGuesses = games.flatMap(g => snap.games[g.id].state.episodes.filter(e => !(e.airsAt && Date.parse(e.airsAt) <= now) && !(e.events || []).length && !(e.scoringEvents || []).length)
        .flatMap(e => (e.bets || []).flatMap(b => (b.predictions || []).filter(q => q.playerId !== person.id && q.guess.length >= 8).map(q => q.guess))));
      const reads = ['/api/me/home', '/api/seasons/' + season.id + '/space' + q, '/api/seasons/' + season.id + '/games' + q, '/api/seasons/' + season.id + '/episodes' + q, '/api/seasons/' + season.id + '/chat' + q, '/api/seasons/' + season.id + '/how-it-works' + q, ...games.filter(g => (g.spec.ask || []).length).map(g => '/api/seasons/' + season.id + '/answers?league=' + ids.leagues[g.id])];
      for (const url of reads) {
        const r = url.includes('/games') ? real : await get(url);
        if (r.status >= 500) add('server-error', person.id, url.split('?')[0] + ' ' + r.status);
        const leaked = secrets.filter(t => r.text.includes(t));
        if (leaked.length) add('spoiler', person.id, { route: url.split('?')[0].replace(season.id, '{season}'), mark, leaked: leaked.slice(0, 3) });
        const peeked = openGuesses.filter(t => r.text.includes(t));
        if (peeked.length) add('guess-visible', person.id, { route: url.split('?')[0].replace(season.id, '{season}'), guesses: peeked.slice(0, 3) });
      }
      // Known defect, still checked: the classic league state route.
      for (const g of games) {
        const classic = await get('/api/leagues/' + ids.leagues[g.id] + '/state');
        const leaked = secrets.filter(t => classic.text.includes(t)), peeked = openGuesses.filter(t => classic.text.includes(t));
        if (leaked.length || peeked.length) add('known:classic-state-spoiler', person.id, { game: g.id, mark, results: leaked.length, guesses: peeked.length });
      }
      // Control: an allowed after-air line reaches them through /chat (when the case has a game to carry chat).
      const allowed = world.events.filter(e => e.number <= mark && released(e)).flatMap(e => facts(e).events.map(x => chatLine(x.castawayId)));
      if (allowed.length && games.length) { const chat = await get('/api/seasons/' + season.id + '/chat' + q); if (!allowed.some(t => chat.text.includes(t))) add('oracle-blind', person.id, 'no allowed after-air line in /chat'); }
    }
  }
  return problems;
}
module.exports = { checkCase };
