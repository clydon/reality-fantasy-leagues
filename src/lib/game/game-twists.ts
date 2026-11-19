import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { scoredEpisodes } from "./team-episode-breakdown";

// A game's twists as one seat may see them (docs/PLAN-start-a-game-gpt.md U1 step 2; BACKLOG 40): what the engine already works out
// on the viewer's own copy (game-view.ts's `view`, cut at their mark), for the game's own page to draw where the grammar puts each
// one (src/lib/game/game-page): your captain for the next episode, a pool's lives and mulligans and whether you can buy back in, your
// group slots, the next cut and who it has knocked out, the next episode whose points multiply, what bounties have moved, and the
// budget each team has left. Secret roles and a twist chosen by the top scorer live on the server (secret-roles.ts, twists.ts):
// their own routes, read by the page. Each field null when the game doesn't have it. Pure, for the tests.

export interface GameTwists {
  /** Your captain going into the next episode and what they score at (a lineup's: score.captain). */
  captain: { episode: number; castawayId: string | null; times: number } | null;
  /** A Survival Pool's lives or mulligans (score.lives, score.mulligans, score.buyback): what's left, out since when, and whether
   *  buying back in is open to you now. */
  pool: { lives: number | null; livesOf: number | null; mulligans: number | null; mulligansOf: number; out: number | null; buyBack: boolean; buybacks?: { left: number; of: number; cost: number } | null } | null;
  /** Your group slots going into the next episode (get.groups): each slot's standing and its group's name. */
  slots: { slot: number; status: "held" | "void" | "dropped" | "waiting" | "empty"; group: string | null; groupId: string | null; members: string[]; endedAt?: number | null; why?: string[] }[] | null;
  /** The groups a slot can pick going into the next episode, and that episode's id (the group-slots route's). Round 5 (B2): each
   *  group's people (castaway ids) and, in an exclusive game, the seats already holding it for that episode (`heldBy`). */
  offered: { epId: string; groups: { id: string; name: string; size: number; members?: string[]; heldBy?: string[] }[] } | null;
  /** The next cut (rank.cut): the episode it falls after (null: at a phase, or none left), the phase by name, how many go. */
  cut: { after: number | null; phase: string | null; out: number | "half" } | null;
  /** Seats knocked out (a cut, a race won, a pool's lives), as far as you've seen. */
  out: string[];
  /** Round 5 (B2, Designs needed 10): the episode you were knocked out after (a cut, a race won), as far as you've seen; null while
   *  you're in, or in a game that knocks nobody out. */
  outAfter?: number | null;
  /** The next episode whose points multiply (score.times), and by how much. */
  times: { episode: number; times: number } | null;
  /** Bounties (score.bounty): each seat's points from them so far, by player id. */
  bounty: Record<string, number> | null;
  /** A salary cap's room left or a stock market's cash, by player id. */
  budget: Record<string, number> | null;
}

/** The game's twists for `me` (no seat: "") at the viewer's mark; `next` the episode moves are for now; `last` the season's (or
 *  span's) last episode, so a multiplied finale is found though your copy stops at your mark (which episode multiplies is the
 *  spec's, not a result). */
export function twistsOf(view: LeagueState, me: string, next: number, teams: Map<string, string[]>, last: number | null = null): GameTwists {
  const S = StateLogic;
  const seat = me !== "";
  const through = S.SpoilerLogic.latestWithResults(view);
  const episodes = [...(view.episodes ?? [])].sort((a, b) => a.number - b.number);
  const nextEp = episodes.find((e) => e.number === next) ?? null;

  const times = S.ActiveRosterLogic.captainTimes(view);
  const captain = seat && times > 0 && nextEp ? { episode: next, castawayId: S.ActiveRosterLogic.captainFor(view, nextEp.id, me), times } : null;

  const parts = S.PickEmLogic.parts(view);
  let pool: GameTwists["pool"] = null;
  if (seat && parts && (parts.lives || parts.mulligans || parts.buyback)) {
    const h = S.pickEmHistory(view, me);
    const out = h.out ?? null;
    pool = {
      lives: parts.lives ? (h.lives ?? parts.lives) : null,
      livesOf: parts.lives,
      // The history carries the mulligans LEFT (Seq.poolTally counts them down), not those used.
      mulligans: parts.mulligans ? Math.max(0, h.mulligans ?? parts.mulligans) : null,
      mulligansOf: parts.mulligans,
      out,
      // A buyback is automatic (Seq.poolEmptied, the night the lives run out): someone out had none left or was past its deadline
      // that night, so this holds only should a buyback still be left and in time for the night they went out.
      buyBack: !!parts.buyback && out !== null && (h.buybacks ?? 0) > 0 && S.PickEmLogic.canBuyBack(view, parts.buyback, out),
      // Round 5 (B2): the buy-backs left, of how many, and what one costs, for the pick sheet's line.
      buybacks: parts.buyback ? { left: Math.max(0, h.buybacks ?? parts.buyback.times), of: parts.buyback.times, cost: parts.buyback.cost } : null,
    };
  }

  const cfg = S.GroupSlotLogic.config(view);
  let slots: GameTwists["slots"] = null;
  let offeredOut: GameTwists["offered"] = null;
  if (seat && cfg && nextEp) {
    const on = S.GroupSlotLogic.offered(view, next);
    const offered = on.groups;
    // In an exclusive game (and while the groups cover everyone), who already holds each group for the episode: the route refuses it.
    const own = cfg.own === "exclusive" && !on.shared;
    const holders = (id: string) =>
      own ? (view.players ?? []).map((p) => p.id).filter((pid) => pid !== me && Array.from({ length: cfg.slots }, (_, k) => S.GroupSlotLogic.latestPick(view, pid, k, next)?.pick?.id).includes(id)) : [];
    offeredOut = { epId: nextEp.id, groups: offered.map((g) => ({ id: g.id, name: g.name, size: g.members.length, members: g.members.slice(), heldBy: holders(g.id) })) };
    slots = Array.from({ length: cfg.slots }, (_, slot) => {
      const st = S.GroupSlotLogic.standing(view, me, slot, next);
      const id = st.pick?.id ?? null;
      // A group no longer on offer (dropped: re-paired) is named as it was when it was picked.
      const then = id && st.from ? S.GroupSlotLogic.record(view, st.from - 1)?.end.groups.find((g) => g.id === id)?.name : null;
      return { slot, status: st.status, group: id ? (offered.find((g) => g.id === id)?.name ?? then ?? null) : null, groupId: id, members: st.members.length ? st.members : (st.pick?.members ?? []), endedAt: st.endedAt ?? null, why: st.why ?? [] };
    });
  }

  const ko = S.KnockoutLogic.parts(view);
  let cut: GameTwists["cut"] = null;
  const first = ko?.cuts?.[0];
  if (first) {
    const from = S.GhostLogic.startFor(view, me) ?? 1;
    const every = first.at.every;
    const after = every ? from - 1 + every * Math.max(1, Math.ceil((through - (from - 1) + 1) / every)) : first.at.episode && first.at.episode > through ? first.at.episode : null;
    cut = { after: after ?? null, phase: first.at.phase ?? null, out: first.out };
  }
  const out = ko ? (view.players ?? []).map((p) => p.id).filter((id) => S.KnockoutLogic.isOut(view, id)) : [];
  const outAfter = ko && seat ? S.KnockoutLogic.outOf(view, me) : null;

  let multiplied: GameTwists["times"] = null;
  const lastN = Math.max(last ?? 0, episodes.at(-1)?.number ?? 0);
  for (let n = through + 1; n <= lastN; n++) {
    const t = S.ActiveRosterLogic.timesFor(view, n);
    if (t !== 1) {
      multiplied = { episode: n, times: t };
      break;
    }
  }

  const b = S.BountyLogic.of(view);
  let bounty: GameTwists["bounty"] = null;
  if (b) {
    const exits = S.BountyLogic.exitsOf(view);
    bounty = {};
    for (const ep of scoredEpisodes(view)) for (const [pid, pts] of S.BountyLogic.episodeLines(view, ep, b, exits) ?? []) bounty[pid] = (bounty[pid] ?? 0) + pts;
  }

  let budget: GameTwists["budget"] = null;
  if (S.MarketLogic.on(view)) {
    budget = {};
    for (const p of view.players ?? []) {
      const c = S.MarketLogic.cash(view, p.id);
      if (c !== null) budget[p.id] = c;
    }
  } else {
    const cap = S.BudgetLogic.cap(view);
    if (cap !== null) {
      const prices = S.PriceLogic.prices(view);
      budget = Object.fromEntries([...teams].map(([pid, team]) => [pid, cap - S.BudgetLogic.cost(team, prices)]));
    }
  }

  return { captain, pool, slots, offered: offeredOut, cut, out, outAfter, times: multiplied, bounty, budget };
}
