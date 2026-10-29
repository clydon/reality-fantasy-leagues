import { buildCastPrompt, parseCastImport } from "@/lib/game/formats/cast-prompt.js";
import type { CastFormat } from "@/lib/game/formats/cast-prompt";
import { publicMediaSrc } from "@/lib/game/selectors";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { castChanges, castPlan, changesLine, type CastChange, type CastPicks, type TheirCastaway } from "@/lib/desk-cast-diff";
import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { seasonFormat } from "@db/season-rule-changes.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { askBot } from "./ask-bot";
import { pool, tx, HttpError } from "./db";
import { gamesOn, groupColors, isSecretRole, secretRolesOf, termsOf } from "./desk-cast";
import { SEASON_NAME, logDesk, type DeskLine } from "./desk";
import { mdIn, plural, whenAt } from "./desk-dates";
import type { MoveLine } from "./desk-episode";
import { deskSetup, type SeasonDelete } from "./desk-setup";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { castPhotosFor } from "./show-art";
import { applyApprovedCastToLeagues, renameInSeasonDecisions, seasonCastRows } from "./season-cast";
import { syncSeasonLeagues } from "./season-decisions";

// A season's Cast on the desk (docs/PLAN-desk-parity.md step 5, part 5a; the mock's desk-cast.js csPage): its lower third (In
// the games, Not sent or No cast), where its cast came from, a cast answer that changes something leading with See what
// changed, Getting it (Ask our bot, through Research's Run now queue; or Paste it: Ask an AI on the same question), its
// starting groups and the cast by group, History and the season's Delete. No wiki (decision 9).
//
// An answer is staged (season_cast_answers, 0426), never written into the cast: the review (desk-cast-diff.ts) says what it
// changes (a new spelling of someone, with Same person or Someone new; a starting group it has differently, Keep ours or Use
// theirs; someone new; someone it no longer lists, said and never taken out), and Send to its games (tier 2, what moves said
// first) writes it: a rename by id, so every game, team, pick and result keeps them; then every game gets the cast
// (applyApprovedCastToLeagues) and any results waiting on it land (syncSeasonLeagues), as classic's approve did. A season whose
// cast was staged and never approved (classic's pull) is a first send: everyone joins its games. Undo from History puts the
// cast back as it was sent, refused once someone who joined is on a team.

const MIN = 60_000;
/** A queued ask the page waits on: past this its driver was cut off, and Research's read takes the queue over. */
const ASK_WAIT_MS = 15 * MIN;

interface SeasonRow {
  id: string;
  name: string;
  show_id: string;
  show_name: string;
  slug: string;
  season_number: number;
  cast_approved_at: Date | null;
  tribes_from_episode: number | null;
  castaway_term: string | null;
  tribe_term: string | null;
  air_tz: string | null;
}

async function seasonRow(id: string): Promise<SeasonRow> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query<SeasonRow>(
    `SELECT ss.id, ${SEASON_NAME} AS name, ss.show_id, s.name AS show_name, s.slug, ss.season_number, ss.cast_approved_at, ss.tribes_from_episode,
            s.castaway_term, s.tribe_term, ss.air_tz
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

type Terms = ReturnType<typeof termsOf>;

/** The rules a cast is read against (the season's format, in the show's own words): whether it has groups, and its roles. */
async function castFormat(s: SeasonRow): Promise<CastFormat> {
  const f = await seasonFormat(pool, s.id);
  return {
    name: s.show_name,
    hasGroups: !!f?.hasGroups,
    roles: f?.roles,
    terms: { ...(f?.terms ?? {}), castaway: s.castaway_term || f?.terms?.castaway || "Castaway", tribe: s.tribe_term || f?.terms?.tribe || "Tribe" },
  } as CastFormat;
}

interface Ours {
  id: string;
  name: string;
  group: string | null;
  photo: string | null;
  locked: boolean;
}

const castOf = async (id: string): Promise<Ours[]> =>
  (await pool.query("SELECT id, name, tribe_name, photo_url, locked_at FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [id])).rows.map((c) => ({
    id: c.id,
    name: c.name,
    group: c.tribe_name,
    photo: c.photo_url,
    locked: !!c.locked_at,
  }));

interface AnswerRow {
  id: string;
  source: "bot" | "paste";
  people: TheirCastaway[];
  by_user: string | null;
  who: string | null;
  created_at: Date;
  sent_at: Date | null;
}

const latestAnswer = async (id: string): Promise<AnswerRow | null> =>
  (
    await pool.query<AnswerRow>(
      `SELECT a.id, a.source, a.people, a.by_user, COALESCE(u.username, u.name) AS who, a.created_at, a.sent_at
         FROM season_cast_answers a LEFT JOIN "user" u ON u.id = a.by_user WHERE a.season_id = $1 ORDER BY a.created_at DESC LIMIT 1`,
      [id]
    )
  ).rows[0] ?? null;

/** Whether this season's people start in groups: its format says so, or its cast already has some. */
const hasGroups = (f: CastFormat, ours: Ours[]) => !!f.hasGroups || ours.some((c) => c.group);

/** "Our bot's answer", "Your paste", "kat's paste". */
const fromWords = (a: AnswerRow, me: string | null) => (a.source === "bot" ? "Our bot's answer" : a.by_user && a.by_user === me ? "Your paste" : `${a.who ?? "An admin"}'s paste`);

interface Review {
  s: SeasonRow;
  terms: Terms;
  ours: Ours[];
  answer: AnswerRow | null;
  /** The latest answer, not sent yet. */
  pending: AnswerRow | null;
  changes: CastChange[];
  /** Its cast has never been sent: its games have nobody from it yet. */
  first: boolean;
  /** There's something to send. */
  open: boolean;
  games: number;
}

/** The season's cast against its latest answer: what it changes, and whether anything waits to be sent. */
async function reviewOf(id: string): Promise<Review> {
  const s = await seasonRow(id);
  const [ours, answer, games, format] = await Promise.all([castOf(id), latestAnswer(id), gamesOn(id), castFormat(s)]);
  const pending = answer && !answer.sent_at ? answer : null;
  const changes = pending ? castChanges(ours, pending.people, { groups: hasGroups(format, ours) }) : [];
  const first = !s.cast_approved_at && ours.length > 0;
  const open = first || (!!pending && changes.length > 0);
  return { s, terms: termsOf(s), ours, answer, pending, changes, first, open, games };
}

const gamesWord = (n: number) => (n ? plural(n, "game") : "no games");

// ---------- the page ----------

export interface CastFace {
  id: string;
  name: string;
  group: string | null;
  photo: string | null;
  locked: boolean;
  /** The episode an accepted result put them out in. */
  out: number | null;
}

export interface CastReviewChange {
  change: CastChange;
  /** The face it's about (ours), for its row. */
  photo: string | null;
  /** A starting group's change: what it may mean ("A swap moved Carter to Toka: the answer may mean their tribe now"). */
  note: string | null;
}

export interface DeskCast {
  id: string;
  name: string;
  show: { id: string; name: string };
  terms: Terms;
  state: "none" | "review" | "sent";
  tag: "No cast" | "Not sent" | "In the games";
  detail: string;
  meta: string | null;
  games: number;
  /** Ask our bot while it's queued or asking: what the page says, and that it polls. */
  asking: string | null;
  review: {
    title: string;
    line: string;
    /** The answer it reviews (Send names it, so a newer one can't be sent unseen); null for a first send of the cast as staged. */
    answerId: string | null;
    from: string;
    changes: CastReviewChange[];
    first: boolean;
  } | null;
  groups: { name: string; people: number; secretRole: boolean; color: string | null }[];
  /** Hold them until Episode N (tribes_from_episode): on, and the episode they wait for. */
  hold: { on: boolean; episode: number };
  cast: CastFace[];
  history: DeskLine[];
  delete: SeasonDelete;
}

/** The roles the season's rulebook keeps secret: a group named like one gives the role away. */
const secretRoles = async (id: string) => secretRolesOf((await ensureSeasonRulebook(pool, id))?.row.blocks);

export async function deskCast(user: SessionUser, id: string, now = new Date()): Promise<DeskCast> {
  const r = await reviewOf(id);
  const { s, terms, ours } = r;
  const [setup, { rows: outs }, { rows: asking }, colors, roles, history] = await Promise.all([
    deskSetup(id, now),
    pool.query(
      `SELECT lower(COALESCE(d.applied->>'castawayName', d.castaway_name)) AS name, min(d.episode_number)::int AS ep
         FROM season_decisions d WHERE d.season_id = $1 AND d.kind = 'elimination' AND d.status = 'accepted' GROUP BY 1`,
      [id]
    ),
    pool.query("SELECT started_at FROM desk_runs WHERE season_id = $1 AND kind = 'cast' AND done_at IS NULL AND asked_at > now() - make_interval(secs => $2) LIMIT 1", [id, ASK_WAIT_MS / 1000]),
    // Each group's colour, as its games draw it.
    groupColors(id),
    secretRoles(id),
    castHistory(id),
  ]);
  const tz = s.air_tz || "America/New_York";
  const out = new Map(outs.map((o) => [o.name as string, o.ep as number]));
  const counts = new Map<string, number>();
  for (const c of ours) if (c.group) counts.set(c.group, (counts.get(c.group) ?? 0) + 1);
  const groups = [...counts].map(([name, people]) => ({ name, people, secretRole: isSecretRole(name, roles), color: colors.get(name.toLowerCase()) ?? null }));
  const state: DeskCast["state"] = r.open ? "review" : ours.length ? "sent" : "none";
  const secret = groups.some((g) => g.secretRole);

  const from = r.answer ? `From ${r.answer.source === "bot" ? "our bot" : "a paste"} · ${r.answer.source === "bot" ? "asked" : "pasted"} ${whenAt(r.answer.created_at, tz, now).toLowerCase()}` : null;
  const sent = s.cast_approved_at ? `sent ${mdIn(s.cast_approved_at, tz, now)} to ${gamesWord(r.games)}` : null;
  const ask = asking.length ? (asking[0].started_at ? "Asking our bot for its cast now · about a minute" : "Waiting to ask our bot for its cast") : null;
  const meta = cap([from, sent].filter(Boolean).join(" · "));

  let review: DeskCast["review"] = null;
  if (r.open) {
    const changes = r.changes.map((change) => ({ change, photo: photoOf(ours, change), note: null as string | null }));
    await groupNotes(id, changes, terms);
    const by = r.pending ? fromWords(r.pending, user.id) : null;
    const n = r.changes.length;
    review = {
      title: by ? `${by}: ${n ? plural(n, "change") : "nothing new"}, not sent` : `${plural(ours.length, terms.person, terms.people)}, not sent`,
      line: r.first
        ? r.games
          ? `${r.games > 1 ? `Its ${plural(r.games, "game")} have` : "Its game has"} nobody from it yet: nothing to draft or pick from until you send it.`
          : "No games on it yet: the first one gets the cast once it's sent."
        : r.games
          ? `${r.games > 1 ? `Its ${plural(r.games, "game")} keep` : "Its game keeps"} the cast as it was sent until you send it. Sending never takes anyone out of a game.`
          : "No games on it yet. Sending never takes anyone out of a game.",
      answerId: r.pending?.id ?? null,
      from: by ? `${by.toLowerCase()}, ${whenAt(r.pending!.created_at, tz, now).toLowerCase()}` : "the cast as it was staged",
      changes,
      first: r.first,
    };
  }

  const people = ours.length;
  return {
    id,
    name: s.name,
    show: { id: s.show_id, name: s.show_name },
    terms,
    state,
    tag: state === "none" ? "No cast" : state === "review" ? "Not sent" : "In the games",
    detail: people ? `${plural(people, terms.person, terms.people)}${groups.length && !secret ? ` · ${plural(groups.length, terms.group, terms.groups)}` : ""}` : "Nothing to draft or pick from",
    meta: meta || null,
    games: r.games,
    asking: ask,
    review,
    groups,
    hold: { on: s.tribes_from_episode != null, episode: s.tribes_from_episode ?? 1 },
    cast: ours.map((c) => ({ id: c.id, name: c.name, group: c.group, photo: publicMediaSrc(c.photo), locked: c.locked, out: out.get(c.name.toLowerCase()) ?? null })),
    history,
    delete: setup.delete,
  };
}

function photoOf(ours: Ours[], c: CastChange): string | null {
  if (c.k === "add") return publicMediaSrc(c.photo);
  const o = ours.find((x) => x.id === c.id);
  return publicMediaSrc(o?.photo ?? null);
}

/** A starting group the answer has differently: when a game already has them on its group now (a swap), it may mean that. */
async function groupNotes(id: string, changes: CastReviewChange[], terms: Terms): Promise<void> {
  const g = changes.filter((x) => x.change.k === "group");
  if (!g.length) return;
  const { rows } = await pool.query(`SELECT l.state FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE ss.id = $1 AND l.deleted_at IS NULL ORDER BY l.created_at LIMIT 1`, [id]);
  const st = rows[0]?.state as LeagueState | undefined;
  for (const x of g) {
    const c = x.change as Extract<CastChange, { k: "group" }>;
    const first = c.name.split(" ")[0];
    const inGame = st?.castaways.find((k) => k.seasonCastId === c.id);
    const now = inGame ? st!.tribes.find((t) => t.id === inGame.tribeId)?.name : null;
    x.note =
      now && now.toLowerCase() === c.to.toLowerCase() && (c.from ?? "").toLowerCase() !== c.to.toLowerCase()
        ? `We have ${c.from ?? `no ${terms.group}`}. A swap moved ${first} to ${c.to}: the answer may mean their ${terms.group} now.`
        : `We have ${c.from ?? `no ${terms.group}`}.`;
  }
}

/** The page's History: the cast's desk lines (asks, answers, pastes, sends) and groups taken out. */
async function castHistory(id: string): Promise<DeskLine[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.text, c.created_at, c.undo IS NOT NULL AND c.undone_at IS NULL AS undoable, c.undone_at IS NOT NULL AS undone, COALESCE(u.username, u.name) AS who
       FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id
      WHERE c.entity = 'season' AND c.entity_id = $1 AND c.action IN ('cast', 'clearGroup') ORDER BY c.created_at DESC LIMIT 40`,
    [id]
  );
  return rows.map((r) => ({ id: r.id, text: r.text, at: r.created_at.toISOString(), who: r.who, undoable: r.undoable, undone: r.undone }));
}

// ---------- the season page's row, and the Inbox ----------

/** Running it › Cast's line, and whether it carries the dot (something waits to be sent). `me`: who's looking ("Your paste"). */
export async function castRow(id: string, me: string): Promise<{ line: string; need: boolean }> {
  const r = await reviewOf(id);
  const { terms, ours } = r;
  if (r.open) {
    if (r.pending && r.changes.length) return { line: `${fromWords(r.pending, me)}: ${changesLine(r.changes, terms)} · not sent to its games`, need: true };
    return { line: `${plural(ours.length, terms.person, terms.people)}, not sent to its games`, need: true };
  }
  if (!ours.length) return { line: "No cast yet: nothing to draft or pick from", need: false };
  return { line: `${plural(ours.length, terms.person, terms.people)} · ${r.games > 1 ? `in all ${plural(r.games, "game")}` : r.games ? "in its game" : "no games on it yet"}`, need: false };
}

const poss = (n: string) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);

/** The Inbox's cast items (docs/PLAN-desk-parity.md Noticed k): a cast answer, our bot's or a paste, with changes not sent; or a
 *  cast staged and never sent (classic's pull). */
export async function castInboxItems(): Promise<{ kind: "cast"; title: string; line: string; href: string }[]> {
  const { rows } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.archived = false AND s.set_up_at IS NOT NULL AND ss.status <> 'completed'
        AND ((ss.cast_approved_at IS NULL AND EXISTS (SELECT 1 FROM season_cast sc WHERE sc.season_id = ss.id))
          OR (SELECT a.sent_at IS NULL FROM season_cast_answers a WHERE a.season_id = ss.id ORDER BY a.created_at DESC LIMIT 1))
      ORDER BY s.name, ss.season_number LIMIT 20`
  );
  const out: { kind: "cast"; title: string; line: string; href: string }[] = [];
  for (const r of await Promise.all(rows.map((x) => reviewOf(x.id)))) {
    if (!r.open) continue;
    const id = r.s.id;
    const href = `/desk/season/${id}/cast`;
    const games = r.games ? `not sent to its ${plural(r.games, "game")} yet` : "no games on it yet";
    if (r.first && !(r.pending && r.changes.length))
      out.push({ kind: "cast", title: `${poss(r.s.name)} cast isn't in its games`, line: `${plural(r.ours.length, r.terms.person, r.terms.people)}, not sent · ${games}`, href });
    else
      out.push({
        kind: "cast",
        title: `${poss(r.s.name)} cast: ${r.pending!.source === "bot" ? "our bot's answer" : "a paste"} has changes`,
        line: `${changesLine(r.changes, r.terms)} · ${games}`,
        href,
      });
  }
  return out;
}

// ---------- getting it: our bot's question, its answer, a paste ----------

/** The question our bot is asked, and Paste it's (cast-prompt.js, in the show's own words). */
export async function castQuestion(id: string): Promise<{ prompt: string; task: string }> {
  const s = await seasonRow(id);
  return { prompt: buildCastPrompt(await castFormat(s), { seasonName: s.name, showName: s.show_name }), task: `finding who's in ${s.name}` };
}

/** An answer read against the season's rules: the people it lists (rows with a problem left out). Nobody readable refuses. */
async function readAnswer(s: SeasonRow, answer: string): Promise<TheirCastaway[]> {
  let parsed;
  try {
    parsed = parseCastImport(answer, await castFormat(s));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "That answer can't be read");
  }
  const ok = parsed.castaways.filter((c) => !c.problems.length);
  if (!ok.length) throw new HttpError(400, parsed.castaways[0]?.problems[0] ? `Nobody in it could be read: ${parsed.castaways[0].problems[0]}` : "That answer lists nobody.");
  return ok.map((c) => ({ name: c.name.trim(), group: c.startingGroup?.trim() || null, photo: c.photoUrl?.trim() || null }));
}

/** An answer, staged: never written into the cast. Its History line says what it changes. */
async function stage(s: SeasonRow, source: "bot" | "paste", answer: string, people: TheirCastaway[], by: string | null): Promise<string> {
  const ours = await castOf(s.id);
  const terms = termsOf(s);
  const changes = castChanges(ours, people, { groups: hasGroups(await castFormat(s), ours) });
  const groups = new Set(people.map((p) => p.group).filter(Boolean)).size;
  const what = !ours.length
    ? `${plural(people.length, terms.person, terms.people)}${groups ? ` in ${plural(groups, terms.group, terms.groups)}` : ""}, not sent`
    : changes.length
      ? `${changesLine(changes, terms)}, not sent`
      : "nothing changed";
  const text = `${source === "bot" ? "Our bot's answer" : "Pasted"}: ${what}`;
  await tx(async (c) => {
    // One that changes nothing has nothing to send: it's settled at once, so a later change to the cast never reads it as news.
    await c.query("INSERT INTO season_cast_answers (season_id, source, answer, people, by_user, sent_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6)", [
      s.id,
      source,
      answer.slice(0, 200_000),
      JSON.stringify(people),
      by,
      ours.length && !changes.length ? new Date() : null,
    ]);
    await logDesk(c, { entity: "season", entityId: s.id, action: "cast", text, userId: source === "bot" ? null : by });
  });
  return text;
}

/** Our bot's turn in the Run now queue (desk-research.ts drainDeskRuns): asks, reads and stages its answer. Never throws. */
export async function askCastNow(id: string, askedBy: string | null, bot: string | undefined, budgetMs: number): Promise<{ ok: boolean; message: string }> {
  try {
    const s = await seasonRow(id);
    const { prompt } = await castQuestion(id);
    const { answer } = await askBot(prompt, { bot, budgetMs });
    const people = await readAnswer(s, answer);
    return { ok: true, message: await stage(s, "bot", answer, people, askedBy) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logDesk(pool, { entity: "season", entityId: id, action: "cast", text: `Asked our bot for the cast: it failed (${message.slice(0, 200)})`, userId: null }).catch(() => undefined);
    return { ok: false, message };
  }
}

/** Paste it: an answer from Ask an AI, staged as our bot's is. Answers the page. */
export async function pasteCast(user: SessionUser, id: string, raw: unknown): Promise<{ text: string }> {
  const s = await seasonRow(id);
  const answer = typeof raw === "string" ? raw.trim() : "";
  if (!answer) throw new HttpError(400, "Paste the answer first");
  const people = await readAnswer(s, answer);
  return { text: await stage(s, "paste", answer, people, user.id) };
}

// ---------- Send to its games ----------

const PICKS = new Set(["same", "new", "ours", "theirs"]);
function picksOf(raw: unknown): CastPicks {
  const out: CastPicks = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string" && PICKS.has(v)) out[k] = v as CastPicks[string];
  return out;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Send to its games (tier 2): with `preview`, what moves (each change, then "Teams, picks and results: stay as they are" and
 * how many people each game has); else written in one transaction (renames by id, people joining, starting groups), the
 * answer marked sent, the cast approved, a History line with Undo; then every game gets it and results waiting on it land.
 */
export async function sendCast(
  user: SessionUser,
  id: string,
  body: { answer?: unknown; picks?: unknown; preview?: unknown },
  o: { listings?: string } = {}
): Promise<{ lines: MoveLine[]; title: string } | { changeId: string; text: string }> {
  const r = await reviewOf(id);
  const { s, terms, ours } = r;
  if (!r.open) throw new HttpError(409, "Nothing to send: its games have the cast as it is");
  if ((body.answer ?? null) !== (r.pending?.id ?? null)) throw new HttpError(409, "A newer answer came in: look at what changed again");
  const plan = castPlan(r.changes, picksOf(body.picks));
  const after = ours.length + plan.add.length;
  const before = s.cast_approved_at ? ours.length : 0;
  const first = (name: string) => name.split(" ")[0];
  if (body.preview === true) {
    const face = (cid: string) => {
      const c = ours.find((x) => x.id === cid)!;
      return { name: c.name, photo: publicMediaSrc(c.photo) };
    };
    const lines: MoveLine[] = [
      ...plan.rename.map((x) => ({ face: face(x.id), icon: null, label: x.from, change: `Renamed ${first(x.to)}` })),
      ...plan.regroup.map((x) => ({ face: face(x.id), icon: null, label: first(x.name), change: `Starts on ${x.to}` })),
      ...(plan.add.length > 4
        ? [{ face: null, icon: "plus" as const, label: plural(plan.add.length, `new ${terms.person}`, `new ${terms.people}`), change: "Join as nobody's" }]
        : plan.add.map((x) => ({ face: null, icon: "plus" as const, label: x.name, change: "Joins as nobody's" }))),
      ...(r.first && ours.length ? [{ face: null, icon: "people" as const, label: `${plural(ours.length, terms.person, terms.people)} in the cast`, change: "Join its games" }] : []),
      { face: null, icon: "people", label: "Teams, picks and results", change: "Stay as they are" },
      { face: null, icon: "user", label: `${cap(terms.people)} in each game`, change: after === before ? "The same people" : before ? `${after}, from ${before}` : `${after}` },
    ];
    return { lines, title: r.games ? `Send to its ${plural(r.games, "game")}?` : "Send it?" };
  }
  // Photos for people joining with none: the season's credits' (TMDB's, else TVmaze's).
  const want = plan.add.filter((a) => !a.photo).map((a) => a.name);
  const found = want.length ? await castPhotosFor(id, want, o.listings) : new Map<string, string>();
  const summary = [
    plan.rename.length && plural(plan.rename.length, "rename"),
    plan.add.length && `${plan.add.length} joining`,
    plan.regroup.length && plural(plan.regroup.length, `starting ${terms.group}`, `starting ${terms.groups}`),
  ]
    .filter(Boolean)
    .join(", ");
  const text = `Sent${r.games ? ` to its ${plural(r.games, "game")}` : ""}${summary ? `: ${summary}` : r.first ? `: ${plural(ours.length, terms.person, terms.people)}` : ": nothing changed"}`;
  const added: string[] = [];
  const changeId = await tx(async (c) => {
    const log = (castId: string | null, field: string, b: string | null, a: string | null) =>
      c.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, $2, $3, $4, $5, $6)", [id, castId, field, b, a, user.id]);
    if (r.pending) {
      const { rowCount } = await c.query("UPDATE season_cast_answers SET sent_at = now(), sent_by = $2 WHERE id = $1 AND sent_at IS NULL", [r.pending.id, user.id]);
      if (!rowCount) throw new HttpError(409, "That answer's been sent already");
    }
    // With it, any older answer never sent is done with too (only the latest is ever reviewed).
    await c.query("UPDATE season_cast_answers SET sent_at = now() WHERE season_id = $1 AND sent_at IS NULL AND created_at < $2", [id, r.pending?.created_at ?? new Date()]);
    try {
      for (const x of plan.rename) {
        const { rowCount } = await c.query("UPDATE season_cast SET name = $3 WHERE id = $1 AND season_id = $2 AND name = $4", [x.id, id, x.to, x.from]);
        if (!rowCount) throw new HttpError(409, `${x.from} has changed since: look at what changed again`);
        await renameInSeasonDecisions(c, id, x.from, x.to);
        await log(x.id, "name", x.from, x.to);
      }
      for (const x of plan.regroup) {
        await c.query("UPDATE season_cast SET tribe_name = $3 WHERE id = $1 AND season_id = $2", [x.id, id, x.to]);
        await log(x.id, "tribe", x.from, x.to);
      }
      for (const x of plan.add) {
        const { rows } = await c.query(
          `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order)
           VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(sort_order), -1) + 1 FROM season_cast WHERE season_id = $1)) RETURNING id`,
          [id, x.name, x.group, x.photo || found.get(x.name) || null]
        );
        added.push(rows[0].id);
        await log(rows[0].id, "added", null, x.name);
      }
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new HttpError(409, "Someone in the cast already has one of those names: send it as the same person instead");
      throw e;
    }
    await c.query(
      `UPDATE show_seasons SET cast_approved_at = COALESCE(cast_approved_at, now()), cast_approved_by = COALESCE(cast_approved_by, $2),
              cast_size = (SELECT count(*)::int FROM season_cast WHERE season_id = $1), updated_at = now() WHERE id = $1`,
      [id, user.id]
    );
    return logDesk(c, {
      entity: "season",
      entityId: id,
      action: "cast",
      text,
      undo: { type: "castSend", seasonId: id, answerId: r.pending?.id ?? null, renamed: plan.rename, regrouped: plan.regroup, added, approved: !!s.cast_approved_at },
      userId: user.id,
    });
  });
  await toGames(id);
  return { changeId, text: r.games > 1 ? `Sent · its ${plural(r.games, "game")} have the cast` : r.games ? "Sent · its game has the cast" : "Sent · no games on it yet" };
}

/** Every game on the season gets its cast as it is now; results waiting on someone in it land. */
async function toGames(id: string, removed: string[] = []): Promise<void> {
  const s = await seasonRow(id);
  const cast = s.cast_approved_at ? await seasonCastRows(id) : [];
  await applyApprovedCastToLeagues(s.slug, s.season_number, cast, s.tribes_from_episode ?? null, { removed });
  if (s.cast_approved_at) await syncSeasonLeagues(id, null);
}

/** History's Undo of a Send: the cast as it was sent. Refused once someone who joined is on a team, or a rename moved on. */
export async function restoreCastSend(u: Record<string, unknown>, changeId: string): Promise<void> {
  const id = String(u.seasonId);
  await seasonRow(id);
  // Only the latest send standing undoes: an older one would overwrite what came after it.
  const { rows: later } = await pool.query(
    `SELECT 1 FROM admin_changes c WHERE c.entity = 'season' AND c.entity_id = $1 AND c.action = 'cast' AND c.undo->>'type' = 'castSend' AND c.undone_at IS NULL
        AND c.created_at > (SELECT created_at FROM admin_changes WHERE id = $2) LIMIT 1`,
    [id, changeId]
  );
  if (later.length) throw new HttpError(409, "The cast's been sent again since: undo that first");
  const renamed = (u.renamed ?? []) as { id: string; from: string; to: string }[];
  const regrouped = (u.regrouped ?? []) as { id: string; name: string; from: string | null; to: string }[];
  const approved = !!u.approved;
  const added = (u.added ?? []) as string[];
  // Before its first send nobody in it was in a game: all of them go back out of the games (the cast it had stays, staged).
  const out = approved ? added : (await castOf(id)).map((c) => c.id);
  if (out.length) {
    const { rows } = await pool.query(`SELECT l.name, l.state FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE ss.id = $1 AND l.deleted_at IS NULL`, [id]);
    for (const l of rows) {
      const st = l.state as LeagueState;
      const busy = st.castaways.find((c) => c.seasonCastId && out.includes(c.seasonCastId) && StateLogic.castawayInUse(st, c.id));
      if (busy) throw new HttpError(409, `${busy.name} is on a team or in a result in ${l.name} now: take them out from their page instead`);
    }
  }
  await tx(async (c) => {
    for (const x of renamed) {
      const { rowCount } = await c.query("UPDATE season_cast SET name = $3 WHERE id = $1 AND season_id = $2 AND name = $4", [x.id, id, x.from, x.to]);
      if (!rowCount) throw new HttpError(409, `${x.to} has been renamed since: change their name from their page`);
      await renameInSeasonDecisions(c, id, x.to, x.from);
    }
    for (const x of regrouped) {
      const { rowCount } = await c.query("UPDATE season_cast SET tribe_name = $3 WHERE id = $1 AND season_id = $2 AND tribe_name IS NOT DISTINCT FROM $4", [x.id, id, x.from, x.to]);
      if (!rowCount) throw new HttpError(409, `${x.name} has started somewhere else since: change it from their page`);
    }
    if (added.length) await c.query("DELETE FROM season_cast WHERE id = ANY($1::uuid[]) AND season_id = $2", [added, id]);
    if (u.answerId) await c.query("UPDATE season_cast_answers SET sent_at = NULL, sent_by = NULL WHERE id = $1", [u.answerId]);
    await c.query(
      `UPDATE show_seasons SET cast_approved_at = CASE WHEN $2 THEN cast_approved_at END, cast_approved_by = CASE WHEN $2 THEN cast_approved_by END,
              cast_size = (SELECT count(*)::int FROM season_cast WHERE season_id = $1), updated_at = now() WHERE id = $1`,
      [id, approved]
    );
  });
  await toGames(id, out);
}
