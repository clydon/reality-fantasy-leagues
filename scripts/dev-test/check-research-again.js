// Dev-only test bank: a commissioner researching an episode AGAIN to fill gaps (another model, or the
// first pass was too early). Needs results-fixture.js up (its Classic league, episode 4 aired) and
// npm run dev.
//
//   node scripts/dev-test/check-research-again.js <outDir> [width] [--dark]
//
// As zt_comm: pastes a first answer for episode 4 through the research route (everyone answered, one
// advantage find), then on the results page checks "Research answered everything" offers "Research
// again", that it asks about everyone, and pastes a second answer through the UI that fills a gap (an
// immunity win) and contradicts the find (kept, with the disagreement shown). Writes
// <outDir>/again-*.png. Removes the episode's research and staged rows when done, so it can be re-run.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");

const SEASON = 990;
const EP = 4;

// The skeleton the prompt carries (an answer with every field at "don't know"), edited per person.
function answerFrom(prompt, edit) {
  const at = prompt.indexOf("Start from this skeleton");
  const json = prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1);
  const a = JSON.parse(json);
  a.summary = "Episode four.";
  a.tribalCouncilHeld = "yes";
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  edit(a.castaways);
  return JSON.stringify(a);
}

async function cleanup(pool) {
  await pool.query(
    `DELETE FROM episode_research WHERE season_number=$1 AND episode_number=$2 AND show_id=(SELECT id FROM shows WHERE slug='survivor')`,
    [SEASON, EP]
  );
  await pool.query(
    `DELETE FROM season_decisions WHERE episode_number=$2 AND season_id=(SELECT id FROM show_seasons WHERE season_number=$1 AND name='zt-results')`,
    [SEASON, EP]
  );
}

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-research-again.js <outDir> [width] [--dark]");
  require("fs").mkdirSync(out, { recursive: true });
  const width = parseInt(w, 10);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const { rows } = await pool.query(`SELECT id, state FROM leagues WHERE slug='zt-res-classic'`);
  if (!rows.length) throw new Error("no fixture league: run results-fixture.js up");
  const league = rows[0];
  const ep = league.state.episodes.find((e) => e.number === EP);
  await cleanup(pool);

  const { page, errors, BASE, close } = await open({ user: "zt_comm", pass: "zt-pass-12345", width });
  const theme = flags.includes("--dark") ? "dark" : "light";
  await page.addInitScript((t) => {
    localStorage.setItem("rfl.theme", t);
    localStorage.setItem("rfl.notifyNudge", JSON.stringify({ dismissals: 1, until: Date.now() + 864e5 }));
  }, theme);
  const results = [];
  const check = (ok, what) => results.push(`${ok ? "PASS" : "FAIL"} ${what}`);
  const api = `${BASE}/api/leagues/${league.id}/episodes/${ep.id}/research`;
  try {
    // First pass, through the route: everyone answered; the first person found an advantage.
    const first = await (await page.request.get(api)).json();
    const firstAnswer = answerFrom(first.prompt, (cs) => Object.assign(cs[0], { foundAdvantage: "yes", advantageFoundName: "hidden immunity idol" }));
    const r = await page.request.post(api, { data: { notes: firstAnswer }, headers: { origin: BASE } });
    check(r.ok(), `first paste accepted (${r.status()})`);
    const firstName = JSON.parse(firstAnswer).castaways[0].name;
    const secondName = JSON.parse(firstAnswer).castaways[1].name;

    await page.goto(`${BASE}/episodes/${EP}/research?league=${league.id}`, { waitUntil: "networkidle" });
    const again = page.getByRole("button", { name: "Research again" });
    check((await again.count()) === 1, "fully researched: Research again is offered");
    await page.screenshot({ path: path.join(out, `again-1-answered-${width}-${theme}.png`), fullPage: true });

    await again.click();
    await page.getByText(/asks about all \d+ .* again/).waitFor({ timeout: 10000 });
    check(true, "it asks about everyone again");
    await page.screenshot({ path: path.join(out, `again-2-asking-${width}-${theme}.png`), fullPage: true });

    // Second pass, through the UI: fills a gap (the second person won immunity) and says the first
    // person found nothing.
    const second = await (await page.request.get(`${api}?again=1`)).json();
    const secondAnswer = answerFrom(second.prompt, (cs) => {
      Object.assign(cs[0], { foundAdvantage: "no" });
      Object.assign(cs[1], { wonTribeImmunity: "yes" });
    });
    await page.locator("#research-answer").fill(secondAnswer);
    await page.getByRole("button", { name: "Read the answer" }).click();
    await page.getByText("Added to this episode's research").waitFor({ timeout: 30000 });
    check((await page.getByText(new RegExp(`${firstName}: the first research said yes to "found advantage"`)).count()) === 1, "the disagreement is shown");
    await page.screenshot({ path: path.join(out, `again-3-merged-${width}-${theme}.png`), fullPage: true });

    const { rows: stored } = await pool.query(
      `SELECT payload FROM episode_research WHERE season_number=$1 AND episode_number=$2 AND show_id=(SELECT id FROM shows WHERE slug='survivor')`,
      [SEASON, EP]
    );
    const byName = new Map(stored[0].payload.castaways.map((c) => [c.name, c]));
    check(byName.get(firstName).foundAdvantage === "yes", "the earlier find is kept");
    check(byName.get(secondName).wonTribeImmunity === "yes", "the gap is filled");
  } finally {
    await close();
    await cleanup(pool);
    await pool.end();
  }
  for (const x of results) console.log(x);
  for (const e of errors) console.log("page error:", e);
  if (results.some((x) => x.startsWith("FAIL")) || errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
