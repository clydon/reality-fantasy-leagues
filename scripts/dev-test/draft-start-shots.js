// Dev-only: a draft that waits for whoever runs the game, as its runner and as everyone else see it (docs/design-round/
// draft-start-spec.md, round 5 of the game preview), on the real screens at 390: the hub, Tonight, the Games tab, the game's page
// and the draft room, before the draft starts; then once it has a time set. Reuses preview-proof.js's live case (the Fantasy league on
// Survivor 51, zt-gb- rows, removed after) and the maker's own reopening of a game's first draft (preview.cjs draftOpenAtStart).
//
//   node --env-file=.env.local scripts/dev-test/draft-start-shots.js [--out=.ui-atlas/stories/game-preview/draft] [--width=390 --height=844]
//
// Needs this lane's dev server (BASE, default http://localhost:3014) and its database. Writes <out>/<who>-<screen>.png and .txt
// (the screen's words), who being "runner" (the couch's owner, who runs the game) or "player" (the second person), and "-timed"
// frames once a time is set before the first episode, "-late" (the runner) once it's set after it.
const fs = require("fs");
const path = require("path");
process.env.BASE = process.env.BASE || "http://localhost:3014";
const P = require("./preview-proof.js");
const { open } = require("./browser");
const { _h: M } = require("../../tools/gameplay-bench/preview/preview.cjs");
const S = require("../../src/lib/game/state-logic.js");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/game-preview/draft"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = await P.openCase({ social: false });
  try {
    const snap = c.s.snapshot();
    // The game's first draft, open as a new game's is before anyone picks (the maker's own reopening).
    const first = Object.keys(snap.games).find((id) => { const st = snap.games[id].state; return S.BlindDraftLogic.on(st) && st.castaways.some((x) => x.ownerIds.length); });
    if (!first) throw Error("No draft to open in this game");
    await c.sync(M.draftOpenAtStart(snap, first));
    const people = c.doc.world.people.map((x) => x.id);
    const where = { hub: "/home", tonight: `/show/${c.season}/tonight`, games: `/show/${c.season}/games`, page: `/show/${c.season}/game/${c.league("fantasy")}`, room: `/show/${c.season}/blind?game=${c.league(first)}` };
    const ready = { hub: "[data-upnext-plate], main", tonight: "[data-strip]", games: '[id^="game-"]', page: "[data-game-page]", room: "[data-draft]" };
    const shoot = async (who, pid, tag) => {
      const b = await open({ user: c.ids.users[pid].username, pass: c.Live.PASSWORD, width: W, height: H, motion: "reduce" });
      try {
        await b.page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }));
        for (const [k, url] of Object.entries(where)) {
          await b.page.goto(process.env.BASE + url, { waitUntil: "domcontentloaded" });
          await b.page.locator(ready[k]).first().waitFor({ timeout: 60000 }).catch(() => {});
          await b.page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
          await b.page.waitForTimeout(1200);
          const id = `${who}${tag}-${k}`;
          await b.page.screenshot({ path: path.join(OUT, id + ".png") });
          fs.writeFileSync(path.join(OUT, id + ".txt"), await b.page.evaluate(() => document.body.innerText.slice(0, 1500)));
          const strip = await b.page.locator("[data-strip], [data-upnext-plate]").first().innerText().catch(() => "");
          console.log(id, "·", strip.replace(/\s+/g, " ").slice(0, 90));
        }
      } finally {
        await b.close();
      }
    };
    await shoot("runner", people[0], "");
    await shoot("player", people[1], "");
    // A time set (Pick a time) before the game's first episode airs: it starts by itself then, so nothing's the runner's to do; both
    // see when. Then one set after that episode airs: nobody would have a team for it, so it's the runner's to move.
    const setAt = async (ms) => {
      const r = await c.call(people[0], "POST", `/api/seasons/${c.season}/draft`, { leagueId: c.league(first), action: "settings", scheduledAt: new Date(ms).toISOString() });
      if (r.status !== 200) throw Error(`Couldn't set a time (${r.status}): ${JSON.stringify(r.body).slice(0, 160)}`);
    };
    await setAt(Date.now() + 2 * 3600000);
    await shoot("runner", people[0], "-timed");
    await shoot("player", people[1], "-timed");
    await setAt(Date.now() + 2 * 86400000);
    await shoot("runner", people[0], "-late");
  } finally {
    await c.down();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
