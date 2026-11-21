import type { Spec } from "@/lib/game/start-gallery/index.js";
import type { WizardOptions } from "../../data";
import type { Span } from "./model";

// Whose players a sport's game draws from (step 2.8's design round: docs/design-round/sports-scope-spec.md). The server limits a game
// on one team's season to that team's players, and one game of it to the two teams playing (src/lib/server/sports/scope.ts); the sheet
// does the same before Start, so it can say whose ("Bills players only · 74") as How long moves, and our check counts the smaller pool
// (an exclusive draft too big for one team's players is caught here, not refused after the tap). A matchup's own season (one game, a
// series, a rival's meetings) is its two teams already, so it's said but never limited; a league's slate is everyone, and says nothing.

export interface Whose {
  /** The teams it draws from, in the page's order: one (a team's season), or two. */
  teams: { id: string; name: string; short: string }[];
  /** Whether the sheet adds the limit to the spec (a team's season), or the season is those teams' already. */
  limit: boolean;
  /** How many players those teams have, or null while they're still being fetched. */
  count: number | null;
}

const lastWord = (name: string) => name.trim().split(/\s+/).pop() ?? name;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A game that picks players: a draft (an auction, a salary cap) or a pick of players. Pick'em, squares and questions don't. */
export function picksPlayers(spec: Spec | null): boolean {
  const get = spec && isObj(spec.get) ? spec.get : null;
  return !!get && (get.by === "draft" || get.by === "pick");
}

/** Whose players a game over `span` draws from on this page, or null (a show, a league's slate). */
export function whoseOf(o: WizardOptions, span: Span | null): Whose | null {
  const wz = o.wizard;
  if (!wz || !o.sport) return null;
  const pack = wz.page.pack;
  const ctx = wz.page.ctx;
  const named = new Map((ctx.teamList ?? pack.teams ?? []).map((t) => [String(t.id), t.name]));
  const team = (id: string) => ({ id, name: named.get(id) ?? id, short: lastWord(named.get(id) ?? id) });
  let ids: string[] | null = null;
  let limit = false;
  if (wz.scope?.team) {
    limit = true;
    // One game of the team's season: the two teams in it.
    const one = span && typeof span.from === "number" && span.to === span.from ? (pack.games ?? []).find((g) => g.episode === span.from) : null;
    ids = one && one.sides.length >= 2 ? one.sides.map((s) => String(s.id)) : [wz.scope.team];
  } else if ((pack.teams ?? []).length === 2 && !(pack.games ?? []).some((g, i, all) => all.findIndex((x) => x.episode === g.episode) !== i)) {
    // A matchup's season (one game, a series, a rival's meetings): its two teams, never a slate (several games an episode).
    ids = (pack.teams ?? []).map((t) => String(t.id));
  }
  if (!ids) return null;
  const pool = Array.isArray(ctx.poolOf) && ctx.poolOf.length ? ctx.poolOf : null;
  const count = wz.scope?.filling || !pool ? null : pool.filter((p) => p.team && ids!.includes(String(p.team))).length;
  return { teams: ids.map(team), limit, count };
}

/** "Bills players only", "Dolphins and Bills players". */
export function whoseWords(w: Whose): string {
  return w.teams.length === 1 ? `${w.teams[0].short} players only` : `${w.teams.map((t) => t.short).join(" and ")} players`;
}

/** "the Bills'", "the two teams'": whose players, as the size warning says it. */
export function whosePossessive(w: Whose): string {
  return w.teams.length === 1 ? `the ${w.teams[0].short}'` : "the two teams'";
}

/** `spec` with the scope's teams as its pool's limit, as the server sets it at Start: only a game that picks players on a team's
 *  season, and only when its maker hasn't limited it already. */
export function scoped(spec: Spec, w: Whose | null): Spec {
  if (!w || !w.limit || !picksPlayers(spec)) return spec;
  const pool = isObj(spec.pool) ? spec.pool : null;
  const where = pool && isObj(pool.where) ? pool.where : null;
  if (where && Array.isArray(where.teams)) return spec;
  return { ...spec, pool: { ...(pool ?? { of: "cast" }), where: { ...(where ?? {}), teams: w.teams.map((t) => t.id) } } } as Spec;
}

/** An exclusive draft that needs more players than the scope has: how many seats, each, and the pool; else null. */
export function tooSmall(spec: Spec, w: Whose | null, seats: number): { seats: number; each: number; pool: number } | null {
  if (!w || w.count === null || !picksPlayers(spec)) return null;
  const get = spec.get as { by?: string; each?: unknown; own?: string };
  if (get.by !== "draft" || get.own === "shared" || typeof get.each !== "number") return null;
  return seats * get.each > w.count ? { seats, each: get.each, pool: w.count } : null;
}

/** The base's sentence in the scope's words: a draft "from the two teams" on one team's season is "from the Bills". */
export function sayWhose(sentence: string, w: Whose | null): string {
  return w && w.teams.length === 1 ? sentence.replace(/from the two teams/g, `from the ${w.teams[0].short}`) : sentence;
}
