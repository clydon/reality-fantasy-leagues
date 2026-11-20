import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/http-error";
import { pool } from "@/lib/server/db";
import { startPreview } from "@/lib/server/previews";

// Make a game's preview now (docs/PLAN-game-preview.md, "On demand"; src/lib/server/preview-live.ts): a made-up season played on the
// server and each of its moments written as a temporary copy of the game, for the story to show live. In development only. The first
// moment answers, with a way into its story used once; the rest are written after the response, inside this route's time.
export const maxDuration = 120;

/** The first slice's gallery games, by the development page's names (the gallery's Preview button sends any game: step 15). */
const GAMES: Record<string, { base: string; changes?: unknown[] }> = { fantasy: { base: "fantasy", changes: ["redraft"] }, sheet: { base: "sheet" }, pool: { base: "pool" } };

export const POST = apiRoute(async (req) => {
  // The development page's only (step 13's review): the gallery asks through /api/previews, and the service only through make.
  if (process.env.NODE_ENV === "production") throw new HttpError(404, "Not found");
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { game?: unknown; season?: unknown; couch?: unknown };
  if (typeof body.game !== "string") throw new HttpError(400, "Which game?");
  // The first slice's names, else any gallery game by its base's id (the season's own check says whether it plays).
  const game = GAMES[body.game] ?? (/^[a-z][a-z0-9]{1,30}$/.test(body.game) ? { base: body.game } : null);
  if (!game) throw new HttpError(400, "No such game to preview");
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  // The season: the one asked for, else Survivor 51 in this database (the first slice's).
  const season = str(body.season) ?? (await pool.query(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'survivor' AND ss.season_number = 51`)).rows[0]?.id;
  if (!season) throw new HttpError(422, "No Survivor 51 in this database");
  // Through the app's own half (src/lib/server/previews.ts), as the gallery's button will be; its last card goes back home.
  const origin = new URL(req.url).origin;
  return NextResponse.json(await startPreview(user, { seasonId: season, couchId: str(body.couch) ?? null, game, exits: { back: `${origin}/home`, create: `${origin}/home` }, origin }));
});
