import { after } from "next/server";
import { pool } from "./db";
import { dueMoves } from "./due-moves";
import type { BackstageScope } from "./backstage";
import { sendPush } from "./push-core";
import { seasonInfo } from "./push-events";
import { seasonSchedules, upNext } from "./schedule";
import { COOLDOWN, KIND, remindMessage, splitDue, type OpenMove } from "./remind-moves";

// Backstage's "Remind everyone" (the home's Reminders card): on demand, one push to each person with a move still
// open in a game you run here, between the hourly job's own reminders (db/reminders.js: a day and two hours before an
// episode airs, which the hourly job sends on its own whether or not anyone taps this). Who's due and what it says is
// remind-moves.js; this is the read (how many, how many heard lately) and the send.
//
// Open means the app's own to-do (due-moves.ts): the same moves as Up next and the classic action bar, so a reminder
// never says something the app doesn't. Only moves in the games you run here, only people with an account (a seat with
// none has nobody to push), never your own.

export interface RemindPreview {
  /** The next episode to air on this season, if the schedule says. */
  next: { number: number; airAt: string | null } | null;
  /** People with a move still open in a game you run here (not you). */
  people: number;
  /** Of them, how many were reminded from here inside the cooldown (a tap now skips them). */
  recent: number;
  /** The cooldown, in hours. */
  cooldownHours: number;
}

export interface RemindResult extends RemindPreview {
  /** How many were pushed just now. */
  sent: number;
}

/** Each person's open moves in the scope's games (user id -> moves), the actor left out, everyone else's possibly empty. */
async function openMoves(scope: BackstageScope): Promise<Map<string, OpenMove[]>> {
  const leagueIds = scope.games.map((g) => g.leagueId);
  const { rows } = await pool.query("SELECT DISTINCT user_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND user_id IS NOT NULL AND player_id IS NOT NULL", [leagueIds]);
  const mine = new Set(leagueIds);
  const out = new Map<string, OpenMove[]>();
  for (const r of rows) {
    const userId = r.user_id as string;
    if (userId === scope.user.id) continue;
    const { items } = await dueMoves(userId);
    out.set(
      userId,
      items.filter((it) => mine.has(it.leagueId) && it.who === "you").map((it) => ({ leagueId: it.leagueId, leagueName: it.leagueName, text: it.text, href: it.href, episode: it.episode }))
    );
  }
  return out;
}

/** Who was reminded from here inside the cooldown, in any of the scope's games. */
async function recentlyReminded(scope: BackstageScope, now: Date): Promise<Set<string>> {
  const { rows } = await pool.query("SELECT DISTINCT user_id FROM reminder_log WHERE league_id = ANY($1::uuid[]) AND kind = $2 AND sent_at > $3", [
    scope.games.map((g) => g.leagueId),
    KIND,
    new Date(now.getTime() - COOLDOWN).toISOString(),
  ]);
  return new Set(rows.map((r) => r.user_id as string));
}

async function nextToAir(seasonId: string): Promise<RemindPreview["next"]> {
  const schedule = (await seasonSchedules([seasonId])).get(seasonId);
  const coming = upNext(schedule);
  if (!coming) return null;
  if (!coming.live) return { number: coming.number, airAt: coming.airAt };
  return { number: coming.number + 1, airAt: schedule?.episodes.find((e) => e.number === coming.number + 1)?.airAt ?? null };
}

/** The card's read: how many have a move open, how many of them heard lately. */
export async function remindPreview(scope: BackstageScope, now = new Date()): Promise<RemindPreview> {
  const [moves, recent, next] = await Promise.all([openMoves(scope), recentlyReminded(scope, now), nextToAir(scope.seasonId)]);
  const { due, skipped } = splitDue(moves, recent, scope.user.id);
  return { next, people: due.length + skipped.length, recent: skipped.length, cooldownHours: COOLDOWN / 3_600_000 };
}

/**
 * The tap: record one row per (person, game) in reminder_log first, then push each person once with every game's
 * moves (after the response, as every push is). Someone reminded from here inside the cooldown is skipped; the
 * result says how many went, and the card's read as it stands after.
 */
export async function remindNow(scope: BackstageScope, now = new Date()): Promise<RemindResult> {
  const [moves, recent, next, season] = await Promise.all([openMoves(scope), recentlyReminded(scope, now), nextToAir(scope.seasonId), seasonInfo(scope.seasonId)]);
  const { due, skipped } = splitDue(moves, recent, scope.user.id);
  const { rows: me } = await pool.query(`SELECT username FROM "user" WHERE id = $1`, [scope.user.id]);
  const byName = (me[0]?.username as string | undefined) || "Whoever runs your game";
  const label = season?.label ?? scope.games[0]?.name ?? "Your show";
  const pushes: { userId: string; message: NonNullable<ReturnType<typeof remindMessage>> }[] = [];
  for (const userId of due) {
    const items = moves.get(userId) ?? [];
    const message = remindMessage(items, { id: scope.seasonId, label }, next, byName, now);
    if (!message) continue;
    // Record first, push only what was recorded: two taps at once can't send twice.
    let recorded = 0;
    for (const leagueId of new Set(items.map((it) => it.leagueId))) {
      const episode = items.find((it) => it.leagueId === leagueId && Number.isInteger(it.episode))?.episode ?? 0;
      const { rowCount } = await pool.query(
        "INSERT INTO reminder_log (user_id, league_id, kind, episode_number, reminder_window, sent_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
        [userId, leagueId, KIND, episode, now.toISOString(), now.toISOString()]
      );
      recorded += rowCount ?? 0;
    }
    if (recorded) pushes.push({ userId, message });
  }
  if (pushes.length) {
    after(async () => {
      for (const p of pushes) await sendPush(pool, [p.userId], "reminder", p.message, { seasonId: scope.seasonId });
    });
  }
  return { next, people: due.length + skipped.length, recent: skipped.length + pushes.length, cooldownHours: COOLDOWN / 3_600_000, sent: pushes.length };
}
