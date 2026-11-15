// A generated sports world (core-runtime-30; the breadth program's thirty-sixth capability, sports statistics, first slice: a drafted
// team scored by a sport's stats with plain points, ranked by total, locking at each episode's start).
//
// What a sport context holds (document.cjs already takes kind 'sport'): `key`, its league as the app names it ('football/nfl');
// `format: { id: 'generic' }` (a sport has no show rulebook: nobody goes home, no moments); `engine`, the app's own page context for
// that league (src/lib/sports/page.ts sportPageContext: its stats, positions, sizes) with the couch and the pool, which
// Spec.specProblems checks a game against (contextFor builds it). Its participants are athletes, each with a position
// (`role`, the league's default lineup's slots in turn); its events are the season's episodes (a week or an event's day: the
// cadence is the league's, the spacing the world's); each released event's fact is its box score: `data.lines`, every athlete's
// raw counts as a provider gives them ({ [participantId]: { STAT: n } }), beside the empty `events` and `scoringEvents` every fact has.
//
// How results reach a game: as the server brings them (src/lib/server/sports/score.ts stampStats, on every read and after every
// write): the engine's own stamp (StatsLogic.stamp) of each released episode's lines by castaway, the sport's derived stats
// worked out (Sport.full), every released episode final, each castaway's position group. Stamped keys are never part of a saved
// state (StatsLogic.stampedKeys; db.ts leaves them out), so the materializer writes the lines to the tables the server reads
// (season_events, sports_events), not to the league.
//
// Who sees what (core-runtime-32): a sport's results show straight away, whatever someone's mark, unless they hide sports
// scores too or play only at their own pace there (`guard`, the server's own rule). A person's `hidesScores: true` in the
// definition is that Account setting; the materializer writes it (user_settings.hide_sports_scores).
//
// Locks by the day or the week (core-runtime-34: `lockTimes`), and head to head (rank.by 'matchups': the engine's own, as on a
// show; an episode is a matchup).
//
// Categories and roto (core-runtime-35: the profile alone). Points by place (core-runtime-36): a field's results are its lines and
// its standings (resultsFor, keptLines: golf's and racing's), the server's `sports_events.shape`.
//
// Points by position (core-runtime-37): the profile; a soccer match's line of its own (soccerLine).
//
// Points by a match's format (core-runtime-38): a tennis day's results are its lines and its matches (tennisCard; boutsOf).
//
// A slate, a week of several games scored game by game, and a lock at each game's start (core-runtime-39: below, "A slate").
//
// A game called off and a week in progress (core-runtime-40: below, "Called off, and a week in progress"): the server's L3 part 3b
// and part 2f.
//
// Not connected yet (runtime-profile.cjs says so, a gap each): a fight card's bouts (no MMA table scores by format); a definition
// that supplies an event already called off (the action calls one off); a postponed game's makeup (a game of its own, a listing's);
// a call-off out of event order; any other kind of game on a sport context.
const S = require('../../../src/lib/game/state-logic');
// The app's sport definitions are TypeScript (src/lib/sports), loaded through jiti by the bench's sports.cjs: only when a
// definition has a sport context, so a show's world starts as fast as it did.
let bench = null;
const Bench = () => bench || (bench = require('../sports.cjs'));
const json = v => JSON.parse(JSON.stringify(v));

/** A sport context's league: its sport, defaults and page context (the bench's resolve), or a thrown reason. */
function league(context) {
  if (typeof context.key !== 'string' || !context.key) throw Error("A sport context names its league (key: 'football/nfl')");
  return Bench().resolve(context.key);
}
/**
 * A definition's sport context for a league: the app's page context for it, with the couch and the pool (its athletes). `pool:
 * 'real'` is the league's real-size pool (REAL, below: its size, positions in the league's own shares; the context's `athletes:
 * 'real'`); a number with `athletes: 'real'` is that many in the same shares.
 */
function contextFor(key, { couch, pool, id = 'sport', athletes } = {}) {
  const c = Bench().resolve(key), real = pool === 'real' || athletes === 'real';
  const size = pool === 'real' ? realPool(key).size : pool;
  return { id, kind: 'sport', key, format: { id: 'generic' }, engine: { ...json(c.context), ...(couch === undefined ? {} : { couch }), ...(size === undefined ? {} : { pool: size }) }, ...(real ? { athletes: 'real' } : {}) };
}
/** The positions the league's default lineup takes, slot by slot (sports.cjs make's roleFor): generated athletes take them in turn. */
function roles(c) {
  const roleFor = takes => c.sport.id === 'tennis' && c.league.endsWith('/wta') ? 'WS' : c.sport.positions.find(p => takes.includes(p.key) || takes.includes(p.group))?.key || c.sport.positions[0]?.key || 'Player';
  const list = c.defaults.slots.lineup.flatMap(slot => Array(slot.n).fill(roleFor(slot.takes)));
  return list.length ? list : [c.sport.positions[0]?.key || 'Player'];
}
// ---- A real-size pool (core-runtime-41) ----
// The bench's earlier sports worlds are small: a pool just big enough for the couch's teams, its athletes taking the default
// lineup's slots in turn (an NFL world of 49: six or seven of everything). A draft room, waivers and a lineup sheet are designed
// for a league's own pool: hundreds of athletes, far more receivers than kickers. A team sport's context with `athletes: 'real'`
// (contextFor's pool 'real') deals its generated athletes positions in the league's own shares: a fantasy league's draftable pool
// as Yahoo and ESPN list it (every team's defense and kicker, the quarterbacks a team carries, the receivers and backs who play),
// in round numbers. They're dealt in a smooth interleave (the weighted round robin), so every run of the cast holds each position
// in about its share: the runtime drafts each team the next of the cast in turn, so every team has about two quarterbacks, four
// backs and five receivers of fifteen, as a real draft's do. A pool larger than the table's size repeats the deal; a smaller one
// is its first part. A sport the table doesn't have (a field, a card: golf's and racing's competitors, tennis's draws, a fight
// card's classes) refuses it. Opt-in, so every other world's athletes, facts and hashes are as they were.
const REAL = {
  football: { QB: 40, RB: 80, WR: 110, TE: 50, PK: 32, DEF: 32 }, // 344: 32 teams' defenses and kickers
  basketball: { PG: 70, SG: 75, SF: 65, PF: 65, C: 55 }, // 330
  baseball: { C: 35, '1B': 30, '2B': 30, '3B': 30, SS: 30, LF: 30, CF: 30, RF: 30, DH: 15, SP: 90, RP: 80 }, // 430: about half pitchers
  hockey: { C: 80, LW: 75, RW: 75, D: 110, G: 40 }, // 380
  soccer: { G: 40, D: 125, M: 130, F: 65 }, // 360
};
/** A league's real-size pool: { size, shares: { position: count } } (REAL, by its sport), or a thrown reason. */
function realPool(key) {
  const c = Bench().resolve(key), shares = REAL[c.sport.id];
  if (!shares) throw Error("A real-size pool is a team sport's (football, basketball, baseball, hockey, soccer): " + key + ' is ' + c.sport.id);
  return { size: Object.values(shares).reduce((a, b) => a + b, 0), shares: { ...shares } };
}
/** The deal of a pool's positions, in order: each position its count, interleaved (the smooth weighted round robin). */
function realDeal(shares) {
  const keys = Object.keys(shares), total = keys.reduce((n, k) => n + shares[k], 0), current = Object.fromEntries(keys.map(k => [k, 0])), out = [];
  for (let i = 0; i < total; i++) {
    let best = null;
    for (const k of keys) { current[k] += shares[k]; if (best === null || current[k] > current[best]) best = k; }
    current[best] -= total; out.push(best);
  }
  return out;
}
/** Each generated athlete's position, in the cast's order: the default lineup's slots in turn, or the league's own shares (athletes 'real'). */
function assignRoles(context, participants) {
  if (context.athletes !== undefined && context.athletes !== 'real') throw Error("context.athletes is 'real' (a league's real-size pool, its positions in the league's shares) or left out");
  const r = context.athletes === 'real' ? realDeal(realPool(context.key).shares) : roles(league(context));
  participants.forEach((p, i) => { if (typeof p.role !== 'string' || !p.role) p.role = r[i % r.length]; });
}
/** One released event's box score: every athlete's raw counts (the bench's seeded lines by sport and position; `pick(i)` a seeded number). */
function linesFor(context, participants, pick) {
  const c = league(context);
  if (c.sport.id === 'soccer') return Object.fromEntries(participants.map((p, i) => [p.id, soccerLine(c, p.role, streamOf(pick, 'soccer-' + i))]));
  return Object.fromEntries(participants.map((p, i) => [p.id, Bench().rawLine(c.sport, p.role, pick(i) % 10)]));
}
/**
 * A soccer player's match (core-runtime-37: points by position): the bench's seeded line gives no outfield player a goal
 * conceded (every midfielder and forward a clean sheet) and no keeper a goal, so a table by position group would be exercised
 * for half its cells. Here: a start or a substitute's minutes (a clean sheet needs 60 of them), goals conceded while on for
 * everyone (the team's, as ESPN's lines have them), goals most often from forwards and midfielders and once in a while a
 * keeper's, a keeper's saves and penalty saves, cards, an own goal now and then.
 */
function soccerLine(c, role, next) {
  const group = c.sport.position(role)?.group, start = next() % 5 !== 0, MIN = start ? (next() % 4 === 0 ? 55 + next() % 30 : 90) : 1 + next() % 40;
  const odds = { GK: 60, DEF: 9, MID: 4, FWD: 2 }[group] || 5, G = next() % odds === 0 ? 1 + (next() % 6 === 0 ? 1 : 0) : 0;
  const line = { APP: 1, GS: start ? 1 : 0, SUB: start ? 0 : 1, MIN, G, A: next() % 6 === 0 ? 1 : 0, SHOT: G + next() % 3, SOG: G + next() % 2, GA: next() % 4, OG: next() % 40 === 0 ? 1 : 0, YC: next() % 6 === 0 ? 1 : 0, RC: next() % 50 === 0 ? 1 : 0, PKM: 0 };
  if (group === 'GK') Object.assign(line, { SV: next() % 8, PKSV: next() % 12 === 0 ? 1 : 0 });
  return line;
}
/** Whether a context's league is a field (golf, racing: competitors and their standings; the page context's shape). */
const isField = context => league(context).context.shape === 'field';
// ---- A slate: a week of several games (core-runtime-39) ----
// A league's slate (src/lib/sports/slate.ts; migration 0304): a season of a whole league's games, several an episode. The context's
// opt-in `slate: { games: 2 to 6 }` (a team sport's): twice as many teams, each athlete on one in turn (`team`, the season's cast's
// tribe_name, as the server reads a holding's team); each week its games, the teams in a round robin (gamesOf: two a day, three hours
// apart, from the event's own air time, its first game). A released week's results are each game's lines (`games`: { [game id]:
// { [participantId]: STAT counts } }, for the athletes of its two teams), and the server's read of them (slateLines): each game's
// lines with its derived stats worked out (statGames), and the week's, its games' added up with a rate worked out on the counts'
// sum (score.ts leagueGames). A slate's episode locks at its own first game whatever its cadence (locks.ts locksOf's `slate`); one
// that closes at each game's start (closes 'game') locks each holding with its own team's game, for the rest of that day, each game
// counting the lineup in force when it started (gameLocks: the server's air-times.ts stampGameLocks; ActiveRosterLogic.eachGame).
const TEAMS = ['Harbor Hawks', 'Summit Bears', 'River Foxes', 'Canyon Owls', 'Prairie Wolves', 'Coast Herons', 'Forest Elks', 'Delta Cranes', 'Mesa Lynx', 'Valley Otters', 'Ridge Ravens', 'Bay Falcons'];
const HOUR = 3600000;
/** A context's slate ({ games }), checked, or null for a world of one game an episode. */
function slateOf(context) {
  const sl = context.slate;
  if (sl === undefined) return null;
  if (!sl || typeof sl !== 'object' || Array.isArray(sl) || Object.keys(sl).some(k => k !== 'games') || !Number.isInteger(sl.games) || sl.games < 2 || sl.games > 6) throw Error('context.slate is { games: 2 to 6 } (a week of several games)');
  if (league(context).context.shape !== 'team') throw Error("A slate is a team sport's week of several games");
  return sl;
}
/** A slate's teams, by name (none without a slate). */
const teamsOf = context => { const sl = slateOf(context); return sl ? TEAMS.slice(0, 2 * sl.games) : []; };
/** Each generated athlete's team, in turn (a slate's world only). */
function assignTeams(context, participants) {
  const t = teamsOf(context);
  if (t.length) participants.forEach((p, i) => { if (typeof p.team !== 'string' || !p.team) p.team = t[i % t.length]; });
}
/** A week's games (a slate's): a round robin of its teams, the first at the event's air time, two a day three hours apart. */
function gamesOf(context, event) {
  const teams = teamsOf(context);
  if (!teams.length || !event) return [];
  const n = teams.length, rest = teams.slice(1), turn = (event.number - 1) % (n - 1), order = [teams[0], ...rest.slice(turn), ...rest.slice(0, turn)];
  const t0 = event.airAt ? Date.parse(event.airAt) : null;
  return Array.from({ length: n / 2 }, (_, j) => ({ id: event.id + '-g' + (j + 1), teams: [order[j], order[n - 1 - j]], airAt: t0 === null ? null : new Date(t0 + Math.floor(j / 2) * 24 * HOUR + (j % 2) * 3 * HOUR).toISOString() }));
}
// ---- Called off, and a week in progress (core-runtime-40) ----
// A linked game the provider says is over without being played (postponed or cancelled: sports_events' state 'post', not final,
// its `called`): on the server its results are in and nothing happened (score.ts stampStats: an episode's one game 'off' is among
// the finals, with no lines; nothing scores, the game moves on past it), and it locks nothing (air-times.ts PLAYED: a day's or a
// week's lock is its first game played, a holding of its team stays free to move, a slate's week locks at its first game played).
// Told any time before its results are in, before or after its start (a lock can open again once its game is called off, as the
// server works the locks out on every read). The `calledOff` action (runtime.cjs): an episode's one game, its event's resultStatus
// 'postponed' or 'cancelled' (the document's words; the server's 'canceled'); a slate's game, the event's `calledOff`
// ({ [game id]: 'postponed' | 'cancelled' }).
// A slate's week in progress (score.ts: an episode only once every game in it is over, final and kept, or off: a partial week is
// never its results): a `results` action 'partial' carries the games final so far (`games`, some of the week's played games, not
// all). The event stays unavailable, nothing of it is stamped, and the fact holds those games' lines for the materializer, which
// writes each one final. Once every game is final or called off, the week is in: 'final' with every game played, or by the last
// call-off. An episode of one game has no partial result: the server keeps a line only once its game is final.
/** A slate week's games called off ({ [game id]: 'postponed' | 'cancelled' }). */
const offOf = event => (event && event.calledOff) || {};
/** Whether an event's one game is called off (an episode of one game). */
const isOff = event => !!event && ['postponed', 'cancelled'].includes(event.resultStatus);
/** A slate week's games still played (every game not called off), in order. */
const playedOf = (context, event) => gamesOf(context, event).filter(g => !offOf(event)[g.id]);
/** A slate week's results read as the server reads them: each game's lines (derived stats worked out) and the week's (added up,
 *  a rate worked out on the counts' sum, its raw counts kept apart). */
function slateLines(c, data) {
  const rates = new Set(Object.entries(c.sport.categoryDefs()).filter(([, d]) => d.parts).map(([k]) => k)), raw = {}, counts = {}, byGame = {};
  for (const [gid, l] of Object.entries(data.games)) {
    const each = Object.fromEntries(Object.entries(l).map(([id, x]) => [id, c.sport.full(x)]));
    byGame[gid] = each;
    for (const [id, x] of Object.entries(l)) {
      const had = (raw[id] ||= {});
      for (const [k, v] of Object.entries(x)) had[k] = (had[k] || 0) + v;
      const got = (counts[id] ||= {});
      for (const [k, v] of Object.entries(each[id] || {})) if (!rates.has(k)) got[k] = (got[k] || 0) + v;
    }
  }
  const week = Object.fromEntries(Object.entries(counts).map(([id, l]) => [id, { ...l, ...Object.fromEntries(Object.entries(c.sport.full(raw[id] || {})).filter(([k]) => rates.has(k))) }]));
  return { byGame, week };
}
// ---- A field's results (core-runtime-36: points by place) ----
// A field event's final as the app keeps one (src/lib/sports/final.ts StoredField): everyone's counts, and the standings, each
// one's place in them (the tied sharing it: golf's T9), or none for whoever is out of the places (cut, withdrew, disqualified).
// The places are the field's, and a field is bigger than the cast (a tour's 70 to 150, a race's 20 to 40): the generated field is
// the athletes and some more, whose places are counted but who aren't in the cast, so a place in the cast can be 31st.
// A place is the standings' alone: a fact's lines carry no place stat (the sport's placeKeys: POS, W, TOP10, CUT, PODIUM...), as
// the app's final leaves them to the standings; the kept line is the counts with the sport's own placeStats added (keptLines).
const RACE_FIELD = { f1: 20, irl: 27 };
/** A seeded stream from an event's `pick(key)`: each call a new number (the generator's pick ignores its key: a new one each call). */
const streamOf = (pick, tag) => { let k = 0; return () => pick(tag + '-' + (k++)); };
/** Golf: someone's holes over `rounds` rounds `toPar` over par (the line's counts add up to it), and their strokes. */
function golfCounts(rounds, toPar, next) {
  const holes = 18 * rounds, EAG = next() % 6 === 0 ? 1 : 0, DBL = next() % 3, WORSE = next() % 7 === 0 ? 1 : 0;
  let BOG = 2 * rounds + next() % (2 * rounds), BIR = BOG + 2 * DBL + 3 * WORSE - 2 * EAG - toPar;
  if (BIR < 0) { BOG -= BIR; BIR = 0; }
  const BS3 = next() % 3, BS4 = next() % 6 === 0 ? 1 : 0;
  return { STR: 72 * rounds + toPar, TOPAR: toPar, HOLES: holes, EAG, BIR, PAR: holes - EAG - BIR - BOG - DBL - WORSE, BOG, DBL, WORSE, ALB: 0, HIO: 0, BFR: next() % Math.min(3, rounds), BS3, BS4, BS5: 0, BS6: 0 };
}
/** A golf tournament: four rounds, a cut after two (none on LIV), everyone placed by their score to par with the tied sharing a
 *  place, one leader (a tie at the top goes to a playoff: its winner is placed alone), now and then a withdrawal. */
function golfField(c, participants, next) {
  const extra = next() % (participants.length + 1), size = participants.length + extra, cut = !c.league.endsWith('/liv');
  const all = Array.from({ length: size }, (_, i) => ({ id: i < participants.length ? participants[i].id : null, two: (next() % 15) - 6, last: (next() % 13) - 7, wd: i < participants.length && next() % 30 === 0 }));
  // The cut: the better two thirds after two rounds go on (the tied at the line with them).
  const line = cut ? all.filter(x => !x.wd).map(x => x.two).sort((a, b) => a - b)[Math.floor((size - 1) * 2 / 3)] : Infinity;
  for (const x of all) { x.status = x.wd ? 'wd' : x.two > line ? 'cut' : 'in'; x.toPar = x.two + (x.status === 'in' ? x.last : 0); }
  const placed = all.filter(x => x.status === 'in'), best = Math.min(...placed.map(x => x.toPar));
  placed.filter(x => x.toPar === best).slice(1).forEach(x => { x.toPar += 1; });
  const standings = [], lines = {};
  for (const x of all.filter(y => y.id)) {
    const place = x.status === 'in' ? 1 + placed.filter(y => y.toPar < x.toPar).length : null;
    standings.push({ id: x.id, place, tied: place !== null && placed.filter(y => y.toPar === x.toPar).length > 1, status: x.status, ...(cut ? { madeCut: x.status === 'in' } : {}) });
    lines[x.id] = { ...golfCounts(x.status === 'in' ? 4 : x.status === 'wd' ? 1 : 2, x.toPar, next), ...(x.status === 'cut' ? { MC: 1 } : x.status === 'wd' ? { WD: 1 } : {}) };
  }
  return { lines, standings };
}
/** A race weekend: everyone's finishing order (a retirement classified behind the finishers, a disqualification out of the
 *  places), the grid, laps led; F1's qualifying and, one weekend in three, a sprint; the series' own championship points. */
function raceField(c, participants, next) {
  const series = c.league.split('/')[1], f1 = c.sport.feed === 'f1', size = Math.max(participants.length, RACE_FIELD[series] || 38);
  const ids = Array.from({ length: size }, (_, i) => (i < participants.length ? participants[i].id : null));
  const order = list => list.map(i => ({ i, k: next() })).sort((a, b) => a.k - b.k).map(x => x.i);
  const fate = new Map(ids.map((id, i) => [i, next() % 40 === 0 ? 'dq' : next() % 8 === 0 ? 'dnf' : 'fin']));
  const slot = ids.map((id, i) => i), finish = [...order(slot.filter(i => fate.get(i) === 'fin')), ...order(slot.filter(i => fate.get(i) === 'dnf'))];
  const grid = order(slot), sprint = f1 && next() % 3 === 0, spr = sprint ? order(slot) : null, sgrid = sprint ? order(slot) : null;
  const laps = 50 + next() % 30, leaders = order(finish).slice(0, 3), ledBy = new Map(leaders.map((i, j) => [i, j === 0 ? 20 + next() % 30 : 1 + next() % 15])), fastest = finish[next() % finish.length];
  const most = [...ledBy].sort((a, b) => b[1] - a[1])[0][0];
  const pts = f1 ? [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] : series === 'irl' ? [50, 40, 35, 32, 30, 28, 26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10] : Array.from({ length: 40 }, (_, j) => (j === 0 ? 40 : Math.max(1, 36 - j)));
  const standings = [], lines = {};
  for (let i = 0; i < participants.length; i++) {
    const dq = fate.get(i) === 'dq', place = dq ? null : finish.indexOf(i) + 1, start = grid.indexOf(i) + 1, led = ledBy.get(i) || 0;
    standings.push({ id: ids[i], place, tied: false, status: dq ? 'dq' : 'in' });
    const line = { ...(place ? { FIN: place, PG: start - place } : {}), GRID: start, POLE: start === 1 ? 1 : 0, LAPS: fate.get(i) === 'dnf' ? next() % laps : laps, LED: led, LEDANY: led ? 1 : 0, LEADLAP: fate.get(i) === 'fin' && place <= 12 ? 1 : 0, CHPTS: place ? pts[place - 1] || 0 : 0 };
    if (f1) {
      // (F1's grid is its qualifying order.)
      Object.assign(line, { QUAL: start, Q2: start <= 15 ? 1 : 0, Q3: start <= 10 ? 1 : 0, FL: i === fastest ? 1 : 0, DNF: fate.get(i) === 'dnf' ? 1 : 0, DQ: dq ? 1 : 0, PITS: 1 + next() % 3 });
      if (sprint) { const sp = spr.indexOf(i) + 1, sg = sgrid.indexOf(i) + 1; Object.assign(line, { SPR: sp, SGRID: sg, SPG: sg - sp, SLAPS: 17, SFL: 0, SDNF: 0, SDQ: 0 }); line.CHPTS += sp <= 8 ? 9 - sp : 0; }
      delete line.LED;
    } else Object.assign(line, { MOSTLED: i === most ? 1 : 0, BONUS: (start === 1 ? 1 : 0) + (led ? 1 : 0) + (i === most ? 2 : 0), PEN: next() % 25 === 0 ? 10 : 0 });
    lines[ids[i]] = line;
  }
  return { lines, standings };
}
// ---- A card's results (core-runtime-38: points by a match's format) ----
// A tennis day's card as the app keeps one (src/lib/sports/final.ts StoredCard): its matches (each its two sides and the sets
// it's played over, `rounds`: best of five on a Grand Slam's men's day, else three), each player's line in each match
// (`byBout`), who won and how (`results`), and each player's line over the day (`lines`, the matches' added up). A table by a
// match's format (score.byFormat: { 5: {...} }) scores each match's line at its format's points (statLine's bouts: the server's
// boutsOf), and whatever a day's line has besides its matches' at `points`. The cast plays among itself and against players
// outside it (who have no line); some of the cast play no match that day (and have no line).
// A fight card's bouts aren't generated: no MMA table scores by format, so its world stays the bench's lines (shape null).
/** One tennis match between a and b (`rounds` its best of), seeded: each side's line in it and its result. */
function tennisMatch(rounds, next) {
  const need = Math.ceil(rounds / 2), lost = next() % need, retired = next() % 20 === 0;
  // The sets in order: the winner takes the last; the loser's are among the ones before it (a seeded shuffle).
  const early = Array.from({ length: need + lost - 1 }, (_, k) => (k < lost ? 'b' : 'a'));
  for (let k = early.length - 1; k > 0; k--) { const j = next() % (k + 1); [early[k], early[j]] = [early[j], early[k]]; }
  const order = [...early, 'a'];
  const played = retired ? order.slice(0, 1 + next() % order.length) : order;
  const a = { MP: 1, W: 1, L: 0, SW: 0, SL: 0, GW: 0, GL: 0, TBW: 0, TBL: 0, CS: 0, CSL: 0, STR: 0 }, b = { MP: 1, W: 0, L: 1, SW: 0, SL: 0, GW: 0, GL: 0, TBW: 0, TBL: 0, CS: 0, CSL: 0 };
  played.forEach((who, k) => {
    const last = retired && k === played.length - 1, tb = !last && next() % 6 === 0, other = last ? next() % 5 : tb ? 6 : next() % 5;
    const [win, lose] = who === 'a' ? [a, b] : [b, a];
    if (last) { win.GW += next() % 5; lose.GW += other; return; } // the set the loser retired in: not finished
    win.SW++; lose.SL++; win.GW += tb ? 7 : 6; lose.GW += other; win.GL += other; lose.GL += tb ? 7 : 6;
    if (tb) { win.TBW++; lose.TBL++; }
    if (!tb && other === 0) { win.CS++; lose.CSL++; }
  });
  if (retired) { a['WRET' + played.length] = 1; a.WRET = 1; b.RET = 1; }
  else if (lost === 0) a.STR = 1;
  return { a, b, outcome: retired ? 'retired' : 'completed' };
}
/** A tennis day's card: the cast in matches (among themselves, or against someone outside it), some resting. */
function tennisCard(c, participants, next) {
  const slam = !c.league.endsWith('/wta') && next() % 2 === 0, rounds = slam ? 5 : 3, cls = c.league.endsWith('/wta') ? 'WS' : 'MS';
  const ids = participants.map(p => p.id).map(id => ({ id, k: next() })).sort((x, y) => x.k - y.k).map(x => x.id);
  const playing = ids.filter(() => next() % 5 !== 0), bouts = [], byBout = {}, results = [], lines = {};
  for (let i = 0, n = 1; i < playing.length; n++) {
    const outside = next() % 4 === 0 || i === playing.length - 1, x = playing[i], y = outside ? 'outside-' + n : playing[i + 1];
    i += outside ? 1 : 2;
    const id = 'match-' + n, m = tennisMatch(rounds, next), xWins = next() % 2 === 0, [win, lose] = xWins ? [x, y] : [y, x];
    bouts.push({ id, order: n, sides: [x, y], rounds, main: false, class: cls });
    byBout[id] = Object.fromEntries([[win, m.a], [lose, m.b]].filter(([who]) => !who.startsWith('outside-')));
    results.push({ bout: id, outcome: m.outcome, winner: win, loser: lose });
  }
  for (const [, by] of Object.entries(byBout)) for (const [who, l] of Object.entries(by)) { const had = (lines[who] ||= {}); for (const [k, v] of Object.entries(l)) had[k] = (had[k] || 0) + v; }
  return { lines, card: { bouts, byBout, results } };
}
/** A field event's results, seeded: its lines (counts, no place) and its standings. */
function fieldFor(context, participants, pick) {
  const c = league(context), next = streamOf(pick, 'field');
  return c.sport.id === 'golf' ? golfField(c, participants, next) : raceField(c, participants, next);
}
/**
 * One released event's results data, seeded: a team game's or a card's box score (`lines`), a field's lines and `standings`; with
 * the empty `events` and `scoringEvents` every fact has. What the world generates and the campaign's walk publishes.
 */
function resultsFor(context, participants, pick, event) {
  if (isField(context)) return { events: [], scoringEvents: [], ...fieldFor(context, participants, pick) };
  const c = league(context);
  // A slate's week: each of its games' lines, for the athletes of its two teams.
  if (slateOf(context)) {
    const games = gamesOf(context, event);
    if (!games.length) throw Error("A slate's results are its week's games: name the event");
    return { events: [], scoringEvents: [], games: Object.fromEntries(games.map((g, j) => [g.id, Object.fromEntries(participants.filter(p => g.teams.includes(p.team)).map((p, i) => [p.id, Bench().rawLine(c.sport, p.role, pick('slate-' + j + '-' + i) % 10)]))])) };
  }
  if (c.sport.id === 'tennis') return { events: [], scoringEvents: [], ...tennisCard(c, participants, streamOf(pick, 'card')) };
  return { events: [], scoringEvents: [], lines: linesFor(context, participants, pick) };
}
/** A field's event as kept beside its standings (sports_events.shape's `event`): its competitors (the cast's: the rest of the
 *  field isn't), its parts (golf's rounds, F1's sessions), its cut (golf's, after the second round; its score isn't kept). */
function fieldEvent(context, data, name = '') {
  const c = league(context), cut = data.standings.some(s => s.status === 'cut' || s.madeCut !== undefined);
  return { event: name, field: Object.keys(data.lines), parts: c.sport.periods.regulation, cut: cut ? { after: 2, score: null } : null };
}
/**
 * The lines as the server keeps them for an event (sports_events.lines, what it scores): a team game's and a card's as given (a
 * team game's derived stats are worked out at the read: Sport.full), a field's counts with the place stats its standings put in
 * each line (the sport's own placeStats, as FieldSport.reduce adds them).
 */
function keptLines(context, data) {
  if (!data.standings) return data.lines;
  const c = league(context), event = fieldEvent(context, data);
  return Object.fromEntries(Object.entries(data.lines).map(([id, line]) => [id, { ...line, ...c.sport.placeStats(data.standings.find(s => s.id === id), event) }]));
}
/** A field's or a card's shape as the server keeps it (sports_events.shape), or null for any other (a team game's, a fight card's). */
function shapeOf(context, data, name) {
  if (data.card) return { kind: 'card', card: { event: name || '', bouts: data.card.bouts, field: [...new Set(data.card.bouts.flatMap(b => b.sides))] }, byBout: data.card.byBout, results: data.card.results };
  return data.standings ? { kind: 'field', event: fieldEvent(context, data, name), standings: data.standings } : null;
}
/** The matches someone played on a card, each its own line at its format (statLine's bouts: the server's boutsOf), in the card's
 *  order; none on a card with no matches kept (a fight card's: the server's empty card). */
function boutsOf(data, id) {
  const card = data.card;
  return card ? card.bouts.flatMap(b => (card.byBout[b.id] && card.byBout[b.id][id] ? [{ id: b.id, format: b.rounds, line: card.byBout[b.id][id] }] : [])) : [];
}
const finite = v => typeof v === 'number' && Number.isFinite(v);
/** A card's matches, checked (core-runtime-38): each its id, place, two sides and its best of; each one's line in it for the cast
 *  who played it (in the day's lines too); a result each, its winner and loser the match's sides. */
function checkCard(world, data) {
  const card = data.card, isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const bad = m => { throw Error("A card's results need its matches: " + m + " ({ bouts: [{ id, order, sides: [a, b], rounds, main, class }], byBout: { [match]: { [participantId]: { STAT: number } } }, results: [{ bout, outcome, winner, loser }] })"); };
  if (!isObj(card) || Object.keys(card).some(k => !['bouts', 'byBout', 'results'].includes(k)) || !Array.isArray(card.bouts) || !isObj(card.byBout) || !Array.isArray(card.results)) bad('its shape');
  const ids = new Set(card.bouts.map(b => b && b.id));
  if (ids.size !== card.bouts.length || card.bouts.some(b => !isObj(b) || typeof b.id !== 'string' || !Number.isInteger(b.order) || !Array.isArray(b.sides) || b.sides.length !== 2 || b.sides.some(x => typeof x !== 'string') || b.sides[0] === b.sides[1] || !Number.isInteger(b.rounds) || b.rounds < 1 || typeof b.main !== 'boolean' || (b.class !== null && typeof b.class !== 'string') || Object.keys(b).some(k => !['id', 'order', 'sides', 'rounds', 'main', 'class'].includes(k)))) bad('a match');
  for (const [bout, by] of Object.entries(card.byBout)) {
    const b = card.bouts.find(x => x.id === bout);
    if (!b || !isObj(by) || Object.entries(by).some(([id, l]) => !b.sides.includes(id) || !(id in data.lines) || !isObj(l) || !Object.values(l).every(finite))) bad("a match's lines");
  }
  if (card.results.length !== card.bouts.length || card.results.some(r => { const b = card.bouts.find(x => x.id === r.bout); return !b || !b.sides.includes(r.winner) || !b.sides.includes(r.loser) || r.winner === r.loser || typeof r.outcome !== 'string'; })) bad('a result each');
}
const STATUSES = ['in', 'cut', 'wd', 'dq'];
/** A slate week's results, checked: its games, each the lines of athletes on its two teams (and no week's line: the server adds them). */
function checkSlate(world, data, event, partial = false) {
  if (Object.keys(data).some(k => !['events', 'scoringEvents', 'games'].includes(k))) throw Error("A slate's results are its games' lines ({ games: { [game]: { [participantId]: { STAT: number } } } })");
  if (data.events.length || data.scoringEvents.length) throw Error("A sport's results are its stat lines: nobody goes home and no moment is scored");
  // (Its games played: a game called off has no line, core-runtime-40. A week in progress has some of them, not all.)
  const all = gamesOf(world.context, event), games = playedOf(world.context, event), g = data.games, isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(g)) throw Error("A slate's results are its games' lines ({ games: { [game]: { [participantId]: { STAT: number } } } })");
  const off = Object.keys(g).find(k => offOf(event)[k]);
  if (off) throw Error('A game called off has no box score: ' + off);
  if (Object.keys(g).some(k => !all.some(x => x.id === k) || !isObj(g[k]))) throw Error("A slate's results are its week's games: " + all.map(x => x.id).join(', '));
  if (partial) {
    const n = Object.keys(g).length;
    if (!n) throw Error('A week in progress has a game final: publish the games final so far');
    if (n === games.length) throw Error('A week whose every game is final is in: publish it as final');
  } else if (Object.keys(g).length !== games.length) throw Error("A slate's results need each of its week's games played: " + games.map(x => x.id).join(', '));
  for (const x of games.filter(y => g[y.id])) for (const [id, line] of Object.entries(g[x.id])) {
    const p = world.participants.find(q => q.id === id);
    if (!p || !x.teams.includes(p.team) || !isObj(line) || !Object.values(line).every(finite)) throw Error("A game's lines are its two teams' athletes' counts: " + x.id + ' has ' + id);
  }
}
/** A sport fact's data, checked: empty `events` and `scoringEvents`, and `lines` by athlete (each a record of finite counts); on a
 *  field, `standings` too: one an athlete, a place a whole number from 1 for whoever is in and none for anyone out, and no place
 *  in a line (a place is the standings'). */
function checkData(world, data, event, partial = false) {
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.scoringEvents)) throw Error('Event facts need events and scoringEvents arrays');
  if (slateOf(world.context)) return checkSlate(world, data, event, partial);
  if (partial) throw Error("One game's results are final at once (the server keeps its line only once it's final): publish final results");
  const field = isField(world.context), onCard = league(world.context).context.shape === 'card';
  if (Object.keys(data).some(k => !['events', 'scoringEvents', 'lines', ...(field ? ['standings'] : []), ...(onCard ? ['card'] : [])].includes(k))) throw Error('Event fact contains an unconnected field');
  if (data.events.length || data.scoringEvents.length) throw Error("A sport's results are its stat lines: nobody goes home and no moment is scored");
  const ok = data.lines && typeof data.lines === 'object' && !Array.isArray(data.lines) && Object.entries(data.lines).every(([id, line]) => world.participants.some(p => p.id === id) && line && typeof line === 'object' && !Array.isArray(line) && Object.values(line).every(finite));
  if (!ok) throw Error("A sport's results need lines: each athlete's counts ({ [participantId]: { STAT: number } })");
  if (onCard && data.card !== undefined) checkCard(world, data);
  if (!field) return;
  const keys = league(world.context).sport.placeKeys, ids = Object.keys(data.lines), st = data.standings;
  if (ids.some(id => keys.some(k => k in data.lines[id]))) throw Error("A field's places are its standings': a line carries no " + keys.join(', '));
  const each = Array.isArray(st) && st.length === ids.length && ids.every(id => st.filter(s => s && s.id === id).length === 1);
  const sound = each && st.every(s => STATUSES.includes(s.status) && typeof s.tied === 'boolean' && (s.madeCut === undefined || typeof s.madeCut === 'boolean') && Object.keys(s).every(k => ['id', 'place', 'tied', 'status', 'madeCut'].includes(k)) && (s.status === 'in' ? Number.isInteger(s.place) && s.place >= 1 : s.place === null && !s.tied));
  if (!sound) throw Error("A field's results need standings: one for each athlete with a line ({ id, place, tied, status }: a place from 1 for whoever is in, none for anyone cut, withdrawn or disqualified)");
}
/**
 * applyFacts for a game on a sport context (runtime-data.cjs applyFacts dispatches here): every released episode's lines stamped
 * on the state as the server stamps them, everything else an episode's results could hold cleared. `released`: the event test.
 */
function applyFacts(world, state, released) {
  const c = league(world.context), lines = {}, finals = [], bouts = {}, byGame = {}, onCard = c.context.shape === 'card', slate = !!slateOf(world.context);
  for (const ep of state.episodes) {
    const event = world.events.find(e => e.id === ep.id);
    ep.events = []; ep.scoringEvents = []; delete ep.noExit; delete ep.resultsStage; delete ep.voteRecord;
    if (!event || !released(event)) continue;
    // (An episode's one game called off: its results are in, nothing happened: among the finals, with no lines.)
    if (isOff(event)) { finals.push(ep.number); continue; }
    const facts = world.facts.filter(f => f.eventId === event.id);
    if (facts.length !== 1) throw Error('A released event needs exactly one coherent fact bundle: ' + event.id);
    checkData(world, facts[0].data, event);
    // A slate's week: its games' lines and the week's, as the server reads them (each game's beside the week's: statGames).
    if (slate) { const r = slateLines(c, facts[0].data); lines[ep.number] = r.week; byGame[ep.number] = r.byGame; finals.push(ep.number); continue; }
    // As the server reads a kept final (score.ts leagueGames): a team game's derived stats worked out (Sport.full); a field's
    // and a card's lines as kept (a field's with its places in them: keptLines).
    const kept = keptLines(world.context, facts[0].data), team = c.context.shape === 'team';
    lines[ep.number] = Object.fromEntries(Object.entries(kept).map(([id, raw]) => [id, team ? c.sport.full(raw) : raw]));
    // On a card, each one's matches (a fight card's none: the server's empty card, every one an empty list).
    if (onCard) bouts[ep.number] = Object.fromEntries(Object.keys(kept).map(id => [id, boutsOf(facts[0].data, id)]));
    finals.push(ep.number);
  }
  // As stampStats hands it to the engine for a game scored by stats: the lines, the finals, each castaway's position group; the
  // sport's category definitions only for a game ranked by categories.
  const groups = Object.fromEntries(world.participants.map(p => [p.id, c.sport.position(p.role)?.group || null]).filter(([, g]) => g));
  S.StatsLogic.stamp(state, { lines, finals, groups, ...(onCard ? { bouts } : {}), ...(slate ? { byGame } : {}), ...(S.StatsLogic.categories(state) ? { defs: c.sport.categoryDefs() } : {}) });
  for (const ep of state.episodes) { const event = world.events.find(e => e.id === ep.id); if (event && released(event) && !S.episodeHasResults(ep)) throw Error('Released event has no result facts'); }
}
/**
 * What someone may be told of a context's results: the server's spoiler guard (src/lib/server/guard.ts seenThrough). Their mark;
 * but a sport's season shows its results straight away (Infinity here, the server's EVERYTHING: sports are live, and Account
 * settings' "Sports scores too" is off by default) to anyone with an ordinary seat on it, or none, unless they hide sports scores
 * too (a person's `hidesScores`, user_settings.hide_sports_scores). Someone whose every seat on the season is at its own pace
 * goes by their mark (a late joiner's seat always does). `state`: the runtime's, or a snapshot of it; `games`: the definition's.
 */
function guard(state, games, contextId, personId) {
  const world = state.contexts[contextId], mark = world.marks.find(m => m.personId === personId)?.through ?? 0;
  if (world.context.kind !== 'sport' || state.people.find(p => p.id === personId)?.hidesScores) return mark;
  const seats = games.filter(g => g.contextId === contextId).map(g => state.games[g.id]?.state).filter(st => st && (st.players || []).some(p => p.id === personId));
  return !seats.length || seats.some(st => !S.GhostLogic.lateJoinOf(st, personId)) ? Infinity : mark;
}
/**
 * Each episode's lock for a sport's game that closes by the day or the week (core-runtime-34), as the server stamps it on every
 * read (src/lib/server/air-times.ts stampSportLocks): the app's own rule (src/lib/sports/locks.ts locksOf) over the game's own
 * episodes (its span: a game that starts later never locks with a game before it), from each one's start. Every episode on a
 * day locks at that day's first start, or every episode in a week (Tuesday to Monday) at the week's first; days and weeks are
 * Eastern time's. A Map of episode number to an ISO instant, or null for any other game (it locks at each episode's own start).
 *
 * `shiftMs`: the calendar the starts are read on. A day and a week are the real calendar's, and a case written to the database
 * has its schedule moved so the scenario's clock is the server's now (live-db.cjs: no route takes a clock); the server groups
 * the moved starts. So a real-route harness sets the same shift here (the session's `calendar(shiftMs)`) before it compares,
 * and the locks come back in the scenario's time. 0, the scenario's own calendar, everywhere else.
 */
function lockTimes(world, state, shiftMs = 0) {
  if (world.context.kind !== 'sport') return null;
  const closes = S.gameOf(state).closes;
  if (closes !== 'daily' && closes !== 'weekly') return null;
  const from = S.startEpisode(state) ?? 1, to = S.endEpisode(state);
  // (A game called off locks nothing, core-runtime-40: the server's PLAYED. An episode's one game, its event; a slate's, its games
  // played, each a start, as the server reads its linked games.)
  const slate = !!slateOf(world.context), at = t => (t ? new Date(Date.parse(t) + shiftMs).toISOString() : null);
  const starts = world.events.filter(e => e.number >= from && (to == null || e.number <= to) && !isOff(e)).flatMap(e => (slate ? playedOf(world.context, e).map(g => ({ episode: e.number, at: at(g.airAt) })) : [{ episode: e.number, at: at(e.airAt) }]));
  // (A slate's episode locks at its own first game played, whatever the cadence: locksOf's `slate`.)
  return new Map([...Bench().locksOf(starts, closes, { slate })].map(([n, at]) => [n, new Date(Date.parse(at) - shiftMs).toISOString()]));
}
/**
 * A slate game that closes at each game's start (closes 'game', core-runtime-39): each episode's games with their starts and the end
 * of each one's day (Eastern), and each holding's games by its team, as the server stamps them on every read (air-times.ts
 * stampGameLocks: the app's own locks.ts gameLocksOf over the game's own episodes). A Map of episode number to { gameStarts,
 * holdingGames }, or null for any other game. `shiftMs` as lockTimes'.
 */
function gameLocks(world, state, shiftMs = 0) {
  if (world.context.kind !== 'sport' || S.gameOf(state).closes !== 'game' || !slateOf(world.context)) return null;
  const from = S.startEpisode(state) ?? 1, to = S.endEpisode(state), team = new Map(world.participants.map(p => [p.id, p.team]));
  const games = world.events.filter(e => e.number >= from && (to == null || e.number <= to)).flatMap(e => playedOf(world.context, e).map(g => ({ episode: e.number, eventId: g.id, at: g.airAt ? new Date(Date.parse(g.airAt) + shiftMs).toISOString() : null, teams: g.teams })));
  const teamOf = new Map((state.castaways || []).filter(c => team.get(c.id)).map(c => [c.id, team.get(c.id)]));
  const back = at => new Date(Date.parse(at) - shiftMs).toISOString();
  return new Map([...Bench().gameLocksOf(games, teamOf)].map(([n, l]) => [n, { gameStarts: Object.fromEntries(Object.entries(l.gameStarts).map(([id, g]) => [id, { at: back(g.at), until: back(g.until) }])), holdingGames: l.holdingGames }]));
}
/** The locks on a state's episodes, in place (around an action: the engine's own lock check reads ep.locksAt); `unstampLocks` takes them off. */
function stampLocks(world, state, shiftMs = 0) {
  const locks = lockTimes(world, state, shiftMs), each = gameLocks(world, state, shiftMs);
  for (const ep of state.episodes || []) {
    if (locks && locks.has(ep.number)) ep.locksAt = locks.get(ep.number); else delete ep.locksAt;
    const g = each && each.get(ep.number);
    if (g) { ep.gameStarts = g.gameStarts; ep.holdingGames = g.holdingGames; } else { delete ep.gameStarts; delete ep.holdingGames; }
  }
  return state;
}
function unstampLocks(state) { for (const ep of state.episodes || []) { delete ep.locksAt; delete ep.gameStarts; delete ep.holdingGames; } return state; }
/** The state with its locks on a copy of its episodes (a read: the kept state never holds them), or the state itself when it has none. */
function withLocks(world, state, shiftMs = 0) {
  const locks = lockTimes(world, state, shiftMs), each = gameLocks(world, state, shiftMs);
  if (!(locks && locks.size) && !(each && each.size)) return state;
  return { ...state, episodes: state.episodes.map(ep => ({ ...ep, ...(locks && locks.has(ep.number) ? { locksAt: locks.get(ep.number) } : {}), ...(each && each.has(ep.number) ? each.get(ep.number) : {}) })) };
}
/** A state as it would be saved: without what a stamp writes (the server leaves the same keys out: db.ts withLeagueLock). */
function saved(state) {
  const keys = new Set(S.StatsLogic.stampedKeys());
  return JSON.parse(JSON.stringify(state, (k, v) => (keys.has(k) ? undefined : v)));
}
module.exports = { league, contextFor, realPool, realDeal, assignRoles, assignTeams, slateOf, teamsOf, gamesOf, playedOf, offOf, isOff, slateLines, gameLocks, linesFor, resultsFor, isField, keptLines, shapeOf, boutsOf, checkData, applyFacts, saved, guard, lockTimes, stampLocks, unstampLocks, withLocks };
