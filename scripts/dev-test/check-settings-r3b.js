// Settings Round 3b's server half (docs/design-round/settings-r3b-spec.md), through the real routes as the zt_nd couch's people:
//   - The lock's states (BACKLOG 157): before Episode 6 airs, Lineup League's lineups are `auto` (open until it airs) and can be
//     locked early; after it airs (moved to an hour ago), `auto` is open to whoever hasn't watched, and riley (a Helper) can open it
//     to everyone or lock it for everyone. Locked for everyone refuses jordan's late lineup (he hasn't watched): the gap
//     check-episode-lock found in 3a. Each change has a typed Undo that puts the lock back (the server's, not the screen's).
//   - Late moves (pace): alex sets strict, Undo puts live back.
//   - A Prediction Sheet's questions: jordan starts one, takes a question off, Undo puts it back (written with the show's ctx).
//   - Computer players: jordan adds one to a new Survival Pool, Undo takes it out; a level, Undo puts it back; taken out (tier 3),
//     Undo brings the seat back.
//   - Freeze rules and joining: on, then its batch's Undo turns it off.
// Needs: the app (BASE in .env.local; in the settings lane, `node scripts/lane.js dev settings`). Brings new-fixture up and takes it
// down after unless --keep (its down removes the games zt_nd people started, and the season's episode times). zt_nd_ rows only;
// refuses a non-local database. Shares the zt_nd couch: never run beside another check on it.
// Run:   node scripts/dev-test/check-settings-r3b.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-settings-r3b runs against a local database only");
const keep = process.argv.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
const brief = (x) => JSON.stringify(x)?.slice(0, 220);

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const S = fx.seasonId, L = fx.leagues;
    const q = `?couch=${fx.couchId}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const state = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const settingsOf = async (who, id) => (await as[who].call("GET", `/api/seasons/${S}/backstage/settings${q}`)).body.games?.find((g) => g.leagueId === id);
    const patch = (who, body) => as[who].call("PATCH", `/api/seasons/${S}/backstage/settings${q}`, body);
    const undo = (who, batch) => as[who].call("POST", `/api/seasons/${S}/changes/${batch}/undo${q}`);
    const at = (n, ms) =>
      pool.query(
        `INSERT INTO season_episodes (season_id, number, air_at) VALUES ($1, $2, $3) ON CONFLICT (season_id, number) DO UPDATE SET air_at = EXCLUDED.air_at`,
        [S, n, new Date(Date.now() + ms)]
      );

    // ---------- the lock, before Episode 6 airs ----------
    await at(6, 2 * 24 * 3600_000);
    await at(7, 9 * 24 * 3600_000);
    let g = await settingsOf("riley", L.lineup);

    // ---------- 166: a runner sets a move someone forgot (Pool Party: nobody's picked Episode 6 yet) ----------
    const miss = (await settingsOf("alex", L.pool))?.missing;
    const forgot = miss?.people?.find((p) => p.userId === fx.users.jordan) ?? miss?.people?.[0];
    if (!forgot) check(false, "Pool Party lists who hasn't picked for Episode 6", brief(miss));
    else {
      check(miss.kind === "pick" && miss.episode === 6 && forgot.options.length > 0, `Manage lists ${forgot.name} without a pick, with who they may pick`, brief(forgot));
      const pickFor = (who) => as[who].call("PUT", `/api/leagues/${L.pool}/episodes/${miss.epId}/picks`, { playerId: forgot.playerId, castawayId: forgot.options[0].id });
      check((await pickFor("riley")).status === 403, "riley, who doesn't run Pool Party, can't make it for them");
      const r0 = await pickFor("alex");
      const left = (await settingsOf("alex", L.pool))?.missing;
      check(r0.status === 200 && !(left?.people ?? []).some((p) => p.playerId === forgot.playerId), `alex makes ${forgot.name}'s pick, and they're off the list`, `${r0.status} ${brief(r0.body)}`);
      const said = (await as.alex.call("GET", `/api/seasons/${S}/changes${q}`)).body.lines?.some((l) => new RegExp(`Made ${forgot.name}'s pick`).test(l.text));
      check(!!said, "Recent changes says it was made for them", brief((await as.alex.call("GET", `/api/seasons/${S}/changes${q}`)).body.lines?.slice(0, 3)));
    }

    check(g?.lock?.episode === 6 && g.lock.state === "auto" && !g.lock.aired && !g.lock.closed, "before it airs: Episode 6's lineups are the game's rule, open", brief(g?.lock));
    let r = await patch("riley", { leagueId: L.lineup, lock: "locked" });
    g = await settingsOf("riley", L.lineup);
    check(r.status === 200 && r.body.batch && g.lock.state === "locked" && g.lock.closed, "riley locks them early", brief({ r: r.body, lock: g.lock }));
    r = await undo("riley", r.body.batch);
    g = await settingsOf("riley", L.lineup);
    check(r.status === 200 && g.lock.state === "auto" && !g.lock.closed, "Undo opens them again (the server's undo)", brief({ r: r.body, lock: g.lock }));
    r = await patch("riley", { leagueId: L.lineup, lock: "open" });
    g = await settingsOf("riley", L.lineup);
    check(r.status === 200 && g.lock.state === "auto", "open before airtime is just the game's rule", brief(g.lock));

    // ---------- after it airs ----------
    await at(6, -3600_000);
    g = await settingsOf("riley", L.lineup);
    check(g.lock.aired && g.lock.state === "auto" && g.lock.late === true, "an hour after it airs: the game's rule, late moves on", brief(g.lock));
    r = await patch("riley", { leagueId: L.lineup, lock: "open" });
    g = await settingsOf("riley", L.lineup);
    check(r.status === 200 && g.lock.state === "open" && !g.lock.closed, "riley opens them to everyone", brief(g.lock));
    const openBatch = r.body.batch;
    r = await patch("riley", { leagueId: L.lineup, lock: "locked" });
    g = await settingsOf("riley", L.lineup);
    check(r.status === 200 && g.lock.state === "locked" && g.lock.closed, "then locks them for everyone", brief(g.lock));
    const lockedBatch = r.body.batch;
    // jordan hasn't watched Episode 6 (he's through 5): his late lineup is refused while it's locked for everyone.
    let s = await state(L.lineup);
    const ep6 = s.episodes.find((e) => e.number === 6);
    const jordanSeat = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [L.lineup, fx.users.jordan])).rows[0].player_id;
    const roster = s.castaways.filter((c) => (c.ownerIds ?? []).includes(jordanSeat) && c.status === "active").map((c) => c.id);
    const starters = (s.spec?.count?.start ?? s.settings?.activeSlots ?? 3);
    r = await as.jordan.call("PUT", `/api/leagues/${L.lineup}/episodes/${ep6.id}/lineups/${jordanSeat}`, { castawayIds: roster.slice(0, starters) });
    check(r.status >= 400, "locked for everyone: jordan, who hasn't watched, can't set a late lineup", `${r.status} ${brief(r.body)}`);
    check((await undo("riley", openBatch)).status === 409, "the earlier change can't be undone once a later one moved the lock");
    r = await undo("riley", lockedBatch);
    g = await settingsOf("riley", L.lineup);
    check(r.status === 200 && g.lock.state === "open", "Undo puts it back to open to everyone", brief(g.lock));
    const line = (await as.alex.call("GET", `/api/seasons/${S}/changes${q}`)).body.lines?.find((l) => /Locked Episode 6's lineups for everyone/.test(l.text));
    check(!!line, "Recent changes names it: locked for everyone", brief((await as.alex.call("GET", `/api/seasons/${S}/changes${q}`)).body.lines?.slice(0, 3)));
    await patch("riley", { leagueId: L.lineup, lock: "auto" });

    // ---------- late moves (pace) ----------
    r = await patch("alex", { leagueId: L.lineup, pace: "strict" });
    s = await state(L.lineup);
    check(r.status === 200 && r.body.batch && s.settings.lockAtAir === true, "alex: no late moves (strict)", brief(r.body));
    r = await undo("alex", r.body.batch);
    s = await state(L.lineup);
    check(r.status === 200 && !s.settings.lockAtAir, "Undo: late moves on the honour system again", brief(r.body));
    check((await patch("riley", { leagueId: L.lineup, pace: "strict" })).status === 403, "riley, a Helper, can't change late moves");

    // ---------- a Prediction Sheet's questions ----------
    await at(6, 2 * 24 * 3600_000);
    r = await as.jordan.call("POST", `/api/seasons/${S}/start${q}`, { game: "questions", tell: false });
    const sheet = r.body.leagueId;
    g = sheet && (await settingsOf("jordan", sheet));
    const on = (g?.questions?.list ?? []).filter((x) => x.on).map((x) => x.id);
    if (!g?.questions?.editable || on.length < 2) check(false, "a new Prediction Sheet has questions to change", brief({ start: r.body, q: g?.questions }));
    else {
      r = await patch("jordan", { leagueId: sheet, questions: on.slice(1) });
      g = await settingsOf("jordan", sheet);
      check(r.status === 200 && r.body.batch && g.questions.list.filter((x) => x.on).length === on.length - 1, "jordan takes a question off", brief(r.body));
      r = await undo("jordan", r.body.batch);
      g = await settingsOf("jordan", sheet);
      check(r.status === 200 && g.questions.list.filter((x) => x.on).map((x) => x.id).join() === on.join(), "Undo puts it back", brief(r.body));
    }

    // ---------- computer players ----------
    r = await as.jordan.call("POST", `/api/seasons/${S}/start${q}`, { game: "survivalPool", tell: false });
    const pool2 = r.body.leagueId;
    const bots = (b) => as.jordan.call("POST", `/api/seasons/${S}/backstage/computer${q}`, { leagueId: pool2, ...b });
    const botsIn = async () => (await state(pool2)).players.filter((p) => p.automated);
    r = await bots({ action: "add", level: "normal" });
    check(r.status === 200 && r.body.batch && (await botsIn()).length === 1, "jordan adds a computer player", brief(r.body));
    r = await undo("jordan", r.body.batch);
    check(r.status === 200 && (await botsIn()).length === 0, "Undo takes it out again", brief(r.body));
    await bots({ action: "add", level: "normal" });
    const bot = (await botsIn())[0];
    r = await bots({ action: "level", playerId: bot.id, level: "sharp" });
    check(r.status === 200 && (await botsIn())[0].botLevel === "sharp", "its level: Sharp");
    r = await undo("jordan", r.body.batch);
    check(r.status === 200 && (await botsIn())[0].botLevel === bot.botLevel, "Undo: its level as it was", brief(r.body));
    r = await bots({ action: "remove", playerId: bot.id });
    check(r.status === 200 && (await botsIn()).length === 0, "taken out (held on the screen)");
    const outLine = (await pool.query("SELECT tier, undo_until FROM league_changes WHERE batch = $1", [r.body.batch])).rows[0];
    check(outLine?.tier === 3 && outLine.undo_until && new Date(outLine.undo_until).getTime() > Date.now() + 20 * 24 * 3600_000, "its line is tier 3, undoable for 30 days", brief(outLine));
    r = await undo("jordan", r.body.batch);
    const back = await botsIn();
    check(r.status === 200 && back.length === 1 && back[0].id === bot.id, "Undo brings the same seat back", brief(r.body));

    // ---------- A15: How long until a phase starts ----------
    g = await settingsOf("alex", L.lineup);
    const endAt = g?.span?.endPhases?.[0];
    if (!endAt) check(false, "Lineup League can end at a phase still to come", brief(g?.span));
    else {
      r = await patch("alex", { leagueId: L.lineup, set: { endPhase: endAt.id } });
      g = await settingsOf("alex", L.lineup);
      check(r.status === 200 && g.span.endPhase?.id === endAt.id, `alex: it ends when ${endAt.name} starts`, brief({ r: r.body, span: g.span }));
      r = await undo("alex", r.body.batch);
      g = await settingsOf("alex", L.lineup);
      check(r.status === 200 && !g.span.endPhase && g.span.to === null, "Undo: to the season's end again", brief(g.span));
      check((await patch("alex", { leagueId: L.lineup, set: { endPhase: "nope" } })).status === 400, "a phase that isn't one: 400");
    }

    // ---------- A15: waiver timing ----------
    const wv = (await as.alex.call("GET", `/api/seasons/${S}/backstage/waivers${q}`)).body.games?.find((x) => x.settings);
    if (!wv) check(false, "a game here runs waivers", "");
    else {
      const hours = wv.settings.processHours === 12 ? 6 : 12;
      r = await as.alex.call("POST", `/api/seasons/${S}/backstage/waivers${q}`, { leagueId: wv.leagueId, action: "set", set: { waiverProcessHours: hours, replenishOrderBy: "mostPoints", freeAgencyEnabled: false } });
      const after = (await as.alex.call("GET", `/api/seasons/${S}/backstage/waivers${q}`)).body.games.find((x) => x.leagueId === wv.leagueId).settings;
      check(r.status === 200 && after.processHours === hours && after.orderBy === "mostPoints" && after.freeAgency === false, `waiver timing: claims close ${hours} h before, most points first, no free agency`, brief({ r: r.body, after }));
      r = await undo("alex", r.body.batch);
      const back = (await as.alex.call("GET", `/api/seasons/${S}/backstage/waivers${q}`)).body.games.find((x) => x.leagueId === wv.leagueId).settings;
      check(r.status === 200 && back.processHours === wv.settings.processHours && back.orderBy === wv.settings.orderBy && back.freeAgency === wv.settings.freeAgency, "Undo: the timing as it was", brief(back));
    }

    // ---------- 165: an empty slot fills from the bench ----------
    await at(6, 2 * 24 * 3600_000);
    g = await settingsOf("alex", L.lineup);
    check(g?.lineup?.fill === null, "Lineup League, made before 3b: an empty slot stays empty", brief(g?.lineup));
    r = await patch("alex", { leagueId: L.lineup, set: { benchFill: true } });
    g = await settingsOf("alex", L.lineup);
    check(r.status === 200 && g.lineup.fill === 6, "alex turns it on: from Episode 6, the next still open", brief({ r: r.body, l: g.lineup }));
    r = await undo("alex", r.body.batch);
    g = await settingsOf("alex", L.lineup);
    check(r.status === 200 && g.lineup.fill === null, "Undo: off again", brief(g.lineup));
    check((await patch("alex", { leagueId: L.pool, set: { benchFill: true } })).status === 409, "a game with no lineups has no bench: 409");

    // ---------- A17: when the show adds a moment mid-season ----------
    // Lineup League on its season's rulebook (the local season isn't), then "Individual immunity win" recorded as gained now, the way
    // a rulebook sync records it (db/rulebooks.js recordAddedMoments, on the real database: the next episode to air, a vote's close).
    await at(6, 2 * 24 * 3600_000);
    const R = require("../../db/rulebooks.js");
    await R.syncLeagueRow(pool, L.lineup, { on: true });
    let st = await state(L.lineup);
    const ids = R.momentIdsOf(st.settings.rulebook) ?? [];
    const MOMENT = "individualImmunity";
    if (!st.settings.rulebook || !ids.includes(MOMENT)) check(false, "Lineup League plays by its season's rulebook, with individual immunity", brief(ids.slice(0, 5)));
    else {
      r = await patch("alex", { leagueId: L.lineup, set: { newMoments: "vote" } });
      check(r.status === 200 && r.body.batch, "alex: new moments go to the players' vote", brief(r.body));
      st = await state(L.lineup);
      const got = await R.recordAddedMoments(pool, S, st.settings, ids.filter((x) => x !== MOMENT));
      await pool.query("UPDATE leagues SET state = jsonb_set(state, '{settings,momentsFrom}', $2::jsonb) WHERE id = $1", [L.lineup, JSON.stringify(st.settings.momentsFrom)]);
      const rec = st.settings.momentsFrom?.[MOMENT];
      check(got.join() === MOMENT && rec?.from === 6 && rec.rule === "vote" && !!rec.closes, "recorded: counts from Episode 6 for now, the vote closing when it airs", brief(rec));
      g = await settingsOf("alex", L.lineup);
      const a = g?.moments?.added?.find((x) => x.id === MOMENT);
      check(g?.moments?.rule === "vote" && a && a.tally?.of === 4 && a.tally.start === 0, "Manage this game lists it: 0 of 4 voted", brief(g?.moments));
      const votes = async (who) => (await as[who].call("GET", `/api/seasons/${S}/moment-votes${q}`)).body.votes ?? [];
      let v = (await votes("jordan")).find((x) => x.id === MOMENT);
      check(!!v && v.mine === null && v.from === 6 && v.earlier.length > 0 && v.earlier.every((x) => x.episode < 6), "jordan sees the vote, with what counting it from the start would add (episodes he's seen)", brief(v));
      const cast = (who, vote) => as[who].call("POST", `/api/seasons/${S}/moment-votes${q}`, { leagueId: L.lineup, id: MOMENT, vote });
      r = await cast("jordan", "start");
      v = r.body.votes?.find((x) => x.id === MOMENT);
      check(r.status === 200 && v?.mine === "start" && v.voted === 1, "jordan votes from the start: 1 of 4, still open", brief(r.body));
      check(!(await state(L.lineup)).settings.momentsFrom[MOMENT].settled, "one vote of four decides nothing");
      await cast("alex", "start");
      r = await cast("riley", "start");
      st = await state(L.lineup);
      const settled = st.settings.momentsFrom[MOMENT].settled;
      check(settled?.to === "start" && settled.by === "vote" && settled.start === 3, "three of four: decided, from the start", brief(settled));
      check(!(r.body.votes ?? []).some((x) => x.id === MOMENT), "the vote leaves everyone's strip");
      const sam = await api({ user: fixture.username("sam"), pass: fixture.PASSWORD });
      check((await sam.call("POST", `/api/seasons/${S}/moment-votes${q}`, { leagueId: L.lineup, id: MOMENT, vote: "next" })).status === 409, "a vote after it's decided: 409");
      const lines = (await as.alex.call("GET", `/api/seasons/${S}/changes${q}`)).body.lines ?? [];
      check(lines.some((l) => /voted 3–0 to count ".+" from the start/.test(l.text)), "Recent changes says how the players voted", brief(lines.slice(0, 3)));
      // The Commissioner's own call, with Undo.
      await pool.query("UPDATE leagues SET state = jsonb_set(state, '{settings,momentsFrom,individualImmunity}', (state->'settings'->'momentsFrom'->'individualImmunity') - 'settled') WHERE id = $1", [L.lineup]);
      check((await patch("riley", { leagueId: L.lineup, moment: { id: MOMENT, to: "start" } })).status === 403, "riley, a Helper, can't make the call");
      r = await patch("alex", { leagueId: L.lineup, moment: { id: MOMENT, to: "next" } });
      st = await state(L.lineup);
      check(r.status === 200 && st.settings.momentsFrom[MOMENT].settled?.by === "runner" && st.settings.momentsFrom[MOMENT].settled.to === "next", "alex calls it: from Episode 6", brief(r.body));
      r = await undo("alex", r.body.batch);
      st = await state(L.lineup);
      check(r.status === 200 && !st.settings.momentsFrom[MOMENT].settled, "Undo: open again", brief(r.body));
    }

    // ---------- Freeze rules and joining ----------
    r = await patch("alex", { lockDown: true });
    s = await state(L.lineup);
    check(r.status === 200 && r.body.batch && s.settings.lockedDown === true, "alex freezes rules and joining", brief(r.body));
    r = await undo("alex", r.body.batch);
    s = await state(L.lineup);
    check(r.status === 200 && !s.settings.lockedDown, "Undo (its batch) unfreezes them", brief(r.body));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
