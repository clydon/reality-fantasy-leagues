import crypto from "crypto";
import type { PoolClient } from "pg";
import { momentsFor } from "@/lib/game/formats/rulebook-moments.js";
import { applyOps, blocksAt, opLines, sameBlocks } from "@/lib/game/formats/rulebook-patch.js";
import type { RulebookOp } from "@/lib/game/formats/rulebook-patch";
import { camelId } from "@/lib/game/formats/rulebook-schema.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { previewLines, type PreviewLine } from "@/lib/game/results-changes";
import type { LeagueState } from "@/lib/game/types";
import { compileChain, copyRulebook, ensureSeasonRulebook, getRulebook, inForceEdits, saveChain, seasonLive, syncLeagueRulebook, type Rulebook } from "@db/rulebooks.js";
import { isSuperAdminUser } from "./auth-helpers";
import type { BackstageScope } from "./backstage";
import type { ChangeSpec, RulebookUndo } from "./change-log";
import { pool, withLeagueLock, HttpError } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { leagueStates } from "./league-states";
import type { Game } from "./show-space";

// Make it ours (docs/PLAN-new-design.md step 6b part 3; the mock's rulebook.js rbBsHead / rbOursSheet): a couch's own
// copy of its season's rulebook, from Backstage › Scoring rules. One copy for the couch's games on the season that you
// run as a Commissioner: a league-owned rulebook (0107) whose provenance says `ours`, owned by the first of them and
// pointed at by each (leagues.rulebook_id), compiled from its blocks, so those games play by it whether or not their
// season's leagues are on rulebooks (db/rulebooks.js syncLeagueRulebook).
//
//   What counts      a moment switched off (momentNotes[id].off) scores nothing and isn't asked: the engine scores a
//                    moment a rulebook doesn't have as 0, and the results it had stay, so counting it again is a switch.
//                    Ways out stay: they're how people leave the game, not something to count.
//   The couch's own  a moment added by hand that the couch answers (answeredBy 'league'), from the episode page
//                    (couch-answers.ts); its suggested points are the rulebook's, a game's own are its points.
//   Fixes            the desk's Fix a mistake reaches the copy too (reachCopies): its ops on the copy's base, where they
//                    still apply, the copy's own choices kept.
//   Show changes     ask first: the desk's The show changed arrives as a draft edit on the copy, shown once you've seen
//                    its episode, and Add it puts it in force from there; Skip leaves it out.
//   Follow it again  the copy goes (archived), the games follow the season's rulebook again, or their show's rules.
//
// Every change is a line in each game's Recent changes with its Undo (RulebookUndo, undoRulebookChange); one that can
// move standings (what counts, following again, a show change added) is previewed first (tier 2). Lines say nothing a
// player who's behind shouldn't read: "Added the show's change from Episode 6", never what it was.

export interface OurRules {
  /** The couch's own copy, or null while the games follow the season's rulebook. */
  copy: { id: string; name: string; from: string; games: string[]; version: number } | null;
  /** You're a Commissioner of a game here: you can make it yours, change it and follow again. */
  canChange: boolean;
  /** Games here playing by rules of their own from classic (a ruleset copy), left out of a copy. */
  ownRules: string[];
  /** What counts, as far as you've seen: every moment a couch can switch off, grouped as the rulebook reads. */
  moments: { id: string; label: string; group: string; counts: boolean }[];
  /** The couch's own moments: the couch answers them. */
  own: { id: string; label: string; counted: "yesNo" | "eachTime"; points: number }[];
  /** The show's changes since: added, skipped, or waiting for you (shown once you've seen its episode). */
  updates: { id: string; from: number; status: "ask" | "added" | "skipped" | "hidden"; lines: string[] }[];
}

type Copy = Rulebook;

/** The games here you run as a Commissioner (rules are a Commissioner's), bar any on a ruleset copy of its own. */
async function ruleGames(scope: BackstageScope): Promise<{ games: Game[]; ownRules: string[] }> {
  const mine = scope.games.filter((g) => g.yourRole === "commissioner" || isSuperAdminUser(scope.user));
  const states = await leagueStates(mine.map((g) => g.leagueId));
  const ownRules = mine.filter((g) => !!(states.get(g.leagueId) as LeagueState | undefined)?.settings.leagueRulesetData);
  return { games: mine.filter((g) => !ownRules.includes(g)), ownRules: ownRules.map((g) => g.name) };
}

/** The couch's own copy these games play by, or null. */
export async function copyOf(leagueIds: string[]): Promise<Copy | null> {
  if (!leagueIds.length) return null;
  const { rows } = await pool.query(
    `SELECT r.id FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id
      WHERE l.id = ANY($1::uuid[]) AND r.owner_kind = 'league' AND r.status <> 'archived' AND r.provenance->>'ours' = 'true'
      ORDER BY r.created_at LIMIT 1`,
    [leagueIds]
  );
  return rows.length ? getRulebook(pool, rows[0].id) : null;
}

/** The games playing by a copy. */
export async function gamesOn(copyId: string): Promise<{ id: string; name: string }[]> {
  const { rows } = await pool.query("SELECT id, name FROM leagues WHERE rulebook_id = $1 ORDER BY name", [copyId]);
  return rows;
}

async function seasonNameOf(seasonId: string): Promise<string> {
  const { rows } = await pool.query("SELECT COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [
    seasonId,
  ]);
  return rows[0]?.name ?? "the show";
}

const groupOf = (blocks: RulebookBlocks, from: { segment?: string; twist?: string; finale?: boolean; custom?: string }) =>
  from.segment
    ? ((blocks.segments ?? []).find((s) => s.id === from.segment)?.name ?? "Each episode")
    : from.twist
      ? ((blocks.twists ?? []).find((t) => t.id === from.twist)?.name ?? "Twists")
      : from.finale
        ? "The finale"
        : "Anywhere";

/**
 * What the couch can switch off: every moment the rulebook counts (not one it builds and switches off itself, not a way
 * out, not the couch's own), each with whether the couch still counts it (momentNotes[id].off is the couch's choice).
 */
function switchable(blocks: RulebookBlocks): { id: string; label: string; from: Record<string, unknown>; counts: boolean }[] {
  const notes = (blocks.momentNotes ?? {}) as Record<string, { off?: boolean }>;
  const plain = { ...blocks, momentNotes: Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, { ...v, off: undefined }])) } as RulebookBlocks;
  const own = new Set(ownMoments(blocks).map((m) => m.id));
  return momentsFor(plain)
    .filter((m) => !m.from.wayOut && !own.has(m.id))
    .map((m) => ({ id: m.id, label: m.label, from: m.from, counts: !notes[m.id]?.off }));
}

/** The couch's own moments in these blocks: added by hand, answered by the couch. */
export const ownMoments = (blocks: RulebookBlocks) => (blocks.customMoments ?? []).filter((m) => m.answeredBy === "league");

/** Scoring rules' half on the rulebook: following it or the couch's own, and, when it's yours, what counts and the show's changes. */
export async function ourRules(scope: BackstageScope): Promise<OurRules> {
  const { games, ownRules } = await ruleGames(scope);
  const copy = await copyOf(scope.games.map((g) => g.leagueId));
  const out: OurRules = { copy: null, canChange: games.length > 0, ownRules, moments: [], own: [], updates: [] };
  if (!copy) return out;
  const seen = await seenThrough(scope.user.id, scope.seasonId);
  const edits = await inForceEdits(pool, copy.id);
  const now = blocksAt(copy.blocks, edits, seen === EVERYTHING ? Infinity : seen);
  const parent = copy.parentId ? await getRulebook(pool, copy.parentId) : null;
  out.copy = { id: copy.id, name: copy.name, from: parent?.name ?? copy.name, games: (await gamesOn(copy.id)).map((g) => g.name), version: copy.version };
  out.moments = switchable(now).map((m) => ({ id: m.id, label: m.label, group: groupOf(now, m.from), counts: m.counts }));
  out.own = ownMoments(now).map((m) => ({
    id: m.id,
    label: m.label,
    counted: m.counted === "eachTime" ? "eachTime" : "yesNo",
    points: typeof now.points?.[m.id] === "number" ? (now.points[m.id] as number) : 0,
  }));
  // The show's changes the desk made since the copy was made (copied ones are its history, not news).
  const { rows } = await pool.query(
    `SELECT id, from_episode, status, ops FROM rulebook_edits
      WHERE rulebook_id = $1 AND kind = 'show_changed' AND status IN ('draft', 'in_force', 'no_change') AND NOT COALESCE((proposal->>'copied')::boolean, false)
      ORDER BY from_episode, created_at`,
    [copy.id]
  );
  for (const e of rows) {
    const from = e.from_episode as number;
    if (from > seen) {
      out.updates.push({ id: e.id, from, status: "hidden", lines: [] });
      continue;
    }
    const before = blocksAt(copy.blocks, edits.filter((x) => x.id !== e.id), from);
    const after = applyOps(before, e.ops as RulebookOp[]);
    out.updates.push({ id: e.id, from, status: e.status === "draft" ? "ask" : e.status === "in_force" ? "added" : "skipped", lines: opLines(e.ops as RulebookOp[], before, after) });
  }
  return out;
}

// ---------- the copy's writes ----------

/** Each game on the copy brought in step (settings.rulebook), under its lock, with its line in Recent changes. */
async function syncGames(leagueIds: string[], spec: (leagueId: string) => ChangeSpec, before?: (client: PoolClient, leagueId: string) => Promise<void>): Promise<void> {
  for (const id of leagueIds) {
    await withLeagueLock(
      id,
      async (s, client) => {
        if (before) await before(client, id);
        await syncLeagueRulebook(client, id, s.settings as never);
      },
      spec(id)
    );
  }
}

/** What each game's standings would do with these rules in place of the ones it has (null: no rulebook, its show's rules). */
async function preview(leagueIds: string[], games: Game[], rules: { id: string; version: number; data: unknown; reader: string } | null): Promise<PreviewLine[]> {
  const states = await leagueStates(leagueIds);
  const { rows: seats } = await pool.query("SELECT player_id, user_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND player_id IS NOT NULL", [leagueIds]);
  const users = new Map(seats.map((s) => [s.player_id, s.user_id]));
  const lines: PreviewLine[] = [];
  for (const id of leagueIds) {
    const before = states.get(id) as LeagueState | undefined;
    if (!before) continue;
    const after = structuredClone(before);
    if (rules) after.settings.rulebook = rules as never;
    else delete after.settings.rulebook;
    lines.push(...previewLines(before, after, games.find((g) => g.leagueId === id)?.gameName ?? "", (p) => users.get(p) ?? null));
  }
  return lines;
}

/** Make it ours: the copy, for every game here you run as a Commissioner. An unedited copy scores exactly the same. */
export async function makeOurs(scope: BackstageScope): Promise<{ batch: string; games: number }> {
  const { games } = await ruleGames(scope);
  if (!games.length) throw new HttpError(403, "Only a Commissioner changes the rules");
  if (await copyOf(games.map((g) => g.leagueId))) throw new HttpError(409, "It's yours already");
  const season = await ensureSeasonRulebook(pool, scope.seasonId);
  if (!season?.row) throw new HttpError(404, "This season has no rulebook to copy");
  const book = season.row;
  const { rows: couch } = await pool.query("SELECT name FROM couches WHERE id = $1", [scope.couchId]);
  const client = await pool.connect();
  let copyId: string;
  try {
    await client.query("BEGIN");
    const copy = await copyRulebook(client, book.id, { ownerKind: "league", leagueId: games[0].leagueId, userId: scope.user.id, name: `${book.name} · ${couch[0]?.name ?? "our couch"}` });
    if (!copy) throw new HttpError(404, "This season has no rulebook to copy");
    copyId = copy.id;
    await client.query("UPDATE rulebooks SET provenance = provenance || $2::jsonb WHERE id = $1", [copy.id, JSON.stringify({ ours: true, couchId: scope.couchId, seasonId: scope.seasonId })]);
    // Its timeline as it is: the season's show changes come with it, already in force.
    await client.query(
      `INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, ops, summary, reach, source, proposal, base_version, created_by, approved_by, approved_at)
       SELECT $1, kind, from_episode, status, ops, summary, reach, source, jsonb_build_object('seasonEdit', id, 'copied', true), base_version, created_by, approved_by, approved_at
         FROM rulebook_edits WHERE rulebook_id = $2 AND status = 'in_force' AND kind = 'show_changed' AND source <> 'migration'`,
      [copy.id, book.id]
    );
    const saved = await saveChain(client, copy.id, { userId: scope.user.id });
    if (!saved || "refused" in saved) throw new HttpError(409, "The season's rulebook can't be copied as it is");
    await client.query("UPDATE leagues SET rulebook_id = $1 WHERE id = ANY($2::uuid[])", [copy.id, games.map((g) => g.leagueId)]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  const name = await seasonNameOf(scope.seasonId);
  const batch = crypto.randomUUID();
  await syncGames(
    games.map((g) => g.leagueId),
    () => ({ userId: scope.user.id, kind: "rules.ours", tier: 1, text: `Made ${name}'s rulebook the couch's own`, batch, undo: { type: "rulebook", action: "ours", rulebookId: copyId } })
  );
  return { batch, games: games.length };
}

/** Follow it again: the copy goes, and the games follow the season's rulebook (or their show's rules) again. */
export async function followAgain(
  scope: BackstageScope,
  opts: { preview?: boolean } = {}
): Promise<{ lines: PreviewLine[]; off: number; own: number } | { batch: string; games: number }> {
  const { games } = await ruleGames(scope);
  if (!games.length) throw new HttpError(403, "Only a Commissioner changes the rules");
  const copy = await copyOf(games.map((g) => g.leagueId));
  if (!copy) throw new HttpError(409, "These games follow the season's rulebook already");
  const on = (await gamesOn(copy.id)).map((g) => g.id);
  if (opts.preview) {
    const live = await seasonLive(pool, scope.seasonId);
    const season = live ? await ensureSeasonRulebook(pool, scope.seasonId) : null;
    const rules = season?.row?.compiled ? { id: season.row.id, version: season.row.version, data: season.row.compiled, reader: season.row.reader } : null;
    const now = blocksAt(copy.blocks, await inForceEdits(pool, copy.id), Infinity);
    const off = switchable(now).filter((m) => !m.counts).length;
    return { lines: await preview(on, scope.games, rules), off, own: ownMoments(now).length };
  }
  const name = await seasonNameOf(scope.seasonId);
  const batch = crypto.randomUUID();
  await syncGames(
    on,
    () => ({ userId: scope.user.id, kind: "rules.follow", tier: 2, text: `Followed ${name}'s rulebook again`, batch, undo: { type: "rulebook", action: "follow", rulebookId: copy.id } }),
    async (client, leagueId) => {
      await client.query("UPDATE leagues SET rulebook_id = NULL WHERE id = $1 AND rulebook_id = $2", [leagueId, copy.id]);
      await client.query("UPDATE rulebooks SET status = 'archived', updated_at = now() WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM leagues WHERE rulebook_id = $1)", [copy.id]);
    }
  );
  return { batch, games: on.length };
}

/**
 * A change to the copy: `off` (every moment that shouldn't count, in full), `add` (a moment the couch answers: its label,
 * how it's counted, its suggested points) or `remove` (one of the couch's own). `preview` first when it can move standings.
 */
export async function changeOurs(
  scope: BackstageScope,
  body: { off?: unknown; add?: { label?: unknown; counted?: unknown; points?: unknown }; remove?: unknown },
  opts: { preview?: boolean } = {}
): Promise<{ lines: PreviewLine[] } | { batch: string | null }> {
  const { games } = await ruleGames(scope);
  if (!games.length) throw new HttpError(403, "Only a Commissioner changes the rules");
  const copy = await copyOf(games.map((g) => g.leagueId));
  if (!copy) throw new HttpError(409, "Make it ours first");
  const edits = await inForceEdits(pool, copy.id);
  const now = blocksAt(copy.blocks, edits, Infinity);
  const base = structuredClone(copy.blocks) as RulebookBlocks & { momentNotes?: Record<string, Record<string, unknown>> };
  let text: string;
  let tier: 1 | 2 = 2;
  if (Array.isArray(body.off)) {
    const can = switchable(now);
    const want = new Set((body.off as unknown[]).map(String));
    const unknown = [...want].filter((id) => !can.some((m) => m.id === id));
    if (unknown.length) throw new HttpError(400, "That isn't a moment you can switch off");
    const notes = { ...(base.momentNotes ?? {}) };
    let stopped = 0;
    let back = 0;
    for (const m of can) {
      const note = { ...(notes[m.id] ?? {}) };
      const was = note.off === true;
      if (want.has(m.id)) note.off = true;
      else delete note.off;
      if (want.has(m.id) && !was) stopped++;
      if (!want.has(m.id) && was) back++;
      if (Object.keys(note).length) notes[m.id] = note;
      else delete notes[m.id];
    }
    if (!stopped && !back) throw new HttpError(400, "Nothing changed");
    if (Object.keys(notes).length) base.momentNotes = notes as never;
    else delete base.momentNotes;
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    text = stopped && back ? `Changed what counts: ${n(stopped, "moment")} off, ${back} back on` : stopped ? `Stopped counting ${n(stopped, "moment")}` : `Counts ${n(back, "moment")} again`;
  } else if (body.add && typeof body.add === "object") {
    const label = typeof body.add.label === "string" ? body.add.label.trim().slice(0, 80) : "";
    if (!label) throw new HttpError(400, "Say what happens");
    const counted = body.add.counted === "eachTime" ? "eachTime" : "yesNo";
    const points = Number(body.add.points ?? 1);
    if (!Number.isFinite(points) || points < -20 || points > 20) throw new HttpError(400, "Points are -20 to 20");
    const used = new Set(momentsFor(now, { includeOff: true }).map((m) => m.id));
    const stem = camelId(label) || "ourMoment";
    let id = stem;
    for (let i = 2; used.has(id); i++) id = `${stem}${i}`;
    base.customMoments = [...(base.customMoments ?? []), { id, label, counted, answeredBy: "league" } as never];
    base.points = { ...(base.points ?? {}), [id]: Math.round(points * 2) / 2 };
    text = `Added a moment the couch answers: ${label}`;
    tier = 1;
  } else if (typeof body.remove === "string") {
    const m = ownMoments(base).find((x) => x.id === body.remove);
    if (!m) throw new HttpError(404, "That isn't one of the couch's own moments");
    base.customMoments = (base.customMoments ?? []).filter((x) => x.id !== m.id);
    if (base.points) {
      const { [m.id]: _gone, ...rest } = base.points;
      void _gone;
      base.points = rest;
    }
    text = `Took out a moment of the couch's own: ${m.label}`;
  } else throw new HttpError(400, "off, add or remove");

  const on = (await gamesOn(copy.id)).map((g) => g.id);
  if (opts.preview) {
    const compiled = compileChain(copy, base, edits, copy.phaseStarts);
    if (!compiled.data) throw new HttpError(400, compiled.problems[0] ?? "That isn't a usable rulebook");
    return { lines: await preview(on, scope.games, { id: copy.id, version: copy.version + 1, data: compiled.data, reader: copy.reader }) };
  }
  const saved = await saveChain(pool, copy.id, { blocks: base, userId: scope.user.id });
  if (!saved) throw new HttpError(404, "Rulebook not found");
  if ("refused" in saved) throw new HttpError(400, saved.refused[0]?.message ?? "That isn't a usable rulebook");
  const batch = crypto.randomUUID();
  await syncGames(on, () => ({
    userId: scope.user.id,
    kind: "rules.ours",
    tier,
    text,
    batch,
    undo: { type: "rulebook", action: "blocks", rulebookId: copy.id, before: copy.blocks, version: saved.rulebook.version },
  }));
  return { batch };
}

/** A show change waiting on the copy: Add it (in force from its episode, previewed first) or Skip it. */
export async function answerUpdate(scope: BackstageScope, editId: unknown, take: boolean, opts: { preview?: boolean } = {}): Promise<{ lines: PreviewLine[] } | { batch: string }> {
  const { games } = await ruleGames(scope);
  if (!games.length) throw new HttpError(403, "Only a Commissioner changes the rules");
  const copy = await copyOf(games.map((g) => g.leagueId));
  if (!copy) throw new HttpError(409, "Make it ours first");
  const { rows } = await pool.query("SELECT id, from_episode, status FROM rulebook_edits WHERE id::text = $1 AND rulebook_id = $2", [String(editId), copy.id]);
  const edit = rows[0];
  if (!edit) throw new HttpError(404, "That change isn't on your rulebook");
  if (edit.status !== "draft") throw new HttpError(409, "You've answered that one already");
  if ((await seenThrough(scope.user.id, scope.seasonId)) < edit.from_episode) throw new HttpError(403, `Reveal Episode ${edit.from_episode} first`);
  const on = (await gamesOn(copy.id)).map((g) => g.id);
  if (opts.preview) {
    if (!take) return { lines: [] };
    const edits = [...(await inForceEdits(pool, copy.id)), ...(await editRows([edit.id]))].sort((a, b) => a.fromEpisode - b.fromEpisode);
    const compiled = compileChain(copy, copy.blocks, edits, copy.phaseStarts);
    if (!compiled.data) throw new HttpError(409, compiled.problems[0] ?? "That change doesn't fit your rulebook");
    return { lines: await preview(on, scope.games, { id: copy.id, version: copy.version + 1, data: compiled.data, reader: copy.reader }) };
  }
  const after = take ? "in_force" : "no_change";
  await pool.query("UPDATE rulebook_edits SET status = $2, approved_by = $3, approved_at = now(), updated_at = now() WHERE id = $1", [edit.id, after, scope.user.id]);
  if (take) {
    const saved = await saveChain(pool, copy.id, { userId: scope.user.id });
    if (!saved || "refused" in saved) {
      await pool.query("UPDATE rulebook_edits SET status = 'draft' WHERE id = $1", [edit.id]);
      throw new HttpError(409, saved && "refused" in saved ? (saved.refused[0]?.message ?? "That change doesn't fit your rulebook") : "Rulebook not found");
    }
  }
  const batch = crypto.randomUUID();
  const n = edit.from_episode as number;
  await syncGames(on, () => ({
    userId: scope.user.id,
    kind: "rules.update",
    tier: take ? 2 : 1,
    episode: n,
    text: take ? `Added the show's change from Episode ${n} to the couch's rulebook` : `Skipped the show's change from Episode ${n}`,
    batch,
    undo: { type: "rulebook", action: "edit", rulebookId: copy.id, editId: edit.id, status: { before: "draft", after } },
  }));
  return { batch };
}

async function editRows(ids: string[]) {
  const { rows } = await pool.query("SELECT id, kind, from_episode, ops, summary, source, created_by, approved_at, created_at FROM rulebook_edits WHERE id = ANY($1::uuid[])", [ids]);
  return rows.map((r) => ({ id: r.id, kind: r.kind, fromEpisode: r.from_episode, ops: r.ops || [], summary: r.summary, source: r.source, createdBy: r.created_by, at: r.approved_at || r.created_at }));
}

/**
 * Recent changes' Undo of one of the above, in one game, inside its lock (league-changes.ts undoBatch). The copy is
 * changed by the first game the batch reaches; the others only follow it.
 */
export async function undoRulebookChange(client: PoolClient, leagueId: string, state: LeagueState, undo: RulebookUndo): Promise<void> {
  const copy = await getRulebook(client, undo.rulebookId);
  if (!copy) throw new HttpError(409, "That rulebook is gone");
  if (undo.action === "ours") {
    await client.query("UPDATE leagues SET rulebook_id = NULL WHERE id = $1 AND rulebook_id = $2", [leagueId, copy.id]);
    await client.query("UPDATE rulebooks SET status = 'archived', updated_at = now() WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM leagues WHERE rulebook_id = $1)", [copy.id]);
  } else if (undo.action === "follow") {
    if (copy.status === "archived") {
      try {
        await client.query("UPDATE rulebooks SET status = 'in_force', updated_at = now() WHERE id = $1", [copy.id]);
      } catch (e) {
        if ((e as { code?: string }).code === "23505") throw new HttpError(409, "The couch has made the rulebook its own again since");
        throw e;
      }
    }
    const { rows } = await client.query("SELECT rulebook_id FROM leagues WHERE id = $1", [leagueId]);
    if (rows[0]?.rulebook_id && rows[0].rulebook_id !== copy.id) throw new HttpError(409, "This game plays by other rules since");
    await client.query("UPDATE leagues SET rulebook_id = $2 WHERE id = $1", [leagueId, copy.id]);
  } else if (undo.action === "blocks") {
    if (!sameBlocks(copy.blocks, undo.before)) {
      if (copy.version !== undo.version) throw new HttpError(409, "The couch's rulebook has changed since");
      const saved = await saveChain(client, copy.id, { blocks: undo.before as RulebookBlocks });
      if (!saved || "refused" in saved) throw new HttpError(409, "That can't be put back now");
    }
  } else if (undo.action === "edit" && undo.editId && undo.status) {
    const { rows } = await client.query("SELECT status FROM rulebook_edits WHERE id = $1", [undo.editId]);
    const status = rows[0]?.status;
    if (status === undo.status.after) {
      await client.query("UPDATE rulebook_edits SET status = $2, approved_by = NULL, approved_at = NULL, updated_at = now() WHERE id = $1", [undo.editId, undo.status.before]);
      if (undo.status.after === "in_force") {
        const saved = await saveChain(client, copy.id, {});
        if (!saved || "refused" in saved) throw new HttpError(409, "Taking that change out would leave a later one with nothing to change");
      }
    } else if (status !== undo.status.before) throw new HttpError(409, "That change has moved on since");
  }
  await syncLeagueRulebook(client, leagueId, state.settings as never);
}

// ---------- the desk's changes reaching the couches' copies ----------

/** The couches' own copies made from a season's rulebook. */
async function copiesOf(seasonBookId: string): Promise<Copy[]> {
  const { rows } = await pool.query(
    "SELECT id FROM rulebooks WHERE owner_kind = 'league' AND parent_kind = 'rulebook' AND parent_id = $1 AND status <> 'archived' AND provenance->>'ours' = 'true'",
    [seasonBookId]
  );
  const out: Copy[] = [];
  for (const r of rows) {
    const c = await getRulebook(pool, r.id);
    if (c) out.push(c);
  }
  return out;
}

/**
 * A fix's ops on a copy's base: lists by item (an item the copy took out stays out), and the per-moment maps (points,
 * the league's notes) key by key, so what the couch chose stays where the fix didn't touch it.
 */
function fixOnCopy(copyBase: RulebookBlocks, ops: RulebookOp[], seasonBefore: RulebookBlocks, seasonAfter: RulebookBlocks): RulebookBlocks {
  const maps = ["points", "momentNotes"] as const;
  const b = applyOps(
    copyBase,
    ops.filter((o) => !(o.op === "set" && (maps as readonly string[]).includes(o.block as string)))
  ) as unknown as Record<string, unknown>;
  const map = (blocks: unknown, key: string) => ((blocks as Record<string, unknown>)[key] ?? {}) as Record<string, unknown>;
  for (const key of maps) {
    if (!ops.some((o) => o.op === "set" && o.block === key)) continue;
    const was = map(seasonBefore, key);
    const now = map(seasonAfter, key);
    const mine = { ...map(b, key) };
    for (const id of new Set([...Object.keys(was), ...Object.keys(now)])) {
      if (JSON.stringify(was[id]) === JSON.stringify(now[id])) continue;
      if (now[id] === undefined) delete mine[id];
      else mine[id] = now[id];
    }
    if (Object.keys(mine).length) b[key] = mine;
    else delete b[key];
  }
  return b as unknown as RulebookBlocks;
}

/**
 * The desk saved the season's rulebook: a fix reaches every copy made from it (its base, then its games, rescored); a show
 * change reaches each as a question (a draft edit), shown to the couch once they've seen its episode; a show change
 * withdrawn is withdrawn from the copies too, in force or not.
 */
export async function reachCopies(
  seasonBookId: string,
  change: { kind: "fix"; ops: RulebookOp[]; before: RulebookBlocks; after: RulebookBlocks } | { kind: "show_changed"; editId: string } | { kind: "withdrawn"; editId: string },
  userId: string
): Promise<number> {
  const copies = await copiesOf(seasonBookId);
  for (const copy of copies) {
    const on = (await gamesOn(copy.id)).map((g) => g.id);
    if (change.kind === "fix") {
      const base = fixOnCopy(copy.blocks, change.ops, change.before, change.after);
      if (sameBlocks(base, copy.blocks)) continue;
      const saved = await saveChain(pool, copy.id, { blocks: base, userId });
      if (!saved || "refused" in saved) {
        console.error(`[ours] copy ${copy.id}: the season's fix doesn't fit it`, saved && "refused" in saved ? saved.refused : null);
        continue;
      }
      const batch = crypto.randomUUID();
      await syncGames(on, () => ({ userId, kind: "rules.fix", tier: 2, text: "A fix to the show's rulebook reached the couch's own", batch }));
    } else if (change.kind === "show_changed") {
      await pool.query(
        `INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, ops, summary, reach, source, proposal, base_version, created_by)
         SELECT $1, kind, from_episode, 'draft', ops, summary, 'following', source, jsonb_build_object('seasonEdit', id), $3, created_by
           FROM rulebook_edits WHERE id = $2`,
        [copy.id, change.editId, copy.version]
      );
    } else {
      // A question the couch never answered just goes; one it added comes out of its games too.
      const { rows: was } = await pool.query("SELECT status FROM rulebook_edits WHERE rulebook_id = $1 AND proposal->>'seasonEdit' = $2 AND status <> 'withdrawn'", [copy.id, change.editId]);
      if (!was.length) continue;
      await pool.query("UPDATE rulebook_edits SET status = 'withdrawn', updated_at = now() WHERE rulebook_id = $1 AND proposal->>'seasonEdit' = $2 AND status <> 'withdrawn'", [copy.id, change.editId]);
      if (!was.some((r) => r.status === "in_force")) continue;
      const saved = await saveChain(pool, copy.id, { userId });
      if (!saved || "refused" in saved) continue;
      const batch = crypto.randomUUID();
      await syncGames(on, () => ({ userId, kind: "rules.fix", tier: 2, text: "A show change was taken back from the show's rulebook and the couch's own", batch }));
    }
  }
  return copies.length;
}

/** For the desk's reach line: copies made from a season's rulebook, and the games on them. */
export async function copiesReach(seasonBookId: string): Promise<{ copies: number; games: number }> {
  const copies = await copiesOf(seasonBookId);
  let games = 0;
  for (const c of copies) games += (await gamesOn(c.id)).length;
  return { copies: copies.length, games };
}

