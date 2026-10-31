import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import type { Ballots, ChangePlan, ChangePlanItem, StageTrigger } from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { answerChange, ballotsFor, changePlanFor, seatInGame, voteChange } from "@/lib/server/change-stages";
import { HttpError } from "@/lib/server/db";
import { EVERYTHING, seenThrough } from "@/lib/server/guard";
import { leagueStates } from "@/lib/server/league-states";

// A game in stages whose stages a format change starts (docs/PLAN-start-a-game-gpt.md step A12 part 2, change-stages.ts). No screen
// yet (U1's); the engine's API.
//
// GET (a member): { changes: { ok, unanswered }, started: [{ key, stage, copy, from, to, change }], pending: [{ key, stage, until,
// change }] (waiting for the maker's OK until that episode's lock), held (research isn't sure: never acted on), lapsed, skipped, late,
// capped, later: how many more there are past your spoiler mark }, each change { id, kind, from, what }. The plan as the game stands
// now, as far as you've seen (a change is as much a spoiler as the result of the episode whose research said it).
// POST { key, do: 'start' | 'skip' } (whoever runs the game): the maker's answer on a change (a copy's key, `<stage id>@<change
// id>`): start it (once it's waiting for the OK, or one the game carried on past), or skip it (a started copy is taken away, what it
// scored with it). Recorded on the game, then the game settled. Answers the plan as GET does, whatever the maker's mark (answering
// one needs to know it).
// A12 part 3: a side stage's copies are among them (`side` true, keys `<stage id>@<the spell's id>`), a copy's end where its grouping
// changed shown only once you've seen the episode whose research said so (`to` its own end till then); `unplayed` (a grouping that changed
// before its copy played).
// A14 part 1, the players' vote (changes.ok 'vote'): POST { key, vote: 'start' | 'skip' } (a member with a seat in the game) votes on a
// change while it's pending, changeable until it's decided (more than half of the game's seats saying the same), answered as GET. A
// pending change in such a game says `vote` { voted, of, mine }: how many of the seats have voted and yours, never what anyone else
// said (answers that depend on each other stay hidden until it's decided); once it is, every item it's on says `votes` { start, skip }.

const change = (t: StageTrigger | null) => (t ? { id: t.id, kind: t.kind, from: t.from, what: t.what } : null);
/** A14 part 1: how a game that votes on its changes reads them: the votes cast (stage_change_votes) and the reader's seat. */
type Votes = { ballots: Map<string, Ballots>; seat: string | null } | null;
const votesFor = async (state: LeagueState, leagueId: string, userId: string, seat?: string): Promise<Votes> =>
  StateLogic.StageLogic.changesOf(state)?.ok === "vote" ? { ballots: await ballotsFor(leagueId), seat: seat ?? (await seatInGame(leagueId, userId)) } : null;
function view(state: LeagueState, plan: ChangePlan | null, mark: number, votes: Votes = null) {
  // A14 part 1: a vote as it stands: on a pending change, how many have voted and yours; on one it's decided, the votes.
  const voteOf = (key: string | null | undefined, pending: boolean) => {
    if (!votes || !key) return {};
    const ballots = votes.ballots.get(key) ?? {};
    const t = StateLogic.StageLogic.tally(state, ballots);
    if (pending) return { vote: { voted: t.voted, of: t.of, mine: (votes.seat && ballots[votes.seat]) || null } };
    return t.voted ? { votes: { start: t.start, skip: t.skip } } : {};
  };
  let later = 0;
  const seen = <T extends { trigger: StageTrigger | null }>(list: T[]) =>
    list.filter((x) => {
      const ok = !x.trigger || x.trigger.episode <= mark;
      if (!ok) later++;
      return ok;
    });
  const items = (list: ChangePlanItem[], pending = false) =>
    seen(list).map((x) => ({ key: x.key ?? null, stage: x.stage, ...(x.until !== undefined ? { until: x.until } : {}), change: change(x.trigger), ...voteOf(x.key, pending) }));
  const p = plan ?? { entries: [], pending: [], held: [], lapsed: [], skipped: [], late: [], capped: [], superseded: [], unplayed: [], seen: {} };
  // A side copy's end where its grouping changed is as much a spoiler as that episode's result.
  const own = (stage: string) => StateLogic.StageLogic.stages(state).find((s) => s.id === stage)?.game.span?.to ?? null;
  const endOf = (e: ChangePlan["entries"][number]) => {
    const closes = e.side ? e.trigger?.closes : null;
    if (closes && closes.episode > mark) {
      later++;
      return own(e.stage);
    }
    return e.to ?? null;
  };
  return {
    changes: StateLogic.StageLogic.changesOf(state),
    started: seen(p.entries.filter((e) => e.copy !== null)).map((e) => ({ key: e.key, stage: e.stage, copy: e.copy, ...(e.side ? { side: true } : {}), from: e.from, to: endOf(e), change: change(e.trigger), ...voteOf(e.key, false) })),
    pending: items(p.pending, true),
    held: items(p.held),
    lapsed: items(p.lapsed),
    skipped: items(p.skipped),
    late: items(p.late),
    capped: items(p.capped),
    unplayed: items(p.unplayed),
    later,
  };
}

async function gameIn(leagueId: string): Promise<LeagueState> {
  const state = (await leagueStates([leagueId])).get(leagueId);
  if (!state) throw new HttpError(404, "League not found");
  if (!StateLogic.StageLogic.changesOf(state)) throw new HttpError(409, "No format change starts a stage of this game");
  return state;
}

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const state = await gameIn(leagueId);
  const got = await changePlanFor(leagueId);
  const mark = got ? await seenThrough(user.id, got.seasonId) : 0;
  return NextResponse.json(view(state, got?.plan ?? null, mark, await votesFor(state, leagueId, user.id)));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; do?: unknown; vote?: unknown };
  // A14 part 1: a player's vote (any member with a seat), answered at their own mark.
  if (body.vote !== undefined) {
    const { user } = await requireLeagueRole(req, leagueId, "member");
    await gameIn(leagueId);
    if (typeof body.key !== "string" || !body.key) throw new HttpError(400, "Which change: its key");
    const { settled, seat } = await voteChange(leagueId, body.key, String(body.vote), { id: user.id }, { markOf: (seasonId) => seenThrough(user.id, seasonId) });
    const state = await gameIn(leagueId);
    const mark = settled ? await seenThrough(user.id, settled.seasonId) : 0;
    return NextResponse.json(view(state, settled?.plan ?? null, mark, await votesFor(state, leagueId, user.id, seat)));
  }
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  await gameIn(leagueId);
  if (typeof body.key !== "string" || !body.key) throw new HttpError(400, "Which change: its key");
  const done = await answerChange(leagueId, body.key, String(body.do), { id: user.id, name: (user as { username?: string | null }).username || user.name });
  const state = await gameIn(leagueId);
  return NextResponse.json(view(state, done?.plan ?? null, EVERYTHING, await votesFor(state, leagueId, user.id)));
});
