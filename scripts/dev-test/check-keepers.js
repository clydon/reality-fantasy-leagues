// Dev-only check of keepers across seasons (docs/PLAN-start-a-game-gpt.md step A10 part 4: game-spec schema.js get.keep,
// settings.js draftKeep; state-logic.js KeeperLogic and every kind of draft filling the places its keepers leave; the server's
// keepers.ts, which works each seat's options out from the two leagues and writes them in on every write until the draft starts;
// the route /api/leagues/[id]/keepers) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (alex, riley, jordan, sam; Couch Cup, an Outlast on ZT Survivor 51 with results through Episode 5, is
// last season's game here). It adds zt rows of its own: ZT Survivor 52 (upcoming), its cast approved (four of Couch Cup's
// castaways back, one of them as the new season's cast records him with a nickname, and ten newcomers), and two games on it that
// keep from Couch Cup:
//   - ZT Keepers, an exclusive snake Outlast of three, keeping up to two: each seat's options (only its own team there who are back,
//     best first: the one who lasted longest), refusals (someone not yours, more than two, someone else's seat), riley naming hers
//     (who named it recorded), sam's returnee leaving the cast before the draft (dropped from his options and his keepers: the
//     place goes to the draft), alex naming nobody (the fallback keeps his best two); alex's Start locking them (riley can't change
//     hers after); the snake passing over a full team (alex picks once, riley twice), nobody picking someone kept; every team three;
//     Couch Cup untouched.
//   - ZT Keepers Blind, a shared blind Weekly Lineup of three, keeping one: riley names nobody (her best kept); her sheet of three
//     refused (two beside her keeper), two accepted; jordan's sheet with alex's keeper on it accepted (shared); the reveal; every
//     team three, each keeper on it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-keepers.js [--keep]
//
// One fixed scenario on purpose, run again whenever keepers change. Brings new-fixture.js up and takes it down (--keep leaves it;
// its down takes ZT Survivor 52 and both games with the show and the zt-nd- slugs); touches zt rows only; refuses a non-local
// database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how
// many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-keepers runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const WHO = ["alex", "riley", "jordan", "sam"];
const NEW = ["Zed Newcomer", "Quinn Fresh", "Pat Rookie", "Lee Debut", "Max Novice", "Ray Firsttimer", "Kit Greenhorn", "Bo Starter", "Jo Beginner", "Cy Recruit"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);
const teamOf = (st, pid) => st.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const names = (st, ids) => ids.map((id) => S.getCastaway(st, id)?.name);

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const one = async (sql, args) => (await pool.query(sql, args)).rows[0];

    // ---------- last season: Couch Cup, as it stands ----------
    const CUP = fx.leagues.outlast;
    const cup = await league(CUP);
    const cupText = JSON.stringify(cup);
    const cupSeat = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [CUP])).rows) {
      const who = WHO.find((k) => fx.users[k] === user_id);
      if (who) cupSeat[who] = player_id;
    }
    const number = new Map(cup.episodes.map((e) => [e.id, e.number]));
    const lasted = (c) => (c.status === "active" ? Infinity : number.get(c.exitEpisodeId) || 0);
    // Each seat's team there, longest lasting first (Couch Cup scores by place).
    const cupTeam = (who) => cup.castaways.filter((c) => (c.ownerIds || []).includes(cupSeat[who])).sort((a, b) => lasted(b) - lasted(a));
    const alexBack = [cupTeam("alex")[0], cupTeam("alex").find((c) => lasted(c) < lasted(cupTeam("alex")[0]))].filter(Boolean);
    const rileyBack = cupTeam("riley")[0];
    const samBack = cupTeam("sam")[0];
    check(alexBack.length === 2 && !!rileyBack && !!samBack, "Couch Cup: alex's, riley's and sam's teams there (alex's two who come back lasted differently)", JSON.stringify(alexBack.map((c) => c.name)));
    // The new season's cast records alex's best with a nickname, as a cast list might.
    const [first, last] = [alexBack[0].name.split(" ")[0], alexBack[0].name.split(" ").slice(1).join(" ")];
    const nick = `${first} "Ace" ${last}`;

    // ---------- this season: ZT Survivor 52, its cast approved ----------
    const show = (await one("SELECT id FROM shows WHERE slug = 'zt-nd-survivor'")).id;
    const season = (await one(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_minutes, episode_count)
       VALUES ($1, 52, 'ZT Survivor 52', 'upcoming', current_date + 60, '20:00', 'America/New_York', 90, 13) RETURNING id`,
      [show]
    )).id;
    const castNames = [nick, alexBack[1].name, rileyBack.name, samBack.name, ...NEW];
    const rows = [];
    for (const [i, name] of castNames.entries()) {
      rows.push({ ...(await one("INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id", [season, name, i % 2 ? "Vati" : "Toka", i])), name, tribeName: i % 2 ? "Vati" : "Toka", photoUrl: null });
    }
    await pool.query("UPDATE show_seasons SET cast_approved_at = now() WHERE id = $1", [season]);
    check(rows.length === 14, "ZT Survivor 52: 14 on its cast (four back from Couch Cup, one as \"" + nick + "\", ten new), approved");

    /** A game on ZT Survivor 52 for the four of them (alex runs it), playing `spec`. */
    const make = async (slug, name, spec) => {
      const st = S.defaultState();
      Object.assign(st.settings, { showId: "zt-nd-survivor", wikiSeason: 52, showFormat: cup.settings.showFormat, setupComplete: true });
      S.applySeasonCast(st, rows, { withTribes: true });
      for (const who of WHO) S.addPlayer(st, who);
      S.ensureNextEpisode(st);
      const problems = S.setGame(st, spec);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const id = (await one(
        "INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [name, slug, slug.replace(/[^a-z0-9]/g, "").slice(-6).toUpperCase().padEnd(6, "K"), JSON.stringify(st), fx.users.alex, fx.couchId]
      )).id;
      const seat = {};
      for (const [j, who] of WHO.entries()) {
        seat[who] = st.players[j].id;
        await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, $4)", [id, fx.users[who], seat[who], who === "alex" ? "commissioner" : "member"]);
      }
      return { id, seat, problems };
    };
    const idOf = (st, name) => st.castaways.find((c) => S.KeeperLogic.nameKey(c.name) === S.KeeperLogic.nameKey(name))?.id;

    // ---------- ZT Keepers: an exclusive snake Outlast of three, keeping up to two ----------
    const K = await make("zt-nd-keep52", "ZT Keepers", { preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive", keep: { each: 2, from: CUP } } });
    let st = await league(K.id);
    check(!K.problems.length && G.sameValue(st.settings.draftKeep, { each: 2, from: CUP, fallback: "best", cost: "place" }) && S.KeeperLogic.config(st)?.each === 2, "ZT Keepers made: an Outlast of three keeping up to two from Couch Cup (its defaults filled in)", JSON.stringify(K.problems));
    let r = await as.alex.call("GET", `/api/leagues/${K.id}/keepers`);
    check(!(await league(K.id)).keepers, "  a read works the options out without writing them");
    const alexOpts = (r.body.options || []).map((o) => o.name);
    check(r.status === 200 && r.body.each === 2 && r.body.locked === false && r.body.chosen === null && G.sameValue(alexOpts, [nick, alexBack[1].name]), `  alex's options: his two who are back, best first (the one who lasted longest, "${nick}" on this cast)`, JSON.stringify(r.body));
    const opts = {};
    for (const who of ["riley", "jordan", "sam"]) opts[who] = ((await as[who].call("GET", `/api/leagues/${K.id}/keepers`)).body.options || []).map((o) => o.name);
    check(G.sameValue(opts, { riley: [rileyBack.name], jordan: [], sam: [samBack.name] }), "  riley's and sam's one each, jordan's none (nobody of his is back)", JSON.stringify(opts));
    r = await as.riley.call("PUT", `/api/leagues/${K.id}/keepers`, { castawayIds: [idOf(st, alexBack[1].name)] });
    check(r.status === 400 && /isn't one of yours from last season/.test(errorOf(r)), "  riley can't keep one of alex's (400, saying why)", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("PUT", `/api/leagues/${K.id}/keepers`, { castawayIds: [idOf(st, rileyBack.name), idOf(st, NEW[0]), idOf(st, NEW[1])] });
    check(r.status === 400 && /Keep up to 2/.test(errorOf(r)), "  nor three (400)", `${r.status} ${errorOf(r)}`);
    r = await as.jordan.call("PUT", `/api/leagues/${K.id}/keepers`, { playerId: K.seat.riley, castawayIds: [] });
    check(r.status === 403, "  jordan can't name riley's (403)", `${r.status}`);
    r = await as.riley.call("PUT", `/api/leagues/${K.id}/keepers?quiet`, { castawayIds: [idOf(st, rileyBack.name)] });
    st = await league(K.id);
    check(r.status === 200 && G.sameValue(S.KeeperLogic.chosen(st, K.seat.riley), [idOf(st, rileyBack.name)]) && st.keepers.chosen[K.seat.riley].by === fx.users.riley, "  riley names hers: kept in the game, who named it recorded", `${r.status} ${errorOf(r)}`);
    check(G.sameValue(Object.keys(st.keepers?.options ?? {}).sort(), [K.seat.alex, K.seat.riley, K.seat.sam].sort()), "  her write stored everyone's options in the game (keepers.ts), for the three with someone back", JSON.stringify(st.keepers));
    r = await as.sam.call("PUT", `/api/leagues/${K.id}/keepers?quiet`, { castawayIds: [idOf(st, samBack.name)] });
    check(r.status === 200, "  sam names his", `${r.status} ${errorOf(r)}`);
    // sam's returnee leaves the new season's cast before the draft (as a removed cast row is taken out of a game: nothing refers to him yet).
    st = await league(K.id);
    const gone = idOf(st, samBack.name);
    st.castaways = st.castaways.filter((c) => c.id !== gone);
    await write(K.id, st);
    await pool.query("DELETE FROM season_cast WHERE season_id = $1 AND name = $2", [season, samBack.name]);
    rows.splice(rows.findIndex((x) => x.name === samBack.name), 1);
    r = await as.jordan.call("PUT", `/api/leagues/${K.id}/keepers?quiet`, { castawayIds: [] });
    st = await league(K.id);
    const samNow = (await as.sam.call("GET", `/api/leagues/${K.id}/keepers`)).body;
    check(r.status === 200 && G.sameValue(S.KeeperLogic.named(st, K.seat.sam), []) && !S.KeeperLogic.options(st, K.seat.sam).length && G.sameValue(samNow.chosen, []) && !samNow.options.length && G.sameValue(S.KeeperLogic.chosen(st, K.seat.jordan), []), "  sam's returnee leaves the cast: the next write drops him from sam's options, and nothing he named can be kept (the place goes to the draft)", JSON.stringify(st.keepers));
    r = await as.alex.call("POST", `/api/leagues/${K.id}/draft/force-start`, {});
    st = await league(K.id);
    const kept = Object.fromEntries(WHO.map((w) => [w, names(st, S.KeeperLogic.keptIds(st, K.seat[w]))]));
    check(r.status === 200 && S.KeeperLogic.locked(st) && G.sameValue(kept, { alex: [nick, alexBack[1].name], riley: [rileyBack.name], jordan: [], sam: [] }), "  alex's Start locks them: alex named nobody, so he keeps his best two; riley hers; sam and jordan nobody", JSON.stringify(kept));
    check(S.KeeperLogic.keptIds(st, K.seat.alex).every((id) => S.getCastaway(st, id).acquiredVia === "keeper" && G.sameValue(S.getCastaway(st, id).ownerIds, [K.seat.alex])), "  each keeper alex's own, a keeper, not a pick");
    r = await as.riley.call("PUT", `/api/leagues/${K.id}/keepers`, { castawayIds: [] });
    check(r.status === 400 && /locked/.test(errorOf(r)), "  riley can't change hers now (400)", `${r.status} ${errorOf(r)}`);
    const keptList = (await as.sam.call("GET", `/api/leagues/${K.id}/keepers`)).body.kept || [];
    check(keptList.length === 2 && keptList.some((k) => k.name === "alex" && k.castaways.length === 2), "  the GET says everyone's keepers once they're locked", JSON.stringify(keptList));
    // The snake: alex has one place left, riley two, jordan and sam three each.
    const by = Object.fromEntries(WHO.map((w) => [K.seat[w], w]));
    const turns = [];
    r = await as.riley.call("POST", `/api/leagues/${K.id}/draft/pick`, { castawayId: S.KeeperLogic.keptIds(st, K.seat.alex)[0] });
    st = await league(K.id);
    check(!st.draftPicksMade && S.getCastaway(st, S.KeeperLogic.keptIds(st, K.seat.alex)[0]).ownerIds.length === 1, "  nobody can draft someone alex kept", `${r.status} ${errorOf(r)}`);
    for (let i = 0; i < 12; i++) {
      st = await league(K.id);
      const t = S.currentDraftTurn(st);
      if (!t || t.isComplete) break;
      const who = by[t.playerId];
      turns.push(who);
      r = await as[who].call("POST", `/api/leagues/${K.id}/draft/pick?quiet`, { castawayId: S.draftFitsFor(st, t.playerId)[0] });
      if (r.status !== 200) break;
    }
    st = await league(K.id);
    const sizes = WHO.map((w) => teamOf(st, K.seat[w]).length);
    check(G.sameValue(turns, ["alex", "riley", "jordan", "sam", "sam", "jordan", "riley", "jordan", "sam"]), "  the snake passes over a full team: alex picks once, riley twice, jordan and sam three times", JSON.stringify(turns));
    check(G.sameValue(sizes, [3, 3, 3, 3]) && st.draftLog.length === 9 && !st.draftLog.some((e) => S.getCastaway(st, e.castawayId).acquiredVia === "keeper") && S.currentDraftTurn(st).isComplete, "  every team three; the draft's log the nine picks alone", JSON.stringify(sizes));
    check(JSON.stringify(await league(CUP)) === cupText, "  Couch Cup, last season's game, untouched");

    // ---------- ZT Keepers Blind: a shared blind Weekly Lineup of three, keeping one ----------
    const B = await make("zt-nd-keep52b", "ZT Keepers Blind", { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "blind", own: "shared", keep: { each: 1, from: CUP } }, count: { start: 2 } });
    r = await as.alex.call("PUT", `/api/leagues/${B.id}/keepers?quiet`, { castawayIds: [idOf(await league(B.id), alexBack[1].name)] });
    check(!B.problems.length && r.status === 200, "ZT Keepers Blind made: a shared blind Weekly Lineup keeping one; alex names his second best", `${JSON.stringify(B.problems)} ${r.status} ${errorOf(r)}`);
    r = await as.alex.call("POST", `/api/leagues/${B.id}/draft/force-start`, {});
    st = await league(B.id);
    const keptB = Object.fromEntries(WHO.map((w) => [w, names(st, S.KeeperLogic.keptIds(st, B.seat[w]))]));
    check(r.status === 200 && G.sameValue(keptB, { alex: [alexBack[1].name], riley: [rileyBack.name], jordan: [], sam: [] }), "  the Start locks them: alex his, riley (named nobody) her best", JSON.stringify(keptB));
    const free = st.castaways.filter((c) => c.status === "active" && !(c.ownerIds || []).length).map((c) => c.id);
    const alexKeeper = S.KeeperLogic.keptIds(st, B.seat.alex)[0];
    r = await as.riley.call("POST", `/api/leagues/${B.id}/draft/blind/lock`, { playerId: B.seat.riley, castawayIds: free.slice(0, 3) });
    check(r.status === 400 && /Pick exactly 2 castaways beside your keeper/.test(errorOf(r)), "  riley's sheet of three refused: two beside her keeper (400)", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("POST", `/api/leagues/${B.id}/draft/blind/lock`, { playerId: B.seat.riley, castawayIds: free.slice(0, 2) });
    check(r.status === 200, "  her two locked in", `${r.status} ${errorOf(r)}`);
    r = await as.jordan.call("POST", `/api/leagues/${B.id}/draft/blind/lock`, { playerId: B.seat.jordan, castawayIds: [alexKeeper, ...free.slice(0, 2)] });
    check(r.status === 200, "  jordan's three, alex's keeper among them, locked in (shared: two can have the same one)", `${r.status} ${errorOf(r)}`);
    r = await as.sam.call("POST", `/api/leagues/${B.id}/draft/blind/lock`, { playerId: B.seat.sam, castawayIds: free.slice(2, 5) });
    r = await as.alex.call("POST", `/api/leagues/${B.id}/draft/blind/lock`, { playerId: B.seat.alex, castawayIds: free.slice(3, 5) });
    st = await league(B.id);
    const teamsB = Object.fromEntries(WHO.map((w) => [w, teamOf(st, B.seat[w])]));
    check(r.status === 200 && S.BlindDraftLogic.isRevealed(st) && Object.values(teamsB).every((t) => t.length === 3) && teamsB.alex.includes(alexKeeper) && teamsB.jordan.includes(alexKeeper), "  the last sheet reveals it: every team three, alex's keeper on his and on jordan's", JSON.stringify(Object.values(teamsB).map((t) => t.length)));
  } catch (e) {
    failures++;
    console.log("FAIL  threw:", e && e.stack ? e.stack : e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log("down failed:", e.message));
    await pool.end();
    console.log(failures ? `${failures} FAILED` : "ALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
