import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// The top scorer's twist (docs/PLAN-start-a-game-gpt.md step A14 part 5; game-spec schema.js's score.twist): each episode's choice
// lives in twist_choices (0211) while it's open, never in the league's state (every route sends it whole). Once an episode's choice
// closes (StateLogic.TwistLogic.closed: the spec's hours before it airs, or when it locks or has results; at once at your own pace),
// the first read or write files what it plays (TwistLogic.file: the choice, if whoever made it still chooses by the data, else the
// spec's fallback), in order, each filing read by the next one's chooser (a twist changes that episode's points), and stamps every
// filed one on its episode (`episode.twist`: { id, by, how }), so the scoring reads it on the server and in the browser alike. An
// episode still open carries no stamp. A game with no twist costs no query (a stale stamp is only taken off). A league at its own
// pace (catching up: its seats at different weeks, so nobody's the top scorer for all of them) files nothing: each episode after its
// first plays the fallback, stamped as it reads, and nothing is open to choose.
//
// Read with the caller's `db`, in a savepoint inside a write, as secret-roles.ts is.

type Queryable = Pool | PoolClient;
export type TwistRow = { episode: number; playerId: string | null; twist: string | null; filed: boolean; how: "chosen" | "fallback" | null };

export async function readTwists(db: Queryable, leagueId: string): Promise<Map<number, TwistRow>> {
  const { rows } = await db.query("SELECT episode, player_id, twist, filed, how FROM twist_choices WHERE league_id = $1", [leagueId]);
  return new Map(rows.map((r) => [r.episode as number, { episode: r.episode, playerId: r.player_id, twist: r.twist, filed: r.filed, how: r.how }]));
}

/** Files each closed episode's twist (once), and stamps every filed one on the league's episodes (else takes the stamp off). A
 *  failure is logged and leaves the stamps it had. Without a league to name, nothing changes. */
export async function stampTwists(db: Queryable, state: LeagueState, leagueId?: string, now = Date.now()): Promise<void> {
  const T = StateLogic.TwistLogic;
  if (!T.of(state)) {
    state.episodes?.forEach((ep) => delete ep.twist);
    return;
  }
  const before = new Map(state.episodes.map((ep) => [ep.number, ep.twist ? { ...ep.twist } : null]));
  const plays = new Set(T.episodes(state));
  const clear = () => state.episodes.forEach((ep) => { if (!plays.has(ep.number)) delete ep.twist; });
  if (StateLogic.RevealLogic.isCatchingUp(state)) {
    clear();
    const fb = T.file(state, 0, null, []);
    plays.forEach((n) => { state.episodes.find((e) => e.number === n)!.twist = { ...fb }; });
    return;
  }
  if (!leagueId) return;
  const inWrite = "release" in db && typeof db.release === "function";
  try {
    if (inWrite) await db.query("SAVEPOINT twists");
    const rows = await readTwists(db, leagueId);
    let series: unknown[] | undefined;
    for (const n of [...plays].sort((a, b) => a - b)) {
      const ep = state.episodes.find((e) => e.number === n)!;
      let row = rows.get(n);
      if (!row?.filed && T.closed(state, n, now)) {
        // Who chooses, only for a choice made: the walk's series through the episodes before it, twists stamped so far included
        // (worked out again after a filing that changes points). Without a choice it's the fallback, whoever would have chosen.
        const choice = row && row.playerId && row.twist ? { playerId: row.playerId, twist: row.twist } : null;
        if (choice) series ??= StateLogic.ScoringLogic.walk(state, { series: true }).series;
        const f = T.file(state, n, choice, choice ? series : []);
        await db.query(
          `INSERT INTO twist_choices (league_id, episode, player_id, twist, filed, how) VALUES ($1, $2, $3, $4, true, $5)
           ON CONFLICT (league_id, episode) DO UPDATE SET player_id = $3, twist = $4, filed = true, how = $5, updated_at = now()
           WHERE twist_choices.filed = false`,
          [leagueId, n, f.by, f.id, f.how]
        );
        const { rows: back } = await db.query("SELECT episode, player_id, twist, filed, how FROM twist_choices WHERE league_id = $1 AND episode = $2", [leagueId, n]);
        const r = back[0];
        row = r ? { episode: r.episode, playerId: r.player_id, twist: r.twist, filed: r.filed, how: r.how } : undefined;
        if (row?.twist) series = undefined;
      }
      // Stamped as it goes, so the next one's chooser reads it (put back as it was below if anything fails).
      if (row?.filed) ep.twist = { id: row.twist, by: row.playerId, how: row.how ?? "fallback" };
      else delete ep.twist;
    }
    if (inWrite) await db.query("RELEASE SAVEPOINT twists");
    clear();
  } catch (e) {
    if (inWrite) await db.query("ROLLBACK TO SAVEPOINT twists").catch(() => {});
    console.error("[twists] couldn't file or stamp the game's twists:", e);
    // The stamps the state carried before this read, as saved: nothing filed here stands, so nothing of it stays on the state.
    before.forEach((t, n) => {
      const ep = state.episodes.find((e) => e.number === n);
      if (!ep) return;
      if (t) ep.twist = t;
      else delete ep.twist;
    });
  }
}

/** The episode whose twist is being chosen now (the first the game plays that hasn't closed and isn't filed), or null. */
export function openEpisode(state: LeagueState, rows: Map<number, TwistRow>, now = Date.now()): number | null {
  const T = StateLogic.TwistLogic;
  // At your own pace nothing's chosen (stampTwists).
  if (StateLogic.RevealLogic.isCatchingUp(state)) return null;
  for (const n of T.episodes(state)) {
    if (rows.get(n)?.filed || T.closed(state, n, now)) continue;
    return n;
  }
  return null;
}

export type Chosen = { episode: number } | { status: 400 | 409; error: string };
/** A seat's choice of the open episode's twist (state: as readyLeague stamped it, so the episodes before are filed): the episode, or
 *  why not (a game with no twist, nothing open, a seat that doesn't choose it, a twist the game doesn't offer, already set). */
export async function chooseTwist(db: Queryable, leagueId: string, state: LeagueState, playerId: string, twistId: string, rows?: Map<number, TwistRow>, now = Date.now()): Promise<Chosen> {
  const T = StateLogic.TwistLogic;
  const cfg = T.of(state);
  if (!cfg) return { status: 409, error: "This game has no twist to choose" };
  if (!cfg.of.some((x) => x.id === twistId)) return { status: 400, error: "That isn't one of this game's twists" };
  const n = openEpisode(state, rows ?? (await readTwists(db, leagueId)), now);
  if (n === null) return { status: 409, error: "There's no twist to choose right now" };
  const who = T.chooserAt(state, n);
  if (who.playerId !== playerId) return { status: 409, error: who.playerId === null && who.why === "waiting" ? `Episode ${n - 1}'s results aren't final yet: the twist is chosen once they are` : `You don't choose Episode ${n}'s twist` };
  // The close in the statement too, so a choice that reaches it after the close never lands (no read may have filed it yet).
  const closes = T.closesAt(state, n);
  const at = closes === null ? null : new Date(closes).toISOString();
  const { rowCount } = await db.query(
    `INSERT INTO twist_choices (league_id, episode, player_id, twist) SELECT $1, $2, $3, $4 WHERE $5::timestamptz IS NULL OR now() < $5::timestamptz
     ON CONFLICT (league_id, episode) DO UPDATE SET player_id = $3, twist = $4, updated_at = now()
     WHERE twist_choices.filed = false AND ($5::timestamptz IS NULL OR now() < $5::timestamptz)`,
    [leagueId, n, playerId, twistId, at]
  );
  if (!rowCount) return { status: 409, error: `Episode ${n}'s twist is already set` };
  return { episode: n };
}
