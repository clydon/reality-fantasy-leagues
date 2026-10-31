// Dev-only: the season-forward rehearsal (docs/PLAN-researched-survivor.md, "The season-forward rehearsal"). The couch's
// real Survivor 51 games, cloned from a production backup (shadow-leagues.js `up --rules=same`: mock players copying every
// real move) onto a zt- copy of the backup's season, then played forward to the finale from a scenario: before each
// episode the mock players' moves through the app's own writes, by the archetypes' habits (playtest.js's: lineups, pool
// picks, finale predictions, waiver claims), then its results as production gets them (the bot's quick check, accepted on
// the desk: early; the bot's full research 12 hours on, accepted: final; the season sync reaching every game), the desk's
// "When did Merged start?", and whatever the scenario does after (a correction, Make every game match, a house ruling).
// Every game's state is kept after each episode's early and final results, and then read three ways:
//
//   flag off against flag on   the same run with the game-specs flag off and on (game-specs-flag.js, this database only):
//                              every read the same (golden.js's read: as nobody and as each seat, at every mark)
//   old code against new code  every kept state read by another tree's engine (--before=<ref>, golden.js's trees) and this
//                              one's: R1's proof is `compare <run> --before=master` from R1's working tree
//   invariants                 a pool pick never repeats, Outlast ends with one left standing, every game ends at the finale
//                              and not before, every score finite, nothing scored past a game's span, no move refused that the
//                              app offered (a move after the lock is refused and wasn't offered: that's right)
//
//   node scripts/dev-test/season-forward.js up --from=backups/<dir> [--results-by=leagues|admin]
//                                                 the shadow couch on a zt- copy of the season (checked faithful: a season
//                                                 sync on it changes nothing); --results-by overrides who decides results
//   node scripts/dev-test/season-forward.js play [--scenario=realistic] [--through=N] [--label=x | --out=<dir>] [--look=7,9]
//                                                 from the episode after the backup's last to the scenario's finale (or N;
//                                                 play again to carry on); kept in .session-loop/season-forward/<scenario>-<label>
//   node scripts/dev-test/season-forward.js compare <run dir> [<run dir>] [--before=<ref>]
//                                                 two runs' reads (and the screens' words: a page with none read is a
//                                                 difference) side by side, and/or every kept state read by <ref>'s engine
//                                                 against this tree's; exit 1 on any difference
//   node scripts/dev-test/season-forward.js rehearse --from=backups/<dir> [--scenario=realistic,rough,dst] [--before=master]
//                                                 [--look=7,9,12,13]: each scenario up, played with the flag off, up again,
//                                                 played with it on, compared (and through --before's engine); the flag
//                                                 is left off. About a minute a scenario; a look adds about a minute each
//   node scripts/dev-test/season-forward.js down
//
// --look=<episodes>: at each, after the final results and before anyone reveals, the screens at 390 (--width) as the
// Tinkerer: Tonight, the reveal beat by beat, Tonight after it, the Games tab, Your moves (or the page the dock leads to),
// the episode's page, Backstage, How it works; again after the scenario's corrections there. Screenshots and each page's
// words in .session-loop/screens/season-forward/<run>/ep<N>/ (gitignored: real people's names are on them). Needs this
// lane's dev server carrying the run's clock, started from this folder (stop any other first):
//   NODE_OPTIONS="--require <this folder>/scripts/dev-test/sim-clock.js" SIM_CLOCK_FILE=<this folder>/.session-loop/season-forward/clock.txt npm run dev -- -p <port>
// (the browser's clock is set to the same moment).
//
// Scenarios are data: scripts/dev-test/season-forward/<name>.json (what each one covers is in its "about"). Castaways are
// never named in them: who goes home, wins immunity or finds an idol is drawn (a fixed hash of the scenario's seed, the
// episode and the name) from whoever can, as the backup's season stands, so a scenario plays from any week's backup.
//
// Needs: this lane's .env.local (a local database, migrated), a backup folder (scripts/backup-leagues.js, of production,
// taken by the user). No bot (answers are written from the scenario) and no dev server, except for `look`. Everything it
// makes is keyed: the shadow games and mock players (zt-shadow- / zt_shadow_, shadow-leagues.js), the season's copy (show
// zt-sf-survivor: its season, cast, results, research and rulebook go with it), the desk's account (zt_sf_desk). `up`
// runs `down` first. The process runs on a clock of its own (sim-clock.js), so the weeks ahead can air; the database's
// now() and every other process keep the real time. Prints castaway names (public), never a real player's.
require("dotenv").config({ path: ".env.local", quiet: true });
const Clock = require("./sim-clock");
Clock.install();
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const C = require("../backup-common");
const PT = require("./playtest");
const golden = require("./golden");

const P = PT.harness;
const ROOT = path.join(__dirname, "..", "..");
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("season-forward.js runs against a local database only");

const SLUG = "zt-sf-survivor";
const REAL_SLUG = "survivor";
const SEASON = 51;
const DESK = "zt_sf_desk";
const SCENARIOS = path.join(__dirname, "season-forward");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const args = process.argv.slice(2);
const opt = (name, d = null) => (args.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3) || d;
const app = () => P.appCode();
const ts = (f) => P.tsApp(f);
const q1 = async (sql, params) => (await app().pool.query(sql, params)).rows[0] ?? null;
const qa = async (sql, params) => (await app().pool.query(sql, params)).rows;
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------- down ----------

function shadowTool(argv) {
  const r = spawnSync("node", ["scripts/dev-test/shadow-leagues.js", ...argv], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`shadow-leagues.js ${argv.join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

async function down() {
  const said = shadowTool(["down"]);
  // The season's copy, and everything keyed on its show or season (cast, episodes, results, research, rulebook, the bot's runs).
  const shows = (await qa("SELECT id FROM shows WHERE slug = $1", [SLUG])).map((r) => r.id);
  if (shows.length) {
    await app().pool.query("DELETE FROM episode_research WHERE show_id = ANY($1::uuid[])", [shows]);
    await app().pool.query("DELETE FROM shows WHERE id = ANY($1::uuid[])", [shows]);
  }
  const desk = (await qa(`SELECT id FROM "user" WHERE username = $1`, [DESK])).map((r) => r.id);
  if (desk.length) {
    await app().pool.query(`DELETE FROM account WHERE "userId" = ANY($1::text[])`, [desk]);
    await app().pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [desk]);
  }
  return `${said}; the season's copy${shows.length ? "" : " (none)"}`;
}

// ---------- up: the season's copy ----------

function readBackup(dir) {
  if (!dir || !fs.existsSync(path.join(dir, "leagues.json"))) throw new Error(`--from must be a backup folder (scripts/backup-leagues.js): ${dir}`);
  const cache = new Map();
  return {
    dir,
    rows(t) {
      if (!cache.has(t)) cache.set(t, fs.existsSync(path.join(dir, `${t}.json`)) ? JSON.parse(fs.readFileSync(path.join(dir, `${t}.json`), "utf8")) : []);
      return cache.get(t);
    },
  };
}

// The season's tables, in the order they're copied (each row's own id made new, every id it points at mapped), and which of
// the backup's rows are the season's. A table the backup or this database hasn't got is passed over.
const SEASON_COPY = [
  ["season_cast", (r, k) => r.season_id === k.season],
  ["season_episodes", (r, k) => r.season_id === k.season],
  ["season_rule_changes", (r, k) => r.season_id === k.season],
  ["season_cast_changes", (r, k) => r.season_id === k.season],
  ["rulebooks", (r, k) => r.season_id === k.season || k.leagues.has(r.league_id)],
  ["rulebook_edits", (r, k) => k.ids.has(r.rulebook_id)],
  ["episode_research", (r, k) => r.show_id === k.show && Number(r.season_number) === SEASON],
  ["episode_research_items", (r, k) => k.ids.has(r.research_id)],
  ["season_decisions", (r, k) => r.season_id === k.season],
  ["fact_sources", (r, k) => k.ids.has(r.decision_id)],
  ["fact_disputes", (r, k) => r.season_id === k.season],
  ["league_applied_decisions", (r, k) => k.leagues.has(r.league_id)],
  ["league_rulings", (r, k) => k.leagues.has(r.league_id)],
];

/** A copied row's id: made from the backup's (the same every `up`, so two runs' games read alike), never the backup's own. */
function copyId(old) {
  const h = crypto.createHash("sha1").update(`zt-sf|${old}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Every single-column foreign key (backup-common.js foreignKeys refuses a database with any other kind: season_events). */
async function singleKeys(pool) {
  const { rows } = await pool.query(
    `SELECT c.conrelid::regclass::text AS tbl, c.confrelid::regclass::text AS ref, a.attname AS col, a.attnotnull AS not_null
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_namespace ns ON ns.oid = c.connamespace
      WHERE c.contype = 'f' AND ns.nspname = 'public' AND array_length(c.conkey, 1) = 1`
  );
  const bare = (t) => t.replace(/^public\./, "").replace(/^"(.*)"$/, "$1");
  return rows.map((r) => ({ table: bare(r.tbl), column: r.col, refTable: bare(r.ref), notNull: r.not_null }));
}

/**
 * The backup's Survivor 51 as a season of its own (show zt-sf-survivor), the shadow games moved onto it with their ledgers
 * (which of the season's results each game has), so results filed on it reach only them, and the local copy of the real
 * season (and the lane's copies of the real games on it) stay as they are.
 */
async function copySeason(backup, shadows) {
  const { pool } = app();
  const realShow = backup.rows("shows").find((s) => s.slug === REAL_SLUG);
  const realSeason = realShow && backup.rows("show_seasons").find((s) => s.show_id === realShow.id && Number(s.season_number) === SEASON);
  if (!realSeason) throw new Error(`${backup.dir} hasn't got Survivor ${SEASON}`);
  const fks = await singleKeys(pool);
  const users = new Set((await qa(`SELECT id FROM "user"`)).map((r) => r.id));
  // old id -> new id: the show, the season, the shadow games (by their source), and every copied row's own id.
  const ids = new Map();
  // This database's Survivor (its current columns), as a show of its own: not the listing's (one show per TV listing).
  const showCols = (await C.columnsOf(pool, "shows")).filter((c) => !["id", "slug", "created_at", "updated_at", "tvmaze_id"].includes(c));
  const show = await q1(`INSERT INTO shows (${showCols.map(C.q).join(", ")}, slug) SELECT ${showCols.map(C.q).join(", ")}, $1 FROM shows WHERE slug = $2 RETURNING id`, [SLUG, REAL_SLUG]);
  if (!show) throw new Error(`this database has no ${REAL_SLUG} show to copy`);
  await pool.query("UPDATE shows SET art_off = true WHERE id = $1", [show.id]).catch(() => {});
  ids.set(realShow.id, show.id);
  for (const s of shadows) ids.set(s.state.settings.shadowOf, s.id);
  const local = new Set(await C.columnsOf(pool, "show_seasons"));
  const seasonRow = { ...realSeason, id: undefined, show_id: show.id, rulebook_id: null, listing_id: null, bot_research_on: false, auto_research: false };
  const seasonCols = Object.keys(seasonRow).filter((c) => local.has(c) && seasonRow[c] !== undefined && !["created_at", "updated_at"].includes(c));
  for (const fk of fks.filter((f) => f.table === "show_seasons" && f.refTable === "user")) if (seasonCols.includes(fk.column)) seasonRow[fk.column] = null;
  const season = await q1(
    `INSERT INTO show_seasons (${seasonCols.map(C.q).join(", ")}) SELECT ${seasonCols.map(C.q).join(", ")} FROM json_populate_record(NULL::show_seasons, $1::json) RETURNING id`,
    [JSON.stringify(seasonRow)]
  );
  ids.set(realSeason.id, season.id);
  const key = { season: realSeason.id, show: realShow.id, leagues: new Set(shadows.map((s) => s.state.settings.shadowOf)), ids };
  const counts = {};
  for (const [table, mine] of SEASON_COPY) {
    if (!(await C.hasTable(pool, table))) continue;
    const rows = backup.rows(table).filter((r) => mine(r, key));
    if (!rows.length) continue;
    const cols = new Set(await C.columnsOf(pool, table));
    const pk = await C.primaryKeyOf(pool, table);
    const refs = fks.filter((f) => f.table === table);
    const out = [];
    for (const r of rows) {
      const row = {};
      for (const [c, v] of Object.entries(r)) if (cols.has(c)) row[c] = v;
      // Its own id, new (a single uuid key); the old one kept for what points at it.
      if (pk.length === 1 && pk[0] === "id" && typeof row.id === "string") {
        const fresh = copyId(row.id);
        ids.set(row.id, fresh);
        row.id = fresh;
      }
      let keep = true;
      for (const f of refs) {
        const v = row[f.column];
        if (v == null) continue;
        if (ids.has(v)) row[f.column] = ids.get(v);
        else if (f.refTable === "user" && users.has(v)) row[f.column] = null;
        else if (!f.notNull) row[f.column] = null;
        else keep = false;
      }
      if (keep) out.push(row);
    }
    // A rulebook's own season or league (its owner shape is checked) and a research row's show aren't foreign keys everywhere.
    for (const row of out) {
      if (table === "episode_research" && row.show_id) row.show_id = show.id;
      for (const c of ["season_id", "league_id", "rulebook_id", "decision_id", "research_id"]) if (row[c] && ids.has(row[c])) row[c] = ids.get(row[c]);
    }
    const used = [...cols].filter((c) => out.some((r) => r[c] !== undefined));
    await pool.query(`INSERT INTO ${C.q(table)} (${used.map(C.q).join(", ")}) SELECT ${used.map(C.q).join(", ")} FROM json_populate_recordset(NULL::${C.q(table)}, $1::json)`, [JSON.stringify(out)]);
    counts[table] = out.length;
  }
  // The season's rulebook: the backup's (copied above), else this database's own Survivor 51 one copied (a backup from
  // before rulebooks).
  const realRb = realSeason.rulebook_id && ids.get(realSeason.rulebook_id);
  let rulebookId = realRb || null;
  if (!rulebookId) {
    const here = await q1("SELECT ss.rulebook_id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2", [REAL_SLUG, SEASON]);
    if (here?.rulebook_id) rulebookId = (await require("../../db/rulebooks.js").copyRulebook(pool, here.rulebook_id, { ownerKind: "season", seasonId: season.id }))?.id ?? null;
  }
  if (rulebookId) await pool.query("UPDATE show_seasons SET rulebook_id = $2 WHERE id = $1", [season.id, rulebookId]);
  return { seasonId: season.id, showId: show.id, ids, counts, rulebookId, realSeasonId: realSeason.id };
}

/** Each shadow game on the copy: its show, its castaways' links to the copy's cast, its rulebook's id. */
function onCopy(state, ids, rulebookId) {
  const s = clone(state);
  s.settings.showId = SLUG;
  for (const c of s.castaways || []) if (c.seasonCastId && ids.has(c.seasonCastId)) c.seasonCastId = ids.get(c.seasonCastId);
  const rb = s.settings.rulebook;
  if (rb && rb.id) rb.id = ids.get(rb.id) || rulebookId || rb.id;
  return s;
}

/** The desk's account (a site admin), for its Accept all, Make every game match and "When did Merged start?". */
async function deskUser() {
  const found = await q1(`SELECT * FROM "user" WHERE username = $1`, [DESK]);
  if (found) return found;
  const id = `zt-sf-${crypto.randomUUID()}`;
  await app().pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt")
     VALUES ($1, 'ZT Desk', $2, true, $3, $3, 'admin', true, now(), now())`,
    [id, `${DESK}@example.invalid`, DESK]
  );
  const { hashPassword } = await import("better-auth/crypto");
  await app().pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    crypto.randomUUID(),
    id,
    await hashPassword(P.PASSWORD),
  ]);
  await app().pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]).catch(() => {});
  return q1(`SELECT * FROM "user" WHERE id = $1`, [id]);
}

/** A game as everyone reads it at every episode (golden.js's read through viewThrough): for "did that change anything?". */
function readsOf(state) {
  const { S } = app();
  const marks = [0, ...new Set((state.episodes || []).filter((e) => S.EpisodeLogic.resultsStage(e)).map((e) => e.number)), null];
  return JSON.stringify(marks.map((m) => golden.read(S, S.GhostLogic.viewFor(clone(state), null, m))));
}

const shadowGames = async () => qa("SELECT id, name, state FROM leagues WHERE slug LIKE 'zt-shadow-%' AND deleted_at IS NULL ORDER BY group_position");

async function up(from, o = {}) {
  console.log(`(first) removed ${await down()}`);
  console.log(shadowTool(["up", `--from=${from}`, "--rules=same"]));
  const backup = readBackup(from);
  const shadows = await shadowGames();
  const copy = await copySeason(backup, shadows);
  for (const s of shadows) {
    const state = onCopy(s.state, copy.ids, copy.rulebookId);
    await app().pool.query("UPDATE leagues SET state = $2, updated_at = now() WHERE id = $1", [s.id, JSON.stringify(state)]);
  }
  // The mock players follow the copy (shadow-leagues.js seated them on this database's own Survivor 51).
  const mocks = (await qa(`SELECT id FROM "user" WHERE username LIKE 'zt_shadow_%'`)).map((r) => r.id);
  await app().pool.query("UPDATE show_follows SET season_id = $2 WHERE user_id = ANY($1::text[]) AND season_id <> $2", [mocks, copy.seasonId]);
  await deskUser();
  // --results-by: who decides the copy's results (leagues: sources that agree, as Survivor 51 has since 2026-10-29; admin:
  // the desk), else as the backup had it.
  if (o.resultsBy) await app().pool.query("UPDATE show_seasons SET results_by = $2 WHERE id = $1", [copy.seasonId, o.resultsBy]);
  // The copy is faithful when the season sync, run on it now, changes nothing: every game already has exactly the
  // season's results (its ledger mapped onto the copy's ids).
  const before = new Map((await shadowGames()).map((g) => [g.id, readsOf(g.state)]));
  await ts("lib/server/season-decisions").syncSeasonLeagues(copy.seasonId, null);
  const moved = (await shadowGames()).filter((g) => readsOf(g.state) !== before.get(g.id)).map((g) => g.name);
  if (moved.length) throw new Error(`the season sync changed ${moved.join(", ")} on the copy: its results or ledger didn't copy as they are`);
  const told = Object.entries(copy.counts).map(([t, n]) => `${t} ${n}`).join(", ");
  console.log(`up: Survivor ${SEASON} copied as ${SLUG} (${told}); ${shadows.length} shadow games on it`);
  return copy;
}

// ---------- the scenario's episodes, as research answers (pure) ----------

const hashOf = (...parts) => PT.hash01(parts.join("|"));
/** `list` in the scenario's own order for `what` (a fixed hash of seed, episode, what and each name). Pure. */
const drawn = (list, seed, n, what) => [...list].sort((a, b) => hashOf(seed, n, what, a) - hashOf(seed, n, what, b));
const SOURCES = ["https://example.com/recap", "https://example.org/episode-results"];
const IDOL = "Hidden Immunity Idol";

/** A scenario from its file (scripts/dev-test/season-forward/<name>.json, or a path): defaults filled in. */
function loadScenario(name) {
  const file = fs.existsSync(name) ? name : path.join(SCENARIOS, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`no scenario ${name} (${SCENARIOS})`);
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Number.isInteger(s.finale)) throw new Error(`${file}: "finale" (the finale's episode number) is required`);
  return { seed: path.basename(file, ".json"), default: { out: ["Voted Out"] }, episodes: {}, late: {}, after: {}, schedule: {}, ...s, file, name: path.basename(file, ".json") };
}

/**
 * One episode of the scenario, as research would answer it about whoever is still in: the full answer (the research
 * skeleton filled in), the quick check's answer, and what it did (`story`, carried into the next episode: who holds an idol,
 * the jury, the merge). Coherent the way the built-in reader checks it (only the losing tribes at Tribal, everyone votes,
 * the majority on whoever goes home, an idol's votes cancelled). Pure.
 *
 *   spec   the scenario's episode: { swap: { tribes }, merge: "<tribe name>", challenge: "tribe" | "individual",
 *          idol: { found: k, played: true }, out: ["Voted Out" | "Medically Evacuated" | "Quit"], tribal: false, finale: true }
 *   at     { n, skeleton (pasteSkeleton's), groups (name -> tribe going in), merged, seed, next: { airsAt, note } | null,
 *          airDate ("November 4, 2026"), story }
 */
function episodeAnswers(spec, at) {
  const { n, seed } = at;
  const story = clone(at.story || { holders: [], jury: [], merged: false, mergeName: null, out: [] });
  const sk = clone(at.skeleton);
  const people = sk.castaways.map((c) => c.name);
  const entry = new Map(sk.castaways.map((c) => [c.name, c]));
  const say = (name, k, v) => (entry.get(name)[k] = v);
  for (const c of sk.castaways) {
    for (const [k, v] of Object.entries(c)) if (v === "unknown") c[k] = "no";
    Object.assign(c, { sources: SOURCES, confidence: "high", newGroup: null, notableTwist: null });
  }
  let groups = new Map(people.map((p) => [p, at.groups[p] || null]));
  const changes = [];
  const lines = [];
  // The tribes this episode: swapped or merged at its start.
  if (spec.merge && !story.merged) {
    story.merged = true;
    story.mergeName = spec.merge;
    for (const p of people) {
      groups.set(p, spec.merge);
      say(p, "newGroup", spec.merge);
    }
    changes.push({ kind: "merge", when: "start", from: n, what: `The tribes merged into ${spec.merge}.`, sure: "high" });
    lines.push(`The tribes merged into ${spec.merge}.`);
  } else if (spec.swap && !story.merged) {
    const names = [...new Set(people.map((p) => groups.get(p)).filter(Boolean))].sort();
    const k = Math.max(2, Math.min(spec.swap.tribes || names.length, names.length));
    const order = drawn(people, seed, n, "swap");
    const into = names.slice(0, k);
    order.forEach((p, i) => {
      const t = into[i % k];
      if (groups.get(p) !== t) say(p, "newGroup", t);
      groups.set(p, t);
    });
    changes.push({ kind: "swap", when: "start", from: n, what: `A tribe swap: everyone drew new buffs, into ${into.join(" and ")}.`, sure: "high" });
    lines.push(`A tribe swap into ${into.join(" and ")}.`);
  }
  const merged = story.merged;
  const tribes = [...new Set(people.map((p) => groups.get(p)).filter(Boolean))].sort();
  let still = [...people];
  const left = [];
  const leave = (name, how) => {
    say(name, "leftTheGame", "yes");
    say(name, "exitMethod", how);
    still = still.filter((p) => p !== name);
    left.push({ name, how });
    if (merged && !["Medically Evacuated", "Quit"].includes(how)) story.jury.push(name);
    story.holders = story.holders.filter((h) => h !== name);
    story.out.push(name);
  };
  // Idols found this episode (by people who aren't holding one).
  for (const p of drawn(people.filter((x) => !story.holders.includes(x)), seed, n, "idol").slice(0, spec.idol?.found || 0)) {
    say(p, "foundAdvantage", "yes");
    say(p, "advantageFoundName", IDOL);
    story.holders.push(p);
    lines.push(`${p} found a hidden immunity idol.`);
  }
  /** A vote at Tribal among `room`, `safe` immune: everyone votes, the majority on who goes home; an idol played cancels the votes on its holder. */
  const tribal = (room, safe, playIdol) => {
    for (const p of room) say(p, "attendedTribal", "yes");
    const open = room.filter((p) => !safe.includes(p));
    const holder = playIdol ? story.holders.find((h) => open.includes(h)) : null;
    const pool = drawn(open.filter((p) => p !== holder), seed, n, `boot:${room.length}`);
    const boot = pool[0];
    const second = pool[1] || pool[0];
    const target = holder || boot;
    const votes = new Map(room.map((p) => [p, 0]));
    for (const v of room) {
      // Everyone on the target but the target (on the second), and one voter in four on the second.
      const on = v === target ? second : v !== second && hashOf(seed, n, "vote", v) < 0.25 ? second : target;
      const pick = on === v ? boot : on;
      say(v, "votedFor", pick);
      votes.set(pick, (votes.get(pick) || 0) + 1);
    }
    if (holder) {
      say(holder, "playedAdvantage", "yes");
      say(holder, "advantagePlayedName", IDOL);
      say(holder, "votesNullified", votes.get(holder) || 0);
      story.holders = story.holders.filter((h) => h !== holder);
      lines.push(`${holder} played an idol, cancelling ${votes.get(holder) || 0} votes.`);
    }
    // Whoever has the most counted votes goes home (the idol's cancelled): the second, after an idol; the boot otherwise.
    const counted = [...votes].filter(([p]) => p !== holder).sort((a, b) => b[1] - a[1]);
    let out = counted[0][0];
    if (safe.includes(out)) out = pool[0];
    // A second Tribal the same night (a double boot) adds its votes to the first's.
    for (const [p, k] of votes) say(p, "votesReceived", (entry.get(p).votesReceived || 0) + k);
    return out;
  };
  let tribalHeld = false;
  if (spec.finale) {
    // The finale: votes down to four, fire-making to three, then the jury.
    while (still.length > 4) {
      const winner = drawn(still, seed, n, `f-imm:${still.length}`)[0];
      say(winner, "wonIndividualImmunity", "yes");
      tribalHeld = true;
      leave(tribal(still, [winner], spec.idol?.played), "Voted Out");
    }
    if (still.length === 4) {
      const winner = drawn(still, seed, n, "f4-imm")[0];
      say(winner, "wonIndividualImmunity", "yes");
      const [a, b] = drawn(still.filter((p) => p !== winner), seed, n, "fire");
      say(a, "wonFireMaking", "yes");
      for (const p of still) say(p, "attendedTribal", "yes");
      tribalHeld = true;
      leave(b, "Lost Fire-Making");
      lines.push(`${a} beat ${b} at fire-making.`);
    }
    const [win, ...rest] = drawn(still, seed, n, "jury");
    const jury = story.jury.length || 7;
    const votes = [jury - Math.floor(jury / 3), ...rest.map((_, i) => (i === 0 ? Math.floor(jury / 3) : 0))];
    for (const [i, p] of [win, ...rest].entries()) say(p, "juryVotesReceived", votes[i]);
    for (const p of rest) leave(p, "Lost Final Tribal (Jury Vote)");
    say(win, "leftTheGame", "yes");
    say(win, "exitMethod", "Sole Survivor");
    left.push({ name: win, how: "Sole Survivor" });
    lines.push(`${win} won ${votes[0]}-${votes.slice(1).join("-")}.`);
  } else {
    const outs = spec.out || [];
    const challenge = spec.challenge || (merged ? "individual" : "tribe");
    // No vote: someone leaves without one (a medevac, a quit), and with tribal: false nobody else goes.
    for (const how of outs.filter((h) => h !== "Voted Out")) {
      const who = drawn(still, seed, n, `leave:${how}`)[0];
      if (who) leave(who, how);
    }
    const votesOut = spec.tribal === false ? 0 : outs.filter((h) => h === "Voted Out").length;
    if (challenge === "individual") {
      for (let i = 0; i < votesOut; i++) {
        const winner = drawn(still, seed, n, `imm:${i}`)[0];
        say(winner, "wonIndividualImmunity", "yes");
        if (i === 0) {
          const reward = drawn(still, seed, n, "reward")[0];
          say(reward, "wonIndividualReward", "yes");
        }
        tribalHeld = true;
        leave(tribal(still, [winner], spec.idol?.played && i === 0), "Voted Out");
      }
    } else if (votesOut) {
      // The losing tribes go to Tribal (two votes: two tribes, or the same one twice when there are only two).
      const losers = drawn(tribes, seed, n, "losers").slice(0, Math.min(votesOut, Math.max(1, tribes.length - 1)));
      const winners = tribes.filter((t) => !losers.includes(t));
      for (const p of still) if (winners.includes(groups.get(p))) {
        say(p, "wonTribeImmunity", "yes");
        say(p, "wonTribeReward", "yes");
      }
      for (let i = 0; i < votesOut; i++) {
        const t = losers[i % losers.length];
        tribalHeld = true;
        leave(tribal(still.filter((p) => groups.get(p) === t), [], spec.idol?.played && i === 0), "Voted Out");
      }
    }
    if (!left.length) lines.push("Nobody went home.");
  }
  for (const l of left) if (l.how !== "Sole Survivor") lines.push(`${l.name}: ${l.how}.`);
  const after = still.filter((p) => !left.some((l) => l.name === p));
  const named = [...new Set(after.map((p) => groups.get(p)).filter(Boolean))].sort();
  sk.episodeTitle = `Episode ${n}`;
  sk.airDate = at.airDate || null;
  sk.summary = lines.join(" ");
  sk.tribalCouncilHeld = tribalHeld ? "yes" : "no";
  sk.merged = merged ? "yes" : "no";
  sk.nextEpisode = at.next ? { airsAt: at.next.airsAt, minutes: at.next.minutes ?? null, note: at.next.note ?? null } : { airsAt: null, minutes: null, note: null };
  // The pages read, published after the episode ended (the bot checks an answer isn't from before it aired).
  sk.sourcesRead = SOURCES.map((url) => ({ url, published: at.publishedAt || null, updated: null }));
  if (sk.formatState) {
    sk.formatState = {
      playedAs: spec.finale || merged ? "individuals" : "tribes",
      phase: merged ? "merged" : "pre-merge",
      groups: named.map((g) => ({ name: g, members: after.filter((p) => groups.get(p) === g) })),
      alone: [],
      newcomers: [],
      wentHomeAs: left.length ? "individuals" : "nobody",
      changes,
    };
  }
  const quick = { found: true, episodeTitle: sk.episodeTitle, left: left.map((l) => ({ name: l.name, how: l.how })), headline: lines[0] || "Nobody went home.", sources: SOURCES };
  return { full: JSON.stringify(sk), quick: JSON.stringify(quick), left, lines, story };
}

// ---------- play ----------

// Each mock player's habits: whoever runs the first game is the Tinkerer, the rest the archetypes in turn (playtest.js ROLES).
const ROLE_ORDER = ["tinkerer", "forgetter", "driveby", "fan", "steady", "reader", "contrarian"];

/** Math.random as a fixed sequence from `key` (mulberry32), so two runs choose alike among equals. */
function seedRandom(key) {
  let a = Math.floor(PT.hash01(key) * 4294967296) >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seasonRow = async () => q1("SELECT ss.* FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2", [SLUG, SEASON]);
/** The copy's schedule as the app has it now: number -> { airAt, runtimeMin }. */
async function scheduleNow(seasonId) {
  const sched = (await ts("lib/server/schedule").seasonSchedules([seasonId], new Date())).get(seasonId);
  return new Map((sched?.episodes ?? []).map((e) => [e.number, e]));
}

/** The games and their seats, as playtest.js's moves() and waivers() take them (r). */
async function seatsOf() {
  const games = await shadowGames();
  const mocks = await qa(`SELECT * FROM "user" WHERE username LIKE 'zt_shadow_%' ORDER BY username`);
  const members = await qa("SELECT league_id, user_id, player_id, role FROM league_memberships WHERE league_id = ANY($1::uuid[])", [games.map((g) => g.id)]);
  const lead = members.find((m) => m.league_id === games[0].id && m.role === "commissioner")?.user_id ?? mocks[0].id;
  const order = [mocks.find((u) => u.id === lead), ...mocks.filter((u) => u.id !== lead)].filter(Boolean);
  const users = Object.fromEntries(mocks.map((u) => [u.username, u]));
  const couch = (await q1("SELECT couch_id FROM leagues WHERE id = $1", [games[0].id])).couch_id;
  const seasonId = (await seasonRow()).id;
  return games.map((g, i) => {
    const seats = order
      .map((u, k) => ({ u, role: ROLE_ORDER[k % ROLE_ORDER.length], m: members.find((m) => m.league_id === g.id && m.user_id === u.id) }))
      .filter((x) => x.m)
      .map((x) => ({ role: x.role, label: PT.ROLES[x.role].name, username: x.u.username, playerIds: { [i]: x.m.player_id }, commissioner: x.m.role === "commissioner" }));
    // The one who runs it first (waivers' Backstage scope is the first seat's).
    seats.sort((a, b) => Number(b.commissioner) - Number(a.commissioner));
    return { n: i, leagueId: g.id, source: g.state.settings.shadowOf, kind: g.state.settings.leagueTypeId, name: g.name, seats, users, seasonId, couchId: couch, problems: [], log: [] };
  });
}

/** The latest episode any shadow game has results for. */
const playedThrough = (games) => Math.max(0, ...games.map((g) => app().S.SpoilerLogic.latestWithResults(g.state)));

/** Waiver claims for the week that's open, by habit (playtest.js waivers' claims, without its Run now: the clock runs it). */
async function claims(r) {
  const { S, Bots, Waivers, withLeagueLock } = app();
  const s = await P.stateOf(r.leagueId);
  const period = S.WaiverLogic.current(s);
  if (!period || period.phase !== "open") return [];
  const out = [];
  for (const seat of r.seats) {
    const pid = P.pidOf(r, seat);
    const habit = PT.ROLES[seat.role].waivers;
    if (!pid || habit === "none" || S.KnockoutLogic.isOut(s, pid)) continue;
    const owed = S.WaiverLogic.replacementsOwed(s, pid, period);
    const pairs = Bots.waiverClaim(s, pid, period).pairs.filter((p) => habit === "claim" || owed.outIds.includes(p.dropId));
    if (!pairs.length) continue;
    try {
      await withLeagueLock(r.leagueId, async (st, client) => {
        const res = await Waivers.saveClaim(client, r.leagueId, st, pid, { pairs }, r.users[seat.username].id);
        if (res.error) throw new Error(res.error);
      });
      out.push(`${seat.label}: ${pairs.map((p) => `${P.castName(s, p.addId)} for ${P.castName(s, p.dropId)}`).join("; ")}`);
    } catch (e) {
      r.problems.push({ episode: period.episode, seat: seat.label, kind: "claim", offered: true, error: e.message });
    }
  }
  return out;
}

/** The hourly job's waivers, now (db/waivers.js runWaivers, on the shadow games only). */
async function waiverClock(games) {
  const { runWaivers } = require("../../db/waivers.js");
  return runWaivers(app().pool, { now: Date.now(), leagueIds: games.map((r) => r.leagueId), log: () => {} });
}

/** Finale predictions (a draft's: Outlast's), by habit, through the question sheet's own write (answers.ts answerQuestions). */
async function predictions(r, n) {
  const { S, Bots } = app();
  const s = await P.stateOf(r.leagueId);
  if (!S.finalePredictionsAvailable(s)) return [];
  const { answerQuestions } = ts("lib/server/answers");
  const out = [];
  for (const seat of r.seats) {
    const pid = P.pidOf(r, seat);
    if (!pid || (seat.role === "forgetter" && !PT.movesThisWeek(seat, n))) continue;
    if ((s.finalePredictions || {})[pid]?.winner && seat.role !== "tinkerer") continue;
    const still = s.castaways.filter((c) => c.status === "active").map((c) => c.id);
    const order = PT.prefer(seat, still, { ratings: Bots.ratings(s, { read: 1, gut: 0.4 }), key: "value", listOrder: s.castaways.map((c) => c.id), names: Object.fromEntries(s.castaways.map((c) => [c.id, c.name])) });
    const answers = { top3: order.slice(0, 3), winner: order[0] };
    try {
      await answerQuestions(r.users[seat.username], r.seasonId, r.leagueId, { answers });
      out.push(`${seat.label}: ${P.castName(s, order[0])} to win`);
    } catch (e) {
      r.problems.push({ episode: n, seat: seat.label, kind: "finale predictions", offered: true, error: e.message });
    }
  }
  return out;
}

/**
 * A seat's move right at the lock: `before` (minutes before the episode starts: the app must take it) or after it (it must
 * refuse, and say it was locked: Tonight offers nothing then). Weekly Lineup: one starter swapped for the bench; the pool: the
 * next one by its habit. Returns what happened.
 */
async function lateMove(r, n, label, after) {
  const { S, withLeagueLock } = app();
  const seat = r.seats.find((x) => x.role === label) || null;
  const s = await P.stateOf(r.leagueId);
  const ep = s.episodes.find((e) => e.number === n);
  if (!seat || !ep) return null;
  const pid = P.pidOf(r, seat);
  const type = S.getLeagueType(s);
  let offered = false;
  let write = null;
  if (type.hasActiveRoster) {
    const team = s.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(pid)).map((c) => c.id);
    const now = S.ActiveRosterLogic.lineupFor(s, ep.id, pid) || [];
    const slots = S.ActiveRosterLogic.activeSlots(s);
    const bench = team.filter((id) => !now.includes(id));
    if (!bench.length || !now.length) return { seat: seat.label, what: "nothing on the bench to swap in" };
    const want = [...now.slice(1), bench[0]].slice(0, slots);
    offered = !S.ActiveRosterLogic.isLineupLocked(s, ep.id);
    write = (st) => {
      const problem = S.ActiveRosterLogic.validateLineup(st, ep.id, pid, want);
      if (problem) throw new Error(problem);
      S.setActiveRosterLineup(st, ep.id, pid, want);
    };
  } else if (type.hasWeeklyPicks) {
    const { available } = S.PickEmLogic.eligibility(s, ep.id, pid);
    const mine = S.PickEmLogic.pickFor(s, ep.id, pid);
    const pick = available.find((id) => id !== mine?.castawayId);
    if (!pick) return { seat: seat.label, what: "nobody else to pick" };
    offered = !S.PickEmLogic.isLocked?.(s, ep.id) && !(ep.airsAt && Date.now() >= Date.parse(ep.airsAt));
    write = (st) => S.setPickEmPick(st, ep.id, pid, pick);
  } else return null;
  let error = null;
  try {
    await withLeagueLock(r.leagueId, write);
  } catch (e) {
    error = e.message;
  }
  // A pool's setPick says nothing when it won't (a locked pick stays as it was): read what it kept.
  const s2 = await P.stateOf(r.leagueId);
  const mine = (st) => JSON.stringify(type.hasWeeklyPicks ? (S.PickEmLogic.pickFor(st, ep.id, pid)?.castawayId ?? null) : (S.ActiveRosterLogic.lineupFor(st, ep.id, pid) || []));
  const took = mine(s2) !== mine(s);
  const right = after ? !took && !offered : took && offered;
  return { seat: seat.label, after, offered, took, error, right };
}

/** What the desk does when results wait: its episode page, then Accept all of what it showed (desk-episode.ts). */
async function deskAccept(desk, seasonId, n) {
  const D = ts("lib/server/desk-episode");
  const page = await D.deskEpisode(desk, seasonId, n, new Date());
  const seen = page.facts.filter((f) => f.state === "wait").map((f) => f.id);
  const unknown = page.facts.filter((f) => f.state === "wait" && f.unknown).map((f) => f.name);
  const disputed = page.facts.filter((f) => f.state === "disputed").map((f) => `${f.name}: ${f.label}`);
  if (!seen.length) return { accepted: 0, unknown, disputed };
  const r = await D.acceptAll(desk, seasonId, n, seen).catch((e) => ({ accepted: 0, error: e.message }));
  return { accepted: r.accepted, error: r.error, unknown, disputed };
}

/**
 * A quick check the bot held (it said nobody went home, or named someone it wasn't sure of): whoever runs the first game
 * confirms it in Backstage › Results, as playtest.js acceptHeld does: It's right, with the names it matched (or nobody).
 */
async function confirmHeld(r, n) {
  const { backstage } = app();
  const lead = r.seats[0];
  const scope = await backstage.scope(r.users[lead.username], r.seasonId, r.couchId);
  const seen = await backstage.read(scope, { episode: n, show: true });
  const ep = seen.episode;
  if (!ep || ep.number !== n || !ep.wait || !seen.shown?.wait) return `Backstage offered ${ep ? `Episode ${ep.number}${ep.wait ? "" : " with nothing held"}` : "nothing"}`;
  const names = seen.shown.wait;
  const items = names.length ? names.filter((o) => o.matched).map((o) => ({ castawayName: o.name, method: o.method })) : [{ nobody: true }];
  await backstage.apply(scope, n, items, { quick: true, wait: { id: ep.wait.id, right: true } });
  return `${lead.label} confirmed it in Backstage (It's right: ${items.map((i) => (i.nobody ? "nobody went home" : `${i.castawayName}, ${i.method}`)).join("; ")})`;
}

/** Each seat reveals the episode once its final results are in (the new design's reveal); the Forgetter only on a week it moves. */
async function reveals(games, n) {
  const { revealSeason } = ts("lib/server/season-episodes");
  const done = new Set();
  for (const r of games) {
    for (const seat of r.seats) {
      if (done.has(seat.username) || (seat.role === "forgetter" && !PT.movesThisWeek(seat, n + 1))) continue;
      done.add(seat.username);
      await revealSeason(r.users[seat.username], r.seasonId, r.couchId, n).catch(() => {});
    }
  }
  return done.size;
}

/** The bot's own run for one episode (db/bot-research.js runJob, as its schedule runs it), answering from the scenario. */
async function botRun(seasonId, n, kind, answers) {
  const { BotResearch, botSend, pool } = app();
  const { kindOf } = require("./fake-bot");
  const job = await BotResearch.loadSeasonForJob(pool, seasonId);
  const asked = [];
  const ask = async (prompt) => {
    const k = kindOf(prompt);
    asked.push(k);
    return { answer: k === "quick" ? answers.quick : k === "full" ? answers.full : "{}", seconds: 0 };
  };
  const res = await BotResearch.runJob(pool, { season: job, episode: n, kind }, { ask, send: botSend });
  return { ok: res.ok, message: res.message, asked };
}

/** The season's phase that starts at the merge, by the rulebook's own blocks (null when it has none). */
async function mergePhase(seasonId) {
  const { seasonBlocks, phasesOf } = ts("lib/server/phase-starts");
  const book = await seasonBlocks(seasonId);
  const phases = phasesOf(book.blocks, book.phaseStarts);
  return { phase: phases.find((p) => /merge/i.test(`${p.id} ${p.name}`)) || null, rulebookId: book.rulebookId ?? book.id ?? null, book };
}

/** "When did Merged start?" answered on the desk (desk-rulebooks.ts writePhase: every game on the season settles from it). */
async function confirmMerge(desk, seasonId, n) {
  const { phase, book } = await mergePhase(seasonId);
  if (!phase) return "the rulebook has no merge phase";
  const season = await seasonRow();
  const rb = await require("../../db/rulebooks.js").getRulebook(app().pool, season.rulebook_id);
  if (!rb) return `no rulebook (${JSON.stringify(Object.keys(book || {}))})`;
  await ts("lib/server/desk-rulebooks").writePhase(desk.id, rb, phase.id, n);
  return `${phase.name} started with Episode ${n}`;
}

/** Every shadow game's state now, keyed by its source (stable across runs; the shadow's own id is new every `up`). */
async function keep(run, n, stage) {
  const games = await shadowGames();
  (run.kept[n] ||= {})[stage] = { at: new Date().toISOString(), games: Object.fromEntries(games.map((g) => [g.state.settings.shadowOf, g.state])) };
}

async function play(scenarioName, o = {}) {
  const sc = loadScenario(scenarioName);
  const season = await seasonRow();
  if (!season) throw new Error("no season copy: `up --from=<backup>` first");
  const desk = await deskUser();
  const games = await seatsOf();
  const start = playedThrough(await shadowGames()) + 1;
  const through = Math.min(sc.finale, Number(o.through) || sc.finale);
  const out = o.out || path.join(ROOT, ".session-loop", "season-forward", `${sc.name}-${o.label || "run"}`);
  fs.mkdirSync(out, { recursive: true });
  const runFile = path.join(out, "run.json");
  // Carrying on a run (--through stopped it): only one whose last kept episode is the one before this.
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, "utf8")) : null;
  const carry = run && run.scenario === sc.name && Math.max(0, ...Object.keys(run.kept).map(Number)) === start - 1;
  const rec = carry ? run : { scenario: sc.name, from: start, flag: o.flag ?? null, kept: {}, episodes: {}, story: null, games: games.map((r) => ({ source: r.source, kind: r.kind, seats: r.seats.map((s) => ({ label: s.label, playerId: P.pidOf(r, s) })) })) };
  // The season's length, as the desk sets it (finale predictions close when its last episode starts).
  await app().pool.query("UPDATE show_seasons SET episode_count = $2 WHERE id = $1", [season.id, sc.finale]);
  const Research = require("../../db/episode-research.js");
  const Final = require("../../src/lib/game/final-results.js");
  const Air = require("../../src/lib/game/air-schedule.js");
  console.log(`play: ${sc.name} from Episode ${start} to ${through} (finale ${sc.finale})${o.flag ? `, the game-specs flag ${o.flag}` : ""}`);
  for (let n = start; n <= through; n++) {
    const spec = sc.episodes[n] || (n === sc.finale ? { finale: true } : sc.default);
    const ep = (rec.episodes[n] = { spec, moves: {}, late: [], results: {}, notes: [] });
    const sched = await scheduleNow(season.id);
    const airAt = sched.get(n)?.airAt;
    if (!airAt) throw new Error(`Episode ${n} has no air time in the copy's schedule`);
    const air = Date.parse(airAt);
    const end = air + (sched.get(n)?.runtimeMin || 60) * 60_000;
    ep.airAt = airAt;
    // 1. The week before: waivers' claims, then everyone's moves by habit, two days out; finale predictions the week before
    // the finale and on its night.
    Clock.set(air - 2 * DAY);
    seedRandom(`${sc.seed}|${n}|moves`);
    await waiverClock(games);
    for (const r of games) {
      const claimed = await claims(r);
      const week = await P.moves(r, n);
      const said = n >= sc.finale - 1 ? await predictions(r, n) : [];
      ep.moves[r.kind] = { claims: claimed, moves: week, predictions: said };
    }
    // 2. A move right at the lock (the scenario's `late`: the Drive-By, by default): five minutes before (taken), five after
    // (refused, and not offered).
    const late = sc.late[n];
    if (late) {
      for (const [mins, after] of [[-5, false], [5, true]]) {
        Clock.set(air + mins * 60_000);
        for (const r of games) {
          const did = await lateMove(r, n, late, after);
          if (did) ep.late.push({ game: r.kind, minutes: mins, ...did });
        }
      }
    }
    Clock.set(air - HOUR);
    await waiverClock(games);
    Clock.set(air + 5 * 60_000);
    await waiverClock(games);
    // 3. Results: the scenario's episode as research answers it, from who's still in by the copy's own research context.
    const ctx = await Research.resolveSeasonResearchContext(app().pool, SLUG, SEASON, n);
    const next = sched.get(n + 1)?.airAt ? { airsAt: nextAt(sc, n, sched, season.air_tz, Air) } : null;
    const answers = episodeAnswers(spec, {
      n,
      seed: sc.seed,
      skeleton: Research.pasteSkeleton(ctx, []),
      groups: ctx.castGroups || {},
      story: rec.story,
      next,
      publishedAt: new Date(end + 2 * HOUR).toISOString(),
      airDate: new Date(air).toLocaleDateString("en-US", { timeZone: season.air_tz || "America/New_York", month: "long", day: "numeric", year: "numeric" }),
    });
    rec.story = answers.story;
    ep.happened = answers.lines;
    // Early: the bot's quick check at the episode's end, accepted on the desk.
    Clock.set(end + 10 * 60_000);
    seedRandom(`${sc.seed}|${n}|early`);
    ep.results.quick = await botRun(season.id, n, "quick", answers);
    // Held for a person (a night nobody went home): the first game's commissioner says It's right in Backstage.
    if (!ep.results.quick.ok && /Not sure yet/.test(ep.results.quick.message)) {
      ep.results.held = await confirmHeld(games[0], n).catch((e) => `Backstage refused: ${e.message}`);
      ep.results.quick.ok = /confirmed/.test(ep.results.held);
    }
    ep.results.quickDesk = await deskAccept(desk, season.id, n);
    if (spec.merge) ep.results.phase = await confirmMerge(desk, season.id, n);
    await keep(rec, n, "early");
    // Final: the bot's full research twelve hours on, accepted; then the final results' time passes.
    Clock.set(air + 13 * HOUR);
    seedRandom(`${sc.seed}|${n}|final`);
    ep.results.full = await botRun(season.id, n, "full", answers);
    ep.results.fullDesk = await deskAccept(desk, season.id, n);
    Clock.set(Date.parse(Final.finalResultsAt(airAt, season.air_tz)) + HOUR);
    await waiverClock(games);
    if ((o.look || []).includes(n)) {
      ep.look = await lookAt(n, games[0], { shots: o.shots || path.join(ROOT, ".session-loop", "screens", "season-forward", path.basename(out)), width: o.width });
      console.log(`  look at Episode ${n}: ${ep.look.pages.map((x) => `${x.name}${x.missing ? ` MISSING (${x.missing})` : ""}${x.wide ? ` (${x.wide}px too wide)` : ""}`).join(", ")}${ep.look.errors.length ? ` | page errors: ${ep.look.errors.join(" | ")}` : ""}`);
    }
    ep.revealed = await reveals(games, n);
    for (const step of sc.after[n] || []) ep.notes.push(await afterStep(step, { n, season, desk, games, sc }));
    // After a correction: the episode's page, Tonight and Backstage again ("after-" shots).
    if ((o.look || []).includes(n) && (sc.after[n] || []).length) {
      const again = await lookAt(n, games[0], { shots: o.shots || path.join(ROOT, ".session-loop", "screens", "season-forward", path.basename(out)), width: o.width, only: ["tonight-after", "episode", "backstage"], prefix: "after-" });
      ep.look.pages.push(...again.pages.map((x) => ({ ...x, name: `after-${x.name}` })));
      console.log(`  look after its corrections: ${again.pages.map((x) => `${x.name}${x.missing ? ` MISSING (${x.missing})` : ""}`).join(", ")}`);
    }
    await keep(rec, n, "final");
    for (const r of games) for (const p of r.problems.splice(0)) (ep.problems ||= []).push({ game: r.kind, ...p });
    const line = `Episode ${n}: ${answers.lines.join(" ")}${ep.results.held ? ` | held: ${ep.results.held}` : ""}${ep.notes.length ? ` | after: ${ep.notes.join("; ")}` : ""} | early ${ep.results.quick.ok ? "ok" : `FAILED ${ep.results.quick.message}`} (${ep.results.quickDesk.accepted} accepted), final ${ep.results.full.ok ? "ok" : `FAILED ${ep.results.full.message}`} (${ep.results.fullDesk.accepted} accepted)${ep.late.length ? `, late moves ${ep.late.map((l) => (l.right ? "right" : "WRONG")).join("/")}` : ""}${ep.problems?.length ? `, ${ep.problems.length} refused` : ""}`;
    console.log(line);
    fs.writeFileSync(runFile, JSON.stringify(rec));
  }
  Clock.reset();
  rec.invariants = invariants(rec, sc);
  fs.writeFileSync(runFile, JSON.stringify(rec));
  for (const i of rec.invariants) console.log(`${i.ok ? "ok  " : "FAIL"} ${i.what}${i.ok ? "" : `: ${i.why.slice(0, 6).join("; ")}`}`);
  console.log(`kept in ${out}`);
  return { out, rec };
}

/** The next episode's start as research gives it: the copy's schedule (a week off: two weeks on), in the season's zone. */
function nextAt(sc, n, sched, tz, Air) {
  const at = sched.get(n + 1)?.airAt;
  if (!at) return null;
  const off = (sc.schedule.off || []).includes(n + 1);
  const zone = tz || "America/New_York";
  const date = Air.localDate(new Date(at), zone);
  const time = new Date(at).toLocaleTimeString("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
  const when = Air.zonedToUtc(off ? Air.addDays(date, 7) : date, time, zone);
  // The offset research writes: the right one for that night, or (the scenario's `wrongOffset`) the one two weeks before, as
  // research once wrote October's for a November night (3b42dca0): "2026-11-11T20:00:00-04:00" for 8 PM EST.
  if (!(sc.schedule.wrongOffset || []).includes(n + 1)) return new Date(when).toISOString();
  const was = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(new Date(Date.parse(when) - 14 * DAY)).find((x) => x.type === "timeZoneName").value;
  return `${off ? Air.addDays(date, 7) : date}T${time}:00${was.replace("GMT", "") || "+00:00"}`;
}

/** The season's accepted results for episode n, as the desk lists them: { id, kind, name, method, eventType }. */
const resultsOf = async (seasonId, n) =>
  (await qa("SELECT id, kind, castaway_name AS name, COALESCE(applied->>'method', method) AS method, COALESCE(applied->>'eventType', event_type) AS \"eventType\" FROM season_decisions WHERE season_id = $1 AND episode_number = $2 AND status = 'accepted' ORDER BY kind, created_at, id", [seasonId, n]));

/**
 * What the scenario does after an episode's results (`after`), each step as the app does it, saying what it did:
 *   { do: "flag", event: "<id pattern>", desk: "no" | "yes" }  a player flags a result (didn't happen) and the desk
 *        decides it: "no" takes it out of every game, "yes" keeps it (community-results.ts flagResult, desk-facts.ts decideFact)
 *   { do: "correct", exit: "<way out>" }  the desk corrects how the episode's first boot left (decideFact's edit)
 *   { do: "own", event: "<id pattern>" }  one game gets a result of its own the season hasn't (as classic's commissioner
 *        entered one: the first game, the first castaway still in), then the desk's Make every game match takes it out
 *        (desk-episode.ts gamesApart, matchGames)
 */
async function afterStep(step, { n, season, desk, games }) {
  const F = ts("lib/server/desk-facts");
  const facts = await resultsOf(season.id, n);
  if (step.do === "flag") {
    const fact = facts.find((f) => f.kind === "event" && new RegExp(step.event || ".", "i").test(f.eventType));
    if (!fact) return `flag: no ${step.event} result in Episode ${n}`;
    const r = games[0];
    const seat = r.seats[0];
    const { flagResult } = ts("lib/server/community-results");
    const flagged = await flagResult(r.users[seat.username], season.id, r.couchId, { episode: n, decisionId: fact.id, reason: "didnt-happen" });
    const page = await ts("lib/server/desk-episode").deskEpisode(desk, season.id, n, new Date());
    const shown = page.facts.find((f) => f.id === fact.id)?.state ?? "gone";
    await F.decideFact(desk, fact.id, { decide: step.desk || "no" });
    const after = (await resultsOf(season.id, n)).some((f) => f.id === fact.id);
    return `flag: ${seat.label} flagged ${fact.name}'s ${fact.eventType} (${flagged.status ?? "no status"}, the desk showed it ${shown}); the desk decided "${step.desk || "no"}": ${after ? "kept" : "out of every game"}`;
  }
  if (step.do === "correct") {
    const boot = facts.find((f) => f.kind === "elimination");
    if (!boot) return `correct: nobody went home in Episode ${n}`;
    // Where everyone finished, in every game, before and after: a correction of how one left moves nobody else.
    const places = async () => new Map((await shadowGames()).flatMap((g) => g.state.castaways.filter((c) => typeof c.placementOrder === "number").map((c) => [`${g.state.settings.leagueTypeId}|${c.name}`, c.placementOrder])));
    const was = await places();
    await F.decideFact(desk, boot.id, { edit: { method: step.exit } });
    const now = (await resultsOf(season.id, n)).find((f) => f.id === boot.id);
    const moved = [...(await places())].filter(([k, v]) => was.has(k) && was.get(k) !== v).map(([k, v]) => `${k.replace("|", ": ")} ${was.get(k)} → ${v}`);
    return `correct: ${boot.name} ${boot.method} → ${now?.method} (the desk's correction)${moved.length ? `; PLACES MOVED (placementOrder): ${moved.join(", ")}` : ""}`;
  }
  if (step.do === "own") {
    const { S, withLeagueLock } = app();
    const D = ts("lib/server/desk-episode");
    const r = games.find((g) => g.kind === "active-roster") || games[0];
    let what = null;
    await withLeagueLock(r.leagueId, (st) => {
      const ep = st.episodes.find((e) => e.number === n);
      const c = st.castaways.find((x) => x.status === "active");
      const type = S.formatOf(st).events.find((e) => new RegExp(step.event || "reward", "i").test(e.id))?.id;
      if (!ep || !c || !type) return;
      S.ActiveRosterLogic.addEvent(st, ep.id, type, c.id, 1);
      what = `${c.name} ${type}`;
    });
    const { gamesApart } = ts("lib/server/season-decisions");
    const apart = await gamesApart(season.id, n);
    const matched = apart.length ? await D.matchGames(desk, season.id, n).catch((e) => ({ text: `refused: ${e.message}` })) : null;
    const still = await gamesApart(season.id, n);
    return `own: ${r.kind} given ${what ?? "nothing"} of its own; ${apart.length} game(s) apart, Make every game match: ${matched?.text ?? "not offered"}; ${still.length} apart after`;
  }
  return `unknown step ${JSON.stringify(step)}`;
}

// ---------- look: the screens at an episode ----------

// The dev server for `--look` carries the run's clock: start it from this folder with
//   NODE_OPTIONS="--require <this folder>/scripts/dev-test/sim-clock.js" SIM_CLOCK_FILE=<this folder>/.session-loop/season-forward/clock.txt npm run dev -- -p <the lane's port>
// and play writes the scenario's moment to that file before each look (the browser's clock is set to it too).
const CLOCK_FILE = path.join(ROOT, ".session-loop", "season-forward", "clock.txt");
const LOOK_PAGES = (sid, n) => [
  ["tonight", `/show/${sid}/tonight`, `[data-results-in='${n}']`],
  ["reveal", null, null],
  ["tonight-after", `/show/${sid}/tonight`, "[data-tab=tonight]"],
  ["games", `/show/${sid}/games`, "[data-table]"],
  ["moves", null, null],
  ["episode", `/show/${sid}/episodes?page=ep${n}`, "[data-episode-page]"],
  ["backstage", `/show/${sid}/backstage`, "body"],
  ["how-it-works", `/show/${sid}/games?page=how-it-works`, "[data-how]"],
];

/**
 * Episode n's screens as `seat` sees them (the Tinkerer: they run the games, so Backstage too), after its final results and
 * before they reveal it: Tonight with the results in, the reveal, Tonight after it, Your moves for the next episode, the Games
 * tab, the episode's page, Backstage, How it works. Each a screenshot and its text (`<name>.txt`, for flag off against on), with
 * page errors and anything too wide. Needs the dev server on the run's clock (above).
 */
async function lookAt(n, r, o) {
  const { open, BASE } = require("./browser");
  const width = Number(o.width || 390);
  const dir = path.join(o.shots, `ep${n}`);
  fs.mkdirSync(dir, { recursive: true });
  Clock.share(CLOCK_FILE, Date.now());
  await new Promise((done) => setTimeout(done, 1500));
  const seat = r.seats[0];
  const b = await open({ user: seat.username, pass: P.PASSWORD, width });
  await b.page.clock.install({ time: new Date(Date.now()) });
  const found = [];
  const page = b.page;
  const save = async (name, fullPage) => {
    // Settled: its data in (no request for a moment), fonts loaded.
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(1200);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: path.join(dir, `${o.prefix || ""}${name}-${width}.png`), fullPage });
    // The words on screen: an open dialog's (the reveal, a sheet), else the page's. Never a closed one: the reveal, a pushed
    // page and "Waivers ran" stay mounted, hidden (aria-hidden, invisible), and read as nothing.
    const text = await page.evaluate(() => {
      const open = [...document.querySelectorAll("[role=dialog]")].find((d) => d.getAttribute("aria-hidden") !== "true" && getComputedStyle(d).visibility !== "hidden");
      return (open || document.querySelector("main") || document.body).innerText;
    });
    fs.writeFileSync(path.join(dir, `${o.prefix || ""}${name}.txt`), text);
    found.push({ name, wide: wide > 1 ? wide : 0 });
  };
  try {
    for (const [name, url, sel] of LOOK_PAGES(r.seasonId, n).filter(([x]) => !o.only || o.only.includes(x))) {
      try {
        if (name === "reveal") {
          const btn = page.locator(`[data-results-in='${n}']`).getByRole("button", { name: new RegExp(`Reveal Episode ${n}`) });
          if (!(await btn.first().waitFor({ timeout: 20000 }).then(() => true, () => false))) {
            found.push({ name, missing: "no Reveal button" });
            continue;
          }
          await btn.first().click();
          await page.waitForURL(/\?page=reveal/, { timeout: 15000 });
          // Its beats, tapped through as check-new-reveal.js plays them, each shot; the last is the table.
          const reveal = page.locator("[role=dialog][aria-label='The reveal']");
          await reveal.locator("[data-beat]").first().waitFor({ timeout: 20000 });
          const beats = [];
          for (let k = 0; k < 12; k++) {
            await page.waitForTimeout(1100);
            const beat = await reveal.locator("[data-beat]").getAttribute("data-beat").catch(() => null);
            beats.push(beat);
            await save(`reveal-${k}-${beat}`, false);
            const back = reveal.getByRole("button", { name: /^Back to / });
            if ((await back.count()) && (await back.isVisible())) break;
            await reveal.locator("[data-stage]").click();
          }
          found.push({ name, beats: beats.join(" > ") });
          continue;
        }
        if (name === "moves") {
          // On Games (the look before), a game's card under its name (since 2026-10-31; your-move.ts), else the dock's button
          // where a move's due.
          await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
          const dock = page.locator("[data-your-move]").first().or(page.locator("button.nd-dock", { hasText: /Locks |Due / }).last());
          if (!(await dock.first().waitFor({ timeout: 20000 }).then(() => true, () => false))) {
            found.push({ name, missing: "no card or dock" });
            continue;
          }
          // It opens Your moves (a sheet), or the page its first move is on (a waiver to make: the waivers page).
          const from = page.url();
          await dock.first().click();
          const opened = await Promise.race([
            page.locator("[data-sheet-handle]").first().waitFor({ timeout: 15000 }).then(() => "sheet"),
            page.waitForURL((u) => u.toString() !== from, { timeout: 15000 }).then(() => "page"),
          ]).catch(() => null);
          if (!opened) {
            found.push({ name, missing: "the dock opened nothing" });
            continue;
          }
          await save(opened === "sheet" ? name : `${name}-page`, false);
          await page.keyboard.press("Escape").catch(() => {});
          continue;
        }
        await page.goto(`${BASE}${url}`, { waitUntil: "load" });
        const ok = await page.locator(sel).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
        if (!ok) {
          found.push({ name, missing: sel });
          continue;
        }
        await save(name, !url.includes("?page="));
      } catch (e) {
        found.push({ name, missing: e.message.split("\n")[0] });
      }
    }
  } finally {
    await b.close();
    Clock.share(CLOCK_FILE, null);
  }
  return { dir, pages: found, errors: [...new Set(b.errors)].slice(0, 10) };
}

// ---------- the invariants (pure, on a run's kept states) ----------

function invariants(rec, sc) {
  const S = app().S;
  const out = [];
  const add = (what, why) => out.push({ what, ok: !why.length, why });
  const eps = Object.keys(rec.kept).map(Number).sort((a, b) => a - b);
  const last = eps[eps.length - 1];
  const finalOf = (n) => rec.kept[n]?.final?.games || {};
  const sources = Object.keys(finalOf(last));
  const kind = (st) => st.settings.leagueTypeId;
  // A pool pick never repeats: each one was offered when it was made (PickEmLogic.eligibility on the state before the episode:
  // nobody picked earlier in the cycle, nor the last episode's; the cycle starts again once everyone still in was picked).
  {
    const why = [];
    let repeats = 0;
    for (const src of sources) {
      for (const n of eps.filter((x) => rec.kept[x - 1]?.final)) {
        const was = rec.kept[n - 1].final.games[src];
        const now = rec.kept[n].final.games[src];
        if (!S.getLeagueType(now).hasWeeklyPicks) continue;
        const ep = now.episodes.find((e) => e.number === n);
        for (const p of now.players) {
          const pick = ep && S.PickEmLogic.pickFor(now, ep.id, p.id)?.castawayId;
          if (!pick) continue;
          const { available } = S.PickEmLogic.eligibility(was, ep.id, p.id);
          const before = was.episodes.filter((e) => e.number < n).map((e) => S.PickEmLogic.pickFor(was, e.id, p.id)?.castawayId);
          if (before.includes(pick)) repeats++;
          if (!available.includes(pick)) why.push(`${kind(now)} Episode ${n}: a seat has ${P.castName(now, pick)}, not offered then`);
        }
      }
    }
    add(`a pool pick never repeats (only as the pool's cycle allows: ${repeats} picked again once everyone still in had been)`, why);
  }
  // Every game ends at the finale, not before; Outlast with one left standing.
  if (last === sc.finale) {
    const why = [];
    for (const src of sources) {
      for (const n of eps) {
        for (const stage of ["early", "final"]) {
          const st = rec.kept[n]?.[stage]?.games?.[src];
          if (!st) continue;
          const over = S.gameOver(st);
          if (n < sc.finale && over) why.push(`${kind(st)} says it's over after Episode ${n} (${stage})`);
          if (n === sc.finale && stage === "final" && !over) why.push(`${kind(st)} isn't over after the finale's final results`);
        }
      }
      // Outlast: the show's winner is the last one standing, everyone else gone before them.
      const st = finalOf(last)[src];
      if (kind(st) === "classic-draft") {
        const w = S.seasonWinner(st);
        const left = st.castaways.filter((c) => !c.exitMethod && c.id !== w?.id);
        if (!w) why.push("Outlast: no winner after the finale");
        if (left.length) why.push(`Outlast: ${left.length} still in beside the winner after the finale`);
      }
    }
    add("every game ends at the finale, and not before; Outlast ends with the last one standing", why);
  }
  // Every score finite, as everyone reads it at every mark; nothing scored outside a game's span.
  {
    const why = [];
    const span = [];
    for (const n of eps) {
      for (const stage of ["early", "final"]) {
        for (const [src, st] of Object.entries(rec.kept[n]?.[stage]?.games || {})) {
          for (const seat of [null, ...st.players.map((p) => p.id)]) {
            const rows = S.computeScores(S.GhostLogic.viewFor(clone(st), seat, null));
            const bad = rows.filter((r) => !Number.isFinite(r.total));
            if (bad.length) why.push(`${kind(st)} after Episode ${n} (${stage}), as ${seat ?? "nobody"}: ${bad.length} totals not finite`);
          }
          // Past its last episode (a game that ends before the season's end): the table as it stood then. (Before its first
          // one isn't a check: Outlast's points are who's still standing, which counts from the draft.)
          const to = S.endEpisode(st);
          if (to !== null && n > to) {
            const at = JSON.stringify(S.computeScores(S.SpoilerLogic.viewThrough(st, to)).map((r) => r.total));
            if (at !== JSON.stringify(S.computeScores(st).map((r) => r.total))) span.push(`${kind(st)}: points after its last episode (${to}) at Episode ${n}`);
          }
          void src;
        }
      }
    }
    add("every score finite, as nobody and as each seat", why);
    add("nothing scored past a game's span", span);
  }
  // No move refused that the app offered; a move after the lock refused (and not offered).
  {
    const why = [];
    for (const [n, ep] of Object.entries(rec.episodes)) {
      for (const p of ep.problems || []) if (p.offered) why.push(`Episode ${n}: ${p.game} ${p.seat}'s ${p.kind} refused: ${p.error}`);
      for (const l of ep.late || []) if (!l.right) why.push(`Episode ${n}: ${l.game} ${l.seat}'s move ${l.after ? "after" : "before"} the lock was ${l.took ? "taken" : "refused"}${l.offered ? " (offered)" : " (not offered)"}${l.error ? `: ${l.error}` : ""}`);
    }
    add("no move refused that the app offered; none taken after the lock", why);
  }
  // A correction moves nobody's finishing place (afterStep "correct" reads every game's before and after).
  add(
    "a correction moves nobody's finishing place",
    Object.entries(rec.episodes).flatMap(([n, ep]) => (ep.notes || []).filter((x) => /PLACES MOVED/.test(x)).map((x) => `Episode ${n}: ${x.replace(/^.*PLACES MOVED \(placementOrder\): /, "")}`))
  );
  // Results reached the games: every episode's early and final runs worked.
  {
    const why = [];
    for (const [n, ep] of Object.entries(rec.episodes)) {
      for (const k of ["quick", "full"]) if (ep.results[k] && !ep.results[k].ok) why.push(`Episode ${n}: the bot's ${k} run: ${ep.results[k].message}`);
      for (const k of ["quickDesk", "fullDesk"]) if (ep.results[k]?.error) why.push(`Episode ${n}: the desk's Accept all (${k}): ${ep.results[k].error}`);
    }
    add("every episode's results filed and accepted", why);
  }
  return out;
}

// ---------- compare ----------

const readRun = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "run.json"), "utf8"));

/**
 * Every read of a run's kept states (golden.js's read through `S`): key "<episode> <stage> <game> seat <id> mark <m>" ->
 * the read. As nobody and as each seat, at every mark (nothing seen, each episode with results, everything), each on the
 * clock of the moment it was kept (`at`: what this week's episode and a lock read).
 */
function readsOfRun(S, rec, { at = null } = {}) {
  const out = new Map();
  for (const [n, stages] of Object.entries(rec.kept)) {
    for (const [stage, kept] of Object.entries(stages)) {
      Clock.set((at && at[n]?.[stage]) || kept.at);
      for (const state of Object.values(kept.games)) {
        const marks = [null, 0, ...new Set((state.episodes || []).filter((e) => S.EpisodeLogic.resultsStage(e)).map((e) => e.number))];
        for (const seat of [null, ...(state.players || []).map((p) => p.id)]) {
          for (const mark of marks) out.set(`Episode ${n} ${stage} ${state.settings.leagueTypeId} seat ${seat ?? "nobody"} mark ${mark ?? "all"}`, golden.read(S, S.GhostLogic.viewFor(clone(state), seat, mark)));
        }
      }
    }
  }
  Clock.reset();
  return out;
}

/** Where two reads part: the first few paths whose values differ, each value cut short (a player's name never shown). */
function whereApart(x, y, at = "", out = []) {
  if (out.length >= 4) return out;
  if (JSON.stringify(x) === JSON.stringify(y)) return out;
  if (x && y && typeof x === "object" && typeof y === "object") {
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])]) whereApart(x[k], y[k], `${at}.${k}`, out);
    return out;
  }
  const show = (v) => (/\.name$/.test(at) ? "(a name)" : JSON.stringify(v ?? null).slice(0, 80));
  out.push(`${at.slice(1)}: ${show(x)} → ${show(y)}`);
  return out;
}

function diffReads(a, b, label) {
  const diffs = [];
  for (const [k, v] of a) if (b.get(k) !== v) diffs.push(`${k} (${label[0]} → ${label[1]}): ${b.has(k) ? whereApart(JSON.parse(v), JSON.parse(b.get(k))).join("; ") : "missing"}`);
  for (const k of b.keys()) if (!a.has(k)) diffs.push(`${k}: only in ${label[1]}`);
  return diffs;
}

/** Two runs' reads side by side (flag off against on), and/or one run through another tree's engine (--before). */
function compare(dirA, dirB, { before = null } = {}) {
  const S = app().S;
  const A = readRun(dirA);
  const results = [];
  const at = Object.fromEntries(Object.entries(A.kept).map(([n, st]) => [n, Object.fromEntries(Object.entries(st).map(([k, v]) => [k, v.at]))]));
  if (dirB) {
    const B = readRun(dirB);
    const ra = readsOfRun(S, A);
    const rb = readsOfRun(S, B, { at });
    const diffs = diffReads(ra, rb, [A.flag ? `flag ${A.flag}` : "a", B.flag ? `flag ${B.flag}` : "b"]);
    results.push({ what: `${path.basename(dirA)} against ${path.basename(dirB)}`, reads: ra.size, diffs });
    // The screens both runs looked at: each page's text, line by line.
    const screens = [];
    let pages = 0;
    for (const [n, ep] of Object.entries(A.episodes)) {
      const other = B.episodes[n]?.look;
      if (!ep.look || !other) continue;
      for (const f of fs.readdirSync(ep.look.dir).filter((x) => x.endsWith(".txt"))) {
        pages++;
        const a = fs.readFileSync(path.join(ep.look.dir, f), "utf8").split("\n");
        const b = fs.existsSync(path.join(other.dir, f)) ? fs.readFileSync(path.join(other.dir, f), "utf8").split("\n") : null;
        // A page with no words read compares as the same on both sides and proves nothing: a difference of its own.
        if (!a.join("").trim() || (b && !b.join("").trim())) screens.push(`Episode ${n} ${f.replace(/\.txt$/, "")}: no words read`);
        else if (!b) screens.push(`Episode ${n} ${f}: only with ${A.flag ? `the flag ${A.flag}` : "the first"}`);
        else {
          const lines = a.map((l, i) => (l !== b[i] ? `"${l.slice(0, 60)}" → "${(b[i] ?? "").slice(0, 60)}"` : null)).filter(Boolean);
          if (lines.length || a.length !== b.length) screens.push(`Episode ${n} ${f.replace(/\.txt$/, "")}: ${lines.slice(0, 3).join("; ")}${a.length !== b.length ? ` (${a.length} lines → ${b.length})` : ""}`);
        }
      }
    }
    if (pages) results.push({ what: `the screens' words, ${path.basename(dirA)} against ${path.basename(dirB)}`, reads: pages, diffs: screens });
  }
  if (before) {
    const work = path.join(os.tmpdir(), `rfl-season-forward-${Date.now()}`);
    golden.setWork(work);
    const dir = golden.tree(path.join(work, "before"), before);
    try {
      const SB = require(path.join(dir, "src/lib/game/state-logic.js"));
      for (const d of [dirA, dirB].filter(Boolean)) {
        const rec = readRun(d);
        const rb = readsOfRun(SB, rec);
        const ra = readsOfRun(S, rec);
        results.push({ what: `${path.basename(d)}: ${before}'s engine against this tree's`, reads: ra.size, diffs: diffReads(rb, ra, [before, "this tree"]) });
      }
    } finally {
      if (golden.untree(dir)) fs.rmSync(work, { recursive: true, force: true });
    }
  }
  for (const r of results) {
    console.log(`${r.diffs.length ? "FAIL" : "PASS"}  ${r.what}: ${r.reads} reads${r.diffs.length ? `, ${r.diffs.length} differ` : ", every one the same"}`);
    for (const d of r.diffs.slice(0, 8)) console.log(`      ${d}`);
  }
  return results;
}

/** The flag, in this database (game-specs-flag.js: on writes each league's spec into it, off takes it out). */
function flag(on) {
  const r = spawnSync("node", ["scripts/game-specs-flag.js", on ? "on" : "off"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`game-specs-flag.js ${on ? "on" : "off"}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim().split("\n").pop();
}

/** Each scenario: up, played with the flag off, up again, played with it on, then compared (and through --before's engine). */
async function rehearse(from, names, o = {}) {
  const summary = [];
  try {
    for (const name of names) {
      const dirs = {};
      for (const on of [false, true]) {
        await up(from, o);
        console.log(flag(on));
        const label = on ? "flag-on" : "flag-off";
        const { out, rec } = await play(name, { out: path.join(o.out || path.join(ROOT, ".session-loop", "season-forward"), `${name}-${label}`), flag: on ? "on" : "off", look: o.look, width: o.width });
        dirs[label] = out;
        summary.push({ scenario: name, flag: label, invariants: rec.invariants });
      }
      const cmp = compare(dirs["flag-off"], dirs["flag-on"], { before: o.before });
      summary.push({ scenario: name, compare: cmp.map((c) => ({ what: c.what, reads: c.reads, differ: c.diffs.length })) });
    }
  } finally {
    console.log(flag(false));
  }
  console.log("\nrehearsal:");
  for (const s of summary) {
    if (s.invariants) console.log(`  ${s.scenario} (${s.flag}): ${s.invariants.every((i) => i.ok) ? "every invariant holds" : `FAILED ${s.invariants.filter((i) => !i.ok).map((i) => i.what).join("; ")}`}`);
    else for (const c of s.compare) console.log(`  ${s.scenario}: ${c.what}: ${c.reads} reads, ${c.differ ? `${c.differ} DIFFER` : "every one the same"}`);
  }
  return summary;
}

module.exports = { readBackup, copySeason, onCopy, loadScenario, episodeAnswers, drawn, invariants, readsOfRun, compare, SLUG, SEASON };

// ---------- main ----------

if (require.main === module) {
  (async () => {
    const cmd = args[0];
    try {
      if (cmd === "up") await up(opt("from"), { resultsBy: opt("results-by") });
      else if (cmd === "play") await play(opt("scenario", "realistic"), { through: opt("through"), out: opt("out"), label: opt("label"), look: (opt("look") || "").split(",").filter(Boolean).map(Number), shots: opt("shots"), width: opt("width") });
      else if (cmd === "compare") {
        const dirs = args.slice(1).filter((a) => !a.startsWith("--"));
        const res = compare(dirs[0], dirs[1] || null, { before: opt("before") });
        if (res.some((r) => r.diffs.length)) process.exitCode = 1;
      } else if (cmd === "rehearse") {
        const res = await rehearse(opt("from"), (opt("scenario") || "realistic").split(","), { before: opt("before"), resultsBy: opt("results-by"), out: opt("out"), look: (opt("look") || "").split(",").filter(Boolean).map(Number), width: opt("width") });
        if (res.some((s) => s.invariants?.some((i) => !i.ok) || s.compare?.some((c) => c.differ))) process.exitCode = 1;
      } else if (cmd === "down") console.log(`removed ${await down()}`);
      else console.log("usage: season-forward.js up|play|compare|rehearse|look|down (see the header)");
    } catch (e) {
      console.error(e.stack || e.message || e);
      process.exitCode = 1;
    } finally {
      await app().pool.end().catch(() => {});
    }
  })();
}
