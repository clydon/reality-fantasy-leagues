// Dev-only: a league's page (docs/PLAN-sports-couch.md B1; the design: docs/design-round/league-page-spec.md), every situation of
// its This week tab, for a design round's screenshot story and for the check. On new-fixture.js's zt_nd couch and a stand-in ESPN
// (fake-espn.js, by the x-gys-sports header: the real ESPN is never asked), check-sports-couch.js's ZT leagues with two more
// football teams and a season of finals behind this week (weeks 1 to 11), so records, form and the couch's rivalries are real
// reads of the stand-in's schedules. The couch: alex the Eagles, Riley the Jets, Sam the Cowboys, Jordan the Giants.
//   gameday      Week 12, Sunday: the Eagles on now at the Jets (alex vs Riley, 14-10), Cowboys at Giants later today (alex's
//                Pick'em on it, a pick due), Bears at Lions tonight: the hub's card (gameday-card), its tap: the page (gameday,
//                gameday.full), the Scores tab (gameday-scores), the Games tab (gameday-games), a team row's tap (gameday-team)
//   midweek      the same season, this week's games later in the week: the rivalry before kickoff with Start a game on it
//                (midweek), its tap (midweek-start)
//   hidden       gameday with Hide sports scores on: no numbers, Show records (hidden), and after it's tapped (hidden-shown)
//   lone         alex alone follows a football team: one row, no rivalry (lone)
//   none         nobody follows a football team; alex follows the league: the empty table (none)
//   solo         the solo hub's person (solo-fixture.js's zt_so_alex) following the Eagles and the Lions: Your teams (solo)
//   daily        basketball: the Sixers (alex) and the Knicks (Riley), a game today and tonight (daily)
//   off          baseball in its off-season, alex following the Yankees (off)
//   studio       gameday in the light theme (studio)
// Scores (B1 session 2; docs/design-round/league-scores-spec.md), in the same worlds: gameday-scores (Week 12 opened from the tab:
// a live game, a Thursday final, the couch's games first, a fuller Sunday of stand-in teams), gameday-scores-last (Week 11's chip:
// all finals), gameday-scores-next (Week 13: all to come, "This week" back), hidden-scores (Started and the eye, Show scores),
// hidden-scores-ask (a row's eye: the ask sheet), hidden-scores-confirm (Show scores asks first), hidden-scores-shown (shown), daily-scores (today's game day) and
// daily-scores-yesterday, none-scores (no couch group), solo-scores, off-scores, studio-scores. --only=scores shoots just these
// (each world's Scores frames, without its This week ones); a world's name shoots both.
// Games (B1 session 3; docs/design-round/league-games-spec.md): gameday-games (a pick due, Riley's Pick'em on Bears at Lions to join,
// the couch's rivals to come, your team), gameday-games-join (its Join), gameday-games-rival (a rival's Start), midweek-games (nothing
// due: Play this week's games is the plate), none-games (a spectator), daily-games, off-games, studio-games, solo-games and solo-week
// (no start offered on no couch). --only=games shoots just these.
// Standings (B1 session 4; docs/design-round/league-standings-spec.md): the stand-in's table counted from its own finals, in two
// conferences of two divisions: gameday-standings (Division, the couch's division first), gameday-standings-conf (Conference, by
// seed), gameday-standings-open (alex's row opened: its splits), gameday-standings-team (Open the Eagles: the team's sheet),
// recording-standings (a game watched as if live: held, Show anyway), hidden-standings and hidden-standings-shown (Hide sports
// scores), none-standings (a spectator: the league's order), daily-standings (basketball opens on Conference), solo-standings,
// studio-standings, failed-standings (the stand-in down). And real ESPN tables (public league data, the round's "judge on a real
// game"), with alex, Riley, Sam and Jordan following real teams for the shoot (unfollowed after): real-nfl, real-nfl-conf, real-nba,
// real-nhl, real-mlb (its season over: final, clinched and out), real-epl (one table, its places key). --only=standings shoots just
// these; --only=real only the real ones.
// Chat (B1 session 5; docs/design-round/league-chat-spec.md): the room seeded through its real routes by the couch (the room's talk,
// and talk in the game on now's thread): gameday-chat (All, the threads row, the About chip), gameday-chat-thread (the game on now's
// thread), gameday-chat-badge (This week with the Chat tab's unread count), hidden-chat (Hide sports scores: the thread's talk since
// kickoff folded) and hidden-chat-shown (Show the score), none-chat (nobody has said anything), studio-chat, solo-chat (no couch).
// --only=chat shoots just these. Each world's room is cleared after (its zt- league's rows).
// BACKLOG 254's leftovers (--only=extras): extras-week (This week's room line), extras-scores (a row's link into its thread),
// extras-join (the join sheet's words on a one-game Pick'em, named Pick'em), extras-ask (the ask sheet, a line per choice) and
// extras-hidden-week (hiding scores: the room line passes over a thread's talk since kickoff).
// Each frame: a .jpg at --width × --height, the page's words in a .txt, and words that sit on other words as OVERLAP lines (kept in
// overlaps.json). Prints the first view's groups in order, the rivalry's and the table's words, and the page's width.
//
// Needs: the app (BASE, default :3000) and the zt_nd couch up (census-app.js --up, or new-fixture.js up; --up brings it up first).
// Removes every row it made after (check-sports-couch.js cleanup; the solo fixture taken down), unless --keep. One check at a time
// on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-league-page.js --out=.ui-atlas/stories/league-page/after
//          [--only=gameday,hidden | --only=scores] [--width=390 --height=844] [--up] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const soloFx = require("./solo-fixture");
const world = require("./check-sports-couch");
const { overlapsIn } = require("./overlaps");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-league-page runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const OUT = path.resolve(opt("out", ".ui-atlas/stories/league-page/after"));
// --only=scores or --only=games: that tab's frames in every world and nothing else.
const TAB = ["scores", "games", "standings", "real", "chat", "extras"].includes(opt("only", "")) ? opt("only") : null;
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") && !TAB ? opt("only").split(",") : null;
const { FB, BB, MB } = world;
const { now, at, today, HR, D, TEAMS, footballFor, eventsFor, pickemGame, COUCH, STANDINGS, REAL, realId, E, C, G, J, B, L, BUF, KC, BAL, SF, GB, LAR, CIN, PIT } = require("./league-story-world");

async function setting(pool, user, col, v) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query(`UPDATE user_settings SET ${col} = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)`, [user, v]);
}

const OVERLAPS = [];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const calendars = world.calendarsAround();
  const eastDay = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  calendars[BB].days = Array.from({ length: 76 }, (_, i) => eastDay(now - 35 * D + i * D));
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars, standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const alex = fixture.username("alex");
  let soloUp = false;
  try {
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const call = (who, o = {}) => signIn({ user: o.user ?? fixture.username(who), pass: o.pass ?? fixture.PASSWORD, headers });

    const setWorld = async (name, follows, o = {}) => {
      await world.cleanup(pool);
      for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
      espn.events.length = 0;
      espn.events.push(...eventsFor(name));
      for (const [who, league, team] of follows) await (await call(who, o)).call("POST", "/api/sports/follow", team ? { league, team, follow: true } : { league, follow: true });
    };
    const pickem = async (eventId, who = "alex", team = C) => {
      const me = await call(who);
      const p = await me.call("POST", `/api/sports/start?couch=${couch}`, { league: FB, team, games: [eventId], game: "pickem", tell: false });
      if (p.status !== 200) console.log(`[league] Pick'em not started (${p.status} ${JSON.stringify(p.body).slice(0, 200)})`);
      return p.body;
    };

    const shoot = async (name, go, o = {}) => {
      const b = await open({ user: o.user ?? alex, pass: o.pass ?? fixture.PASSWORD, width: W, height: H, headers: o.real ? {} : headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + (o.path ?? `/league/${o.league ?? FB}/week`), { waitUntil: "domcontentloaded" });
        await b.page.locator(o.wait ?? "[data-this-week], [data-hub], [data-league-scores], [data-scores-off]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(3500);
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (o.full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate((h) => {
          const fold = h - 66;
          const groups = [
            ["move", "[data-league-move]"],
            ["rivalry", "[data-rivalry]"],
            ["table", "[data-couch-table]"],
            ["season rivalries", "[data-season-rivalries]"],
            ["your games", "[data-league-games]"],
            ["rest", "[data-league-rest]"],
            ["switcher", "[data-scores-switcher]"],
            ["show scores", "[data-show-scores]"],
            ["couch's games", "[data-scores-couch]"],
            ["first day", "[data-scores-day]"],
          ]
            .map(([k, sel]) => [k, document.querySelector(sel)?.getBoundingClientRect()])
            .filter(([, r]) => r && r.height)
            .map(([k, r]) => `${k} ${Math.round(r.top)}-${Math.round(r.bottom)}${r.top < fold ? "" : " (below the fold)"}`);
          const rows = [...document.querySelectorAll("[data-couch-team], [data-league-scores] [data-bug]")].map((x) => {
            const r = x.getBoundingClientRect();
            return `${Math.round(r.top) < fold ? "" : "below: "}${x.getAttribute("aria-label")}`;
          });
          return {
            wide: document.documentElement.scrollWidth,
            yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20).length,
            groups,
            rivalry: document.querySelector("[data-rivalry]")?.getAttribute("aria-label") ?? null,
            rows,
          };
        }, H);
        console.log(`PASS ${name}  page ${info.wide} px wide, ${info.yellow} yellow`);
        if (!o.sheet) {
          console.log(`      first view: ${info.groups.join(" · ")}`);
          if (info.rivalry) console.log(`      rivalry: ${info.rivalry}`);
          for (const r of info.rows) console.log(`      row: ${r}`);
        }
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        return null;
      } finally {
        await b.close();
      }
    };
    const run = (n) => !!TAB || !ONLY || ONLY.includes(n);
    const tw = !TAB;
    const sc = !TAB || TAB === "scores";
    const gm = !TAB || TAB === "games";
    const gamesAt = (league = FB) => ({ path: `/league/${league}/games`, wait: "[data-league-games-tab]" });
    const st = !TAB || TAB === "standings";
    const ch = !TAB || TAB === "chat";
    const chatAt = (league = FB) => ({ path: `/league/${league}/chat`, wait: "[data-league-chat], [data-league-chat-solo], [data-league-chat-loading]" });
    const settleChat = async (pg) => {
      await pg.locator("[data-league-chat], [data-league-chat-solo]").first().waitFor({ timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(1800);
    };
    // The room's talk, posted by the couch through the real route: two in the room, three in the game on now's thread (after its
    // kickoff), one of them alex's own; then a reaction.
    const seedRoom = async (name) => {
      const live = eventsFor(name).find((e) => e.state === "in" && e.home === J);
      const thread = live ? { event: live.id, eventAt: live.at, eventName: "Eagles at Jets" } : {};
      const say = async (who, text, inThread) => {
        const me = await call(who);
        const r = await me.call("POST", `/api/sports/league/chat?league=${encodeURIComponent(FB)}&couch=${couch}`, { text, ...(inThread ? thread : {}) });
        if (r.status !== 200) console.log(`[chat] not posted (${r.status} ${JSON.stringify(r.body).slice(0, 160)})`);
        return r.body.message;
      };
      await say("jordan", "Giants at home today. Cowboys fans, I'm sorry in advance.");
      await say("sam", "Bold talk from a 5-3-1 team");
      const m = await say("riley", "That catch on third down was unreal", true);
      await say("sam", "Refs are asleep", true);
      await say("alex", "Fly Eagles fly", true);
      if (m) await (await call("jordan")).call("POST", `/api/sports/league/chat/${m.id}/react?league=${encodeURIComponent(FB)}&couch=${couch}`, { emoji: "🔥" });
    };
    const clearRoom = () => pool.query("DELETE FROM chat_messages WHERE sports_league = $1", [FB]).then(() => pool.query("DELETE FROM league_chat_reads WHERE league = $1", [FB]));
    const standingsAt = (league = FB) => ({ path: `/league/${league}/standings`, wait: "[data-standings], [data-standings-failed], [data-standings-none]" });
    const settleStandings = async (pg) => {
      await pg.locator("[data-standing-row], [data-standings-hidden], [data-standings-failed], [data-standings-none]").first().waitFor({ timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(1200);
    };
    const view = (v) => async (pg) => {
      await settleStandings(pg);
      await pg.locator(`[data-standings-view] [data-view="${v}"]`).click();
      await pg.waitForTimeout(900);
    };
    const openRow = (team) => async (pg) => {
      await settleStandings(pg);
      await pg.locator(`[data-standing-row="${team}"]`).first().click();
      await pg.waitForTimeout(700);
    };
    const settleGames = async (pg) => {
      await pg.waitForTimeout(3000);
    };
    const scoresAt = (league = FB) => ({ path: `/league/${league}/scores`, wait: "[data-league-scores], [data-scores-off]" });
    const settle = async (pg) => {
      await pg.locator("[data-scores-list] [data-bug], [data-scores-empty], [data-scores-off]").first().waitFor({ timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(1500);
    };
    const chip = (offset) => async (pg) => {
      // The chip `offset` from now's (-1 the week or day before).
      const all = pg.locator("[data-step]");
      const i = await all.evaluateAll((els) => els.findIndex((e) => e.hasAttribute("data-now")));
      await all.nth(i + offset).click();
      await settle(pg);
    };

    if (run("gameday")) {
      await setWorld("gameday", COUCH);
      await pickem(pickemGame("gameday"));
      await pickem(eventsFor("gameday").find((e) => e.id.endsWith("52")).id, "riley", L);
      if (sc) {
        await shoot("gameday-scores", settle, { ...scoresAt(), full: true });
        await shoot("gameday-scores-last", chip(-1), scoresAt());
        await shoot("gameday-scores-next", chip(1), scoresAt());
      }
      if (gm) {
        await shoot("gameday-games", settleGames, { ...gamesAt(), full: true });
        await shoot("gameday-games-join", async (pg) => {
          await settleGames(pg);
          await pg.locator("[data-games-join] [data-join-row] button").first().click();
          await pg.waitForTimeout(1500);
        }, { ...gamesAt(), sheet: true });
        await shoot("gameday-games-rival", async (pg) => {
          await settleGames(pg);
          await pg.locator("[data-games-rival-start]").first().click();
          await pg.waitForTimeout(2500);
        }, { ...gamesAt(), sheet: true });
      }
    }
    if (run("gameday") && TAB === "extras") {
      await clearRoom();
      await seedRoom("gameday");
      await shoot("extras-week", async (pg) => {
        await pg.locator("[data-room-line]").waitFor({ timeout: 20000 }).catch(() => {});
        await pg.locator("[data-room-line]").scrollIntoViewIfNeeded().catch(() => {});
        await pg.waitForTimeout(800);
      }, { wait: "[data-this-week]" });
      await shoot("extras-scores", settle, { ...scoresAt(), full: true });
      await shoot("extras-join", async (pg) => {
        await settleGames(pg);
        await pg.locator("[data-games-join] [data-join-row] button").first().click();
        await pg.locator("[data-join-simple], [data-join-confirm]").first().waitFor({ timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
      }, { ...gamesAt(), sheet: true });
      await shoot("extras-games", settleGames, gamesAt());
      await clearRoom();
    }
    if (run("gameday") && ch && TAB === "chat") {
      await clearRoom();
      await seedRoom("gameday");
      await shoot("gameday-chat", settleChat, chatAt());
      await shoot("gameday-chat-thread", async (pg) => {
        await settleChat(pg);
        await pg.locator('[data-threads] [data-thread]:not([data-thread="all"])').first().click();
        await pg.waitForTimeout(1200);
      }, chatAt());
      // Something new since alex last read the room: the tab's count.
      await (await call("riley")).call("POST", `/api/sports/league/chat?league=${encodeURIComponent(FB)}&couch=${couch}`, { text: "Who's watching the late game?" });
      await shoot("gameday-chat-badge", async (pg) => {
        await pg.locator("[data-room-badge]").waitFor({ timeout: 35000 }).catch(() => {});
        await pg.waitForTimeout(600);
      }, { wait: "[data-this-week]" });
      await clearRoom();
    }
    if (run("gameday") && st && TAB !== "real" && TAB !== "chat") {
      await shoot("gameday-standings", settleStandings, { ...standingsAt(), full: true });
      await shoot("gameday-standings-conf", view("parent"), { ...standingsAt(), full: true });
      await shoot("gameday-standings-open", openRow(E), standingsAt());
      await shoot("gameday-standings-team", async (pg) => {
        await openRow(E)(pg);
        await pg.locator(`[data-standings-team="${E}"]`).click();
        await pg.locator("[data-team-page]").waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
      }, { ...standingsAt(), sheet: true });
      // Watching the Eagles at the Jets as if live: the table would give it away.
      const live = eventsFor("gameday").find((e) => e.state === "in" && e.home === J);
      const me = await call("alex");
      await me.call("POST", "/api/sports/recordings", { game: live.id, league: FB, on: true });
      await shoot("recording-standings", settleStandings, standingsAt());
      await me.call("POST", "/api/sports/recordings", { game: live.id, league: FB, on: false });
      espn.down = true;
      await pool.query("DELETE FROM sports_cache WHERE key LIKE '%standings%zt-%'");
      await shoot("failed-standings", settleStandings, standingsAt());
      espn.down = false;
    }
    if (run("gameday") && tw) {
      await shoot(
        "gameday-card",
        async (pg) => {
          const s = pg.locator("[data-your-shows]").first();
          if (await s.count()) await s.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 64)));
          await pg.waitForTimeout(600);
        },
        { path: "/home", wait: "[data-hub]", sheet: true }
      );
      await shoot(
        "gameday",
        async (pg) => {
          await pg.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
          await pg.locator(`[data-league-card="${FB}"]`).first().waitFor({ timeout: 30000 });
          await pg.locator(`[data-league-card="${FB}"]`).first().click();
          await pg.locator("[data-this-week] [data-couch-team]").first().waitFor({ timeout: 20000 });
          await pg.waitForTimeout(1500);
        },
        { full: true, wait: "[data-hub]", path: "/home" }
      );
      await shoot("gameday-scores-tab", async (pg) => {
        await pg.locator('nav[aria-label="League"] a[href$="/scores"]').click();
        await settle(pg);
      }, { sheet: true });
      await shoot("gameday-games-tab", async (pg) => {
        await pg.locator('nav[aria-label="League"] a[href$="/games"]').click();
        await pg.locator("[data-league-games-tab]").waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1500);
      }, { sheet: true });
      await shoot("gameday-team", async (pg) => {
        await pg.locator(`[data-couch-team="${C}"]`).click();
        await pg.locator("[data-team-page]").waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
      }, { sheet: true });
    }
    if (run("midweek")) {
      await setWorld("midweek", COUCH);
      if (tw) {
        await shoot("midweek", null, { full: true });
        await shoot("midweek-start", async (pg) => {
          await pg.locator("[data-rivalry-start]").click();
          await pg.waitForTimeout(2500);
        }, { sheet: true });
      }
      if (gm) await shoot("midweek-games", settleGames, { ...gamesAt(), full: true });
    }
    if (run("hidden")) {
      await setWorld("hidden", COUCH);
      await pickem(pickemGame("hidden"));
      await setting(pool, alex, "hide_sports_scores", true);
      if (TAB === "extras") {
        await clearRoom();
        await seedRoom("hidden");
        await shoot("extras-hidden-week", async (pg) => {
          await pg.locator("[data-room-line]").waitFor({ timeout: 20000 }).catch(() => {});
          await pg.locator("[data-room-line]").scrollIntoViewIfNeeded().catch(() => {});
          await pg.waitForTimeout(800);
        }, { wait: "[data-this-week]" });
        await shoot("extras-ask", async (pg) => {
          await settle(pg);
          await pg.locator('[data-league-scores] [data-bucket="started"]').first().click();
          await pg.locator("[data-score-ask]").waitFor({ timeout: 10000 });
          await pg.waitForTimeout(900);
        }, { ...scoresAt(), sheet: true });
        await clearRoom();
      }
      if (tw) {
        await shoot("hidden", null, { full: true });
        await shoot("hidden-shown", async (pg) => {
          await pg.locator("[data-show-records]").click();
          await pg.waitForTimeout(1500);
        });
      }
      if (ch && TAB === "chat") {
        await clearRoom();
        await seedRoom("hidden");
        await shoot("hidden-chat", settleChat, chatAt());
        await shoot("hidden-chat-shown", async (pg) => {
          await settleChat(pg);
          await pg.locator("[data-room-fold-show]").first().click();
          await pg.waitForTimeout(1500);
        }, chatAt());
        await clearRoom();
      }
      if (st && TAB !== "real" && TAB !== "chat") {
        await shoot("hidden-standings", settleStandings, standingsAt());
        await shoot("hidden-standings-shown", async (pg) => {
          await settleStandings(pg);
          await pg.locator("[data-show-standings]").click();
          await pg.waitForTimeout(1200);
        }, standingsAt());
      }
      if (sc) {
      await shoot("hidden-scores", settle, scoresAt());
      await shoot("hidden-scores-ask", async (pg) => {
        await settle(pg);
        await pg.locator('[data-league-scores] [data-bucket="started"]').first().click();
        await pg.locator("[data-score-ask]").waitFor({ timeout: 10000 });
        await pg.waitForTimeout(900);
      }, { ...scoresAt(), sheet: true });
      await shoot("hidden-scores-confirm", async (pg) => {
        await settle(pg);
        await pg.locator("[data-show-scores]").click();
        await pg.locator("[data-show-scores-ask]").waitFor({ timeout: 10000 });
        await pg.waitForTimeout(900);
      }, { ...scoresAt(), sheet: true });
      await shoot("hidden-scores-shown", async (pg) => {
        await settle(pg);
        await pg.locator("[data-show-scores]").click();
        await pg.locator("[data-show-scores-yes]").click();
        await pg.waitForTimeout(1500);
      }, scoresAt());
      }
      await setting(pool, alex, "hide_sports_scores", false);
    }
    if (run("lone")) {
      await setWorld("lone", [["alex", FB, E]]);
      if (tw) await shoot("lone");
    }
    if (run("none")) {
      await setWorld("none", [["alex", FB, null]]);
      if (tw) await shoot("none");
      if (sc) await shoot("none-scores", settle, scoresAt());
      if (gm) await shoot("none-games", settleGames, gamesAt());
      if (st && TAB !== "real" && TAB !== "chat") await shoot("none-standings", settleStandings, { ...standingsAt(), full: true });
      if (ch && TAB === "chat") {
        await clearRoom();
        await shoot("none-chat", settleChat, chatAt());
      }
    }
    if (run("daily")) {
      await setWorld("daily", [["alex", BB, "9401"], ["riley", BB, "9402"]]);
      if (tw) await shoot("daily", null, { league: BB });
      if (sc) {
        await shoot("daily-scores", settle, scoresAt(BB));
        await shoot("daily-scores-yesterday", chip(-1), scoresAt(BB));
      }
      if (gm) await shoot("daily-games", settleGames, gamesAt(BB));
      if (st && TAB !== "real") await shoot("daily-standings", settleStandings, standingsAt(BB));
    }
    if (run("off")) {
      await setWorld("off", [["alex", MB, "9501"]]);
      if (tw) await shoot("off", null, { league: MB });
      if (sc) await shoot("off-scores", null, scoresAt(MB));
      if (gm) await shoot("off-games", settleGames, gamesAt(MB));
    }
    if (run("studio")) {
      await setWorld("studio", COUCH);
      await pickem(pickemGame("studio"));
      await setting(pool, alex, "theme", "studio");
      if (tw) await shoot("studio", null, { full: true });
      if (sc) await shoot("studio-scores", settle, scoresAt());
      if (gm) await shoot("studio-games", settleGames, gamesAt());
      if (st && TAB !== "real" && TAB !== "chat") await shoot("studio-standings", settleStandings, standingsAt());
      if (ch && TAB === "chat") {
        await clearRoom();
        await seedRoom("studio");
        await shoot("studio-chat", settleChat, chatAt());
        await clearRoom();
      }
      await setting(pool, alex, "theme", "night");
    }
    if (run("solo")) {
      await setWorld("solo", []);
      await soloFx.up(pool);
      soloUp = true;
      const so = soloFx.username("alex");
      const soMe = await signIn({ user: so, pass: soloFx.PASSWORD, headers });
      for (const team of [E, L]) await soMe.call("POST", "/api/sports/follow", { league: FB, team, follow: true });
      if (tw) await shoot("solo", null, { user: so, pass: soloFx.PASSWORD });
      if (sc) await shoot("solo-scores", settle, { ...scoresAt(), user: so, pass: soloFx.PASSWORD });
      if (gm) {
        await shoot("solo-games", settleGames, { ...gamesAt(), user: so, pass: soloFx.PASSWORD });
        await shoot("solo-week", null, { user: so, pass: soloFx.PASSWORD, full: true });
      }
      if (st && TAB !== "real" && TAB !== "chat") await shoot("solo-standings", settleStandings, { ...standingsAt(), user: so, pass: soloFx.PASSWORD });
      if (ch && TAB === "chat") await shoot("solo-chat", settleChat, { ...chatAt(), user: so, pass: soloFx.PASSWORD });
    }
    // Real ESPN tables (asked by the dev server itself: no stand-in header), the couch following real teams for the shoot.
    if (TAB !== "chat" && (TAB === "real" || TAB === "standings" || (!TAB && (!ONLY || ONLY.includes("real"))))) {
      await setWorld("real", []);
      const real = (who) => signIn({ user: fixture.username(who), pass: fixture.PASSWORD, headers: {} });
      try {
        for (const [league, file, fans] of REAL) {
          for (const [who, abbr] of fans) await (await real(who)).call("POST", "/api/sports/follow", { league, team: realId(file, abbr), follow: true });
          const name = `real-${file === "eng.1" ? "epl" : file}`;
          await shoot(name, settleStandings, { ...standingsAt(league), real: true, full: true });
          if (file === "nfl") {
            await shoot(`${name}-conf`, view("parent"), { ...standingsAt(league), real: true, full: true });
            await shoot(`${name}-open`, openRow(realId(file, "PHI")), { ...standingsAt(league), real: true });
          }
        }
      } finally {
        for (const [league, file, fans] of REAL)
          for (const [who, abbr] of fans) {
            const me = await real(who);
            await me.call("POST", "/api/sports/follow", { league, team: realId(file, abbr), follow: false }).catch(() => {});
            await me.call("POST", "/api/sports/follow", { league, follow: false }).catch(() => {});
          }
      }
    }
  } finally {
    if (soloUp) await soloFx.down(pool).catch((e) => console.log(`solo fixture not taken down: ${e.message}`));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 1));
    await setting(pool, alex, "hide_sports_scores", false).catch(() => {});
    await setting(pool, alex, "theme", "night").catch(() => {});
    await espn.close();
    await appPool.end?.().catch(() => {});
    if (!has("keep")) await world.cleanup(pool);
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
