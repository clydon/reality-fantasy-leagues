// Dev-only test bank: a tribe swap from ONE pasted research answer, through to a league. Two starting
// tribes (Toka, Savu) split three ways in episode 4 (Toka, Savu, and a new Dina) -- the shape of
// Survivor 51's episode 4. Checks, through the desk's HTTP routes (an episode's Paste an answer, Accept all and Clear;
// classic admin's research routes until docs/PLAN-desk-parity.md step 8):
//   - the episode prompt lists each person's tribe going in
//   - the answer's newGroup stages one tribe move per person who changed (none for someone who stayed)
//   - accepting the episode gives the league a third tribe and puts everyone on the right one,
//     including the person voted out that episode
//   - "clear everything" for the episode takes it all back out: starting tribes, nobody out, no rows
//
//   node scripts/dev-test/check-tribe-swap.js up
//   node scripts/dev-test/check-tribe-swap.js run          (needs `up` + npm run dev)
//   node scripts/dev-test/check-tribe-swap.js down
//
// Makes a throwaway season (Survivor season 992, "zt-swap", admin-decided, episode 4 aired), a nine-
// person approved cast, one league on it ("zt-swap-league"), and an admin, zt_swapadmin /
// zt-pass-12345. Keyed on season 992 / "zt-swap" / zt-swap- / zt_swapadmin so `down` can't touch real
// data. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");

const SEASON = 992;
const SEASON_NAME = "zt-swap";
const SLUG = "zt-swap-league";
const ADMIN = "zt_swapadmin";
const PASSWORD = "zt-pass-12345";
// [name, starting tribe, tribe after episode 4]
const CAST = [
  ["Ada Zt", "Toka", "Toka"], ["Bea Zt", "Toka", "Dina"], ["Cal Zt", "Toka", "Savu"],
  ["Dee Zt", "Toka", "Dina"], ["Eli Zt", "Savu", "Savu"], ["Fay Zt", "Savu", "Toka"],
  ["Gus Zt", "Savu", "Dina"], ["Hal Zt", "Savu", "Toka"], ["Ivy Zt", "Savu", "Savu"],
];
const BOOTED = "Cal Zt"; // swapped to Savu and voted out the same episode
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

async function down(pool) {
  await pool.query(`DELETE FROM episode_research WHERE season_number=$1 AND show_id=(SELECT id FROM shows WHERE slug='survivor')`, [SEASON]);
  await pool.query(`DELETE FROM leagues WHERE slug=$1`, [SLUG]); // memberships, ledger cascade
  await pool.query(`DELETE FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]); // cast, decisions cascade
  await pool.query(`DELETE FROM "user" WHERE username=$1`, [ADMIN]); // sessions/accounts cascade
}

async function up(pool) {
  await down(pool);
  const premiere = new Date(Date.now() - 4 * 7 * 864e5).toISOString().slice(0, 10);
  const { rows: show } = await pool.query(`SELECT id FROM shows WHERE slug='survivor'`);
  const { rows: season } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count, results_by, cast_size, cast_approved_at)
     VALUES ($1,$2,$3,'airing',$4,'20:00','America/New_York',12,'admin',$5, now()) RETURNING id`,
    [show[0].id, SEASON, SEASON_NAME, premiere, CAST.length]
  );
  for (const [i, [name, tribe]] of CAST.entries()) {
    await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1,$2,$3,$4)`, [season[0].id, name, tribe, i]);
  }

  const { hashPassword } = await import("better-auth/crypto");
  const userId = id();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,true,$2,$2,'admin',now(),now())`,
    [userId, ADMIN, `${ADMIN}@example.invalid`]
  );
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,'credential',$2,$3,now(),now())`,
    [id(), userId, await hashPassword(PASSWORD)]
  );

  // A live league on the season (no members needed: accepting an episode syncs every league on it) with the two starting tribes and episodes 1-3 played.
  const state = S.defaultState();
  state.settings.showId = "survivor";
  state.settings.wikiSeason = SEASON;
  const tribes = { Toka: S.RosterLogic.addTribe(state, "Toka", "#c0392b"), Savu: S.RosterLogic.addTribe(state, "Savu", "#2980b9") };
  for (const [name, start] of CAST) S.RosterLogic.addCastaway(state, name).tribeId = tribes[start].id;
  for (let n = 1; n <= 3; n++) S.EpisodeLogic.ensureEpisodeNumber(state, n, false);
  S.migrateLeagueState(state);
  const { rows: league } = await pool.query(
    `INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ($1,$2,'ZTSWAP',$3,$4) RETURNING id`,
    ["Swap test", SLUG, JSON.stringify(state), userId]
  );
  console.log(`up: season ${season[0].id}, league ${league[0].id}, admin ${ADMIN} / ${PASSWORD}`);
}

// The answer a chat would paste back for episode 4: everyone's new tribe (or null for no change),
// Cal voted out 4-1 at Savu's Tribal.
function answer() {
  const R = require("../../db/episode-research.js");
  const format = require("../../src/lib/game/formats/index.js").formatFor("survivor");
  const a = R.pasteSkeleton({ castNames: CAST.map((c) => c[0]), format }, []);
  Object.assign(a, { episodeTitle: "Swap", airDate: null, summary: "A three-way tribe swap; Savu lost and voted Cal out.", tribalCouncilHeld: "yes", merged: "no", rulesNote: null });
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    const [, start, after] = CAST.find((x) => x[0] === c.name);
    // A chat often restates an unchanged tribe; that must not become a move.
    c.newGroup = after === start ? (c.name === "Eli Zt" ? "Savu" : null) : after;
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  Object.assign(a.castaways.find((c) => c.name === BOOTED), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 4 });
  return JSON.stringify(a);
}

async function run(pool) {
  const { rows } = await pool.query(`SELECT id FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]);
  if (!rows.length) throw new Error("no fixture season: run `up` first");
  const seasonId = rows[0].id;
  const { open, BASE } = require("./browser");
  const { page, close } = await open({ user: ADMIN, pass: PASSWORD });
  const results = [];
  const check = (ok, what) => results.push(`${ok ? "PASS" : "FAIL"} ${what}`);
  const api = async (method, url, data) => {
    const r = await page.request[method](BASE + url, { data, headers: { origin: BASE } });
    if (!r.ok()) throw new Error(`${method} ${url}: ${r.status()} ${await r.text()}`);
    return r.json();
  };
  try {
    const ep = `/api/desk/seasons/${seasonId}/episodes/4`;
    const { prompt } = await api("get", `${ep}/question`);
    check(CAST.every(([name, start]) => prompt.includes(`${name} -- ${start}`)), "prompt lists each person's tribe going in");

    await api("post", ep, { paste: answer(), confirmed: true });
    const { rows: moves } = await pool.query(
      `SELECT castaway_name, method FROM season_decisions WHERE season_id=$1 AND episode_number=4 AND kind='group' ORDER BY castaway_name`,
      [seasonId]
    );
    const want = CAST.filter(([, s, a]) => s !== a).map(([n, , a]) => `${n}->${a}`).sort();
    const got = moves.map((m) => `${m.castaway_name}->${m.method}`).sort();
    check(JSON.stringify(got) === JSON.stringify(want), `staged moves ${got.join(", ")}`);

    // Accept all: whatever the paste left waiting (one source may not be enough to put it in the games). Either way, the
    // league's tribes below say whether it got in; and after clearing, its starting tribes say it came back out.
    const waiting = (await api("get", ep)).facts.filter((f) => f.state === "wait").map((f) => f.id);
    if (waiting.length) await api("post", ep, { acceptAll: waiting });
    const { rows: lg } = await pool.query(`SELECT state FROM leagues WHERE slug=$1`, [SLUG]);
    const state = lg[0].state;
    const tribeName = new Map(state.tribes.map((t) => [t.id, t.name]));
    check(["Toka", "Savu", "Dina"].every((n) => state.tribes.some((t) => t.name === n)) && state.tribes.length === 3, `league tribes: ${state.tribes.map((t) => t.name).join(", ")}`);
    const wrong = CAST.filter(([n, , after]) => tribeName.get(state.castaways.find((c) => c.name === n).tribeId) !== after);
    check(!wrong.length, wrong.length ? `on the wrong tribe: ${wrong.map((w) => w[0]).join(", ")}` : "everyone on their new tribe");
    const cal = state.castaways.find((c) => c.name === BOOTED);
    check(cal.status === "eliminated" && tribeName.get(cal.tribeId) === "Savu", `${BOOTED} out, last on Savu`);

    // Clear everything (the episode page's last resort for accepted bad data): the league goes back to
    // how it was before episode 4 -- starting tribes, nobody out -- and the episode has no rows left.
    const cleared = await api("delete", `${ep}?scope=everything`);
    check(/cleared from every game/.test(cleared.text), `clear everything: "${cleared.text}"`);
    const { rows: after } = await pool.query(`SELECT state FROM leagues WHERE slug=$1`, [SLUG]);
    const s2 = after[0].state;
    const name2 = new Map(s2.tribes.map((t) => [t.id, t.name]));
    const moved = CAST.filter(([n, start]) => name2.get(s2.castaways.find((c) => c.name === n).tribeId) !== start);
    check(!moved.length, moved.length ? `still moved after clearing: ${moved.map((m) => m[0]).join(", ")}` : "everyone back on their starting tribe");
    check(s2.castaways.every((c) => c.status === "active"), "nobody out after clearing");
    const { rows: left } = await pool.query(`SELECT count(*)::int n FROM season_decisions WHERE season_id=$1 AND episode_number=4`, [seasonId]);
    check(left[0].n === 0, `episode 4 rows left: ${left[0].n}`);
  } finally {
    await close();
  }
  for (const r of results) console.log(r);
  if (results.some((r) => r.startsWith("FAIL"))) process.exitCode = 1;
}

(async () => {
  const [cmd] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    if (cmd === "up") await up(pool);
    else if (cmd === "down") { await down(pool); console.log("down: removed"); }
    else if (cmd === "run") await run(pool);
    else throw new Error("usage: check-tribe-swap.js up | run | down");
  } finally {
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
