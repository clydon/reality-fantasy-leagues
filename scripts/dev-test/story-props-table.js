// Dev-only: the prop sheet round's screenshot story (docs/design-round/props-table-spec.md, -first-view.md, -shape.md): a team's
// game named by its opponent ("Week 11 at Bengals", never "Game 10"), and a player question a stat settles answered from a table
// (the settling stat per game, last game, season; ranked; the rest folded), as the user met it on their phone (2026-11-23).
// On nfl-slate-fixture.js (the recorded NFL season through its stand-in ESPN; every app read pointed at it by the x-gys-sports
// header): a Prop sheet started on --team's next game, as Start a game's Play on one of a team's games starts it (sports/start.ts
// startSport: the team's whole season made, the game on that one game), as zt_nfl_ann.
//   page     the game page's first view: its name, the strip, the questions
//   table    scrolled to "Who throws for the most yards?": the table's first view
//   picked   its top row tapped (the pick, Save naming it)
//   sorted   sorted by the last game
//   more     Everyone else opened
//   position the QB chip: every quarterback in the game, both teams, ranked
//   wide     the table scrolled sideways (the stat group's other counts)
//   sides    "Who wins?": both teams' whole names
// For each it keeps <prefix><id>.jpg and <prefix><id>.txt under --out, and prints OVERLAP lines (overlaps.js).
//
// Needs: the app (BASE, `npm run dev`), the local database and the NFL recording. Brings the fixture up and takes it down after unless
// --keep. Never beside another check on nfl-slate-fixture.js.
// Run:   BASE=http://localhost:3000 node scripts/dev-test/story-props-table.js [--team="Buffalo Bills"] [--prefix=after-]
//          [--out=.ui-atlas/stories/props-table] [--width=390 --height=844] [--only=page,table] [--at=<ISO; default now>] [--keep]
const fs = require("fs");
const path = require("path");
const fx = require("./nfl-slate-fixture");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = opt("out", path.join(".ui-atlas", "stories", "props-table"));
const PREFIX = opt("prefix", "after-");
const W = Number(opt("width", 390));
const H = Number(opt("height", 844));
const TEAM = opt("team", "Buffalo Bills");
const AT = opt("at", new Date().toISOString());
const ONLY = opt("only", "") ? new Set(opt("only", "").split(",")) : null;
const KEEP = args.includes("--keep");
const want = (id) => !ONLY || ONLY.has(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(page, id) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, `${PREFIX}${id}.jpg`), type: "jpeg", quality: 84 });
  const words = await page.evaluate(() => ([...document.querySelectorAll('[role="dialog"]')].pop() ?? document.body).innerText);
  fs.writeFileSync(path.join(OUT, `${PREFIX}${id}.txt`), words);
  for (const [a, b] of await overlapsIn(page, H)) console.log(`OVERLAP ${id}: "${a}" on "${b}"`);
  console.log(`PASS ${id}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // Each passer's season line as ESPN's athlete stats would answer it (the table's full seasons: pick-stats.ts), added up from the
  // recording's own box scores (every recorded game, not only those the app keeps), so the numbers are the season's real ones.
  const edit = (input) => {
    const sum = new Map();
    for (const e of input.events) {
      if (!e.box || !e.at || Date.parse(e.at) > Date.parse(AT)) continue;
      for (const side of Object.values(e.box)) {
        const t = (side.tables || []).find((x) => x.name === "passing");
        if (!t) continue;
        const at = (l) => t.labels.indexOf(l);
        for (const r of t.rows) {
          const [c, a] = String(r.stats[at("C/ATT")] || "0/0").split("/").map(Number);
          const s = sum.get(r.id) || { gp: 0, cmp: 0, att: 0, yds: 0, td: 0, int: 0 };
          sum.set(r.id, { gp: s.gp + 1, cmp: s.cmp + c, att: s.att + a, yds: s.yds + Number(r.stats[at("YDS")] || 0), td: s.td + Number(r.stats[at("TD")] || 0), int: s.int + Number(r.stats[at("INT")] || 0) });
        }
      }
    }
    input.seasons = Object.fromEntries([...sum].map(([id, s]) => [id, [{ year: 2026, name: "passing", displayName: "Passing", labels: ["GP", "CMP", "ATT", "YDS", "TD", "INT"], stats: [s.gp, s.cmp, s.att, s.yds, s.td, s.int].map(String) }]]));
  };
  const w = await fx.up({ people: 4, at: AT, postseason: true, edit });
  let failed = false;
  try {
    // The team's next game still to play, as the recording (and its stand-in weeks) lists it.
    const events = [...w.weeks, ...(w.playoffWeeks ?? [])].flatMap((x) => x.games);
    const { input } = fx.recording();
    const team = (input.teams ?? []).find((t) => t.name === TEAM);
    if (!team) throw new Error(`no team called ${TEAM} in the recording`);
    const next = events.find((e) => e.at && Date.parse(e.at) > Date.now() && (e.home === team.id || e.away === team.id));
    if (!next) throw new Error(`${TEAM} have no game still to play`);
    // A one-game Pick'em on it makes the team's season (sports/start.ts teamSeasonFor), as Play on a team's game does; then the
    // gallery's Prop sheet (start-gallery sports.json sp-props, football's) on that one game, as the wizard starts it.
    const pickem = await w.start("ann", { game: "pickem", league: fx.LEAGUE, team: team.id, games: [next.id], tell: false });
    await w.settle(pickem.seasonId).catch(() => {});
    const { rows: ep } = await w.pool.query("SELECT episode FROM season_events WHERE season_id = $1 AND event_id = $2", [pickem.seasonId, next.id]);
    const base = require("../../src/lib/game/start-gallery/sports.json").bases.find((x) => x.id === "sp-props");
    const spec = { ...structuredClone(base.by.football.spec), span: { from: ep[0].episode, to: ep[0].episode } };
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    const started = { ...(await startFromSpec(w.users.ann, pickem.seasonId, w.couchId, { spec, name: "Prop sheet", tell: false }, new Date())), seasonId: pickem.seasonId };
    console.log(`started ${started.name} on ${next.name} (${started.seasonId}, ${started.leagueId})`);
    // The daily job's sports part, so the team's played games have their lines kept (the table's numbers), as production's would.
    const d = await w.daily();
    const { rows: kept } = await w.pool.query("SELECT count(*)::int AS n FROM season_events e JOIN sports_events f USING (provider, league, event_id) WHERE e.season_id = $1 AND f.lines IS NOT NULL", [started.seasonId]);
    console.log(`the team's games with their lines kept: ${kept[0].n}${d.errors?.length ? ` (errors: ${d.errors.slice(0, 2).join("; ")})` : ""}`);
    const b = await open({ user: "zt_nfl_ann", pass: fx.PASSWORD, width: W, height: H, motion: "reduce", headers: { "x-gys-sports": w.espn.url } });
    const p = b.page;
    const tap = async (loc) => {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.click();
      await sleep(700);
    };
    const toView = async (loc, block = "start") => {
      await loc.evaluate((e, block) => e.scrollIntoView({ block }), block);
      await sleep(500);
    };
    try {
      await p.goto(`${b.BASE}/show/${started.seasonId}/game/${started.leagueId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await p.locator('[data-game-move="questions"]').first().waitFor({ timeout: 90000 });
      await sleep(1500);
      if (want("page")) await frame(p, "page");
      const table = p.locator("[data-answer-table]").first();
      const hasTable = (await table.count()) > 0;
      console.log(hasTable ? "the player question is a table (after)" : "the player question is faces (before)");
      if (hasTable) {
        const q = table.locator("xpath=ancestor::*[@data-question][1]");
        if (want("table")) (await toView(q), await frame(p, "table"));
        if (want("picked")) {
          await tap(table.locator("tbody tr").first());
          await toView(q);
          await frame(p, "picked");
        }
        if (want("sorted")) (await tap(table.locator('[data-sort="last"]')), await toView(q), await frame(p, "sorted"));
        if (want("wide")) {
          await table.locator("[data-answer-scroll]").evaluate((e) => e.scrollTo({ left: e.scrollWidth }));
          await toView(q);
          await frame(p, "wide");
          await table.locator("[data-answer-scroll]").evaluate((e) => e.scrollTo({ left: 0 }));
        }
        if (want("more")) {
          const rest = p.locator('[data-answer-fold="rest"]').first();
          if (await rest.count()) (await tap(rest), await toView(q), await frame(p, "more"));
        }
        if (want("position")) {
          const chip = table.locator('[data-answer-position="QB"]');
          if (await chip.count()) (await tap(chip), await toView(q), await frame(p, "position"));
        }
      }
      if (want("sides")) {
        const sides = p.locator("[data-answer-side]").first();
        if (await sides.count()) (await toView(sides.locator("xpath=ancestor::*[@data-question][1]")), await frame(p, "sides"));
      }
      if (b.errors?.length) console.log("page errors:", b.errors.slice(0, 3));
    } finally {
      await b.close();
    }
  } catch (e) {
    failed = true;
    console.error(e);
  } finally {
    await fx.finish(w, { keep: KEEP });
  }
  process.exit(failed ? 1 : 0);
})();
