// Dev-only check for Start a game that fits, Run it back, and archiving or deleting a game (docs/PLAN-new-design.md step 10
// part 2b), against the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51's three linked
// games; casey on a couch of their own) with hub-fixture.js's two finished seasons, a stand-in for TVmaze (fake-listings.js:
// ZT Yacht Life a reality series, ZT Grand Prix a sport, ZT Love Shack a reality competition, plus ZT Late Night, a talk show
// this check adds) and a stand-in for our bot (fake-bot.js), which make those shows games through Make it a game first.
//   API:
//   - what fits each kind (rulebook-fits.js through GET /start): a competition all three (Survival Pool recommended), a
//     series Weekly Lineup (draft the crew), a sport the draft of athletes and Survival Pool (its own word for an event), a
//     talk show Weekly Bingo and Weekly Calls coming with step 12; the doesn't-fit line; who watches it; where it starts;
//     a show that isn't a game yet, and a season that's over (with the show's next season to run it back on);
//   - starting one: jordan's Weekly Lineup on ZT Survivor 51 (from Episode 6, linked into the couch's group, the couch told:
//     three pushes, a line in Recent changes and the couch's feed, the season's results there as history so alex joins
//     into its draft), names kept apart ("Weekly Lineup 2"), refusals (off the couch, a game that doesn't fit, one that's
//     coming), a made series and sport playing by their season's rulebook and stored format (made-<slug>), the sport's
//     shared draft and its pool surviving by scoring, the couch's own rules (Make it ours) reaching a new game;
//   - Run it back: the hub's finished games and the show's next season, the same game with its name and settings;
//   - pools and practice couches for a competition a player made a game (Noticed: "Solo games are for curated competition
//     shows");
//   - archive (only its Commissioner; it stands still while Episode 6 comes in for the rest; Undo brings Episode 6 in),
//     delete (the hold's sentence; out of the couch's games and its group, its people's seats kept; restored from Recent
//     changes by whoever ran it, not by anyone else; gone for good after 30 days).
//   In a real browser at --width (390 by default): the Games tab's Start a game (a competition's three, Tell the couch,
//   Start it, its table), the hub's foot (Pick the show, then a sport's sheet), the nudge's Start a game, a talk show's sheet
//   from the ⋯ menu, Make it a game's Done view, Backstage › Game settings' Archive (Undo) and Delete (hold), Recent
//   changes' restore, Commercial break's Start a game, the feed's line. Nothing wider than the screen; no page errors.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-start-game.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js (and hub-fixture.js) up and takes them down (--keep leaves them; the down
// removes the shows zt_nd people added and the games they started); touches zt rows only; refuses a non-local database.
// Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const hubFixture = require("./hub-fixture");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-start-game runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-start-game.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const answerFrom = (id, show) => `\`\`\`json\n${JSON.stringify({ ...clone(LIBRARY[id].blocks), show }, null, 1)}\n\`\`\``;
const castAnswer = (people) => `\`\`\`json\n${JSON.stringify({ castaways: people.map(([name, group]) => ({ name, photoUrl: "", startingGroup: group })), sources: ["https://example.invalid/cast"] })}\n\`\`\``;
const ANSWERS = {
  "ZT Yacht Life": { setup: () => answerFrom("below-deck", "ZT Yacht Life") },
  "ZT Grand Prix": {
    setup: () => answerFrom("world-series", "ZT Grand Prix"),
    cast: () => castAnswer([["Ana Speed", "Red Team"], ["Bo Lap", "Red Team"], ["Cy Pole", "Blue Team"], ["Di Grid", "Blue Team"], ["Ed Pit", "Green Team"], ["Fi Flag", "Green Team"]]),
  },
  "ZT Love Shack": {
    setup: () => answerFrom("the-amazing-race", "ZT Love Shack"),
    cast: () => castAnswer([["Gia Heart", null], ["Hal Rose", null], ["Ivy Kiss", null], ["Jon Date", null], ["Kay Vow", null], ["Lou Ring", null], ["Max Flirt", null], ["Ned Swoon", null]]),
  },
  "ZT Late Night": { setup: () => answerFrom("saturday-night-live", "ZT Late Night") },
};
const showIn = (prompt) => Object.keys(ANSWERS).find((name) => prompt.includes(name));

/** A running talk show for the stand-in listings: ZT Yacht Life's schedule under another id, the regulars as its cast. */
function lateNight(shows) {
  const base = clone(shows.find((s) => s.show.id === 990011));
  const old = shows.find((s) => s.show.id === 990005);
  base.show = { ...base.show, id: 990013, name: "ZT Late Night", type: "Talk Show", url: "https://www.tvmaze.com/shows/990013", image: null, schedule: { time: "23:30", days: ["Saturday"] } };
  base.seasons = base.seasons.map((s) => ({ season: { ...s.season, id: s.season.id + 900 }, episodes: s.episodes.map((e) => ({ ...e, id: e.id + 90000 })) }));
  base.cast = clone(old.cast);
  return base;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  tv.shows.push(lateNight(tv.shows));
  const bot = await fakeBot.start({
    delayMs: 200,
    answer: (prompt, kind) => {
      const fn = ANSWERS[showIn(prompt)]?.[kind];
      if (!fn) throw new Error(`no answer for ${kind} about ${showIn(prompt) ?? "?"}`);
      return fn();
    },
  });
  const headers = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    await hubFixture.up(pool, fx);
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    // Results an admin accepted reach every league on the season (as on Survivor 51), so a game started mid-season has them.
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD, headers });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const opts = async (who, season, extra = "") => as[who].call("GET", `/api/seasons/${season}/start${q}${extra}`);
    const start = (who, season, body) => as[who].call("POST", `/api/seasons/${season}/start${q}`, body);
    const end = (who, season, body) => as[who].call("POST", `/api/seasons/${season}/backstage/end${q}`, body);
    const keys = (o) => o.games.filter((g) => g.fits).map((g) => g.key).join();

    // Make the listing shows games through Make it a game (our stand-in bot), as a couch would.
    const add = async (who, listing) => {
      const r = await as[who].call("POST", "/api/me/shows", { listing });
      if (r.status !== 200) throw new Error(`adding ${listing}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body.seasonId;
    };
    const settle = async (season) => {
      for (let i = 0; i < 80; i++) {
        const p = (await as.alex.call("GET", `/api/seasons/${season}/make?poll=1`)).body;
        if (!p.asking) return (await as.alex.call("GET", `/api/seasons/${season}/make${q}`)).body;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("the ask never finished");
    };
    const makeIt = async (season) => {
      await as.alex.call("POST", `/api/seasons/${season}/make${q}`, { action: "ask" });
      let m = await settle(season);
      if (m.setup?.stage === "cast") {
        await as.alex.call("POST", `/api/seasons/${season}/make${q}`, { action: "continue" });
        m = await settle(season);
      }
      const c = await as.alex.call("POST", `/api/seasons/${season}/make${q}`, { action: "confirm" });
      if (c.status !== 200) throw new Error(`making ${season} a game: ${c.status} ${JSON.stringify(c.body).slice(0, 300)}`);
    };
    const yacht = await add("alex", 990011);
    const prix = await add("alex", 990012);
    const shack = await add("alex", 990001);
    const late = await add("alex", 990013);
    await add("riley", 990012);
    for (const s of [yacht, prix, shack, late]) await makeIt(s);
    const oldShow = await add("alex", 990005);

    // ---------- what fits: a competition ----------
    let r = await opts("alex", sid);
    const o = r.body;
    check(r.status === 200 && o.kind === "competition" && keys(o) === "survivalPool,weeklyLineup,outlast" && o.noFit === null && o.blocked === null, "a competition: Survival Pool, Weekly Lineup and Outlast all fit", JSON.stringify(o).slice(0, 300));
    check(o.from === 6 && o.part.singular === "episode" && o.label === "ZT Survivor 51" && o.couch.members === 4, "it starts with Episode 6, the next to air", `${o.from} ${o.label}`);
    check(o.games.every((g) => g.have === 1) && /^No draft · pick one/.test(o.games[0].line), "the couch plays one of each already; each says what it is", o.games.map((g) => `${g.key}:${g.have}`).join());
    check(["zt_nd_riley", "zt_nd_jordan", "zt_nd_sam"].every((n) => o.watchers.includes(n)) && !o.watchers.includes("zt_nd_alex"), "Tell the couch names who plays it", o.watchers.join());
    check((await opts("casey", sid)).status === 404, "someone off the couch can't start one there");
    check((await start("alex", sid, { game: "weeklyBingo" })).status === 400, "a game that isn't one of this show's is refused");

    // ---------- starting one ----------
    r = await start("jordan", sid, { game: "weeklyLineup", tell: true });
    const W = r.body.leagueId;
    check(r.status === 200 && r.body.name === "Weekly Lineup" && r.body.from === 6 && r.body.linked === true && r.body.told === 3, "jordan starts a Weekly Lineup: from Episode 6, linked, the three others told", JSON.stringify(r.body));
    let w = await league(W);
    check(w.couch_id === couch && w.group_id === fx.groupId && w.group_position === 3 && w.created_by === fx.users.jordan && !w.solo, "on the couch, in its linked group (one reveal and one chat), after its three games", `${w.couch_id} ${w.group_id} ${w.group_position}`);
    let st = w.state;
    check(st.settings.leagueTypeId === "active-roster" && st.settings.ownershipMode === "shared" && st.settings.startEpisode === 6 && st.settings.setupComplete === true && String(st.settings.wikiSeason) === "51", "set up as the create wizard would: Weekly Lineup, the season, from Episode 6", JSON.stringify({ ...st.settings, eventPoints: undefined, showFormatData: undefined, rulebook: undefined }).slice(0, 300));
    check(st.episodes.filter((e) => e.number <= 5 && e.events.length).length === 5 && st.castaways.length > 10, "the season's cast and its first five episodes' results are in, as history", `${st.castaways.length}`);
    const { rows: wm } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1", [W]);
    check(wm.length === 1 && wm[0].user_id === fx.users.jordan && wm[0].role === "commissioner", "jordan alone, its Commissioner");
    const { rows: wc } = await pool.query("SELECT kind, text, user_id FROM league_changes WHERE league_id = $1", [W]);
    check(wc.some((c) => c.kind === "game.start" && c.text === "zt_nd_jordan started Weekly Lineup"), "a line in Recent changes", JSON.stringify(wc));
    const cg = (await as.alex.call("GET", `/api/couches/${couch}/games`)).body.games.find((g) => g.leagueId === W);
    check(cg && cg.mode === "open" && cg.underway === false && cg.players === 1 && cg.ended === false, "on the couch's games: open to join, not underway yet (earlier results are history)", JSON.stringify(cg));
    r = await as.alex.call("POST", `/api/couches/${couch}/games/${W}`, { action: "join" });
    st = (await league(W)).state;
    const alexSeat = st.players.find((p) => p.name === "zt_nd_alex");
    check(r.status === 200 && alexSeat && !alexSeat.lateJoin && st.draftOrder.includes(alexSeat.id), "alex joins into its draft, not as a late joiner", JSON.stringify(r.body));
    const feed = (await as.riley.call("GET", `/api/couches/${couch}/hub`)).body.feed;
    check(feed.some((e) => e.kind === "started" && e.name === "zt_nd_jordan" && e.text === "Weekly Lineup" && e.label === "ZT Survivor 51" && e.seasonId === sid), "the couch's feed: jordan started a Weekly Lineup", JSON.stringify(feed.filter((e) => e.kind === "started")));
    r = await start("sam", sid, { game: "weeklyLineup", tell: false });
    const W2 = r.body.leagueId;
    check(r.status === 200 && r.body.name === "Weekly Lineup 2" && r.body.told === 0, "a second one is Weekly Lineup 2; Tell the couch off tells nobody", JSON.stringify(r.body));
    const space = (await as.riley.call("GET", `/api/seasons/${sid}/space${q}`)).body;
    check(space.games.filter((g) => g.gameType === "active-roster").length === 3, "the show space lists the couch's games with the new ones");

    // ---------- what fits: a series, a sport, a talk show, one that isn't a game ----------
    const so = (await opts("alex", yacht)).body;
    check(so.kind === "series" && so.start === "reality" && keys(so) === "weeklyLineup" && /^Draft the crew members, start three each week/.test(so.games.find((g) => g.key === "weeklyLineup").line), "a reality series: Weekly Lineup, drafting the crew", JSON.stringify(so.games.map((g) => [g.key, g.fits, g.line])));
    check(so.noFit === "Survival Pool and Outlast need someone knocked out most episodes. Nobody is, on ZT Yacht Life.", "and why the others don't fit", so.noFit);
    check((await start("alex", yacht, { game: "survivalPool" })).status === 400, "Survival Pool on a series is refused");
    r = await start("alex", yacht, { game: "weeklyLineup" });
    const Y = r.body.leagueId;
    check(r.status === 200 && r.body.linked === false && r.body.from === so.from, "a Weekly Lineup on the series", JSON.stringify(r.body));
    const showOf = async (season) => (await pool.query("SELECT s.*, ss.rulebook_id, ss.rulebook_live FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE ss.id = $1", [season])).rows[0];
    let made = await showOf(yacht);
    let ys = (await league(Y)).state;
    check(made.rulebook_live && ys.settings.rulebook?.id === made.rulebook_id && ys.settings.showFormat === made.format && made.format === `made-${made.slug}` && ys.settings.rulebook.data.id === made.format,
      "it plays by the season's rulebook, and the show's stored format (made-<slug>) agrees", JSON.stringify({ rb: ys.settings.rulebook?.id, want: made.rulebook_id, fmt: ys.settings.showFormat, made: made.format }));
    const po = (await opts("alex", prix)).body;
    check(po.kind === "sport" && keys(po) === "weeklyLineup,survivalPool" && po.part.singular === "game" && po.games[0].line === "Draft five players, start three each game" && /score each game/.test(po.games[1].line), "a sport: the draft of athletes first, then Survival Pool, in its own words", JSON.stringify(po.games.map((g) => [g.key, g.line])));
    check(po.noFit === "Outlast needs people knocked out one by one. Nobody is, in ZT Grand Prix." && po.watchers.join() === "zt_nd_riley", "Outlast doesn't fit; riley watches it", `${po.noFit} | ${po.watchers}`);
    r = await start("alex", prix, { game: "weeklyLineup" });
    const PL = r.body.leagueId;
    const pl = (await league(PL)).state;
    check(r.status === 200 && pl.settings.ownershipMode === "shared" && pl.settings.leagueTypeId === "active-roster" && pl.castaways.length === 6, "its Weekly Lineup: drafted from the whole field (several teams can share one)", JSON.stringify(r.body));
    r = await start("alex", prix, { game: "survivalPool" });
    const PP = r.body.leagueId;
    const pp = await league(PP);
    check(r.status === 200 && pp.state.settings.poolSurvive === "scores" && pp.state.settings.leagueTypeId === "pickem" && r.body.linked === true && pp.group_id === (await league(PL)).group_id, "its Survival Pool survives by scoring, linked to the lineup game", JSON.stringify(r.body));
    const lo = (await opts("alex", late)).body;
    check(lo.kind === "talk" && keys(lo) === "weeklyBingo,weeklyCalls" && lo.games.filter((g) => g.fits).every((g) => g.soon === "12"), "a talk show: Weekly Bingo and Weekly Calls, coming with episode games", JSON.stringify(lo.games));
    check(/^Drafts need a cast that scores week to week\. ZT Late Night's games are one show at a time, all season\.$/.test(lo.noFit), "and drafts don't fit it", lo.noFit);
    check((await start("alex", late, { game: "weeklyBingo" })).status === 409 && (await start("alex", late, { game: "weeklyLineup" })).status === 400, "neither can start yet; a draft is refused");
    const oo = (await opts("alex", oldShow)).body;
    check(oo.blocked === "Make ZT Old Show a game first", "a show that isn't a game yet: Make it a game first", oo.blocked);

    // ---------- the couch's own rules reach a new game ----------
    r = await as.alex.call("POST", `/api/seasons/${sid}/backstage/rules${q}`, { action: "ours" });
    const copyId = (await league(fx.leagues.lineup)).rulebook_id;
    check(r.status === 200 && !!copyId, "alex makes the season's rules the couch's own", JSON.stringify(r.body).slice(0, 200));
    r = await start("alex", sid, { game: "survivalPool", tell: false });
    const SP = r.body.leagueId;
    const sp = await league(SP);
    check(r.status === 200 && sp.rulebook_id === copyId && sp.state.settings.rulebook?.id === copyId, "a game started now plays by the couch's own rules", `${sp.rulebook_id} ${copyId}`);

    // ---------- pools and practice couches for a competition a player made a game ----------
    const pool1 = (await as.alex.call("GET", `/api/seasons/${shack}/pool`)).body;
    const prac = (await as.alex.call("GET", `/api/seasons/${shack}/practice`)).body;
    check(pool1.blocked === null && prac.blocked === null, "ZT Love Shack (made a game by alex): its public pool and a practice couch are open", `${pool1.blocked} | ${prac.blocked}`);
    check((await as.alex.call("GET", `/api/seasons/${yacht}/pool`)).body.blocked === "Solo games come to this kind of show later", "a series still has none");

    // ---------- Run it back ----------
    const show = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [sid])).rows[0].show_id;
    const s52 = (await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
       VALUES ($1, 52, 'ZT Survivor 52', 'upcoming', current_date + 60, '20:00', 'America/New_York', 90, 13) RETURNING id`,
      [show]
    )).rows[0].id;
    let hub = (await as.alex.call("GET", `/api/couches/${couch}/hub`)).body;
    check(Array.isArray(hub.again) && hub.again.length === 0, "the trophy shelf offers nothing to run back while the couch plays Survivor 51's games", JSON.stringify(hub.again));
    await pool.query("UPDATE show_seasons SET status = 'completed' WHERE id = $1", [sid]);
    const over = (await opts("alex", sid)).body;
    check(over.blocked === "The season's over: every episode has aired" && over.next?.seasonId === s52 && over.next.label === "ZT Survivor 52", "a season that's over: nothing starts, and its next season is offered", JSON.stringify({ b: over.blocked, n: over.next }));
    hub = (await as.alex.call("GET", `/api/couches/${couch}/hub`)).body;
    const cup50 = hub.trophies?.plaques.find((p) => p.label === "ZT Survivor 50" && p.gameName === "Outlast");
    check(cup50 && hub.again.some((a) => a.leagueId === cup50.leagueId && a.seasonId === s52 && a.label === "ZT Survivor 52"), "the trophy shelf: run ZT Survivor 50's Outlast back on Survivor 52", JSON.stringify(hub.again));
    const ao = (await opts("alex", s52, `&again=${cup50.leagueId}`)).body;
    check(ao.again?.key === "outlast" && ao.again.label === "ZT Survivor 50" && ao.blocked === null && ao.from === 1, "Run it back: the same Outlast, from Survivor 52's first episode", JSON.stringify(ao.again));
    const oldCup = await league(cup50.leagueId);
    r = await start("alex", s52, { game: "outlast", again: cup50.leagueId, tell: false });
    const R = await league(r.body.leagueId);
    check(r.status === 200 && R.name === oldCup.name && R.state.settings.teamSize === oldCup.state.settings.teamSize && R.state.settings.leagueTypeId === "classic-draft", "run back with its name and team size", `${R.name} ${R.state.settings.teamSize}`);
    check((await opts("casey", s52, `&again=${cup50.leagueId}`)).status === 404, "not someone else's game to run back");
    await pool.query("UPDATE show_seasons SET status = 'airing' WHERE id = $1", [sid]);

    // ---------- archive ----------
    check((await end("alex", sid, { action: "archive", leagueId: W })).status === 404, "alex plays jordan's Weekly Lineup but doesn't run it: he can't archive it");
    r = await end("jordan", sid, { action: "archive", leagueId: W });
    const archBatch = r.body.batch;
    w = await league(W);
    check(r.status === 200 && !!w.state.settings.archivedAt && w.state.settings.archivedBy === fx.users.jordan, "jordan archives it", JSON.stringify(r.body));
    const jg = (await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games.find((g) => g.leagueId === W);
    check(jg?.archived === true, "its table says it's archived");
    check((await as.alex.call("GET", `/api/couches/${couch}/games`)).body.games.find((g) => g.leagueId === W)?.ended === true, "nobody new joins an archived game");
    const ends = (await as.jordan.call("GET", `/api/seasons/${sid}/backstage/end${q}`)).body.games;
    check(ends.some((g) => g.leagueId === W && g.archived && g.yours), "Game settings lists it as archived, jordan's to bring back");
    // Episode 6 airs and its result comes in: it reaches the rest, not the archived game.
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 5 WHERE id = $1", [sid]);
    const outName = (await league(fx.leagues.outlast)).state.castaways.find((c) => c.status === "active").name;
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now())`,
      [sid, outName]
    );
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const synced = await syncSeasonLeagues(sid, null);
    const ep6 = async (id) => ((await league(id)).state.episodes.find((e) => e.number === 6)?.events ?? []).some((e) => e.castawayId && true);
    check(!synced.some((x) => x.leagueId === W) && (await ep6(fx.leagues.outlast)) && !(await ep6(W)), "Episode 6's result reaches the couch's other games, not the archived one", JSON.stringify(synced.map((x) => [x.leagueName, x.applied])));
    const lines = (await as.jordan.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines;
    const archLine = lines.find((l) => l.batch === archBatch);
    check(archLine && /^Archived Weekly Lineup/.test(archLine.text) && archLine.undoable === true, "Recent changes: Archived Weekly Lineup, with Undo", JSON.stringify(archLine));
    r = await as.jordan.call("POST", `/api/seasons/${sid}/changes/${archBatch}/undo${q}`);
    w = await league(W);
    check(r.status === 200 && !w.state.settings.archivedAt && (await ep6(W)), "Undo: it scores again, Episode 6 and all", JSON.stringify(r.body));

    // ---------- delete ----------
    r = await end("sam", sid, { action: "delete", leagueId: W2, preview: true });
    const others = (await as.sam.call("GET", `/api/seasons/${sid}/space${q}`)).body.games.filter((g) => g.leagueId !== W2 && !g.archived).length;
    check(r.status === 200 && r.body.consequence === `You lose your teams, lineups and points in Weekly Lineup for this season. The other ${others} games are untouched.`, "the hold's sentence", r.body.consequence);
    r = await end("sam", sid, { action: "delete", leagueId: W2 });
    const delBatch = r.body.batch;
    let w2 = await league(W2);
    const { rows: w2m } = await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1", [W2]);
    check(r.status === 200 && !!w2.deleted_at && w2.deleted_by === fx.users.sam && w2.group_id === null && w2m.length === 0, "sam deletes Weekly Lineup 2: out of the group, nobody's in it", JSON.stringify(r.body));
    check(!(await as.alex.call("GET", `/api/couches/${couch}/games`)).body.games.some((g) => g.leagueId === W2) && !(await as.sam.call("GET", `/api/seasons/${sid}/games${q}`)).body.games.some((g) => g.leagueId === W2), "gone from the couch's games and sam's");
    const { rows: samOn } = await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couch, fx.users.sam]);
    check(samOn.length === 1, "sam's still on the couch");
    const delLine = (await as.sam.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines.find((l) => l.batch === delBatch);
    check(delLine && delLine.text === "zt_nd_sam deleted Weekly Lineup (restorable for 30 days)" && delLine.tier === 3 && delLine.undoable && delLine.games[0] === "Weekly Lineup 2", "Recent changes keeps its line, restorable", JSON.stringify(delLine));
    const alexLine = (await as.alex.call("GET", `/api/seasons/${sid}/changes${q}`)).body.lines.find((l) => l.batch === delBatch);
    check(alexLine && alexLine.undoable === false && (await as.alex.call("POST", `/api/seasons/${sid}/changes/${delBatch}/undo${q}`)).status === 403, "the couch sees it; only whoever ran it brings it back");
    r = await as.sam.call("POST", `/api/seasons/${sid}/changes/${delBatch}/undo${q}`);
    w2 = await league(W2);
    const { rows: back } = await pool.query("SELECT user_id, role FROM league_memberships WHERE league_id = $1", [W2]);
    check(r.status === 200 && !w2.deleted_at && w2.group_id === fx.groupId && back.length === 1 && back[0].role === "commissioner" && (await ep6(W2)), "restored: sam's seat, the group, and Episode 6", JSON.stringify(r.body));
    await end("sam", sid, { action: "delete", leagueId: W2 });
    await pool.query("UPDATE leagues SET deleted_at = now() - interval '31 days' WHERE id = $1", [W2]);
    const { purgeDeleted } = jiti("../../src/lib/server/end-game.ts");
    const purged = await purgeDeleted();
    check(purged >= 1 && !(await league(W2)), "after 30 days a deleted game is gone for good");

    // ---------- the browser ----------
    if (!apiOnly) {
      // Episode 6 is back where the fixture had it: airing in three days.
      await pool.query("UPDATE show_seasons SET premiere_date = premiere_date + 5 WHERE id = $1", [sid]);
      await pool.query("DELETE FROM season_decisions WHERE season_id = $1 AND episode_number = 6", [sid]);
      // A show alex follows that riley watches openly and nobody plays: the nudge.
      await as.alex.call("POST", `/api/me/shows`, { seasonId: fx.traitorsSeasonId, seenThrough: 2 }).catch(() => {});
      await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 2) ON CONFLICT (user_id, season_id) DO UPDATE SET following = true, private = false, nudge_off_at = NULL`, [fx.users.alex, fx.traitorsSeasonId]);
      const b = await open({ user: "zt_nd_alex", pass: PASSWORD, width, height: 844, headers });
      closers.push(b.close);
      const { page, errors } = b;
      let n = 0;
      const shot = async (name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      const wide = async (what) => {
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
      };
      const sheet = page.locator("[data-start-sheet]");

      // The Games tab's Start a game: a competition's three
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      await page.locator("[data-start-row]").waitFor();
      await page.locator("[data-start-row]").click();
      await page.locator('[data-start-sheet="competition"]').waitFor();
      check((await sheet.locator("[data-start-game]").count()) === 3 && /Recommended/.test(await sheet.locator('[data-start-game="survivalPool"]').innerText()), "the Games tab's Start a game: three games, Survival Pool recommended");
      check(/zt_nd_alex started a game for ZT Survivor/.test(await sheet.locator("[data-start-tell]").innerText()) && (await sheet.locator('[data-start-tell="on"]').count()) === 1, "Tell the couch, on");
      await shot("start-competition");
      await wide("Start a game");
      await sheet.locator('[data-start-game="outlast"]').click();
      await sheet.locator("[data-start-go]").click();
      await page.waitForURL(/\/games$/);
      await page.locator("text=Outlast started").first().waitFor();
      const { rows: started } = await pool.query("SELECT id FROM leagues WHERE created_by = $1 AND name = 'Outlast' AND deleted_at IS NULL", [fx.users.alex]);
      check(started.length === 1, "Start it: an Outlast, and the toast says so");
      await page.locator(`[data-table="${started[0].id}"]`).waitFor();
      await shot("started-outlast");

      // The hub's foot: Pick the show, then a sport's sheet
      await page.goto(`${BASE}/home`, { waitUntil: "load" });
      await page.locator("[data-foot-start]").waitFor();
      await page.locator("[data-foot-start]").click();
      await page.locator("[data-start-pick]").waitFor();
      check((await page.locator(`[data-pick-show="${prix}"]`).count()) === 1 && (await page.locator(`[data-pick-show="${oldShow}"]`).count()) === 0, "Pick the show: yours still airing (not one that's ended)");
      await shot("pick-show");
      await page.locator(`[data-pick-show="${prix}"]`).click();
      await page.locator('[data-start-sheet="sport"]').waitFor();
      check(/from Game \d+/.test(await page.locator("[role=dialog]").last().innerText()) && (await sheet.locator("[data-no-fit]").count()) === 1, "a sport's sheet: from Game N, and why Outlast doesn't fit");
      await shot("start-sport");
      await page.keyboard.press("Escape");

      // the nudge's Start a game
      await page.locator(`[data-nudge="${fx.traitorsSeasonId}"] [data-nudge-go]`).waitFor();
      await page.locator(`[data-nudge="${fx.traitorsSeasonId}"] [data-nudge-go]`).click();
      await page.locator('[data-start-sheet="competition"]').waitFor();
      check(/ZT Traitors/.test(await page.locator("[role=dialog]").last().innerText()), "the nudge's Start a game opens Start a game for that show");
      await shot("nudge-start");
      await page.keyboard.press("Escape");
      // the feed's line
      const feedLine = page.locator('[data-feed="started"]').first();
      check((await feedLine.count()) === 1 && /started an? (Outlast|Weekly Lineup|Survival Pool)/.test(await feedLine.innerText()), "On the couch: someone started a game");

      // a talk show from the ⋯ menu
      await page.goto(`${BASE}/show/${late}/games`, { waitUntil: "load" });
      await page.getByRole("button", { name: /Show menu/ }).click();
      await page.getByRole("button", { name: /Start a game/ }).last().click();
      await page.locator('[data-start-sheet="talk"]').waitFor();
      check((await sheet.locator("[data-start-game][disabled]").count()) === 2 && (await sheet.locator("[data-start-go][disabled]").count()) === 1, "a talk show: both games shown, coming soon");
      await shot("start-talk");
      await page.keyboard.press("Escape");

      // Make it a game's Done view
      await page.goto(`${BASE}/show/${yacht}/games?page=make`, { waitUntil: "load" });
      await page.locator("[data-make-start]").waitFor();
      await page.locator("[data-make-start]").click();
      await page.locator('[data-start-sheet="series"]').waitFor();
      check(/Draft the crew members/.test(await sheet.innerText()), "Make it a game's Done: Start a game, a series' Weekly Lineup");
      await shot("start-series");
      await page.keyboard.press("Escape");

      // Backstage › Game settings: archive (Undo), delete (hold), restore from Recent changes
      await page.goto(`${BASE}/show/${sid}/backstage/settings`, { waitUntil: "load" });
      await page.locator("[data-end-games]").waitFor();
      await page.locator("[data-end-toggle]").click();
      check((await page.locator('[data-end-toggle][aria-expanded="true"]').count()) === 1, "Archive or delete a game unfolds");
      await page.locator('[data-end="delete"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await shot("end-games");
      await page.locator('[data-end="archive"]').click();
      await page.locator('[data-end-pick="archive"]').waitFor();
      await page.locator(`[data-end-pick="archive"] [data-end-game="${started[0].id}"]`).click();
      await page.locator("text=Outlast archived").first().waitFor();
      check(!!(await league(started[0].id)).state.settings.archivedAt, "Archive: done at once, with Undo on the toast");
      await page.getByRole("button", { name: "Undo" }).click();
      await page.locator("text=Undone").first().waitFor();
      check(!(await league(started[0].id)).state.settings.archivedAt, "Undo brings it straight back");
      await page.locator('[data-end="delete"]').click();
      await page.locator('[data-end-pick="delete"]').waitFor();
      await page.locator(`[data-end-pick="delete"] [data-end-game="${started[0].id}"]`).click();
      await page.locator("[data-guard='3'] p", { hasText: "for this season" }).first().waitFor();
      check(/You lose your teams and places in Outlast for this season/.test(await page.locator("[data-guard='3']").innerText()) && /Archive it instead/.test(await page.locator("[data-guard='3']").innerText()), "Delete: the hold's sentence, archive offered first");
      await shot("delete-hold");
      const hold = page.locator("[data-hold]");
      await hold.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const box = await hold.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.locator("text=restore it from Recent changes").first().waitFor({ timeout: 8000 });
      await page.mouse.up();
      check(!!(await league(started[0].id)).deleted_at, "held: deleted");
      await page.goto(`${BASE}/show/${sid}/backstage/history`, { waitUntil: "load" });
      const line = page.locator("text=deleted Outlast (restorable for 30 days)").first();
      await line.waitFor();
      await shot("recent-changes");
      await wide("Recent changes");
      await page.getByRole("button", { name: /Undo|Restore/ }).first().click();
      for (let i = 0; i < 20 && (await league(started[0].id)).deleted_at; i++) await page.waitForTimeout(250);
      check(!(await league(started[0].id)).deleted_at, "restored from Recent changes");

      // Commercial break's Start a game
      await page.goto(`${BASE}/home?page=break`, { waitUntil: "load" });
      await page.locator("[data-break-start]").waitFor({ timeout: 8000 }).catch(() => {});
      if (await page.locator("[data-break-start]").count()) {
        await page.locator("[data-break-start]").click();
        await page.locator("[data-start-pick]").waitFor();
        check(true, "Commercial break's Start a game: Pick the show");
        await shot("break-start");
      } else check(false, "Commercial break opens from ?page=break");
      check(errors.length === 0, "no page errors", errors.join(" | "));
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    await tv.close();
    await bot.close();
    await jiti("../../src/lib/server/db.ts").pool.end().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
