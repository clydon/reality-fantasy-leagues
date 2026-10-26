import { howItWorks, blockSummaries, type HowItWorks } from "@/lib/game/formats/rulebook-describe";
import { gamesFor } from "@/lib/game/formats/rulebook-fits.js";
import type { GameFit } from "@/lib/game/formats/rulebook-fits";
import { shapeById, shapesOf } from "@/lib/game/formats/rulebook-shapes.js";
import { applyOps, blocksAt, diffBlocks, opLines } from "@/lib/game/formats/rulebook-patch";
import { parseRulebookAnswer, reviewRulebook } from "@/lib/game/formats/rulebook-research";
import { buildRulebookPrompt } from "@/lib/game/formats/rulebook-research";
import { blocksProblems, labelOf, type BlocksProblem, type RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { ensureSeasonRulebook, getRulebook, inForceEdits, leaguesUsing, lineage, saveChain, setPhaseStart, syncLeagueRulebook, type Rulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { restageSeason } from "./community-results";
import { requireCouch } from "./couches";
import { pool, withLeagueLock, HttpError } from "./db";
import { byNewest, deskLines, logDesk, type DeskLine } from "./desk";
import { madeLine, saveTemplate } from "./desk-library";
import { reachCopies } from "./ours";
import { deskNotices } from "./show-changes";
import { latestAired, seasonSchedules } from "./schedule";

// A rulebook on the desk (docs/PLAN-new-design.md step 6b part 2; rulebooks phases 4-6; the mock's rulebook.js
// adminRulebook): the rulebook's page is its editor. Each part (who's playing, the season, each episode, ways out,
// twists, what scores, the kind) opens its own editor; saving asks what kind of change it is:
//
//   Fix a mistake       it was always like this: folded into the rulebook from the premiere, and every answer for the
//                       season is read again under it (restageSeason), so every couch is rescored from the start
//   The show changed    from episode N on: an edit (rulebook_edits) that compiles in from N (rulebook-patch.js's
//                       mergeAtEpisode), so episodes before it keep their rules and scores
//
// Either way the version moves on and every league following it gets it (syncLeagueRulebook, under each league's lock),
// once its season's leagues play by rulebooks: the flag for everyone, or this season's own switch (0113), so a season
// can go first. Research asks for blocks too: Check for changes copies the rulebook prompt with this rulebook as its
// starting point, and a pasted answer is reviewed and shown as the changes it makes, to save either way. Lock (couches'
// suggestions still reach the Inbox), the Timeline (not spoiler-safe: it's the admin's), History with undo, and Save as a
// starting point for new shows.

export interface DeskRulebookEdit {
  id: string;
  kind: "show_changed" | "fix";
  fromEpisode: number;
  summary: string | null;
  lines: string[];
  at: string;
  who: string | null;
  status: string;
}

export interface DeskRulebook {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  ownerKind: string;
  version: number;
  edited: boolean;
  locked: { by: string | null; at: string } | null;
  season: { id: string; name: string; show: string; art: string | null; aired: number; episodeCount: number | null; live: boolean; everywhere: boolean } | null;
  reach: { following: number; ownCopies: number; line: string };
  /** In force from the premiere, and now (with every edit). The editor edits `now`. */
  base: RulebookBlocks;
  now: RulebookBlocks;
  parts: { block: string; label: string; summary: string }[];
  phases: { id: string; name: string; confirmed: number | null; needs: boolean }[];
  edits: DeskRulebookEdit[];
  /** The latest show change's episode: a new one starts there or later. */
  lastChange: number;
  how: HowItWorks;
  suggestions: { id: string; who: string; about: string; note: string; at: string }[];
  /** Show changes the couches split on, or sent to the desk (step 6c part 2): research's note, and why it's here. */
  notices: { id: string; episode: number; note: string; line: string | null; yes: number; no: number }[];
  history: DeskLine[];
  /** "Fits these games" (rulebook-fits.js gamesFor): each season game, whether it fits, and what it needs when it doesn't. */
  fits: GameFit[];
  /** Made by someone with Make it a game (step 10 part 2a): who first made it and how, whether anyone checked it, and
   *  whether the desk took it over. */
  made: { line: string; review: "unreviewed" | "checked" | "reviewed"; couches: string[] } | null;
  /** In the library: offered as a starting point, the shape it was saved as, the shows it's for, and what was made from it. */
  library: { template: boolean; shape: string | null; shows: string[]; seasons: number; deletable: boolean } | null;
  /** Where it came from, nearest first ("Survivor 50 › Survivor"). */
  lineage: string[];
  /** The shapes it is (a season's rulebook: what it would help earn). */
  shapes: string[];
}

const ABOUT: Record<string, string> = { segment: "A part of an episode", wayOut: "A way out", scores: "Something that scores", other: "Something else" };

async function row(id: string): Promise<Rulebook> {
  if (!isUuid(id)) throw new HttpError(404, "Rulebook not found");
  const r = await getRulebook(pool, id);
  if (!r || r.status === "archived") throw new HttpError(404, "Rulebook not found");
  return r;
}

async function seasonOf(r: Rulebook) {
  if (!r.seasonId) return null;
  const { rows } = await pool.query(
    `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, s.name AS show, s.art_url, ss.episode_count, ss.rulebook_live, ss.status, ss.season_number
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [r.seasonId]
  );
  if (!rows.length) return null;
  const { rows: flag } = await pool.query("SELECT value FROM app_settings WHERE key = 'rulebooks'");
  const schedule = (await seasonSchedules([r.seasonId])).get(r.seasonId);
  const s = rows[0];
  return {
    id: s.id as string,
    name: s.name as string,
    show: s.show as string,
    art: (s.art_url as string | null) ?? null,
    aired: latestAired(schedule) ?? 0,
    episodeCount: (s.episode_count as number | null) ?? null,
    live: !!s.rulebook_live,
    everywhere: flag[0]?.value === true,
    airing: s.status === "airing",
    number: s.season_number as number,
  };
}

/** The rulebook's page: its parts, its edits, who it reaches, and How it works as the admin reads it (everything). */
export async function deskRulebook(id: string): Promise<DeskRulebook> {
  const r = await row(id);
  const season = await seasonOf(r);
  const edits = await inForceEdits(pool, id);
  const now = blocksAt(r.blocks, edits, Infinity);
  const using = await leaguesUsing(pool, id);
  const { rows: all } = await pool.query(
    `SELECT e.id, e.kind, e.from_episode, e.summary, e.ops, e.status, COALESCE(e.approved_at, e.created_at) AS at, COALESCE(u.username, u.name) AS who
       FROM rulebook_edits e LEFT JOIN "user" u ON u.id = e.created_by WHERE e.rulebook_id = $1 AND e.source <> 'migration' ORDER BY COALESCE(e.approved_at, e.created_at) DESC`,
    [id]
  );
  // Each edit's ops in words, against the blocks it was made on.
  const lineFor = (e: (typeof all)[number]) => {
    const before = blocksAt(r.blocks, edits.filter((x) => x.fromEpisode < e.from_episode || (x.fromEpisode === e.from_episode && x.id !== e.id && Date.parse(x.at) < Date.parse(e.at))), Infinity);
    return opLines(e.ops ?? [], before, applyOps(before, e.ops ?? []));
  };
  const { rows: lock } = await pool.query("SELECT r.locked_at, COALESCE(u.username, u.name) AS who FROM rulebooks r LEFT JOIN \"user\" u ON u.id = r.locked_by WHERE r.id = $1", [id]);
  const { rows: tips } = await pool.query(
    `SELECT g.id, g.about, g.note, g.created_at, COALESCE(u.username, u.name) AS who FROM rulebook_suggestions g LEFT JOIN "user" u ON u.id = g.user_id
      WHERE g.rulebook_id = $1 AND g.status = 'open' ORDER BY g.created_at`,
    [id]
  );
  const phases = (now.season?.phases ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    confirmed: r.phaseStarts[p.id] ?? null,
    needs: p.starts?.type !== "episode" && r.phaseStarts[p.id] == null,
  }));
  const updates = [
    { episode: 1, kind: "start" as const, detail: r.provenance?.from === "rulebook" || r.parentKind === "rulebook" ? "Started from the show's rulebook." : "In force from the premiere." },
    ...edits.map((e) => ({ episode: e.fromEpisode, kind: "showChanged" as const, detail: e.summary ?? "" })),
  ];
  const how = howItWorks(now, { compiled: r.compiled ?? undefined, aliases: r.aliases, seen: Infinity, episodeCount: season?.episodeCount ?? undefined, phaseStarts: r.phaseStarts, updates });
  return {
    id,
    name: r.name,
    kind: r.kind,
    kindLabel: labelOf("kind", r.kind),
    ownerKind: r.ownerKind,
    version: r.version,
    edited: r.compiledSource === "blocks",
    locked: lock[0]?.locked_at ? { by: lock[0].who, at: lock[0].locked_at.toISOString() } : null,
    season: season ? { id: season.id, name: season.name, show: season.show, art: season.art, aired: season.aired, episodeCount: season.episodeCount, live: season.live, everywhere: season.everywhere } : null,
    reach: {
      following: using?.following.length ?? 0,
      ownCopies: using?.ownCopies.length ?? 0,
      line: season
        ? `Every couch on ${season.name} · ${using?.following.length ?? 0} ${using?.following.length === 1 ? "league follows" : "leagues follow"} it${using?.ownCopies.length ? `, ${using.ownCopies.length} have their own copy` : ""}`
        : "In the library: new shows can start from it",
    },
    base: r.blocks,
    now,
    parts: blockSummaries(now),
    phases,
    edits: all.map((e) => ({ id: e.id, kind: e.kind, fromEpisode: e.from_episode, summary: e.summary, lines: lineFor(e), at: e.at.toISOString(), who: e.who, status: e.status })),
    lastChange: Math.max(1, ...edits.map((e) => e.fromEpisode)),
    how,
    suggestions: tips.map((t) => ({ id: t.id, who: t.who ?? "Someone", about: ABOUT[t.about] ?? t.about, note: t.note, at: t.created_at.toISOString() })),
    notices: season ? (await deskNotices()).filter((n) => n.seasonId === season.id).map((n) => ({ id: n.id, episode: n.episode, note: n.note, line: n.line, yes: n.yes, no: n.no })) : [],
    history: byNewest(await deskLines("rulebook", id)),
    fits: gamesFor(now, r.compiled),
    made: await madeOf(r),
    library: r.ownerKind === "library" ? await libraryOf(r) : null,
    lineage: ((await lineage(pool, id))?.parents ?? []).map((p) => p.name),
    shapes: shapesOf(now).map((s) => shapeById(s)?.name ?? s),
  };
}

async function madeOf(r: Rulebook): Promise<DeskRulebook["made"]> {
  if (r.provenance?.from !== "made") return null;
  const { rows } = await pool.query(`SELECT COALESCE(username, name) AS who FROM "user" WHERE id = $1`, [r.createdBy]);
  const { rows: parent } = r.parentId ? await pool.query("SELECT name FROM rulebooks WHERE id::text = $1", [r.parentId]) : { rows: [] };
  const { rows: checks } = await pool.query("SELECT c.name FROM rulebook_checks k JOIN couches c ON c.id = k.couch_id WHERE k.rulebook_id = $1 ORDER BY k.created_at", [r.id]);
  const review = (["unreviewed", "checked", "reviewed"].includes(r.reviewStatus) ? r.reviewStatus : "reviewed") as "unreviewed" | "checked" | "reviewed";
  const desk = !!r.approvedBy && r.approvedBy === r.createdBy;
  return { line: madeLine({ via: r.provenance?.via as string | undefined, who: rows[0]?.who ?? null, template: parent[0]?.name ?? null, review, checks: checks.length, desk }), review, couches: checks.map((c) => c.name) };
}

async function libraryOf(r: Rulebook): Promise<DeskRulebook["library"]> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM rulebooks WHERE parent_kind = 'rulebook' AND parent_id = $1 AND status <> 'archived'", [r.id]);
  const shows = Array.isArray(r.provenance?.shows) ? (r.provenance!.shows as unknown[]).filter((s): s is string => typeof s === "string") : [];
  return {
    template: r.isTemplate,
    shape: typeof r.provenance?.shape === "string" ? (shapeById(r.provenance.shape)?.name ?? null) : null,
    shows,
    seasons: rows[0].n,
    deletable: r.parentKind !== "builtin" && r.parentKind !== "show_format" && rows[0].n === 0,
  };
}

/** Every league following rulebook `id` gets its version now (or none, while its season's leagues don't play by it). */
export async function pushRulebook(id: string): Promise<{ written: number; stayed: string[] }> {
  const using = await leaguesUsing(pool, id);
  let written = 0;
  const stayed: string[] = [];
  for (const l of using?.following ?? []) {
    try {
      let out: Awaited<ReturnType<typeof syncLeagueRulebook>> | null = null;
      await withLeagueLock(l.id, async (s, client) => {
        out = await syncLeagueRulebook(client, l.id, s.settings as never);
      });
      const r = out as unknown as Awaited<ReturnType<typeof syncLeagueRulebook>>;
      if (r.written) written++;
      else if (r.mismatch || r.reason) stayed.push(`${l.name}: ${r.mismatch ?? r.reason}`);
    } catch (e) {
      stayed.push(`${l.name}: ${e instanceof Error ? e.message : "couldn't be updated"}`);
    }
  }
  return { written, stayed };
}

const refused = (problems: BlocksProblem[]) => new HttpError(400, problems.slice(0, 3).map((p) => p.message).join(" · ") || "That isn't a usable rulebook");

/**
 * Saves the edited blocks as a fix (from the premiere: folded in, every answer read again) or as the show changing from
 * an episode (an edit from there), then pushes it to every league following it and, where they play by it, rescores.
 */
export async function saveRulebook(
  user: SessionUser,
  id: string,
  body: { blocks?: unknown; kind?: unknown; fromEpisode?: unknown; summary?: unknown }
): Promise<{ page: DeskRulebook; push: { written: number; stayed: string[] }; restaged: number[] }> {
  const r = await row(id);
  const edits = await inForceEdits(pool, id);
  const now = blocksAt(r.blocks, edits, Infinity);
  const blocks = body.blocks as RulebookBlocks;
  if (!blocks || typeof blocks !== "object") throw new HttpError(400, "blocks required");
  const problems = blocksProblems(blocks);
  if (problems.length) throw refused(problems);
  const ops = diffBlocks(now, blocks);
  if (!ops.length) throw new HttpError(400, "Nothing changed");
  const summary = typeof body.summary === "string" && body.summary.trim() ? body.summary.trim().slice(0, 300) : opLines(ops, now, blocks).slice(0, 3).join(" · ");
  const season = await seasonOf(r);
  let from = 1;
  if (body.kind === "fix") {
    const base = applyOps(r.blocks, ops);
    const saved = await saveChain(pool, id, { blocks: base, userId: user.id });
    if (!saved) throw new HttpError(404, "Rulebook not found");
    if ("refused" in saved) throw refused(saved.refused);
    await logDesk(pool, { entity: "rulebook", entityId: id, action: "fix", text: `Fixed a mistake: ${summary}`, before: { version: r.version }, undo: { type: "rulebookBase", id, blocks: r.blocks }, userId: user.id });
    await reachCopies(id, { kind: "fix", ops, before: now, after: blocks }, user.id);
  } else if (body.kind === "show_changed") {
    const n = Number(body.fromEpisode);
    const last = Math.max(1, ...edits.map((e) => e.fromEpisode));
    if (!Number.isInteger(n) || n < 2) throw new HttpError(400, "The show changed from episode 2 or later; from the premiere is a fix");
    if (n < last) throw new HttpError(400, `There's a change from Episode ${last} already: this one starts there or later`);
    const { rows: made } = await pool.query(
      `INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, ops, summary, reach, source, base_version, created_by, approved_by, approved_at)
       VALUES ($1, 'show_changed', $2, 'in_force', $3::jsonb, $4, 'everyone', 'admin', $5, $6, $6, now()) RETURNING id`,
      [id, n, JSON.stringify(ops), summary, r.version, user.id]
    );
    const saved = await saveChain(pool, id, { userId: user.id });
    if (!saved || "refused" in saved) {
      await pool.query("DELETE FROM rulebook_edits WHERE id = $1", [made[0].id]);
      throw refused(saved && "refused" in saved ? saved.refused : []);
    }
    await logDesk(pool, { entity: "rulebook", entityId: id, action: "showChanged", text: `The show changed from Episode ${n}: ${summary}`, undo: { type: "rulebookEdit", id, editId: made[0].id, from: n }, userId: user.id });
    // A couch's own copy is asked first: Add it or Skip, from its Scoring rules.
    await reachCopies(id, { kind: "show_changed", editId: made[0].id }, user.id);
    from = n;
  } else throw new HttpError(400, "kind is fix or show_changed");
  const push = await pushRulebook(id);
  const restaged = season ? (await restageSeason(season.id, from, user.id)).episodes : [];
  return { page: await deskRulebook(id), push, restaged };
}

/** History's Undo of a fix (the blocks it replaced go back) or of a show change (the edit is withdrawn). */
export async function undoRulebook(userId: string, undo: { type: string; id: string; blocks?: RulebookBlocks; editId?: string; from?: number }): Promise<void> {
  const r = await row(undo.id);
  if (undo.type === "rulebookBase" && undo.blocks) {
    const saved = await saveChain(pool, undo.id, { blocks: undo.blocks, userId });
    if (!saved || "refused" in saved) throw new HttpError(409, "The rulebook has changed too much since to put that back");
    // The fix comes back out of the couches' copies the same way it went in.
    await reachCopies(undo.id, { kind: "fix", ops: diffBlocks(r.blocks, undo.blocks), before: r.blocks, after: undo.blocks }, userId);
  } else if (undo.type === "rulebookEdit" && undo.editId) {
    await pool.query("UPDATE rulebook_edits SET status = 'withdrawn', updated_at = now() WHERE id = $1", [undo.editId]);
    const saved = await saveChain(pool, undo.id, { userId });
    if (!saved || "refused" in saved) throw new HttpError(409, "Withdrawing that change would leave a later one with nothing to change");
    await reachCopies(undo.id, { kind: "withdrawn", editId: undo.editId }, userId);
  } else throw new HttpError(409, "That can't be undone here");
  await pushRulebook(undo.id);
  if (r.seasonId) await restageSeason(r.seasonId, undo.type === "rulebookEdit" ? (undo.from ?? 1) : 1, userId);
}

/** The season's leagues play by this rulebook (or go back to their show's format): each one under its lock. */
export async function setLive(user: SessionUser, id: string, live: unknown): Promise<{ page: DeskRulebook; push: { written: number; stayed: string[] } }> {
  if (typeof live !== "boolean") throw new HttpError(400, "live is true or false");
  const r = await row(id);
  if (r.ownerKind !== "season" || !r.seasonId) throw new HttpError(400, "Only a season's rulebook is played by its leagues");
  await pool.query("UPDATE show_seasons SET rulebook_live = $2 WHERE id = $1", [r.seasonId, live]);
  const push = await pushRulebook(id);
  await restageSeason(r.seasonId, 1, user.id);
  await logDesk(pool, {
    entity: "rulebook",
    entityId: id,
    action: "live",
    text: live ? `Leagues play by it now (${push.written} switched${push.stayed.length ? `, ${push.stayed.length} stayed on their show's rules` : ""})` : "Leagues went back to their show's rules",
    undo: { type: "live", id, live: !live },
    userId: user.id,
  });
  return { page: await deskRulebook(id), push };
}

export async function restoreLive(userId: string, id: string, live: boolean) {
  const r = await row(id);
  if (!r.seasonId) return;
  await pool.query("UPDATE show_seasons SET rulebook_live = $2 WHERE id = $1", [r.seasonId, live]);
  await pushRulebook(id);
  await restageSeason(r.seasonId, 1, userId);
}

/** When a phase started (or clear it): season data a person confirms. Its segments score from there. */
export async function confirmPhase(user: SessionUser, id: string, body: { phaseId?: unknown; episode?: unknown }): Promise<DeskRulebook> {
  const r = await row(id);
  const phaseId = String(body.phaseId ?? "");
  const episode = body.episode == null ? null : Number(body.episode);
  const before = r.phaseStarts[phaseId] ?? null;
  await writePhase(user.id, r, phaseId, episode);
  const phase = (r.blocks.season?.phases ?? []).find((p) => p.id === phaseId);
  await logDesk(pool, {
    entity: "rulebook",
    entityId: id,
    action: "phase",
    text: episode == null ? `Cleared when ${phase?.name ?? phaseId} started` : `${phase?.name ?? phaseId} started in Episode ${episode}`,
    undo: { type: "phase", id, phaseId, episode: before },
    userId: user.id,
  });
  return deskRulebook(id);
}

export async function writePhase(userId: string, r: Rulebook, phaseId: string, episode: number | null) {
  if (r.compiledSource === "blocks") {
    const starts = { ...r.phaseStarts };
    if (episode == null) delete starts[phaseId];
    else starts[phaseId] = episode;
    if (!(r.blocks.season?.phases ?? []).some((p) => p.id === phaseId)) throw new HttpError(404, "There's no such phase");
    if (episode != null && !(Number.isInteger(episode) && episode >= 1)) throw new HttpError(400, "The episode is a whole number from 1");
    const saved = await saveChain(pool, r.id, { phaseStarts: starts, userId });
    if (!saved || "refused" in saved) throw refused(saved && "refused" in saved ? saved.refused : []);
  } else {
    const saved = await setPhaseStart(pool, r.id, phaseId, episode);
    if (!saved || "refused" in saved) throw refused(saved && "refused" in saved ? saved.refused : []);
  }
  await pushRulebook(r.id);
  if (r.seasonId && episode != null) await restageSeason(r.seasonId, episode, userId);
}

/** Locked: only the desk changes it; couches' suggestions still reach the Inbox. */
export async function lockRulebook(user: SessionUser, id: string, locked: unknown): Promise<DeskRulebook> {
  if (typeof locked !== "boolean") throw new HttpError(400, "lock is true or false");
  await row(id);
  await pool.query("UPDATE rulebooks SET locked_at = CASE WHEN $2 THEN now() ELSE NULL END, locked_by = CASE WHEN $2 THEN $3 ELSE NULL END WHERE id = $1", [id, locked, user.id]);
  await logDesk(pool, { entity: "rulebook", entityId: id, action: locked ? "lock" : "unlock", text: locked ? "Locked: only the desk changes it" : "Unlocked", userId: user.id });
  return deskRulebook(id);
}

/** A copy in the library, as a starting point for new shows like it (desk-library.ts saveTemplate; step 10 part 3). */
export async function saveAsTemplate(user: SessionUser, id: string): Promise<{ id: string }> {
  await row(id);
  return saveTemplate(user, id);
}

/** The research prompt for Check for changes: the rulebook prompt with this rulebook, as it is now, as the starting point. */
export async function rulebookPrompt(id: string): Promise<{ prompt: string }> {
  const r = await row(id);
  const season = await seasonOf(r);
  const now = blocksAt(r.blocks, await inForceEdits(pool, id), Infinity);
  return { prompt: buildRulebookPrompt({ show: season?.show ?? r.name, season: season ? `season ${season.number}` : undefined, airing: !!season?.airing, template: now }) };
}

/** A pasted research answer, reviewed, and the changes it would make to the rulebook as it is now. Writes nothing. */
export async function reviewAnswer(id: string, answer: unknown) {
  const r = await row(id);
  if (typeof answer !== "string" || !answer.trim()) throw new HttpError(400, "Paste the AI's answer first");
  let parsed;
  try {
    parsed = parseRulebookAnswer(answer);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "That answer couldn't be read");
  }
  const { rows: cast } = r.seasonId ? await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [r.seasonId]) : { rows: [] as { name: string }[] };
  const now = blocksAt(r.blocks, await inForceEdits(pool, id), Infinity);
  const review = reviewRulebook(parsed, { castNames: cast.map((c) => c.name), keep: (now.customMoments ?? []).map((m) => m.label) });
  const ops = diffBlocks(now, review.blocks);
  return { ...review, lines: opLines(ops, now, review.blocks), changes: ops.length };
}

/** Settles a suggested fix: done (the admin fixed it) or dismissed. */
export async function settleSuggestion(user: SessionUser, id: string, body: { suggestion?: unknown; status?: unknown }): Promise<DeskRulebook> {
  if (body.status !== "done" && body.status !== "dismissed") throw new HttpError(400, "status is done or dismissed");
  const { rowCount } = await pool.query("UPDATE rulebook_suggestions SET status = $3, settled_by = $4, settled_at = now() WHERE id = $1 AND rulebook_id = $2 AND status = 'open'", [
    String(body.suggestion),
    id,
    body.status,
    user.id,
  ]);
  if (!rowCount) throw new HttpError(404, "That suggestion isn't open");
  return deskRulebook(id);
}

/**
 * "Something off? Suggest a fix", from How it works: what someone on a couch says the season's rulebook got wrong, for
 * the desk's Inbox. Anyone on a couch with the season; nothing changes until the admin fixes it.
 */
export async function suggestFix(user: SessionUser, seasonId: string, couchId: string | null, body: { about?: unknown; note?: unknown }): Promise<{ ok: true }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (couchId) await requireCouch(user, couchId);
  const about = String(body.about ?? "");
  if (!["segment", "wayOut", "scores", "other"].includes(about)) throw new HttpError(400, "Say what it's about");
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : "";
  if (!note) throw new HttpError(400, "Say what's off");
  const book = await ensureSeasonRulebook(pool, seasonId);
  if (!book) throw new HttpError(404, "Season not found");
  await pool.query("INSERT INTO rulebook_suggestions (rulebook_id, season_id, user_id, couch_id, about, note) VALUES ($1, $2, $3, $4, $5, $6)", [book.row.id, seasonId, user.id, couchId || null, about, note]);
  return { ok: true };
}
