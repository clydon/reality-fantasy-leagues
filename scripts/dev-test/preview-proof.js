// Dev-only: the game preview's proof (docs/PLAN-game-preview.md, P0). A Survivor 51 Fantasy league taken from the gallery's catalog
// (src/lib/game/start-gallery: the "Fantasy league" base with "A new draft at a stage", on the season's own page facts read from the
// real start route), played forward with made-up results on the app's real screens through the real routes, as zt-gb- rows
// (tools/gameplay-bench/live-db.cjs). No product change: the bench's live tier, driven from here instead of the Atlas.
//
// The world: Survivor 51's real castaways and photos (the bench's dress, tools/gameplay-bench/explorer/dress.cjs: record it first with
// `node --env-file=.env.local scripts/dev-test/real-dress.js record`), its show name, season number and art, and its own calendar
// (13 episodes a week apart, Episode 9 on the night the real one airs). Every result is made up from the seed, Episodes 1 to 8 too.
// The couch is the zt fixture couch's names (scripts/dev-test/new-fixture.js: Alex runs it, Riley, Jordan, Sam), each a zt-gb user
// made for the case; their moves are made up by the engine (the runtime's own lineups and drafts). Never a real account.
//
// The story, each frame at --width (390) as Alex:
//   01 the start (the game page before Episode 9: the teams the first draft would make; the draft room for the start isn't run)
//   02 Episode 9's move (Alex's lineup on the real lineup sheet, saved through the real route, then compared with the runtime)
//   03 the game page after Episode 10, 04 a castaway's sheet
//   05 the merge's new draft: the Merged stage's draft run in the real draft room (whoever runs the game starts it, each seat locks
//      in the team the engine made up for it, through the real routes), compared with the runtime's own draft
//   06 the finale: Alex's reveal of it, then the game page with the season over
// Every frame keeps its words (.txt) and the gaps it shows; index.json has every frame, the comparisons and the console errors.
//
// Needs: this lane's dev server (BASE, default http://localhost:3014: `node scripts/lane.js dev`) and its local database
// (.env.local AUTH_DATABASE_URL). Rows are removed at the end (--keep leaves them, printing the logins; `down` removes a kept case by
// its key). Never run live-db.cjs down-all from a lane: it sweeps every worktree's database.
//
//   node scripts/dev-test/preview-proof.js [--out=.ui-atlas/stories/game-preview/p0] [--width=390 --height=844] [--seed=51] [--keep]
//   node scripts/dev-test/preview-proof.js --dry        the definition and its steps headless (no database, no browser)
//   node scripts/dev-test/preview-proof.js down <key>   remove a kept case's rows
//
// Also a module: `const { definition, galleryFacts } = require("./preview-proof")`.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
process.env.BASE = process.env.BASE || "http://localhost:3014";
const BASE = process.env.BASE;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/game-preview/p0"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844)), SEED = Number(opt("seed", 51));

const D = require(path.join(root, "tools/gameplay-bench/explorer/document.cjs"));
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));
const Dress = require(path.join(root, "tools/gameplay-bench/explorer/dress.cjs"));
const Data = require(path.join(root, "tools/gameplay-bench/explorer/runtime-data.cjs"));
const { resultsData } = require(path.join(root, "tools/gameplay-bench/explorer/publish.cjs"));
const G = require(path.join(root, "src/lib/game/start-gallery/index.js"));
const S = require(path.join(root, "src/lib/game/state-logic"));

const HOUR = 3600000, DAY = 24 * HOUR;
// Survivor 51's own calendar: Episode 9 airs 2026-11-19 01:00 UTC (8 PM Eastern), weekly; a season of 13.
const EP9 = Date.parse("2026-11-19T01:00:00.000Z"), EPISODES = 13, FROM = 9, MERGE = 11;
const airOf = (n) => new Date(EP9 + (n - FROM) * 7 * DAY).toISOString();
// The zt fixture couch's names (new-fixture.js PEOPLE), Alex first: Alex runs the game.
const COUCH = ["Alex", "Riley", "Jordan", "Sam"].map((name) => ({ id: name.toLowerCase(), name }));
const RECORD = path.join(root, ".ui-atlas/preview-proof/s51-record.json");
const REAL_SEASON = { show: "survivor", number: 51 };

/**
 * `record`: what the proof takes from the real season, read once from this lane's database and its start route into the ignored
 * .ui-atlas: the gallery's page for Survivor 51 (the start route's wizard page, read as a throwaway zt-gb couch's first person, so
 * the gallery sees it as a couch of four would), and the shape of its results (who went home each episode and how, and how often
 * each moment happened per castaway still in). Real people's names stay out of git.
 */
async function record() {
  const Live = require(path.join(root, "tools/gameplay-bench/live-db.cjs"));
  const { Pool } = require("pg");
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const one = async (sql, p) => (await db.query(sql, p)).rows;
  try {
    const [season] = await one(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2`, [REAL_SEASON.show, REAL_SEASON.number]);
    if (!season) throw Error("No Survivor 51 in this database");
    const exits = await one(`SELECT episode_number AS n, method FROM season_decisions WHERE season_id = $1 AND kind = 'elimination' AND status = 'accepted' ORDER BY episode_number, decided_at`, [season.id]);
    const moments = await one(`SELECT episode_number AS n, event_type AS type, count(*)::int AS k FROM season_decisions WHERE season_id = $1 AND kind = 'event' AND status = 'accepted' GROUP BY 1, 2`, [season.id]);
    const [{ cast }] = await one(`SELECT count(*)::int AS cast FROM season_cast WHERE season_id = $1`, [season.id]);
    // A throwaway case for its couch (Alex and the rest, zt-gb users), removed straight after.
    const doc = D.create({ seed: 1, world: { contexts: [{ id: "show", kind: "show", format: { id: "survivor" }, engine: { ...require(path.join(root, "tests/fixtures/gameplay-explorer/questions-input.json")).context, couch: COUCH.length } }], people: COUCH },
      games: [{ id: "g", name: "record", contextId: "show", spec: { preset: "weekly-lineup" }, timing: "own-pace" }],
      situation: { clock: "2099-01-10T12:00:00.000Z", viewerId: "alex", marks: COUCH.map((p) => ({ personId: p.id, contextId: "show", through: 1 })) }, content: { completedEvents: 1, eventCount: 3 } });
    const s = R.open(doc), ids = await Live.up(s.snapshot(), s.export().input);
    let wizard;
    try {
      const { api } = require("./browser");
      const alex = await api({ user: ids.users.alex.username, pass: Live.PASSWORD });
      const r = await alex.call("GET", `/api/seasons/${season.id}/start?wizard=1&couch=${ids.couchId}`);
      if (r.status !== 200 || !r.body.wizard) throw Error("The start route gave no wizard page: " + r.status + " " + JSON.stringify(r.body).slice(0, 200));
      wizard = r.body;
    } finally { await Live.down(ids.key); await Live.close(); s.dispose(); }
    const aired = Math.max(0, ...exits.map((x) => x.n), ...moments.map((x) => x.n));
    const out = { schemaVersion: 1, recordedAt: new Date().toISOString(), source: "this lane's database and start route (scripts/dev-test/preview-proof.js record); stays out of git", seasonId: season.id, cast, aired, exits: exits.map((x) => ({ n: x.n, method: x.method })), moments, page: wizard.wizard.page, from: wizard.from };
    fs.mkdirSync(path.dirname(RECORD), { recursive: true });
    fs.writeFileSync(RECORD, JSON.stringify(out, null, 1));
    console.log(`${RECORD}: from Episode ${out.from}, ${aired} aired, ${exits.length} gone, ${moments.reduce((t, x) => t + x.k, 0)} moments`);
  } finally { await db.end(); }
}
const recorded = () => {
  if (!fs.existsSync(RECORD)) throw Error("Nothing recorded: run `node --env-file=.env.local scripts/dev-test/preview-proof.js record` first");
  return JSON.parse(fs.readFileSync(RECORD, "utf8"));
};

/** The gallery's page facts for the real Survivor 51 (the start route's wizard page, recorded). */
function galleryFacts() {
  const r = recorded();
  return { page: r.page, pg: G.pageFacts(r.page, { show: "Survivor 51" }), record: r };
}

// ---- Made-up results shaped like the real season's (the plan: "use as much real data ... then randomize") ----
const J = require(path.join(root, "tools/gameplay-bench/explorer/json.cjs"));
const roll = (seed, ...parts) => parseInt(J.digest([seed, ...parts]).slice(0, 8), 16);
/** How often each moment happened per castaway still in, over the real season's aired episodes. */
function ratesOf(r) {
  const goneBy = (n) => r.exits.filter((x) => x.n < n).length;
  const castEpisodes = Array.from({ length: r.aired }, (_, i) => r.cast - goneBy(i + 1)).reduce((a, b) => a + b, 0);
  const rates = {};
  for (const m of r.moments) rates[m.type] = (rates[m.type] || 0) + m.k / castEpisodes;
  return rates;
}
/** An episode's moments: each kind drawn at the real season's rate among those still in, given to castaways at random (by the seed);
 *  after the merge, one individual immunity a night instead of tribe immunity. Kinds the format doesn't know are left out. */
function shapedMoments(seed, n, still, outs, known, merged) {
  const r = recorded(), rates = ratesOf(r), out = new Set(outs.map((o) => o.castawayId)), list = [];
  const safe = new Set(["zeroVotesSafe", "survivedVotes", "votedWithMajority"]);
  const kinds = Object.keys(rates).filter((t) => known.has(t) && !(merged && (t === "tribeImmunity" || t === "individualImmunity"))).sort();
  for (const type of kinds) {
    const want = rates[type] * still.length, k = Math.floor(want) + ((roll(seed, n, type, "frac") % 1000) / 1000 < want - Math.floor(want) ? 1 : 0);
    const pool = still.filter((id) => !(safe.has(type) && out.has(id))).sort((a, b) => roll(seed, n, type, a) - roll(seed, n, type, b));
    for (const id of pool.slice(0, k)) list.push({ id: "moment-" + J.digest([n, type, id]).slice(0, 16), type, castawayId: id });
  }
  if (merged && known.has("individualImmunity") && still.length) { const id = still[roll(seed, n, "immunity") % still.length]; if (!out.has(id)) list.push({ id: "moment-" + J.digest([n, "individualImmunity", id]).slice(0, 16), type: "individualImmunity", castawayId: id }); }
  return list;
}
/** The made-up results for Episodes 1 to 8, as supplied facts: as many go home each episode as really did, and how, but who is the
 *  seed's; the moments shaped as above. */
function earlyFacts(seed, participants, known, merge) {
  const r = recorded(), facts = [], gone = new Set();
  for (let n = 1; n < FROM; n++) {
    const still = participants.map((p) => p.id).filter((id) => !gone.has(id));
    const outs = r.exits.filter((x) => x.n === n).map((x, i) => ({ method: x.method === "Voted Out" || x.method === "Quit" || x.method === "Medically Evacuated" ? x.method : "Voted Out", i }));
    const order = still.slice().sort((a, b) => roll(seed, n, "out", a) - roll(seed, n, "out", b));
    const events = outs.map((o, i) => ({ castawayId: order[i], method: o.method }));
    events.forEach((e) => gone.add(e.castawayId));
    facts.push({ id: "fact-show-event-" + n, eventId: "show-event-" + n, contextId: "show", source: "preview-proof-shaped", data: { events, scoringEvents: shapedMoments(seed, n, still, events, known, n >= merge), ...(events.length ? {} : { noExit: true }) } });
  }
  return facts;
}
/** Episode n's results: who goes out (the bench's own Publish: the finale crowns a winner and its finalists) and the moments shaped
 *  like the real season's. */
function resultsFor(s, n) {
  const snap = s.snapshot(), doc = s.export().input, world = snap.contexts.show, e = world.events.find((x) => x.number === n);
  const data = resultsData(snap, doc, "show", e.id, "final");
  const gone = new Set(world.facts.filter((f) => f.eventId !== e.id).flatMap((f) => (f.data.events || []).map((o) => o.castawayId)));
  const still = world.participants.map((p) => p.id).filter((id) => !gone.has(id));
  const known = new Set(world.context.engine.moments.filter((m) => !m.auto && !m.off).map((m) => m.id));
  return { ...data, scoringEvents: shapedMoments(doc.seed, n, still, data.events, known, n >= world.context.phaseStarts.merged) };
}

/** The game the gallery makes: its Fantasy league from the next episode, with "A new draft at a stage". */
function gallerySpec(pg) {
  const base = G.baseById("fantasy");
  const one = G.baseSpec(base, { from: pg.from, to: null }, pg);
  const spec = G.applyChange(one, "redraft", pg);
  const verdict = G.check(spec, pg);
  if (!verdict.ok) throw Error("The gallery's game doesn't check: " + verdict.problems.join("; "));
  return { base, spec, verdict };
}

/** The definition: the real season's people and calendar, the couch, the gallery's game; made-up results through Episode 8. */
function definition(o = {}) {
  const { page, pg } = galleryFacts();
  const { spec } = gallerySpec(pg);
  const seed = o.seed ?? SEED, merge = o.merge ?? MERGE;
  // The season's own rulebook has moments the format's doesn't (Survivor 51: 37, 11 beyond the format's 27: a Shot in the Dark, a
  // rock draw, made the merge...). The runtime's game state and a zt season without its own rulebook know the format's only, so the
  // world keeps the season's moments the format knows (a finding: a preview needs the season's rulebook copied in).
  const known = new Set(require(path.join(root, "src/lib/game/formats")).formatFor("survivor").events.map((e) => e.id));
  const moments = page.ctx.moments.filter((m) => known.has(m.id));
  const events = Array.from({ length: EPISODES }, (_, i) => ({ id: "show-event-" + (i + 1), contextId: "show", number: i + 1, airAt: airOf(i + 1), resultStatus: i + 1 < FROM ? "final" : "unavailable" }));
  // The cast first (the dress), so Episodes 1 to 8's made-up results can name them.
  const bare = D.create({
    seed,
    world: {
      contexts: [{ id: "show", kind: "show", label: "Survivor 51", format: { id: "survivor" }, engine: { ...page.ctx, moments, couch: COUCH.length, pool: page.ctx.pool }, phaseStarts: { merged: merge } }],
      people: COUCH,
      events: events.map((e) => ({ ...e, resultStatus: "unavailable" })),
    },
    games: [{ id: "fantasy", contextId: "show", spec, timing: "live-only" }],
    situation: { clock: new Date(EP9 - 5 * HOUR).toISOString(), marks: [] },
    content: { labels: "normal" },
  });
  const { definition: cast, missing } = Dress.apply(bare, "real");
  if (missing.length) throw Error("No Survivor 51 dress: " + missing.join(", ") + " (record it with real-dress.js)");
  const participants = cast.world.participants;
  const doc = D.create({
    seed,
    world: {
      contexts: cast.world.contexts,
      people: COUCH,
      participants,
      events,
      facts: earlyFacts(seed, participants, new Set(moments.map((m) => m.id)), merge),
    },
    games: [{ id: "fantasy", name: "Fantasy league", contextId: "show", spec, timing: "live-only" }],
    situation: { clock: new Date(EP9 - 5 * HOUR).toISOString(), viewerId: "alex", marks: COUCH.map((p) => ({ personId: p.id, contextId: "show", through: FROM - 1 })) },
    content: { labels: "normal" },
  });
  return doc;
}

// ---- Steps: the runtime's actions, as situations.cjs makes them ----
const must = (s, a) => { const r = s.apply(a); if (r.status !== "accepted") throw Error("Refused: " + JSON.stringify(a).slice(0, 200) + " (" + r.message + ")"); return r; };
const eventOf = (s, n) => s.snapshot().contexts.show.events.find((x) => x.number === n);
/** The stage games (the definition's derived `<game>~<stage>`), in order. */
const stagesOf = (s) => s.export().input.games.filter((g) => g.stageOf !== undefined).map((g) => g.id);
/** Every seat's lineup for Episode n where a stage asks one (the engine's own: the roster's first `need`, turned by seat), but `skip`. */
function lineups(s, n, skip = []) {
  for (const g of stagesOf(s)) for (const p of COUCH) {
    if (skip.includes(p.id)) continue;
    const v = s.project(g, p.id).game, l = v.lineup;
    if (!l || l.episode !== n || v.revealFirst) continue;
    const k = COUCH.indexOf(p) % Math.max(1, l.roster.length - l.need + 1);
    must(s, { type: "lineup", gameId: g, personId: p.id, eventId: l.epId, ids: l.roster.slice(k, k + l.need) });
  }
}
/** Episode n airs and its made-up results come in (the bench's own Publish: publish.cjs), then `who` reveal it. */
function night(s, n, who = COUCH.map((p) => p.id)) {
  const e = eventOf(s, n);
  must(s, { type: "clock", at: new Date(Math.max(Date.parse(s.snapshot().clock), Date.parse(e.airAt) + 2 * HOUR)).toISOString() });
  must(s, { type: "results", contextId: "show", eventId: e.id, source: "provider-fixture", resultStatus: "final", data: resultsFor(s, n) });
  for (const p of who) must(s, { type: "reveal", contextId: "show", personId: p });
}
const teamsOf = (st) => Object.fromEntries(st.players.map((p) => [p.id, st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id).sort()]));
const nameOf = (s) => { const m = new Map(s.snapshot().contexts.show.participants.map((p) => [p.id, p.name])); return (id) => m.get(id) || id; };

/** Headless: the whole season as the story plays it, printing each stage's span, teams and table. */
function dry() {
  const s = R.open(definition());
  try {
    const say = (label) => {
      const who = nameOf(s);
      console.log("\n== " + label + " (clock " + s.snapshot().clock + ")");
      for (const g of ["fantasy", ...stagesOf(s)]) {
        const v = s.project(g, "alex").game;
        console.log(" ", g.padEnd(16), "from", v.from ?? "-", "to", v.to ?? "-", "over", !!v.over, "lineup", v.lineup ? "Ep " + v.lineup.episode : "-", "table", JSON.stringify((v.table || []).map((r) => [r.playerId, r.total])));
        if (g !== "fantasy") console.log("   alex's team:", (v.you?.team || teamsOf(s.snapshot().games[g].state).alex || []).map(who).join(", "));
      }
      const gone = s.snapshot().contexts.show.facts.flatMap((f) => (f.data.events || []).map((x) => who(x.castawayId) + " (" + f.eventId.replace("show-event-", "Ep ") + ")"));
      console.log("  gone:", gone.join(", "));
    };
    say("the start");
    lineups(s, 9); night(s, 9); say("after Episode 9");
    lineups(s, 10); night(s, 10); say("after Episode 10");
    lineups(s, 11); night(s, 11); say("after Episode 11 (the merge)");
    lineups(s, 12); night(s, 12); say("after Episode 12");
    lineups(s, 13); night(s, 13); say("after the finale");
  } finally { s.dispose(); }
}

// ---- Live: the case on the real routes ----
/** The runtime's state as the results that open a stage's draft come in, the draft open and nobody on a team yet (check-stages-
 *  explorer.js draftOpen): the stage's state from before those results, with them applied and its span settled as the runtime
 *  settles any write, less the draft the runtime then makes. */
function draftOpen(before, after, doc, childId) {
  const st = JSON.parse(JSON.stringify(before.games[childId].state)), world = after.contexts.show, game = doc.games.find((g) => g.id === childId);
  Data.applyFacts(world, st); Data.syncMarks(world, game, st); Data.settleWrite(world, st, { phases: true, clock: after.clock });
  if (S.DraftLogic.waits(st) || st.castaways.some((x) => x.ownerIds.length)) throw Error("The draft should be open and not made");
  return { ...after, games: { ...after.games, [childId]: { ...after.games[childId], state: st } } };
}

/**
 * The case, live: materialized as zt-gb rows in this lane's database, each step synced (the runtime stays authoritative), with a
 * signed-in fetch for each person. `findings` collects every comparison of a real write with the runtime.
 */
async function openCase() {
  const Live = require(path.join(root, "tools/gameplay-bench/live-db.cjs"));
  const { api } = require("./browser");
  const s = R.open(definition()), doc = s.export().input;
  const ids = await Live.up(s.snapshot(), doc);
  const shift = (snap) => Date.now() - Date.parse(snap.clock);
  const c = {
    s, doc, ids, Live, comparisons: [],
    sync: async (snap = s.snapshot()) => { s.calendar?.(shift(snap)); await Live.sync(ids, snap, doc, shift(snap)); },
    as: {},
    call: async (who, method, url, body) => { c.as[who] ||= await api({ user: ids.users[who].username, pass: Live.PASSWORD }); return c.as[who].call(method, url, body); },
    season: ids.seasons.show.id,
    league: (g = "fantasy") => ids.leagues[g],
    down: async () => { await Live.down(ids.key).catch((e) => console.error("could not remove zt-gb-" + ids.key + ": " + e.message)); await Live.close(); s.dispose(); },
  };
  await c.sync();
  await Live.seedSocial(ids, s.snapshot(), doc, shift(s.snapshot()));
  return c;
}

// The story's stops, in order: each brings the case from the one before to its point (runtime actions, then a sync).
const STOPS = ["start", "ep9", "ep10", "merge", "merged", "finale", "over"];
/** Bring the case to `stop` (from the start), stopping before any frame there. Alex's own moves at a stop are the frames' (live). */
async function advance(c, stop, from = "start") {
  const s = c.s, at = STOPS.indexOf(stop), was = STOPS.indexOf(from);
  if (at < 0) throw Error("Stops: " + STOPS.join(", "));
  for (let i = was + 1; i <= at; i++) {
    const here = STOPS[i];
    if (here === "ep9") lineups(s, 9, ["alex"]); // the couch's moves for Episode 9: Alex's is made on the real screen
    if (here === "ep10") { lineups(s, 9); night(s, 9); lineups(s, 10); night(s, 10); }
    if (here === "merge") {
      lineups(s, 11);
      c.before = s.snapshot(); night(s, 11); c.after = s.snapshot();
      await c.sync(draftOpen(c.before, c.after, c.doc, "fantasy~after"));
      continue;
    }
    if (here === "merged") { /* the draft is the frames' (live); the runtime's own is the one compared */ }
    if (here === "finale") { lineups(s, 12); night(s, 12); lineups(s, 13); night(s, 13, ["riley", "jordan", "sam"]); }
    if (here === "over") must(s, { type: "reveal", contextId: "show", personId: "alex" });
    await c.sync();
  }
}

/** --at=<stop> --keep: the case brought to a stop and left up, for looking at its screens by hand. */
async function hold(stop) {
  const c = await openCase();
  try {
    await advance(c, stop);
    console.log(JSON.stringify({ stop, key: c.ids.key, password: c.Live.PASSWORD, users: Object.fromEntries(Object.entries(c.ids.users).map(([k, u]) => [k, u.username])), season: c.season, leagues: c.ids.leagues, couch: c.ids.couchId, game: `${BASE}/show/${c.season}/game/${c.league()}` }, null, 1));
  } catch (e) { await c.down(); throw e; }
  await c.Live.close();
}

// ---- The story: frames on the real screens as Alex ----
const sameSet = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
async function story() {
  const { open } = require("./browser");
  fs.mkdirSync(OUT, { recursive: true });
  const c = await openCase(), s = c.s, index = { base: BASE, width: W, height: H, case: c.ids.key, frames: [], comparisons: c.comparisons, errors: [] };
  const who = nameOf(s);
  let b;
  const phone = async () => {
    if (b) await b.close();
    b = await open({ user: c.ids.users.alex.username, pass: c.Live.PASSWORD, width: W, height: H, motion: "reduce" });
    // The dev server's own badge (Next's dev indicator) isn't the app's: hidden from the frames.
    await b.page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }));
    b.page.on("pageerror", (e) => index.errors.push("pageerror: " + e.message.split("\n")[0]));
    return b.page;
  };
  const go = async (p, url, ready) => {
    await p.goto(BASE + url, { waitUntil: "domcontentloaded" });
    if (ready) await p.locator(ready).first().waitFor({ timeout: 60000 });
    await p.waitForFunction(() => document.fonts.check("16px Archivo") || document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2500);
  };
  const shoot = async (p, id, what, full = true) => {
    await p.screenshot({ path: path.join(OUT, id + ".png") });
    if (full) await p.screenshot({ path: path.join(OUT, id + ".full.png"), fullPage: true });
    const text = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]:not([aria-hidden="true"])')].pop(); return (d || document.body).innerText; });
    fs.writeFileSync(path.join(OUT, id + ".txt"), text);
    index.frames.push({ id, what, clock: s.snapshot().clock, url: p.url().replace(BASE, ""), full });
    console.log("frame", id, "·", what);
  };
  const game = (g = "fantasy") => `/show/${c.season}/game/${c.league(g)}`;
  const tonight = `/show/${c.season}/tonight`;
  const top = (p) => p.locator('[role="dialog"]:not([aria-hidden="true"])').last();
  try {
    let p = await phone();
    // 01 The start: Tonight before Episode 9, the game's page (the overall), the first stage's page (Alex's team).
    await advance(c, "start");
    await go(p, tonight, "[data-strip]"); await shoot(p, "01a-tonight", "Tonight before Episode 9");
    await go(p, game(), "[data-game-page]"); await shoot(p, "01b-game", "The game's page: the overall");
    await go(p, game("fantasy~before"), "[data-game-page]"); await shoot(p, "01c-stage", "The first stage's page: Alex's team");

    // 02 Episode 9's move: the couch's lineups made up by the engine; Alex's on the real "Your moves" sheet, saved through the route.
    await advance(c, "ep9", "start");
    await go(p, tonight, "[data-strip]");
    await p.locator("[data-strip] button").first().click();
    await top(p).locator("[data-starter]").first().waitFor({ timeout: 20000 }); await p.waitForTimeout(1200);
    await shoot(p, "02a-moves", "Your moves: Episode 9, nobody started yet", false);
    const l9 = s.project("fantasy~before", "alex").game.lineup, mine = l9.roster.filter((id) => s.snapshot().games["fantasy~before"].state.castaways.find((x) => x.id === id).status === "active").slice(-l9.need);
    for (const id of mine) { await top(p).locator(`[data-starter="${id}"]`).first().click(); await p.waitForTimeout(400); }
    await shoot(p, "02b-moves-set", "Your moves: Alex starts " + mine.map(who).join(", "), false);
    const saved = p.waitForResponse((r) => r.request().method() !== "GET" && /\/api\/leagues\/[^/]+\/episodes\/[^/]+\/lineups\//.test(r.url()), { timeout: 20000 }).catch(() => null);
    await top(p).locator('button:has-text("Save")').last().click();
    const res = await saved; await p.waitForTimeout(2500);
    await shoot(p, "02c-saved", "After Save", false);
    {
      const real = (await c.Live.read(c.ids)).states.get(c.league("fantasy~before")), ep = real.episodes.find((e) => e.number === 9);
      const r = s.apply({ type: "lineup", gameId: "fantasy~before", personId: "alex", eventId: l9.epId, ids: ep.lineups?.alex || [] }, "preview-proof-live");
      const runtime = s.snapshot().games["fantasy~before"].state.episodes.find((e) => e.number === 9).lineups.alex;
      c.comparisons.push({ step: "Alex's Episode 9 lineup", route: res ? res.request().method() + " " + new URL(res.url()).pathname.replace(/[0-9a-f-]{36}/g, ":id") + " " + res.status() : "no write seen", server: (ep.lineups?.alex || []).map(who), runtime: r.status, agree: r.status === "accepted" && sameSet(runtime, ep.lineups?.alex) && sameSet(ep.lineups?.alex, mine) });
      await c.sync();
    }

    // 03 Episode 9 and 10 played (made-up results), everyone watched: the game page after Episode 10. 04 A castaway's sheet.
    s.apply({ type: "reveal", contextId: "show", personId: "alex" }); // (nothing to reveal before Ep 9 airs: a no-op if refused)
    await advance(c, "ep10", "ep9");
    await go(p, game("fantasy~before"), "[data-game-page]"); await shoot(p, "03a-stage", "The first stage after Episode 10");
    await go(p, game(), "[data-game-page]"); await shoot(p, "03b-game", "The overall after Episode 10");
    await go(p, tonight, "[data-strip]"); await shoot(p, "03c-tonight", "Tonight after Episode 10");
    await go(p, game("fantasy~before"), "[data-game-page]");
    const door = p.locator("[data-your-team] [data-door-cast]").first();
    await door.scrollIntoViewIfNeeded(); await door.click();
    await top(p).waitFor({ timeout: 20000 }); await p.waitForTimeout(3000);
    await shoot(p, "04a-cast", "A castaway's sheet, from Alex's team", false);
    const chart = top(p).locator("[data-cast-chart], [data-person-season], svg").first();
    if (await chart.count()) { await chart.evaluate((el) => el.scrollIntoView({ block: "start" })).catch(() => {}); await p.waitForTimeout(800); await shoot(p, "04b-cast-chart", "The sheet's weeks", false); }

    // 05 The merge: Episode 11's results confirm it; the Merged stage's draft opens, made in the real draft room.
    await advance(c, "merge", "ep10");
    p = await phone(); // (a fresh page: nothing cached from before the merge)
    await go(p, tonight, "[data-strip]"); await shoot(p, "05a-tonight", "Tonight after the merge (Episode 11)");
    await go(p, game("fantasy~after"), "[data-game-page]"); await shoot(p, "05b-stage", "The Merged stage before its draft");
    const room = `/show/${c.season}/blind?game=${c.league("fantasy~after")}`;
    await go(p, room, "[data-draft]"); await shoot(p, "05c-room", "The draft room: the Merged stage's draft, open");
    await p.locator("[data-draft-start]").first().click(); await p.waitForTimeout(3000);
    const want = teamsOf(c.after.games["fantasy~after"].state);
    // A tile opens the castaway's sheet; its foot adds them (Add to your team). The first one's sheet is a frame.
    for (const [k, id] of want.alex.entries()) {
      await p.locator(`[data-draft-wall] [data-tile="${id}"]`).first().click();
      await top(p).locator("[data-sheet-pick]").waitFor({ timeout: 20000 }); await p.waitForTimeout(k ? 600 : 2500);
      if (!k) await shoot(p, "05d-draft-sheet", "A castaway's sheet in the draft room: " + who(id), false);
      await top(p).locator("[data-sheet-pick]").click(); await p.waitForTimeout(700);
    }
    await shoot(p, "05e-room-picked", "Alex's five, picked in private");
    await p.locator("[data-lock]").first().click(); await p.waitForTimeout(2500);
    await shoot(p, "05f-room-locked", "Alex locked in; waiting on the couch");
    for (const who2 of ["riley", "jordan", "sam"]) {
      const r = await c.call(who2, "POST", `/api/leagues/${c.league("fantasy~after")}/draft/blind/lock`, { playerId: who2, castawayIds: want[who2] });
      if (r.status !== 200) c.comparisons.push({ step: who2 + " locks in", status: r.status, body: JSON.stringify(r.body).slice(0, 200), agree: false });
    }
    {
      const real = (await c.Live.read(c.ids)).states.get(c.league("fantasy~after"));
      c.comparisons.push({ step: "The Merged stage's draft", server: Object.fromEntries(Object.entries(teamsOf(real)).map(([k, v]) => [k, v.map(who)])), revealed: !!real.blindDraft?.revealedAt, agree: JSON.stringify(teamsOf(real)) === JSON.stringify(want) && !!real.blindDraft?.revealedAt });
    }
    await go(p, room, "[data-draft]"); await shoot(p, "05g-room-revealed", "The draft revealed");
    await c.sync(); // the runtime's own draft (the one compared) from here on
    await go(p, game("fantasy~after"), "[data-game-page]"); await shoot(p, "05h-stage", "The Merged stage, drafted");

    // 06 The finale: Episodes 12 and 13 played, the couch has watched; Alex reveals it on the real reveal. 07 The season over.
    await advance(c, "finale", "merge");
    p = await phone();
    await go(p, tonight, "[data-ask-line], [data-progress-reveal]"); await p.locator("[data-game-mini], [data-last-time]").first().waitFor({ timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500); await shoot(p, "06a-tonight", "Tonight: the finale is in, Alex hasn't watched");
    await p.locator("[data-ask-yes], [data-progress-reveal], [data-progress-watched]").first().click();
    await top(p).waitFor({ timeout: 20000 }); await p.waitForTimeout(1500);
    for (let k = 1; k <= 7; k++) {
      const stage = top(p).locator("[data-stage]").last();
      if (!(await stage.isVisible().catch(() => false))) {
        const yes = top(p).locator(':is([data-watched-yes], [data-step-guard-yes], button:has-text("Reveal"))').last();
        if (!(await yes.isVisible().catch(() => false))) break;
        await yes.click(); await p.waitForTimeout(2500);
      } else { await shoot(p, "06b-reveal-" + k, "The finale's reveal, beat " + k, false); await stage.click(); await p.waitForTimeout(1500); }
    }
    {
      const real = (await c.Live.read(c.ids)).members.find((m) => m.league_id === c.league() && m.player_id === "alex");
      const r = s.apply({ type: "reveal", contextId: "show", personId: "alex" }, "preview-proof-live");
      c.comparisons.push({ step: "Alex reveals the finale", server: real?.results_seen_through, runtime: r.status, agree: r.status === "accepted" && real?.results_seen_through === 13 });
      await c.sync();
    }
    p = await phone();
    await go(p, game(), "[data-game-page]"); await shoot(p, "07a-game", "The overall, the season over");
    await go(p, game("fantasy~after"), "[data-game-page]"); await shoot(p, "07b-stage", "The Merged stage, over");
    // What the runtime says it is, for the captions.
    index.runtime = Object.fromEntries(["fantasy", "fantasy~before", "fantasy~after"].map((g) => [g, { table: s.project(g, "alex").game.table.map((r) => [who2name(r.playerId), r.total]), over: !!s.project(g, "alex").game.over }]));
    index.gone = s.snapshot().contexts.show.facts.flatMap((f) => (f.data.events || []).map((x) => [f.eventId.replace("show-event-", ""), who(x.castawayId), x.method]));
    index.teams = { before: Object.fromEntries(Object.entries(teamsOf(s.snapshot().games["fantasy~before"].state)).map(([k, v]) => [k, v.map(who)])), after: Object.fromEntries(Object.entries(teamsOf(s.snapshot().games["fantasy~after"].state)).map(([k, v]) => [k, v.map(who)])) };
    index.problems = (await require(path.join(root, "tools/gameplay-bench/api-checks.cjs")).checkCase({ app: BASE, ids: c.ids, snap: s.snapshot(), document: c.doc, project: (g, pp) => s.project(g, pp) })).map((x) => x.signature + (x.message ? ": " + x.message : ""));
  } catch (e) {
    index.failed = String(e.stack || e);
    if (b) await b.page.screenshot({ path: path.join(OUT, "zz-failed.png") }).catch(() => {});
    throw e;
  } finally {
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
    if (b) await b.close();
    if (has("keep")) { console.log("kept zt-gb-" + c.ids.key + " (remove: node scripts/dev-test/preview-proof.js down " + c.ids.key + ")"); await c.Live.close(); } else await c.down();
    console.log("comparisons:", JSON.stringify(c.comparisons, null, 1));
  }
}
const who2name = (id) => (COUCH.find((p) => p.id === id) || { name: id }).name;

module.exports = { definition, galleryFacts, gallerySpec, COUCH, openCase, advance, STOPS, _h: { lineups, night, resultsFor, teamsOf, stagesOf } };

if (require.main === module) {
  const fail = (e) => { console.error(e); process.exitCode = 1; };
  if (args[0] === "record") record().catch(fail);
  else if (args[0] === "down") { const Live = require(path.join(root, "tools/gameplay-bench/live-db.cjs")); Live.down(args[1]).then(() => console.log("removed zt-gb-" + args[1])).catch(fail).finally(() => Live.close()); }
  else if (has("dry")) dry();
  else if (opt("at")) hold(opt("at")).catch(fail);
  else story().catch(fail);
}
