// The play pieces B2 designs (docs/PLAN-start-a-game-redo.md, B2; the explorer plan's Designs needed 10, 21, 24, 26, 27, 28, 30),
// each a runtime case built on the explorer's own definitions (check-explorer-page.js), played a night further where the design needs
// a piece that has already counted, and materialized into this checkout's local database as zt-gb- rows (tools/gameplay-bench/
// live-db.cjs) for the app to render on the real routes. Each case is a couch of its own (Ann, Bo, ...; password live-db's).
//
//   captain   a Weekly Lineup whose captain scores double: Ann named one for Episode 2 and it scored; Episode 3's lineup is open.
//   second    a Survival Pool with a second pick on a night two or more go home: Ann made both for Episode 2, two went home; Episode 3
//             is open.
//   slots     a Weekly Lineup with one group slot (pairs the show re-forms every two episodes): Ann filled it for Episode 2 and its
//             pair scored; Episode 3 is open. Bo left his slot empty (`also`: his frames show the groups on offer).
//   auction   an Outlast drafted by sealed bids (a budget of 100; a place nobody won filled at the lowest price), one episode played.
//   bot       a game of questions against the bot's calls: Episode 1 settled (Ann's boot call matched the bot's; her moment call beat
//             it); Episode 2's questions are open.
//   cut       a Weekly Lineup cutting the lowest every episode: one played, so one of the four is out (the page still offers them a
//             lineup: BACKLOG 47).
//   pool      two Survival Pools: one with a buy-back (lives 1, buy back once for 3 points) and one with a mulligan; two played.
//
// Run:  node scripts/dev-test/play-pieces-fixture.js up [--only=captain,second]   writes .ui-atlas/play-pieces.json (each case's
//       season, games, people and their usernames) and prints where to look
//       node scripts/dev-test/play-pieces-fixture.js down                           removes every case that file lists
// Needs the local database (.env.local AUTH_DATABASE_URL; live-db refuses any other). Nothing touches a real account.
// Exports up(names) and down() for checks and stories.
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "../..");
const L = require(path.join(root, "tools/gameplay-bench/live-db.cjs"));
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));
const D = require(path.join(root, "tools/gameplay-bench/explorer/document.cjs"));
const Q = require(path.join(root, "tests/fixtures/gameplay-explorer/questions-input.json"));
const FILE = path.join(root, ".ui-atlas/play-pieces.json");

const people = (...names) => names.map((n) => ({ id: n.toLowerCase(), name: n }));
const define = ({ seed = 5, couch, pool, pairs, games, completed, events, setup }) =>
  D.create({
    seed,
    world: { contexts: [{ id: "show", kind: "show", format: { id: "survivor" }, engine: { ...Q.context, couch: couch.length, pool }, ...(pairs ? { pairs } : {}) }], people: couch },
    games: games.map((g) => ({ contextId: "show", timing: "live-only", ...g })),
    situation: { clock: "2099-01-10T12:00:00.000Z", marks: [] },
    content: { completedEvents: completed, eventCount: events },
    ...(setup ? { setup } : {}),
  });
const must = (s, a) => {
  const r = s.apply(a);
  if (r.status !== "accepted") throw Error(`The case could not be built: ${JSON.stringify(a)} ${r.message}`);
  return r;
};
/** Who's still in after the results so far. */
const stillIn = (s) => {
  const w = s.snapshot().contexts.show, gone = new Set(w.facts.flatMap((f) => (f.data?.events || []).map((e) => e.castawayId)));
  return w.participants.map((p) => p.id).filter((id) => !gone.has(id));
};
/** Episode n airs and its results come in: `out` go home, `moments` ([castawayId, type]) are scored; everyone then watches it. */
function night(s, n, out, moments = []) {
  const snap = s.snapshot(), ev = snap.contexts.show.events[n - 1];
  must(s, { type: "clock", at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
  must(s, { type: "results", contextId: "show", eventId: ev.id, source: "provider-fixture", resultStatus: "final", data: { events: out.map((castawayId) => ({ castawayId, method: "Voted Out" })), scoringEvents: moments.map(([castawayId, type], i) => ({ id: `zt-m${n}-${i}`, type, castawayId })) } });
  for (const p of snap.people) must(s, { type: "reveal", contextId: "show", personId: p.id });
}

const CASES = {
  captain() {
    const s = R.open(define({ couch: people("Ann", "Bo"), pool: 12, completed: 1, events: 4, games: [{ id: "captain", name: "Captain lineup", spec: { get: { by: "draft", each: 4, own: "shared", order: "blind" }, count: { start: 2 }, score: { by: "moments", captain: { times: 2 } }, rank: { by: "total" } } }] }));
    const lineups = {};
    for (const p of ["ann", "bo"]) {
      const l = s.project("captain", p).game.lineup, ids = l.roster.filter((id) => stillIn(s).includes(id)).slice(0, l.slots);
      must(s, { type: "lineup", gameId: "captain", personId: p, eventId: l.epId, ids, captainId: ids[0] });
      lineups[p] = ids;
    }
    // Ann's captain wins immunity and a reward (doubled); someone on nobody's team goes home.
    const held = new Set(Object.values(lineups).flat());
    night(s, 2, [stillIn(s).find((id) => !held.has(id))], [[lineups.ann[0], "individualImmunity"], [lineups.ann[0], "rewardWin"], [lineups.bo[1], "rewardWin"]]);
    return { s, viewer: "ann", games: ["captain"] };
  },
  second() {
    const s = R.open(define({ couch: people("Ann", "Bo"), pool: 10, completed: 1, events: 5, games: [{ id: "second", name: "Two shots", spec: { get: { by: "pick", each: 1, repeat: "never", second: { fallback: "void" } }, score: { by: "survive" }, rank: { by: "streak" } } }] }));
    const picks = {};
    for (const p of ["ann", "bo"]) {
      const m = s.project("second", p).game.pick, [a, b] = m.available.filter((id) => !Object.values(picks).flat().includes(id));
      must(s, { type: "pick", gameId: "second", personId: p, eventId: m.epId, ids: [a] });
      must(s, { type: "pick", gameId: "second", personId: p, eventId: m.epId, ids: [b], second: true });
      picks[p] = [a, b];
    }
    // Two go home: Ann's second pick and someone nobody picked (her first survives).
    night(s, 2, [picks.ann[1], stillIn(s).find((id) => !Object.values(picks).flat().includes(id))]);
    return { s, viewer: "ann", games: ["second"] };
  },
  slots() {
    const s = R.open(define({ couch: people("Ann", "Bo"), pool: 12, pairs: { every: 2 }, completed: 1, events: 5, games: [{ id: "groups", name: "Plus one", spec: { get: { by: "draft", each: 4, own: "shared", order: "blind", groups: { slots: 1, own: "shared", swap: false, fallback: "void", points: "mean" } }, count: { start: 2 }, score: { by: "moments" }, rank: { by: "total" } } }] }));
    // Ann fills her slot for Episode 2; Bo leaves his open (his frames show the groups on offer).
    const v = s.project("groups", "ann").game, offered = v.twists?.offered;
    if (offered?.groups?.length) must(s, { type: "groupSlot", gameId: "groups", personId: "ann", eventId: offered.epId, slot: 0, groupId: offered.groups[0].id });
    for (const p of ["ann", "bo"]) {
      const l = s.project("groups", p).game.lineup;
      if (l) must(s, { type: "lineup", gameId: "groups", personId: p, eventId: l.epId, ids: l.roster.filter((id) => stillIn(s).includes(id)).slice(0, l.slots) });
    }
    const inSlot = new Set(offered?.groups?.[0]?.members ?? []);
    const pool = stillIn(s);
    // The pair in Ann's slot both win a reward (their mean scores); someone outside it goes home.
    night(s, 2, [pool.find((id) => !inSlot.has(id))], [...inSlot].map((id) => [id, "rewardWin"]));
    return { s, viewer: "ann", also: ["bo"], games: ["groups"] };
  },
  auction() {
    const s = R.open(define({ couch: people("Ann", "Bo", "Cy"), pool: 12, completed: 1, events: 4, games: [{ id: "auction", name: "Sealed bids", spec: { get: { by: "draft", each: 3, own: "exclusive", order: "auction", budget: { total: 100, floor: 1, fallback: "fill" } }, count: { all: true }, score: { by: "place" }, rank: { by: "total" } } }] }));
    return { s, viewer: "ann", games: ["auction"] };
  },
  bot() {
    const def = (setup) => define({ seed: 3, couch: people("Ann", "Bo"), pool: 10, completed: 1, events: 3, setup, games: [{ id: "beat", name: "Beat the bot", spec: { ...Q.spec, ask: Q.spec.ask.map((q) => ({ ...q, beat: { by: "bot", none: "plays" } })) } }] });
    const probe = R.open(def()), w = probe.snapshot().contexts.show;
    probe.dispose();
    const d1 = w.facts.find((f) => f.eventId === w.events[0].id).data, boot = d1.events[0].castawayId, happened = d1.scoringEvents.some((m) => m.type === "rewardWin") ? "yes" : "no";
    const other = w.participants.find((p) => p.id !== boot).id;
    const s = R.open(def({ stores: {
      answers: { beat: [{ playerId: "ann", episode: 1, question: "boot", answer: boot }, { playerId: "ann", episode: 1, question: "happens", answer: happened }, { playerId: "bo", episode: 1, question: "boot", answer: other }, { playerId: "bo", episode: 1, question: "happens", answer: happened === "yes" ? "no" : "yes" }] },
      bot: { beat: [{ question: "boot", episode: 1, answer: boot }, { question: "happens", episode: 1, answer: happened === "yes" ? "no" : "yes" }] },
    } }));
    return { s, viewer: "ann", games: ["beat"] };
  },
  cut() {
    const s = R.open(define({ seed: 12, couch: people("Ann", "Bo", "Cy", "Di"), pool: 14, completed: 1, events: 4, games: [{ id: "cut", name: "The guillotine", spec: { get: { by: "draft", each: 3, own: "exclusive", order: "snake" }, count: { start: 2 }, score: { by: "moments" }, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1, tie: "keep", quiet: "cut" }] } } }] }));
    const out = s.project("cut", "ann").game.twists?.out?.[0] ?? null;
    return { s, viewer: out ?? "ann", games: ["cut"] };
  },
  pool() {
    const s = R.open(define({ couch: people("Ann", "Bo"), pool: 10, completed: 2, events: 5, games: [
      { id: "buyback", name: "Second chances", spec: { get: { by: "pick", each: 1, repeat: "never" }, score: { by: "survive", lives: 1, buyback: { times: 1, before: null, cost: 3 } }, rank: { by: "standing" } } },
      { id: "mulligan", name: "One on the house", spec: { get: { by: "pick", each: 1, repeat: "never" }, score: { by: "survive", mulligans: 1 }, rank: { by: "streak" } } },
    ] }));
    return { s, viewer: "ann", games: ["buyback", "mulligan"] };
  },
};

async function up(names = Object.keys(CASES)) {
  const made = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
  for (const name of names) {
    if (made[name]) await L.down(made[name].key).catch(() => {});
    const { s, viewer, also = [], games } = CASES[name]();
    try {
      const snap = s.snapshot(), doc = s.export().input;
      const ids = await L.up(snap, doc);
      const shift = Date.now() - Date.parse(snap.clock);
      await L.sync(ids, snap, doc, shift);
      await L.seedSocial(ids, snap, doc, shift);
      const season = ids.seasons.show.id;
      made[name] = {
        key: ids.key, seasonId: season, couchId: ids.couchId, viewer, user: ids.users[viewer].username, also: Object.fromEntries(also.map((p) => [p, ids.users[p].username])),
        users: Object.fromEntries(Object.entries(ids.users).map(([k, u]) => [k, u.username])),
        games: Object.fromEntries(games.map((g) => [g, ids.leagues[g]])),
        pages: Object.fromEntries(games.map((g) => [g, `/show/${season}/game/${ids.leagues[g]}`])),
      };
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(made, null, 1));
      console.log(`${name}: ${made[name].user} · ${Object.values(made[name].pages).join(" · ")}`);
    } finally {
      s.dispose();
    }
  }
  console.log(`password ${L.PASSWORD} · ${path.relative(root, FILE)}`);
  return made;
}

async function down() {
  const made = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
  for (const [name, c] of Object.entries(made)) {
    await L.down(c.key).catch((e) => console.log(`${name}: ${e.message}`));
    console.log(`${name}: down`);
  }
  if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
}

module.exports = { up, down, CASES, FILE, PASSWORD: L.PASSWORD };

if (require.main === module) {
  const cmd = process.argv[2];
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  (cmd === "down" ? down() : cmd === "up" ? up(only) : Promise.reject(Error("up or down")))
    .then(() => L.close?.())
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
      L.close?.();
    });
}
