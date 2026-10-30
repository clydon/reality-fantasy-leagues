import type { Likelihood } from "@/lib/game/bingo";
import { cap } from "@/lib/desk-bot-words";
import { buildBingoPrompt, parseBingoAnswer, storeBank, MIN_BANK } from "@db/bingo-research.js";
import { SEASON_BINGO_SLOT } from "@db/bot-research.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { FLAGGED_OUT } from "./bingo";
import { contextFor } from "./bingo-bank";
import type { PoolClient } from "pg";
import { pool, HttpError, tx } from "./db";
import { logDesk, type DeskLine } from "./desk";
import { seasonBot } from "./desk-bot";
import { plural, whenAt } from "./desk-dates";
import type { MoveLine } from "./desk-episode";
import { deskSetup, type SeasonDelete } from "./desk-setup";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";

// A season's Bingo bank on the desk (docs/PLAN-desk-parity.md step 4, part 4c; the mock's desk-research.js rsBingoPage), from
// the season page's Running it, an episode's page and a bingo run's sheet:
//   GET  /api/desk/seasons/[id]/bingo?bank=<n>|season    a strip of its episodes and the season's bank, each with how many
//        squares deal; the bank asked for (else the next episode's when it has one, else the season's): who wrote it and when,
//        how many passed its check, its squares by Likely, Maybe, Long shot and Out of new cards (dropped by its check, hidden
//        by an admin, or two flags), each with its flags and who sent them; History; the season's Delete
//   GET  .../bingo/question?bank=                         Paste squares' question (db/bingo-research.js buildBingoPrompt)
//   POST .../bingo { bank, paste, preview? }             a chat's answer as that bank (not checked by a second ask, as
//        classic's paste): `preview` says what it keeps and leaves out first; then filed (tier 2), Undo putting the old back
//   POST .../bingo { square, hide }                      Hide it from new cards (an admin's flag), or Show it again, which
//        outranks the flags it has (0425 shown_at: bingo.ts FLAGGED_OUT counts only flags since); tier 1 with Undo
// Write them again is Research's Run now (desk-research.ts runNow, kind bingo). Dealing is bingo.ts's (bankFor).

type Bank = number | "season";

export interface BankSquare {
  id: string;
  label: string;
  tier: Likelihood;
  /** live: on new cards; dropped: its check (or the paste) left it out; hidden: an admin hid it; flagged: two flags. */
  state: "live" | "dropped" | "hidden" | "flagged";
  note: string | null;
  /** Players' flags ("This square's unfair"), who and when; `overruled`: from before an admin showed it again. */
  flags: { id: string; name: string; at: string; overruled: boolean }[];
  /** Who hid it (an admin's flag): "you", or their name. */
  hiddenBy: string | null;
  /** An admin showed it again over its flags: "you", or their name. */
  shownBy: string | null;
  /** How many cards it's dealt on. */
  cards: number;
}

export interface DeskBingoBank {
  bank: Bank;
  /** "Our bot, Run now by alex", "Our bot, on its schedule", "You pasted them". */
  by: string;
  at: string;
  /** "27 of 30 passed its check", "27 pasted, not checked". */
  check: string;
  /** Written by our bot (checked by a second ask), not pasted. */
  bot: boolean;
  /** How many cards it's dealt on so far. */
  dealt: number;
  squares: BankSquare[];
}

export interface DeskBingo {
  id: string;
  name: string;
  show: { id: string; name: string };
  tag: string;
  detail: string;
  meta: string;
  /** The episodes (the latest to come first) and the season's bank, with how many squares deal from each (null: none). */
  strip: { bank: Bank; squares: number | null }[];
  /** The bank shown. */
  sel: Bank;
  panel: {
    title: string;
    aside: string;
    /** It has aired: no Write or Paste. */
    aired: boolean;
    /** With no bank: what that means. */
    empty: { title: string; line: string } | null;
  };
  bank: DeskBingoBank | null;
  /** Our bot is writing squares for this season now, or one is queued: the page polls. */
  writing: boolean;
  history: DeskLine[];
  delete: SeasonDelete;
}

const bankName = (b: Bank) => (b === "season" ? "the season's" : `Episode ${b}'s`);
const bankOf = (raw: unknown): Bank | null => {
  if (raw === "season") return "season";
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : null;
};
const epOf = (b: Bank) => (b === "season" ? null : b);

interface SquareRow {
  id: string;
  episode: number | null;
  label: string;
  likelihood: Likelihood;
  status: "live" | "dropped";
  note: string | null;
  run_id: string | null;
  created_at: Date;
  pasted_by: string | null;
  shown_at: Date | null;
  shown_by: string | null;
  out: boolean;
}

const SQUARES_SQL = `SELECT s.id, s.episode, s.label, s.likelihood, s.status, s.note, s.run_id, s.created_at, s.pasted_by, s.shown_at, s.shown_by,
                            ${FLAGGED_OUT("s.id", "s.shown_at")} AS out
                       FROM bingo_squares s WHERE s.season_id = $1`;

/** How many squares deal from each of a season's banks (live, not flagged out), by episode (null: the season's). */
async function counts(id: string): Promise<Map<number | null, number>> {
  const { rows } = await pool.query(
    `SELECT s.episode, count(*) FILTER (WHERE s.status = 'live' AND NOT ${FLAGGED_OUT("s.id", "s.shown_at")})::int AS n FROM bingo_squares s WHERE s.season_id = $1 GROUP BY s.episode`,
    [id]
  );
  return new Map(rows.map((r) => [r.episode ?? null, r.n]));
}

/** The next episode to air, or null once the season's last has (its count says so). */
function nextOf(schedule: SeasonSchedule | undefined, now: Date): number | null {
  const nx = latestAired(schedule, now) + 1;
  return schedule?.episodeCount && nx > schedule.episodeCount ? null : nx;
}

/** The season page's Bingo bank row (the mock's line). */
export async function bingoLine(id: string, now = new Date()): Promise<string> {
  const [c, schedule] = await Promise.all([counts(id), seasonSchedules([id], now)]);
  const nx = nextOf(schedule.get(id), now);
  const own = nx ? (c.get(nx) ?? 0) : 0;
  const season = c.get(null) ?? 0;
  if (own) return `Episode ${nx}: ${plural(own, "square")}${season ? ` · the season's: ${season}` : ""}`;
  if (season) return `The season's: ${plural(season, "square")}${nx ? ` · none for Episode ${nx} yet` : ""}`;
  return nx ? "No squares yet · write or paste them" : "No squares";
}

/** A season's Bingo bank page, `bankIn` the one shown. */
export async function deskBingo(user: SessionUser, id: string, bankIn: unknown, now = new Date()): Promise<DeskBingo> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const [setup, schedules, c, bot, { rows: writing }, history] = await Promise.all([
    deskSetup(id, now),
    seasonSchedules([id], now),
    counts(id),
    seasonBot(id),
    pool.query(
      // A queued run whose driver was cut off is Research's read to take over: past 15 minutes this page stops waiting on it.
      `SELECT 1 FROM desk_runs WHERE season_id = $1 AND kind = 'bingo' AND done_at IS NULL AND asked_at > now() - interval '15 minutes'
        UNION ALL SELECT 1 FROM bot_research_runs WHERE season_id = $1 AND kind = 'bingo' AND ok IS NULL AND finished_at IS NULL AND started_at > now() - interval '10 minutes'
        LIMIT 1`,
      [id]
    ),
    bingoHistory(user, id),
  ]);
  const sch = schedules.get(id)!;
  const tz = sch.airTz || "America/New_York";
  const aired = latestAired(sch, now);
  const nx = nextOf(sch, now);
  const count = sch.episodeCount;
  const asked = bankOf(bankIn);
  // The next two episodes and every one before, reaching any later episode with a bank, or the one asked for.
  const later = Math.max(aired + 2, ...[...c.keys()].filter((e): e is number => e != null), typeof asked === "number" ? asked : 0);
  const top = Math.max(1, count ? Math.min(count, later) : later);
  const strip: DeskBingo["strip"] = [];
  for (let e = top; e >= 1; e--) strip.push({ bank: e, squares: c.has(e) ? c.get(e)! : null });
  strip.push({ bank: "season", squares: c.has(null) ? c.get(null)! : null });
  const sel: Bank = asked != null && (asked === "season" || asked <= top) ? asked : nx && c.has(nx) ? nx : "season";
  const [bank, { rows: dealt }] = await Promise.all([
    bankView(user, id, sel, now, tz),
    // How many people have a card dealt from the next episode's own bank.
    pool.query(
      `SELECT count(*)::int AS n FROM bingo_cards c WHERE c.season_id = $1 AND c.episode = $2
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.squares) q JOIN bingo_squares s ON q->>'key' = 'b:' || s.id::text WHERE s.season_id = $1 AND s.episode = $2)`,
      [id, nx ?? 0]
    ),
  ]);
  const airAt = (e: number) => sch.episodes.find((x) => x.number === e)?.airAt ?? null;
  const isAired = sel !== "season" && sel <= aired;
  // The episode's own runs when it has them (0431), else the season's.
  const inSchedule = bot.on && (sel === "season" ? bot.schedule : (bot.episodes[sel] ?? bot.schedule)).some((r) => r.kind === "bingo" && r.on);
  const own = nx ? (c.get(nx) ?? 0) : 0;
  const dealtNext = dealt[0].n;
  const at = sel === "season" ? null : airAt(sel);
  const season = c.get(null) ?? 0;
  return {
    id,
    name: setup.name,
    show: setup.show,
    // Once its last episode has aired (the mock has no such season): what's left is the season's bank.
    tag: !nx ? "All aired" : own ? "Ready" : "No squares",
    detail: !nx ? (season ? `The season's: ${plural(season, "square")}` : "No episode still to come") : own ? `Episode ${nx}: ${plural(own, "square")}` : `Episode ${nx} uses the season's`,
    meta: `A card is 8 squares round a free centre: 3 likely, 4 maybe, 1 long shot.${own && dealtNext ? ` Episode ${nx}'s dealt to ${plural(dealtNext, "person", "people")} so far.` : ""}`,
    strip,
    sel,
    panel: {
      title: sel === "season" ? "The season's bank" : `Episode ${sel}`,
      aside: sel === "season" ? "For any episode without its own" : at ? cap(whenAt(new Date(at), tz, now)) : "Not dated yet",
      aired: isAired,
      empty: bank
        ? null
        : isAired
          ? { title: "", line: `Episode ${sel} had no squares of its own: its cards used the season's bank. Bingo never writes for an episode once it has aired.` }
          : {
              title: `No squares for ${sel === "season" ? "the season's bank" : `Episode ${sel}`} yet`,
              line:
                sel === "season"
                  ? "The fallback for any episode without its own."
                  : inSchedule
                    ? "Our bot writes them a day before it airs."
                    : `Bingo isn't in ${setup.name}'s schedule, so nothing writes them on its own. Until it has its own, its cards use the season's bank.`,
            },
    },
    bank,
    writing: writing.length > 0,
    history,
    delete: setup.delete,
  };
}

/** Who wrote a bank, from its first square: "Our bot, Run now by alex", "Our bot, on its schedule", "You pasted them". */
async function writtenBy(user: SessionUser, row: { run_id: string | null; pasted_by: string | null }): Promise<string> {
  const me = (uid: string | null, name: string | null) => (uid === user.id ? "you" : (name ?? "an admin"));
  if (row.run_id) {
    const { rows } = await pool.query(`SELECT r.slot, r.asked_by, COALESCE(u.username, u.name) AS who FROM bot_research_runs r LEFT JOIN "user" u ON u.id = r.asked_by WHERE r.id = $1`, [row.run_id]);
    return rows[0]?.slot === "now" ? `Our bot, Run now by ${me(rows[0].asked_by, rows[0].who)}` : "Our bot, on its schedule";
  }
  if (!row.pasted_by) return "Pasted";
  if (row.pasted_by === user.id) return "You pasted them";
  const { rows } = await pool.query(`SELECT COALESCE(username, name) AS name FROM "user" WHERE id = $1`, [row.pasted_by]);
  return `${rows[0]?.name ?? "Someone"} pasted them`;
}

/** An episode's own bank in brief, for its page's Bingo row: how many squares deal from it, who wrote it and when. */
export async function bankBrief(user: SessionUser, id: string, n: number, tz: string, now = new Date()): Promise<{ squares: number; line: string } | null> {
  const { rows } = await pool.query<SquareRow>(`${SQUARES_SQL} AND s.episode = $2 ORDER BY s.created_at, s.id`, [id, n]);
  if (!rows.length) return null;
  return { squares: rows.filter((r) => r.status === "live" && !r.out).length, line: `${await writtenBy(user, rows[0])} · ${cap(whenAt(rows[0].created_at, tz, now))}` };
}

/** One bank as the page shows it, or null when it has no squares. */
async function bankView(user: SessionUser, id: string, b: Bank, now: Date, tz: string): Promise<DeskBingoBank | null> {
  const { rows } = await pool.query<SquareRow>(`${SQUARES_SQL} AND s.episode IS NOT DISTINCT FROM $2 ORDER BY s.created_at, s.id`, [id, epOf(b)]);
  if (!rows.length) return null;
  const ids = rows.map((r) => r.id);
  const keys = ids.map((x) => `b:${x}`);
  const shown = [...new Set(rows.map((r) => r.shown_by).filter((x): x is string => !!x))];
  const [{ rows: flags }, { rows: cards }, by, { rows: names }] = await Promise.all([
    pool.query(
      `SELECT f.square_id, f.user_id, f.flagged_at, COALESCE(u.username, u.name) AS name, u.role = 'admin' AS admin
         FROM bingo_square_flags f JOIN "user" u ON u.id = f.user_id WHERE f.square_id = ANY($1::uuid[]) ORDER BY f.flagged_at`,
      [ids]
    ),
    // The cards it's dealt on (a card's row is kept once ticked or dealt again): the episode's, or for the season's bank any.
    pool.query(
      `SELECT c.id, ARRAY(SELECT q->>'key' FROM jsonb_array_elements(c.squares) q WHERE q->>'key' = ANY($3::text[])) AS keys
         FROM bingo_cards c WHERE c.season_id = $1 AND ($2::int IS NULL OR c.episode = $2)
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.squares) q WHERE q->>'key' = ANY($3::text[]))`,
      [id, epOf(b), keys]
    ),
    writtenBy(user, rows[0]),
    pool.query("SELECT id, COALESCE(username, name) AS name FROM \"user\" WHERE id = ANY($1::text[])", [shown]),
  ]);
  const nameOf = new Map<string, string>(names.map((r) => [r.id, r.name]));
  const me = (uid: string | null, name: string | null | undefined) => (uid === user.id ? "you" : (name ?? "an admin"));
  const dealtOn = new Map<string, number>();
  for (const c of cards) for (const k of c.keys as string[]) dealtOn.set(k.slice(2), (dealtOn.get(k.slice(2)) ?? 0) + 1);
  const bot = !!rows[0].run_id;
  const live = rows.filter((r) => r.status === "live").length;
  return {
    bank: b,
    by,
    at: cap(whenAt(rows[0].created_at, tz, now)),
    check: bot ? `${live} of ${rows.length} passed its check` : `${live} pasted, not checked`,
    bot,
    dealt: cards.length,
    squares: rows.map((r) => {
      const mine = flags.filter((f) => f.square_id === r.id);
      const admin = mine.filter((f) => f.admin);
      const since = mine.filter((f) => !r.shown_at || f.flagged_at > r.shown_at);
      return {
        id: r.id,
        label: r.label,
        tier: r.likelihood,
        state: r.status === "dropped" ? "dropped" : !r.out ? "live" : admin.length ? "hidden" : "flagged",
        note: r.note,
        flags: mine.filter((f) => !f.admin).map((f) => ({ id: f.user_id, name: f.name, at: f.flagged_at.toISOString(), overruled: !!r.shown_at && f.flagged_at <= r.shown_at })),
        hiddenBy: admin.length ? me(admin[0].user_id, admin[0].name) : null,
        shownBy: r.shown_at && !r.out && mine.length > since.length ? me(r.shown_by, r.shown_by ? nameOf.get(r.shown_by) : null) : null,
        cards: dealtOn.get(r.id) ?? 0,
      };
    }),
  };
}

/** The bank's History: the bot's banks as they were written, the desk's lines, and each square two flags took out. */
async function bingoHistory(user: SessionUser, id: string): Promise<DeskLine[]> {
  const [{ rows: runs }, { rows: lines }, { rows: outs }] = await Promise.all([
    pool.query(
      `SELECT r.episode_number, r.slot, r.result, r.finished_at, r.started_at, r.asked_by, COALESCE(u.username, u.name) AS who
         FROM bot_research_runs r LEFT JOIN "user" u ON u.id = r.asked_by
        WHERE r.season_id = $1 AND r.kind = 'bingo' AND r.ok ORDER BY r.started_at DESC LIMIT 40`,
      [id]
    ),
    pool.query(
      `SELECT c.id, c.text, c.created_at, c.undo IS NOT NULL AND c.undone_at IS NULL AS undoable, c.undone_at IS NOT NULL AS undone, COALESCE(u.username, u.name) AS who
         FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id
        WHERE c.entity = 'season' AND c.entity_id = $1 AND c.action = 'bingo' ORDER BY c.created_at DESC LIMIT 40`,
      [id]
    ),
    // The second flag since any Show it again, on a square no admin has flagged: two people took it out then.
    pool.query(
      `SELECT s.label, (SELECT f.flagged_at FROM bingo_square_flags f WHERE f.square_id = s.id AND f.flagged_at > COALESCE(s.shown_at, '-infinity')
                         ORDER BY f.flagged_at OFFSET 1 LIMIT 1) AS at
         FROM bingo_squares s WHERE s.season_id = $1 AND ${FLAGGED_OUT("s.id")}
          AND NOT EXISTS (SELECT 1 FROM bingo_square_flags f JOIN "user" u ON u.id = f.user_id WHERE f.square_id = s.id AND u.role = 'admin')`,
      [id]
    ),
  ]);
  const all: DeskLine[] = [
    ...runs.map((r) => {
      const season = r.slot === SEASON_BINGO_SLOT || !!r.result?.forSeason;
      const how = r.slot === "now" ? `Run now, by ${r.asked_by === user.id ? "you" : (r.who ?? "an admin")}` : "on its schedule";
      return { id: null, text: `${cap(bankName(season ? "season" : r.episode_number))} squares written, by our bot (${how})`, at: (r.finished_at ?? r.started_at).toISOString(), who: null, undoable: false, undone: false };
    }),
    ...lines.map((r) => ({ id: r.id, text: r.text, at: r.created_at.toISOString(), who: r.who, undoable: r.undoable, undone: r.undone })),
    ...outs.filter((o) => o.at).map((o) => ({ id: null, text: `“${o.label}” out: two flags`, at: o.at.toISOString(), who: null, undoable: false, undone: false })),
  ];
  return all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ---------- Paste squares ----------

const bankScope = (b: Bank) => (b === "season" ? "season" : "episode");

/** Paste squares' question: the prompt our bot asks for that bank (with its context: when it airs, who's still in, what to leave out). */
export async function bingoQuestion(id: string, bankIn: unknown, now = new Date()): Promise<{ prompt: string; task: string }> {
  const b = bankOf(bankIn);
  if (!isUuid(id) || !b) throw new HttpError(400, "Which bank? An episode's number, or season");
  const { ctx } = await contextFor(id, b === "season" ? 1 : b, bankScope(b), now);
  return { prompt: buildBingoPrompt(ctx), task: `writing bingo squares for ${b === "season" ? "a season" : "an episode"} of ${ctx.showName}` };
}

interface Snapshot {
  rows: { id: string; label: string; likelihood: string; status: string; note: string | null; run_id: string | null; created_at: string; pasted_by: string | null; shown_at: string | null; shown_by: string | null }[];
  flags: { square_id: string; user_id: string; flagged_at: string }[];
}

async function snapshot(id: string, b: Bank): Promise<Snapshot> {
  const { rows } = await pool.query(
    "SELECT id, label, likelihood, status, note, run_id, created_at, pasted_by, shown_at, shown_by FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2 ORDER BY created_at, id",
    [id, epOf(b)]
  );
  const { rows: flags } = rows.length ? await pool.query("SELECT square_id, user_id, flagged_at FROM bingo_square_flags WHERE square_id = ANY($1::uuid[])", [rows.map((r) => r.id)]) : { rows: [] };
  return { rows, flags };
}

/**
 * Paste squares (tier 2): a chat's answer as `bank`, replacing it. Not checked by a second ask (classic's paste wasn't either):
 * the parse alone keeps or leaves out each square. `preview`: what it keeps, leaves out and replaces; nothing written. Refused
 * when fewer than MIN_BANK fit, or for an episode that has aired (its cards are dealt).
 */
export async function pasteSquares(user: SessionUser, id: string, body: { bank?: unknown; paste?: unknown; preview?: unknown }, now = new Date()): Promise<{ lines: MoveLine[] } | { changeId: string; text: string }> {
  const b = bankOf(body.bank);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  if (!b) throw new HttpError(400, "Which bank? An episode's number, or season");
  const answer = typeof body.paste === "string" ? body.paste : "";
  if (!answer.trim()) throw new HttpError(400, "Paste the chat's answer");
  const schedule = (await seasonSchedules([id], now)).get(id);
  if (!schedule) throw new HttpError(404, "Season not found");
  if (b !== "season" && b <= latestAired(schedule, now)) throw new HttpError(400, `Episode ${b} has aired: bingo squares are for an episode still to come`);
  const { ctx } = await contextFor(id, b === "season" ? 1 : b, bankScope(b), now);
  let parsed: ReturnType<typeof parseBingoAnswer>;
  try {
    parsed = parseBingoAnswer(answer, { avoid: ctx.avoid, names: ctx.cast, anyone: b !== "season" });
  } catch {
    throw new HttpError(400, "That answer has no JSON in it: paste the chat's whole reply");
  }
  const live = parsed.squares.filter((s) => s.status === "live").length;
  if (live < MIN_BANK) throw new HttpError(400, `Only ${live} of ${parsed.squares.length} squares fit: a bank needs at least ${MIN_BANK}. Ask again, or paste a longer answer.`);
  const nm = bankName(b);
  if (body.preview === true) {
    const { rows: had } = await pool.query(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE s.status = 'live' AND NOT ${FLAGGED_OUT("s.id", "s.shown_at")})::int AS live FROM bingo_squares s WHERE s.season_id = $1 AND s.episode IS NOT DISTINCT FROM $2`,
      [id, epOf(b)]
    );
    const why = new Map<string, number>();
    for (const s of parsed.squares) if (s.status === "dropped") why.set(s.note ?? "left out", (why.get(s.note ?? "left out") ?? 0) + 1);
    return {
      lines: [
        { face: null, icon: "grid", label: `${plural(parsed.squares.length, "square")} pasted`, change: `${live} fit on cards` },
        ...[...why].map(([note, k]): MoveLine => ({ face: null, icon: "x", label: `${k} ${note}`, change: "Left out" })),
        ...(had[0].n ? [{ face: null, icon: "repeat", label: `${cap(nm)} ${plural(had[0].live, "square")}`, change: "Replaced" } as MoveLine] : []),
      ],
    };
  }
  const was = await snapshot(id, b);
  await storeBank(pool, id, epOf(b), parsed.squares);
  // Only the batch just stored (no run, nobody's yet): our bot writing the same bank this moment would have a run.
  const { rows: made } = await pool.query(
    "UPDATE bingo_squares SET pasted_by = $3 WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2 AND run_id IS NULL AND pasted_by IS NULL RETURNING id",
    [id, epOf(b), user.id]
  );
  if (made.length !== parsed.squares.length) throw new HttpError(409, `${cap(nm)} squares were written again at the same moment: look at the bank, then paste again if you still want to`);
  const text = `${cap(nm)} squares pasted, by you: ${live}`;
  const changeId = await logDesk(pool, {
    entity: "season",
    entityId: id,
    action: "bingo",
    text,
    after: { bank: epOf(b), live },
    undo: { type: "bingoBank", seasonId: id, episode: epOf(b), ids: made.map((r) => r.id), snapshot: was },
    userId: user.id,
  });
  return { changeId, text: `Saved · ${plural(live, "square")} for ${b === "season" ? "the season" : `Episode ${b}`}` };
}

/** Undo a paste: the bank as it was (its squares with their ids, so cards not kept deal as before, and their flags). */
export async function restoreBingoBank(u: Record<string, unknown>): Promise<void> {
  const seasonId = String(u.seasonId);
  const episode = u.episode == null ? null : Number(u.episode);
  const ids = (u.ids as string[]) ?? [];
  const snap = u.snapshot as Snapshot;
  await tx(async (c) => {
    const { rows } = await c.query("SELECT id FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2 FOR UPDATE", [seasonId, episode]);
    const now = rows.map((r) => r.id).sort();
    if (now.length !== ids.length || [...ids].sort().some((x, i) => x !== now[i])) throw new HttpError(409, "Its squares were written again since: that bank is the one in play now");
    await c.query("DELETE FROM bingo_squares WHERE id = ANY($1::uuid[])", [ids]);
    for (const r of snap.rows)
      await c.query(
        "INSERT INTO bingo_squares (id, season_id, episode, label, likelihood, status, note, run_id, created_at, pasted_by, shown_at, shown_by) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM bot_research_runs WHERE id = $8), $9, (SELECT id FROM \"user\" WHERE id = $10), $11, (SELECT id FROM \"user\" WHERE id = $12))",
        [r.id, seasonId, episode, r.label, r.likelihood, r.status, r.note, r.run_id, r.created_at, r.pasted_by, r.shown_at, r.shown_by]
      );
    for (const f of snap.flags)
      await c.query("INSERT INTO bingo_square_flags (square_id, user_id, flagged_at) SELECT $1, id, $3 FROM \"user\" WHERE id = $2 ON CONFLICT DO NOTHING", [f.square_id, f.user_id, f.flagged_at]);
  });
}

// ---------- Hide it, or Show it again ----------

interface SquareUndo {
  admins: { user_id: string; flagged_at: string }[];
  shownAt: string | null;
  shownBy: string | null;
  /** As the change left it: an Undo is refused once another hide or show has moved it on. */
  after: { admins: string[]; shownAt: string | null };
}

async function squareNow(c: PoolClient, sq: string): Promise<SquareUndo["after"]> {
  const [{ rows: s }, { rows: admins }] = await Promise.all([
    c.query("SELECT shown_at FROM bingo_squares WHERE id = $1", [sq]),
    c.query(`SELECT f.user_id FROM bingo_square_flags f JOIN "user" u ON u.id = f.user_id WHERE f.square_id = $1 AND u.role = 'admin' ORDER BY 1`, [sq]),
  ]);
  return { admins: admins.map((a) => a.user_id), shownAt: s[0]?.shown_at?.toISOString() ?? null };
}

/**
 * Hide it from new cards (`hide` true: your flag, an admin's, takes it out at once), or Show it again: every admin's flag on it
 * goes, and it's shown over the flags it has (shown_at), so it's back on new cards until two more people flag it. Tier 1: Undo.
 * Cards already ticked keep it either way.
 */
export async function hideSquare(user: SessionUser, id: string, body: { square?: unknown; hide?: unknown }): Promise<{ changeId: string; text: string }> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const sq = typeof body.square === "string" && isUuid(body.square) ? body.square : null;
  if (!sq) throw new HttpError(400, "Which square?");
  if (typeof body.hide !== "boolean") throw new HttpError(400, "hide must be true or false");
  return tx(async (c) => {
    const { rows } = await c.query(`SELECT s.id, s.label, s.episode, s.status, s.shown_at, s.shown_by, ${FLAGGED_OUT("s.id")} AS out FROM bingo_squares s WHERE s.id = $1 AND s.season_id = $2 FOR UPDATE`, [sq, id]);
    const s = rows[0];
    if (!s) throw new HttpError(404, "That square isn't in the bank any more: its squares were written again");
    if (s.status === "dropped") throw new HttpError(400, "Its check dropped it: it's on no card to hide or show");
    if (body.hide === s.out) throw new HttpError(409, body.hide ? "It's out of new cards already" : "It's on new cards already");
    const { rows: admins } = await c.query(`SELECT f.user_id, f.flagged_at FROM bingo_square_flags f JOIN "user" u ON u.id = f.user_id WHERE f.square_id = $1 AND u.role = 'admin'`, [sq]);
    const before = { admins: admins.map((a) => ({ user_id: a.user_id, flagged_at: a.flagged_at.toISOString() })), shownAt: s.shown_at?.toISOString() ?? null, shownBy: s.shown_by };
    if (body.hide) await c.query("INSERT INTO bingo_square_flags (square_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [sq, user.id]);
    else {
      await c.query(`DELETE FROM bingo_square_flags f USING "user" u WHERE u.id = f.user_id AND f.square_id = $1 AND u.role = 'admin'`, [sq]);
      await c.query("UPDATE bingo_squares SET shown_at = clock_timestamp(), shown_by = $2 WHERE id = $1", [sq, user.id]);
    }
    const text = `“${s.label}” ${body.hide ? "hidden" : "shown again"}, by you`;
    const undo: SquareUndo = { ...before, after: await squareNow(c, sq) };
    const changeId = await logDesk(c, { entity: "season", entityId: id, action: "bingo", text, after: { bank: s.episode, square: sq }, undo: { type: "bingoSquare", id: sq, ...undo }, userId: user.id });
    return { changeId, text: body.hide ? "Hidden · out of new cards" : "Shown again · back on new cards" };
  });
}

/** Undo Hide or Show it again: the admins' flags and its shown-again as they were. */
export async function restoreSquare(u: Record<string, unknown>): Promise<void> {
  const sq = String(u.id);
  const was = u as unknown as SquareUndo;
  await tx(async (c) => {
    const { rows } = await c.query("SELECT id FROM bingo_squares WHERE id = $1 FOR UPDATE", [sq]);
    if (!rows.length) throw new HttpError(409, "That square isn't in the bank any more: its squares were written again");
    if (was.after && JSON.stringify(await squareNow(c, sq)) !== JSON.stringify(was.after)) throw new HttpError(409, "It's been hidden or shown again since: that change stands");
    await c.query(`DELETE FROM bingo_square_flags f USING "user" u WHERE u.id = f.user_id AND f.square_id = $1 AND u.role = 'admin'`, [sq]);
    for (const a of was.admins) await c.query(`INSERT INTO bingo_square_flags (square_id, user_id, flagged_at) SELECT $1, id, $3 FROM "user" WHERE id = $2 ON CONFLICT DO NOTHING`, [sq, a.user_id, a.flagged_at]);
    await c.query(`UPDATE bingo_squares SET shown_at = $2, shown_by = (SELECT id FROM "user" WHERE id = $3) WHERE id = $1`, [sq, was.shownAt, was.shownBy]);
  });
}

