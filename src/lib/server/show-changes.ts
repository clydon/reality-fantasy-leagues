import { after } from "next/server";
import { applyOps, blocksAt, diffBlocks, opLines, type RulebookOp } from "@/lib/game/formats/rulebook-patch";
import { buildRulebookPrompt, parseRulebookAnswer, reviewRulebook } from "@/lib/game/formats/rulebook-research";
import { blocksProblems } from "@/lib/game/formats/rulebook-schema";
import { ensureSeasonRulebook, inForceEdits, saveChain } from "@db/rulebooks.js";
import { askBot } from "./ask-bot";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { confirmAt, restageSeason } from "./community-results";
import { pool, HttpError } from "./db";
import { logDesk } from "./desk";
import { pushRulebook } from "./desk-rulebooks";
import { seenThrough } from "./guard";
import { couchGames } from "./league-changes";
import { reachCopies } from "./ours";

// Something the rulebook doesn't have (docs/PLAN-new-design.md step 6c part 2; rulebooks phase 5, community-confirmed;
// the mock's rulebook.js rbNewCard). When an answer for an episode says the show changed how it's played (research's
// `rulesNote`, db/episode-research.js), the episode's page asks the Commissioners on a couch who have seen it: It's new, or
// Not new. Rules are a Commissioner's (roles.ts: a Game admin does results and waivers, not rules), so a player or a Game
// admin never sees the card (the user, 2026-10-29: players would vote for what helps their team).
// Voices are counted by couch (a couch's newest answer; a couch whose own research said so counts as saying it's new, and
// so does our bot's research, as one voice of its own):
//
//   Confirmed needs of them saying it's new (the desk's number, 2 by default), more than say it isn't: our bot works out
//   what to add (the rulebook prompt with the season's rulebook and the note, rulebook-research.js `change`), and only
//   what it adds goes in, as The show changed from that episode (a 'community' edit), for every couch following the
//   rulebook; a couch's own copy is asked first (ours.ts reachCopies). Undo is the desk's (History).
//   More saying it isn't: put away.
//   A split, a locked rulebook, or anything the bot can't add: the desk's Inbox, where the admin decides.
//
// Nothing here changes a league until the season's leagues play by its rulebook (or a couch has its own copy): the edit
// is the rulebook's, as the desk's own The show changed is.

export type ShowChangeStatus = "open" | "checking" | "added" | "not_new" | "desk";

export interface ShowChange {
  episode: number;
  /** What research said, as it said it. */
  note: string;
  status: ShowChangeStatus;
  /** Couches (and our bot's research) saying it's new, and saying it isn't; how many saying so add it. */
  yes: number;
  no: number;
  need: number;
  /** Your own answer, if you gave one. */
  yours: boolean | null;
  /** This couch's own research said so (it counts as the couch saying it's new until someone here answers). */
  reportedHere: boolean;
  /** What was added (once it's in the rulebook). */
  added: { summary: string; from: number } | null;
  /** Why it's at the desk. */
  line: string | null;
}

// What a confirmed change may add: an item of its own. Anything else the bot's answer changes is left out.
const ADDABLE = new Set(["twists", "waysOut", "segments", "customMoments"]);
// A check still marked running after this long was cut off (the route's 300 s, a redeploy).
const CHECK_STALE_MS = 10 * 60 * 1000;

interface NoteRow {
  id: string;
  couch_id: string | null;
  note: string;
  researched_at: Date;
}

interface NoticeRow {
  id: string;
  note: string;
  status: ShowChangeStatus;
  line: string | null;
  edit_id: string | null;
  run_id: string | null;
  run_started: Date | null;
  run_finished: Date | null;
}

/** Every answer for the episode that says the show changed how it's played, oldest first. */
async function notesFor(seasonId: string, episode: number): Promise<NoteRow[]> {
  const { rows } = await pool.query<NoteRow>(
    `SELECT er.id, er.couch_id, er.payload->>'rulesNote' AS note, er.researched_at
       FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
      WHERE ss.id = $1 AND er.episode_number = $2 AND er.source <> 'combined' AND er.withdrawn_at IS NULL
        AND coalesce(er.payload->>'rulesNote', '') <> ''
      ORDER BY er.researched_at`,
    [seasonId, episode]
  );
  return rows;
}

async function noticeRow(seasonId: string, episode: number): Promise<NoticeRow | null> {
  const { rows } = await pool.query<NoticeRow>(
    `SELECT n.id, n.note, n.status, n.line, n.edit_id, n.run_id, r.started_at AS run_started, r.finished_at AS run_finished
       FROM rulebook_notices n LEFT JOIN bot_research_runs r ON r.id = n.run_id
      WHERE n.season_id = $1 AND n.episode_number = $2`,
    [seasonId, episode]
  );
  return rows[0] ?? null;
}

/** The couches' voices: each couch's newest answer, else its own research saying so; our bot's research is one more. */
async function voices(noticeId: string | null, notes: NoteRow[]): Promise<{ yes: number; no: number; byCouch: Map<string, boolean> }> {
  const byCouch = new Map<string, boolean>();
  for (const n of notes) byCouch.set(n.couch_id ?? "bot", true);
  if (noticeId) {
    const { rows } = await pool.query<{ couch_id: string | null; user_id: string; is_new: boolean }>(
      "SELECT couch_id, user_id, is_new FROM rulebook_notice_votes WHERE notice_id = $1 ORDER BY created_at",
      [noticeId]
    );
    for (const v of rows) byCouch.set(v.couch_id ?? `user:${v.user_id}`, v.is_new);
  }
  const all = [...byCouch.values()];
  return { yes: all.filter(Boolean).length, no: all.filter((v) => !v).length, byCouch };
}

/**
 * Who's asked: a Commissioner of a game on this couch's season (or a site admin) who has seen the episode. `rules`: they're
 * a Commissioner here; `seen`: they've seen it. Someone not on the couch's games is refused.
 */
async function scope(user: SessionUser, seasonId: string, couchId: string | null, episode: number): Promise<{ rules: boolean; seen: boolean }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode required");
  const { here, runs } = await couchGames(user, seasonId, couchId);
  if (!here.some((g) => g.yourRole || runs.has(g.leagueId)) && !isSuperAdminUser(user)) throw new HttpError(403, "This is for whoever plays here");
  const rules = isSuperAdminUser(user) || here.some((g) => g.yourRole === "commissioner");
  return { rules, seen: (await seenThrough(user.id, seasonId)) >= episode };
}

async function read(user: SessionUser, seasonId: string, couchId: string, episode: number): Promise<ShowChange | null> {
  const notes = await notesFor(seasonId, episode);
  let notice = await noticeRow(seasonId, episode);
  if (!notes.length && !notice) return null;
  // A check that never finished (cut off): the desk's.
  if (notice?.status === "checking" && notice.run_started && !notice.run_finished && Date.now() - notice.run_started.getTime() > CHECK_STALE_MS) {
    await settle(notice.id, "desk", "Our bot didn't finish working out what to add");
    notice = await noticeRow(seasonId, episode);
  }
  if (notice?.status === "not_new") return null;
  if (!notice) {
    // The desk already changed the rulebook from this episode: nothing left to ask. (A read: the season's rulebook is
    // looked up, never made.)
    const { rows: book } = await pool.query("SELECT rulebook_id FROM show_seasons WHERE id = $1", [seasonId]);
    if (book[0]?.rulebook_id && (await inForceEdits(pool, book[0].rulebook_id)).some((e) => e.fromEpisode === episode)) return null;
  }
  const v = await voices(notice?.id ?? null, notes);
  const { rows: mine } = notice ? await pool.query("SELECT is_new FROM rulebook_notice_votes WHERE notice_id = $1 AND user_id = $2", [notice.id, user.id]) : { rows: [] };
  let added: ShowChange["added"] = null;
  if (notice?.status === "added" && notice.edit_id) {
    const { rows } = await pool.query("SELECT summary, from_episode FROM rulebook_edits WHERE id = $1 AND status = 'in_force'", [notice.edit_id]);
    // Withdrawn on the desk since: there's nothing added any more, and nothing more to ask.
    if (!rows.length) return null;
    added = { summary: rows[0].summary ?? "", from: rows[0].from_episode };
  }
  return {
    episode,
    note: notice?.note ?? notes[0].note,
    status: notice?.status ?? "open",
    yes: v.yes,
    no: v.no,
    need: await confirmAt(),
    yours: mine[0] ? mine[0].is_new : null,
    reportedHere: notes.some((n) => n.couch_id === couchId),
    added,
    line: notice?.line ?? null,
  };
}

/** "Something the rulebook doesn't have" for an episode's page: null when there's nothing, you haven't seen it, or the
 *  rules aren't yours (only a Commissioner is asked). */
export async function showChange(user: SessionUser, seasonId: string, couchId: string | null, episode: number): Promise<ShowChange | null> {
  const s = await scope(user, seasonId, couchId, episode);
  if (!s.rules || !s.seen) return null;
  return read(user, seasonId, couchId!, episode);
}

async function settle(noticeId: string, status: ShowChangeStatus, line: string | null, editId: string | null = null): Promise<void> {
  await pool.query("UPDATE rulebook_notices SET status = $2, line = $3, edit_id = COALESCE($4, edit_id), settled_at = now() WHERE id = $1", [noticeId, status, line, editId]);
}

/**
 * It's new, or Not new, from a Commissioner on a couch who has seen the episode. Their couch's voice is its newest answer; once
 * enough couches say it's new (and more than say it isn't), our bot works out what to add, after the response.
 */
export async function answerShowChange(user: SessionUser, seasonId: string, couchId: string | null, episode: number, body: { isNew?: unknown }, bot?: string): Promise<ShowChange | null> {
  if (typeof body.isNew !== "boolean") throw new HttpError(400, "isNew is true or false");
  const s = await scope(user, seasonId, couchId, episode);
  if (!s.rules) throw new HttpError(403, "The rulebook is a Commissioner's call");
  if (!s.seen) throw new HttpError(403, `Reveal Episode ${episode} first`);
  const notes = await notesFor(seasonId, episode);
  if (!notes.length) throw new HttpError(404, "Nothing new was reported for this episode");
  await pool.query("INSERT INTO rulebook_notices (season_id, episode_number, note) VALUES ($1, $2, $3) ON CONFLICT (season_id, episode_number) DO NOTHING", [seasonId, episode, notes[0].note]);
  const notice = (await noticeRow(seasonId, episode))!;
  if (notice.status !== "open") return read(user, seasonId, couchId!, episode);
  await pool.query(
    `INSERT INTO rulebook_notice_votes (notice_id, user_id, couch_id, is_new) VALUES ($1, $2, $3, $4)
     ON CONFLICT (notice_id, user_id) DO UPDATE SET is_new = EXCLUDED.is_new, couch_id = EXCLUDED.couch_id, created_at = now()`,
    [notice.id, user.id, couchId, body.isNew]
  );
  const v = await voices(notice.id, notes);
  const need = await confirmAt();
  if (v.yes >= need && v.yes > v.no) {
    const why = await blocked(seasonId, episode);
    if (why) await settle(notice.id, "desk", why);
    else {
      // One check per notice, whoever's answer confirmed it.
      const { rowCount } = await pool.query("UPDATE rulebook_notices SET status = 'checking' WHERE id = $1 AND status = 'open'", [notice.id]);
      if (rowCount) {
        const { rows } = await pool.query("INSERT INTO bot_research_runs (season_id, episode_number, slot, kind, couch_id, asked_by) VALUES ($1, $2, 'notice', 'rulebook', $3, $4) RETURNING id", [
          seasonId,
          episode,
          couchId,
          user.id,
        ]);
        await pool.query("UPDATE rulebook_notices SET run_id = $2 WHERE id = $1", [notice.id, rows[0].id]);
        after(() => checkAndAdd(notice.id, rows[0].id, seasonId, episode, notice.note, user.id, bot));
      }
    }
  } else if (v.no > v.yes) await settle(notice.id, "not_new", null);
  return read(user, seasonId, couchId!, episode);
}

/** Why a confirmed change goes to the desk instead of in on its own: the rulebook's locked, or it can't start there. */
async function blocked(seasonId: string, episode: number): Promise<string | null> {
  const book = await ensureSeasonRulebook(pool, seasonId);
  if (!book) return "The season has no rulebook";
  const { rows } = await pool.query("SELECT locked_at FROM rulebooks WHERE id = $1", [book.row.id]);
  if (rows[0]?.locked_at) return "The rulebook is locked: only the desk changes it";
  if (episode < 2) return "From the premiere it's a fix, which is the desk's";
  const last = Math.max(1, ...(await inForceEdits(pool, book.row.id)).map((e) => e.fromEpisode));
  if (last > episode) return `There's a change from Episode ${last} already`;
  return null;
}

/**
 * Our bot works out what the note adds (the rulebook prompt, with the season's rulebook as it is and the note), and only
 * what it adds goes in, from the episode, for every couch following the rulebook. Never throws: whatever goes wrong
 * sends it to the desk with a line.
 */
async function checkAndAdd(noticeId: string, runId: string, seasonId: string, episode: number, note: string, userId: string, bot?: string): Promise<void> {
  const started = Date.now();
  const finish = (ok: boolean, message: string) =>
    pool
      .query("UPDATE bot_research_runs SET finished_at = now(), ok = $2, message = $3, seconds = $4 WHERE id = $1", [runId, ok, message.slice(0, 1000), Math.round((Date.now() - started) / 100) / 10])
      .catch((e) => console.error("[show-change] couldn't record run", runId, e));
  try {
    const book = await ensureSeasonRulebook(pool, seasonId);
    if (!book) throw new Error("The season has no rulebook");
    const r = book.row;
    const now = blocksAt(r.blocks, await inForceEdits(pool, r.id), Infinity);
    const { rows: s } = await pool.query("SELECT s.name, ss.season_number, ss.status FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
    const prompt = buildRulebookPrompt({ show: s[0]?.name ?? r.name, season: s[0] ? `season ${s[0].season_number}` : undefined, airing: s[0]?.status === "airing", template: now, change: { episode, note } });
    const { answer } = await askBot(prompt, { bot });
    const { rows: cast } = await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [seasonId]);
    const review = reviewRulebook(parseRulebookAnswer(answer), { castNames: cast.map((c) => c.name), keep: (now.customMoments ?? []).map((m) => m.label) });
    const adds = diffBlocks(now, review.blocks).filter((op: RulebookOp) => op.op === "add" && ADDABLE.has(op.block));
    if (!adds.length) {
      await settle(noticeId, "desk", "Our bot found nothing it could add");
      return void (await finish(false, "Nothing to add"));
    }
    const blocks = applyOps(now, adds);
    const problems = blocksProblems(blocks);
    if (problems.length) {
      await settle(noticeId, "desk", `What our bot would add doesn't fit: ${problems[0].message}`);
      return void (await finish(false, problems[0].message));
    }
    const summary = opLines(adds, now, blocks).slice(0, 3).join(" · ");
    const { rows: made } = await pool.query(
      `INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, ops, summary, reach, source, base_version, created_by, approved_at)
       VALUES ($1, 'show_changed', $2, 'in_force', $3::jsonb, $4, 'everyone', 'community', $5, $6, now()) RETURNING id`,
      [r.id, episode, JSON.stringify(adds), summary, r.version, userId]
    );
    const editId: string = made[0].id;
    const saved = await saveChain(pool, r.id, { userId });
    if (!saved || "refused" in saved) {
      await pool.query("DELETE FROM rulebook_edits WHERE id = $1", [editId]);
      await settle(noticeId, "desk", "What our bot would add doesn't compile with the rulebook");
      return void (await finish(false, "Refused by the compiler"));
    }
    await logDesk(pool, {
      entity: "rulebook",
      entityId: r.id,
      action: "showChanged",
      text: `The couches confirmed Episode ${episode} brought something new: ${summary}`,
      undo: { type: "rulebookEdit", id: r.id, editId, from: episode },
      userId: null,
    });
    await settle(noticeId, "added", summary, editId);
    // A couch's own copy is asked first; leagues following the rulebook get it; answers from the episode on are read again.
    await reachCopies(r.id, { kind: "show_changed", editId }, userId);
    await pushRulebook(r.id);
    await restageSeason(seasonId, episode, userId);
    await finish(true, `Added from Episode ${episode}: ${summary}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed";
    await settle(noticeId, "desk", `Our bot couldn't work out what to add (${message.slice(0, 120)})`).catch(() => undefined);
    await finish(false, message);
  }
}

// ---- the desk ----

export interface DeskNotice {
  id: string;
  seasonId: string;
  season: string;
  episode: number;
  note: string;
  status: ShowChangeStatus;
  line: string | null;
  yes: number;
  no: number;
  rulebookId: string | null;
}

/** The couches' show changes the desk decides: one sent there, and a split (as many say it's new as say it isn't). */
export async function deskNotices(): Promise<DeskNotice[]> {
  const { rows } = await pool.query(
    `SELECT n.id, n.season_id, n.episode_number, n.note, n.status, n.line, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS season, ss.rulebook_id
       FROM rulebook_notices n JOIN show_seasons ss ON ss.id = n.season_id JOIN shows s ON s.id = ss.show_id
      WHERE n.status IN ('open', 'desk') ORDER BY n.created_at`
  );
  const out: DeskNotice[] = [];
  for (const n of rows) {
    const v = await voices(n.id, await notesFor(n.season_id, n.episode_number));
    if (n.status === "open" && !(v.yes >= 1 && v.yes === v.no)) continue;
    out.push({ id: n.id, seasonId: n.season_id, season: n.season, episode: n.episode_number, note: n.note, status: n.status, line: n.status === "open" ? "The couches split" : n.line, yes: v.yes, no: v.no, rulebookId: n.rulebook_id });
  }
  return out;
}

/** The desk settles one: done (it changed the rulebook itself, or decided it's in) or not new. */
export async function settleNotice(user: SessionUser, id: string, status: unknown): Promise<void> {
  if (status !== "added" && status !== "not_new") throw new HttpError(400, "status is added or not_new");
  if (!isUuid(id)) throw new HttpError(404, "That isn't here");
  const { rows } = await pool.query("SELECT id, season_id, episode_number FROM rulebook_notices WHERE id = $1 AND status IN ('open', 'desk')", [id]);
  if (!rows.length) throw new HttpError(404, "That's settled already");
  await settle(id, status, status === "added" ? "The desk changed the rulebook" : "Not new: the desk's call");
  const book = await ensureSeasonRulebook(pool, rows[0].season_id);
  if (book) {
    await logDesk(pool, { entity: "rulebook", entityId: book.row.id, action: "notice", text: `Episode ${rows[0].episode_number}'s "something new": ${status === "added" ? "the desk changed the rulebook" : "not new"}`, userId: user.id });
  }
}
