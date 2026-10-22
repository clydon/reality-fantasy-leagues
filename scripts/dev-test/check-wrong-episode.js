// Dev-only test bank: a commissioner who pastes one episode's research into the NEXT episode's box --
// the confirm that stops it, and Clear to take a paste back out. Needs results-fixture.js up (its
// Classic league, episode 4 aired, episodes 1-3 in) and npm run dev.
//
//   node scripts/dev-test/check-wrong-episode.js <outDir> [width] [--dark]
//
// As zt_comm: pastes an answer for episode 3 through the research route (it carries a title, an air date
// and a summary), then on episode 4's results page pastes the very same answer. Checks that the page
// asks "Is this really episode 4?" and that nothing was saved, that Clear the box empties it, that
// "It is episode 4, add it" saves it, and that "Clear this episode's research" (with its confirm) takes
// it back out of episode 4 while episode 3's stays. Writes <outDir>/wrong-*.png. Removes episodes 3 and
// 4's research and staged rows when done, so it can be re-run.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");

const SEASON = 990;
const SHOW = `(SELECT id FROM shows WHERE slug='survivor')`;
const SEASON_ID = `(SELECT id FROM show_seasons WHERE season_number=$1 AND name='zt-results')`;

// The skeleton the prompt carries, edited: a title, date and summary, and a scoring win for two people.
function answerFrom(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  Object.assign(a, {
    episodeTitle: "zt Three: The Sleeper Agent",
    airDate: "October 8, 2026",
    summary: "zt Three: the tribes met at the challenge and somebody was sent home at tribal council.",
    tribalCouncilHeld: "yes",
  });
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  Object.assign(a.castaways[0], { wonIndividualImmunity: "yes" });
  Object.assign(a.castaways[1], { wonIndividualImmunity: "yes" });
  return JSON.stringify(a);
}

async function cleanup(pool) {
  await pool.query(`DELETE FROM episode_research WHERE season_number=$1 AND episode_number IN (3,4) AND show_id=${SHOW}`, [SEASON]);
  await pool.query(`DELETE FROM season_decisions WHERE episode_number IN (3,4) AND season_id=${SEASON_ID}`, [SEASON]);
}

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-wrong-episode.js <outDir> [width] [--dark]");
  require("fs").mkdirSync(out, { recursive: true });
  const width = parseInt(w, 10);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const { rows } = await pool.query(`SELECT id, state FROM leagues WHERE slug='zt-res-classic'`);
  if (!rows.length) throw new Error("no fixture league: run results-fixture.js up");
  const league = rows[0];
  const epId = (n) => league.state.episodes.find((e) => e.number === n).id;
  await cleanup(pool);

  const { page, errors, BASE, close } = await open({ user: "zt_comm", pass: "zt-pass-12345", width });
  const theme = flags.includes("--dark") ? "dark" : "light";
  await page.addInitScript((t) => {
    localStorage.setItem("rfl.theme", t);
    localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
  }, theme);
  const results = [];
  const check = (ok, what) => results.push(`${ok ? "PASS" : "FAIL"} ${what}`);
  const shot = (name) => page.screenshot({ path: path.join(out, `wrong-${name}-${width}-${theme}.png`), fullPage: true });
  const stored = async (ep) =>
    (await pool.query(`SELECT 1 FROM episode_research WHERE season_number=$1 AND episode_number=$2 AND show_id=${SHOW}`, [SEASON, ep])).rowCount;
  const api = (n) => `${BASE}/api/leagues/${league.id}/episodes/${epId(n)}/research`;
  try {
    // Episode 3's answer, through the route.
    const three = await (await page.request.get(api(3))).json();
    const answer = answerFrom(three.prompt);
    const r = await page.request.post(api(3), { data: { notes: answer }, headers: { origin: BASE } });
    check(r.ok(), `episode 3's own paste accepted (${r.status()})`);

    // The same answer into episode 4, through the page.
    await page.goto(`${BASE}/episodes/4/research?league=${league.id}`, { waitUntil: "networkidle" });
    const box = page.locator("#research-answer");
    await box.fill(answer);
    await page.getByRole("button", { name: "Read the answer" }).click();
    await page.getByText("Is this really episode 4?").waitFor({ timeout: 15000 });
    check((await page.getByText(/looks like episode 3's results, not episode 4's/).count()) === 1, "it says the paste looks like episode 3's");
    check((await stored(4)) === 0, "nothing was saved for episode 4 while it waits");
    check((await page.getByRole("button", { name: "Read the answer" }).count()) === 0, "the plain Read button is replaced by the question");
    await shot("1-asked");

    // Changing the box drops the question; Clear the box empties it.
    await page.getByRole("button", { name: "Clear the box" }).click();
    check((await box.inputValue()) === "" && (await page.getByText("Is this really episode 4?").count()) === 0, "Clear the box empties it and drops the question");

    // Pasting again and confirming saves it.
    await box.fill(answer);
    await page.getByRole("button", { name: "Read the answer" }).click();
    await page.getByRole("button", { name: "It is episode 4, add it" }).click();
    await page.getByText("Added to this episode's research").waitFor({ timeout: 30000 });
    check((await stored(4)) === 1, "confirmed: episode 4's research is saved");
    await shot("2-added");

    // Taking it back out.
    const clear = page.getByRole("button", { name: /Pasted the wrong episode\? Clear/ });
    check((await clear.count()) === 1, "Clear is offered once research is saved");
    await clear.scrollIntoViewIfNeeded();
    await clear.click();
    await page.getByText("Clear episode 4’s research?").waitFor({ timeout: 5000 });
    await shot("3-confirm-clear");
    await page.getByRole("button", { name: "Keep it" }).click();
    check((await stored(4)) === 1, "Keep it leaves the research alone");
    await clear.click();
    await page.getByRole("button", { name: "Clear it" }).click();
    await page.getByText(/Cleared\. Episode 4 is ready for a fresh answer/).waitFor({ timeout: 15000 });
    check((await stored(4)) === 0, "cleared: episode 4's research is gone");
    check((await stored(3)) === 1, "episode 3's research is untouched");
    check((await page.getByRole("button", { name: "Copy the question" }).count()) === 1, "episode 4 asks its question afresh");
    const { rowCount: staged } = await pool.query(`SELECT 1 FROM season_decisions WHERE episode_number=4 AND from_research AND season_id=${SEASON_ID}`, [SEASON]);
    check(staged === 0, "episode 4's research-only results are gone");
    await shot("4-cleared");
  } finally {
    await close();
    await cleanup(pool);
    await pool.end();
  }
  for (const x of results) console.log(x);
  // The 409 is the confirm question itself, which the browser logs as a failed load.
  const unexpected = errors.filter((e) => !/status of 409/.test(e));
  for (const e of unexpected) console.log("page error:", e);
  if (results.some((x) => x.startsWith("FAIL")) || unexpected.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
