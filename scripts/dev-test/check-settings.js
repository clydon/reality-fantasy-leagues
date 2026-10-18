// Dev-only test bank: League Settings in the order docs/PLAN-settings-order.md gives it, and the create
// flow's step 3, for a league that hasn't drafted yet.
//
//   node scripts/dev-test/results-fixture.js up      (makes the zt_comm account this signs in as)
//   node scripts/dev-test/check-settings.js <outDir> [width=390] [--dark] [--type=active-roster|classic-draft|pickem]
//                                                    [--keep]   (leave the zt-settings league for a look)
//   node scripts/dev-test/check-settings.js down     (delete it)
//
// Makes one throwaway league, "zt-settings" (zt_comm commissions it, Survivor season 51 from the real
// catalog, nobody drafted), through the same API calls the create flow makes, then shoots the settings
// index, Teams & draft, Waivers, Castaways & tribes and League basics, and /new-league step 3 for the
// type. Asserts what the plan promises: the index leads with Get ready, Waivers says it's set when the
// draft starts, and the Waivers page carries the "Nothing to set yet" note. Deleted afterwards unless
// --keep. Keyed on the league name "zt-settings" and the zt_comm user, so `down` can't touch real data.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");

const NAME = "zt-settings";
const PASS = "zt-pass-12345";

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE name LIKE $1`, [NAME + "%"]); // memberships cascade
}

(async () => {
  const [first, w = "390", ...flags] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  if (first === "down") {
    await down(pool);
    await pool.end();
    return console.log("removed");
  }
  if (!first) throw new Error("usage: check-settings.js <outDir> [width] [--dark] [--type=…] [--keep] | down");
  const out = first;
  const width = parseInt(w, 10);
  const type = (flags.find((f) => f.startsWith("--type=")) || "--type=active-roster").slice(7);
  const theme = flags.includes("--dark") ? "dark" : "light";
  const failures = [];
  const expect = (ok, what) => (ok ? console.log("ok  ", what) : (failures.push(what), console.log("FAIL", what)));

  await down(pool);
  const comm = await api({ user: "zt_comm", pass: PASS });
  // What the create flow does, in its order (create-league-flow.tsx create()).
  const made = await comm.call("POST", "/api/leagues", { name: NAME });
  const id = made.body.league.id;
  const set = (field, value) => comm.call("PATCH", `/api/leagues/${id}/settings`, { field, value });
  await set("showId", "survivor");
  await set("leagueTypeId", type);
  await set("revealedThroughEpisode", null);
  await set("wikiSeason", 51);
  if (type !== "pickem") await set("waiverRecommendation", "balanced");
  await set("setupComplete", true);

  const { page, errors, close } = await open({ user: "zt_comm", pass: PASS, width });
  await page.addInitScript((t) => {
    localStorage.setItem("rfl.theme", t);
    localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
  }, theme);
  const shoot = async (name, href) => {
    await page.goto(`${BASE}${href}${href.includes("?") ? "&" : "?"}league=${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${type}-${name}.png`, fullPage: true });
    return page.locator("main").innerText().catch(() => "");
  };

  const index = await shoot("1-index", "/setup");
  const heads = (await page.locator("h3").allInnerTexts()).map((t) => t.trim().toLowerCase());
  if (type !== "pickem") {
    expect(heads[0] === "get ready", `the index leads with "Get ready" (got ${heads[0]})`);
    expect(/teams & draft/i.test(index), "Teams & draft is on the index");
    expect(/set for you when the draft starts/i.test(index), "Waivers reads: set for you when the draft starts");
    const t = await shoot("2-teams", "/setup/teams");
    expect(/ownership/i.test(t) && /draft date/i.test(t), "Teams & draft has ownership and the draft date");
    // Active Roster starts shared (no fit to worry about); exclusive is where the arithmetic shows.
    await set("ownershipMode", "exclusive");
    await shoot("2b-teams-exclusive", "/setup/teams");
    const t2 = await page.locator("main").innerText();
    expect(/room for \d+ teams? of/i.test(t2), `the fit line does the arithmetic (${(t2.match(/.{0,40}room for.{0,50}/i) || [""])[0].trim()})`);
    const wv = await shoot("3-waivers", "/setup/waivers");
    expect(/nothing to set yet/i.test(wv), "Waivers says nothing to set yet before the draft");
  }
  await shoot("4-cast", "/setup/cast");
  const basics = await shoot("5-basics", "/setup/league");
  expect(!/draft date/i.test(basics) && !/ownership/i.test(basics), "League basics no longer carries ownership or the draft date");

  // The create flow's step 3: ownership and the cast's arithmetic, no waivers. Stops before Create league.
  if (type !== "pickem") {
    await page.goto(`${BASE}/new-league`, { waitUntil: "networkidle" });
    await page.getByText("Survivor", { exact: true }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^Season 51/ }).first().click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator(`[data-tour="type-${type}"]`).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${type}-6-create-step3.png`, fullPage: true });
    const step3 = await page.locator("main").innerText();
    expect(/how are teams drafted/i.test(step3) && /feed \d+ team/i.test(step3 + "") || /shared/i.test(step3), "create step 3 asks how teams are drafted");
    expect(!/waiver|free agent/i.test(step3), "create step 3 no longer asks about waivers");
  }

  // The cast import's review hides the starting tribes until the commissioner says they were public.
  const cm = await comm.call("POST", "/api/leagues", { name: NAME + "-cast" });
  const cid = cm.body.league.id;
  const cset = (field, value) => comm.call("PATCH", `/api/leagues/${cid}/settings`, { field, value });
  await cset("showId", "survivor");
  await cset("leagueTypeId", type);
  await cset("wikiSeason", 99);
  await page.goto(`${BASE}/setup/cast?league=${cid}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const people = ["Ana", "Ben", "Cy", "Di", "Eli", "Fay"].map((name, i) => ({ name, photoUrl: "", startingGroup: i % 2 ? "Toka" : "Savu" }));
  const fence = String.fromCharCode(96).repeat(3);
  const answer = `Here you go:
${fence}json
${JSON.stringify({ castaways: people, sources: ["https://example.com/cast"] })}
${fence}`;
  await page.getByPlaceholder(/Paste the JSON/).fill(answer);
  await page.getByRole("button", { name: "Review" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${type}-7-import-held.png`, fullPage: true });
  const held = await page.locator("main").innerText();
  const heldInputs = await page.locator('input[placeholder="Tribe"]').count();
  expect(/announced before the premiere/i.test(held), "the import asks whether the tribes were announced, unticked");
  expect(heldInputs === 0 && !held.includes("Toka"), `the review shows no starting tribes while they're held (${heldInputs} tribe fields)`);
  await page.getByText(/announced before the premiere/i).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${type}-8-import-public.png`, fullPage: true });
  expect((await page.locator('input[placeholder="Tribe"]').count()) === 6, "ticking it shows each person's tribe to fix");

  if (errors.length) console.log("page errors:", errors.slice(0, 5));
  await close();
  if (!flags.includes("--keep")) await down(pool);
  await pool.end();
  if (failures.length) {
    console.log(`${failures.length} failed`);
    process.exit(1);
  }
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
