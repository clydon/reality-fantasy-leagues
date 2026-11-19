// Dev-only browser check of Round 5's play pieces (docs/PLAN-start-a-game-redo.md, B2; the design:
// docs/design-round/round5-play-pieces-spec.md) at a phone's width, on play-pieces-fixture.js's cases, behind ?play=b2:
//   captain   Ann's Your moves has the Captain row with her carried captain tagged; naming the other starter and saving sends it
//             (the games route then says so); her week tags the captain ×2.
//   second    Ann's pick sheet has the two places; a tap after the pick still changes it; the second place takes its own tap; a pick
//             and a second pick saved go in (the route's pick and second).
//   slots     Bo's open slot lists the groups going into Episode 3; one picked and saved fills it; Ann's week has the slot's row.
//   auction   Your team says what each cost and what Ann spent.
//   bot       Ann's sheet has the bot's call under both settled answers; the page has Against the bot.
//   cut       Di, cut after Episode 1: the strip says so, no lineup is offered, and Your moves has nothing to set.
//   pool      the buy-back night and the forgiven night are marked on the grid and named in its key; the pick sheet says what's left.
//   off       without ?play=b2 (the switch forgotten), none of it shows.
//   Nothing wider than the screen; no page errors.
//
//   node scripts/lane.js dev   (or npm run dev; BASE from .env.local)
//   node scripts/dev-test/check-play-pieces.js [--width=390] [--keep]
//
// Uses the cases already up (.ui-atlas/play-pieces.json), making the three it writes to fresh (captain, second, slots), else brings
// them all up and takes them down after (unless --keep). Its writes change those three: bring them up again before shooting the
// story. zt-gb rows only; local database only.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const { open } = require("./browser");
const fixture = require("./play-pieces-fixture");

const args = process.argv.slice(2);
const W = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").split("=")[1]);
const KEEP = args.includes("--keep");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const check = (ok, what, more) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) {
    failed++;
    if (more) console.log(`      ${more}`);
  }
};
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

async function as(user, go, label, fn) {
  const b = await open({ user, pass: fixture.PASSWORD, width: W, height: 844, motion: "reduce" });
  try {
    await b.page.goto(b.BASE + go, { waitUntil: "networkidle", timeout: 90000 });
    await b.page.locator("[data-game-page]").first().waitFor({ timeout: 45000 });
    await sleep(1200);
    await fn(b.page);
    check(!(await wide(b.page)), `${label} · nothing wider than the screen`);
    if (b.errors.length) check(false, `${label} · no page errors`, b.errors.slice(0, 3).join(" | "));
  } catch (e) {
    check(false, `${label} · ${go}`, e.message.split("\n")[0]);
  } finally {
    await b.close();
  }
}

/** The game as the signed-in viewer reads it (the games route's one game). */
const gameOf = (page, c, game) => page.evaluate(async ([s, couch, id]) => (await (await fetch(`/api/seasons/${s}/games?couch=${couch}&only=${id}`)).json()).games?.find((g) => g.leagueId === id), [c.seasonId, c.couchId, c.games[game]]);
const save = async (page) => {
  await page.getByRole("button", { name: /^Save$/ }).first().click();
  await sleep(2500);
};

async function main() {
  // The cases it writes to (a captain, a pick, a slot) are made fresh each run; the rest are used as they are, or brought up.
  const had = fs.existsSync(fixture.FILE);
  const made = had ? await fixture.up(["captain", "second", "slots"]) : await fixture.up();
  const on = (c, game, more = "") => `${c.pages[game]}?play=b2${more}`;
  try {
    // ---- a captain ----
    {
      const c = made.captain;
      await as(c.user, on(c, "captain", `&moves=lineup&game=${c.games.captain}`), "captain", async (p) => {
        await p.locator("[data-captain-row]").waitFor({ timeout: 15000 });
        const before = await gameOf(p, c, "captain");
        const carried = before?.lineup?.captain?.id;
        check(!!carried, "captain · the lineup carries a captain into Episode 3");
        check((await p.locator(`[data-captain="${carried}"][aria-checked="true"]`).count()) === 1, "captain · the carried captain is chosen on the Captain row");
        check(/Captain ×2/i.test(await p.locator(`[data-moves-games] [data-starter="${carried}"]`).first().innerText()), "captain · their tile is tagged Captain ×2");
        const other = p.locator('[data-captain][aria-checked="false"]').first();
        const next = await other.getAttribute("data-captain");
        await other.click();
        await save(p);
        const after = await gameOf(p, c, "captain");
        check(after?.lineup?.captain?.id === next && next !== carried, "captain · naming the other starter and saving sends it", JSON.stringify(after?.lineup?.captain));
      });
      await as(c.user, on(c, "captain"), "captain week", async (p) => {
        await p.locator("[data-door-you]").first().click();
        await p.locator("[data-week-captain]").first().waitFor({ timeout: 15000 });
        check(/Captain ×2/i.test(await p.locator("[data-week-captain]").first().innerText()), "captain · the week tags the captain ×2");
      });
    }
    // ---- a second pick ----
    {
      const c = made.second;
      await as(c.user, on(c, "second", `&moves=pool&game=${c.games.second}`), "second", async (p) => {
        await p.locator("[data-pick-places]").waitFor({ timeout: 15000 });
        const faces = p.locator("[data-pick]:not([disabled])");
        const a = await faces.nth(1).getAttribute("data-pick"), b = await faces.nth(3).getAttribute("data-pick");
        await faces.nth(1).click();
        await sleep(300);
        check((await p.locator('[data-pick-place="first"][aria-pressed="true"]').count()) === 1, "second · after a pick, a tap still changes the pick (the second takes its own tap)");
        await p.locator('[data-pick-place="second"]').click();
        await sleep(300);
        await faces.nth(3).click();
        await sleep(300);
        await save(p);
        const g = await gameOf(p, c, "second");
        check(g?.pick?.pick === a && g?.pick?.second?.id === b, "second · the pick and the second pick go in", JSON.stringify({ pick: g?.pick?.pick, second: g?.pick?.second }));
      });
    }
    // ---- group slots ----
    {
      const c = made.slots;
      await as(c.also.bo, on(c, "groups", `&moves=lineup&game=${c.games.groups}`), "slots (Bo)", async (p) => {
        await p.locator("[data-slot-row] button").first().click();
        await p.locator("[data-slot-groups]").waitFor({ timeout: 10000 });
        check((await p.locator("[data-slot-groups] [data-slot-group]").count()) >= 2, "slots · the groups going into Episode 3 are listed");
        const pick = p.locator("[data-slot-groups] [data-slot-group]:not([disabled])").first();
        const id = await pick.getAttribute("data-slot-group");
        await pick.click();
        await save(p);
        const g = await gameOf(p, c, "groups");
        check(g?.twists?.slots?.[0]?.groupId === id, "slots · the group picked and saved fills the slot", JSON.stringify(g?.twists?.slots?.[0]));
      });
      await as(c.user, on(c, "groups"), "slots week (Ann)", async (p) => {
        await p.locator("[data-door-you]").first().click();
        await p.locator("[data-week-slot]").first().waitFor({ timeout: 15000 });
        check(/\+|–/.test(await p.locator("[data-week-slot]").last().innerText()), "slots · Ann's week has the slot's row with its points");
      });
    }
    // ---- an auction ----
    {
      const c = made.auction;
      await as(c.user, on(c, "auction"), "auction", async (p) => {
        const t = await p.locator("[data-your-team]").innerText();
        check(/Spent \d+ of 100/.test(t) && /(won|filled) at \d+/.test(t), "auction · Your team says what each cost and what Ann spent", t.slice(0, 200));
      });
    }
    // ---- beat the bot ----
    {
      const c = made.bot;
      await as(c.user, on(c, "beat"), "bot", async (p) => {
        check((await p.locator("[data-against-bot] [data-bot-person]").count()) === 2, "bot · Against the bot, a row a person");
        await p.locator("[data-door-you]").first().click();
        await p.locator("[data-bot-call]").first().waitFor({ timeout: 15000 });
        // (The page shows your latest episode inline too, so the sheet's two are the last two.)
        check((await p.locator("[data-bot-call]").count()) >= 2 && /The bot said/.test(await p.locator("[data-bot-call]").last().innerText()), "bot · the bot's call under both settled answers");
      });
    }
    // ---- knocked out ----
    {
      const c = made.cut;
      await as(c.user, on(c, "cut"), "cut", async (p) => {
        const strip = await p.locator("[data-game-strip]").first().innerText().catch(() => "");
        check(/Cut after Ep 1/i.test(strip) && /play/.test(strip), "cut · the strip says Di was cut and who plays on", strip);
        check(!/change your lineup|set your lineup/i.test(await p.locator("[data-game-page]").innerText()), "cut · no lineup offered");
      });
      await as(c.user, on(c, "cut", `&moves=lineup&game=${c.games.cut}`), "cut moves", async (p) => {
        await sleep(800);
        check((await p.locator("[data-starter]").count()) === 0, "cut · Your moves has nothing to set");
      });
    }
    // ---- a pool's lives ----
    {
      const c = made.pool;
      await as(c.user, on(c, "buyback"), "pool buy-back", async (p) => {
        check((await p.locator('[data-night-cell="bought"]').count()) >= 1, "pool · a bought-back night is marked on the grid");
        check(/bought back in/.test(await p.locator("[data-night-key]").innerText().catch(() => "")), "pool · the grid's key names it");
      });
      await as(c.user, on(c, "mulligan"), "pool mulligan", async (p) => {
        check((await p.locator('[data-night-cell="forgiven"]').count()) >= 1, "pool · a forgiven night is marked on the grid");
      });
      await as(c.user, on(c, "buyback", `&moves=pool&game=${c.games.buyback}`), "pool moves", async (p) => {
        await p.locator("[data-pool-parts]").first().waitFor({ timeout: 15000 });
        check(/life left/.test(await p.locator("[data-pool-parts]").first().innerText()), "pool · the pick sheet says what's left");
      });
    }
    // ---- the switch off ----
    {
      const c = made.captain;
      await as(c.user, `${c.pages.captain}?play=off&moves=lineup&game=${c.games.captain}`, "off", async (p) => {
        await sleep(1500);
        check((await p.locator("[data-captain-row]").count()) === 0, "off · without ?play=b2, no Captain row");
      });
    }
  } finally {
    if (!had && !KEEP) await fixture.down();
  }
  console.log(failed ? `${failed} failed` : "All passed");
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
