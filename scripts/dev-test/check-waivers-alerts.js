// Dev-only test bank: waivers' phase 3 end to end (docs/PLAN-midseason-waivers.md; the canvas's board
// 11) -- Nudge, the alert strip's pickup item, and the hourly job (db/waivers.js) processing a week and
// sending its reminders -- as the people in waivers-fixture.js, against the dev server (npm run dev) and
// the dev database. API and job only, no browser (check-waivers-ui.js shoots Overview).
//
//   node scripts/dev-test/check-waivers-alerts.js [--keep]
//
// Brings waivers-fixture.js up at --phase=open itself (Episode 4 airing in 30 hours, so waivers process
// in about 6), then checks, in the Classic league:
//   - Nudge: commissioner only; never a computer player, someone with a claim in, or twice a week
//   - the alert strip (GET /api/me/actions): Sam (owed, no claim) has "Replace Jelly" by processing
//     time; Josie (not revealed) has nothing; once Sam's claim is in, nothing
//   - the job, run in-process on the fixture's leagues only (never a real one), its clock moved:
//     five hours before processing it reminds Sam (no claim) and Josie (not revealed), once each, and
//     names nothing to Josie; after processing time it processes the week, writes it, and announces it,
//     with no names for Josie; an hour later it does nothing
// Pushes go nowhere (the fixture's people have no devices); what each would say is in the job's log.
// Prints each check; exits 1 if any fail. Takes the fixture down afterwards unless --keep.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { api } = require("./browser");
const fixture = require("./waivers-fixture");
const { runWaivers } = require("../../db/waivers.js");

const c = fixture.slugId;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})`}`);
  if (!ok) failed++;
}
const week = (state) => S.WaiverLogic.periods(state).slice(-1)[0];
const HOUR = 3600e3;

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const made = await fixture.up(pool, ["--phase=open", "--airs-in=30"]);
    const classic = made.find((m) => m.slug === "zt-wv-classic").leagueId;
    const ids = made.map((m) => m.leagueId);
    const [kim, sam, josie] = await Promise.all(["zt_wcomm", "zt_wplayer", "zt_wlate"].map((user) => api({ user, pass: fixture.PASSWORD })));
    const L = `/api/leagues/${classic}`;
    // The job's log names people by user id.
    const [samId, josieId] = await Promise.all(["zt_wplayer", "zt_wlate"].map((u) => userId(pool, u)));

    // The alert strip.
    let r = await sam.call("GET", "/api/me/actions");
    const pickup = (r.body.items || []).find((it) => it.kind === "pickup" && it.leagueId === classic);
    let st = (await sam.call("GET", `${L}/state`)).body.state;
    check("alert: Sam's pickup item", pickup?.text === "Replace Jelly" && pickup?.href === "/waivers/pickup" && pickup?.detail === "claim up to 3", r.body.items);
    check("alert: due by processing time", pickup?.by === week(st).processAt, { by: pickup?.by, processAt: week(st).processAt });
    r = await josie.call("GET", "/api/me/actions");
    check("alert: nothing for Josie, who hasn't revealed", !(r.body.items || []).some((it) => it.kind === "pickup"), r.body.items);

    // Nudge.
    r = await sam.call("POST", `${L}/waivers/nudge`, { playerId: "p-josie" });
    check("nudge: only the commissioner", r.status === 403, r);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-andrew" });
    check("nudge: never a computer player", r.status === 400, r);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-josie" });
    check("nudge: Kim nudges Josie", r.status === 200 && week(r.body).nudged?.includes("p-josie"), r);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-josie" });
    check("nudge: once a week", r.status === 409 && /nudged Josie/.test(r.body.error), r);
    const view = S.SpoilerLogic.viewThrough((await josie.call("GET", `${L}/state`)).body.state, 2);
    check("nudge: Josie's own copy doesn't say who was nudged", week(view).nudged === undefined, week(view));

    // The job, five hours before processing.
    st = (await sam.call("GET", `${L}/state`)).body.state;
    const processAt = Date.parse(week(st).processAt);
    let lines = [];
    let job = await runWaivers(pool, { now: processAt - 5 * HOUR, leagueIds: ids, log: (l) => lines.push(l) });
    const samRem = lines.find((l) => l.startsWith(`${samId} `));
    const josieRem = lines.find((l) => l.startsWith(`${josieId} `));
    check("job 6h out: nothing processed", job.steps === 0, job);
    check("job 6h out: Sam is told he has a pickup to claim", /you have a pickup to claim/.test(samRem || ""), lines);
    check("job 6h out: Josie is told to reveal first, no names", /reveal Episode 3 before then/.test(josieRem || "") && !/Jelly|Rob/.test(josieRem || ""), lines);
    lines = [];
    job = await runWaivers(pool, { now: processAt - 4 * HOUR, leagueIds: ids, log: (l) => lines.push(l) });
    check("job: no reminder twice", !lines.some((l) => l.includes(" -- Waivers process at")), lines);

    // Sam's claim goes in: the alert goes.
    r = await sam.call("PUT", `${L}/waivers/claims`, { pickupIds: [c("Rob"), c("Maggie")] });
    check("Sam claims Rob, then Maggie", r.status === 200, r);
    r = await sam.call("GET", "/api/me/actions");
    check("alert: gone once the claim's in", !(r.body.items || []).some((it) => it.kind === "pickup" && it.leagueId === classic), r.body.items);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-sam" });
    check("nudge: not someone whose claim is in", r.status === 409, r);

    // The job after processing time: the week processes, is written, and is announced.
    lines = [];
    job = await runWaivers(pool, { now: processAt + 5 * 60e3, leagueIds: ids, log: (l) => lines.push(l) });
    st = (await sam.call("GET", `${L}/state`)).body.state;
    check("job: processed on schedule", job.steps >= 1 && week(st).phase === "processed" && week(st).run?.by === "schedule", { job, phase: week(st).phase });
    const classicLine = (id) => lines.find((l) => l.startsWith(`${id} -- `) && l.includes("Waivers Classic:"));
    const samLine = classicLine(samId);
    const josieLine = classicLine(josieId);
    check("job: Sam hears who he got", /You got Rob/.test(samLine || ""), lines);
    check("job: Josie hears 'Waivers processed', no names", /Waivers processed: .*reveal Episode 3/.test(josieLine || "") && !/Rob|Jelly|Maggie/.test(josieLine || ""), lines);
    job = await runWaivers(pool, { now: processAt + HOUR, leagueIds: ids, log: () => {} });
    check("job: an hour later, nothing new", job.steps === 0 && job.announced === 0, job);
  } finally {
    if (!process.argv.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

async function userId(pool, username) {
  return (await pool.query(`SELECT id FROM "user" WHERE username=$1`, [username])).rows[0]?.id;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
