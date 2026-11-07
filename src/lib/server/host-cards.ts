import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// A rotating host's questions (docs/PLAN-start-a-game-gpt.md step A14 part 6; game-spec schema.js's card.from 'host'): each episode's
// host writes the card's lines in host_cards (0212) while they can, never in the league's state (every route sends it whole). Once
// the host's time is up (StateLogic.HostLogic.closed: the spec's hours before the episode airs, or when it locks or has results), the
// first read or write files what the card plays (HostLogic.file: the host's lines, if whoever wrote them still hosts it by the data,
// else the fallback), in order, each filing read by the next one's host (the turn goes on from it), and stamps every filed one on its
// episode (`episode.cardChoice`: { moments, host, how } or { fallback: true, host, how }), so the card's questions read it on the
// server and in the browser alike, as a card the bot chooses is read. An episode still being written carries no stamp. A game with
// no host costs no query. A league at its own pace (its seats at different weeks, on a season that's aired) files nothing: every
// episode plays the fallback, stamped as it reads, and nobody writes.
//
// Read with the caller's `db`, in a savepoint inside a write, as twists.ts is. Errors are returned as data (air-times.ts imports this
// module, and db.ts imports air-times.ts): the route throws them.

type Queryable = Pool | PoolClient;
export type HostRow = { episode: number; playerId: string | null; moments: string[]; filed: boolean; how: "host" | "fallback" | null };

const rowOf = (r: { episode: number; player_id: string | null; moments: string[] | null; filed: boolean; how: HostRow["how"] }): HostRow => ({
  episode: r.episode,
  playerId: r.player_id,
  moments: r.moments ?? [],
  filed: r.filed,
  how: r.how,
});

export async function readHostCards(db: Queryable, leagueId: string): Promise<Map<number, HostRow>> {
  const { rows } = await db.query("SELECT episode, player_id, moments, filed, how FROM host_cards WHERE league_id = $1", [leagueId]);
  return new Map(rows.map((r) => [r.episode as number, rowOf(r)]));
}

/** An episode's stamp for a filed row. */
const stampOf = (row: HostRow) =>
  row.how === "host" ? { moments: [...row.moments], host: row.playerId, how: "host" as const } : { fallback: true as const, host: row.playerId, how: "fallback" as const };

/** Files each episode whose host's time is up (once), and stamps every filed one on the league's episodes (else takes the stamp off).
 *  A failure is logged and leaves the stamps it had. Without a league to name, nothing changes. */
export async function stampHostCards(db: Queryable, state: LeagueState, leagueId?: string, now = Date.now()): Promise<void> {
  const H = StateLogic.HostLogic;
  // Any other game's cardChoice is a card the bot chooses (card-choices.ts), or nothing: not this module's.
  if (!H.of(state)) return;
  const before = new Map(state.episodes.map((ep) => [ep.number, ep.cardChoice ? structuredClone(ep.cardChoice) : null]));
  const plays = new Set(H.episodes(state));
  const clear = () => state.episodes.forEach((ep) => { if (!plays.has(ep.number)) delete ep.cardChoice; });
  if (StateLogic.RevealLogic.isCatchingUp(state)) {
    clear();
    plays.forEach((n) => { state.episodes.find((e) => e.number === n)!.cardChoice = { fallback: true, host: null, how: "fallback" }; });
    return;
  }
  if (!leagueId) return;
  const inWrite = "release" in db && typeof db.release === "function";
  try {
    if (inWrite) await db.query("SAVEPOINT host_cards");
    const rows = await readHostCards(db, leagueId);
    for (const n of [...plays].sort((a, b) => a - b)) {
      const ep = state.episodes.find((e) => e.number === n)!;
      let row = rows.get(n);
      const choice = row && row.playerId ? { playerId: row.playerId, moments: row.moments } : null;
      if (!row?.filed && H.closed(state, n, now, choice)) {
        const f = H.file(state, n, choice);
        // Filed only from the row as read: lines the host wrote since (an episode locked early, before its deadline) leave it unfiled
        // for the next read, never overwritten by a stale filing (the code review's).
        await db.query(
          `INSERT INTO host_cards (league_id, episode, player_id, moments, filed, how) VALUES ($1, $2, $3, $4, true, $5)
           ON CONFLICT (league_id, episode) DO UPDATE SET player_id = $3, moments = $4, filed = true, how = $5, updated_at = now()
           WHERE host_cards.filed = false AND host_cards.player_id IS NOT DISTINCT FROM $6 AND host_cards.moments = $7::text[]`,
          [leagueId, n, f.host, "moments" in f ? f.moments : [], f.how, row?.playerId ?? null, row?.moments ?? []]
        );
        const { rows: back } = await db.query("SELECT episode, player_id, moments, filed, how FROM host_cards WHERE league_id = $1 AND episode = $2", [leagueId, n]);
        row = back[0] ? rowOf(back[0]) : undefined;
      }
      // Stamped as it goes, so the next one's host reads it (put back as it was below if anything fails).
      if (row?.filed) ep.cardChoice = stampOf(row);
      else delete ep.cardChoice;
    }
    if (inWrite) await db.query("RELEASE SAVEPOINT host_cards");
    clear();
  } catch (e) {
    if (inWrite) await db.query("ROLLBACK TO SAVEPOINT host_cards").catch(() => {});
    console.error("[host-cards] couldn't file or stamp the game's host cards:", e);
    before.forEach((c, n) => {
      const ep = state.episodes.find((e) => e.number === n);
      if (!ep) return;
      if (c) ep.cardChoice = c;
      else delete ep.cardChoice;
    });
  }
}

/** The episode whose card is being written now (the first the card plays that isn't filed and whose host still has time), or null. */
export function openEpisode(state: LeagueState, rows: Map<number, HostRow>, now = Date.now()): number | null {
  const H = StateLogic.HostLogic;
  if (StateLogic.RevealLogic.isCatchingUp(state)) return null;
  for (const n of H.episodes(state)) {
    const row = rows.get(n);
    if (row?.filed || H.closed(state, n, now, row && row.playerId ? { playerId: row.playerId, moments: row.moments } : null)) continue;
    return n;
  }
  return null;
}

export type Written = { episode: number; moments: string[] } | { status: 400 | 409; error: string };
/** A seat's lines for the open episode's card (state: as readyLeague stamped it, so the episodes before are filed), in their order;
 *  none takes them back. The episode, or why not (a game with no host, a moment not on the card's list or named twice, too many,
 *  nothing open, a seat that doesn't host it, its time up). */
export async function writeHostCard(db: Queryable, leagueId: string, state: LeagueState, playerId: string, moments: unknown, rows?: Map<number, HostRow>, now = Date.now()): Promise<Written> {
  const H = StateLogic.HostLogic;
  const cfg = H.of(state);
  if (!cfg) return { status: 409, error: "This game has no host" };
  if (!Array.isArray(moments) || !moments.every((m) => typeof m === "string")) return { status: 400, error: "Send the moments as a list of their ids" };
  const ids = moments as string[];
  const bad = ids.find((m) => !cfg.of.includes(m));
  if (bad !== undefined) return { status: 400, error: `"${bad}" isn't one of the moments the card is chosen from` };
  if (new Set(ids).size !== ids.length) return { status: 400, error: "A moment is on the card twice" };
  if (ids.length > cfg.each) return { status: 400, error: `The card has ${cfg.each} ${cfg.each === 1 ? "moment" : "moments"}: choose up to ${cfg.each}` };
  const n = openEpisode(state, rows ?? (await readHostCards(db, leagueId)), now);
  if (n === null) return { status: 409, error: "There's no card to choose right now" };
  const host = H.hostAt(state, n);
  if (host !== playerId) {
    const name = (state.players ?? []).find((p) => p.id === host)?.name;
    return { status: 409, error: name ? `It's ${name}'s turn to choose Episode ${n}'s card` : `You don't host Episode ${n}` };
  }
  // The close in the statement too, so lines that reach it after the host's time is up never land (no read may have filed it yet).
  const closes = H.closesAt(state, n);
  const at = closes === null ? null : new Date(closes).toISOString();
  if (!ids.length) {
    await db.query(
      "DELETE FROM host_cards WHERE league_id = $1 AND episode = $2 AND filed = false AND ($3::timestamptz IS NULL OR now() < $3::timestamptz)",
      [leagueId, n, at]
    );
    return { episode: n, moments: [] };
  }
  const { rowCount } = await db.query(
    `INSERT INTO host_cards (league_id, episode, player_id, moments) SELECT $1, $2, $3, $4 WHERE $5::timestamptz IS NULL OR now() < $5::timestamptz
     ON CONFLICT (league_id, episode) DO UPDATE SET player_id = $3, moments = $4, updated_at = now()
     WHERE host_cards.filed = false AND ($5::timestamptz IS NULL OR now() < $5::timestamptz)`,
    [leagueId, n, playerId, ids, at]
  );
  if (!rowCount) return { status: 409, error: `Episode ${n}'s card is already out` };
  return { episode: n, moments: ids };
}
