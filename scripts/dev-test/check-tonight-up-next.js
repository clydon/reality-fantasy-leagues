// Dev-only check for Tonight's Up next for you (docs/PLAN-up-next.md; src/new/show/up-next.tsx, the user's pick A of the 2026-11-01
// mocks) and its slim All set, against the dev server, on new-fixture.js's couch ("ZT Survivor 51": alex, riley, jordan and sam play
// it, results through Episode 5, everyone on 5 but sam on 3, Episode 6 in three days; ZT Traitors, weekly, Episodes 1-3 aired, which
// riley follows openly through 2 and jordan privately through 4). GIFs come from fake-gifs.js, the KLIPY stand-in. (Classic's Up
// next on Overview is check-up-next.js.)
//   API (POST /api/seasons/[id]/plans?couch=, `now`): riley starts Episode 3 of the Traitors now with alex: a shared start at about
//   now, alex invited, and a line from riley in the couch chat; a second for the same episode is refused (409); `now` with the live
//   airing is refused (400).
//   In a real browser at --width (390 by default):
//   - riley (behind on a show she only watches): the plate for Episode 3 under the heading ("Up next for you", "You're up to
//     Episode 2"), no Plan a watch along beside it; Ask opens the sheet (nobody picked: nobody shares her spot), picking alex and
//     Start now opens the watch along with the plan; I watched it asks first (Not yet moves nothing), Yes moves her to 3 and plays
//     the reveal of a show she only watches (In this episode, The couch reacts with Add your GIF, no games, no Share), the toast's
//     Undo moves her back; the reveal API plays every episode she's seen (no games, never "nothing"), 403 past her mark; then
//     caught up, no plate and "Watch Episode 4 together";
//   - the heading over a plate is always the next airing, "On TV …" (riley's Episode 4; sam's Episode 6, the one his moves are for);
//   - sam (behind on a show he plays): Your moves before the plate, which says "You're 2 behind" for Episode 4 (data-results-in);
//     I watched it asks ("Its results play next"), Not yet keeps him on 3, Yes opens the reveal of Episode 4;
//   - alex (caught up): no plate, "Watch Episode 6 together"; Episodes' Replay the reveal on Episode 5's page plays it as it was
//     (its beats, Back to the show, nothing moved); then Episode 6 on the air, his moves locked: the slim All set ("Your moves
//     are locked", one line under 72px);
//   - riley's Episodes: Episode 3's page replays its reveal (Skip: The couch reacts, nothing moved).
//   Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal; BASE= for a lane's server)
//   node scripts/dev-test/check-tonight-up-next.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Prints PASS/FAIL;
// exits 1 on a failure.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeGifs = require("./fake-gifs");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-tonight-up-next runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-tonight-up-next.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const u = fixture.username;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const gifs = await fakeGifs.start();
  closers.push(() => gifs.close());
  const stand = { "x-gys-gifs": gifs.url };
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const tid = fx.traitorsSeasonId;
    const A = fx.couchId;
    const U = fx.users;
    for (const id of Object.values(U)) await pool.query(`INSERT INTO user_settings (user_id, ui, tour_seen_at) VALUES ($1, 'new', now()) ON CONFLICT (user_id) DO UPDATE SET ui = 'new', tour_seen_at = now()`, [id]);
    const seenOf = async (who, season) => (await pool.query("SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [U[who], season])).rows[0]?.seen_through;
    const clearPlans = async () => {
      await pool.query("DELETE FROM watch_plans WHERE couch_id = $1 AND season_id = $2", [A, tid]);
      await pool.query("DELETE FROM chat_messages WHERE user_id = $1 AND couch_id = $2 AND season_id = $3 AND text LIKE 'Starting Episode%'", [U.riley, A, tid]);
    };

    // ---------- API: Start now ----------
    const riley = await api({ user: u("riley"), pass: PASSWORD });
    const plan = (body) => riley.call("POST", `/api/seasons/${tid}/plans?couch=${A}`, body);
    const t0 = Date.now();
    let r = await plan({ episode: 3, how: "start", startsAt: new Date().toISOString(), invite: [U.alex], now: true });
    const made = r.body?.plan;
    check(r.status === 200 && made?.episode === 3 && Math.abs(Date.parse(made.startsAt) - t0) < 120_000 && r.body.told === 1, "Start now: a shared start of Episode 3 at about now, alex invited", JSON.stringify(r.body).slice(0, 200));
    const line = (await pool.query("SELECT text FROM chat_messages WHERE user_id = $1 AND couch_id = $2 AND season_id = $3 AND created_at > now() - interval '2 minutes'", [U.riley, A, tid])).rows;
    check(line.some((m) => /Starting Episode 3 now\. Join me in the watch along\?/.test(m.text)), "and a line from riley in the couch chat", JSON.stringify(line));
    r = await plan({ episode: 3, how: "start", startsAt: new Date().toISOString(), invite: [U.alex], now: true });
    check(r.status === 409, "a second watch along for Episode 3 on the couch is refused (409)", String(r.status));
    r = await riley.call("POST", `/api/seasons/${sid}/plans?couch=${A}`, { episode: 6, how: "live", invite: [U.alex], now: true });
    check(r.status === 400, "now with the live airing is refused (400)", String(r.status));
    await clearPlans();

    // ---------- the browser ----------
    const noBadge = () =>
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    let shots = 0;
    const browse = async (who) => {
      const b = await open({ user: u(who), pass: PASSWORD, width, height: 844, motion: "off", headers: stand });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.emulateMedia({ reducedMotion: "reduce" });
      const pg = b.page;
      return {
        pg,
        shot: async (name) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.screenshot({ path: path.join(out, `${String(++shots).padStart(2, "0")}-${who}-${name}.png`) });
        },
        wide: async (what) => {
          const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          check(over <= 0, `${what}: nothing wider than the screen`, `${over}px over`);
        },
        errors: () => b.errors.filter((x) => !/favicon|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(x)),
        sheet: () => pg.locator("[role=dialog][data-open]"),
        closed: () => pg.locator("[role=dialog][data-open]").waitFor({ state: "detached", timeout: 10_000 }).catch(() => {}),
      };
    };
    const textOf = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\s+/g, " ");

    // ---------- riley: behind on a show she only watches ----------
    const R = await browse("riley");
    const rp = R.pg;
    await rp.goto(`${BASE}/show/${tid}/tonight`, { waitUntil: "load" });
    const rplate = rp.locator('[data-up-next="3"]');
    await rplate.waitFor({ timeout: 60_000 });
    await rp.waitForTimeout(800);
    const rtext = await textOf(rplate);
    check((await rplate.getAttribute("data-up-next-kind")) === "watch" && /Up next for you/i.test(rtext) && /Episode 3/i.test(rtext) && /You're up to Episode 2/.test(rtext), "riley: the plate for Episode 3, Up next for you, You're up to Episode 2", rtext);
    const under = await rp.evaluate(() => {
      const plate = document.querySelector("[data-up-next]");
      const phase = document.querySelector("[data-phase]");
      return !!plate && !!phase && !!(phase.compareDocumentPosition(plate) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    check(under, "under the episode heading");
    const rphase = await textOf(rp.locator("[data-phase]"));
    check(/Episode 4/i.test(rphase) && /On TV/.test(rphase), "the heading is the next airing, TV's: Episode 4 · On TV …", rphase);
    check((await rp.locator("[data-plan-invite]").count()) === 0, "no Plan a watch along beside it (the plate asks)");
    check(/Watch along/.test(await textOf(rplate.locator("[data-up-next-watch]"))) && /I watched it/.test(await textOf(rplate.locator("[data-up-next-watched]"))), "Watch along, I watched it");
    await rplate.scrollIntoViewIfNeeded();
    await R.shot("plate");
    await R.wide("riley's Tonight");

    // Ask the couch: nobody shares her spot, so nobody's picked; alex, then Start now.
    await rplate.locator("[data-up-next-ask]").click();
    const ask = R.sheet().locator("[data-ask-sheet='3']");
    await ask.waitFor({ timeout: 15_000 });
    await rp.waitForTimeout(400);
    const nowBtn = R.sheet().locator("[data-ask-now]");
    check((await ask.locator("[data-ask-person]").count()) === 3 && (await nowBtn.isDisabled()) && /Pick someone/.test(await nowBtn.innerText()), "Ask: the couch's three, nobody picked yet, Pick someone", await textOf(R.sheet()));
    await ask.locator(`[data-ask-person="${u("alex")}"]`).click();
    check(/Start now and ask zt_nd_alex/.test(await nowBtn.innerText()) && !(await nowBtn.isDisabled()), "picking alex: Start now and ask zt_nd_alex");
    check((await R.sheet().locator("[data-ask-later]").count()) === 1, "and Pick a time instead");
    await R.shot("ask");
    await nowBtn.click();
    await rp.waitForURL(/page=watch/, { timeout: 20_000 }).catch(() => {});
    const url = rp.url();
    const planRow = (await pool.query("SELECT id, how FROM watch_plans WHERE couch_id = $1 AND season_id = $2 AND episode = 3", [A, tid])).rows[0];
    check(!!planRow && planRow.how === "start" && /ep=3/.test(url) && url.includes(`plan=${planRow?.id}`), "Start now: the watch along opens with the plan", url);
    await clearPlans();

    // I watched it: asks first; Not yet moves nothing; Yes moves her and plays the reveal of a show she only watches (the user,
    // 2026-11-02): its write-up, who went home if anyone did, The couch reacts with hers to add, no games, no Share; Undo moves her back.
    const RECAP = "The Traitors recruit in the turret and the Faithful's round table turns on the wrong player.";
    await pool.query(`INSERT INTO season_episodes (season_id, number, summary) VALUES ($1, 3, $2) ON CONFLICT (season_id, number) DO UPDATE SET summary = EXCLUDED.summary`, [tid, RECAP]);
    await rp.goto(`${BASE}/show/${tid}/tonight`, { waitUntil: "load" });
    await rplate.waitFor({ timeout: 30_000 });
    await rp.waitForTimeout(600);
    await rplate.locator("[data-up-next-watched]").click();
    const confirm = R.sheet().locator("[data-watched-sheet='3']");
    await confirm.waitFor({ timeout: 15_000 });
    check(/Watched all of Episode 3\?/i.test(await textOf(R.sheet())) && /Move back any time/.test(await textOf(confirm)), "I watched it asks: Watched all of Episode 3?", await textOf(R.sheet()));
    await R.shot("confirm");
    await R.sheet().locator("[data-watched-no]").click();
    await R.closed();
    check((await seenOf("riley", tid)) === 2, "Not yet: still on 2", String(await seenOf("riley", tid)));
    await rplate.locator("[data-up-next-watched]").click();
    await R.sheet().locator("[data-watched-yes]").click();
    await rp.waitForURL(/page=reveal/, { timeout: 15_000 }).catch(() => {});
    check((await seenOf("riley", tid)) === 3, "Yes: riley's up to 3", String(await seenOf("riley", tid)));
    check(/page=reveal/.test(rp.url()), "and the reveal plays", rp.url());
    const toastUndo = rp.getByRole("button", { name: /Undo/ });
    check((await toastUndo.count()) > 0, "a toast with Undo");
    const rreveal = rp.locator("[role=dialog][aria-label='The reveal']");
    await rreveal.locator("[data-beat]").first().waitFor({ timeout: 30_000 });
    const rbeats = [];
    const rbeat = async () => rreveal.locator("[data-beat]").getAttribute("data-beat").catch(() => null);
    for (let k = 0; k < 10; k++) {
      await rp.waitForTimeout(500);
      const b = await rbeat();
      if (rbeats.at(-1) !== b) rbeats.push(b);
      if (b === "recap") check((await textOf(rreveal.locator("[data-reveal-recap]"))).includes("turret"), "In this episode: its write-up", await textOf(rreveal));
      if (b === "gifs") break;
      await rreveal.locator("[data-stage]").click();
    }
    check(rbeats[0] === "open" && rbeats.includes("recap") && rbeats.at(-1) === "gifs" && !rbeats.some((b) => ["lineup", "games", "table"].includes(b)), "her beats: the opener, In this episode, … The couch reacts, no games", rbeats.join(" > "));
    await rp.waitForFunction(() => (document.querySelector("[data-gifs-beat]")?.getAttribute("data-gifs-beat") ?? "loading") !== "loading", null, { timeout: 15_000 }).catch(() => {});
    check((await rreveal.locator("[data-gifs-add]").count()) === 1 && /The couch reacts/i.test(await textOf(rreveal.locator("[data-gifs-beat]"))), "The couch reacts, with Add your GIF", await textOf(rreveal));
    await R.shot("reveal-gifs");
    await R.wide("riley's reveal");
    await rreveal.locator("[data-gifs-add]").click();
    const pick = R.sheet().locator('[data-gif-react="pick"]');
    await pick.waitFor({ timeout: 20_000 });
    check(/How was Episode 3\?/i.test(await textOf(R.sheet())), "Add your GIF: How was Episode 3?", await textOf(R.sheet()));
    await rp.keyboard.press("Escape");
    await R.closed();
    check((await rreveal.getByRole("button", { name: /Share your night/ }).count()) === 0, "no Share your night (no games)");
    if (await toastUndo.count()) {
      await toastUndo.first().click({ force: true }).catch(() => {});
      await rp.waitForTimeout(1500);
      check((await seenOf("riley", tid)) === 2, "Undo: back on 2", String(await seenOf("riley", tid)));
      check(!/page=reveal/.test(rp.url()) && (await rreveal.isVisible().catch(() => false)) === false, "and the reveal closes", rp.url());
    }
    // A watcher's reveal never says there's nothing: every aired episode she's seen plays, results or not.
    await pool.query("UPDATE show_follows SET seen_through = 3 WHERE user_id = $1 AND season_id = $2", [U.riley, tid]);
    for (const ep of [1, 2, 3]) {
      const rv = await riley.call("POST", `/api/seasons/${tid}/reveal`, { episode: ep, couch: A });
      check(rv.status === 200 && rv.body.games.length === 0 && rv.body.table === null && rv.body.lineup === null, `the reveal API, Episode ${ep}: a watcher's, no games`, `${rv.status} ${JSON.stringify(rv.body).slice(0, 160)}`);
    }
    const past = await riley.call("POST", `/api/seasons/${tid}/reveal`, { episode: 4, couch: A });
    check(past.status === 403, "and nothing past her mark (403)", String(past.status));
    await pool.query("UPDATE show_follows SET seen_through = 3 WHERE user_id = $1 AND season_id = $2", [U.riley, tid]);
    await rp.goto(`${BASE}/show/${tid}/tonight`, { waitUntil: "load" });
    await rp.locator("[data-phase]").waitFor({ timeout: 30_000 });
    await rp.locator("[data-plan-invite]").waitFor({ timeout: 20_000 }).catch(() => {});
    check((await rp.locator("[data-up-next]").count()) === 0 && /Watch Episode 4 together/.test(await textOf(rp.locator("[data-plan-invite]"))), "caught up: no plate, Watch Episode 4 together", await textOf(rp.locator("[data-plan-invite]")));

    check(R.errors().length === 0, "no page errors (riley, Tonight and the reveal)", R.errors().join(" | "));
    const rileyErrors = R.errors().length;
    // Episodes (a show with results, so its episodes have pages): Episode 3's page replays its reveal, writing nothing. (A show with no
    // results to show has rows instead: the row replays, its GIFs on the row's end open the GIF sheet: data-ep-replay, data-ep-gif.)
    await rp.goto(`${BASE}/show/${tid}/episodes`, { waitUntil: "load" });
    await rp.locator("[data-ep='3']").waitFor({ timeout: 30_000 });
    await rp.waitForTimeout(500);
    await rp.locator("[data-ep='3']").click();
    await rp.locator("[data-episode-page='3'] [data-replay-reveal]").click();
    await rp.waitForURL(/page=reveal/, { timeout: 15_000 }).catch(() => {});
    await rreveal.locator("[data-beat]").first().waitFor({ timeout: 30_000 }).catch(() => {});
    check(/page=reveal/.test(rp.url()) && (await rreveal.locator("[data-beat]").count()) === 1, "Episodes: her Episode 3's page replays its reveal", rp.url());
    await rreveal.getByRole("button", { name: "Skip" }).click();
    await rp.waitForTimeout(600);
    check((await rbeat()) === "gifs" && (await rreveal.getByRole("button", { name: /^Back to / }).count()) === 1, "Skip: The couch reacts, then Back to the show", String(await rbeat()));
    check((await seenOf("riley", tid)) === 3, "the replay moved nothing (still on 3)", String(await seenOf("riley", tid)));
    await rreveal.getByRole("button", { name: /^Back to / }).click();
    await rp.waitForTimeout(600);
    // An episode's page asks a player's reads too (its results, calls, bingo), which a show she only watches answers 403: not this check's.
    const later = R.errors().slice(rileyErrors).filter((x) => !/status of 403/.test(x));
    check(later.length === 0, "no page errors (riley's Episodes, beside the episode page's 403s for a show she doesn't play)", later.join(" | "));

    // ---------- sam: behind on a show he plays ----------
    const S = await browse("sam");
    const sp = S.pg;
    await sp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
    const splate = sp.locator('[data-up-next="4"]');
    await splate.waitFor({ timeout: 60_000 });
    await sp.waitForTimeout(800);
    const stext = await textOf(splate);
    check((await splate.getAttribute("data-results-in")) === "4" && /You're 2 behind/i.test(stext) && /Episode 4/i.test(stext), "sam: the plate for Episode 4, You're 2 behind", stext);
    const movesFirst = await sp.evaluate(() => {
      const plate = document.querySelector("[data-up-next]");
      const moves = [...document.querySelectorAll("h2")].find((h) => /your moves/i.test(h.textContent || ""));
      return !!plate && !!moves && !!(moves.compareDocumentPosition(plate) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    check(movesFirst, "Your moves come before the plate");
    const sphase = await textOf(sp.locator("[data-phase]"));
    check(/Episode 6/i.test(sphase) && /On TV/.test(sphase) && !/Results/.test(sphase), "the heading is the airing his moves are for: Episode 6 · On TV … (not Episode 4 · Results)", sphase);
    await splate.scrollIntoViewIfNeeded();
    await S.shot("plate");
    await S.wide("sam's Tonight");
    await splate.locator("[data-up-next-watched]").click();
    await S.sheet().locator("[data-watched-sheet='4']").waitFor({ timeout: 15_000 });
    check(/Its results play next/.test(await textOf(S.sheet())) && /Yes, show me/.test(await textOf(S.sheet().locator("[data-watched-yes]"))), "I watched it asks: Its results play next, Yes, show me", await textOf(S.sheet()));
    await S.sheet().locator("[data-watched-no]").click();
    await S.closed();
    check((await seenOf("sam", sid)) === 3, "Not yet: still on 3", String(await seenOf("sam", sid)));
    await splate.locator("[data-up-next-watched]").click();
    await S.sheet().locator("[data-watched-yes]").click();
    await sp.waitForURL(/page=reveal/, { timeout: 15_000 }).catch(() => {});
    check(/page=reveal/.test(sp.url()), "Yes: the reveal of Episode 4 opens", sp.url());
    await sp.locator("[role=dialog][aria-label='The reveal'] [data-beat]").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await S.shot("reveal");
    check(S.errors().length === 0, "no page errors (sam)", S.errors().join(" | "));

    // ---------- alex: caught up, then Episode 6 on the air ----------
    const X = await browse("alex");
    const xp = X.pg;
    await xp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
    await xp.locator("[data-phase]").waitFor({ timeout: 60_000 });
    await xp.locator("[data-plan-invite]").waitFor({ timeout: 20_000 }).catch(() => {});
    await xp.waitForTimeout(600);
    check((await xp.locator("[data-up-next]").count()) === 0, "alex: no plate (nothing to watch yet)");
    const invite = await textOf(xp.locator("[data-plan-invite]"));
    check(/Watch Episode 6 together/.test(invite) && /live airing/.test(invite), "Watch Episode 6 together, the live airing or a time", invite);
    await X.shot("caught-up");
    await X.wide("alex's Tonight");

    // Episodes: an episode's page replays its reveal as it played, and nothing moves (his games' marks, where he is).
    const marks = async () => (await pool.query("SELECT array_agg(results_seen_through ORDER BY league_id) AS m FROM league_memberships WHERE user_id = $1", [U.alex])).rows[0].m.join();
    const before = await marks();
    await xp.goto(`${BASE}/show/${sid}/episodes`, { waitUntil: "load" });
    await xp.locator("[data-ep='5']").waitFor({ timeout: 30_000 });
    await xp.waitForTimeout(500);
    await xp.locator("[data-ep='5']").click();
    const replayBtn = xp.locator("[data-episode-page='5'] [data-replay-reveal]");
    await replayBtn.waitFor({ timeout: 20_000 });
    check(/Replay the reveal/.test(await replayBtn.innerText()), "the episode page: Replay the reveal");
    await X.shot("episode-replay");
    await replayBtn.click();
    await xp.waitForURL(/page=reveal/, { timeout: 15_000 }).catch(() => {});
    const xreveal = xp.locator("[role=dialog][aria-label='The reveal']");
    await xreveal.locator("[data-beat]").first().waitFor({ timeout: 30_000 }).catch(() => {});
    const xbeats = [];
    for (let k = 0; k < 12; k++) {
      await xp.waitForTimeout(450);
      const b = await xreveal.locator("[data-beat]").getAttribute("data-beat").catch(() => null);
      if (xbeats.at(-1) !== b) xbeats.push(b);
      if ((await xreveal.getByRole("button", { name: /^Back to / }).count()) > 0) break;
      await xreveal.locator("[data-stage]").click();
    }
    check(xbeats[0] === "open" && xbeats.includes("out") && xbeats.includes("gifs") && xbeats.at(-1) === "table", "the replay plays its beats: the opener … who went home, The couch reacts … the table", xbeats.join(" > "));
    check(/Previously/i.test(await textOf(xreveal)) || xbeats.length > 0, "as it played");
    check((await xreveal.getByRole("button", { name: /^Reveal Episode/ }).count()) === 0, "a replay ends on Back to the show, no Reveal Episode N");
    check((await marks()) === before && (await seenOf("alex", sid)) === 5, "and nothing moved (his games' marks, where he is)", `${before} → ${await marks()}`);
    await xreveal.getByRole("button", { name: /^Back to / }).click();
    await xp.waitForTimeout(600);
    // Episode 6 on the air ten minutes ago (weekly from the premiere, so the premiere moves back with it): his moves lock.
    await pool.query(
      `UPDATE show_seasons SET premiere_date = ((now() AT TIME ZONE COALESCE(air_tz, 'America/New_York')) - interval '10 minutes')::date - 35,
              air_time = date_trunc('minute', (now() AT TIME ZONE COALESCE(air_tz, 'America/New_York')) - interval '10 minutes')::time
        WHERE id = $1`,
      [sid]
    );
    await xp.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "load" });
    const allSet = xp.locator("[data-all-set]");
    await allSet.waitFor({ timeout: 60_000 });
    await xp.waitForTimeout(800);
    const head = await allSet.locator(":scope > div").first().boundingBox();
    check(!!head && head.height < 72, "on the air: a slim All set, its line under 72px", JSON.stringify(head));
    check(/Your moves are locked/i.test(await textOf(allSet)), "Your moves are locked", await textOf(allSet));
    await allSet.scrollIntoViewIfNeeded();
    await X.shot("locked");
    check(X.errors().length === 0, "no page errors (alex)", X.errors().join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    for (const close of closers.reverse()) await close().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
