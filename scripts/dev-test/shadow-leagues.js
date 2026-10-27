// Dev-only: shadow leagues. The couch's real Survivor 51 games (one linked group), cloned from a production backup into a
// local couch of their own, played by mock players who copy every real move (the draft, each lineup, each pick, waivers,
// predictions: the whole state), on researched Survivor rules instead of the built-in ones. It answers "what would switching
// Survivor to researched rules change or break?" during the season, without touching the real games: take a backup each
// week, `sync`, `diff`. Read docs/PLAN-rulebooks-implementation.md (the legacy freeze) and the rulebook research path
// (src/lib/game/formats/rulebook-research.js, src/lib/server/make-game.ts) for what "researched" means here.
//
//   node scripts/dev-test/shadow-leagues.js up --from=backups/<dir> [--rules=<rules>] [--group=<group id>]
//   node scripts/dev-test/shadow-leagues.js sync --from=backups/<newer dir>   re-copy every move and result; keep the rules
//   node scripts/dev-test/shadow-leagues.js diff [--from=backups/<dir>] [--out=<file.md>]
//   node scripts/dev-test/shadow-leagues.js look [--as=1] [--width=390] [--shots=<dir>]   (needs `npm run dev`) the shadow
//        couch's screens as a mock player sees them: Survivor 51's Games tab, How it works, each episode with results, Tonight
//   node scripts/dev-test/shadow-leagues.js prompt                           the research prompt, to paste into ChatGPT
//   node scripts/dev-test/shadow-leagues.js down
//
// --rules (what the shadow games play by; a couch's own copy, as Make it ours makes one, so nothing takes it out):
//   template   Survivor's library blocks compiled as a rulebook (the research reader, no frozen base), with the template's
//              aliases, so every recorded result keeps its event id: what the desk's own Survivor rulebook would be.
//   fresh      the same blocks compiled as research compiles a rulebook (Make it a game: no aliases): new event ids, new
//              question keys, new exit names. Shows what recorded results and research answers lose.
//   ask        Survivor 51's rules researched now by our bot (ChatGPT, through LLM_BROWSER_API_URL), the prompt Make it a
//              game sends; the answer is saved to backups/shadow/ (gitignored) and compiled as Make it a game compiles it.
//   <file>     a saved answer to `prompt` (yours from ChatGPT, or one `ask` saved), compiled the same way.
//   same       the built-in rules, unchanged: the baseline (every table should match the real one exactly).
//
// The source is a backup folder (scripts/backup-leagues.js; take one of production as its header says), so the real
// games are only ever read, from files. The group is the Survivor 51 linked group with the most games, unless --group
// says. Mock players: one account per real person in the group (zt_shadow_1, 2, ...; password zt-pass-12345), named
// "<their name> (shadow)" from the backup, so no real name is in this file (the repo is public). Each plays the same seat
// (the same player id) with the same role; their follow of Survivor 51 is at the real one's mark. The shadow games keep
// the real games' names, on a couch "ZT Shadow · Survivor 51", linked as one group, each state marked with
// settings.shadowOf (its source league) so sync and diff pair them up.
//
// diff, for each game and each episode with results: every player's total, real (the backup's state, by the rules it
// plays) against shadow (the local clone, by its rules), then why: recorded event ids and exit methods the shadow rules
// don't know, events whose points differ, and the research questions they ask differently. --out writes it as markdown.
//
// Everything it makes is keyed zt-shadow / zt_shadow_ and goes with `down` (`up` runs it first). Local database only.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});
const S = require("../../src/lib/game/state-logic.js");
const Shadow = jiti("../../src/lib/game/shadow.ts");
const Formats = require("../../src/lib/game/formats/index.js");
const { buildRulebookPrompt } = require("../../src/lib/game/formats/rulebook-research.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("shadow-leagues runs against a local database only");

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3) || null;
const PASSWORD = "zt-pass-12345";
const USER = (n) => `zt_shadow_${n}`;
const SHOW = "survivor";
const SEASON = 51;
const ANSWERS = path.join(__dirname, "..", "..", "backups", "shadow");

const pool = new Pool({ connectionString: DB });
const one = async (sql, params) => (await pool.query(sql, params)).rows[0] ?? null;

// ---------- the backup ----------

function readBackup(dir) {
  if (!dir || !fs.existsSync(path.join(dir, "leagues.json"))) throw new Error(`--from must be a backup folder (scripts/backup-leagues.js): ${dir}`);
  const read = (t) => (fs.existsSync(path.join(dir, `${t}.json`)) ? JSON.parse(fs.readFileSync(path.join(dir, `${t}.json`), "utf8")) : []);
  const state = (r) => (typeof r.state === "string" ? JSON.parse(r.state) : r.state);
  return { dir, leagues: read("leagues").map((r) => ({ ...r, state: state(r) })), memberships: read("league_memberships"), users: read("user"), follows: read("show_follows") };
}

/** The Survivor 51 linked group with the most games (or --group's), its games in the group's order. */
function groupOf(backup, want) {
  const on = backup.leagues.filter((l) => !l.deleted_at && !l.solo && l.group_id && l.state?.settings?.showId === SHOW && String(l.state.settings.wikiSeason) === String(SEASON));
  const groups = new Map();
  for (const l of on) groups.set(l.group_id, [...(groups.get(l.group_id) ?? []), l]);
  const id = want ?? [...groups].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  const list = groups.get(id);
  if (!list?.length) throw new Error(`no Survivor ${SEASON} linked group${want ? ` ${want}` : ""} in ${backup.dir}`);
  return list.sort((a, b) => (a.group_position ?? 0) - (b.group_position ?? 0));
}

// ---------- the rules ----------

/** What the shadow games play by: { compiled, blocks, aliases, from, problems } (compiled null for `same`). */
async function rulesFor(mode, castNames) {
  if (mode === "same" || mode === "template" || mode === "fresh") return { ...Shadow.shadowRules(mode, { format: "survivor" }), from: mode };
  let file = mode;
  if (mode === "ask") {
    const { askBot, askBotStatus } = jiti("../../src/lib/server/ask-bot.ts");
    if (!(await askBotStatus()).available) throw new Error("our bot isn't answering (LLM_BROWSER_API_URL): try again, or `prompt` and paste it yourself");
    console.log("asking our bot for Survivor 51's rules (a few minutes)...");
    const { answer, seconds } = await askBot(buildRulebookPrompt({ show: "Survivor", season: SEASON, airing: true }), { budgetMs: 280_000 });
    fs.mkdirSync(ANSWERS, { recursive: true });
    file = path.join(ANSWERS, `survivor-${SEASON}-rules-${new Date().toISOString().slice(0, 10)}.txt`);
    fs.writeFileSync(file, answer);
    console.log(`  answered in ${seconds}s; saved to ${file}`);
  }
  if (!fs.existsSync(file)) throw new Error(`--rules must be template, fresh, ask, same or a saved answer file: ${mode}`);
  // As Make it a game reads and compiles an answer (make-game.ts workOut): the research reader, no aliases.
  return { ...Shadow.shadowRules("researched", { answer: fs.readFileSync(file, "utf8"), castNames }), from: path.basename(file) };
}

// ---------- down ----------

async function down() {
  const mock = (await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt_shadow_%'`)).rows.map((r) => r.id);
  const leagues = await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-shadow-%' RETURNING id");
  await pool.query("DELETE FROM rulebooks WHERE provenance->>'shadow' = 'true'");
  if (mock.length) {
    await pool.query("DELETE FROM league_groups WHERE created_by = ANY($1::text[])", [mock]);
    await pool.query("DELETE FROM couches WHERE created_by = ANY($1::text[])", [mock]);
    await pool.query("DELETE FROM show_follows WHERE user_id = ANY($1::text[])", [mock]);
    await pool.query("DELETE FROM user_settings WHERE user_id = ANY($1::text[])", [mock]);
    await pool.query(`DELETE FROM account WHERE "userId" = ANY($1::text[])`, [mock]);
    await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [mock]);
  }
  return `${leagues.rowCount} shadow games, ${mock.length} mock players`;
}

// ---------- up and sync ----------

const joinCode = () => Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 24]).join("");

/** One mock account per real person in the group, in the order they first appear; reused by sync. */
async function mockPlayers(backup, games) {
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = games.map((g) => g.id);
  const real = [...new Set(backup.memberships.filter((m) => ids.includes(m.league_id)).map((m) => m.user_id))];
  const existing = new Map((await pool.query(`SELECT id, name FROM "user" WHERE username LIKE 'zt_shadow_%'`)).rows.map((r) => [r.name, r.id]));
  const map = new Map();
  for (const [i, userId] of real.entries()) {
    const u = backup.users.find((x) => x.id === userId);
    const name = `${u?.displayUsername || u?.username || u?.name || `Player ${i + 1}`} (shadow)`;
    let id = existing.get(name);
    if (!id) {
      id = crypto.randomUUID();
      const n = (await one(`SELECT count(*)::int AS n FROM "user" WHERE username LIKE 'zt_shadow_%'`)).n + 1;
      await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $4, $4, 'user', true, now(), now())`, [
        id, name, `${USER(n)}@example.invalid`, USER(n),
      ]);
      await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
    }
    map.set(userId, id);
  }
  return map;
}

/** The real game's state for its shadow (src/lib/game/shadow.ts): everything as it is, its rules and its source marked. */
const shadowState = (real, keep) => Shadow.shadowState(real.state, { sourceId: real.id, rulebook: keep.rulebook ?? null });

async function seasonId() {
  const r = await one("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2", [SHOW, SEASON]);
  if (!r) throw new Error(`this database has no ${SHOW} ${SEASON}`);
  return r.id;
}

/** Members, and each mock player's follow at their real one's mark (results seen through as far as they've revealed). */
async function seat(backup, games, shadowIds, map, sid) {
  for (const [i, g] of games.entries()) {
    await pool.query("DELETE FROM league_memberships WHERE league_id = $1", [shadowIds[i]]);
    for (const m of backup.memberships.filter((x) => x.league_id === g.id)) {
      await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)", [
        shadowIds[i], map.get(m.user_id), m.player_id, m.role, m.results_seen_through,
      ]);
    }
  }
  for (const [real, mock] of map) {
    const f = backup.follows.find((x) => x.user_id === real && x.season_id === sid);
    const seen = Math.max(0, ...backup.memberships.filter((m) => m.user_id === real && games.some((g) => g.id === m.league_id)).map((m) => m.results_seen_through ?? 0), f?.seen_through ?? 0);
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = $3, following = true, private = false`,
      [mock, sid, seen]
    );
  }
}

async function up() {
  const backup = readBackup(opt("from"));
  const games = groupOf(backup, opt("group"));
  console.log(`(first) removed ${await down()}`);
  const sid = await seasonId();
  const castNames = (await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [sid])).rows.map((r) => r.name);
  const rules = await rulesFor(opt("rules") || "template", castNames);
  const map = await mockPlayers(backup, games);
  const lead = map.get(backup.memberships.find((m) => m.league_id === games[0].id && m.role === "commissioner")?.user_id) ?? [...map.values()][0];
  const couch = (await one("INSERT INTO couches (name, created_by) VALUES ('ZT Shadow · Survivor 51', $1) RETURNING id", [lead])).id;
  for (const mock of map.values()) await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3)", [couch, mock, mock === lead ? "owner" : "member"]);
  const group = (await one("INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id", [lead])).id;
  const shadowIds = [];
  for (const [i, g] of games.entries()) {
    const s = shadowState(g, {});
    const row = await one(
      "INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
      [g.name, `zt-shadow-${g.id.slice(0, 8)}`, joinCode(), JSON.stringify(s), map.get(g.created_by) ?? lead, group, i, couch]
    );
    shadowIds.push(row.id);
  }
  // The rules: the couch's own copy (Make it ours's shape: a league-owned rulebook every game points at), so a re-sync of a
  // league's rules (db/rulebooks.js syncLeagueRulebook) keeps it with the rulebooks flag off.
  let rulebook = null;
  if (rules.compiled) {
    const rb = await one(
      `INSERT INTO rulebooks (name, kind, owner_kind, league_id, status, reader, blocks, compiled, compiled_source, aliases, provenance, version, created_by)
       VALUES ($1, 'competition', 'league', $2, 'in_force', 'research', $3, $4, 'blocks', $5, $6, 1, $7) RETURNING id, version`,
      [`Survivor 51 (shadow: ${rules.from})`, shadowIds[0], JSON.stringify(rules.blocks), JSON.stringify(rules.compiled), JSON.stringify(rules.aliases ?? {}), JSON.stringify({ ours: true, shadow: true, from: rules.from }), lead]
    );
    rulebook = { id: rb.id, version: rb.version, data: rules.compiled, reader: "research" };
    await pool.query("UPDATE leagues SET rulebook_id = $1 WHERE id = ANY($2::uuid[])", [rb.id, shadowIds]);
  }
  for (const [i, g] of games.entries()) await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [shadowIds[i], JSON.stringify(shadowState(g, { rulebook }))]);
  await seat(backup, games, shadowIds, map, sid);
  await pool.query("UPDATE leagues SET state = jsonb_set(state, '{settings,shadowFrom}', to_jsonb($2::text)) WHERE id = ANY($1::uuid[])", [shadowIds, backup.dir]);
  console.log(`up: ${games.length} shadow games on "${rules.from}" rules (${games.map((g) => g.state.settings.leagueTypeId).join(", ")}), ${map.size} mock players`);
  if (rules.warnings?.length) console.log(`  the rules' warnings: ${rules.warnings.join("; ")}`);
  console.log(`  sign in as ${[...map.keys()].map((_, i) => USER(i + 1)).join(" / ")} (password ${PASSWORD}); the games are on Survivor 51's Games tab`);
}

async function sync() {
  const backup = readBackup(opt("from"));
  const shadows = (await pool.query("SELECT id, state FROM leagues WHERE slug LIKE 'zt-shadow-%' ORDER BY group_position")).rows;
  if (!shadows.length) throw new Error("no shadow games: `up` first");
  const games = shadows.map((s) => backup.leagues.find((l) => l.id === s.state.settings.shadowOf));
  if (games.some((g) => !g)) throw new Error(`${backup.dir} hasn't got every shadow game's source`);
  const map = await mockPlayers(backup, games);
  for (const [i, g] of games.entries()) {
    const keep = { rulebook: shadows[i].state.settings.rulebook ?? null };
    const s = shadowState(g, keep);
    s.settings.shadowFrom = backup.dir;
    await pool.query("UPDATE leagues SET state = $2, updated_at = now() WHERE id = $1", [shadows[i].id, JSON.stringify(s)]);
  }
  await seat(backup, games, shadows.map((s) => s.id), map, await seasonId());
  console.log(`sync: ${games.length} shadow games now as ${backup.dir} has them (every move and result), on the same rules`);
}

// ---------- diff ----------

const typeOf = (ev) => ev.type || ev.eventType;
const fmt = (n) => (Math.round(n * 10) / 10).toString();

/** Every player's score at episode n: their total (Survival Pool: best streak, then points). */
function scoresAt(state, n) {
  const view = S.SpoilerLogic.viewThrough(state, n);
  const picks = S.getLeagueType(view).hasWeeklyPicks;
  return new Map(S.computeScores(view).map((r) => [r.playerId, { name: r.name, total: picks ? `${r.longestStreak ?? 0} streak, ${r.total}` : fmt(r.total) }]));
}

function explain(real, shadow) {
  const out = [];
  const rf = S.formatOf(real);
  const sf = S.formatOf(shadow);
  const known = new Set(sf.events.map((e) => e.id));
  const points = (state, type) => S.ActiveRosterLogic.eventPoints(state, { type });
  // The rules themselves (the user, 2026-10-27: research may find more scoring events, but every event both have keeps
  // today's built-in points): what's in both and whether its points match, what research adds, what it drops.
  const mine = new Set(rf.events.map((e) => e.id));
  const both = sf.events.filter((e) => mine.has(e.id)).map((e) => e.id);
  const repriced = both.filter((id) => points(real, id) !== points(shadow, id));
  const extra = sf.events.filter((e) => !mine.has(e.id));
  const dropped = rf.events.filter((e) => !known.has(e.id));
  out.push(
    `- Scoring events: ${both.length} in both, ${repriced.length ? `${repriced.length} at different points (${repriced.map((id) => `\`${id}\` ${fmt(points(real, id))} → ${fmt(points(shadow, id))}`).join(", ")})` : "every one at today's points"}; ${extra.length} only in the shadow rules${extra.length ? ` (${extra.map((e) => `\`${e.id}\` ${fmt(points(shadow, e.id))}`).join(", ")})` : ""}; ${dropped.length} of today's not in them${dropped.length ? ` (${dropped.map((e) => `\`${e.id}\``).join(", ")})` : ""}.`
  );
  const types = new Map();
  // Every result the real game counts (stored ones and those its rules imply from how people left).
  for (const ep of real.episodes) for (const ev of S.ActiveRosterLogic.episodeEvents(real, ep) || []) types.set(typeOf(ev), (types.get(typeOf(ev)) ?? 0) + 1);
  const lost = [...types].filter(([t]) => t && !known.has(t));
  if (lost.length) out.push(`- Recorded results the shadow rules don't know (they score nothing there): ${lost.map(([t, n]) => `\`${t}\` ×${n}`).join(", ")}`);
  const moved = [...types].filter(([t]) => t && known.has(t) && points(real, t) !== points(shadow, t));
  if (moved.length) out.push(`- Results worth different points: ${moved.map(([t]) => `\`${t}\` ${fmt(points(real, t))} → ${fmt(points(shadow, t))}`).join(", ")}`);
  const exits = [...new Set(real.castaways.filter((c) => c.exitMethod).map((c) => c.exitMethod))].filter((m) => !sf.exitMethods.includes(m));
  if (exits.length) out.push(`- Ways out recorded that the shadow rules don't have (their implied points don't fire): ${exits.map((m) => `"${m}"`).join(", ")}; its ways out: ${sf.exitMethods.map((m) => `"${m}"`).join(", ")}`);
  // The questions research asks about each person, from the rules' own data (the runtime format keeps a schema of them).
  const dataOf = (st) => st.settings.rulebook?.data ?? st.settings.showFormatData ?? Formats.FORMATS[st.settings.showFormat || "survivor"]?.data;
  const q = (st) => (dataOf(st)?.research?.checklist || []).map((x) => x.key);
  const rq = q(real);
  const sq = q(shadow);
  const gone = rq.filter((k) => !sq.includes(k));
  const added = sq.filter((k) => !rq.includes(k));
  if (gone.length || added.length) out.push(`- Research asks differently: ${gone.length} questions gone (${gone.join(", ")}), ${added.length} new (${added.join(", ")}). Answers already stored under the old keys aren't read by the new rules.`);
  // The built-in reader's whole-episode checks (Survivor's: tribal attendance against tribe immunity, all-zero votes, votes
  // against voters) are code, not rules: the research reader has none.
  if (rf.research?.episodeProblems && !sf.research?.episodeProblems) out.push(`- Research loses the built-in reader's whole-episode checks (\`episodeProblems\`: hand-written in ${real.settings.showFormat || "survivor"}.js); the research reader has none, so a contradictory episode isn't flagged.`);
  return out;
}

async function diff() {
  const shadows = (await pool.query("SELECT id, name, state FROM leagues WHERE slug LIKE 'zt-shadow-%' ORDER BY group_position")).rows;
  if (!shadows.length) throw new Error("no shadow games: `up` first");
  const backup = readBackup(opt("from") || shadows[0].state.settings.shadowFrom);
  const lines = [`# Shadow leagues: real against researched rules`, ``, `From ${backup.dir}; shadow rules: ${shadows[0].state.settings.rulebook ? (await one("SELECT name FROM rulebooks WHERE id = $1", [shadows[0].state.settings.rulebook.id]))?.name : "the built-in ones (same)"}.`, ``];
  let differs = 0;
  for (const s of shadows) {
    const real = backup.leagues.find((l) => l.id === s.state.settings.shadowOf)?.state;
    if (!real) continue;
    const latest = S.SpoilerLogic.latestWithResults(real);
    lines.push(`## ${s.state.settings.leagueTypeId} (${real.players.length} players, through Episode ${latest})`, ``);
    let same = true;
    for (let n = 1; n <= latest; n++) {
      const a = scoresAt(real, n);
      const b = scoresAt(s.state, n);
      const rows = [...a].filter(([id, r]) => b.get(id)?.total !== r.total).map(([id, r]) => `${r.name} ${r.total} → ${b.get(id)?.total ?? "missing"}`);
      if (rows.length) {
        same = false;
        differs++;
        lines.push(`- Episode ${n}: ${rows.join("; ")}`);
      }
    }
    if (same) lines.push(`- Every table, every episode: the same.`);
    const why = explain(real, s.state);
    if (why.length) lines.push(``, `Why:`, ...why);
    lines.push(``);
  }
  const text = lines.join("\n");
  console.log(text);
  if (opt("out")) {
    fs.writeFileSync(opt("out"), text);
    console.log(`written to ${opt("out")}`);
  }
  return differs;
}

// ---------- look ----------

/** The shadow couch as a mock player sees it, through the dev server: full-page screenshots, page errors, anything too wide. */
async function look() {
  const { open, BASE } = require("./browser");
  const width = Number(opt("width") || 390);
  const out = opt("shots") || path.join(os.tmpdir(), "shadow-leagues");
  fs.mkdirSync(out, { recursive: true });
  const sid = await seasonId();
  const shadows = (await pool.query("SELECT state FROM leagues WHERE slug LIKE 'zt-shadow-%'")).rows;
  if (!shadows.length) throw new Error("no shadow games: `up` first");
  const latest = Math.max(...shadows.map((s) => S.SpoilerLogic.latestWithResults(s.state)));
  const b = await open({ user: USER(Number(opt("as") || 1)), pass: PASSWORD, width });
  const pages = [
    ["games", `/show/${sid}/games`, "[data-table]"],
    ["how-it-works", `/show/${sid}/games?page=how-it-works`, "[data-how]"],
    ...Array.from({ length: latest }, (_, i) => [`episode-${i + 1}`, `/show/${sid}/episodes?page=ep${i + 1}`, "[data-episode-page]"]),
    ["tonight", `/show/${sid}/tonight`, "main"],
  ];
  try {
    for (const [name, url, sel] of pages) {
      await b.page.goto(`${BASE}${url}`, { waitUntil: "load" });
      const found = await b.page.locator(sel).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
      await b.page.evaluate(() => document.fonts.ready);
      await b.page.waitForTimeout(800);
      const wide = await b.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      // A pushed page (?page=) scrolls inside itself: the screen as it is; a tab, the whole page.
      await b.page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: !url.includes("?page=") });
      console.log(`${found ? "ok  " : "MISSING"} ${name}${wide > 1 ? `  (${wide}px too wide)` : ""}`);
    }
    if (b.errors.length) console.log(`page errors: ${b.errors.join(" | ")}`);
    console.log(`screenshots in ${out}`);
  } finally {
    await b.close();
  }
}

(async () => {
  try {
    if (cmd === "up") await up();
    else if (cmd === "look") await look();
    else if (cmd === "sync") await sync();
    else if (cmd === "diff") await diff();
    else if (cmd === "down") console.log(`removed ${await down()}`);
    else if (cmd === "prompt") console.log(buildRulebookPrompt({ show: "Survivor", season: SEASON, airing: true }));
    else console.log("usage: shadow-leagues.js up|sync|diff|prompt|down [--from=backups/<dir>] [--rules=template|fresh|ask|same|<file>] (see the header)");
  } catch (e) {
    console.error(e.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
    await jiti("../../src/lib/server/db.ts").pool.end().catch(() => {});
  }
})();
