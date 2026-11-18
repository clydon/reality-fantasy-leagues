import { recipeKey, recipeOf } from "@/lib/game/saved-recipe";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool } from "./db";

// Saved games (docs/PLAN-start-a-game-redo.md B1; migration 0442_saved_games): the heart beside Start keeps a game's recipe on the
// account. GET lists yours, newest first; a save is the recipe (its base, its rules without their dates, the length it was saved
// with), keyed by the recipe itself, so the same game saved twice is one save and a changed game is another; taking one off is by
// its key. Re-fitting a recipe to the season it's opened on is the phone's (gallery-bold/saved.ts savedRows), checked by our engine.

export interface SavedGame {
  key: string;
  name: string;
  base: string;
  spec: Record<string, unknown>;
  length: "one" | "few" | "season";
  from: "base" | "community" | "describe" | "saved" | "again";
  savedAt: string;
  /** The season it was saved on, by its label. */
  on: string;
}

/** At most this many saves a person (the oldest go past it). */
export const MAX_SAVED = 200;
const LENGTHS = new Set(["one", "few", "season"]);
const FROM = new Set(["base", "community", "describe", "saved", "again"]);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export async function savedGames(user: SessionUser): Promise<SavedGame[]> {
  const { rows } = await pool.query(
    "SELECT key, name, base, spec, length, made_from, saved_on, created_at FROM saved_games WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [user.id, MAX_SAVED]
  );
  return rows.map((r) => ({ key: r.key, name: r.name, base: r.base, spec: r.spec, length: r.length, from: r.made_from, savedAt: new Date(r.created_at).toISOString(), on: r.saved_on }));
}

/** Save one (or several: a browser's saves from before the account kept them). Saving one already there changes nothing. */
export async function saveGames(user: SessionUser, body: unknown): Promise<SavedGame[]> {
  const list = isObj(body) && Array.isArray(body.games) ? body.games : [body];
  if (!list.length || list.length > 50) throw new HttpError(400, "Save one game, or up to 50");
  for (const g of list) {
    if (!isObj(g)) throw new HttpError(400, "A saved game: { base, name, spec, length }");
    const base = typeof g.base === "string" && /^[a-z0-9-]{1,40}$/.test(g.base) ? g.base : null;
    if (!base) throw new HttpError(400, "base: the gallery's game it was made from");
    if (!isObj(g.spec)) throw new HttpError(400, "spec: the game's rules");
    const spec = recipeOf(g.spec);
    const text = JSON.stringify(spec);
    if (text.length > 60_000) throw new HttpError(413, "That game's rules are too long to save");
    const name = typeof g.name === "string" && g.name.trim() ? g.name.trim().slice(0, 60) : "A game";
    const length = typeof g.length === "string" && LENGTHS.has(g.length) ? g.length : "season";
    const from = typeof g.from === "string" && FROM.has(g.from) ? g.from : "base";
    const on = typeof g.on === "string" ? g.on.slice(0, 80) : "";
    const seasonId = typeof g.seasonId === "string" && isUuid(g.seasonId) ? g.seasonId : null;
    await pool.query(
      `INSERT INTO saved_games (user_id, key, base, name, spec, length, made_from, saved_on, season_id)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, (SELECT id FROM show_seasons WHERE id = $9)
       ON CONFLICT (user_id, key) DO NOTHING`,
      [user.id, recipeKey(base, spec), base, name, text, length, from, on, seasonId]
    );
  }
  // Past the cap, the oldest go.
  await pool.query(
    `DELETE FROM saved_games WHERE user_id = $1 AND id NOT IN (SELECT id FROM saved_games WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2)`,
    [user.id, MAX_SAVED]
  );
  return savedGames(user);
}

/** Take one off your saved games, by its key. */
export async function unsaveGame(user: SessionUser, key: unknown): Promise<SavedGame[]> {
  if (typeof key !== "string" || !key || key.length > 70_000) throw new HttpError(400, "Which saved game?");
  await pool.query("DELETE FROM saved_games WHERE user_id = $1 AND key = $2", [user.id, key]);
  return savedGames(user);
}
