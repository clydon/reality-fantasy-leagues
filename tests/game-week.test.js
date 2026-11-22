// This week on a game's own page (the design round's step 2: src/new/show/this-week.ts; docs/design-round/step2-game-page-spec.md,
// "This week, by situation"): the one block whose words change with the situation. Each case is a game-page situation
// (tools/gameplay-bench/explorer/situations.cjs) played by the runtime, read as the viewer's projection (the production game view),
// so the card is held to what each situation is. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const root = path.join(__dirname, "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
const { thisWeek, scoreWords } = jiti("../src/new/show/this-week.ts");
const { castName } = jiti("../src/new/show/moves.ts");
const Sit = require(path.join(root, "tools/gameplay-bench/explorer/situations.cjs"));
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));

const WORDS = { episode: "Episode", ep: "Ep" };

/** A situation's game as its viewer reads it, and the card for it (`ctx` adds the show's side: a reveal waiting, the latest aired). */
function card(id, ctx = {}) {
  const x = Sit.build(id), s = R.open(x.input);
  try {
    for (const a of x.steps) assert.equal(s.apply(a).status, "accepted");
    const g = ctx.edit ? ctx.edit(s.project(ctx.gameId ?? x.gameId, x.viewerId).game) : s.project(ctx.gameId ?? x.gameId, x.viewerId).game;
    const move = g.lineup && !g.lineup.locked ? { kind: "lineup", due: !g.lineup.set } : null;
    return { g, w: thisWeek(g, { words: WORDS, next: null, move, seen: ctx.seen ?? g.through, locked: g.locked ?? null, reveal: ctx.reveal ?? null, aired: ctx.aired ?? g.through }) };
  } finally { s.dispose(); }
}

test("due: who you play this week and their record, your lineup not set, last week in a line", () => {
  const { g, w } = card("show-due");
  assert.equal(w.kind, "matchup");
  assert.equal(w.them.playerId, g.matchups.next.opponent);
  assert.match(w.them.record, /^\d+–\d+(–\d+)?$/);
  assert.equal(w.tone, "due");
  assert.match(w.state, /isn't set/);
  assert.equal(w.theirs, "hidden", "their lineup is secret until it locks");
  assert.equal(w.last.episode, 3);
  assert.match(w.last.line, /^Ep 3 · (Beat|Lost to|Tied) /);
});

test("set: you're set, theirs still hidden, nothing yellow to do", () => {
  const { w } = card("show-set");
  assert.equal(w.tone, "set");
  assert.match(w.state, /^You're set/);
  assert.equal(w.theirs, "hidden");
});

test("locked (live only): both lineups shown, results to come", () => {
  const { g, w } = card("show-locked");
  assert.ok(g.locked, "the view carries both sides once locked");
  assert.equal(w.tone, "locked");
  assert.ok(Array.isArray(w.theirs) && w.theirs.length > 0, "their starters, once locked");
  assert.ok(Array.isArray(w.mine) && w.mine.length > 0);
});

test("a quiet night is said as such, records unchanged", () => {
  const { w } = card("show-quiet");
  assert.equal(w.last.result, "quiet");
  assert.match(w.last.line, /Counted for nobody/);
});

test("the playoffs: out of them is said as such, never OUT; you lead, the final in a line", () => {
  const { w } = card("show-playoffs");
  assert.equal(w.tone, "out");
  assert.equal(w.you.name, "You");
  assert.match(w.state, /missed the playoffs/);
  assert.doesNotMatch(w.state, /\bOUT\b/);
  assert.match(w.label, /The final/);
  assert.match(w.last.line, /The final · \w+ \(1\) vs \w+ \(2\)/);
  assert.ok(w.last.playerId, "the final's line opens its matchup");
});

test("the season over: the champion named, your finish", () => {
  const { g, w } = card("show-champion");
  assert.equal(w.tone, "over");
  assert.equal(w.champion.playerId, g.matchups.playoffs.champion);
  assert.match(w.state, /You (finished|won)/);
});

test("the season over without a champion: your place, never a match against a bye", () => {
  const { w } = card("show-champion", { edit: (g) => ({ ...g, table: g.table.map((r) => ({ ...r, record: r.record && { ...r.record, champion: false } })) }) });
  assert.equal(w.champion, null);
  assert.equal(w.kind, "standing", "nobody to face: the card isn't a matchup (it drew 'A bye')");
  assert.match(w.state, /^You finished/);
});

test("a one-game game: the result leads, never a season's words (real people showed it, Designs needed 42)", () => {
  const { w } = card("show-results", {
    edit: (g) => {
      const opp = g.table.find((r) => !r.you);
      return { ...g, from: 1, to: 1, over: true, matchups: { ...g.matchups, next: null, playoffs: null, last: { episode: 1, round: null, opponent: opp.playerId, stand: null, points: 81.08, against: 82.76, result: "loss" } } };
    },
  });
  assert.equal(w.kind, "matchup");
  assert.equal(w.label, "Ep 1 · Final");
  assert.ok(w.them, "who you played, not a bye");
  assert.deepEqual(w.score, { you: "81.1", them: "82.8", early: false });
  assert.match(w.state, /^\w+ won by 1\.7$/);
  assert.equal(w.you.record, null, "a record of one game says nothing the score doesn't");
  assert.equal(w.them.record, null);
  assert.equal(w.last, null, "the card is the result: no line repeating it");
  assert.doesNotMatch(JSON.stringify(w), /Season over|finished|bye/);
});

test("a first week carries nothing in: no 'last week's stands in' (the merged stage's first matchup)", () => {
  const first = card("staged-merged", { gameId: "h2h~merged" });
  assert.equal(first.g.lineup.carried, false);
  assert.doesNotMatch(first.w.state, /stands in/);
  const later = card("show-due");
  assert.equal(later.g.lineup.carried, true, "a later week's unset lineup still has last week's standing in");
  assert.match(later.w.state, /stands in/);
});

test("names where room is short: a show's cast by first name, an athlete by surname, a defense by its nickname", () => {
  assert.equal(castName({ name: "Kristin Flickinger" }), "Kristin");
  assert.equal(castName({ name: "Jordan Love", role: "QB" }), "Love");
  assert.equal(castName({ name: "Amon-Ra St. Brown", role: "WR" }), "St. Brown");
  assert.equal(castName({ name: "Marvin Harrison Jr.", role: "WR" }), "Harrison Jr.");
  assert.equal(castName({ name: "J. Michael Sturdivant", role: "WR" }), "Sturdivant");
  assert.equal(castName({ name: "New England Patriots D/ST", role: "DEF" }), "Patriots D/ST");
  assert.equal(castName({ name: "Green Bay Packers D/ST" }), "Packers D/ST", "known by its name alone");
  // Two who'd read the same in one game get an initial; the rest stay short.
  const g = { cast: [{ name: "A.J. Brown", role: "WR" }, { name: "Sincere Brown", role: "WR" }, { name: "Jordan Love", role: "QB" }, { name: "Mike Pinsky" }, { name: "Mike White" }] };
  assert.equal(castName(g.cast[0], g), "A.J. Brown");
  assert.equal(castName(g.cast[1], g), "S. Brown");
  assert.equal(castName(g.cast[2], g), "Love");
  assert.equal(castName(g.cast[3], g), "Mike P.");
});

test("behind (own pace): your mark, what's waiting, no result past it", () => {
  const { w } = card("show-behind", { seen: 3, aired: 5, reveal: { episode: 4, stage: "final" } });
  assert.equal(w.tone, "behind");
  assert.match(w.state, /You're up to Ep 3\. Ep 4 and 5 are waiting/);
  assert.equal(w.last, null, "no last week shown while results wait");
  const early = card("show-early", { seen: 3, aired: 4, reveal: { episode: 4, stage: "early" } }).w;
  assert.equal(early.tone, "early");
  assert.match(early.state, /early results are waiting/);
});

test("solo: your own season, no opponent and no place", () => {
  const { w } = card("show-solo");
  assert.notEqual(w.kind, "matchup");
  assert.equal(w.them, null);
  assert.doesNotMatch(w.state, /of 1\b/);
});

test("a score with a negative reads with 'to'", () => {
  assert.equal(scoreWords(6, 2), "6–2");
  assert.equal(scoreWords(-3, 0), "−3 to 0");
});

test("the league's week: every seat paired once, yours the card's, others' lineups only once locked", () => {
  const { g } = card("show-due");
  assert.ok(g.games, "head to head carries the league's week");
  assert.equal(g.games.episode, g.matchups.next.episode);
  const seats = g.games.games.flatMap((x) => [x.a, x.b].filter(Boolean));
  assert.equal(new Set(seats).size, seats.length, "nobody plays twice");
  assert.equal(seats.length, g.table.length, "everyone plays");
  const mine = g.games.games.find((x) => x.a === g.playerId || x.b === g.playerId);
  assert.equal(mine.a === g.playerId ? mine.b : mine.a, g.matchups.next.opponent, "yours is the card's");
  assert.ok(g.games.games.every((x) => x.locked === null), "nothing locked before airtime");
  const locked = card("show-locked").g;
  assert.ok(locked.games.games.every((x) => Array.isArray(x.locked?.a)), "every side's starters once locked");
});

test("2c: every player's points each week at the game's scoring, matching each lineup's lines", () => {
  const { g } = card("show-results");
  const cw = g.castWeeks;
  assert.ok(cw && cw.episodes.length >= 4, "a column per scored episode");
  for (const r of g.table) for (const w of r.weeks) {
    const i = cw.episodes.indexOf(w.episode);
    for (const s of [...w.started, ...w.bench]) assert.equal(cw.points[s.id][i], s.points, `${s.id} in ep ${w.episode}`);
  }
});

test("BACKLOG 251: each castaway's moments that week add up to their points then, each named as the lineup's reasons name it", () => {
  const { g } = card("show-results");
  const cw = g.castWeeks;
  assert.ok(cw.moments && cw.moments.labels.length > 0, "a show's weeks carry their moments");
  let checked = 0;
  for (const [id, row] of Object.entries(cw.points)) {
    row.forEach((pts, i) => {
      const ms = cw.moments.of[id]?.[i] ?? [];
      const sum = Math.round(ms.reduce((t, m) => t + m[1], 0) * 100) / 100;
      assert.equal(sum, pts, `${id} in ep ${cw.episodes[i]}: moments ${sum} vs points ${pts}`);
      if (ms.length) checked++;
    });
  }
  assert.ok(checked > 5, "some weeks had moments to add up");
  // The Started card's reason is one of the moments the sheet lists (the same words on both).
  for (const r of g.table) for (const w of r.weeks) for (const s of w.started) {
    const i = cw.episodes.indexOf(w.episode);
    const names = (cw.moments.of[s.id]?.[i] ?? []).map((m) => cw.moments.labels[m[0]]);
    for (const why of s.why) assert.ok(names.includes(why), `${s.id} ep ${w.episode}: "${why}" among ${names.join(", ")}`);
  }
});

test("2c: a sport's weeks come from its stat lines (BACKLOG 74), and a week's lines add up to its result", () => {
  const { g } = card("nfl-real-pool-due");
  const me = g.table.find((r) => r.you);
  assert.ok(me.weeks.length >= 2, "a sport's weeks are no longer empty");
  for (const w of me.weeks) {
    assert.ok(w.started.length > 0 && w.started.length <= 9, "starters with lines");
    const sq = g.plays.rows[me.playerId].find((s) => s.episode === w.episode);
    if (sq?.result) assert.ok(Math.abs(sq.result.us - w.total) < 0.06, `ep ${w.episode}: lines ${w.total} vs result ${sq.result.us}`);
  }
  assert.ok(g.castWeeks && Object.keys(g.castWeeks.points).length > 100, "the whole pool, held or not");
});
