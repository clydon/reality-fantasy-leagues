// Dev-only check for Open it read-only (docs/PLAN-desk-parity.md step 6, part 6c), against this lane's dev server, on a
// fixture of its own: a zt show's season 51 (results through episode 5, the demo builder's), the ZT RO Couch (nina runs it;
// cole, bea and finn play) with ZT RO Outlast, ZT RO Lineup, ZT RO Pool (archived), ZT RO Gone (deleted) and a practice game
// on no couch; the ZT RO Home couch, where the desk's site admin plays ZT RO Mine. The site admin isn't on ZT RO Couch
// (Noticed r: no seat, no membership) and is on episode 3 of the season.
//   1. The desk's game page says how each game opens: read-only up to Episode 3, where you are (Outlast); as it ended
//      (the archived Pool); as you (Mine, which they play); not at all (deleted, or on no couch). Only site admins open one.
//   2. Opening it read-only is a line in the game's History ("Opened read-only"); refused for a game you play or one deleted.
//   3. The read scope (the header): /space has that one game and the couch's people, /games its table as the couch sees it
//      at episode 3 (nobody "you", no moves), /episodes its episodes with nobody's line, 4 and 5 hidden, no Fill it in. The
//      same reads without it, another couch with it, or a player sending it: each reader's own as ever.
//   4. Writes that carry it are refused (a reveal, a desk archive, a player's), whatever the route; where you are stays
//      yours to move. No membership or couch row was made for the site admin.
//   5. Screens at --width: the game page's Open row; the show space under the Read-only plate (the back says Desk); Games
//      (one table, nobody "you", the foot line), Rules and a person's team open; the ⋯ menu, Reveal and a flag say Read-only;
//      Tonight and Chat say why they're not shown (and nothing reads the chat); Episodes' "Scored in" lines and an episode's
//      page; Cast with no Your team; Back to the desk, the show bar's Desk, "Its seats, on the desk" and leaving for the hub
//      each end it; every request while it's on carries the game's id; Mine opens as you, with no plate. Nothing wider than
//      the screen; no page errors.
//   6. Nothing real moved: every account that isn't zt_ is as it was, and every real league too.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                  (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-readonly.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-readonly.js --down       (takes the fixture down, nothing else)
//
// up/down: zt_ro_ accounts (their sessions, seats, couch rows, follows and notices), the ZT RO couches, the zt-ro- games
// (codes start Z7R: it refuses to run if a real code does), the zt-ro-survivor show (its season, cast and results), and the
// admin_changes lines on them; --keep leaves the fixture up. Refuses a non-local database. Prints PASS/FAIL. Shares no
// fixture with the other desk checks, so it may run beside them.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-readonly runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-readonly.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_ro_${k}`;
const COUCH = "ZT RO Couch";
const HOME = "ZT RO Home";
const SHOW = "zt-ro-survivor";
const PREFIX = "Z7R";
const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HEADER = "x-gys-read-only";
const SAYS = "Read-only: nothing here changes. To do it as someone, act as them from their seat";
const EPISODES = 13;
const CURSOR = 5;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

// The cast: Survivor 51's real castaways and the mock's photos of them (public/mock/showcase), never app users (as
// new-fixture.js). The first listed goes home first.
const FACES = [
  "aaliyah-puglia", "alexis-levine", "ana-sani", "brady-booker", "carter-krull", "cristian-chavez", "danny-kilby", "devin-way",
  "eric-macksoud", "jelly-loblack", "jenna-doore", "kristin-flickinger", "lewis-kelly", "linnea-capobianco", "maggie-nestor",
  "mike-pinsky", "ori-jean-charles", "sharonda-cox",
];
const nameOf = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const TRIBES = [["toka", "Toka", "#e0b23a"], ["savu", "Savu", "#9b6bd0"], ["dina", "Dina", "#f3214a"]];
const data = (players) => ({
  id: "zt-ro", showId: SHOW, showName: "ZT RO Survivor", seasonName: "ZT RO Survivor 51", episodeCount: EPISODES,
  players: players.map((k) => ({ key: k, name: U(k), color: "#888" })),
  groups: TRIBES.map(([key, name, color]) => ({ key, name, color })),
  castaways: FACES.map((slug, i) => ({
    key: `k${i}`, name: nameOf(slug), placement: i + 1, photoUrl: `/mock/showcase/img/survivor-51/${slug}.jpg`, groupKey: TRIBES[i % 3][0],
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
});

async function down(pool) {
  const { rows } = await pool.query("SELECT id FROM leagues WHERE slug LIKE 'zt-ro-%'");
  const { rows: couches } = await pool.query("SELECT id FROM couches WHERE name IN ($1, $2)", [COUCH, HOME]);
  await pool.query(
    `DELETE FROM admin_changes WHERE (entity = 'game' AND entity_id = ANY($1)) OR (entity = 'couch' AND entity_id = ANY($2))
       OR entity_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_ro\\_%') OR user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_ro\\_%')`,
    [rows.map((r) => r.id), couches.map((c) => c.id)]
  );
  await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_ro\\_%')`);
  await pool.query("DELETE FROM leagues WHERE slug LIKE 'zt-ro-%'");
  await pool.query("DELETE FROM couches WHERE name IN ($1, $2)", [COUCH, HOME]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]); // its season, cast, results and follows go with it
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_ro\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league outside the fixture has a code starting ${PREFIX}: the checks can't run here`);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-ro-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, U(k), `${U(k)}@zt-ro.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    await pool.query("INSERT INTO user_last_seen (user_id, last_seen_at) VALUES ($1, now() - interval '30 minutes')", [id]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["nina", "cole", "bea", "finn"]) await add(k);

  // Episode 6 airs three days from today at 8 PM Eastern (as new-fixture.js): results are in through 5.
  const show = (await one(`INSERT INTO shows (slug, name, created_by, set_up_at) VALUES ($1, 'ZT RO Survivor', $2, now()) RETURNING id`, [SHOW, ids.nina])).id;
  ids.season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
     VALUES ($1, 51, 'ZT RO Survivor 51', 'airing', current_date + 3 - 35, '20:00', 'America/New_York', 90, $2) RETURNING id`,
    [show, EPISODES]
  )).id;
  ids.couch = (await one("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.nina])).id;
  ids.home = (await one("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [HOME, ids.desk])).id;
  for (const k of ["nina", "cole", "bea", "finn"]) await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, $3, 'game')", [ids.couch, ids[k], k === "nina" ? "owner" : "member"]);
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'owner', 'game')", [ids.home, ids.desk]);
  // Where each is: the site admin on episode 3 (so the read-only view stops there), the couch through 5.
  for (const [k, seen] of [["desk", 3], ["nina", 5], ["cole", 5], ["bea", 5], ["finn", 5]]) {
    await pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3)", [ids[k], ids.season, seen]);
  }

  let codes = 0;
  const codeOf = () => {
    const n = codes++;
    return `${PREFIX}${AB[Math.floor(n / AB.length) % AB.length]}${AB[n % AB.length]}${AB[crypto.randomInt(AB.length)]}`;
  };
  const game = async (key, o) => {
    const state = JSON.parse(JSON.stringify(buildDemoState(data(o.seats.map(([k]) => k)), o.type, CURSOR)));
    S.migrateLeagueState(state);
    state.settings.showId = SHOW;
    state.settings.wikiSeason = 51;
    if (o.archived) state.settings.archivedAt = new Date(Date.now() - 86400000).toISOString();
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, solo, deleted_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - interval '30 days') RETURNING id`,
      [o.name, `zt-ro-${key}`, codeOf(), JSON.stringify(state), ids[o.seats[0][0]], o.solo ? null : (o.couch ?? ids.couch), o.solo ?? null, o.deleted ? new Date() : null]
    );
    ids[key] = rows[0].id;
    for (const [i, [k, role]] of o.seats.entries()) {
      await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)", [
        ids[key], ids[k], state.players[i].id, role, k === "desk" ? 3 : 5,
      ]);
    }
    return state;
  };
  const outlast = await game("outlast", { name: "ZT RO Outlast", type: "classic-draft", seats: [["nina", "commissioner"], ["cole", "member"], ["bea", "member"], ["finn", "member"]] });
  await game("lineup", { name: "ZT RO Lineup", type: "active-roster", seats: [["nina", "commissioner"], ["cole", "member"], ["bea", "member"]] });
  await game("pool", { name: "ZT RO Pool", type: "pickem", archived: true, seats: [["nina", "commissioner"], ["finn", "member"]] });
  await game("gone", { name: "ZT RO Gone", type: "pickem", deleted: true, seats: [["nina", "commissioner"], ["bea", "member"]] });
  await game("practice", { name: "ZT RO Practice", type: "pickem", solo: "practice", seats: [["cole", "commissioner"]] });
  await game("mine", { name: "ZT RO Mine", type: "pickem", couch: ids.home, seats: [["desk", "commissioner"]] });

  // The season's cast and accepted results (the Cast tab's stats count these), from Outlast's own.
  for (const [i, slug] of FACES.entries()) {
    await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)", [
      ids.season, nameOf(slug), TRIBES[i % 3][1], `/mock/showcase/img/survivor-51/${slug}.jpg`, i,
    ]);
  }
  await pool.query("UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1", [ids.season]);
  const name = new Map(outlast.castaways.map((c) => [c.id, c.name]));
  for (const ep of outlast.episodes) {
    for (const [kind, e] of [...(ep.events || []).map((e) => ["elimination", e]), ...(ep.scoringEvents || []).map((e) => ["event", e])]) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now())`,
        [ids.season, ep.number, kind, name.get(e.castawayId), kind === "elimination" ? e.method : "", kind === "event" ? e.type : ""]
      );
    }
  }
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text || coalesce(banned::text, ''), ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_LEAGUES = `SELECT md5(string_agg(id || name || join_code || coalesce(deleted_at::text, '') || md5(state::text), ',' ORDER BY id)) AS h FROM leagues WHERE slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_ro_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const realBefore = (await pool.query(REAL_USERS)).rows[0].h;
  const leaguesBefore = (await pool.query(REAL_LEAGUES)).rows[0].h;
  const closers = [];
  try {
    const ids = await up(pool);
    const as = {
      desk: await api({ user: U("desk"), pass: PASSWORD }),
      ro: await api({ user: U("desk"), pass: PASSWORD, headers: { [HEADER]: ids.outlast } }),
      nina: await api({ user: U("nina"), pass: PASSWORD }),
      ninaRo: await api({ user: U("nina"), pass: PASSWORD, headers: { [HEADER]: ids.outlast } }),
    };
    const season = (rest, who = as.ro, couch = ids.couch) => who.call("GET", `/api/seasons/${ids.season}/${rest}?couch=${couch}`);
    const opens = async () => (await pool.query("SELECT count(*)::int AS n FROM admin_changes WHERE entity = 'game' AND entity_id = $1 AND action = 'open'", [ids.outlast])).rows[0].n;

    // ---- 1. how each game opens ----
    const page = async (k) => (await as.desk.call("GET", `/api/desk/games/${ids[k]}`)).body;
    const o = await page("outlast");
    check(o.open?.as === "readOnly" && o.open.mark === 3 && o.open.episode === "Episode" && o.open.couch === COUCH && o.open.seasonId === ids.season, "Outlast opens read-only, up to episode 3 (where the site admin is)", JSON.stringify(o.open));
    const pl = await page("pool");
    check(pl.open?.as === "readOnly" && pl.state === "archived", "the archived Pool opens read-only (as it ended)", JSON.stringify(pl.open));
    check((await page("mine")).open?.as === "you", "Mine, which the site admin plays, opens as them");
    check((await page("practice")).open === null && (await page("gone")).open === null, "a practice game (no couch) and a deleted one don't open");
    const ninaOpen = await as.nina.call("POST", `/api/desk/games/${ids.outlast}`, { open: true });
    check(ninaOpen.status === 403, "a player can't open a game from the desk", String(ninaOpen.status));

    // ---- 2. opening is a line in its History ----
    const mineOpen = await as.desk.call("POST", `/api/desk/games/${ids.mine}`, { open: true });
    check(mineOpen.status === 409 && /You play it/.test(mineOpen.body.error), "refused for a game you play: it opens as you", JSON.stringify(mineOpen.body));
    const goneOpen = await as.desk.call("POST", `/api/desk/games/${ids.gone}`, { open: true });
    check(goneOpen.status === 409 && /deleted/.test(goneOpen.body.error), "refused for a deleted one", JSON.stringify(goneOpen.body));
    const op = await as.desk.call("POST", `/api/desk/games/${ids.outlast}`, { open: true });
    check(op.status === 200 && op.body.leagueId === ids.outlast && op.body.couchId === ids.couch && op.body.seasonId === ids.season && op.body.couch === COUCH && op.body.name === "ZT RO Outlast", "Open answers what the show space opens", JSON.stringify(op.body));
    check((await opens()) === 1, "and writes one line");
    const h = (await page("outlast")).history[0];
    check(h?.text === "Opened read-only" && h.who === U("desk") && !h.undoable, "History: \"Opened read-only\", by the site admin, nothing to undo", JSON.stringify(h));

    // ---- 3. the read scope ----
    const sp = (await season("space")).body;
    check(sp.games?.length === 1 && sp.games[0].leagueId === ids.outlast && sp.games[0].yourRole === null, "/space: that one game, none of it yours", JSON.stringify(sp.games?.map((g) => g.name)));
    check(JSON.stringify((sp.people ?? []).map((p) => p.name).sort()) === JSON.stringify(["bea", "cole", "finn", "nina"].map(U)) && sp.you?.seenThrough === 3, "the couch's people; where you are is yours (3)", JSON.stringify({ p: sp.people?.map((p) => p.name), you: sp.you }));
    const gm = (await season("games")).body;
    const g = gm.games?.[0];
    check(gm.games?.length === 1 && g.leagueId === ids.outlast && g.you === null && g.playerId === "" && g.table.length === 4 && g.table.every((r) => !r.you), "/games: its table, four players, nobody \"you\"", JSON.stringify({ n: gm.games?.length, you: g?.you, rows: g?.table?.length }));
    check(g?.through === 3 && g.lineup === null && g.pick === null && g.predictions.length === 0 && g.revealFirst === null, "as far as episode 3 (your mark), with no moves and nothing to reveal", JSON.stringify({ through: g?.through, rf: g?.revealFirst }));
    const ep = (await season("episodes")).body;
    const seen = ep.episodes?.filter((e) => e.status === "seen").map((e) => e.number);
    const hidden = ep.episodes?.filter((e) => e.status === "hidden").map((e) => e.number);
    check(JSON.stringify(seen) === "[3,2,1]" && JSON.stringify(hidden) === "[5,4]" && ep.reveal?.episode === 4, "/episodes: 1-3 seen, 4 and 5 hidden past your mark", JSON.stringify({ seen, hidden, reveal: ep.reveal }));
    check(ep.episodes.filter((e) => e.status === "seen").every((e) => e.lines.length === 0 && e.out?.length > 0) && ep.fill === null, "each seen with who went home and nobody's line; no Fill it in");
    const mine = (await season("games", as.desk)).body;
    check(mine.games?.length === 0, "the same read without the header: the site admin's own (no game of theirs on that couch)", JSON.stringify(mine.games?.map((x) => x.name)));
    const other = (await season("games", as.ro, ids.home)).body;
    check(other.games?.length === 1 && other.games[0].leagueId === ids.mine && other.games[0].you, "another couch with the header: their own game, as theirs", JSON.stringify(other.games?.map((x) => x.name)));
    const nina = (await season("games", as.ninaRo)).body;
    check(nina.games?.length === 3 && nina.games.every((x) => x.you), "a player sending the header reads their own games", JSON.stringify(nina.games?.map((x) => x.name)));

    // ---- 4. writes refused ----
    const rev = await as.ro.call("POST", `/api/seasons/${ids.season}/reveal`, { episode: 4, couch: ids.couch });
    check(rev.status === 403 && rev.body.error === SAYS, "a reveal carrying it is refused, saying Read-only", `${rev.status} ${JSON.stringify(rev.body)}`);
    const arch = await as.ro.call("POST", `/api/desk/games/${ids.outlast}`, { archive: true });
    check(arch.status === 403 && arch.body.error === SAYS && (await page("outlast")).state === "playing", "a desk write carrying it too (Outlast stays playing)", `${arch.status} ${JSON.stringify(arch.body)}`);
    const ninaW = await as.ninaRo.call("POST", `/api/seasons/${ids.season}/reveal`, { episode: 5, couch: ids.couch });
    check(ninaW.status === 403, "and a player's write carrying it", String(ninaW.status));
    // Your own follow of the season isn't the couch's: the header doesn't refuse it (here its own rule answers, since the site
    // admin plays the season elsewhere and their mark moves with their reveals).
    const mv = await as.ro.call("PUT", `/api/me/follows/${ids.season}`, { seenThrough: 4 });
    check(mv.status !== 403 && mv.body.error !== SAYS, "where you are stays yours: the header doesn't refuse it", `${mv.status} ${JSON.stringify(mv.body)}`);
    const rows = async () =>
      (await pool.query(
        `SELECT (SELECT count(*)::int FROM league_memberships WHERE user_id = $1 AND league_id IN ($2, $3, $4)) AS seats,
                (SELECT count(*)::int FROM couch_members WHERE user_id = $1 AND couch_id = $5) AS couch`,
        [ids.desk, ids.outlast, ids.lineup, ids.pool, ids.couch]
      )).rows[0];
    let r = await rows();
    check(r.seats === 0 && r.couch === 0, "no seat or couch row for the site admin (never a membership)", JSON.stringify(r));

    // ---- 5. the screens ----
    const b = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
    closers.push(b.close);
    // Next's dev badge sits over the tab bar's corner (as the other desk checks hide it).
    await b.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(st);
      });
    });
    const pg = b.page;
    const failed = [];
    pg.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    const sent = [];
    pg.on("request", (q) => {
      const u = new URL(q.url());
      if (u.pathname.startsWith("/api/")) sent.push({ path: u.pathname, method: q.method(), ro: q.headers()[HEADER] ?? null });
    });
    const shot = (n) => pg.screenshot({ path: path.join(out, `${n}.png`) });
    const wide = async (what) => {
      const w = await pg.evaluate(() => document.documentElement.scrollWidth);
      check(w <= width, `${what}: nothing wider than the screen`, `${w}px`);
    };
    const toasted = async (re) => {
      await pg.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-toast]")?.textContent || ""), re.source, { timeout: 15000 }).catch(() => {});
      return ((await pg.locator("[data-toast]").textContent().catch(() => "")) || "").trim();
    };
    const roNow = () => pg.evaluate(() => sessionStorage.getItem("gys-read-only"));
    const gamePage = async (k) => {
      await pg.goto(`${BASE}/desk/game/${ids[k]}`);
      await pg.waitForSelector("[data-desk-game]", { timeout: 60000 });
      await pg.waitForTimeout(400);
    };
    const tab = async (t) => {
      await pg.locator(`a[href="/show/${ids.season}/${t}"]`).first().click();
      await pg.waitForURL(new RegExp(`/show/${ids.season}/${t}`), { timeout: 30000 });
      await pg.waitForTimeout(700);
    };
    const openIt = async () => {
      await gamePage("outlast");
      await pg.locator("[data-game-open]").click();
      await pg.waitForURL(new RegExp(`/show/${ids.season}/games`), { timeout: 30000 });
      await pg.waitForSelector("[data-read-only-bar]", { timeout: 30000 });
      await pg.waitForSelector(`[data-table="${ids.outlast}"]`, { timeout: 30000 });
      await pg.waitForTimeout(600);
    };

    await gamePage("outlast");
    const row = (await pg.locator("[data-game-open]").innerText()).replace(/\s+/g, " ");
    check(/Open ZT RO Outlast/.test(row) && /As its couch sees it, read-only · up to Episode 3, where you are/.test(row), "the game page: Open ZT RO Outlast, read-only up to Episode 3", row);
    const order = await pg.evaluate(() => {
      const at = (sel) => [...document.querySelectorAll("*")].indexOf(document.querySelector(sel));
      return at("[data-game-open]") < at('[data-desk-row="part-couch"]');
    });
    check(order, "after the lower third, before Part of");
    await shot("01-game-page");
    await wide("the game page");

    const before = await opens();
    await openIt();
    check((await opens()) === before + 1, "Open writes its History line");
    const bar = (await pg.locator("[data-read-only-bar]").innerText()).replace(/\s+/g, " ");
    check(/read-only · ZT RO Outlast on ZT RO Couch/i.test(bar) && /Back to the desk/.test(bar), "the Read-only plate: the game, its couch, Back to the desk", bar);
    const backLabel = (await pg.locator(".nd-showbar button").first().innerText()).trim();
    check(/^Desk$/.test(backLabel), "the show bar's back says Desk", backLabel);
    const couchLine = (await pg.locator("[data-couch-line]").innerText().catch(() => "")).replace(/\s+/g, " ");
    check(/ZT RO Couch · ZT RO Outlast/.test(couchLine) || couchLine === "", "the couch line: its couch and the game", couchLine);
    const tableRows = await pg.locator(`[data-table="${ids.outlast}"] [data-player]`).count();
    const you = await pg.locator(`[data-table="${ids.outlast}"]`).getByText("You", { exact: true }).count();
    check(tableRows === 4 && you === 0, "Games: its table, four rows, nobody \"you\"", `${tableRows} rows, ${you} you`);
    const foot = (await pg.locator("[data-read-only-foot]").innerText()).trim();
    check(foot === `Through Episode 3, where you are. 4 players · run by ${U("nina")}.`, "the foot line: through 3, where you are; who runs it", foot);
    check((await pg.locator("[data-dock], [data-games-join]").count()) === 0, "no dock, nothing to join");
    await shot("02-games");
    await wide("Games");
    const games = sent.find((s) => s.path === `/api/seasons/${ids.season}/games`);
    check(!!games && games.ro === ids.outlast, "the tab's reads carry the game's id", JSON.stringify(games));

    await pg.locator(`[data-table="${ids.outlast}"] button`, { hasText: "Rules" }).click();
    await pg.waitForSelector("[role=dialog][data-open]", { timeout: 10000 }).catch(() => {});
    check((await pg.locator("[role=dialog][data-open]").count()) > 0, "Rules opens (looking works)");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(500);
    await pg.locator(`[data-player="${U("cole")}"]`).click();
    await pg.waitForSelector("[role=dialog][data-open]", { timeout: 10000 }).catch(() => {});
    const sheet = (await pg.locator("[role=dialog][data-open]").last().innerText().catch(() => "")).replace(/\s+/g, " ");
    check(sheet.toLowerCase().includes(U("cole")), "a person's team opens", sheet.slice(0, 80));
    await shot("03-a-team");
    await pg.keyboard.press("Escape");
    await pg.waitForTimeout(500);

    const writesBefore = sent.filter((s) => s.method !== "GET").length;
    await pg.locator("[data-read-only-menu]").click();
    check((await toasted(/Read-only/)) === SAYS, "the ⋯ menu says Read-only");

    await tab("tonight");
    const tonight = (await pg.locator('[data-read-only-panel="tonight"]').innerText()).replace(/\s+/g, " ");
    check(/Tonight is each player's own/i.test(tonight) && /act as them from their seat/.test(tonight) && /Its seats, on the desk/.test(tonight), "Tonight: each player's own, act as them from their seat", tonight);
    await shot("04-tonight");
    await wide("Tonight");
    await tab("chat");
    const chat = (await pg.locator('[data-read-only-panel="chat"]').innerText()).replace(/\s+/g, " ");
    check(/ZT RO Couch's chat is theirs/i.test(chat), "Chat: the couch's chat is theirs", chat);
    await shot("05-chat");
    check(!sent.some((s) => /\/chat/.test(s.path)), "nothing reads the couch's chat (nor its count)", sent.filter((s) => /\/chat/.test(s.path)).map((s) => s.path).join(","));

    await tab("episodes");
    await pg.waitForSelector('[data-ep="3"]', { timeout: 30000 });
    const e3 = (await pg.locator('[data-ep="3"]').innerText()).replace(/\s+/g, " ");
    check(/Scored in ZT RO Outlast/.test(e3) && !/\bYou\b/.test(e3), "Episodes: \"Scored in ZT RO Outlast\", nobody's night", e3);
    check((await pg.locator("[data-ep]").count()) === 3 && (await pg.locator("[data-ep-hidden]").count()) === 2, "three seen, two hidden past your mark");
    await shot("06-episodes");
    await wide("Episodes");
    await pg.locator("[data-reveal-plate]").click();
    check((await toasted(/Read-only/)) === SAYS, "Reveal says Read-only");
    await pg.waitForTimeout(400);
    check((await pg.locator("[data-reveal-screen], [data-reveal]").count()) === 0, "and nothing opens");
    await pg.locator('[data-ep="2"]').click();
    await pg.waitForSelector('[data-episode-page="2"]', { timeout: 15000 });
    await pg.waitForTimeout(700);
    await shot("07-episode");
    const flag = pg.locator("[data-something-wrong]").first();
    if (await flag.count()) {
      await flag.click();
      check((await toasted(/Read-only/)) === SAYS, "an episode's \"Something wrong?\" says Read-only");
    }
    check(sent.filter((s) => s.method !== "GET").length === writesBefore, "no write left the tab", JSON.stringify(sent.filter((s) => s.method !== "GET").slice(-3)));
    await pg.goBack();
    await pg.waitForTimeout(700);

    await tab("cast");
    await pg.waitForSelector("[data-explorer], [data-cast]", { timeout: 30000 });
    await pg.waitForTimeout(700);
    const castText = await pg.locator("main").innerText();
    check(!/Your team/.test(castText), "Cast: no Your team");
    await shot("08-cast");
    await wide("Cast");

    await pg.locator("[data-read-only-back]").click();
    await pg.waitForURL(new RegExp(`/desk/game/${ids.outlast}`), { timeout: 30000 });
    await pg.waitForSelector("[data-desk-game]", { timeout: 30000 });
    await pg.waitForTimeout(500);
    check((await roNow()) === null && (await pg.locator("[data-read-only-bar]").count()) === 0, "Back to the desk: the game's page, read-only over");
    const hist = await pg.locator("body").innerText();
    check(/Opened read-only/.test(hist), "its History says Opened read-only");
    await shot("09-back-on-the-desk");
    const after = sent.length;
    await pg.waitForTimeout(300);
    check(sent.slice(after).every((s) => !s.ro), "nothing carries the header once it's over");

    await openIt();
    await pg.locator(".nd-showbar button").first().click();
    await pg.waitForURL(new RegExp(`/desk/game/${ids.outlast}`), { timeout: 30000 });
    await pg.waitForTimeout(500);
    check((await roNow()) === null, "the show bar's Desk ends it too");

    await openIt();
    await tab("tonight");
    await pg.locator("[data-read-only-seats]").click();
    await pg.waitForURL(new RegExp(`/desk/game/${ids.outlast}`), { timeout: 30000 });
    await pg.waitForTimeout(500);
    check((await roNow()) === null, "\"Its seats, on the desk\" too");

    await openIt();
    await pg.goto(`${BASE}/home`);
    await pg.waitForTimeout(2500);
    check((await roNow()) === null && (await pg.locator("[data-read-only-bar]").count()) === 0, "leaving the show space (the hub) leaves read-only");
    const mark = sent.length;
    await pg.goto(`${BASE}/show/${ids.season}/games?couch=x`);
    await pg.waitForTimeout(2500);
    check(sent.slice(mark).every((s) => !s.ro) && (await pg.locator("[data-read-only-bar]").count()) === 0, "the show again on its own: your own, no plate, no header");

    await gamePage("pool");
    check(/As it ended, read-only/.test(await pg.locator("[data-game-open]").innerText()), "the archived Pool: As it ended, read-only");
    for (const k of ["practice", "gone"]) {
      await gamePage(k);
      check((await pg.locator("[data-game-open]").count()) === 0, `${k}: no Open row`);
    }
    await gamePage("mine");
    check(/You play it: it opens as you/.test(await pg.locator('[data-game-open="you"]').innerText()), "Mine: You play it: it opens as you");
    await pg.locator("[data-game-open]").click();
    await pg.waitForURL(new RegExp(`/show/${ids.season}/games`), { timeout: 30000 });
    await pg.waitForSelector(`[data-table="${ids.mine}"]`, { timeout: 30000 });
    await pg.waitForTimeout(600);
    check((await pg.locator("[data-read-only-bar]").count()) === 0 && (await pg.locator(`[data-table="${ids.mine}"]`).getByText("You", { exact: true }).count()) === 1, "it opens as them: no plate, their own row");
    await shot("10-mine-as-you");
    check((await opens()) === before + 4, "four opens, four History lines");

    r = await rows();
    check(r.seats === 0 && r.couch === 0, "still no seat or couch row for the site admin", JSON.stringify(r));
    const errs = b.errors.filter((e) => !/Failed to load resource/.test(e));
    check(errs.length === 0, "no page errors", errs.slice(0, 3).join(" | "));
    check(failed.length === 0, "no request failed", failed.slice(0, 4).join(" | "));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    // ---- 6. nothing real moved ----
    check((await pool.query(REAL_USERS)).rows[0].h === realBefore, "every real account is as it was");
    check((await pool.query(REAL_LEAGUES)).rows[0].h === leaguesBefore, "every real league is as it was");
    await pool.end();
    console.log(failures ? `${failures} FAILED` : "all PASS");
    process.exit(failures ? 1 : 0);
  }
})();
