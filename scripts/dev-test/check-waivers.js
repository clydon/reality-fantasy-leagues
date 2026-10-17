// Dev-only test bank: the waiver routes end to end (docs/PLAN-midseason-waivers.md, docs/PLAN-waivers-v2.md),
// as the three people in waivers-fixture.js, against the dev server (npm run dev) and its database. API
// only, no browser.
//
//   node scripts/dev-test/check-waivers.js [--keep]
//
// Brings waivers-fixture.js up at --phase=open --scenarios itself, then checks:
//   Classic ("fantasy football": Replace them, a window every 3, 1 swap)
//   - claims are private: saved claims never appear in league state, and GET /waivers only ever gives
//     you your own (the commissioner sees who has claims in, not what)
//   - a claim saves as ranked pairs, and in the pre-v2 shape by part (the pickup list, or the add/drop)
//   - the reveal gate: zt_wlate (seen through 2) can't claim or move in free agency until they reveal,
//     and their copy of the league (GhostLogic.viewFor, as the app builds it) shows no moves
//   - the commissioner can claim for someone (a computer player too), Process now, and Undo last waiver
//     run; nobody else can
//   - processing in rounds in one waiver order: contested pairs go to whoever's ahead, no priority for
//     replacements; free agency is instant and within the week's swaps; undo puts everything back
//   Active Roster ("early losses cost you": Only when short): a replacement goes through; with Lewis out
//     too, Josie (down to 2) has nothing to replace
//   zt-wv-everyx (Only in waiver windows, every 3, 0 swaps): replacements only, no swaps; turning the
//     window off ends the week
//   zt-wv-rebuild (the merge rebuild): nothing until the commissioner opens a Whole team window, then
//     every loss replaced and every castaway swapped in one run; a window's own say on replacements
//     (off: swaps only)
//   zt-wv-manual (Manual only): a plain week becomes a window, changes, and turns off again, trimming
//     the swap out of a saved claim; Claim for sets one spot of a claim and keeps the rest
//   zt-wv-swaps (Don't replace, every episode, 1 swap): swaps only
//   - a claim row the old code saved (no pairs) is read as pairs, the same as 0063's SQL makes them
// Prints each check; exits 1 if any fail. Takes the fixture down afterwards unless --keep.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { api } = require("./browser");
const fixture = require("./waivers-fixture");

const c = fixture.slugId;
const W = S.WaiverLogic;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})`}`);
  if (!ok) failed++;
}
const week = (state) => W.periods(state).slice(-1)[0];
const owners = (state, name) => (S.getCastaway(state, c(name)) || {}).ownerIds || [];
const pair = (add, drop) => ({ addId: c(add), dropId: c(drop) });
const legacy = (claim) => claim && { pickupIds: claim.pickupIds, dropId: claim.dropId, addIds: claim.addIds };
const got = (run, pid) => (run?.results || []).filter((x) => x.playerId === pid && x.outcome === "got");

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const made = await fixture.up(pool, ["--phase=open", "--scenarios"]);
    const id = (slug) => made.find((m) => m.slug === `zt-wv-${slug}`).leagueId;
    const [kim, sam, josie] = await Promise.all(["zt_wcomm", "zt_wplayer", "zt_wlate"].map((user) => api({ user, pass: fixture.PASSWORD })));
    const L = `/api/leagues/${id("classic")}`;

    // ---- Classic: fantasy football ----
    let r = await sam.call("GET", `${L}/state`);
    check("classic: the week is open after episode 3, a window with 1 swap", r.status === 200 && week(r.body.state)?.phase === "open" && week(r.body.state)?.window === true && week(r.body.state)?.swaps === 1, week(r.body.state));

    // The reveal gate.
    r = await josie.call("PUT", `${L}/waivers/claims`, { pairs: [pair("Rob", "Lewis")] });
    check("not revealed: claims refused", r.status === 409 && /Reveal episode 3/.test(r.body.error), r);
    r = await josie.call("GET", `${L}/waivers`);
    check("not revealed: your claim is held back", r.status === 200 && r.body.hidden === true && r.body.claim === null, r);

    // Pairs, and their privacy.
    const pairs = [pair("Rob", "Jelly"), pair("Maggie", "Jelly"), pair("Maggie", "Kilby"), pair("Patt", "Kilby")];
    r = await sam.call("PUT", `${L}/waivers/claims`, { pairs });
    check("Sam saves ranked pairs", r.status === 200 && week(r.body)?.claimsIn.includes("p-sam"), r);
    check("the saved league carries who, not what", r.status === 200 && !JSON.stringify(r.body).includes('"pairs"') && !JSON.stringify(r.body).includes("pickupIds"));
    r = await sam.call("GET", `${L}/waivers`);
    check("Sam reads his pairs back", JSON.stringify(r.body.claim?.pairs) === JSON.stringify(pairs), r.body);
    check("...with the pre-v2 view of them", JSON.stringify(legacy(r.body.claim)) === JSON.stringify({ pickupIds: [c("Rob"), c("Maggie")], dropId: c("Kilby"), addIds: [c("Maggie"), c("Patt")] }), r.body);
    r = await sam.call("PUT", `${L}/waivers/claims`, { pairs: [pair("Rob", "Mike")] });
    check("a pair must drop someone of yours", r.status === 400 && /on your team/.test(r.body.error), r);
    r = await sam.call("PUT", `${L}/waivers/claims`, { pairs: [pair("Mike", "Kilby")] });
    check("a pair must add a free agent", r.status === 400 && /free agents only/.test(r.body.error), r);
    r = await sam.call("PUT", `${L}/waivers/claims`, { pairs: ["Rob", "Maggie", "Ori", "Patt", "Linnea"].map((n) => pair(n, "Thien An")) });
    check("up to owed + swaps + 2 different adds", r.status === 400 && /up to 4/.test(r.body.error), r);

    // The pre-v2 shape, by part (the phase-2 screens).
    const samClaim = { pickupIds: [c("Rob"), c("Maggie")], dropId: c("Kilby"), addIds: [c("Maggie"), c("Patt")] };
    r = await sam.call("PUT", `${L}/waivers/claims`, samClaim);
    r = await sam.call("GET", `${L}/waivers`);
    check("pre-v2 save: read back the same", JSON.stringify(legacy(r.body.claim)) === JSON.stringify(samClaim), r.body);
    check("pre-v2 save: stored as pairs", JSON.stringify(r.body.claim?.pairs) === JSON.stringify(pairs), r.body.claim?.pairs);
    await sam.call("PUT", `${L}/waivers/claims`, { pickupIds: [c("Maggie"), c("Rob")] });
    r = await sam.call("GET", `${L}/waivers`);
    check("saving only the pickups keeps the add/drop", r.body.claim?.pickupIds[0] === c("Maggie") && r.body.claim?.dropId === c("Kilby") && r.body.claim?.addIds.length === 2, r.body);
    await sam.call("PUT", `${L}/waivers/claims`, { dropId: null, addIds: [] });
    r = await sam.call("GET", `${L}/waivers`);
    check("withdrawing the add/drop keeps the pickups", r.body.claim?.pickupIds.length === 2 && r.body.claim?.dropId === null, r.body);
    await sam.call("PUT", `${L}/waivers/claims`, samClaim);
    r = await kim.call("GET", `${L}/waivers`);
    check("the commissioner can't read Sam's claim", r.status === 200 && r.body.claim === null && !JSON.stringify(r.body).includes(c("Patt")), r.body);
    r = await kim.call("GET", `${L}/state`);
    check("league state never holds claim contents", !JSON.stringify(r.body.state.midSeason).includes("addIds") && !JSON.stringify(r.body.state.midSeason).includes("addId"));
    r = await sam.call("PUT", `${L}/waivers/claims`, { playerId: "p-josie", pairs: [pair("Rob", "Lewis")] });
    check("a player can't claim for someone else", r.status === 403, r);
    r = await kim.call("PUT", `${L}/waivers/claims`, { playerId: "p-josie", pairs: [pair("Rob", "Lewis")] });
    check("the commissioner claims for Josie (not held to Josie's reveal)", r.status === 200 && week(r.body).claimsIn.includes("p-josie"), r);
    // The computer players, claimed for so the run is the same every time.
    r = await kim.call("PUT", `${L}/waivers/claims`, { playerId: "p-andrew", pairs: [pair("Linnea", "Carter")] });
    const r2 = await kim.call("PUT", `${L}/waivers/claims`, { playerId: "p-dee", pairs: [pair("Aaliyah", "Alexis")] });
    check("the commissioner claims for the computer players", r.status === 200 && r2.status === 200, [r.body, r2.body]);
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Ori"), dropId: c("Jelly") });
    check("no free agency before waivers process", r.status === 400 && /isn’t open/.test(r.body.error), r);

    // Processing, in rounds. Order: Kim (no claim), Sam, Andrew, Josie, Dee.
    r = await sam.call("POST", `${L}/waivers/process`);
    check("only the commissioner can Process now", r.status === 403, r);
    r = await kim.call("POST", `${L}/waivers/process`);
    const run = r.body && week(r.body)?.run;
    const res = (pid, kind) => (run?.results || []).find((x) => x.playerId === pid && x.kind === kind) || {};
    check("Process now: the week is in free agency", r.status === 200 && week(r.body).phase === "processed", r);
    check("round 1: Sam replaces Jelly with Rob", res("p-sam", "pickup").castawayId === c("Rob") && res("p-sam", "pickup").droppedCastawayId === c("Jelly") && res("p-sam", "pickup").round === 1, run);
    check("round 2: Sam swaps Kilby for Maggie", res("p-sam", "addDrop").castawayId === c("Maggie") && res("p-sam", "addDrop").round === 2, run);
    check("contested: Josie wanted Rob, Sam was ahead", res("p-josie", "addDrop").outcome === "missed" && res("p-josie", "addDrop").passed[0]?.reason === "ahead" && res("p-josie", "addDrop").passed[0]?.byPlayerId === "p-sam", run);
    check("the computer players' claims went through", owners(r.body, "Linnea").includes("p-andrew") && owners(r.body, "Aaliyah").includes("p-dee"));
    check("rolling order: everyone who moved to the back, in order", JSON.stringify(run?.orderAfter) === JSON.stringify(["p-kim", "p-josie", "p-sam", "p-andrew", "p-dee"]), run?.orderAfter);
    r = await sam.call("PUT", `${L}/waivers/claims`, { pairs });
    check("claims are closed once processed", r.status === 400 && /closed/.test(r.body.error), r);

    // Free agency.
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Ori"), dropId: c("Eric") });
    check("free agency: only your own castaway can be dropped", r.status === 400 && /on your team/.test(r.body.error), r);
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Ori"), dropId: c("Thien An") });
    check("free agency: one swap this window, and it's used", r.status === 400 && /used this window’s swaps/.test(r.body.error), r);
    r = await josie.call("POST", `${L}/waivers/free-agency`, { addId: c("Kilby"), dropId: c("Lewis") });
    check("not revealed: free agency refused too", r.status === 409, r);
    r = await josie.call("GET", `${L}/state`);
    const v = S.GhostLogic.viewFor(r.body.state, "p-josie", r.body.membership.resultsSeenThrough);
    check("Josie's copy: Sam still has Jelly and Kilby, no Rob", owners(v, "Jelly").includes("p-sam") && owners(v, "Kilby").includes("p-sam") && !owners(v, "Rob").length);
    check("Josie's copy: the week shows no claims or results", week(v).hidden === true && week(v).run === null && !week(v).claimsIn.length, week(v));
    r = await josie.call("POST", `${L}/results-seen`, { through: 3 });
    r = await josie.call("POST", `${L}/waivers/free-agency`, { addId: c("Kilby"), dropId: c("Lewis") });
    check("revealed: Josie swaps for Kilby (just dropped) in free agency", r.status === 200 && owners(r.body, "Kilby").includes("p-josie"), r);
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Kilby") });
    check("first come: Kilby's gone", r.status === 409 || r.status === 400, r);

    // Undo.
    r = await sam.call("POST", `${L}/waivers/undo`);
    check("only the commissioner can undo", r.status === 403, r);
    r = await kim.call("POST", `${L}/waivers/undo`);
    const u = r.body;
    check("undo: Rob is a free agent again", r.status === 200 && !owners(u, "Rob").length, r);
    check("undo: Kilby back with Sam, Lewis with Josie, Jelly with Sam", owners(u, "Kilby").includes("p-sam") && owners(u, "Lewis").includes("p-josie") && owners(u, "Jelly").includes("p-sam"));
    check("undo: claims reopen, held", week(u)?.phase === "open" && week(u)?.hold === true, week(u));
    r = await sam.call("GET", `${L}/waivers`);
    check("undo: Sam's claim is still there", JSON.stringify(legacy(r.body.claim)) === JSON.stringify(samClaim), r.body);
    r = await kim.call("POST", `${L}/waivers/process`);
    check("process again after undo", r.status === 200 && owners(r.body, "Rob").includes("p-sam"), r);

    // ---- Active Roster: early losses cost you ----
    const R = `/api/leagues/${id("roster")}`;
    r = await sam.call("PUT", `${R}/waivers/claims`, { pickupIds: [c("Rob")] });
    check("Active Roster: Sam (down to 1) claims a replacement", r.status === 200, r);
    r = await kim.call("POST", `${R}/waivers/process`);
    check("Active Roster: it goes through", r.status === 200 && owners(r.body, "Rob").includes("p-sam"), r);
    const SH = `/api/leagues/${id("short")}`;
    const short = (await kim.call("GET", `${SH}/state`)).body.state;
    r = { body: { state: short } };
    check("only when short: Sam (1 left) can replace one, Josie (2 left: a full lineup) none",
      W.pickupsOwed(r.body.state, "p-sam").count === 1 && W.pickupsOwed(r.body.state, "p-josie").count === 0 && W.replacementsOwed(r.body.state, "p-josie", null).outIds.length === 0);
    r = await kim.call("PUT", `${SH}/waivers/claims`, { playerId: "p-josie", pairs: [pair("Rob", "Lewis")] });
    check("only when short: Josie's bench isn't refilled", r.status === 400 && /can’t replace anyone/.test(r.body.error), r);

    // A row the old code saved, with no pairs: read as pairs, and the same as 0063's SQL makes them.
    await pool.query(
      `INSERT INTO waiver_claims (league_id, period_id, player_id, pickup_ids, updated_by) VALUES ($1,$2,'p-sam',$3::jsonb,NULL)`,
      [id("short"), week(short).id, JSON.stringify([c("Maggie"), c("Rob")])]
    );
    r = await sam.call("GET", `${SH}/waivers`);
    const lazy = r.body.claim?.pairs;
    const want = W.pairsOf(short, week(short), "p-sam", { pickupIds: [c("Maggie"), c("Rob")] }).pairs;
    check("an old row is read as pairs: each pickup with both losses", lazy?.length === 4 && JSON.stringify(lazy) === JSON.stringify(want), r.body);
    const sql = fs.readFileSync(path.join(__dirname, "..", "..", "db", "migrations", "0063_waivers_v2.sql"), "utf8");
    const backfill = sql.slice(sql.indexOf("UPDATE waiver_claims"), sql.indexOf(";", sql.indexOf("UPDATE waiver_claims")));
    const client = await pool.connect();
    try {
      // Run inside a transaction that's rolled back: it only touches rows with no pairs, but nothing here
      // should change real data.
      await client.query("BEGIN");
      await client.query(backfill);
      const { rows } = await client.query(`SELECT pairs FROM waiver_claims WHERE league_id=$1 AND player_id='p-sam'`, [id("short")]);
      check("0063's SQL makes the same pairs", JSON.stringify(rows[0]?.pairs) === JSON.stringify(lazy), rows[0]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    r = await kim.call("POST", `${SH}/waivers/process`);
    check("the old row processes: Sam gets Maggie", r.status === 200 && owners(r.body, "Maggie").includes("p-sam"), r);

    // ---- Replace, but only every X ----
    const X = `/api/leagues/${id("everyx")}`;
    r = await sam.call("GET", `${X}/state`);
    check("every 3: a replacement-only window after episode 3", week(r.body.state)?.window === true && week(r.body.state)?.swaps === 0, week(r.body.state));
    r = await sam.call("PUT", `${X}/waivers/claims`, { pairs: [pair("Rob", "Kilby")] });
    check("every 3: no swaps", r.status === 400 && /No swaps/.test(r.body.error), r);
    r = await sam.call("PUT", `${X}/waivers/claims`, { pairs: [pair("Rob", "Jelly")] });
    check("every 3: Sam claims a replacement", r.status === 200, r);
    r = await sam.call("POST", `${X}/waivers/window`, { swaps: null });
    check("only the commissioner opens or turns off windows", r.status === 403, r);
    r = await kim.call("POST", `${X}/waivers/window`, { swaps: null });
    check("turned off with nothing else to run: the week ends", r.status === 200 && week(r.body)?.phase === "closed" && week(r.body)?.turnedOff === true && !week(r.body)?.claimsIn.length, week(r.body));
    r = await sam.call("GET", `${X}/waivers`);
    check("...and takes the claims with it", r.body.periodId === null && r.body.claim === null, r.body);
    const { rows: left } = await pool.query(`SELECT 1 FROM waiver_claims WHERE league_id=$1`, [id("everyx")]);
    check("...from the table too", left.length === 0, left);
    r = await kim.call("POST", `${X}/waivers/window`, { swaps: 1 });
    check("no reopening it for the same episode", r.status === 409 && /after the next episode/.test(r.body.error), r);

    // ---- The merge rebuild ----
    const RB = `/api/leagues/${id("rebuild")}`;
    r = await sam.call("GET", `${RB}/state`);
    check("rebuild: nothing open after episode 3 (manual only)", !week(r.body.state), week(r.body.state));
    r = await sam.call("PUT", `${RB}/waivers/claims`, { pairs: [pair("Rob", "Jelly")] });
    check("rebuild: no claims without a window", r.status === 400 && /closed/.test(r.body.error), r);
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: 4 });
    check("rebuild: more swaps than a team has is refused", r.status === 400 && /0 to 3/.test(r.body.error), r);
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: "3" });
    check("rebuild: swaps must be a number", r.status === 400, r);
    // Its own say on replacements (the sheet's toggle): off with no swaps is nothing to claim; off with
    // swaps, Jelly waits. Opened again without it, the rule (wait for a window) decides.
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: 0, replace: false });
    check("rebuild: a window with nothing to claim is refused", r.status === 400 && /nothing to claim/.test(r.body.error), r);
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: 3, replace: "no" });
    check("rebuild: replace must be true or false", r.status === 400, r);
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: 3, replace: false });
    check("rebuild: a swaps-only window", r.status === 200 && week(r.body)?.replace === false, week(r.body));
    r = await sam.call("PUT", `${RB}/waivers/claims`, { pairs: [pair("Rob", "Jelly")] });
    check("rebuild: no replacing Jelly in it", r.status === 400 && /replace/.test(r.body.error), r);
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: 3 });
    const wk = week(r.body);
    check("rebuild: the commissioner opens a Whole team window", r.status === 200 && wk?.phase === "open" && wk?.window && wk?.swaps === 3 && wk?.openedBy === "commissioner", wk);
    r = await sam.call("PUT", `${RB}/waivers/claims`, { pairs: [pair("Rob", "Jelly"), pair("Maggie", "Kilby"), pair("Ori", "Thien An")] });
    check("rebuild: Sam replaces Jelly and swaps both still in", r.status === 200, r);
    r = await kim.call("PUT", `${RB}/waivers/claims`, { pairs: [pair("Patt", "Mike"), pair("Linnea", "Eric"), pair("Aaliyah", "Kristin")] });
    check("rebuild: Kim swaps the whole team", r.status === 200, r);
    // The computer players, claimed for: Rob, which Sam is ahead for, so they miss and the run is fixed.
    await kim.call("PUT", `${RB}/waivers/claims`, { playerId: "p-andrew", pairs: [pair("Rob", "Carter")] });
    await kim.call("PUT", `${RB}/waivers/claims`, { playerId: "p-dee", pairs: [pair("Rob", "Alexis")] });
    r = await kim.call("POST", `${RB}/waivers/process`);
    const rb = week(r.body)?.run;
    check("rebuild: Sam gets all three, a round each", got(rb, "p-sam").map((x) => x.round).join() === "1,2,3" && ["Rob", "Maggie", "Ori"].every((n) => owners(r.body, n).includes("p-sam")), rb);
    check("rebuild: Kim gets all three", ["Patt", "Linnea", "Aaliyah"].every((n) => owners(r.body, n).includes("p-kim")) && !owners(r.body, "Mike").length, rb);
    r = await kim.call("POST", `${RB}/waivers/window`, { swaps: 1 });
    check("rebuild: no changing the window once processed", r.status === 409, r);

    // ---- The commissioner decides when ----
    const M = `/api/leagues/${id("manual")}`;
    r = await sam.call("GET", `${M}/state`);
    check("manual: a plain replacement week is open", week(r.body.state)?.phase === "open" && week(r.body.state)?.window === false, week(r.body.state));
    r = await sam.call("PUT", `${M}/waivers/claims`, { pairs: [pair("Maggie", "Thien An")] });
    check("manual: no swaps until a window", r.status === 400 && /No swaps/.test(r.body.error), r);
    r = await kim.call("POST", `${M}/waivers/window`, { swaps: 1 });
    check("manual: the commissioner makes it a window", r.status === 200 && week(r.body)?.window === true && week(r.body)?.swaps === 1, week(r.body));
    r = await sam.call("PUT", `${M}/waivers/claims`, { pairs: [pair("Rob", "Jelly"), pair("Maggie", "Thien An")] });
    check("manual: Sam claims a replacement and a swap", r.status === 200, r);
    r = await kim.call("POST", `${M}/waivers/window`, { swaps: 2 });
    check("manual: and changes it", r.status === 200 && week(r.body)?.swaps === 2, week(r.body));
    r = await kim.call("POST", `${M}/waivers/window`, { swaps: null });
    check("manual: turned off, it's a plain week again", r.status === 200 && week(r.body)?.phase === "open" && week(r.body)?.window === false && week(r.body)?.claimsIn.includes("p-sam"), week(r.body));
    r = await sam.call("GET", `${M}/waivers`);
    check("manual: the swap left Sam's claim, the replacement stayed", JSON.stringify(r.body.claim?.pairs) === JSON.stringify([pair("Rob", "Jelly")]), r.body.claim);
    // Claim for, one spot at a time: Kim sets Sam's replacement for Jelly without seeing the rest.
    r = await kim.call("PUT", `${M}/waivers/claims`, { playerId: "p-sam", spot: { dropId: c("Jelly"), addIds: [c("Ori"), c("Rob")] } });
    check("manual: Claim for sets one spot", r.status === 200 && week(r.body)?.claimsIn.includes("p-sam") && !JSON.stringify(r.body).includes('"pairs"'), r.status);
    r = await sam.call("GET", `${M}/waivers`);
    check("manual: Sam's spot is the commissioner's choices, in order", JSON.stringify(r.body.claim?.pairs) === JSON.stringify([pair("Ori", "Jelly"), pair("Rob", "Jelly")]), r.body.claim);
    r = await kim.call("PUT", `${M}/waivers/claims`, { playerId: "p-sam", spot: { dropId: c("Jelly") } });
    check("manual: a spot needs its adds", r.status === 400, r);
    r = await kim.call("POST", `${M}/waivers/window`, { swaps: null });
    check("manual: nothing to turn off now", r.status === 400 && /no waiver window/.test(r.body.error), r);

    // ---- Don't replace; a window every episode ----
    const SW = `/api/leagues/${id("swaps")}`;
    r = await sam.call("GET", `${SW}/state`);
    check("never: a swap window after every episode, nothing to replace", week(r.body.state)?.window === true && W.pickupsOwed(r.body.state, "p-sam").count === 0, week(r.body.state));
    r = await sam.call("PUT", `${SW}/waivers/claims`, { pairs: [pair("Rob", "Jelly")] });
    check("never: no replacing Jelly", r.status === 400 && /can’t replace/.test(r.body.error), r);
    r = await sam.call("PUT", `${SW}/waivers/claims`, { pairs: [pair("Rob", "Kilby")] });
    check("never: a swap is fine", r.status === 200, r);
    r = await kim.call("POST", `${SW}/waivers/process`);
    check("never: the swap goes through, Jelly stays on Sam's team", r.status === 200 && owners(r.body, "Rob").includes("p-sam") && owners(r.body, "Jelly").includes("p-sam"), r);
  } finally {
    if (!process.argv.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} failed` : "\nall passed");
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
