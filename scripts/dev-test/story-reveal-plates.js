// Dev-only test bank: the screenshot story's frames for the reveal's face plates (the user, 2026-11-19: "Missing some name plates
// that would go well here", on S51 Ep 9's reveal: What happened's winners, the Survival Pool's pick and Outlast's team were names
// with no faces, and the merge's colour never showed). Real renders of the full-screen reveal (src/new/show/reveal.tsx) at a phone's
// size, on new-fixture.js's couch (Outlast, Weekly Lineup and Survival Pool on a zt Survivor 51 with the real cast's photos; the
// demo season merges its tribes at Episode 6). For each situation, under --out:
//   <situation>.<beat>.jpg          a beat once its motion has settled
//   <situation>.<beat>.t<ms>.jpg    the same beat <ms> after it came up (--motion), for the motion's frames
//   <situation>.<beat>.txt          the beat's words
//   <situation>.end.jpg             the last beat with its end (your GIF slot among the couch's, Share, Back), when "end" is in --beats
// and index.json (every frame) and overlaps.json (words drawn over words: DESIGN-PROCESS.md's rule), printed as OVERLAP lines.
//
// Situations (each brings the fixture up again; alex is one episode behind and reveals it through ?page=reveal&ep=N):
//   merged    Episode 6, the merge: Reward won by four people, Immunity by one, all in the merged tribe; alex's pick survives
//   lost      the same episode, but alex's pick is the one who went home and alex's Outlast team held them
//   tribes    Episode 5, before the merge: one tribe won Reward, two won Immunity
//   crowd     Episode 6 with eight people on the Reward (a big team challenge): the row's most
//   plain     merged, on a show with no photos and no tribes (the universal fallback: initials, no colour)
//
//   npm run dev   (the app; BASE= for another port)
//   node scripts/dev-test/story-reveal-plates.js [--out=.ui-atlas/stories/reveal-plates/after] [--only=<regex on situation>]
//        [--beats=happened,out,game,gifs,end] [--gifs] [--motion=120,420] [--width=390 --height=844] [--keep]
// --gifs: riley and jordan post a GIF for the episode first (fake-gifs.js's pictures, which next dev lets in from loopback), so the
// couch's GIFs beat plays and the end's strip has their tiles (the user, 2026-11-19: "It's hard to see the gifs over our nametags").
// Takes the fixture down at the end unless --keep. zt_nd_ people only; refuses a non-local database (the fixture does).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fx = require("./new-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/reveal-plates/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const BEATS = opt("beats", "happened,out,game").split(",");
const MOTION = opt("motion", "").split(",").filter(Boolean).map(Number);
const KEEP = args.includes("--keep");
const GIFS = args.includes("--gifs");

// The names from the user's Ep 9 screenshot where the fixture's cast has them, else whoever's still in.
const REWARD = ["Devin", "Lewis", "Thien", "Eric"];
const IMMUNE = "Carter";

const first = (n) => n.split(" ")[0];
const inFor = (st, c, n) => c.status !== "eliminated" || (st.episodes.find((e) => e.id === c.exitEpisodeId)?.number ?? 99) >= n;
const outIn = (st, c, n) => c.status === "eliminated" && st.episodes.find((e) => e.id === c.exitEpisodeId)?.number === n;
const ev = (ep, type, c) => ep.scoringEvents.push({ id: `zt_rp_${ep.number}_${type}_${c.id}`, type, castawayId: c.id });
/** The ones named, as far as they're still in, filled up to `k` with whoever else is (never who goes home in it). */
function choose(st, n, names, k) {
  const still = st.castaways.filter((c) => inFor(st, c, n) && !outIn(st, c, n)).sort((a, b) => a.name.localeCompare(b.name));
  const named = names.map((x) => still.find((c) => first(c.name) === x)).filter(Boolean);
  return [...named, ...still.filter((c) => !named.includes(c))].slice(0, k);
}

const SITUATIONS = {
  merged: { n: 6, reward: 4 },
  lost: { n: 6, reward: 4, lost: true },
  tribes: { n: 5, tribes: true },
  crowd: { n: 6, reward: 8 },
  plain: { n: 6, reward: 4, plain: true },
};

/** One league's state for a situation: the wins, and alex's pick and team where it asks. */
function shape(st, s, kind) {
  const ep = st.episodes.find((e) => e.number === s.n);
  ep.scoringEvents = (ep.scoringEvents || []).filter((e) => !["rewardWin", "tribeImmunity", "individualImmunity"].includes(e.type));
  const alex = st.players.find((p) => p.name === "alex").id;
  if (s.tribes) {
    const live = st.castaways.filter((c) => inFor(st, c, s.n));
    const tribeIds = [...new Set(live.map((c) => c.tribeId).filter(Boolean))];
    live.filter((c) => c.tribeId === tribeIds[0]).forEach((c) => ev(ep, "rewardWin", c));
    live.filter((c) => c.tribeId === tribeIds[0] || c.tribeId === tribeIds[1]).filter((c) => !outIn(st, c, s.n)).forEach((c) => ev(ep, "tribeImmunity", c));
  } else {
    const rewarded = choose(st, s.n, REWARD, s.reward);
    rewarded.forEach((c) => ev(ep, "rewardWin", c));
    ev(ep, "individualImmunity", choose(st, s.n, [IMMUNE], s.reward + 1).find((c) => !rewarded.includes(c)));
  }
  if (s.lost) {
    const gone = st.castaways.find((c) => outIn(st, c, s.n));
    if (kind === "outlast") gone.ownerIds = [alex];
    if (kind === "pool") ep.picks = [...(ep.picks || []).filter((p) => p.playerId !== alex), { playerId: alex, castawayId: gone.id }];
  }
  if (s.plain) {
    for (const c of st.castaways) {
      c.photoUrl = null;
      c.tribeId = "";
      delete c.startTribeId;
    }
    st.tribes = [];
    for (const e of st.episodes) delete e.groups;
  }
  return st;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  fs.mkdirSync(OUT, { recursive: true });
  const index = [];
  const overlaps = [];
  const fakeGifs = GIFS ? await require("./fake-gifs").start() : null;
  try {
    for (const [name, s] of Object.entries(SITUATIONS)) {
      if (ONLY && !new RegExp(ONLY).test(name)) continue;
      const f = await fx.up(pool, { through: s.n, seen: { alex: s.n - 1, riley: s.n, jordan: s.n, sam: s.n - 2 } });
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [f.users.alex]);
      for (const kind of ["outlast", "lineup", "pool"]) {
        const st = (await pool.query("SELECT state FROM leagues WHERE id = $1", [f.leagues[kind]])).rows[0].state;
        await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [f.leagues[kind], JSON.stringify(shape(st, s, kind))]);
      }
      if (fakeGifs)
        for (const [who, word] of [["riley", "Plot twist"], ["jordan", "Slow clap"]]) {
          const id = require("./fake-gifs").idOf(word);
          const gif = { id, url: `${fakeGifs.url}/media/${id}/200w.svg`, w: 200, h: 150, title: word };
          await pool.query("INSERT INTO episode_gifs (user_id, season_id, episode, gif) VALUES ($1, $2, $3, $4)", [f.users[who], f.seasonId, s.n, JSON.stringify(gif)]);
        }
      const b = await open({ user: "zt_nd_alex", pass: fx.PASSWORD, width: W, height: H });
      try {
        const { page, BASE } = b;
        await page.goto(`${BASE}/show/${f.seasonId}/tonight?page=reveal&ep=${s.n}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
        const reveal = page.locator("[role=dialog][aria-label='The reveal']");
        await reveal.locator("[data-beat]").first().waitFor({ timeout: 120_000 });
        // Next's dev badge sits over the progress; production has none.
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        const seen = new Set();
        for (let step = 0; step < 14; step++) {
          const beat = await reveal.locator("[data-beat]").getAttribute("data-beat");
          const key = beat.startsWith("game-") ? `game-${[...seen].filter((x) => x.startsWith("game-")).length + 1}` : beat;
          seen.add(key);
          const kind = beat.startsWith("game-") ? "game" : beat;
          if (BEATS.includes(kind)) {
            const id = `${name}.${key}`;
            for (const t of MOTION) {
              await page.waitForTimeout(t - (MOTION[MOTION.indexOf(t) - 1] ?? 0));
              await page.screenshot({ path: path.join(OUT, `${id}.t${t}.jpg`), type: "jpeg", quality: 88 });
            }
            await page.waitForTimeout(2200);
            await page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 88 });
            const words = await reveal.locator("[data-beat]").innerText();
            fs.writeFileSync(path.join(OUT, `${id}.txt`), words);
            for (const o of await overlapsIn(page, H)) {
              overlaps.push({ id, o });
              console.log(`OVERLAP ${id}: ${JSON.stringify(o)}`);
            }
            index.push({ id, situation: name, beat: key, words });
            console.log(`frame ${id}`);
          }
          const back = reveal.getByRole("button", { name: /^Back to / });
          if ((await back.count()) && (await back.first().isVisible())) {
            if (BEATS.includes("end")) {
              await page.waitForTimeout(2200);
              await page.screenshot({ path: path.join(OUT, `${name}.end.jpg`), type: "jpeg", quality: 88 });
              for (const o of await overlapsIn(page, H)) {
                overlaps.push({ id: `${name}.end`, o });
                console.log(`OVERLAP ${name}.end: ${JSON.stringify(o)}`);
              }
              index.push({ id: `${name}.end`, situation: name, beat: "end", words: await reveal.first().innerText() });
              console.log(`frame ${name}.end`);
            }
            break;
          }
          await reveal.locator("[data-stage]").click();
          await page.waitForTimeout(80);
        }
        if (b.errors?.length) console.log(`ERRORS ${name}: ${b.errors.join(" | ")}`);
      } finally {
        await b.close();
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 2));
    if (fakeGifs) await fakeGifs.close();
    if (!KEEP) await fx.down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
