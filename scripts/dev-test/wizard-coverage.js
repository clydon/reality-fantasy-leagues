// Dev-only check for Start a game's coverage in the built sheet (docs/PLAN-start-a-game-redo.md B1, "a check that drives the wizard
// to each dial value"): every value the coverage table proves through the gallery (gallery-coverage.js --json: each value's `drive`,
// the base, row, change and control that proved it in Node) is reached here by tapping, in a real browser at a phone's size, on a
// real season (rfl_wizard's Survivor 51, Episode 9 next; the table's other pages on their own seasons when the database has them),
// as zt_nd_alex on gallery-fixture.js's couch. Each value: open its base from the gallery, its rule's row, the change's square, the
// control's option (a stepper stepped, a switch set, a checklist ticked), or a question of its kind added and its settings set; then
// the game on screen (the sheet's development-only window.__START_GAME__) must hold the value and pass our check on the season's
// page (a value reached that our check refuses on this season as it stands, a draft too big for who's left, prints HERE: reached,
// not a failure). Every --start-every'th value that plays is also started (the server checks it again and makes it), then taken
// back with Undo.
//
//   node scripts/dev-test/gallery-fixture.js up --db=rfl_wizard          (once; this check leaves it up)
//   node scripts/dev-test/wizard-coverage.js [--base-url=http://localhost:3013] [--out=<dir>] [--only=<regex on key=value>]
//        [--start-every=12] [--width=390]
//
// Writes <out>/wizard-coverage.json (each value: driven, started, or the step it stopped at and why) and a screenshot of each that
// failed. Touches zt rows only (the games it starts are taken back inside the hold); refuses a non-local database. Shares
// new-fixture's zt_nd_ couch: never run beside another check on it. Exit 1 when a value the table proves isn't reached by tapping.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { Pool } = require("pg");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
process.env.BASE = opt("base-url", process.env.BASE || "http://localhost:3013");
const BASE = process.env.BASE;
const { open, api: signIn } = require("./browser");
const C = require("../../src/lib/game/start-gallery/index.js");
const { facetsAll } = require("./gallery-coverage");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("wizard-coverage runs against a local database only");
const OUT = path.resolve(opt("out", path.join(os.tmpdir(), "wizard-coverage")));
fs.mkdirSync(OUT, { recursive: true });
const ONLY = opt("only", null);
const START_EVERY = Number(opt("start-every", 12));
const W = Number(opt("width", 390));
/** The coverage table's pages, by the real seasons gallery-fixture.js finds. */
const SEASON_OF = { s51: "Survivor 51", t5: "Traitors 5", c42: "Challenge 42", bd: "Below Deck 13" };

/** The table's homes, as taps (gallery-coverage.js --json on Survivor 51's captured page; the table itself isn't rewritten). */
function homes() {
  const tmp = path.join(OUT, "coverage.json");
  execFileSync(process.execPath, [path.join(__dirname, "gallery-coverage.js"), "--page=.impeccable/mocks/wizard-r1/pages/s51.json", `--json=${tmp}`, `--out=${path.join(OUT, "coverage.md")}`], { stdio: "ignore" });
  return JSON.parse(fs.readFileSync(tmp, "utf8")).vocab.filter((v) => v.drive && (!ONLY || new RegExp(ONLY).test(`${v.key}=${v.value}`)));
}

/** A question kind each question setting is tried on (gallery-coverage.js proveQuestion's). */
const QUESTION_FOR = { fallback: "group", each: "happens", closes: "winner", asked: "out", from: "who" };

async function main() {
  const pool = new Pool({ connectionString: DB });
  const rows = homes();
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, s.name, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE (s.name, ss.season_number) IN (('Survivor', 51), ('The Traitors (US)', 5), ('The Challenge', 42), ('Below Deck', 13))`
  );
  const seasonId = {};
  for (const r of seasons) seasonId[Object.keys(SEASON_OF).find((k) => SEASON_OF[k] === `${r.name.replace(/\s*\(.*\)$/, "").replace(/^The /, "")} ${r.season_number}`)] = r.id;
  const { rows: couch } = await pool.query("SELECT c.id FROM couches c WHERE c.name = 'ZT Survivor 51' LIMIT 1");
  if (!couch[0] || !seasonId.s51) throw new Error("bring gallery-fixture.js up first (it needs the real Survivor 51 and the zt couch)");
  const couchId = couch[0].id;
  const alex = await signIn({ user: "zt_nd_alex", pass: "zt-pass-12345" });
  const pages = {};
  const pageOf = async (pid) => {
    if (!pages[pid]) {
      const o = (await alex.call("GET", `/api/seasons/${seasonId[pid]}/start?couch=${couchId}&wizard=1`)).body;
      pages[pid] = C.pageFacts(o.wizard.page, { show: o.label });
    }
    return pages[pid];
  };

  const { page: p, close } = await open({ user: "zt_nd_alex", pass: "zt-pass-12345", width: W, height: 844, motion: "off" });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  const wait = (ms) => p.waitForTimeout(ms);
  const tap = async (sel) => {
    const el = p.locator(sel).first();
    await el.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
    await el.click({ timeout: 6000 });
    await wait(200);
  };
  const level = () => p.evaluate(() => window.__START_GAME__?.level ?? null);
  let onSeason = null;
  const gallery = async (pid) => {
    if (onSeason === pid && (await level()) === "gallery") return;
    for (let i = 0; i < 5 && onSeason === pid && (await level()) && (await level()) !== "gallery"; i++) await p.locator("[data-sheet-back]").first().click().catch(() => {});
    if (onSeason === pid && (await level()) === "gallery") return;
    await p.goto(`${BASE}/show/${seasonId[pid]}/games`, { waitUntil: "domcontentloaded" });
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await p.locator("[data-start-row], [data-play-start]").first().click({ timeout: 90000 });
    await p.locator("[data-gallery=gallery]").waitFor({ timeout: 90000 });
    onSeason = pid;
  };
  const toBase = async () => {
    for (let i = 0; i < 4 && (await level()) !== "base"; i++) await p.locator("[data-sheet-back]").first().click().catch(() => {});
  };

  /** Set a control in the open controls to a value; null when done, else why not. */
  const setControl = async (scope, k, value) => {
    let el = p.locator(`${scope} [data-control="${k.id}"]`).first();
    if (!(await el.count())) {
      const more = p.locator(`${scope} [data-gallery-more-options]`).first();
      if (await more.count()) await more.click();
      el = p.locator(`${scope} [data-control="${k.id}"]`).first();
    }
    if (!(await el.count())) return `no ${k.label} control on screen`;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (k.kind === "switch") {
      if (String((await el.getAttribute("aria-checked")) === "true") !== String(value)) await el.click();
      return null;
    }
    if (k.kind === "stepper") {
      for (let i = 0; i < 30; i++) {
        const now = Number((await el.innerText()).match(/-?\d+/)?.[0]);
        if (now === Number(value)) return null;
        const b = el.locator(`button[aria-label^="${now < Number(value) ? "More" : "Fewer"}"]`);
        if (!(await b.count()) || (await b.isDisabled())) return `the stepper stops before ${value}`;
        await b.click();
        await wait(80);
      }
      return `the stepper never reached ${value}`;
    }
    const o = el.locator(`[data-option="${String(value)}"]`).first();
    if (!(await o.count())) return `no option ${value} in ${k.label}`;
    if (k.kind === "checklist" && (await o.getAttribute("aria-checked")) === "true") return null;
    await o.click();
    await wait(150);
    return null;
  };

  const results = [];
  let driven = 0;
  for (const v of rows) {
    const d = v.drive;
    const label = `${v.key}=${v.value}`;
    // ok: reached by tapping (the value landed); plays: our check passes it on this season as it stands today (else `refused`, the
    // season's own reason: a draft too big for who's left; reached all the same, so not a failure of the sheet).
    const r = { key: v.key, value: v.value, where: v.where, base: d.base, page: d.page, ok: false, plays: false, refused: null, step: null, why: null, started: null };
    results.push(r);
    try {
      if (!seasonId[d.page]) throw Object.assign(new Error(`no ${SEASON_OF[d.page] ?? d.page} in this database`), { step: "season" });
      await gallery(d.page);
      const pg = await pageOf(d.page);
      // The base.
      r.step = "base";
      const sq = p.locator(`[data-gallery-lead="${d.base}"], [data-gallery-base="${d.base}"]`).first();
      if (!(await sq.count())) {
        // Off on this season by its own facts (a show whose results can't settle it): reached as far as the season allows.
        const verdict = C.galleryFor(pg, { from: pg.from, to: null }).find((x) => x.id === d.base);
        if (verdict && verdict.state === "off") {
          r.ok = true;
          r.step = null;
          r.refused = `off here: ${C.baseById(d.base)?.name ?? d.base}: ${verdict.why}`;
          throw Object.assign(new Error("off"), { off: true });
        }
        throw new Error(`${C.baseById(d.base)?.name ?? d.base} isn't on this season's gallery`);
      }
      await sq.scrollIntoViewIfNeeded();
      await sq.click();
      await p.waitForFunction(() => window.__START_GAME__?.level === "base", null, { timeout: 8000 }).catch(() => {});
      if ((await level()) !== "base") throw new Error(`${d.base}'s square didn't open (said: ${await p.locator("[data-toast]").innerText().catch(() => "")})`);
      if (d.single) {
        // A question: added of its kind on the questions screen, its settings set there.
        r.step = "questions";
        // The season's questions need a game that runs to its end: the whole rest of it.
        if (await p.locator("[data-gallery-option=length-rest]:not([data-off])").count()) await tap("[data-gallery-option=length-rest]");
        await tap('[data-gallery-row="play"]');
        if ((await level()) !== "questions") throw new Error("the questions screen didn't open");
        const kc = C.QUESTION_KINDS.find((k) => k.id === d.control);
        const qc = kc ? null : C.QUESTION_CONTROLS.find((k) => k.id === d.control);
        const kind = kc ? kc.id : QUESTION_FOR[d.control] || "out";
        await tap("[data-gallery-add-question]");
        const kb = p.locator(`[data-gallery-question-kind="${kind}"]`).first();
        if (!(await kb.count())) throw new Error(`no ${kind} question to add here`);
        await kb.click();
        await wait(250);
        if (qc) {
          const n = (await p.locator("[data-gallery-question-open]").count()) - 1;
          await tap(`[data-gallery-question-open="${n}"]`);
          const opt = qc.options ? qc.options.find((o) => String(o[0]) === String(v.value)) : null;
          const why = await setControl(`[data-gallery=questions]`, qc, opt ? opt[0] : v.value);
          if (why) throw new Error(why);
        }
      } else if (d.change) {
        r.step = "row";
        const row = p.locator(`[data-gallery-row="${d.row}"]`).first();
        if (!(await row.count())) throw new Error(`no ${d.row} row on ${d.base}'s screen`);
        await row.scrollIntoViewIfNeeded();
        await row.click();
        await wait(250);
        if ((await level()) !== "change" && (await level()) !== "questions") throw new Error(`the ${d.row} row didn't open its changes`);
        r.step = "change";
        const sq2 = p.locator(`[data-gallery-choice="${d.change}"]`).first();
        if (!(await sq2.count())) throw new Error(`no ${C.changeById(d.change)?.name ?? d.change} square in ${d.row}`);
        await sq2.scrollIntoViewIfNeeded();
        // Dashed: it can't be had on this season, and the square says why (keepers with no game last season). Reached all the same.
        if ((await sq2.getAttribute("data-off")) !== null && (await sq2.getAttribute("data-chosen")) === null) {
          r.ok = true;
          r.step = null;
          r.refused = `off here: ${(await sq2.innerText()).replace(/\s+/g, " ").trim()}`;
          throw Object.assign(new Error("off"), { off: true });
        }
        // Already on with its controls showing: a second tap would turn it off, so it's left as it is.
        const k0 = d.control ? (C.changeById(d.change).controls || []).find((x) => x.id === d.control) : null;
        const showing = (await sq2.getAttribute("data-chosen")) !== null && k0 && (await p.locator(`[data-gallery-controls] [data-control="${k0.id}"]`).count()) + (k0.more ? await p.locator("[data-gallery-controls] [data-gallery-more-options]").count() : 0) > 0;
        if (!showing) {
          await sq2.click();
          await wait(250);
        }
        if (d.control) {
          r.step = "control";
          const k = (C.changeById(d.change).controls || []).find((x) => x.id === d.control);
          const o = k && k.options ? k.options.find((x) => String(x[0]) === String(v.value)) : null;
          const why = await setControl("[data-gallery-controls]", k, o ? o[0] : v.value);
          if (why) {
            // The control isn't part of this season's game at all (a draft fitted to who's left, shared, has no budget): off here.
            const now = await p.evaluate(() => window.__START_GAME__?.spec);
            const st = now && C.changeStates(now, d.row, pg).find((x) => x.id === d.change);
            if (st && !st.controls.some((x) => x.id === d.control)) {
              r.ok = true;
              r.step = null;
              r.refused = `off here: ${C.baseById(d.base)?.name ?? d.base}'s ${st.name} has no "${k.label}" on this season (${JSON.stringify(now.get || {})})`;
              throw Object.assign(new Error("off"), { off: true });
            }
            throw new Error(why);
          }
        }
      }
      r.step = "landed";
      const g = await p.evaluate(() => window.__START_GAME__);
      const spec = g && g.spec;
      const ch = d.change ? C.changeById(d.change) : null;
      const k = ch && d.control ? (ch.controls || []).find((x) => x.id === d.control) : null;
      const reads = k && spec ? k.read(spec) : undefined;
      const has = !!spec && (facetsAll(spec).has(label) || (k && (Array.isArray(reads) ? reads.map(String).includes(String(v.value)) : String(reads) === String(v.value))));
      if (!has) throw new Error("the game on screen doesn't hold the value");
      r.ok = true;
      r.step = null;
      const chk = C.check(spec, pg);
      r.plays = chk.ok;
      if (!chk.ok) r.refused = chk.problems[0] || chk.waits[0] || "our check refuses it here";
      if (r.plays) driven++;
      // A sample started: the server checks it again and makes it; Undo takes it back inside the hold.
      if (r.plays && START_EVERY && driven % START_EVERY === 0) {
        await toBase();
        const before = p.url();
        await tap("[data-gallery-start]");
        await p.waitForURL(/\/game\//, { timeout: 20000 }).catch(() => {});
        r.started = /\/game\//.test(p.url()) && p.url() !== before;
        if (r.started) await p.locator('[data-toast="done"] button').first().click({ timeout: 5000 }).catch(() => {});
        else r.why = `Start didn't make it: ${await p.locator("[data-toast]").innerText().catch(() => "")}`;
        onSeason = null;
      }
    } catch (e) {
      if (e.off) {
        console.log(`HERE  ${label.padEnd(36)} ${r.refused.slice(0, 140)}`);
        continue;
      }
      // A screen re-rendered under a tap: once more from the gallery.
      if (/not attached to the DOM/.test(String(e.message)) && !r.retried) {
        r.retried = true;
        onSeason = null;
        rows.splice(rows.indexOf(v) + 1, 0, v);
        results.pop();
        continue;
      }
      r.step = e.step || r.step;
      r.why = String(e.message || e).split("\n")[0];
      await p.screenshot({ path: path.join(OUT, `${label.replace(/[^a-z0-9=.-]+/gi, "_")}.png`) }).catch(() => {});
      onSeason = null;
    }
    const how = `${d.base}${d.change ? ` › ${d.change}${d.control ? ` › ${d.control}` : ""}` : ""}`;
    console.log(`${!r.ok || r.started === false ? "FAIL" : r.plays ? "PASS" : "HERE"}  ${label.padEnd(36)} ${r.ok ? `${how}${r.started ? " · started" : ""}${r.refused ? ` · reached; refused on this season: ${r.refused.slice(0, 120)}` : ""}${r.started === false ? ` · ${r.why}` : ""}` : `${r.step}: ${r.why}`}`);
  }
  await close();
  await pool.end();
  fs.writeFileSync(path.join(OUT, "wizard-coverage.json"), JSON.stringify({ at: new Date().toISOString(), results, errors }, null, 1));
  const failed = results.filter((x) => !x.ok || x.started === false);
  const started = results.filter((x) => x.started).length;
  const here = results.filter((x) => x.ok && !x.plays).length;
  console.log(`\n${results.length - failed.length} of ${results.length} values reached by tapping (${here} of them refused by our check on this season as it stands: HERE); ${started} started and taken back${errors.length ? `; page errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(failed.length || errors.length ? `${failed.length + (errors.length ? 1 : 0)} FAILED (${path.join(OUT, "wizard-coverage.json")})` : "ALL PASS");
  process.exit(failed.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.log(`FAIL  crashed: ${e && e.stack}`);
  process.exit(1);
});
