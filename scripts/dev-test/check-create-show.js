// Dev-only test bank: "My show isn't here", the create-league flow's way to add a show (the research
// panel, then the rules review with its sticky Approve), without approving anything.
//
//   node scripts/dev-test/results-fixture.js up      (makes the zt_comm account this signs in as)
//   node scripts/dev-test/check-create-show.js <outDir> [width=390] [--dark]
//
// Types a show name, waits for the prompt to build itself, pastes a ready-made answer (the tour's
// sample), reads it into a draft and shoots the review. Stops before "Approve and add", so no show is
// made; the draft format it leaves is deleted afterwards (keyed on the name "zt-created-show" and the
// zt_comm user). Asserts: the only required field is the name, Copy works as soon as it's typed, and
// Approve is on screen without scrolling to the end of the rules.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");

const NAME = "zt-created-show";

// What a chat might send back (the shape tests/format-proposal.test.js uses), trimmed to approvable.
const PROPOSAL = {
  show: { name: NAME, castawayTerm: "islander", tribeTerm: "Couple", hasMerge: false, hasGroups: true },
  seasonsChecked: ["Series 10"],
  exitMethods: [
    { name: "Dumped", kind: "out", meaning: "Voted out by the public" },
    { name: "Winner", kind: "winner", meaning: "Won the series" },
  ],
  questions: [
    { key: "wonChallenge", type: "answer", question: "Did they win this episode's challenge?", note: "won the challenge", tier: "A", where: "every recap" },
    { key: "leftTheGame", type: "answer", question: "Did they leave?", tier: "A" },
  ],
  events: [
    { id: "wonChallenge", label: "Won a challenge", category: "Challenges", points: 2, tier: "A", why: "always reported", headline: true },
    { id: "dumped", label: "Dumped", category: "Leaving", points: -3, tier: "A", why: "how they left" },
    { id: "wonSeries", label: "Won the series", category: "Endgame", points: 8, tier: "A", why: "" },
  ],
  rules: {
    research: [{ when: { answer: "wonChallenge", is: "yes" }, award: "wonChallenge" }],
    implied: [{ whenExit: "Dumped", award: "dumped" }, { whenExit: "Winner", award: "wonSeries" }],
  },
  notTrackable: [],
  flagged: [],
  domains: [{ domain: "digitalspy.com", why: "recaps" }],
  sources: ["https://example.com/recap"],
};
const fence = String.fromCharCode(96).repeat(3);
const answer = () => `Here you go:
${fence}json
${JSON.stringify(PROPOSAL)}
${fence}`;

(async () => {
  const [out, w = "390", ...flags] = process.argv.slice(2);
  if (!out) throw new Error("usage: check-create-show.js <outDir> [width] [--dark]");
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const failures = [];
  const expect = (ok, what) => (ok ? console.log("ok  ", what) : (failures.push(what), console.log("FAIL", what)));
  const clean = () => pool.query(`DELETE FROM show_formats WHERE name = $1 AND status = 'draft'`, [NAME]);
  await clean();

  const { page, errors, close } = await open({ user: "zt_comm", pass: "zt-pass-12345", width: parseInt(w, 10) });
  await page.addInitScript((t) => localStorage.setItem("rfl.theme", t), flags.includes("--dark") ? "dark" : "light");
  await page.goto(`${BASE}/new-league`, { waitUntil: "networkidle" });
  await page.getByText(/My show isn.t here/).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/show-1-empty.png`, fullPage: true });
  const copy = page.getByRole("button", { name: /Copy prompt/ });
  expect(await copy.isDisabled(), "Copy waits for a name");
  await page.getByLabel("Show name").fill("zt Created Show");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Copy prompt/.test(b.textContent) && !b.disabled), null, { timeout: 15000 });
  expect(true, "typing the name builds the prompt by itself (Copy is enabled)");
  await page.screenshot({ path: `${out}/show-2-named.png`, fullPage: true });
  await page.getByLabel("The chat's answer").fill(answer());
  await page.getByRole("button", { name: "Review the rules" }).click();
  await page.waitForSelector("text=Ready to approve", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/show-3-review.png` });
  await page.screenshot({ path: `${out}/show-3-review-full.png`, fullPage: true });
  const approve = page.getByRole("button", { name: /Approve and add/ });
  const box = await approve.boundingBox();
  const vh = page.viewportSize().height;
  expect(!!box && box.y + box.height <= vh, `Approve is on screen without scrolling (y ${box && Math.round(box.y)} of ${vh})`);

  if (errors.length) console.log("page errors:", errors.slice(0, 5));
  await close();
  await clean();
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
