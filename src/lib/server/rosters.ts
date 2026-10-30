import { after } from "next/server";
import { showWords } from "@/lib/game/show-words";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { seenThrough } from "./guard";
import { statsView, type StatItem } from "@/lib/game/sports-stats";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { fillCastPhotos } from "./show-art";
import { sportsProviders } from "./sports";
import { castFromEvents, holdFill, releaseFill, type CastFill } from "./sports/cast";
import { fillLater, followSeason } from "./sports/season";
import { statsDue, statsFromEvents, statsLater } from "./sports/stats";

// Who's playing (db/migrations/0144): a sport's people, for its Players tab (show/roster.tsx). TV listings only list a sport's
// broadcasters, so they come from the sports data first (docs/PLAN-sports-data.md step 3, db/migrations/0149): once the season's
// episodes are linked to the provider's games (sports/link.ts), each team's players with their headshots and the provider's ids
// (sports/cast.ts), on their own: after someone adds the sport, in the daily listings job, and when this tab is read (linking the
// season first if nobody has yet), adding whoever's missing as more games are played. Only when the sports data hasn't got the
// season (or didn't answer) is it Fill in who's playing: the sports data asked once more, then one ask (our bot after the response,
// as Fill in what happened asks: episode-recaps.ts; else a pasted answer to the same prompt) for each team's players. Either way
// they're the season's cast (season_cast: the team its group, what they play its role), and only for a sport nobody's made a game
// of: a game's cast is Make it a game's and the desk's, and this never touches one. A roster isn't a spoiler (who's on a team is
// known before a game), so the tab shows it to anyone on the show; who played a game is, so someone a box score brought in
// (season_cast.shown_from: a team with no roster, AFL's on ESPN) shows once you've seen that game.
//
// Stats come from the sports data only (docs/PLAN-sports-data.md step 4, db/migrations/0150; never ChatGPT): each linked game's
// lines from its box score (sports/stats.ts, filled after the answer when a game's likely over or someone has no coming in yet),
// shown in two lines: so far, the games up to your mark (guard.ts) added up in the provider's own columns (sports-stats.ts reads
// which add from the values), and coming in, the season line from before these games began. Nothing past your mark is sent.

const ASK_STALE_MS = 6 * 60_000;
const BUDGET_MS = 280_000;
const MAX_PEOPLE = 250;

type Queryable = { query: typeof pool.query };

export type { StatItem };

export interface RosterGroup {
  name: string;
  /** `comingIn`: the season line from before this began; `soFar`: its games through RosterStats.through. Either can be missing. */
  people: { name: string; role: string | null; photoUrl: string | null; stats?: { comingIn: StatItem[] | null; soFar: StatItem[] | null } }[];
}

export interface RosterStats {
  /** What coming in covers ("2026 regular season"), when there are any. */
  comingInLabel: string | null;
  /** So far is through this episode: the latest game you've seen with lines (null: none, or none you've seen yet). */
  through: number | null;
  /** A later game's lines, past where you are: they open once you've seen it. */
  newer: number | null;
  /** They're being filled in from the sports data now. */
  asking: boolean;
  message: string | null;
}

export interface Roster {
  groups: RosterGroup[];
  /** Fill in who's playing is offered: a sport nobody's made a game of, with no one yet, whose games the sports data hasn't got (or
   *  didn't answer for). */
  canFill: boolean;
  /** It's being filled in now (a fill quietly adding to a roster already here from its games doesn't count). */
  asking: boolean;
  /** What's filling it in: its linked games' rosters ("sports") or our bot. */
  via: "sports" | "bot" | null;
  /** Where its people came from, when the sports data brought them ("ESPN"): the tab credits it. */
  source: string | null;
  /** Teams in its linked games with no one here yet: their players come in once they've played. */
  waiting: string[];
  /** People a box score brought in from a game past where you are: they show once you've seen it (the first such episode). */
  held: { people: number; episode: number } | null;
  /** The sports data asked ("ESPN"), and whether it was asked and hasn't got this season's games. */
  sportsName: string;
  unlisted: boolean;
  /** Why the last ask didn't work, when it didn't. */
  message: string | null;
  /** Our bot answers right now (else it's copy and paste). */
  available: boolean;
  stats: RosterStats;
}

interface Season {
  show: string;
  seasonLabel: string;
  kind: string;
  ready: boolean;
  words: ReturnType<typeof showWords>;
  /** Its episodes' listing titles ("Game 1: Tampa Bay Rays at Milwaukee Brewers"): who's playing, as the listings say it. */
  titles: string[];
  people: number;
}

async function seasonOf(seasonId: string, db: Queryable = pool): Promise<Season> {
  const [{ rows }, { rows: titles }, { rows: count }] = await Promise.all([
    db.query(
      `SELECT s.name, s.kind, s.castaway_term, s.castaway_plural, s.episode_term, s.set_up_at IS NOT NULL AS ready, ss.season_number, ss.name AS season_name
         FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
      [seasonId]
    ),
    db.query("SELECT title FROM season_episodes WHERE season_id = $1 AND title IS NOT NULL ORDER BY number LIMIT 12", [seasonId]),
    db.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [seasonId]),
  ]);
  const r = rows[0];
  if (!r) throw new HttpError(404, "Season not found");
  return {
    show: (r.name as string).replace(/\s*\([^)]*\)\s*$/, "").trim() || r.name,
    seasonLabel: r.season_name || (r.season_number ? `season ${r.season_number}` : "this season"),
    kind: r.kind,
    ready: !!r.ready,
    words: showWords({ castaway: r.castaway_term, people: r.castaway_plural, episode: r.episode_term }),
    titles: titles.map((t) => t.title as string),
    people: count[0].n as number,
  };
}

const fillable = (s: Season) => s.kind === "sport" && !s.ready && s.people === 0;

/** The question: each team's roster, its staff, and the officials, as JSON. */
export function rosterPrompt(s: Season): string {
  const people = s.words.people.toLowerCase();
  return [
    `Search the web for who's taking part in ${s.show} (${s.seasonLabel}). Answer with JSON only, in this shape:`,
    `{"groups": [{"name": "the team's name", "people": [{"name": "Full Name", "role": "what they do"}]}]}`,
    `One group per team, with its ${people} on the current roster and nobody else (no coaches, staff or officials); each one's role is their position. A sport of individuals has one group named "Field" with every competitor.`,
    `Use real names as the official rosters give them, nobody twice, and leave out anyone you can't confirm.`,
    ...(s.titles.length ? [``, `The TV listings for it:`, ...s.titles.map((t) => `- ${t}`)] : []),
  ].join("\n");
}

const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : null);

/** The groups in an answer: its JSON (fenced or not), names trimmed, nobody twice, at most MAX_PEOPLE in all. */
export function readRoster(answer: string): RosterGroup[] {
  const text = answer.replace(/```(?:json)?/gi, "");
  const from = text.indexOf("{");
  const to = text.lastIndexOf("}");
  if (from < 0 || to <= from) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(from, to + 1));
  } catch {
    return [];
  }
  const list = (parsed as { groups?: unknown })?.groups;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: RosterGroup[] = [];
  let n = 0;
  for (const g of list) {
    const name = clip((g as { name?: unknown })?.name, 60);
    const people = (g as { people?: unknown })?.people;
    if (!name || !Array.isArray(people)) continue;
    const group: RosterGroup = { name, people: [] };
    for (const p of people) {
      const who = clip((p as { name?: unknown })?.name, 120);
      if (!who || seen.has(who.toLowerCase()) || n >= MAX_PEOPLE) continue;
      seen.add(who.toLowerCase());
      group.people.push({ name: who, role: clip((p as { role?: unknown })?.role, 60), photoUrl: null });
      n++;
    }
    if (group.people.length) out.push(group);
  }
  return out;
}

/** Write the roster as the season's cast, only while it has none (whoever got there first wins). Answers how many. */
async function saveRoster(seasonId: string, groups: RosterGroup[]): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM show_seasons WHERE id = $1 FOR UPDATE", [seasonId]);
    const s = await seasonOf(seasonId, c);
    if (!fillable(s)) {
      await c.query("ROLLBACK");
      return 0;
    }
    let i = 0;
    for (const g of groups) {
      for (const p of g.people) {
        await c.query(
          "INSERT INTO season_cast (season_id, name, tribe_name, role, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (season_id, lower(name)) DO NOTHING",
          [seasonId, p.name, g.name, p.role, i++]
        );
      }
    }
    await c.query("COMMIT");
    return i;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Someone who follows the season or plays it. */
async function mayFill(userId: string, seasonId: string): Promise<void> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM show_follows WHERE user_id = $1 AND season_id = $2 AND following)
         OR EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN} WHERE m.user_id = $1 AND ss.id = $2) AS ok`,
    [userId, seasonId]
  );
  if (!rows[0]?.ok) throw new HttpError(403, "Add it to your shows first");
}

/**
 * The roster by team, in the order it was given, and whether (and how) it can be filled in. A sport nobody's made a game of whose
 * people can come from its games gets them here, after the answer: from its linked games when they're linked (the first time, a
 * game ended since the last time, an hour after the provider didn't answer), else by linking it first when it's due a look (never
 * looked at, or sports_links.next_at). `sports`: where the sports data comes from (index.ts sportsFor; null: not asked).
 */
export async function rosterOf(user: SessionUser, seasonId: string, bot?: string, sports?: string | null): Promise<Roster> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const [s, { rows: cast }, { rows: fill }, { rows: links }, mark] = await Promise.all([
    seasonOf(seasonId),
    pool.query("SELECT name, tribe_name, role, photo_url, provider_ids, shown_from FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]),
    pool.query("SELECT asking_at, message, via, updated_at FROM cast_fills WHERE season_id = $1", [seasonId]),
    pool.query(
      `SELECT l.season_id IS NOT NULL AS looked, l.league, l.next_at,
              (SELECT count(*)::int FROM season_events e WHERE e.season_id = $1) AS events,
              (SELECT json_agg(DISTINCT t->>'name') FROM season_events e, jsonb_array_elements(e.teams) t WHERE e.season_id = $1) AS teams,
              EXISTS (SELECT 1 FROM season_events e WHERE e.season_id = $1 AND e.starts_at + interval '3 hours' <= now()
                       AND e.starts_at + interval '3 hours' > COALESCE((SELECT f.updated_at FROM cast_fills f WHERE f.season_id = $1 AND f.via = 'sports'), '-infinity')) AS played
         FROM (SELECT 1) one LEFT JOIN sports_links l ON l.season_id = $1`,
      [seasonId]
    ),
    seenThrough(user.id, seasonId),
  ]);
  const link = links[0];
  const f = fill[0];
  const going = !!f?.asking_at && Date.now() - new Date(f.asking_at).getTime() < ASK_STALE_MS;
  const fromSports = cast.some((r) => r.provider_ids);
  const linked = link.events > 0;
  const failed = f?.via === "sports" && !!f.message;
  // Its people from its games, after the answer (sports/season.ts), held as a fill so this and the page's next reads see it going;
  // then their stats (sports/stats.ts).
  let kicked = false;
  const live = s.kind === "sport" && !s.ready && (!cast.length || fromSports);
  if (sports !== null && live && !going) {
    const providers = sportsProviders({ base: sports });
    if (linked && (f?.via !== "sports" || link.played || (failed && Date.now() - new Date(f.updated_at).getTime() > 3600_000))) {
      kicked = await fillLater(seasonId, async () => {
        const c = await castFromEvents(seasonId, { providers, held: true });
        await statsFromEvents(seasonId, { providers }).catch((e) => console.error("[rosters] stats", seasonId, e));
        return c;
      });
    } else if (!linked && !cast.length && (!link.looked || new Date(link.next_at) <= new Date())) {
      kicked = await fillLater(seasonId, async () => (await followSeason(seasonId, { providers, held: true })).cast);
    }
    // Outside a request it ran just now: read what it did.
    if (kicked && !(await pool.query("SELECT asking_at FROM cast_fills WHERE season_id = $1", [seasonId])).rows[0]?.asking_at) return rosterOf(user, seasonId, bot, null);
  }
  // Only their stats due (a game's over, someone has no coming in yet): those alone, after the answer.
  if (sports !== null && live && fromSports && !kicked && (await statsDue(seasonId)).due) await statsLater(seasonId, { providers: sportsProviders({ base: sports }) });
  const groups: RosterGroup[] = [];
  const people: { p: RosterGroup["people"][number]; ids: Record<string, string> | null }[] = [];
  let held = null as Roster["held"];
  for (const r of cast) {
    // Who played a game you haven't seen: not yet.
    if (r.shown_from != null && r.shown_from > mark) {
      held = { people: (held?.people ?? 0) + 1, episode: Math.min(held?.episode ?? Infinity, r.shown_from) };
      continue;
    }
    const name = (r.tribe_name as string | null) ?? s.words.people;
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, people: [] }));
    const p = { name: r.name, role: r.role ?? null, photoUrl: r.photo_url ?? null };
    g.people.push(p);
    people.push({ p, ids: r.provider_ids ?? null });
  }
  // Still asking once the roster's saved: its photos (and then its stats) follow in the same ask. A fill adding to people already
  // here from their games is quiet.
  const via: Roster["via"] = kicked ? "sports" : going ? (f.via === "sports" ? "sports" : "bot") : null;
  const asking = !!via && (via === "bot" || !cast.length);
  // The bot only when the sports data hasn't got its games, or didn't answer for them.
  const canFill = fillable(s) && !asking && (!linked || failed);
  const names = new Map(sportsProviders().map((p) => [p.id, p.name]));
  const have = new Set(cast.map((r) => ((r.tribe_name as string | null) ?? s.words.people).toLowerCase()));
  const source = [...new Set(cast.flatMap((r) => Object.keys((r.provider_ids ?? {}) as Record<string, string>)))].map((id) => names.get(id) ?? id).join(" and ") || null;
  const stats = await statsFor(seasonId, mark, people);
  const available = canFill ? (await askBotStatus({ bot })).available : false;
  return {
    groups,
    canFill,
    asking,
    via: asking ? via : null,
    source,
    waiting: (live ? ((link.teams ?? []) as string[]) : []).filter((t) => !have.has(t.toLowerCase())),
    held,
    sportsName: [...names.values()].join(" or "),
    unlisted: !!link.looked && !link.league,
    message: asking ? null : (f?.message ?? null),
    available,
    stats,
  };
}

async function fillableFor(user: SessionUser, seasonId: string): Promise<Season> {
  await mayFill(user.id, seasonId);
  const s = await seasonOf(seasonId);
  if (s.kind !== "sport") throw new HttpError(409, "Only a sport's players are filled in here; Make it a game finds a show's cast");
  if (s.ready) throw new HttpError(409, "It's a game: its cast is set up with it");
  if (s.people) throw new HttpError(409, `Its ${s.words.people.toLowerCase()} are in already`);
  return s;
}

/** The prompt to copy, for copy and paste. */
export async function rosterPromptFor(user: SessionUser, seasonId: string): Promise<{ prompt: string }> {
  return { prompt: rosterPrompt(await fillableFor(user, seasonId)) };
}

/**
 * Fill in who's playing: the sports data first, now (its games linked again and their rosters: a few calls, cached); our bot only
 * when that has nothing (no provider has its games, or it didn't answer), after this answers (one ask a season at a time: one
 * already going is joined). Games linked whose teams haven't played yet wait for them, never the bot.
 */
export async function askRoster(user: SessionUser, seasonId: string, bot?: string, sports?: string | null): Promise<Roster> {
  await fillableFor(user, seasonId);
  if (sports !== null && (await holdFill(seasonId, user.id))) {
    let cast: CastFill | null = null;
    try {
      cast = (await followSeason(seasonId, { providers: sportsProviders({ base: sports }), held: true })).cast;
    } catch (e) {
      console.error("[rosters] sports first", seasonId, e);
    }
    await releaseFill(seasonId, cast?.message ?? null, cast?.filled ?? 0);
    if (cast && (cast.filled || (!cast.message && cast.waiting.length))) return rosterOf(user, seasonId, bot, null);
  }
  if (!(await askBotStatus({ bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Copy and paste works.");
  const { rowCount } = await pool.query(
    `INSERT INTO cast_fills (season_id, asking_at, asked_by, message, via) VALUES ($1, now(), $2, NULL, 'bot')
     ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = $2, message = NULL, via = 'bot', updated_at = now()
      WHERE cast_fills.asking_at IS NULL OR cast_fills.asking_at < now() - make_interval(secs => $3)`,
    [seasonId, user.id, ASK_STALE_MS / 1000]
  );
  if (rowCount) after(() => runAsk(seasonId, bot));
  return rosterOf(user, seasonId, bot, null);
}

async function runAsk(seasonId: string, bot?: string): Promise<void> {
  const done = (message: string | null, filled: number | null) =>
    pool.query("UPDATE cast_fills SET asking_at = NULL, message = $2, filled = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, filled]);
  try {
    const { answer } = await askBot(rosterPrompt(await seasonOf(seasonId)), { bot, budgetMs: BUDGET_MS });
    const groups = readRoster(answer);
    if (!groups.length) throw new Error("ChatGPT didn't find who's playing. Try again, or paste an answer.");
    const filled = await saveRoster(seasonId, groups);
    // Their photos from Wikipedia before the ask counts as done, so the roster arrives with them (show-art.ts, by team).
    if (filled) await fillCastPhotos(seasonId, undefined, { roster: true }).catch((e) => console.error("[rosters] photos", seasonId, e));
    await done(null, filled);
  } catch (e) {
    await done((e instanceof Error ? e.message : "ChatGPT didn't answer").slice(0, 300), null).catch((err) => console.error("[rosters] couldn't record", seasonId, err));
  }
}

/** Copy and paste: the answer to the prompt, read and saved now. */
export async function pasteRoster(user: SessionUser, seasonId: string, answer: unknown, sports?: string | null): Promise<Roster & { filled: number }> {
  await fillableFor(user, seasonId);
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) throw new HttpError(400, "Paste the AI's whole answer");
  if (text.length > 200_000) throw new HttpError(400, "That's too long to be the answer");
  const groups = readRoster(text);
  if (!groups.length) throw new HttpError(400, "That answer has no one in it. Paste the AI's whole answer, JSON and all.");
  const filled = await saveRoster(seasonId, groups);
  // Their photos from Wikipedia, after this answers (they show the next time the tab reads the roster).
  if (filled) after(() => fillCastPhotos(seasonId, undefined, { roster: true }).then(() => undefined, (e) => console.error("[rosters] photos", seasonId, e)));
  return { ...(await rosterOf(user, seasonId, undefined, sports)), filled };
}

// ---------- stats (0150) ----------

/** A stats fill going longer than this has died (sports/stats.ts). */
const STATS_STALE_MS = 6 * 60_000;

/**
 * Each person's stats as someone at `mark` may see them, onto their roster entries (matched by the provider's ids), and the tab's
 * line: coming in always, so far only from the games up to the mark (only those lines are read), and whether a later game's are in.
 */
async function statsFor(seasonId: string, mark: number, people: { p: RosterGroup["people"][number]; ids: Record<string, string> | null }[]): Promise<RosterStats> {
  const linked = "(g.episode = 0 OR EXISTS (SELECT 1 FROM season_events e WHERE e.season_id = g.season_id AND e.episode = g.episode))";
  const [{ rows: lines }, { rows: more }, { rows: fill }] = await Promise.all([
    pool.query(`SELECT g.episode, g.provider, g.athlete, g.label, g.tables FROM game_lines g WHERE g.season_id = $1 AND g.episode <= $2 AND ${linked}`, [seasonId, mark]),
    // The latest game past the mark, and every column the season's games show (coming in's columns: a label isn't a spoiler).
    pool.query(
      `SELECT (SELECT max(g.episode) FROM game_lines g WHERE g.season_id = $1 AND g.episode > $2 AND ${linked}) AS newer,
              (SELECT array_agg(DISTINCT l) FROM game_lines g, jsonb_array_elements(g.tables) t, jsonb_array_elements_text(t->'labels') l
                WHERE g.season_id = $1 AND g.episode > 0) AS shown`,
      [seasonId, mark]
    ),
    pool.query("SELECT asking_at, message FROM stat_fills WHERE season_id = $1", [seasonId]),
  ]);
  const view = statsView(
    lines.map((r) => ({ episode: r.episode, key: `${r.provider}:${r.athlete}`, label: r.label, tables: r.tables })),
    mark,
    (more[0]?.shown as string[] | null) ?? null
  );
  for (const { p, ids } of people) {
    const st = Object.entries(ids ?? {}).map(([k, v]) => view.people.get(`${k}:${v}`)).find((x) => !!x);
    if (st) p.stats = st;
  }
  const asking = !!fill[0]?.asking_at && Date.now() - new Date(fill[0].asking_at).getTime() < STATS_STALE_MS;
  return {
    comingInLabel: view.comingInLabel,
    through: view.through,
    newer: (more[0]?.newer as number | null) ?? null,
    asking,
    message: asking ? null : ((fill[0]?.message as string | null) ?? null),
  };
}
