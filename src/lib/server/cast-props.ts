// Cast properties on the server (docs/PLAN-cast-properties.md): which properties a season's people have (its rulebook's
// cast.properties) and each person's values and bio (season_cast.props, season_cast.bio). Read per request, never copied into a
// league's state, so every game on a season reads the one set of values the desk keeps (decided item 4).
import { castProperties, mainProperty, propertyPlural, withGender, type RulebookCastProperty } from "@/lib/game/formats/rulebook-schema.js";
import type { CastBio } from "@/lib/game/formats/cast-prompt";
import { pool } from "./db";

type Db = { query: typeof pool.query };

/** A season's cast properties: its rulebook's, then Gender, which every season has (the user, 2026-11-16). */
export async function seasonCastProperties(seasonId: string, db: Db = pool): Promise<RulebookCastProperty[]> {
  const { rows } = await db.query(
    "SELECT blocks->'cast' AS cast FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived' ORDER BY updated_at DESC LIMIT 1",
    [seasonId]
  );
  return withGender(castProperties({ cast: rows[0]?.cast ?? null } as never));
}

/** What a page needs to show a season's properties: each one's key, its names, its values, and which is shown under a name. */
export interface CastPropertyView {
  key: string;
  name: string;
  plural: string;
  values: string[] | null;
  /** Shown under a person's name. */
  main: boolean;
  of: string | null;
}

export function propertyViews(props: RulebookCastProperty[]): CastPropertyView[] {
  // The one shown under a name is the rulebook's own (Gender only when it marks it main): a crew's job, not their gender.
  const own = props.filter((p) => p.key !== "gender" || p.main);
  const main = own.length ? mainProperty({ cast: { properties: own } } as never) : null;
  return props.map((p) => ({ key: p.key, name: p.name, plural: propertyPlural(p), values: Array.isArray(p.values) ? [...p.values] : null, main: p === main, of: p.of ?? null }));
}

/**
 * Stamps a game's state with its season's cast properties, per read and never saved (db.ts leaves the keys out:
 * StatsLogic.stampedKeys): `castProps`, each castaway's values by their id (a sport's roster position as `position`), and
 * `castPropDefs`, the season's properties. Read from the season's cast through each castaway's link, so every game on the season
 * reads the one set the desk keeps. A game with nobody linked to a season's cast gets nothing.
 */
export async function stampCastProps<S extends { castaways?: { id: string; seasonCastId?: string | null }[] }>(state: S, db: Db = pool): Promise<S> {
  const st = state as S & { castProps?: Record<string, Record<string, string>>; castPropDefs?: CastPropertyView[] };
  const links = (state.castaways ?? []).filter((c) => c.seasonCastId);
  if (!links.length) return state;
  const { rows } = await db.query("SELECT id, season_id, props, role FROM season_cast WHERE id = ANY($1::uuid[])", [links.map((c) => c.seasonCastId)]);
  if (!rows.length) return state;
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const out: Record<string, Record<string, string>> = {};
  for (const c of links) {
    const r = byId.get(c.seasonCastId!);
    if (!r) continue;
    const p = propsOf(r.props);
    if (typeof r.role === "string" && r.role.trim() && !p.position) p.position = r.role.trim();
    if (Object.keys(p).length) out[c.id] = p;
  }
  st.castProps = out;
  st.castPropDefs = propertyViews(await seasonCastProperties(rows[0].season_id, db));
  return state;
}

/** A props column as read: only string values, by key. */
export function propsOf(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "string" && x.trim()).map(([k, x]) => [k, (x as string).trim()]));
}

/** A bio column as read, or null. */
export function bioOf(v: unknown): CastBio | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const b = v as Record<string, unknown>;
  const out: CastBio = {};
  for (const k of ["hometown", "residence", "occupation", "line", "source"] as const) if (typeof b[k] === "string" && (b[k] as string).trim()) out[k] = (b[k] as string).trim();
  if (Number.isInteger(b.age)) out.age = b.age as number;
  return Object.keys(out).some((k) => k !== "source") ? out : null;
}
