// Dev-only: a game's own page, the first look (docs/PLAN-start-a-game-gpt.md track V's V2 and U1; src/new/show/game-page.tsx).
// Opens every game a replay kept (playtest.js's zt-pt- rows: `blind.js run <show> <season> --keep --through=N`) on its own page
// at a phone's width, as one of its seats, takes a screenshot of the whole page and its first screen, and runs the machine checks
// track V asks of every screen: no sideways scroll, no "undefined", NaN or [object, at most one chyron yellow fill, every button
// and link 44px or more (the season grid's squares and episodes 24px), the page's parts there (the title card, the strip, the
// season grid, You, How it plays), no yellow unless a move is due. Then a game of questions' strip opens its sheet, or scrolls to
// the questions made in place; and every door (U1 step 2b): a name, a square, an episode, a face, the path back, Escape and Close.
// Prints a line per game and a summary; exit 1 on any failure.
//
//   node scripts/dev-test/blind.js run survivor 49 --only=1,27,28,41,42,44,56,57,58,59,64,71 --through=6 --keep
//   node scripts/dev-test/check-game-page.js [--width 390] [--height 844] [--user zt_pt_tinkerer] [--only <leagueId,...>] [--out <dir>]
// (--user zt_pt_fan and the rest: each seat sees its own page; the top scorer's twist is chosen by whoever topped the last episode)
//   node scripts/dev-test/blind.js down
//
// Needs: this lane's dev server (BASE, default http://localhost:3000; a lane's .env.local sets it), the kept replay. Screens go to
// --out (default the OS temp folder's gys-game-page/, never the repo: it's public). Touches zt-pt- rows only, and writes nothing.
"use strict";
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const WIDTH = +arg("--width", 390);
const HEIGHT = +arg("--height", 844);
const USER = arg("--user", "zt_pt_tinkerer");
const ONLY = arg("--only", null)?.split(",") ?? null;
const OUT = arg("--out", path.join(os.tmpdir(), "gys-game-page"));

async function main() {
  const DB = process.env.AUTH_DATABASE_URL;
  if (!DB || !/localhost|127\.0\.0\.1/.test(DB)) throw new Error("needs a local database (.env.local)");
  const pool = new Pool({ connectionString: DB });
  const games = (
    await pool.query(
      `SELECT l.id, l.name, l.couch_id, l.state->'settings'->>'leagueTypeId' AS type, ss.id AS season_id
         FROM leagues l
         JOIN league_memberships m ON m.league_id = l.id JOIN "user" u ON u.id = m.user_id
         JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number = (l.state->'settings'->>'wikiSeason')::int
        WHERE l.slug LIKE 'zt-pt-%' AND l.deleted_at IS NULL AND l.stage_of IS NULL AND u.username = $1
        ORDER BY l.created_at`,
      [USER]
    )
  ).rows.filter((g) => !ONLY || ONLY.includes(g.id));
  await pool.end();
  if (!games.length) throw new Error(`no kept games for ${USER}: run blind.js run <show> <season> --keep first`);
  fs.mkdirSync(OUT, { recursive: true });
  const { page, errors, close, settle } = await open({ user: USER, pass: "zt-pass-12345", width: WIDTH, height: HEIGHT });
  const fails = [];
  try {
    for (const [i, g] of games.entries()) {
      // The show opens on the couch you chose last (data.ts gys.couch): this game's.
      await page.goto(`${BASE}/home`);
      await page.evaluate((c) => localStorage.setItem("gys.couch", c), g.couch_id);
      await page.goto(`${BASE}/show/${g.season_id}/game/${g.id}`);
      await page.waitForSelector("[data-game-page], [data-game-back] ~ *", { timeout: 45000 }).catch(() => {});
      await page.waitForSelector("[data-game-grid]", { timeout: 30000 }).catch(() => {});
      await settle();
      await page.waitForTimeout(400);
      // Next's dev indicator sits over the page's foot in a screenshot: out of the way.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      const r = await page.evaluate(() => {
        const root = document.querySelector("[data-game-page]");
        const text = document.body.innerText;
        const yellow = [...document.querySelectorAll("*")].filter((el) => {
          const s = getComputedStyle(el);
          return s.backgroundColor === "rgb(255, 197, 49)" && el.getBoundingClientRect().width > 0 && s.visibility !== "hidden";
        }).length;
        // The season grid's squares and episodes are a column wide (seven at 390, the user's pick): held to WCAG 2.5.8's 24px, every
        // other target to 44.
        const small = [...document.querySelectorAll("[data-game-page] button, [data-game-page] a")]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => ({ el, r: el.getBoundingClientRect(), min: el.matches("[data-square], [data-door-episode]") ? 23.5 : 43.5 }))
          .filter(({ r, min }) => r.height < min || r.width < min)
          .map(({ el, r }) => `${(el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
        // U1 step 2b: the season grid (the couch framed) and You took the big graphic's, the podium's and Previously on's places.
        const parts = ["title", "strip", "grid", "you", "rules"].filter((k) => !document.querySelector(`[data-game-${k}]`));
        return {
          ok: !!root,
          main: root?.getAttribute("data-game-main"),
          phase: root?.getAttribute("data-game-phase"),
          strip: document.querySelector("[data-game-strip]")?.getAttribute("data-game-strip"),
          sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
          broken: /undefined|NaN|\[object/.test(text),
          yellow,
          due: document.querySelector("[data-game-strip]")?.getAttribute("data-game-due") === "yes",
          small,
          missing: parts,
          height: document.documentElement.scrollHeight,
          head: (root?.innerText || text).replace(/\s+/g, " ").slice(0, 150),
        };
      });
      const tag = `${String(i + 1).padStart(2, "0")}-${(r.main || "none")}-${g.id.slice(0, 8)}`;
      await page.screenshot({ path: path.join(OUT, `${tag}-first.png`) });
      await page.screenshot({ path: path.join(OUT, `${tag}-full.png`), fullPage: true });
      // The move: a game of questions answered in place (the first open question's first choice, then the named confirm); else
      // a strip that goes somewhere opens it (a sheet, or a page over the show).
      let move = "none";
      // Answers already saved fold to one line (U1 step 2b): Change opens them again.
      if (await page.locator("[data-questions-change]").count()) {
        await page.locator("[data-questions-change]").click();
        await page.waitForSelector("[data-game-move=questions] [data-question-status]", { timeout: 15000 }).catch(() => {});
      }
      if (await page.locator("[data-game-move=questions] [data-question-status=open]").count()) {
        const q = page.locator("[data-game-move=questions] [data-question-status=open]").first();
        const pick = q.locator(":is([data-answer-face], [data-answer-option], [data-answer-side]):not([aria-pressed=true])").first();
        if (await pick.count()) {
          await pick.click();
          const save = page.locator("[data-game-move=questions] [data-sheet-save]");
          await save.click();
          move = (await page.waitForFunction(() => !!document.querySelector("[data-questions-state=saved]") || /Saved/.test(document.querySelector("[data-game-move=questions] [data-sheet-save]")?.textContent || ""), null, { timeout: 15000 }).then(() => "saved").catch(() => "not saved"));
          // After the save: the page as it reads then, the answer where it was made.
          await page.waitForTimeout(600);
          await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
          await page.screenshot({ path: path.join(OUT, `${tag}-saved.png`), fullPage: true });
        } else move = "no simple control first";
      } else if (await page.locator("[data-game-move=slots] [data-slot-pick]").count()) {
        // A group slot waiting on a pick: the first group on offer, saved by the tap.
        await page.locator("[data-game-move=slots] [data-slot-pick]").first().click();
        move = await page.waitForFunction(() => !document.querySelector("[data-slot-pick]") || /is in slot/.test(document.body.innerText), null, { timeout: 15000 }).then(() => "slot picked").catch(() => "not saved");
        await page.waitForTimeout(5000);
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        await page.screenshot({ path: path.join(OUT, `${tag}-saved.png`), fullPage: true });
      } else if (await page.locator("[data-game-move=twist] [data-twist-option]").count()) {
        // The top scorer's twist, chosen in place: an option not chosen yet, then the named confirm.
        await page.locator("[data-game-move=twist] [data-twist-option][aria-checked=false]").first().click();
        await page.screenshot({ path: path.join(OUT, `${tag}-picked.png`), fullPage: true });
        await page.locator("[data-twist-save]").click();
        move = await page.waitForFunction(() => !!document.querySelector("[data-twist-state=chosen]"), null, { timeout: 15000 }).then(() => "twist chosen").catch(() => "not saved");
        // The saved toast covers the top bar for a few seconds: let it go first.
        await page.waitForTimeout(5000);
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        await page.screenshot({ path: path.join(OUT, `${tag}-saved.png`), fullPage: true });
      } else if (await page.locator("[data-game-strip] button").count()) {
        const before = page.url();
        await page.locator("[data-game-strip] button").click();
        move = await page.waitForFunction((u) => location.href !== u || !!document.querySelector("[role=dialog][data-open], [role=dialog]:not([aria-hidden=true])"), before, { timeout: 10000 }).then(() => "opened").catch(() => "nothing opened");
        await page.goto(`${BASE}/show/${g.season_id}/game/${g.id}`);
      }
      if (move === "not saved" || move === "nothing opened") r.moveFail = move;
      r.doors = await doors(page, g);
      const bad = [
        !r.ok && "no page",
        r.sideways && "sideways scroll",
        r.broken && "undefined/NaN in its words",
        r.yellow > 1 && `${r.yellow} yellow fills`,
        r.yellow > 0 && !r.due && "yellow with nothing due",
        r.missing.length && `missing ${r.missing.join(", ")}`,
        r.small.length && `small targets: ${r.small.slice(0, 4).join("; ")}`,
        r.moveFail && `the move: ${r.moveFail}`,
        ...r.doors.map((d) => `door: ${d}`),
      ].filter(Boolean);
      if (bad.length) fails.push(`${g.name} (${g.type}, ${g.id}): ${bad.join(" · ")}`);
      console.log(`${bad.length ? "FAIL" : "ok  "} ${tag} ${g.type} · ${r.phase} · strip ${r.strip} · move ${move} · ${r.height}px${bad.length ? " · " + bad.join(" · ") : ""}`);
      console.log(`     ${r.head}`);
    }
  } finally {
    await close();
  }
  if (errors.length) console.log(`page errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 8).join("\n  ")}`);
  console.log(`\n${games.length} games, ${fails.length} failing; screens in ${OUT}`);
  for (const f of fails) console.log("  " + f);
  process.exit(fails.length ? 1 : 0);
}
/**
 * Every door on the page opens the next view down on the right episode (U1 step 2b, game-sheets.tsx): a name, its person's sheet
 * on the latest episode; a square, theirs on that episode; an episode, everyone's that night; inside a sheet a name opens a sheet
 * over it with the path back on top; Escape takes the top one down, Close shuts them all; a face, that castaway in this game.
 * Answers what failed.
 */
async function doors(page, g) {
  const bad = [];
  const dialogs = () => page.locator("[role=dialog]").count();
  const top = () => page.locator("[role=dialog]").last();
  const shown = async () => {
    // The person sheet's episode: a lineup's pane in view, else its episode block.
    const lineup = await top().locator('[data-pane="1"] [data-week-pane]').getAttribute("data-week-pane", { timeout: 2000 }).catch(() => null);
    if (lineup) return Number(lineup);
    return Number((await top().locator("[data-episode-block]").first().getAttribute("data-episode-block", { timeout: 4000 }).catch(() => null)) ?? NaN);
  };
  const closeAll = async () => {
    for (let k = 0; k < 4 && (await dialogs()); k++) {
      await top().getByRole("button", { name: "Close" }).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  };
  await page.goto(`${BASE}/show/${g.season_id}/game/${g.id}`);
  await page.waitForSelector("[data-game-grid]", { timeout: 45000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const eps = await page.locator("[data-game-grid] [data-door-episode]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-door-episode"))));
  const names = page.locator("[data-game-grid] button[data-door-person]");
  const n = await names.count();
  if (!eps.length || !n) return bad;
  const latest = eps.at(-1);
  // A name: their sheet on the latest episode, the game on the path back.
  const who = await names.nth(Math.min(1, n - 1)).getAttribute("data-door-person");
  await names.nth(Math.min(1, n - 1)).click();
  await page.waitForTimeout(900);
  if ((await shown()) !== latest) bad.push(`a name opened Ep ${await shown()}, not the latest (${latest})`);
  if (!(await top().locator("[data-sheet-crumb] [data-crumb]").count())) bad.push("no path back on the person sheet");
  await closeAll();
  // A square: their sheet on that episode.
  const first = eps[0];
  await page.locator(`[data-square="${who}:${first}"]`).click();
  await page.waitForTimeout(900);
  if (eps.length > 1 && (await shown()) !== first) bad.push(`a square on Ep ${first} opened Ep ${await shown()}`);
  // A face in the sheet: that castaway in this game, over it.
  const face = top().locator("[data-door-cast]").first();
  if (await face.count()) {
    await face.scrollIntoViewIfNeeded();
    await face.click();
    await page.waitForTimeout(900);
    if (!(await top().locator("[data-cast-sheet]").count())) bad.push("a face didn't open its castaway");
    else if ((await dialogs()) < 2) bad.push("the castaway didn't open over the person");
  }
  await closeAll();
  if (await dialogs()) bad.push("Close didn't shut them all");
  // An episode: everyone's that night; a name there, a sheet over it on that episode; Escape back to the episode.
  await page.locator(`[data-game-grid] [data-door-episode="${latest}"]`).click();
  await page.waitForTimeout(900);
  if (Number(await top().locator("[data-episode-sheet]").getAttribute("data-episode-sheet", { timeout: 4000 }).catch(() => NaN)) !== latest) bad.push("an episode didn't open its sheet");
  const row = top().locator("[data-episode-row] [data-door-person]").first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(900);
    if ((await dialogs()) < 2) bad.push("a name on the episode sheet didn't open over it");
    if ((await shown()) !== latest) bad.push(`the episode's name opened Ep ${await shown()}`);
    const parts = await top().locator("[data-sheet-crumb] [data-crumb]").count();
    if (parts < 2) bad.push(`the path back has ${parts} parts, not 2`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    if (!(await top().locator("[data-episode-sheet]").count())) bad.push("Escape didn't come back to the episode");
  }
  await closeAll();
  return bad;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
