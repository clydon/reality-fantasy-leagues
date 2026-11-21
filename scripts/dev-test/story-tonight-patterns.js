// Dev-only test bank: Tonight's "Your night" row (src/new/show/night.tsx YourNight, src/lib/game/night-rows.ts NIGHT_ROWS) for one
// game of every page pattern the engine plays (the game page's main block, game-page/grammar.ts mainOf; compile.ts makes a game in
// stages "stages"), each row shot closed and opened at a phone's size, with the overlap check (overlaps.js) on every frame.
//
// The games are real: night-fixture.js's zt couch (ZT Survivor 51; jordan the viewer; --phase=watched: Ep 6 revealed through the real
// route), and on it, made through its `beforeAir` hook while Ep 6 is still three days off:
//   - one game per pattern from a spec (a ✅ row of tests/fixtures/engine-capabilities.json, or a spec of this file's where the tracker
//     has none on a show), started by the engine lab's own labStart (engine-lab.ts, in this process, as alex: the zt couch is a
//     fixture's, so the lab takes it; the zt show is marked set up for the call and put back after), from the next episode to air
//     (Ep 6), renamed for its pattern (slug zt-nd-pat-<main>);
//   - jordan, riley and sam in through Join (couch-joins.ts joinGame; Ask me first is asked and let in by alex);
//   - the draft started by alex (draft.ts startDraft) where there is one, then every seat's Ep 6 moves (the draft, lineups, picks,
//     answers) made by the engine's computer players (bots.ts runBots on bot-logic.js) with each seat playing as one for that one
//     write, inside the league's lock, and put back to a person after;
//   - a few of Ep 6's moments as accepted results (season_decisions), beside the fixture's boot, so moment-scored games score.
// Then the fixture airs Ep 6, files its boot, syncs every game on the season (season-decisions.ts) and jordan reveals it.
// team and ladder are the fixture's own Lineup League (a Weekly Lineup) and Pool Party (a Survival Pool), from the demo builder.
// categories, slate and board are a sport's: the engine lab's check on this season says why each can't be made (board's check
// passes on a show, but a squares grid settles on a team game's two scores, which an episode doesn't have: not made, said so).
//
// Frames, under --out (default .ui-atlas/stories/tonight-night/patterns):
//   <main>.closed.jpg / <main>.open.jpg   jordan's Tonight at 390×844, motion off, the row scrolled to sit under the compact bar
//   <main>.closed.txt / <main>.open.txt   the row's words
//   index.json                            each pattern: made or why not, its leagueId, the spec and its sentence, jordan's Ep 6 moves,
//                                         the frames, whether it opens, its overlaps and page errors, any failure
// and every overlap as an OVERLAP line.
//
//   the app running (BASE= from .env.local; this worktree's: http://localhost:3016)
//   node scripts/dev-test/story-tonight-patterns.js [--out=<dir>] [--only=<regex on the main block>] [--width=390] [--height=844] [--keep]
//   node scripts/dev-test/story-tonight-patterns.js down
// Takes the fixture down at the end unless --keep (night-fixture's down, which is new-fixture's: zt-nd- slugs and zt_nd_ people, the
// lab games theirs). zt_nd_ people only; refuses a non-local database. Shares new-fixture's couch: never beside another check that
// uses it. About two minutes.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const { overlapsIn } = require("./overlaps");
const night = require("./night-fixture");
const NF = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/tonight-night/patterns"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const KEEP = args.includes("--keep");
const EP = night.EP;

// ---------- the app's own code, in this process ----------

let app = null;
function appCode() {
  if (app) return app;
  const jiti = require("jiti")(__filename, {
    alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
  });
  const ts = (f) => jiti(`../../src/lib/server/${f}.ts`);
  app = {
    lab: ts("engine-lab"),
    joins: ts("couch-joins"),
    draft: ts("draft"),
    bots: ts("bots"),
    db: ts("db"),
    S: require("../../src/lib/game/state-logic.js"),
    Cap: require("../../src/lib/game/game-spec/capabilities.js"),
    tracker: require("../../tests/fixtures/engine-capabilities.json"),
  };
  return app;
}

// ---------- the patterns ----------

const MAINS = ["together", "race", "matchup", "categories", "worth", "week", "board", "card", "objectives", "team", "picks", "ladder", "slate", "ballot", "stages"];
const CARD = ["individualImmunity", "rewardWin", "idolFound", "idolPlayed", "zeroVotesSafe", "wentOnJourney", "votesNegated", "survivedVotes", "challengeRunnerUp", "learnedOfAdvantage"];
/**
 * How each pattern's game is made: `row`, a tracker row's spec (`adapt` changes it first); `spec`, one of this file's (the tracker has
 * no ✅ row of the pattern on a show); `fixture`, one of the fixture's own games; `sport`, a sport's spec, checked on this season
 * only (`why`, said when the check passes it anyway). `name`: what the game's called here.
 */
const PATTERNS = {
  together: { row: "win.coop", name: "Couch vs the Show" },
  race: { row: "win.race", name: "Race to 20" },
  matchup: { row: "win.h2h", name: "Head to Head" },
  categories: { sport: { get: { by: "draft", each: 5, order: "snake", own: "exclusive" }, count: { all: true }, score: { by: "stats", categories: ["PTS", "REB", "AST"] }, rank: { by: "categories" } } },
  worth: { row: "s22", name: "Stock Market" },
  week: { row: "p12", name: "Objective Week" },
  board: {
    sport: { get: { by: "squares" }, score: { by: "squares", pays: [{ at: "final", points: 10 }] }, rank: { by: "total" } },
    why: "a squares grid settles on a team game's two scores (its digits), which a Survivor episode doesn't have: the engine lab's check passes it on a show, but it would never settle, so it isn't made",
  },
  card: { row: "score.lines", name: "Bingo Lines" },
  // Not on the tracker as a show's game: p12's card of the week's moments, each one hit counted once for you (score.hits objective).
  objectives: { spec: { get: { by: "pick", each: 3 }, count: { pick: true }, score: { by: "moments", points: null, only: "card", hits: "objective" }, rank: { by: "total" }, card: { from: "moments", each: 5, of: CARD } }, name: "Objectives" },
  team: { fixture: "lineup", what: "the fixture's Lineup League: a Weekly Lineup from the demo builder (active-roster), results from Ep 1" },
  // Not on the tracker: two castaways picked fresh each episode, scored by what they do.
  picks: { spec: { get: { by: "pick", each: 2 }, score: { by: "moments" }, rank: { by: "total" } }, name: "Two Picks" },
  ladder: { fixture: "pool", what: "the fixture's Pool Party: a Survival Pool from the demo builder (pickem), results from Ep 1" },
  slate: { sport: { get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "winner", ask: "Who wins?", answer: "side", each: "game", asked: "each", points: 1, settle: { by: "final", take: "winner" } }] } },
  ballot: { row: "when.each", name: "Who Goes Home" },
  // The tracker's first stage starts at Ep 1: here it starts with the next to air, as a game started tonight does.
  stages: { row: "shape.stages", adapt: (s) => ({ ...s, stages: s.stages.map((st, i) => (i ? st : { ...st, game: Object.fromEntries(Object.entries(st.game).filter(([k]) => k !== "span")) })) }), name: "Merge Stages" },
};
// Ep 6's moments (still in after it: new-fixture's cast from the seventh on), so moment-scored games and bingo have hits.
const MOMENTS = [
  ["Kristin Flickinger", "individualImmunity"], ["Danny Kilby", "rewardWin"], ["Devin Way", "rewardWin"], ["Eric Macksoud", "rewardWin"],
  ["Jelly Loblack", "idolFound"], ["Lewis Kelly", "zeroVotesSafe"], ["Maggie Nestor", "zeroVotesSafe"], ["Mike Pinsky", "zeroVotesSafe"],
  ["Ori Jean Charles", "zeroVotesSafe"], ["Jenna Doore", "survivedVotes"], ["Linnea Capobianco", "challengeRunnerUp"], ["Sharonda Cox", "wentOnJourney"],
];

const index = {};
const say = (main, k, v) => (index[main] = { ...(index[main] ?? { main }), [k]: v });
const wanted = (main) => !ONLY || new RegExp(ONLY).test(main);

// ---------- the games (night-fixture's beforeAir) ----------

async function makeGames(pool, ids) {
  const A = appCode();
  const q = async (sql, params) => (await pool.query(sql, params)).rows;
  const users = Object.fromEntries((await q(`SELECT * FROM "user" WHERE username = ANY($1::text[])`, [["alex", "riley", "jordan", "sam"].map(NF.username)])).map((u) => [u.username.slice(6), u]));
  const rows = A.Cap.rowsOf(A.tracker);
  const [show] = await q(`SELECT s.id, s.set_up_at FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE ss.id = $1`, [ids.seasonId]);
  // The engine lab takes a season set up as a game (shows.set_up_at): the zt show is, for the lab's calls only.
  await pool.query(`UPDATE shows SET set_up_at = now() WHERE id = $1`, [show.id]);
  try {
    for (const main of MAINS) {
      if (!wanted(main)) continue;
      const p = PATTERNS[main];
      if (p.fixture) {
        say(main, "made", true);
        say(main, "leagueId", ids.leagues[p.fixture]);
        say(main, "source", p.what);
        continue;
      }
      const spec = p.sport ?? (p.spec ? structuredClone(p.spec) : (p.adapt ?? ((s) => s))(structuredClone(rows.find((r) => r.id === p.row).spec)));
      say(main, "source", p.sport ? "a sport's spec, checked on this season" : p.row ? `tracker row ${p.row}${p.adapt ? " (its first stage from the next to air)" : ""}` : "this file's spec (no ✅ tracker row of it on a show)");
      say(main, "spec", spec);
      const verdict = await A.lab.labCheck({ seasonId: ids.seasonId, spec }).catch((e) => ({ problems: [{ problem: `the lab's check failed: ${e.message.split("\n")[0]}` }], waits: [], startable: false, playsAs: null }));
      say(main, "playsAs", verdict.playsAs);
      say(main, "sentence", verdict.describe?.sentence ?? null);
      if (p.sport || !verdict.startable) {
        say(main, "made", false);
        say(main, "why", p.why ?? verdict.problems[0]?.problem ?? verdict.waits[0]?.problem ?? "not startable");
        if (p.sport && verdict.startable) say(main, "checkPasses", true);
        continue;
      }
      try {
        const made = await A.lab.labStart(users.alex, { seasonId: ids.seasonId, couchId: ids.couchId, spec });
        const id = made.leagueId;
        await pool.query(`UPDATE leagues SET name = $2, slug = $3 WHERE id = $1`, [id, p.name, `zt-nd-pat-${main}`]);
        for (const st of await q(`SELECT id, name, stage_key FROM leagues WHERE stage_of = $1`, [id]))
          await pool.query(`UPDATE leagues SET name = $2, slug = $3 WHERE id = $1`, [st.id, `${p.name} · ${st.name.split(" · ").pop()}`, `zt-nd-pat-${main}-${st.stage_key}`]);
        for (const who of ["jordan", "riley", "sam"]) await seat(pool, users[who], users.alex, ids.couchId, id);
        await playEp6(pool, id, users.alex);
        say(main, "made", true);
        say(main, "leagueId", id);
        say(main, "name", p.name);
      } catch (e) {
        say(main, "made", false);
        say(main, "failure", `making it: ${e.message.split("\n")[0]}`);
      }
    }
  } finally {
    await pool.query(`UPDATE shows SET set_up_at = $2 WHERE id = $1`, [show.id, show.set_up_at]);
  }
  for (const [who, type] of MOMENTS) {
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, $2, 'event', $3, '', $4, 'accepted', true, now(), false)`,
      [ids.seasonId, EP, who, type]
    );
  }
  return index;
}

/** Into a game through Join, as playtest.js's join: straight in, or asked and let in by whoever runs it (Ask me first). */
async function seat(pool, user, lead, couchId, leagueId) {
  const J = appCode().joins;
  try {
    return await J.joinGame(user, couchId, leagueId, {});
  } catch (e) {
    if (!/Ask to join first/.test(e.message)) throw e;
    await J.askToJoin(user, couchId, leagueId);
    const req = (await pool.query("SELECT id FROM game_join_requests WHERE league_id = $1 AND user_id = $2 AND decided_at IS NULL", [leagueId, user.id])).rows[0];
    await J.answerRequest(lead, couchId, req.id, true);
    return J.joinGame(user, couchId, leagueId, {});
  }
}

/**
 * Ep 6's moves in a game and each of its stages' leagues: the draft started by whoever runs it where there's one, then two writes in
 * which every seat plays as a computer player (bots.ts runBots: the draft, lineups, picks, answers), put back to a person in the same
 * write.
 */
async function playEp6(pool, leagueId, lead) {
  const { S, draft: D, bots, db } = appCode();
  const leagues = [leagueId, ...(await pool.query("SELECT id FROM leagues WHERE stage_of = $1 ORDER BY created_at", [leagueId])).rows.map((r) => r.id)];
  for (const id of leagues) {
    const s = (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    if (S.piecesOf(s).hasRoster && !S.isDraftStarted(s) && !S.DraftLogic.waits(s)) {
      const m = (await pool.query("SELECT role, player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, lead.id])).rows[0];
      await D.startDraft({ user: lead, membership: { role: m.role, playerId: m.player_id } }, id);
    }
    for (let pass = 0; pass < 2; pass++) {
      await db.withLeagueLock(id, async (st, client) => {
        const people = st.players.filter((p) => !p.automated && !p.disabled).map((p) => [p, p.botLevel]);
        for (const [p] of people) Object.assign(p, { automated: true, botLevel: "solid" });
        try {
          await bots.runBots(client, id, st);
        } finally {
          for (const [p, level] of people) {
            delete p.automated;
            if (level === undefined) delete p.botLevel;
            else p.botLevel = level;
          }
        }
      });
    }
  }
}

/** jordan's Ep 6 in a game, from its state and answers: drafted, lineup, picks, answers (a stage's league's too). */
async function movesOf(pool, leagueId, userId) {
  const out = {};
  const leagues = [leagueId, ...(await pool.query("SELECT id FROM leagues WHERE stage_of = $1 ORDER BY created_at", [leagueId])).rows.map((r) => r.id)];
  for (const [i, id] of leagues.entries()) {
    const m = (await pool.query("SELECT player_id, results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, userId])).rows[0];
    if (!m) continue;
    const s = (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const ep = s.episodes.find((e) => e.number === EP);
    const answers = Number((await pool.query("SELECT count(*) FROM game_answers WHERE league_id = $1 AND player_id = $2 AND episode = $3", [id, m.player_id, EP])).rows[0].count);
    out[i ? `stage${i}` : "game"] = {
      seen: m.results_seen_through,
      team: s.castaways.filter((c) => (c.ownerIds || []).includes(m.player_id)).length,
      lineup: ep?.lineups?.[m.player_id]?.length ?? 0,
      picks: (ep?.picks || []).filter((p) => p.playerId === m.player_id).length,
      answers,
      results: !!ep && ((ep.events || []).length > 0 || (ep.scoringEvents || []).length > 0),
    };
  }
  return out;
}

// ---------- frames ----------

const overlaps = [];

async function shoot(p, id) {
  fs.mkdirSync(OUT, { recursive: true });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 86 });
  const hits = await overlapsIn(p, H).catch(() => []);
  for (const h of hits) {
    console.log(`OVERLAP ${id}: ${JSON.stringify(h)}`);
    overlaps.push({ id, words: h });
  }
  console.log(`shot ${id}`);
  return hits;
}

/** The row under the compact bar (its top 70 px down). */
async function toTop(p, el) {
  await el.evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70));
  await p.waitForTimeout(450);
}

async function fontsReady(p) {
  const ok = await p.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded");
  }).catch(() => false);
  if (!ok) throw new Error("Archivo never loaded: the frames would show the fallback face");
}

async function shootRows(session, seasonId) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = session.page;
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto(`${BASE}/show/${seasonId}/tonight`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-progress]").first().waitFor({ timeout: 90000 });
  await p.locator("[data-your-night]").first().waitFor({ timeout: 60000 });
  await fontsReady(p);
  await p.waitForTimeout(2500);
  if (await p.locator("[data-night-fold]").count()) {
    await p.locator("[data-night-fold]").click();
    await p.waitForTimeout(500);
  }
  for (const main of MAINS) {
    const r = index[main];
    if (!r?.made || !wanted(main)) continue;
    const errorsBefore = session.errors.length;
    try {
      const card = p.locator(`[data-night-card="${r.leagueId}"]`);
      if (!(await card.count())) throw new Error(`no [data-night-card] row for it on jordan's Tonight${(await p.locator(`[data-night-quick="${r.leagueId}"]`).count()) ? " (a quick row instead)" : ""}`);
      await toTop(p, card);
      const closedWords = await card.innerText();
      fs.writeFileSync(path.join(OUT, `${main}.closed.txt`), closedWords);
      const closed = await shoot(p, `${main}.closed`);
      const toggle = card.locator("[data-night-toggle]").first();
      const opens = !(await toggle.isDisabled());
      if (opens) {
        await toggle.click();
        await p.waitForTimeout(700);
      }
      await toTop(p, card);
      const openWords = await card.innerText();
      fs.writeFileSync(path.join(OUT, `${main}.open.txt`), openWords);
      const opened = await shoot(p, `${main}.open`);
      say(main, "frames", [`${main}.closed.jpg`, `${main}.open.jpg`]);
      say(main, "opens", opens);
      say(main, "state", await card.getAttribute("data-night-open"));
      say(main, "words", { closed: closedWords.split("\n").filter(Boolean), open: openWords.split("\n").filter(Boolean).slice(0, 40) });
      say(main, "overlaps", { closed, open: opened });
      if (opens) {
        await toggle.click();
        await p.waitForTimeout(300);
      }
    } catch (e) {
      console.log(`STOPPED ${main}: ${e.message.split("\n")[0]}`);
      say(main, "failure", e.message.split("\n")[0]);
    }
    if (session.errors.length > errorsBefore) say(main, "pageErrors", session.errors.slice(errorsBefore));
  }
}

async function main() {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-tonight-patterns runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  if (args[0] === "down") {
    await night.down(pool);
    await pool.end();
    console.log("[patterns] down");
    return;
  }
  let session = null;
  try {
    const ids = await night.up(pool, { phase: "watched", moves: "set", pace: "live", art: true, beforeAir: (x) => makeGames(pool, x) });
    for (const main of MAINS) {
      const r = index[main];
      if (r?.made) say(main, "jordan", await movesOf(pool, r.leagueId, ids.users.jordan));
      if (r) console.log(`[patterns] ${main}: ${r.made ? `made ${r.leagueId}` : `not made: ${r.why ?? r.failure}`}`);
    }
    session = await open({ user: NF.username("jordan"), pass: NF.PASSWORD, width: W, height: H, motion: "off" });
    await shootRows(session, ids.seasonId);
    if (session.errors.length) console.log(`[patterns] page errors: ${session.errors.slice(0, 5).join(" | ")}`);
  } finally {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ base: BASE, width: W, height: H, episode: EP, patterns: MAINS.filter(wanted).map((m) => index[m] ?? { main: m }), overlaps }, null, 2));
    if (session) await session.close();
    if (!KEEP) await night.down(pool);
    await pool.end();
    if (app) await app.db.pool.end().catch(() => {});
  }
  const made = MAINS.filter((m) => index[m]?.frames).length;
  console.log(`${made} patterns shot, ${overlaps.length} overlaps → ${OUT}`);
}

module.exports = { PATTERNS, MAINS, makeGames };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
