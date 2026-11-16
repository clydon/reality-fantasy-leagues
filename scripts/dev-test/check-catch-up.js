// Dev-only check of the catch-up's scoring guard (docs/PLAN-cast-properties.md chunk 6c; src/lib/server/community-results.ts
// tryResults, src/lib/server/catch-up.ts): on results-fixture.js's throwaway season (Survivor 990, "zt-results", three games,
// Episode 4 aired with no results), no bot needed.
//   1. The try: an answer saying someone went home in Episode 4 is tried (POST .../catchup { try: 4, facts }). It must name the
//      games whose totals move, and write nothing: every game's state, the season's results and answers exactly as before.
//   2. The hold on the desk: that answer held (a catchup_holds row, as the catch-up writes one), the episode's desk page at 390
//      (a screenshot, --out), Send it pressed: each game's totals afterwards must be what the try said (for a game that has
//      revealed Episode 4; one that hasn't keeps its totals until it does).
//   3. Leave it out: a second hold, left out through the route, changes nothing.
//
//   node scripts/dev-test/check-catch-up.js [--out=<dir>] [--keep]
//
// Needs the lane's dev server (BASE, default http://localhost:3000; the lane's own port in its .env.local) and the local
// database. Makes zt_rs_desk (cast-props-research.js up) for the desk, puts the fixture up and takes it down after (--keep
// leaves it). Every row is the fixture's own zt- rows. Exit 1 on any failure.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { api, open, BASE } = require("./browser");
const Fixture = require("./results-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-catch-up runs against a local database only");
const args = process.argv.slice(2);
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const OUT = opt("out");
let failed = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failed++;
};

const totals = (state) => Object.fromEntries(S.computeScores(S.migrateLeagueState(JSON.parse(JSON.stringify(state)))).map((r) => [r.playerId, Math.round(r.total * 100) / 100]));

async function snapshot(pool, seasonId) {
  const { rows: leagues } = await pool.query(
    "SELECT id, name, state FROM leagues WHERE state->'settings'->>'showId' = 'survivor' AND state->'settings'->>'wikiSeason' = '990' AND deleted_at IS NULL ORDER BY name"
  );
  const { rows: d } = await pool.query("SELECT count(*)::int AS n, md5(string_agg(id::text || status || COALESCE(fact_status, '') || COALESCE(method, ''), ',' ORDER BY id)) AS at FROM season_decisions WHERE season_id = $1", [seasonId]);
  const { rows: r } = await pool.query("SELECT count(*)::int AS n FROM episode_research WHERE season_number = 990");
  return { leagues, decisions: d[0], research: r[0].n };
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    execFileSync(process.execPath, [path.join(__dirname, "cast-props-research.js"), "up"], { stdio: "inherit" });
    await pool.query("DELETE FROM episode_research WHERE season_number = 990 AND show_id = (SELECT id FROM shows WHERE slug = 'survivor')");
    await Fixture.down(pool);
    await Fixture.up(pool, ["--when=aired"]);
    const { rows: s } = await pool.query("SELECT id FROM show_seasons WHERE season_number = 990 AND name = 'zt-results'");
    const seasonId = s[0].id;
    const as = await api({ user: "zt_rs_desk", pass: "zt-pass-12345" });
    console.log(`against ${BASE}, season ${seasonId}`);

    // Someone on the Classic game's first team, so their exit scores.
    const before = await snapshot(pool, seasonId);
    const classic = before.leagues.find((l) => (l.state.settings.leagueTypeId || "") === "classic-draft") || before.leagues[0];
    const team = classic.state.players[0];
    const pick = (team.roster || team.castaways || [])[0];
    const victim = classic.state.castaways.find((c) => c.id === pick || c.id === pick?.id)?.name || classic.state.castaways[3].name;
    const facts = [{ kind: "elimination", castawayName: victim, method: "Voted Out", confidence: "high" }];

    console.log("1. the try");
    const tried = await as.call("POST", `/api/desk/seasons/${seasonId}/catchup`, { try: 4, facts });
    check(tried.status === 200, `the try answers (${tried.status})`);
    const games = tried.body.games || [];
    check((tried.body.changes || []).some((c) => c.name === victim && c.how === "in"), `it says what changes (${(tried.body.changes || []).map((c) => `${c.name} ${c.label} ${c.how}`).join("; ")})`);
    check(games.length > 0, `it names the games whose totals move (${games.map((g) => `${g.name}: ${g.players.length} players`).join("; ") || "none"})`);
    const after = await snapshot(pool, seasonId);
    check(JSON.stringify(after.leagues.map((l) => l.state)) === JSON.stringify(before.leagues.map((l) => l.state)), "every game's state is as it was");
    check(after.decisions.n === before.decisions.n && String(after.decisions.at) === String(before.decisions.at), "the season's results are as they were");
    check(after.research === before.research, "no answer was filed");

    console.log("2. held, then Send it on the desk");
    const answer = { seasonId, episode: 4, source: "catchup", userId: null, couchId: null, covers: { people: classic.state.castaways.map((c) => c.name), kinds: null }, replaces: true, payload: { facts } };
    const { rows: h } = await pool.query("INSERT INTO catchup_holds (season_id, episode_number, answer, facts, moves) VALUES ($1, 4, $2::jsonb, $3::jsonb, $4::jsonb) RETURNING id", [
      seasonId,
      JSON.stringify(answer),
      JSON.stringify(facts),
      JSON.stringify(tried.body),
    ]);
    const { page, close } = await open({ user: "zt_rs_desk", pass: "zt-pass-12345", width: 390, height: 844 });
    try {
      await page.goto(`${BASE}/desk/season/${seasonId}/e/4`);
      const held = page.locator("[data-catchup-held]");
      await held.waitFor({ timeout: 30000 });
      check(true, "the episode's desk page shows Would change scores");
      // Names show once Hide names is off (the desk reader hasn't seen Episode 4).
      const hide = page.locator("[data-hide-names=on]");
      if (await hide.count()) await hide.click();
      await page.locator("[data-catchup-changes]").waitFor({ timeout: 10000 });
      check((await page.locator("[data-catchup-changes]").innerText()).includes(victim), "it says what changes, by name, with Hide names off");
      if (OUT) {
        fs.mkdirSync(OUT, { recursive: true });
        await held.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(OUT, "catchup-held-390.png") });
      }
      const inbox = await as.call("GET", "/api/desk/inbox");
      const items = (inbox.body.items || []).filter((i) => i.kind === "catchup" && i.href.includes(seasonId));
      check(items.length === 1, `the Inbox has it (${items.map((i) => i.title).join("; ") || "nothing"})`);
      await page.locator("[data-catchup-send]").click();
      await held.waitFor({ state: "detached", timeout: 30000 });
      check(true, "Send it: the block goes");
    } finally {
      await close();
    }
    const sent = await snapshot(pool, seasonId);
    for (const g of games) {
      const l = sent.leagues.find((x) => x.id === g.leagueId);
      const gate = l.state.settings.revealedThroughEpisode;
      if (Number.isInteger(gate) && gate < 4) {
        check(true, `${g.name} hasn't revealed Episode 4: its totals move when it does`);
        continue;
      }
      const t = totals(l.state);
      const wrong = g.players.filter((p) => Math.abs((t[p.playerId] ?? 0) - p.after) > 0.001);
      check(!wrong.length, `${g.name}: totals are what the try said${wrong.length ? ` (${wrong.map((p) => `${p.name} ${t[p.playerId]} not ${p.after}`).join(", ")})` : ""}`);
    }
    const { rows: decided } = await pool.query("SELECT decision FROM catchup_holds WHERE id = $1", [h[0].id]);
    check(decided[0].decision === "sent", "the hold is marked sent");

    console.log("3. Leave it out");
    const other = classic.state.castaways.find((c) => c.name !== victim && !c.eliminated)?.name;
    const facts2 = [{ kind: "elimination", castawayName: other, method: "Voted Out", confidence: "high" }];
    const { rows: h2 } = await pool.query("INSERT INTO catchup_holds (season_id, episode_number, answer, facts, moves) VALUES ($1, 5, $2::jsonb, $3::jsonb, '[]'::jsonb) RETURNING id", [
      seasonId,
      JSON.stringify({ ...answer, episode: 5, payload: { facts: facts2 } }),
      JSON.stringify(facts2),
    ]);
    const was = await snapshot(pool, seasonId);
    const left = await as.call("POST", `/api/desk/seasons/${seasonId}/catchup`, { hold: h2[0].id, decision: "left" });
    check(left.status === 200, `Leave it out answers (${left.status} ${left.body.text ?? ""})`);
    const now = await snapshot(pool, seasonId);
    check(JSON.stringify(now.leagues.map((l) => l.state)) === JSON.stringify(was.leagues.map((l) => l.state)) && now.research === was.research, "nothing changed");
  } catch (e) {
    console.error(e);
    failed++;
  } finally {
    if (!args.includes("--keep")) {
      // The answers Send it filed (keyed on the show and season number, so the season's delete doesn't take them).
      await pool.query("DELETE FROM episode_research WHERE season_number = 990 AND show_id = (SELECT id FROM shows WHERE slug = 'survivor')").catch(() => undefined);
      await Fixture.down(pool).catch((e) => console.error("down:", e.message));
    }
    await pool.end();
    console.log(failed ? `${failed} failed` : "all passed");
    process.exitCode = failed ? 1 : 0;
  }
})();
