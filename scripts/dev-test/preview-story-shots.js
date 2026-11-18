// Dev-only: the game preview's made-up season played on the app's real screens, so the story's phone frames show the real screen
// at each moment (docs/PLAN-game-preview.md, decision 6: "a 1:1 view from preview to game"). One live run per season: the game
// (preview-proof.js, the gallery's Fantasy league on Survivor 51) materialized as zt-gb- rows in this lane's database, played
// forward stop by stop with the explorer's runtime authoritative, Alex's own moves made on the real screens (the draft in the draft
// room, Episode 9's lineup on Your moves, the merge's new draft, the finale's reveal) and the couch's through the real routes or
// the engine. At each moment the screen is shot as Alex at 390 x 844 (the phone's viewport, as it shows; 2x), and the production
// game views of the same run are kept, so a card's numbers and its screen are one season.
//
//   node scripts/dev-test/preview-story-shots.js [--seed=51] [--fix]   (one run, printing what it shot; rows removed after)
//   require("./preview-story-shots").capture({ doc, tag })             (preview-story-data.js --live: every sample season)
//
// Needs this lane's dev server (BASE, default http://localhost:3014) and its database, plus what preview-proof.js needs (its
// `record` and the dress). Shots go to the ignored .ui-atlas/preview-proof/shots (real castaways), named <tag>-<moment>.jpg.
const fs = require("fs");
const path = require("path");

process.env.BASE = process.env.BASE || "http://localhost:3014";
const BASE = process.env.BASE;
const root = path.resolve(__dirname, "../..");
const SHOTS = path.join(root, ".ui-atlas/preview-proof/shots");
const W = 390, H = 844;
const P = require("./preview-proof.js");
const { lineups, night, teamsOf, draftOpen, must, nameOf } = P._h;

/** The first stage's draft open, as a new game's is before anyone picks: the runtime dealt it at the start; here nobody's on a team,
 *  nobody's locked in and nothing's revealed (BlindDraftLogic's public half), so the real draft room runs it again. */
function firstDraftOpen(snap, gameId) {
  const next = JSON.parse(JSON.stringify(snap)), st = next.games[gameId].state;
  for (const x of st.castaways) x.ownerIds = [];
  st.draftPicksMade = 0;
  st.blindDraft = { lockedPlayerIds: [], revealedAt: null };
  return next;
}
const sameTeams = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (n) => String(Math.round(n * 10) / 10);
/** The couch's faces, chosen in their profiles as real people choose theirs (the palette's, src/lib/people.ts), so a person keeps one
 *  colour across runs and the four never share one. */
const COLOURS = { alex: "#8db85e", riley: "#e86f9a", jordan: "#5089c9", sam: "#a76bb0" };

async function capture({ doc, seed, tag, log = console.log }) {
  const { open } = require("./browser");
  fs.mkdirSync(SHOTS, { recursive: true });
  // No seeded couch talk: a made-up season has none (and its GIFs don't load locally).
  const c = await P.openCase({ doc, social: false }), s = c.s;
  for (const [pid, colour] of Object.entries(COLOURS)) {
    const r = await c.call(pid, "PUT", "/api/me/profile", { colour });
    if (r.status !== 200) throw Error(`${pid}'s colour wasn't saved (${r.status})`);
  }
  const ids = s.export().input.games.map((g) => g.id);
  const [game, first, merged] = ids;
  const who = nameOf(s);
  const views = () => Object.fromEntries(ids.map((g) => [g, s.project(g, "alex").game]));
  const at = {}, shots = {}, checks = [];
  let b = null, p = null;
  const phone = async () => {
    if (b) await b.close();
    b = await open({ user: c.ids.users.alex.username, pass: c.Live.PASSWORD, width: W, height: H, motion: "reduce" });
    // The dev server's own badge isn't the app's.
    await b.page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }));
    p = b.page;
  };
  const go = async (url, ready) => {
    // A navigation the dev server aborts (a rebuild meanwhile) is tried once more.
    await p.goto(BASE + url, { waitUntil: "domcontentloaded" }).catch(async (e) => {
      if (!/ERR_ABORTED|frame was detached/.test(e.message)) throw e;
      await p.waitForTimeout(3000);
      await p.goto(BASE + url, { waitUntil: "domcontentloaded" });
    });
    if (ready) await p.locator(ready).first().waitFor({ timeout: 60000 });
    await p.waitForFunction(() => document.fonts.check("16px Archivo") || document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2500);
  };
  const top = () => p.locator('[role="dialog"]:not([aria-hidden="true"])').last();
  // Where things sit on the screen (CSS px of the 390 x 844 viewport), for the story to ring: what proves the card's line, or what
  // contradicts the season. Only what's on screen counts.
  const onScreen = (b) => b && b.w > 0 && b.h > 0 && b.y < H && b.y + b.h > 0;
  const boxesOf = async (sel, { union = false, max = 6 } = {}) => {
    const all = await p.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })).catch(() => []);
    const vis = all.filter(onScreen).slice(0, max);
    if (!union || vis.length < 2) return vis;
    const x0 = Math.min(...vis.map((b) => b.x)), y0 = Math.min(...vis.map((b) => b.y));
    return [{ x: x0, y: y0, w: Math.max(...vis.map((b) => b.x + b.w)) - x0, h: Math.max(...vis.map((b) => b.y + b.h)) - y0 }];
  };
  const textBoxes = async (text, exact = false) => {
    const all = await p.getByText(text, { exact }).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })).catch(() => []);
    return all.filter(onScreen).slice(0, 6);
  };
  /** A draft is due, yet the screen says all set (the app's strip; P0's finding). */
  const allSet = async () => { const b = await textBoxes(/All set for/); return b.length ? { text: "Says “All set” while the draft is due", boxes: b.slice(0, 1) } : null; };
  /** The screen as the phone shows it (the viewport), scrolled first so `focus` sits at its top; then where its proof, and anything
   *  that contradicts the season, sit on it. */
  const shoot = async (id, what, { focus, proof, differs } = {}) => {
    if (focus) {
      const el = p.locator(focus).first();
      if (await el.count()) {
        await el.evaluate((e) => { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -16); });
        await p.waitForTimeout(900);
      }
    }
    const file = `${tag}-${id}.jpg`;
    await p.screenshot({ path: path.join(SHOTS, file), type: "jpeg", quality: 80 });
    shots[id] = { file, what, url: p.url().replace(BASE, "").replace(/[0-9a-f-]{36}/g, ":id"), proof: proof ? await proof() : [], differs: differs ? await differs() : null };
    log(`  ${tag} shot ${id} · ${what}${shots[id].differs ? " · differs: " + shots[id].differs.text : ""}`);
  };
  /** The ×N badges on a castaway on every team (N the couch's size), in a revealed draft room. */
  const onEvery = () => textBoxes(`×${Object.keys(COLOURS).length}`, true);
  const season = c.season, page = (g) => `/show/${season}/game/${c.league(g)}`, tonight = `/show/${season}/tonight`;
  const room = (g) => `/show/${season}/blind?game=${c.league(g)}`;
  /** A blind draft on the real draft room: Alex starts it and picks `want.alex` (each from its sheet), shot picked; locks in; the
   *  couch lock theirs through the route; the room shot revealed; the server's teams compared with the runtime's. */
  const draftRoom = async (g, want, label) => {
    await go(room(g), "[data-draft]");
    const start = p.locator("[data-draft-start]").first();
    if (await start.count()) { await start.click(); await p.waitForTimeout(3000); }
    for (const id of want.alex) {
      await p.locator(`[data-draft-wall] [data-tile="${id}"]`).first().click();
      await top().locator("[data-sheet-pick]").waitFor({ timeout: 20000 }); await p.waitForTimeout(500);
      await top().locator("[data-sheet-pick]").click(); await p.waitForTimeout(600);
    }
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
    await shoot(`${label}-picked`, `The draft room: Alex's ${want.alex.length}, picked in private`, { proof: () => textBoxes(/Nobody sees until/) });
    await p.locator("[data-lock]").first().click(); await p.waitForTimeout(2500);
    for (const pid of Object.keys(want).filter((x) => x !== "alex")) {
      const r = await c.call(pid, "POST", `/api/leagues/${c.league(g)}/draft/blind/lock`, { playerId: pid, castawayIds: want[pid] });
      if (r.status !== 200) throw Error(`${pid} couldn't lock in (${r.status}): ${JSON.stringify(r.body).slice(0, 200)}`);
    }
    const real = (await c.Live.read(c.ids)).states.get(c.league(g));
    checks.push({ step: `${label}: the draft, on the real draft room`, agree: sameTeams(teamsOf(real), want) && !!real.blindDraft?.revealedAt });
    await go(room(g), "[data-draft]");
    await shoot(`${label}-revealed`, "The draft room, revealed: everyone's teams", { proof: onEvery });
  };

  try {
    await phone();
    // The start: the game made, its first draft open (the runtime's own teams made again in the real room).
    at.start = views();
    const want1 = teamsOf(s.snapshot().games[first].state);
    await c.sync(firstDraftOpen(s.snapshot(), first));
    await go(`/show/${season}/games`, '[id^="game-"]');
    await shoot("games", "The Games tab: the new game, its draft due", { proof: () => boxesOf('[id^="game-"]', { max: 1 }), differs: allSet });
    await go(tonight, "[data-strip]");
    await shoot("tonight-draft", "Tonight: the draft is the move", { differs: allSet });
    await draftRoom(first, want1, "draft");
    await c.sync();

    // Episode 9: Tonight's move, then Alex's lineup on the real Your moves sheet (the engine's own choice), saved through the route.
    lineups(s, 9, ["alex"]);
    await c.sync();
    await phone();
    await go(tonight, "[data-strip]");
    await shoot("tonight-9", "Tonight before Episode 9: set your lineup", { proof: () => boxesOf("[data-strip]", { max: 1 }) });
    await p.locator("[data-strip] button").first().click();
    await top().locator("[data-starter]").first().waitFor({ timeout: 20000 }); await p.waitForTimeout(1200);
    const l9 = s.project(first, "alex").game.lineup, mine = l9.roster.slice(0, l9.need);
    for (const id of mine) { await top().locator(`[data-starter="${id}"]`).first().click(); await p.waitForTimeout(400); }
    await shoot("moves-9", `Your moves: Alex starts ${mine.map(who).join(", ")}`, { proof: () => boxesOf('[role="dialog"] [data-starter][aria-pressed="true"]', { max: 5 }) });
    const saved = p.waitForResponse((r) => r.request().method() !== "GET" && /\/api\/leagues\/[^/]+\/episodes\/[^/]+\/lineups\//.test(r.url()), { timeout: 20000 }).catch(() => null);
    await top().locator('button:has-text("Save")').last().click();
    const res = await saved; await p.waitForTimeout(2000);
    {
      const real = (await c.Live.read(c.ids)).states.get(c.league(first)), ep = real.episodes.find((e) => e.number === 9);
      const r = s.apply({ type: "lineup", gameId: first, personId: "alex", eventId: l9.epId, ids: ep.lineups?.alex || [] }, "preview-story-live");
      checks.push({ step: "Alex's Episode 9 lineup, on Your moves", route: res ? res.status() : null, agree: r.status === "accepted" && sameTeams([...(ep.lineups?.alex || [])].sort(), [...mine].sort()) });
      await c.sync();
    }

    // Episodes 9 and 10 played, everyone watched: the game's page and Tonight's game section.
    lineups(s, 9); night(s, 9); lineups(s, 10); night(s, 10);
    await c.sync();
    at[10] = views();
    await phone();
    await go(page(first), "[data-game-page]");
    // Your team's numbers are each castaway's points, benched or not (Your team, game-week.tsx): against your score.
    const v10 = s.project(first, "alex").game, teamSum = v10.you.team.reduce((t, id) => t + (v10.cast.find((x) => x.id === id)?.points ?? 0), 0);
    await shoot("stage-10", "The game's page after Episode 10: the season so far", {
      focus: "[data-game-grid]",
      proof: () => boxesOf('[data-game-grid] [data-restack="alex"]', { union: true }),
      differs: async () => (Math.abs(teamSum - v10.you.total) > 1e-9 ? { text: `Your team’s points add to ${fmt(teamSum)}; you scored ${fmt(v10.you.total)}`, boxes: await boxesOf("[data-your-team]", { max: 1 }) } : null),
    });
    await go(tonight, "[data-strip]");
    await shoot("tonight-10", "Tonight after Episode 10: the game's section", {
      focus: "[data-game-mini]",
      proof: () => boxesOf("[data-game-mini]", { max: 1 }),
      differs: async () => { const b = await textBoxes(/0 of 0 still in/); return b.length ? { text: "Says “0 of 0 still in” in a game of points", boxes: b.slice(0, 2) } : null; },
    });

    // The merge: Episode 11 confirms it; the Merged stage's new draft, on the real draft room.
    lineups(s, 11);
    const before = s.snapshot(); night(s, 11); const after = s.snapshot();
    await c.sync(draftOpen(before, after, c.doc, merged));
    at[11] = views();
    await phone();
    await go(tonight, "[data-strip]");
    await shoot("tonight-merge", "Tonight after the merge: the new draft is the move", { differs: allSet });
    await draftRoom(merged, teamsOf(after.games[merged].state), "merge");
    await c.sync();

    // The finale: Episodes 12 and 13 played, the couch has watched; Alex reveals it on the real reveal, then the game's page.
    lineups(s, 12); night(s, 12); lineups(s, 13); night(s, 13, ["riley", "jordan", "sam"]);
    await c.sync();
    await phone();
    await go(tonight, "[data-ask-line], [data-progress-reveal]");
    await p.locator("[data-game-mini], [data-last-time]").first().waitFor({ timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.locator("[data-ask-yes], [data-progress-reveal], [data-progress-watched]").first().click();
    await top().waitFor({ timeout: 20000 }); await p.waitForTimeout(1500);
    for (let k = 0; k < 14; k++) {
      const beat = top().locator("[data-beat]").last();
      if (await beat.isVisible().catch(() => false)) {
        const key = await beat.getAttribute("data-beat");
        if (key === "table") {
          await p.waitForTimeout(2500);
          // The reveal's table, top row first (its rows sit by translateY), against who wins the game overall.
          // (As someone who's watched the finale sees it: Alex's own view still stops before it.)
          const win = s.project(game, "riley").game.table.slice().sort((a, b) => b.total - a.total)[0].name;
          const rows = await p.locator("[data-table-move] > div").evaluateAll((els) => els.map((e) => ({ name: e.querySelector("b")?.textContent || "", y: e.getBoundingClientRect().y })).sort((a, b) => a.y - b.y)).catch(() => []);
          await shoot("reveal-table", "The finale's reveal: where everyone finished", {
            differs: async () => (rows[0] && rows[0].name !== win ? { text: `Ranks one stage: ${rows[0].name} 1st here; ${win} wins overall`, boxes: await boxesOf("[data-table-move]", { max: 1 }) } : null),
          });
          break;
        }
        await beat.click(); await p.waitForTimeout(1600);
      } else {
        const yes = top().locator(':is([data-watched-yes], [data-step-guard-yes], button:has-text("Reveal"))').last();
        if (!(await yes.isVisible().catch(() => false))) break;
        await yes.click(); await p.waitForTimeout(2500);
      }
    }
    {
      const real = (await c.Live.read(c.ids)).members.find((m) => m.league_id === c.league() && m.player_id === "alex");
      const r = s.apply({ type: "reveal", contextId: "show", personId: "alex" }, "preview-story-live");
      checks.push({ step: "Alex reveals the finale", agree: r.status === "accepted" && real?.results_seen_through === 13 });
      await c.sync();
    }
    at[13] = views();
    await phone();
    await go(page(game), "[data-game-page]");
    await shoot("final", "The game's page, the season over", { proof: () => textBoxes(/\d (behind|ahead of) |won it/) });
    // The run's own check: what the app's routes answer for this case against the runtime (api-checks.cjs).
    const problems = (await require(path.join(root, "tools/gameplay-bench/api-checks.cjs")).checkCase({ app: BASE, ids: c.ids, snap: s.snapshot(), document: c.doc, project: (g, pp) => s.project(g, pp) })).map((x) => x.signature + (x.message ? ": " + x.message : ""));
    return { played: { seed, game, stages: [first, merged], at }, shots, checks, problems };
  } catch (e) {
    if (p) await p.screenshot({ path: path.join(SHOTS, `${tag}-zz-failed.png`) }).catch(() => {});
    throw e;
  } finally {
    if (b) await b.close();
    await c.down();
  }
}

module.exports = { capture };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const seed = Number(opt("seed", 51)), fix = args.includes("--fix");
  const { defOf, FIX } = require("./preview-story-data.js");
  const t0 = Date.now();
  capture({ doc: defOf(seed, fix ? FIX : null), seed, tag: `${seed}-${fix ? "fix" : "as"}` })
    .then((r) => console.log(JSON.stringify({ shots: Object.keys(r.shots), checks: r.checks, problems: r.problems, s: Math.round((Date.now() - t0) / 1000) }, null, 1)))
    .catch((e) => { console.error(e); process.exitCode = 1; });
}
