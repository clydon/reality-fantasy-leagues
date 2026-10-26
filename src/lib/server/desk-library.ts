import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { DECIDED_TAG, KINDS, type RulebookBlocks, type RulebookKind } from "@/lib/game/formats/rulebook-schema.js";
import { SHAPES, sameFamily, shapeById, type ShapeId } from "@/lib/game/formats/rulebook-shapes.js";
import { getRulebook, inForceEdits, leaguesUsing } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { logDesk } from "./desk";

// The library on the desk (docs/PLAN-new-design.md step 10 part 3; rulebooks phase 8; PLAN-rulebooks-implementation.md 7.9):
// the rulebooks new shows start from, and every rulebook in use.
//
//   Start from   the templates, by kind of show: a built-in's or a stored format's mirror, one the desk saved from a season's
//                rulebook (Save as a starting point), a researched draft it made one, or a shape's. Make it a game's prompt
//                starts from the nearest (make-game.ts templateFor). The design plan's proposed shapes (rulebook-shapes.js)
//                are dashed until two real shows here fit one; then the desk can save one of them as the shape's template.
//   Drafts       researched rulebooks (src/lib/game/formats/library/) not yet offered as a starting point.
//   Made by players  rulebooks someone made with Make it a game: new until another couch checks it; the desk takes it over
//                (review_status 'reviewed'; its first maker stays its creator and its parent the template it started from).
//   In use       every season's rulebook, where it came from and who follows it.

export interface LibraryTemplateCard {
  id: string;
  name: string;
  kind: RulebookKind;
  /** The shows it plays like: the seasons made from it, or the shows it was saved for. */
  like: string[];
  /** Who decides its segments, as tags ("Contest", "Vote"). */
  tags: string[];
  /** Saved by the desk from a rulebook's blocks (else a built-in's or a stored format's mirror). */
  saved: boolean;
  shape: ShapeId | null;
}

export interface ProposedShape {
  id: ShapeId;
  kind: RulebookKind;
  name: string;
  like: string[];
  line: string;
  /** Real shows here that play like it (none with a template of their own), each with the season rulebook it'd be saved from. */
  shows: { name: string; rulebookId: string }[];
}

export interface LibraryRow {
  id: string;
  name: string;
  kind: RulebookKind;
  line: string;
}

export interface MadeRow extends LibraryRow {
  review: "unreviewed" | "checked" | "reviewed";
}

export interface DeskLibrary {
  kinds: { kind: RulebookKind; name: string; templates: LibraryTemplateCard[]; proposed: ProposedShape[] }[];
  counts: { templates: number; proposed: number };
  drafts: LibraryRow[];
  made: MadeRow[];
  inUse: LibraryRow[];
}

// Who decides its segments, as tags. A competition with nothing contested is a stored format's mirror read back as blocks
// (display only, rulebook-from-format.js): no tags rather than a wrong "No contest".
const tagsOf = (blocks: RulebookBlocks | null, kind: RulebookKind): string[] => {
  const seen = [...new Set((blocks?.segments ?? []).map((s) => s?.decidedBy).filter((d): d is NonNullable<typeof d> => !!d && d !== "nobody"))];
  if (seen.length) return seen.map((d) => DECIDED_TAG[d as keyof typeof DECIDED_TAG] ?? d);
  return (blocks?.segments ?? []).length && kind !== "competition" ? [DECIDED_TAG.nobody] : [];
};
const showsOf = (provenance: Record<string, unknown> | null): string[] =>
  Array.isArray(provenance?.shows) ? (provenance!.shows as unknown[]).filter((s): s is string => typeof s === "string") : [];

/**
 * How a made rulebook reads: "Made with ChatGPT by alex · new, nobody's checked it", "· checked by another couch", "· taken
 * over by the desk", or the desk's own ("Made from ZT Yacht Life by the desk": a site admin made it, checked as it was made).
 */
export function madeLine(r: { via?: string | null; who?: string | null; template?: string | null; review: string; checks?: number; desk?: boolean }): string {
  const how = r.via === "template" ? `Made from ${r.template ?? "a template"}` : r.via === "paste" ? "Made with copy and paste" : "Made with ChatGPT";
  if (r.desk) return `${how} by the desk`;
  const state = r.review === "unreviewed" ? "new, nobody's checked it" : r.review === "checked" ? `checked by ${r.checks && r.checks > 1 ? `${r.checks} couches` : "another couch"}` : "taken over by the desk";
  return `${how}${r.who ? ` by ${r.who}` : ""} · ${state}`;
}

/** The season rulebooks in force, newest season first per show, as they read now. */
async function seasonBooks() {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.kind, r.blocks, r.provenance, r.review_status, r.parent_id, r.created_by, r.approved_by = r.created_by AS desk, s.id AS show_id, s.name AS show, ss.season_number,
            p.name AS parent_name, COALESCE(u.username, u.name) AS who, (SELECT count(*)::int FROM rulebook_checks k WHERE k.rulebook_id = r.id) AS checks
       FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id
       LEFT JOIN rulebooks p ON p.id::text = r.parent_id LEFT JOIN "user" u ON u.id = r.created_by
      WHERE r.owner_kind = 'season' AND r.status <> 'archived' AND s.archived = false
      ORDER BY s.name, ss.season_number DESC`
  );
  return rows;
}

export async function deskLibrary(): Promise<DeskLibrary> {
  const { rows: lib } = await pool.query(
    `SELECT id, name, kind, blocks, compiled_source, provenance, is_template, review_status, updated_at FROM rulebooks
      WHERE owner_kind = 'library' AND status <> 'archived' ORDER BY is_template DESC, (compiled_source = 'blocks') DESC, name`
  );
  const books = await seasonBooks();
  // The seasons made from each template (its "plays like").
  const madeFrom = new Map<string, Set<string>>();
  for (const b of books) if (b.parent_id) madeFrom.set(b.parent_id, (madeFrom.get(b.parent_id) ?? new Set()).add(b.show));
  const templates: LibraryTemplateCard[] = lib
    .filter((r) => r.is_template)
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      // Shows it plays like, other than its own name's (Survivor's template plays like Survivor, which says nothing).
      like: [...new Set([...showsOf(r.provenance), ...(madeFrom.get(r.id) ?? [])])].filter((s) => !sameFamily(s, r.name)).slice(0, 6),
      tags: tagsOf(r.blocks, r.kind),
      saved: r.compiled_source === "blocks",
      shape: (r.provenance?.shape as ShapeId | undefined) ?? null,
    }));
  // A show with a template of its own (by name, or saved for it) has its starting point already: it doesn't count toward a shape.
  const forShows = new Map(lib.filter((r) => r.is_template).map((r) => [r.id, [r.name, ...showsOf(r.provenance)]]));
  const covered = (show: string) => templates.some((t) => [...(forShows.get(t.id) ?? []), ...t.like].some((n) => sameFamily(n, show)));
  const newestByShow = new Map<string, (typeof books)[number]>();
  for (const b of books) if (!newestByShow.has(b.show_id)) newestByShow.set(b.show_id, b);
  const fitting = new Map<ShapeId, { name: string; rulebookId: string }[]>();
  for (const b of newestByShow.values()) {
    if (!b.blocks || covered(b.show)) continue;
    const now = blocksAt(b.blocks, await inForceEdits(pool, b.id), Infinity) as RulebookBlocks;
    for (const s of SHAPES) if (s.kind === (now.kind ?? b.kind) && s.fits(now)) fitting.set(s.id, [...(fitting.get(s.id) ?? []), { name: b.show, rulebookId: b.id }]);
  }
  const earned = new Set(templates.map((t) => t.shape).filter(Boolean));
  const proposed: ProposedShape[] = SHAPES.filter((s) => !earned.has(s.id)).map((s) => ({ id: s.id, kind: s.kind, name: s.name, like: s.like, line: s.line, shows: fitting.get(s.id) ?? [] }));
  const kinds = (Object.keys(KINDS) as RulebookKind[]).map((kind) => ({
    kind,
    name: KINDS[kind].name as string,
    templates: templates.filter((t) => t.kind === kind),
    proposed: proposed.filter((p) => p.kind === kind),
  }));

  const drafts: LibraryRow[] = lib
    .filter((r) => !r.is_template)
    .map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      line: r.provenance?.researched
        ? `Researched ${new Date(String(r.provenance.researched)).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · not a starting point yet`
        : "A draft · not a starting point yet",
    }));
  const made: MadeRow[] = books
    .filter((b) => b.provenance?.from === "made" && b.review_status !== "reviewed")
    .map((b) => ({ id: b.id, name: b.name, kind: b.kind, review: b.review_status, line: madeLine({ via: b.provenance?.via, who: b.who, template: b.parent_name, review: b.review_status, checks: b.checks }) }));
  const inUse: LibraryRow[] = [];
  for (const b of books) {
    const using = await leaguesUsing(pool, b.id);
    const following = using?.following.length ?? 0;
    const own = using?.ownCopies.length ?? 0;
    const from = b.provenance?.from === "made" ? madeLine({ via: b.provenance?.via, who: b.who, template: b.parent_name, review: b.review_status, checks: b.checks, desk: !!b.desk }) : b.parent_name ? `From ${b.parent_name}` : "Its own";
    inUse.push({ id: b.id, name: b.name, kind: b.kind, line: `${from} · ${following} ${following === 1 ? "league follows" : "leagues follow"} it${own ? ` · ${own} own ${own === 1 ? "copy" : "copies"}` : ""}` });
  }
  return { kinds, counts: { templates: templates.length, proposed: proposed.length }, drafts, made, inUse };
}

// ---------- changing the library ----------

/** A template's blocks: folded, the show's own name and tagline left blank (a starting point names no show). */
function blankBlocks(blocks: RulebookBlocks): RulebookBlocks {
  const b = JSON.parse(JSON.stringify(blocks)) as RulebookBlocks;
  delete b.show;
  delete b.tagline;
  delete b.derivedFrom;
  return b;
}

/**
 * Save as a starting point: a copy of a season's rulebook in the library, as it reads now (every change folded in), named
 * for its show (or for the shape it earns), for shows like it. Make it a game's prompt starts from it for a show of its
 * family, and for the kind (a series or a talk show) when it's the newest the desk saved.
 */
export async function saveTemplate(user: SessionUser, id: string, opts: { shape?: ShapeId } = {}): Promise<{ id: string }> {
  if (!isUuid(id)) throw new HttpError(404, "Rulebook not found");
  const r = await getRulebook(pool, id);
  if (!r || r.status === "archived" || !r.blocks) throw new HttpError(404, "Rulebook not found");
  const { rows } = r.seasonId ? await pool.query("SELECT s.name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [r.seasonId]) : { rows: [] };
  const show = (rows[0]?.name as string | undefined) ?? r.name;
  const shape = opts.shape ? shapeById(opts.shape) : null;
  if (opts.shape && !shape) throw new HttpError(400, "There's no such shape");
  const blocks = blankBlocks(blocksAt(r.blocks, await inForceEdits(pool, id), Infinity) as RulebookBlocks);
  if (shape && blocks.kind !== shape.kind) throw new HttpError(400, `${show} isn't ${KINDS[shape.kind].name.toLowerCase()}`);
  const { rows: made } = await pool.query(
    `INSERT INTO rulebooks (name, kind, owner_kind, is_template, status, parent_kind, parent_id, parent_version, reader, blocks, compiled, compiled_source, base, aliases,
                            phase_starts, provenance, review_status, created_by, approved_by, approved_at)
     VALUES ($1, $2, 'library', true, 'in_force', 'rulebook', $3, $4, $5, $6, $7, 'blocks', $8, $9, '{}'::jsonb, $10, 'approved', $11, $11, now()) RETURNING id`,
    [
      shape ? shape.name : show,
      blocks.kind ?? r.kind,
      id,
      r.version,
      r.reader,
      JSON.stringify(blocks),
      JSON.stringify(r.compiled),
      r.base ? JSON.stringify(r.base) : null,
      JSON.stringify(r.aliases ?? {}),
      JSON.stringify({ from: "rulebook", id, version: r.version, shows: shape ? [...new Set([show, ...shape.like])] : [show], ...(shape ? { shape: shape.id } : {}) }),
      user.id,
    ]
  );
  await logDesk(pool, { entity: "rulebook", entityId: id, action: "template", text: shape ? `Saved as the ${shape.name} starting point` : "Saved as a starting point for new shows", userId: user.id });
  await logDesk(pool, { entity: "rulebook", entityId: made[0].id, action: "made", text: `Saved from ${r.name}${shape ? `: ${shape.name}, now that two shows play like it` : ""}`, undo: { type: "templateRow", id: made[0].id, archive: true }, userId: user.id });
  return { id: made[0].id };
}

/** Earn a proposed shape: two real shows play like it, so one of their rulebooks becomes its template. */
export async function earnShape(user: SessionUser, body: { shape?: unknown; rulebook?: unknown }): Promise<{ id: string }> {
  const shape = shapeById(String(body.shape ?? ""));
  if (!shape) throw new HttpError(400, "Which shape?");
  const lib = await deskLibrary();
  const p = lib.kinds.flatMap((k) => k.proposed).find((x) => x.id === shape.id);
  if (!p) throw new HttpError(409, `${shape.name} is a starting point already`);
  if (p.shows.length < 2) throw new HttpError(409, `${shape.name} earns its place once two real shows play like it`);
  const from = p.shows.find((s) => s.rulebookId === body.rulebook) ?? p.shows[0];
  return saveTemplate(user, from.rulebookId, { shape: shape.id });
}

/** A library rulebook offered as a starting point, or not (`on`); its History can put it back. */
export async function setTemplate(user: SessionUser, id: string, on: unknown): Promise<void> {
  if (typeof on !== "boolean") throw new HttpError(400, "template is true or false");
  const r = await getRulebook(pool, id);
  if (!r || r.ownerKind !== "library" || r.status === "archived") throw new HttpError(404, "That isn't in the library");
  if (r.isTemplate === on) return;
  await pool.query(
    `UPDATE rulebooks SET is_template = $2, status = CASE WHEN $2 THEN 'in_force' ELSE status END,
            review_status = CASE WHEN $2 AND review_status = 'unreviewed' THEN 'approved' ELSE review_status END,
            approved_by = CASE WHEN $2 THEN $3 ELSE approved_by END, approved_at = CASE WHEN $2 THEN now() ELSE approved_at END, updated_at = now()
      WHERE id = $1`,
    [id, on, user.id]
  );
  await logDesk(pool, {
    entity: "rulebook",
    entityId: id,
    action: on ? "template" : "untemplate",
    text: on ? "Offered as a starting point for new shows" : "No longer offered as a starting point",
    undo: { type: "templateRow", id, template: !on, status: r.status, review: r.reviewStatus },
    userId: user.id,
  });
}

/** Deleted (archived) from the library: only one the desk saved or researched, and only while nothing is made from it. */
export async function deleteLibraryRulebook(user: SessionUser, id: string): Promise<void> {
  const r = await getRulebook(pool, id);
  if (!r || r.ownerKind !== "library" || r.status === "archived") throw new HttpError(404, "That isn't in the library");
  if (r.parentKind === "builtin" || r.parentKind === "show_format") throw new HttpError(409, `${r.name} mirrors a show's own rules: it stays`);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM rulebooks WHERE parent_kind = 'rulebook' AND parent_id = $1 AND status <> 'archived'", [id]);
  if (rows[0].n > 0) throw new HttpError(409, `${rows[0].n === 1 ? "A rulebook was" : `${rows[0].n} rulebooks were`} made from it: it stays`);
  await pool.query("UPDATE rulebooks SET status = 'archived', is_template = false, updated_at = now() WHERE id = $1", [id]);
  await logDesk(pool, { entity: "rulebook", entityId: id, action: "delete", text: `Deleted ${r.name} from the library`, undo: { type: "templateRow", id, template: r.isTemplate, status: r.status, review: r.reviewStatus }, userId: user.id });
}

/** History's Undo of a library change: the row's template flag, status and review put back (or archived, for one saved). */
export async function restoreTemplateRow(u: { id: string; archive?: boolean; template?: boolean; status?: string; review?: string }): Promise<void> {
  if (u.archive) {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM rulebooks WHERE parent_kind = 'rulebook' AND parent_id = $1 AND status <> 'archived'", [u.id]);
    if (rows[0].n > 0) throw new HttpError(409, "A rulebook was made from it since: it stays");
    await pool.query("UPDATE rulebooks SET status = 'archived', is_template = false, updated_at = now() WHERE id = $1", [u.id]);
    return;
  }
  await pool.query("UPDATE rulebooks SET is_template = $2, status = $3, review_status = $4, updated_at = now() WHERE id = $1", [u.id, !!u.template, u.status ?? "draft", u.review ?? "unreviewed"]);
}

/**
 * Take it over: a rulebook a player made with Make it a game becomes the desk's (review_status 'reviewed', approved_by and
 * approved_at). It stays the season's rulebook and its first maker stays its creator; How it works stops saying it's new.
 */
export async function takeOver(user: SessionUser, id: string): Promise<void> {
  const r = await getRulebook(pool, id);
  if (!r || r.status === "archived") throw new HttpError(404, "Rulebook not found");
  if (r.provenance?.from !== "made") throw new HttpError(409, "Only a rulebook someone made with Make it a game is taken over");
  if (r.reviewStatus === "reviewed") throw new HttpError(409, "The desk has it already");
  await pool.query("UPDATE rulebooks SET review_status = 'reviewed', approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1", [id, user.id]);
  await logDesk(pool, { entity: "rulebook", entityId: id, action: "takeOver", text: "Taken over by the desk: checked, and the desk's to change", undo: { type: "review", id, review: r.reviewStatus }, userId: user.id });
}

export async function restoreReview(u: { id: string; review?: string }): Promise<void> {
  const review = ["unreviewed", "checked"].includes(String(u.review)) ? String(u.review) : "unreviewed";
  await pool.query("UPDATE rulebooks SET review_status = $2, approved_by = NULL, approved_at = NULL, updated_at = now() WHERE id = $1", [u.id, review]);
}
