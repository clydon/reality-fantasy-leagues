import type { Pool, PoolClient } from "pg";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import type { RulebookBlocks, RulebookKind } from "@/lib/game/formats/rulebook-schema";
import type { LibraryTemplate, SeriesStart } from "@/lib/game/make-game";
import { inForceEdits } from "@db/rulebooks.js";
import { pool } from "./db";

// The library's templates as Make it a game reads them (docs/PLAN-new-design.md step 10 part 3; make-game.ts templateFor):
// every rulebook the desk keeps as a starting point for new shows (owner 'library', is_template), with the show families
// each is for. A template the desk saved from a season's rulebook carries the show it came from (provenance.shows), one
// earned by a shape carries the shape's examples too; a built-in's or a stored format's mirror is for its own name.

type Db = Pool | PoolClient;

export async function libraryTemplates(db: Db = pool): Promise<LibraryTemplate[]> {
  const { rows } = await db.query(
    `SELECT id, name, kind, blocks, compiled_source, provenance FROM rulebooks
      WHERE owner_kind = 'library' AND is_template AND status <> 'archived' AND blocks IS NOT NULL
      ORDER BY (compiled_source = 'blocks') DESC, updated_at DESC`
  );
  return rows.map((r) => {
    const shows = Array.isArray(r.provenance?.shows) ? (r.provenance.shows as unknown[]).filter((s): s is string => typeof s === "string") : [];
    return {
      id: r.id,
      name: r.name,
      kind: r.kind as RulebookKind,
      start: r.blocks?.start === "scripted" ? "scripted" : r.kind === "series" ? ("reality" as SeriesStart) : null,
      shows: shows.length ? shows : [r.name],
      saved: r.compiled_source === "blocks",
      blocks: r.blocks as RulebookBlocks,
    };
  });
}

/**
 * The same show's rulebook from another season (the newest made or edited from blocks: a legacy mirror only repeats the
 * show's format, and a show that isn't a game yet mirrors the default), as it reads now with every change folded in: the
 * nearest skeleton there is, and "same as last season" for a set-up show's next one. Null when there's none.
 */
export async function otherSeasonRulebook(db: Db, showId: string, seasonId: string): Promise<{ id: string; name: string; version: number; blocks: RulebookBlocks } | null> {
  const { rows } = await db.query(
    `SELECT r.id, r.name, r.version, r.blocks FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id
      WHERE ss.show_id = $1 AND ss.id <> $2 AND r.owner_kind = 'season' AND r.status <> 'archived' AND r.compiled_source = 'blocks' AND r.blocks IS NOT NULL
      ORDER BY ss.season_number DESC LIMIT 1`,
    [showId, seasonId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, version: r.version, blocks: blocksAt(r.blocks, await inForceEdits(db, r.id), Infinity) as RulebookBlocks };
}
