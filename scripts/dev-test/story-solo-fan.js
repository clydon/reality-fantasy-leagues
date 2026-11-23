// Dev-only: solo sports play (docs/PLAN-sports-couch.md C4; the design: docs/design-round/solo-fan-spec.md, -first-view.md, -shape.md):
// a fan on no couch calling his team's games into his own calls, the season call, a draft against computer players, This week's and
// Games' solo forms, for a design round's screenshot story and as a check of /api/sports/own and the no-couch start. On solo-fixture.js's
// zt_so_alex (no couch) and the stand-in ESPN (fake-espn.js by the x-gys-sports header; the real ESPN is never asked), the league story's
// midweek world (league-story-world.js) with five more Lions games after this week's Bears at Lions, so a season is left to call.
// A season of Alex's calls is seeded (made up, marked so in the story): his calls game started at a clock before Week 1 through the real
// server functions, and his calls on eight of the Lions' past games written into its answers as the call would have made them.
//   week-due       This week with his calls started and this week's call taken back: the strip's move
//   games-due      Games then: his calls with its move
//   first          Alex's Lions page before any call: Your call (the yellow), "Your record starts here", the season row; .full
//   team           after the seeded season: the fan band (Your calls 6–2, the ticks), Your call; .full
//   team-called    after tapping Lions: "You called Lions", Change
//   week           This week: Your calls card, the table's line; .full
//   season-sheet   Call the season: the record now, the stepper at the record's pace, the track
//   season-less    the stepper two wins down
//   season-called  the row after Call it: "Your season call", at 8–2–1, needs N of 6, has 0
//   games          the Games tab: your games, Your team, the couch line
//   season-game    the season call's own game page (UI-REVIEW-MAP: the new settle); .full
//   calls-game     his calls' own game page; .full
//   wizard         "A draft of Lions players": the wizard open on the draft with three computer players
//   draft-started  after Start: the draft's own page (his own game, three computer players)
//   hidden         hiding sports scores: the call and the called record stay; the record, ticks and how it's going wait
//   studio         the team page in the light theme
//   over           Bears at Lions final, 27-20: "You called it", the record moved
//   settled        the Lions' season over: the season call's verdict
//   couch-fan      a couch member (zt_nd alex) on his Eagles: C2's card, his season call row (when the zt_nd couch is up)
// With --before (the old code checked out): first (the Lions page for a solo fan). Each frame: a .jpg at --width × --height, its words
// in a .txt, and words over words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE) and migration 0453. The zt_nd couch for couch-fan (census-app.js --up, or new-fixture.js up; --up brings it
// up). Every row it makes is a zt one and is removed after (check-sports-couch.js cleanup; the solo fixture taken down), unless --keep.
// One check at a time on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-solo-fan.js [--before] [--only=first,team] [--out=...]
//          [--width=390 --height=844] [--up] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const soloFx = require("./solo-fixture");
const fakeEspn = require("./fake-espn");
const world = require("./check-sports-couch");
const { overlapsIn } = require("./overlaps");
const { now, at, HR, D, TEAMS, footballFor, COUCH, STANDINGS, E, B, L, GB, PIT, FB } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-solo-fan runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const BEFORE = has("before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/solo-fan/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const OVERLAPS = [];
let fails = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `  ${detail}` : ""}`);
  if (!ok) fails++;
};

/** The world: the league story's midweek (Bears at Lions in three days), and five more Lions games after it. */
function events() {
  const xs = footballFor(6, true);
  const more = [B, GB, PIT, B, GB].map((opp, i) => ({ league: FB, id: `9668${i}`, at: at((10 + 7 * i) * D + 2 * HR), home: i % 2 ? opp : L, away: i % 2 ? L : opp, state: "pre", network: "FOX" }));
  return [...xs, ...more];
}

/** The stand-in's teams, the Lions with a made-up roster (so a draft of their players has players: the stand-in lists none). */
const POS = [["QB", "Quarterback"], ["RB", "Running Back"], ["RB", "Running Back"], ["WR", "Wide Receiver"], ["WR", "Wide Receiver"], ["WR", "Wide Receiver"], ["TE", "Tight End"], ["K", "Place Kicker"]];
const teams = () =>
  TEAMS.map((t) => (t.id === L ? { ...t, roster: Array.from({ length: 16 }, (_, i) => ({ id: `zt-so-lion-${i + 1}`, name: `ZT Lion ${i + 1}`, position: POS[i % POS.length][1], abbr: POS[i % POS.length][0] })) } : t));

async function setting(pool, user, col, v) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query(`UPDATE user_settings SET ${col} = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)`, [user, v]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const espn = await fakeEspn.start({ teams: [...teams(), ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars: world.calendarsAround(), standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const so = soloFx.username("alex");
  let soloUp = false;
  try {
    for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    espn.events.push(...events());
    await soloFx.up(pool);
    soloUp = true;
    const me = await signIn({ user: so, pass: soloFx.PASSWORD, headers });
    for (const team of [E, L]) await me.call("POST", "/api/sports/follow", { league: FB, team, follow: true });
    const alexId = (await pool.query('SELECT id FROM "user" WHERE username = $1', [so])).rows[0].id;
    const bl = espn.events.find((e) => e.id === "96652");

    const shoot = async (name, go, o = {}) => {
      if (ONLY && !ONLY.includes(name)) return null;
      const b = await open({ user: o.user ?? so, pass: o.pass ?? soloFx.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + (o.path ?? `/league/${FB}/team/${L}`), { waitUntil: "domcontentloaded" });
        await b.page.locator(o.wait ?? "[data-team-page]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(4000);
        if (o.scroll) {
          const el = b.page.locator(o.scroll).first();
          if (await el.count()) await el.evaluate((x) => window.scrollBy(0, x.getBoundingClientRect().top - 140));
          await b.page.waitForTimeout(500);
        }
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (o.full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate(() => {
          const txt = (sel) => document.querySelector(sel)?.innerText.replace(/\s+/g, " ").trim() ?? null;
          const top = (sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r && r.height ? `${Math.round(r.top)}-${Math.round(r.bottom)}` : null;
          };
          return {
            wide: document.documentElement.scrollWidth,
            yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20 && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0).length,
            fan: txt("[data-fan-card]"),
            callRow: txt("[data-team-now] [data-call-row]"),
            season: txt("[data-season-call]"),
            seasonState: document.querySelector("[data-season-call]")?.getAttribute("data-season-call") ?? null,
            card: txt("[data-calls-card]"),
            more: txt("[data-team-more]"),
            games: txt("[data-league-games-tab]"),
            sheet: txt("[data-season-sheet]"),
            strip: txt("[data-league-move]"),
            wizard: txt("[role=dialog]"),
            where: ["[data-team-head]", "[data-fan-card]", "[data-team-now]", "[data-call-row]", "[data-season-call]", "[data-team-more]", "[data-calls-card]", "[data-couch-table]"].map((s) => [s, top(s)]).filter(([, r]) => r).map(([s, r]) => `${s} ${r}`).join(" · "),
          };
        });
        console.log(`SHOT ${name}  ${info.wide} px wide, ${info.yellow} yellow in view`);
        console.log(`      where: ${info.where}`);
        for (const k of ["strip", "fan", "callRow", "season", "card", "more", "games", "sheet", "wizard"]) if (info[k]) console.log(`      ${k}: ${info[k].slice(0, 300)}`);
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        fails++;
        return null;
      } finally {
        await b.close();
      }
    };
    const tap = (sel, wait = 1800) => async (pg) => {
      await pg.locator(sel).first().click();
      await pg.waitForTimeout(wait);
    };

    if (BEFORE) {
      await shoot("first", null, { full: true });
      return;
    }

    // Before anything: Alex's first look, then the API's rules.
    const f0 = await shoot("first", null, { full: true });
    if (f0) {
      check(f0.yellow === 1, "one yellow on the solo team page: his call", `${f0.yellow}`);
      check(!f0.fan, "no fan band before the first call (PFD's R1)");
      check(/Your record starts here/.test(f0.callRow ?? ""), "the first-time line under the call");
      check(f0.seasonState === "none", "the season row offers the season call", f0.season ?? "");
      check(/A draft of Lions players/.test(f0.more ?? "") && /Start a couch/.test(f0.more ?? ""), "More on the Lions, the couch line last");
    }
    const own = async () => (await me.call("GET", `/api/sports/own?league=${encodeURIComponent(FB)}&teams=${L}`)).body;
    const ownLeagues = async () => (await pool.query("SELECT id, solo, couch_id, name FROM leagues WHERE created_by = $1 AND solo = 'own' AND deleted_at IS NULL ORDER BY created_at", [alexId])).rows;
    const first = await me.call("POST", "/api/sports/own", { league: FB, team: L, event: bl.id, side: L });
    check(first.status === 200 && first.body.calls?.some((c) => c.event === bl.id && c.picks[0]?.side === L), "his first call starts his calls and answers it", `${first.status} ${JSON.stringify(first.body).slice(0, 160)}`);
    let ls = await ownLeagues();
    check(ls.length === 1 && ls[0].couch_id === null, "one own game, on no couch", JSON.stringify(ls));
    // A later game's call opens with its week (the engine's: answers are open for the next game only).
    const again = await me.call("POST", "/api/sports/own", { league: FB, team: L, event: "96680", side: B });
    check(again.status === 409 && /open for/.test(again.body?.error ?? "") && (await ownLeagues()).length === 1, "a later game's call waits for its week, no second game", `${again.status} ${again.body?.error ?? ""}`);
    const changed = await me.call("POST", "/api/sports/own", { league: FB, team: L, event: bl.id, side: B });
    check(changed.status === 200 && changed.body.calls.find((c) => c.event === bl.id)?.picks[0]?.side === B, "changed until kickoff");
    // His calls with this week's call taken back: the move it puts on This week's strip and on Games (PFD's gap: it names the game).
    await me.call("POST", "/api/sports/own", { league: FB, team: L, event: bl.id, side: null });
    const wd = await shoot("week-due", null, { path: `/league/${FB}/week`, wait: "[data-this-week]" });
    if (wd) check(/Call the Lions game/.test(wd.strip ?? ""), "the weekly move names the call (PFD's gap)", wd.strip ?? "(none)");
    await shoot("games-due", null, { path: `/league/${FB}/games`, wait: "[data-league-games-tab]" });
    await me.call("POST", "/api/sports/own", { league: FB, team: L, event: bl.id, side: B });
    const past = espn.events.find((e) => e.state === "post" && (e.home === L || e.away === L));
    const late = await me.call("POST", "/api/sports/own", { league: FB, team: L, event: past.id, side: L });
    check(late.status === 409, "a call after kickoff refused", `${late.status} ${late.body?.error ?? ""}`);
    const tooMany = await me.call("POST", "/api/sports/own", { league: FB, team: L, wins: 99 });
    check(tooMany.status === 400, "a season call past the games left refused", `${tooMany.status} ${tooMany.body?.error ?? ""}`);
    const couches = (await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE user_id = $1", [alexId])).rows[0].n;
    check(couches === 0, "no couch made around his own game (healCouches skips it)", `${couches}`);
    const pushes = (await pool.query("SELECT count(*)::int AS n FROM notifications WHERE created_at > now() - interval '5 minutes' AND user_id = $1", [alexId]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    check(pushes === 0, "no push for his own calls", `${pushes}`);
    // Back to a clean slate for the frames: the test games taken away (their answers with them).
    await pool.query("DELETE FROM leagues WHERE created_by = $1 AND solo = 'own'", [alexId]);

    // A season of Alex's calls (made up): a calls game over Weeks 1-11, started a day before Week 1 through the real functions, his calls
    // on nine of the Lions' past games written into its answers (the engine rightly refuses an answer on a played game), then archived:
    // the stand-in world keeps no stored finals, so a game over the whole season couldn't move past Week 1 here (the real one moves on as
    // each final is read). This week's call starts his calls again from Week 12; the record reads both (own.ts counts archived games).
    const { startSport } = jiti("../../src/lib/server/sports/start.ts");
    const { addGames } = jiti("../../src/lib/server/sports/find.ts");
    const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
    const providers = sportsProviders({ base: espn.url });
    const alex = { id: alexId, username: so, name: so };
    const lions = espn.events.filter((e) => e.state === "post" && (e.home === L || e.away === L)).sort((a, b) => a.at.localeCompare(b.at));
    const clock = { providers, now: new Date(Date.parse(lions[0].at) - D) };
    const season = await addGames(alexId, { league: FB, team: L, whole: "season" }, clock);
    const { rows: lastPast } = await pool.query("SELECT max(episode)::int AS n FROM season_events WHERE season_id = $1 AND event_id = ANY($2::text[])", [season.seasonId, lions.map((e) => e.id)]);
    const started = await startSport(alex, null, { seasonId: season.seasonId, game: "own-calls", from: 1, to: lastPast[0].n, name: "Lions calls, made up", tell: false, pace: "live" }, clock);
    const { rows: seat } = await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [started.leagueId, alexId]);
    const { rows: eps } = await pool.query("SELECT episode, event_id FROM season_events WHERE season_id = $1", [season.seasonId]);
    const epOf = new Map(eps.map((r) => [r.event_id, r.episode]));
    // Lions every time but twice; skips two weeks (a gap in the ticks).
    const plan = ["L", "L", null, "L", "opp", "L", "L", null, "L", "L", "L"];
    for (const [i, e] of lions.entries()) {
      const p = plan[i];
      if (!p) continue;
      const side = p === "L" ? L : e.home === L ? e.away : e.home;
      await pool.query(
        `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by) VALUES ($1, $2, 'yourCall', $3, to_jsonb($4::text), $5)
         ON CONFLICT (league_id, player_id, question, episode) DO UPDATE SET answer = EXCLUDED.answer`,
        [started.leagueId, seat[0].player_id, epOf.get(e.id), side, alexId]
      );
    }
    await pool.query("UPDATE leagues SET state = jsonb_set(state, '{settings,archivedAt}', to_jsonb(now()::text)) WHERE id = $1", [started.leagueId]);
    const seeded = await own();
    check((seeded.calls ?? []).length >= 8, "eight past calls seeded", `${(seeded.calls ?? []).length}`);

    const t = await shoot("team", null, { full: true });
    if (t) {
      check(t.yellow === 1, "one yellow: his call", `${t.yellow}`);
      check(/Your calls on the Lions/.test(t.fan ?? "") && !/couch/i.test(t.fan ?? ""), "the fan band, solo: his calls on the Lions, nothing about a couch", t.fan ?? "");
    }
    await shoot("team-called", tap(`[data-team-now] [data-call-pick="${L}"]`));
    const called = await own();
    check(called.calls.some((c) => c.event === bl.id && c.picks[0]?.side === L), "the real button made the call into the seeded game", "");
    check((await ownLeagues()).length === 2, "this week's call started his calls from Week 12 (the made-up history's game archived)", `${(await ownLeagues()).length}`);
    const wk = await shoot("week", null, { path: `/league/${FB}/week`, wait: "[data-this-week]", full: true });
    if (wk) check(/your calls/i.test(wk.card ?? "") && /Lions vs Bears/.test(wk.card ?? ""), "This week's solo calls card", wk.card ?? "");
    await shoot("season-sheet", tap("[data-season-call-open]"), { scroll: "[data-season-call]" });
    await shoot("season-less", async (pg) => {
      await tap("[data-season-call-open]")(pg);
      await tap("[data-season-less]", 300)(pg);
      await tap("[data-season-less]", 600)(pg);
    }, { scroll: "[data-season-call]" });
    const sc = await shoot("season-called", async (pg) => {
      await tap("[data-season-call-open]")(pg);
      await tap("[data-season-call-it]", 3500)(pg);
      await pg.locator("[data-season-call]").first().evaluate((x) => window.scrollBy(0, x.getBoundingClientRect().top - 300));
      await pg.waitForTimeout(400);
    }, { scroll: "[data-season-call]" });
    if (sc) check(sc.seasonState === "called", "the season call made from the sheet", sc.season ?? "");
    if (!(await own()).seasons?.length) await me.call("POST", "/api/sports/own", { league: FB, team: L, wins: 5 });
    const second = await me.call("POST", "/api/sports/own", { league: FB, team: L, wins: 3 });
    check(second.status === 409, "one call a season", `${second.status} ${second.body?.error ?? ""}`);
    const g = await shoot("games", null, { path: `/league/${FB}/games`, wait: "[data-league-games-tab]", full: true });
    if (g) check(/Lions calls/i.test(g.games ?? "") && /Lions season call/i.test(g.games ?? "") && /Every Lions game/.test(g.games ?? ""), "Games: his own games and Your team", (g.games ?? "").slice(0, 200));
    // UI-REVIEW-MAP (a new settle, a team's wins, and a number right within N): the season call's and the calls' own game pages.
    const gameOf = async (like) => (await pool.query(`SELECT l.id, ss.id AS season FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId' JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason' WHERE l.created_by = $1 AND l.solo = 'own' AND l.name = $2`, [alexId, like])).rows[0];
    for (const [frame, name] of [["season-game", "Lions season call"], ["calls-game", "Lions calls"]]) {
      const x = await gameOf(name);
      if (x) await shoot(frame, null, { path: `/show/${x.season}/game/${x.id}`, wait: "[data-game-page]", full: true });
      else console.log(`SKIP ${frame}: no ${name} game`);
    }
    const wz = await shoot("wizard", tap('[data-open-row="solo-draft"]', 9000), { scroll: "[data-team-more]" });
    if (wz) check(/3 computer players/i.test(wz.wizard ?? "") && !/more than the Lions/.test(wz.wizard ?? ""), "the wizard opens on the draft with three computer players, ready to start", (wz.wizard ?? "").slice(0, 200));
    // Start it: the draft on no couch, him and three computer players (it plays today: E1's).
    const ds = await shoot("draft-started", async (pg) => {
      await tap('[data-open-row="solo-draft"]', 9000)(pg);
      await tap("[role=dialog] [data-gallery-start]", 9000)(pg);
    }, { scroll: "[data-team-more]" });
    const draft = (await pool.query("SELECT l.id, l.couch_id, l.solo, jsonb_array_length(l.state->'players') AS seats FROM leagues l WHERE l.created_by = $1 AND l.solo = 'own' AND l.name ILIKE '%draft%'", [alexId])).rows[0];
    check(!!draft && draft.couch_id === null && draft.seats === 4, "the draft started as his own game: him and three computer players", JSON.stringify(draft ?? null));
    await setting(pool, so, "hide_sports_scores", true);
    const hd = await shoot("hidden", null, { full: true });
    if (hd) check(!/\d+–\d+/.test(hd.fan ?? "") && !/\d+–\d+/.test(hd.season ?? "") && /hidden/.test(hd.season ?? ""), "hidden: no record anywhere, how it's going hidden", `${hd.fan} | ${hd.season}`);
    await setting(pool, so, "hide_sports_scores", false);
    await setting(pool, so, "theme", "studio");
    await shoot("studio");
    await setting(pool, so, "theme", "night");

    // Bears at Lions final: Lions 27-20 (a final's score is home first).
    Object.assign(bl, { state: "post", at: new Date(now - 3.5 * HR).toISOString(), score: [27, 20] });
    await pool.query("UPDATE season_events SET starts_at = $2 WHERE league = $1 AND event_id = $3", [FB, bl.at, bl.id]);
    await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
    const ov = await shoot("over", null, { path: `/league/${FB}/week`, wait: "[data-this-week]" });
    if (ov) check(/You called it/i.test(ov.card ?? "") && /6–3–1/.test(ov.card ?? ""), "the result: called it, the record moved", ov.card ?? "");
    // The rest of their season played, in order after it (won, won, won, lost, lost: 4 of the 6 the call covers): its verdict.
    const rest = [[24, 17], [17, 24], [21, 20], [27, 13], [10, 16]];
    for (const [i, e] of espn.events.filter((x) => x.id.startsWith("9668")).entries()) {
      Object.assign(e, { state: "post", at: new Date(now - (3 - 0.5 * i) * HR).toISOString(), score: rest[i] });
      await pool.query("UPDATE season_events SET starts_at = $2 WHERE league = $1 AND event_id = $3", [FB, e.at, e.id]);
    }
    await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
    const se = await shoot("settled", null, { scroll: "[data-season-call]" });
    if (se) check(se.seasonState === "settled" && /Off by 1/i.test(se.season ?? "") && /12–4–1/.test(se.season ?? ""), "the season call settled: 13–3–1 called, 12–4–1 finished, off by 1", se.season ?? "");

    // A couch member's own season call row (C2's card above it).
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (couch && (!ONLY || ONLY.includes("couch-fan"))) {
      espn.events.length = 0;
      espn.events.push(...events());
      await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
      for (const [who, league, team] of COUCH) await (await signIn({ user: fixture.username(who), pass: fixture.PASSWORD, headers })).call("POST", "/api/sports/follow", { league, team, follow: true });
      const cf = await shoot("couch-fan", null, { user: fixture.username("alex"), pass: fixture.PASSWORD, path: `/league/${FB}/team/${E}`, scroll: "[data-team-now]" });
      if (cf) check(cf.seasonState === "none", "a couch fan's season call row", cf.season ?? "");
    } else if (!couch) console.log("SKIP couch-fan: the zt_nd couch isn't up (--up)");
  } finally {
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 2));
    if (!has("keep")) {
      await world.cleanup(pool).catch((e) => console.log(`cleanup: ${e.message}`));
      if (soloUp) await soloFx.down(pool).catch((e) => console.log(`solo fixture not taken down: ${e.message}`));
    }
    await espn.close?.();
    await pool.end();
    await appPool.end().catch(() => {});
  }
  console.log(fails ? `\n${fails} failed` : "\nall passed");
  process.exitCode = fails ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
