import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { genJoinCode, slugify } from "@/lib/server/league-codes";

// Port of SurvivorDraft's server/routes/leagues.js POST / -- the creator becomes commissioner
// and the first drafting player, same as that route.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name) throw new HttpError(400, "League name required");

  const state = StateLogic.defaultState();
  // Born with episode 1 ready to bet on -- see EpisodeLogic.ensureNextEpisode.
  StateLogic.ensureNextEpisode(state);
  const creator = StateLogic.addPlayer(state, (user as { username?: string | null }).username || user.name);

  let league: { id: string; name: string; join_code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !league; attempt++) {
    const joinCode = genJoinCode();
    try {
      const { rows } = await pool.query(
        "INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, join_code",
        [name, slugify(name), joinCode, JSON.stringify(state), user.id]
      );
      league = rows[0];
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e; // join_code collision, retry
    }
  }
  if (!league) throw new HttpError(500, "Could not generate a unique join code, try again");

  await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1,$2,$3,'commissioner')", [
    league.id,
    user.id,
    creator.id,
  ]);

  return NextResponse.json({ league, state });
});
