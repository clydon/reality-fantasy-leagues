// Dev-only test bank: one episode at a time (src/new/show/step-through.tsx; the user's pick A with Up to… and air dates, 2026-11-17),
// on step-fixture.js's couch through the real routes and pages at a phone's size. What it asserts, per situation:
//   watch-2   riley watches ZT Traitors, through 8 of 10 out: the line asks "Seen Ep 9?" with when it aired and "2 out"; the guard
//             names Ep 9 with its air date and offers Up to…; the picker lists 9 and 10 with dates; Recap Ep 9 to 10 moves the mark
//             to 10 and plays Ep 9, whose end offers Ep 10's recap and your GIF slot; Skip to Ep 10 moves it to 10 and plays Ep 10;
//             Yes, Ep 9 moves it to 9, the end offers "I've seen Ep 10 too", and Back is Not yet (no question on Tonight, the line's
//             Seen Ep 10 instead); Not yet on Tonight holds on a second phone; Last time keeps its GIF strip.
//   watch-1   one behind: no Up to… (only one out).
//   play-2    sam plays ZT Survivor, through 3 with results in for 4 and 5: the guard's Up to… picks 5: Reveal Ep 4 to 5 in turn.
//   live      riley keeps up live (keep_up 'ask'): Live's card says "Seen Ep 9" and opens the same guard.
// Needs: the app on :3000 (npm run dev; BASE= for another). Brings the fixture up as each situation needs and takes it down (zt-st-
// rows only; it runs beside the zt_nd couch). Run: node scripts/dev-test/check-step-through.js [--only=<regex on the situation>] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const fx = require("./step-fixture");

const args = process.argv.slice(2);
const ONLY = args.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
const want = (id) => !ONLY || new RegExp(ONLY).test(id);
let bad = 0;
const check = (ok, what, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` ${extra}`}`);
  if (!ok) bad++;
};
const sheet = '[role="dialog"]:not([aria-hidden="true"])';
const DATE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/;

(async () => {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let ids = null;
  const follow = async (who, season) =>
    (await pool.query(`SELECT f.seen_through, f.not_yet FROM show_follows f JOIN "user" u ON u.id = f.user_id WHERE u.username = $1 AND f.season_id = $2`, [fx.username(who), season])).rows[0];
  const tonight = async (who, season) => {
    const s = await open({ user: fx.username(who), pass: fx.PASSWORD, motion: "reduce" });
    await s.page.goto(`${BASE}/show/${season}/tonight`);
    await s.page.locator("[data-progress]").first().waitFor({ timeout: 45000 });
    await s.page.waitForTimeout(1500);
    return s;
  };
  const toPicker = async (p) => {
    await p.locator("[data-ask-yes]").click();
    await p.locator("[data-step-guard]").waitFor({ timeout: 8000 });
    await p.locator("[data-step-guard-pick]").click();
    await p.locator("[data-step-picker]").waitFor({ timeout: 8000 });
    await p.waitForTimeout(600);
  };
  const toEnd = async (p) => {
    await p.locator(`${sheet} [data-stage]`).first().waitFor({ timeout: 20000 });
    await p.locator(`${sheet} button:has-text("Skip")`).first().click({ timeout: 15000 });
    await p.waitForTimeout(1500);
  };
  try {
    if (want("watch-2")) {
      ids = await fx.up(pool, { aired: 10, seen: 8, count: 11 });
      const T = ids.traitorsSeasonId;
      let s = await tonight("riley", T);
      let p = s.page;
      const line = (await p.locator("[data-ask-line]").innerText().catch(() => "")).replace(/\s+/g, " ");
      check(/Seen Ep 9\?/i.test(line), "the line asks about the next episode only: Seen Ep 9?", line);
      check(/Aired \S+.* · 2 out/.test(line), "and says when it aired and how many are out", line);
      check(!/Ep 9 and 10/.test(line), "no range in the question", line);
      check((await p.locator("[data-ruler-out]").count()) === 1, "the ruler draws the out run");
      await p.locator("[data-ask-yes]").click();
      await p.locator("[data-step-guard]").waitFor({ timeout: 8000 });
      const guard = (await p.locator(sheet).last().innerText()).replace(/\s+/g, " ");
      check(/Seen Ep 9\?/i.test(guard) && /aired /.test(guard) && DATE.test(guard), "the guard names Ep 9 with its air date", guard.slice(0, 160));
      check((await p.locator("[data-step-guard-pick]").count()) === 1, "Up to… sits beside Yes");
      await p.locator("[data-step-guard-pick]").click();
      await p.locator("[data-step-picker]").waitFor({ timeout: 8000 });
      await p.waitForTimeout(600);
      const rows = p.locator("[data-step-picker] [data-ledger-row]");
      const rowText = (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
      check(rowText.length === 2 && rowText.every((t) => DATE.test(t)), "the picker lists Ep 9 and 10, each with its air date", JSON.stringify(rowText));
      await rows.last().click();
      await p.waitForTimeout(400);
      check(/Recap Ep 9 to 10/.test(await p.locator("[data-step-recap]").innerText().catch(() => "")), "picking 10 offers Recap Ep 9 to 10");
      check(/Skip to Ep 10/.test(await p.locator("[data-step-skip]").innerText().catch(() => "")), "and Skip to Ep 10");
      await p.locator("[data-step-skip]").click();
      await p.locator(`${sheet} [data-stage]`).first().waitFor({ timeout: 20000 });
      await p.waitForTimeout(2500);
      check((await follow("riley", T))?.seen_through === 10, "Skip moves the mark to 10");
      check(/Episode 10/i.test(await p.locator(sheet).last().innerText()), "and plays Ep 10's recap");
      await s.close();

      ids = await fx.up(pool, { aired: 10, seen: 8, count: 11 });
      s = await tonight("riley", ids.traitorsSeasonId);
      p = s.page;
      await toPicker(p);
      await p.locator("[data-step-picker] [data-ledger-row]").last().click();
      await p.locator("[data-step-recap]").click();
      await p.locator(`${sheet} [data-stage]`).first().waitFor({ timeout: 20000 });
      await p.waitForTimeout(1500);
      check((await follow("riley", ids.traitorsSeasonId))?.seen_through === 10, "Recap moves the mark to 10");
      check(/Episode 9/i.test(await p.locator(sheet).last().innerText()), "and plays Ep 9's recap first");
      await toEnd(p);
      check(/Ep 10.s recap/.test(await p.locator('[data-step-next="10"]').innerText().catch(() => "")), "its end offers Ep 10's recap, nothing to confirm");
      check((await p.locator(`${sheet} [data-gif-strip="9"]`).count()) === 1, "and your GIF slot for Ep 9");
      await s.close();

      ids = await fx.up(pool, { aired: 10, seen: 8, count: 11 });
      const T2 = ids.traitorsSeasonId;
      s = await tonight("riley", T2);
      p = s.page;
      await p.locator("[data-ask-yes]").click();
      await p.locator("[data-step-guard-yes]").first().click();
      await p.locator(`${sheet} [data-stage]`).first().waitFor({ timeout: 20000 });
      await p.waitForTimeout(1200);
      check((await follow("riley", T2))?.seen_through === 9, "Yes, Ep 9 moves the mark to 9 only");
      await toEnd(p);
      check(/seen Ep 10 too/i.test(await p.locator('[data-step-next="10"]').innerText().catch(() => "")), "its end asks about Ep 10: I've seen Ep 10 too");
      check((await p.locator(`${sheet} [data-gif-strip="9"]`).count()) === 1, "with your GIF slot for Ep 9");
      await p.locator(`${sheet} button:has-text("Back to")`).last().click();
      await p.waitForTimeout(2500);
      check((await follow("riley", T2))?.not_yet === 10, "Back counts as Not yet (kept on the server)");
      check((await p.locator("[data-ask-line]").count()) === 0, "so Tonight doesn't ask again under the thumb");
      check(/Catching up/.test(await p.locator("[data-progress]").innerText()) && (await p.locator('[data-step-seen="10"]').count()) === 1, "the line keeps its shape: Catching up · Seen Ep 10");
      check((await p.locator("[data-last-time] [data-gif-strip]").count()) === 1, "Last time keeps its GIF strip");
      await s.close();

      ids = await fx.up(pool, { aired: 10, seen: 8, count: 11 });
      s = await tonight("riley", ids.traitorsSeasonId);
      await s.page.locator("[data-ask-later]").click();
      await s.page.waitForTimeout(1200);
      check((await s.page.locator("[data-ask-line]").count()) === 0 && (await s.page.locator('[data-step-seen="9"]').count()) === 1, "Not yet: Catching up with Seen Ep 9 in Yes's place");
      await s.close();
      s = await tonight("riley", ids.traitorsSeasonId);
      check((await s.page.locator("[data-ask-line]").count()) === 0, "a second phone doesn't ask again");
      await s.page.locator('[data-step-seen="9"]').click();
      check((await s.page.locator("[data-step-guard]").count()) === 1, "Seen Ep 9 opens the same guard");
      await s.close();
    }
    if (want("watch-1")) {
      ids = await fx.up(pool, { aired: 10, seen: 9, count: 11 });
      const s = await tonight("riley", ids.traitorsSeasonId);
      await s.page.locator("[data-ask-yes]").click();
      await s.page.locator("[data-step-guard]").waitFor({ timeout: 8000 });
      check((await s.page.locator("[data-step-guard-pick]").count()) === 0, "one behind: no Up to…");
      await s.close();
    }
    if (want("play-2")) {
      ids = await fx.up(pool, { aired: 10, seen: 8, count: 11 });
      const s = await tonight("sam", ids.survivorSeasonId);
      check(/Seen Ep 4\?/i.test(await s.page.locator("[data-ask-line]").innerText().catch(() => "")), "a show you play asks Seen Ep 4?");
      await toPicker(s.page);
      await s.page.locator("[data-step-picker] [data-ledger-row]").last().click();
      await s.page.waitForTimeout(400);
      check(/Reveal Ep 4 to 5 in turn/.test(await s.page.locator("[data-step-recap]").innerText().catch(() => "")), "its picker offers Reveal Ep 4 to 5 in turn");
      await s.close();
    }
    if (want("live")) {
      ids = await fx.up(pool, { aired: 10, seen: 8, count: 11, live: true });
      const s = await tonight("riley", ids.traitorsSeasonId);
      const card = s.page.locator("[data-seen-it]");
      const words = (await card.innerText().catch(() => "")).replace(/\s+/g, " ");
      check(/Seen Ep 9/.test(words) && /Ep 9 aired/.test(words), "Live's card asks about Ep 9, with when it aired", words);
      await s.page.locator("[data-seen-it-yes]").click();
      check((await s.page.locator("[data-step-guard-pick]").count()) === 1, "and opens the same guard, Up to… beside Yes");
      await s.close();
    }
  } finally {
    if (!args.includes("--keep")) await fx.down(pool);
    await pool.end();
  }
  console.log(bad ? `${bad} FAILED` : "ALL PASS");
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
