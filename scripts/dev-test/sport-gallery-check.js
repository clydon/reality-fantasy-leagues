// Dev-only check of Start a game's sports catalog (src/lib/game/start-gallery/sports.json, read by sports.js): every base with a
// spec is checked on each of its pages (`on`) of each sport family's page context, by the gallery's own check (index.js check: the
// engine's specProblems with the page's ctx, specWaitsFor, typeOf), and a table says, sport by sport, which game types play, which
// are coming (with the step or engine piece that brings them) and which our check turns down (with its reason). It exits 1 when a
// base that claims to play doesn't, or when the catalog drifts from the app:
//   - each family's leagues are the app's (src/lib/sports/index.ts sportOf, allSports);
//   - sports.js's standard games are defaultsFor's exactly (a league's own over the sport's, football's lineup slots);
//   - a slate's or the playoffs' question asks about each game (each: 'game') or is a bracket, and no squares play there: the server
//     keeps a slate's week as its games one by one (score.ts leagueGames: no one game for the week), so a lone final or stat
//     question there never settles, and squares never pay, though our check passes both;
//   - every base has a spec or says what's coming, and its `by` keys are its families' or their leagues.
//
// The page contexts are the app's own, offline: sports/page.ts sportPageContext for the family's league (its stats, positions,
// shape, periods, sizes; the playoffs' draw), loaded through jiti, with a couch and a pool as stand-ins:
//   slate     a league's season by its usual cadence (a week; soccer's a round); the pool the explorer's real-size one
//             (tools/gameplay-bench/explorer/runtime-sports.cjs realPool: football 344, basketball 330, baseball 430, hockey 380,
//             soccer 360)
//   playoffs  a league's playoffs slate (specContextOf's playoffs); the real-size pool's share of the playoff teams
//   game      a team's games, one an episode: two teams' rosters (football 106, basketball 34, baseball 52, hockey 46, soccer 50)
//   event     a field's or a card's season: one event's field (golf 156; a race's grid, F1 22, NASCAR 36 to 40, IndyCar 27; MMA 26
//             for a card; tennis 128)
// A draft too big for its pool is fitted to it as the show gallery fits one (index.js baseSpec), and the table says so.
// A real page in place of the stand-ins: --page=<file>, a captured wizard read (GET /api/seasons/[id]/start?couch=&wizard=1's JSON,
// or its wizard.page), checked as it is (its own couch and pool).
//
// Needs: the repo's node_modules (jiti). No database, no server, no browser, no network: ESPN is never asked.
//
//   node scripts/dev-test/sport-gallery-check.js                   the core league of each family (NFL, NBA, MLB first), couch of 8
//   node scripts/dev-test/sport-gallery-check.js --all-leagues     every league each family lists (college, WNBA, F1 and NASCAR...)
//   node scripts/dev-test/sport-gallery-check.js --only=football,basketball   some families
//   node scripts/dev-test/sport-gallery-check.js --couch=12        another couch size (head to head needs 2; a draft's pool fits)
//   node scripts/dev-test/sport-gallery-check.js --last=<league id>   a keeper league's last-season game (else it shows as needs,
//                                                                  and is checked with a stand-in one)
//   node scripts/dev-test/sport-gallery-check.js --page=<file>     a captured wizard read, checked as it is
//   node scripts/dev-test/sport-gallery-check.js --json=<file>     also every row as JSON (for the screens' story)
//
// Reusable: run it after any change to sports.json, the sports' defaults or the engine's check. Pure reads of the repo.
/* eslint-disable @typescript-eslint/no-require-imports -- a plain CommonJS node script, like the catalog it checks */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(ROOT, "src") } });
const P = jiti("../../src/lib/sports/page.ts");
const L = jiti("../../src/lib/sports/index.ts");
const SP = require("../../src/lib/game/start-gallery/sports.js");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const COUCH = Number(opt("couch", 8));
const ONLY = opt("only", null)?.split(",").filter(Boolean) ?? null;
const LAST = opt("last", null);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);

let failures = 0;
const fail = (what) => {
  failures++;
  console.log(`FAIL  ${what}`);
};

// ---------- the stand-in pages ----------

/** Two teams' rosters, a game page's pool. */
const GAME_POOL = { football: 106, basketball: 34, baseball: 52, hockey: 46, soccer: 50 };
/** The share of a league's teams in its playoffs (the NFL's 14 of 32, the NBA's 20 of 30 with the play-in...). */
const PLAYOFF_SHARE = { football: 14 / 32, basketball: 20 / 30, baseball: 12 / 30, hockey: 16 / 32, soccer: 18 / 30 };
/** One event's field: a full-field tour event, a race's grid (F1's with reserves, NASCAR's, IndyCar's), a fight card, a Grand
 *  Slam's draw. */
const EVENT_POOL = { golf: 156, racing: 22, "racing/nascar-premier": 40, "racing/nascar-secondary": 38, "racing/nascar-truck": 36, "racing/irl": 27, mma: 26, tennis: 128 };
/** A slate's usual episode: a week (its cadence's), soccer's a round. */
const CADENCE = { soccer: "round" };

let bench = null;
/** The explorer's real-size pool for a team sport's league (its own table), else a stand-in of the same size. */
function realSize(league) {
  try {
    bench ||= require("../../tools/gameplay-bench/explorer/runtime-sports.cjs");
    return bench.realPool(league).size;
  } catch {
    return { football: 344, basketball: 330, baseball: 430, hockey: 380, soccer: 360 }[league.split("/")[0]] ?? 300;
  }
}

/** A page's ctx for `league` as `kind` (the stand-ins above), or null for a page its family doesn't have. */
function standIn(family, league, kind) {
  const part = (w) => ({ singular: w, plural: `${w}s` });
  let ctx;
  if (kind === "event") ctx = P.sportPageContext(league, {});
  else if (kind === "slate") ctx = P.sportPageContext(league, { part: part(CADENCE[family] || "week") });
  else if (kind === "playoffs") ctx = P.sportPageContext(league, { part: part(CADENCE[family] || "week"), playoffs: true });
  else ctx = P.sportPageContext(league, { part: part("game") });
  if (!ctx) return null;
  const pool = kind === "event" ? EVENT_POOL[league] ?? EVENT_POOL[family] : kind === "game" ? GAME_POOL[family] : kind === "playoffs" ? Math.round(realSize(league) * PLAYOFF_SHARE[family]) : realSize(league);
  return { ...ctx, couch: COUCH, pool };
}

// ---------- the catalog against the app ----------

function driftChecks() {
  const families = new Map(SP.SPORT_FAMILIES.map((f) => [f.id, f]));
  // Each family's leagues are the app's, and every sport the app reads has its family.
  for (const f of SP.SPORT_FAMILIES) {
    for (const league of f.leagues) {
      const s = L.sportOf(league);
      if (!s || s.id !== f.id) fail(`${league}: the app reads it as ${s ? s.id : "no sport"}, not ${f.id}`);
      if (!L.defaultsFor(f.id, league.split("/")[1])) fail(`${league}: no defaults`);
    }
    if (!f.leagues.includes(f.core)) fail(`${f.id}: its core league ${f.core} isn't one of its leagues`);
  }
  for (const s of L.allSports()) {
    const f = families.get(s.id);
    if (!f) fail(`the app's sport ${s.id} (${s.name}) has no family`);
    else for (const name of s.leagues ?? []) if (!f.leagues.includes(`${s.id}/${name}`)) fail(`the app's ${s.id}/${name} isn't one of ${f.id}'s leagues`);
  }
  // sports.js's standard games are defaultsFor's.
  for (const f of SP.SPORT_FAMILIES)
    for (const league of f.leagues) {
      const app = L.defaultsFor(f.id, league.split("/")[1]);
      const mine = SP.sportStandard(f.id, league);
      for (const [id, x] of Object.entries(app.specs)) if (!mine[id] || !same(mine[id].spec, x.spec)) fail(`${league} ${id}: sports.js's standard game isn't defaultsFor's`);
      for (const id of Object.keys(mine)) if (!app.specs[id]) fail(`${league} ${id}: sports.js has a standard game defaultsFor hasn't`);
    }
  // Every base says what it is; its `by` keys are its families' or their leagues; its pages are pages.
  const kinds = new Set(SP.SPORT_PAGES.map((p) => p.id));
  const cats = new Set(SP.SPORT_CATS.map((c) => c.id));
  const ids = new Set();
  for (const b of SP.SPORT_BASES) {
    if (ids.has(b.id)) fail(`${b.id}: two bases have this id`);
    ids.add(b.id);
    if (!b.spec && !b.coming) fail(`${b.id}: neither a spec nor what's coming`);
    if (!cats.has(b.cat)) fail(`${b.id}: "${b.cat}" isn't one of the categories`);
    if (!b.on?.length || !b.on.every((k) => kinds.has(k))) fail(`${b.id}: its pages (on) aren't pages`);
    for (const fam of b.sports) if (!families.has(fam)) fail(`${b.id}: "${fam}" isn't a family`);
    for (const k of Object.keys(b.by || {})) {
      const fam = k.split("/")[0];
      if (!b.sports.includes(fam) || (k.includes("/") && !families.get(fam)?.leagues.includes(k))) fail(`${b.id}: by "${k}" is none of its families or their leagues`);
    }
    for (const fam of b.sports) if (!b.on.some((k) => families.get(fam)?.pages.includes(k))) fail(`${b.id}: made for no page ${fam} has`);
  }
}

/** A slate's or the playoffs' question asks about each game, or is a bracket, and nothing pays on one game's score (the header). */
function slateProblem(spec) {
  if (isObj(spec.get) && spec.get.by === "squares") return "squares pay on one game's score: a slate's week keeps no one game, so they would never pay";
  for (const q of Array.isArray(spec.ask) ? spec.ask : []) {
    const by = q?.settle?.by;
    if ((by === "final" || by === "stat") && q.each !== "game" && q.answer !== "bracket") return `"${q.id}" is a lone ${by} question: a slate's week keeps no one game, so it would never settle`;
  }
  return null;
}

// ---------- the table ----------

const STATE = { plays: "plays", off: "OFF", coming: "coming", needs: "needs", elsewhere: "-" };
const pad = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s).padEnd(n));

/** Every base of a league's family on each of its family's pages: the rows, and a failure for each one that claims to play and doesn't. */
function checkLeague(family, league) {
  const f = SP.SPORT_FAMILIES.find((x) => x.id === family);
  const rows = [];
  const pools = [];
  for (const kind of f.pages) {
    const ctx = standIn(family, league, kind);
    if (!ctx) continue;
    pools.push(`${kind} ${ctx.pool}`);
    if (SP.pageKindOf(ctx) !== kind) fail(`${league}: pageKindOf reads its ${kind} page as ${SP.pageKindOf(ctx)}`);
    const last = LAST || "zt-last-season";
    for (const r of SP.sportGallery(ctx, { page: kind, extra: { show: league } })) {
      let row = { league, family, page: kind, ...r };
      // A keeper league waits for last season's game: checked with one (the stand-in, or --last).
      if (r.state === "needs") {
        const got = SP.sportGallery(ctx, { page: kind, extra: { show: league, lastSeason: last } }).find((x) => x.id === r.id);
        if (got.state !== "plays") fail(`${league} ${kind} ${r.id} (${r.name}): with last season's game it doesn't play: ${got.why}`);
        row = { ...row, withLast: got.state, short: got.short };
      }
      if (r.state === "off") fail(`${league} ${kind} ${r.id} (${r.name}) claims to play: ${r.why}`);
      if (r.state === "plays" && (kind === "slate" || kind === "playoffs")) {
        const p = slateProblem(r.spec);
        if (p) fail(`${league} ${kind} ${r.id} (${r.name}): ${p}`);
      }
      rows.push(row);
    }
  }
  const count = (s) => rows.filter((r) => r.state === s).length;
  console.log(`\n${league} (${f.name}), a couch of ${COUCH}; pools: ${pools.join(", ")}`);
  console.log(`  ${count("plays")} play, ${count("coming")} coming, ${count("needs")} need a page fact, ${count("off")} off`);
  for (const r of rows) {
    const what = r.state === "plays" ? (r.short ? `${r.short.line}` : r.type) : r.state === "needs" ? `${r.why}; with it: ${r.withLast}` : r.why;
    console.log(`  ${pad(STATE[r.state], 7)} ${pad(r.page, 9)} ${pad(r.name, 30)} ${pad(r.len, 13)} ${what}${r.fitted ? `  (fitted to the pool: ${r.fitted.people} × ${r.fitted.each} is more than ${r.fitted.pool}, so ${r.fitted.to === "shared" ? "shared" : `${r.fitted.to} each`})` : ""}`);
  }
  return rows;
}

/** A captured wizard read, checked as it is. */
function checkCaptured(file) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  const page = raw.wizard ? raw.wizard.page : raw.page || raw;
  const kind = SP.pageKindOf(page);
  const league = page.ctx?.league;
  console.log(`\n${file}: ${league} as ${kind}, couch ${page.ctx?.couch ?? "?"}, pool ${page.ctx?.pool ?? "?"}`);
  const rows = SP.sportGallery(page, { extra: { show: page.ctx?.show } });
  for (const r of rows) {
    if (r.state === "off") fail(`${league} ${kind} ${r.id} (${r.name}) claims to play: ${r.why}`);
    console.log(`  ${pad(STATE[r.state], 7)} ${pad(r.name, 30)} ${pad(r.len, 13)} ${r.state === "plays" ? r.short?.line ?? r.type : r.why}`);
  }
  return rows.map((r) => ({ league, family: SP.familyOf(league), page: kind, ...r }));
}

function main() {
  driftChecks();
  let rows = [];
  const file = opt("page", null);
  if (file) rows = checkCaptured(file);
  else
    for (const f of SP.SPORT_FAMILIES) {
      if (ONLY && !ONLY.includes(f.id)) continue;
      for (const league of has("all-leagues") ? f.leagues : [f.core]) rows.push(...checkLeague(f.id, league));
    }
  const out = opt("json", null);
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify(rows, null, 1));
  const n = (s) => rows.filter((r) => r.state === s).length;
  console.log(`\n${rows.length} rows: ${n("plays")} play, ${n("coming")} coming, ${n("needs")} need a page fact, ${n("off")} off`);
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exit(failures ? 1 : 0);
}

main();
