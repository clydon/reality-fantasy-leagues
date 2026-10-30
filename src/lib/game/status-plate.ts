import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { ordinal } from "./selectors";
import { pickWindow } from "./pool-view";
import { lineupStatus } from "./lineup-view";
import { waiversHref } from "./action-items.js";

export interface StatusPlate {
  tag: string;
  title: string;
  detail: string;
  action?: string;
  href?: string;
}

// The league's next beat, for the quiet caption plate that opens Overview when nothing in this league
// needs you (docs/PLAN-ux-declutter.md, "The status plate (O1)"; drawn by Up next, overview/up-next.tsx,
// with its count when other games need you). One plate, chosen by the league's phase, the first that
// applies. It takes over what Season Status and the catch-up sentence used to say.
//
// A commissioner's own jobs aren't here: they're the control room's, above it (overview/up-next.tsx).
//
// Reads the viewer's trimmed (spoiler-safe) state, like commissionerItems: nothing here may hint at a
// result they haven't revealed. Null when there's nothing worth a plate, when results are waiting
// (the reveal prompt has the slot) or when the season's over (its results card leads instead).
export function statusPlate(
  state: LeagueState,
  { me, now }: { me: string | null; now: number | null },
): StatusPlate | null {
  const R = StateLogic.RevealLogic;
  if (R.isComplete(state)) return null;
  if (state.episodes.some((e) => e.resultsHidden)) return null;
  const type = StateLogic.getLeagueType(state);
  const name = (id: string | undefined) => (id ? (StateLogic.getPlayer(state, id)?.name ?? "Someone") : "Someone");

  if (type.hasRoster && !StateLogic.isDraftStarted(state)) {
    const at = state.settings.draftScheduledAt ? Date.parse(state.settings.draftScheduledAt) : NaN;
    const pos = me ? state.draftOrder.indexOf(me) : -1;
    // No turns to wait for in a blind draft or a draw (step A10 part 3): no place in the order to say.
    const get = StateLogic.gameOf(state).get;
    const shared = !(get.by === "draft" && get.order === "snake");
    return {
      tag: "Draft",
      title: Number.isFinite(at) ? draftWhen(at) : "Not scheduled yet",
      detail:
        [Number.isFinite(at) && now !== null ? daysUntil(at, now) : null, !shared && pos >= 0 ? `you pick ${ordinal(pos + 1)}` : null]
          .filter(Boolean)
          .join(" · ") || "The commissioner starts it",
      action: shared ? undefined : "Order",
      href: shared ? undefined : "/draft",
    };
  }

  const turn = StateLogic.currentDraftTurn(state);
  if (type.hasRoster && !(turn && turn.isComplete)) {
    if (StateLogic.BlindDraftLogic.on(state)) {
      const B = StateLogic.BlindDraftLogic;
      const locked = B.lockedPlayerIds(state).length;
      const total = locked + B.waitingOn(state).length;
      return { tag: "Draft", title: `${locked} of ${total} locked in`, detail: "Picks reveal when everyone's in" };
    }
    if (turn && turn.playerId) {
      const n = state.draftOrder.length;
      const total = n * StateLogic.rosterSize(state);
      const overall = turn.overallPickNumber ?? state.draftPicksMade + 1;
      const next = nextDraftPlayer(state);
      return {
        tag: "Draft",
        title: `${name(turn.playerId)} is on the clock`,
        detail: [`Pick ${overall} of ${total}`, me && next === me ? "you're next" : null].filter(Boolean).join(" · "),
        action: "Watch",
        href: "/draft",
      };
    }
  }

  const waivers = me ? waiverPlate(state, me) : null;
  if (waivers) return waivers;

  if (R.isCatchingUp(state)) {
    return { tag: `Ep ${R.nextEpisode(state)}`, title: "Up next", detail: "Revealed once everyone's watched" };
  }

  if (me && type.hasWeeklyPicks) {
    const { ep, open } = pickWindow(state);
    const pick = ep && open ? StateLogic.pickEmPickFor(state, ep.id, me) : null;
    const c = pick ? StateLogic.getCastaway(state, pick.castawayId) : null;
    if (ep && c) {
      const airs = ep.airsAt ? shortWhen(Date.parse(ep.airsAt)) : null;
      return {
        tag: `Ep ${ep.number}`,
        title: `You picked ${c.name.split(" ")[0]}`,
        detail: airs ? `Change it until it airs, ${airs}` : "Change it until it airs",
        action: "Change",
        href: "/pick",
      };
    }
  }

  if (me && type.hasActiveRoster) {
    const ep = StateLogic.currentEpisode(state);
    if (ep && !StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id) && lineupStatus(state, ep, me).set) {
      const airs = ep.airsAt ? shortWhen(Date.parse(ep.airsAt)) : null;
      return {
        tag: `Ep ${ep.number}`,
        title: "Lineup set",
        detail: airs ? `Locks when it airs, ${airs}` : "Locks when it airs",
        action: "Change",
        href: "/lineup",
      };
    }
  }

  // The weekly default: when the next episode airs, and how many are left.
  const ep = StateLogic.currentEpisode(state);
  if (!ep) return null;
  const left = state.castaways.filter((c) => c.status !== "eliminated").length;
  const leftLine = `the cast is down to ${left}`;
  const at = ep.airsAt ? Date.parse(ep.airsAt) : NaN;
  if (Number.isFinite(at) && now !== null && at > now) {
    return { tag: `Ep ${ep.number}`, title: `Airs ${shortWhen(at)}`, detail: `${daysUntil(at, now)} · ${leftLine}` };
  }
  if (Number.isFinite(at)) {
    return { tag: `Ep ${ep.number}`, title: `Aired ${shortWhen(at)}`, detail: "Results show up here once they're in" };
  }
  return { tag: `Ep ${ep.number}`, title: "Up next", detail: leftLine.replace(/^./, (ch) => ch.toUpperCase()) };
}

// Waivers (docs/PLAN-midseason-waivers.md, PLAN-waivers-v2.md), when the week has something of yours
// in it but nothing owed: someone to replace with no claim in is the alert strip's (action-items.js), so
// this never adds yellow. Your claim is in; a waiver window's optional swap; free agency with your swap
// unused. A week you can't claim anything in says nothing here. Reads the viewer's copy, where a
// week from an unrevealed episode is hidden -- and a hidden result already took the plate away above.
function waiverPlate(state: LeagueState, me: string): StatusPlate | null {
  const W = StateLogic.WaiverLogic;
  const p = W.enabled(state) ? W.current(state) : null;
  if (!p || p.hidden || !W.rotation(state).includes(me)) return null;
  const href = waiversHref(state);
  const at = (iso: string | null) => (iso ? shortWhen(Date.parse(iso)) : null);
  if (p.phase === "open") {
    const processes = p.hold ? null : at(p.processAt);
    if (p.claimsIn.includes(me)) {
      const rotation = state.players.filter((pl) => W.rotation(state).includes(pl.id));
      const inCount = rotation.filter((pl) => pl.automated || p.claimsIn.includes(pl.id)).length;
      return {
        tag: "Waivers",
        title: processes ? `Claims due ${processes}` : "Claims are on hold",
        detail: `Your claim is in · ${inCount} of ${rotation.length} in`,
        action: "Waivers",
        href,
      };
    }
    if (W.swapsLeft(state, p, me) > 0 && !W.replacementsOwed(state, me, p).count) {
      return { tag: "Window", title: "Waiver window open", detail: processes ? `Optional swap · due ${processes}` : "Optional swap", action: "Waivers", href };
    }
    return null;
  }
  if (W.freeAgencyOn(state) && W.swapsLeft(state, p, me) > 0 && !W.replacementsOwed(state, me, p).count) {
    const until = at(p.closesAt);
    return {
      tag: "FA",
      title: until ? `Free agency until ${until}` : "Free agency is open",
      detail: "Your swap is unused · first come",
      action: "Free agency",
      href: `${href}/free-agency`,
    };
  }
  return null;
}

// Who picks after the current turn in a snake draft (the order reverses each round).
function nextDraftPlayer(state: LeagueState): string | null {
  const order = state.draftOrder;
  const n = order.length;
  const made = state.draftPicksMade + 1;
  if (!n || made >= n * StateLogic.rosterSize(state)) return null;
  const round = Math.floor(made / n);
  const pos = made % n;
  return (round % 2 === 0 ? order : [...order].reverse())[pos] ?? null;
}

/** "Sat, Oct 17 · 7 PM", in the viewer's zone. */
function draftWhen(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${hourLabel(d)}`;
}

/** "Wed 8 PM", in the viewer's zone. */
function shortWhen(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString([], { weekday: "short" })} ${hourLabel(d)}`;
}

function hourLabel(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined });
}

/** "Today", "Tomorrow", "In 4 days", by calendar day in the viewer's zone. */
function daysUntil(at: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const days = day(at) - day(now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}
