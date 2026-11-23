"use client";

// A fan's call (docs/PLAN-sports-couch.md C2; the design: docs/design-round/lone-fan-spec.md (Intent), -first-view.md (PFD),
// -shape.md (Impeccable)). When a couch member's team plays and it isn't a rivalry, the fan calls it in a tap and anyone else backs
// or fades the call in a tap. A row reads like a line in the group chat: a face, a name, a bold side ("Jordan called Giants"), then
// the couch's answer as faces either side of C1's split rule ("2 back · 1 fades"), and one action for you. This week's calls is a
// card of those rows (the ones you can act on first, three, then the rest folded); the team's page puts its next game's row under
// the scorebug and the fan card under its head: whose team it is, the calls record and a tick a game, the couch on his calls.
// I'm watching is a mark on a game's sheet that puts your face on its row for the couch while it's on.
//
// Hide sports scores: the call and the backing stay (picks made before anything happened); the score, the result, the checks and
// every record wait for the page's Show records (This week) or Show the season (the team's page).

import { useState } from "react";
import { Check, Megaphone, Tv } from "lucide-react";
import { useCallGames, useCallPick, useOwnPick, useSetWatching, useWatching, type CallGame, type Watching, type WeekGame } from "../data";
import { Avatar } from "../ui/bars";
import { TeamMark } from "./parts";
import { clockOf, dayOf, useGameScore } from "./scores";
import { openSports } from "./sheets";
import { FaceStack } from "./rivalry";
import { teamKeyOf } from "@/lib/sports/team-badge";
import type { Fan } from "@/lib/sports/couch-table";
import { backingOf, callTicks, callsRecord, couchOnCalls, record3Words, type CallPick, type CallTick, type Record3 } from "@/lib/sports/fan-call";
import type { Team } from "../screens/league-page";

export { useCallGames };

/** A team as a row draws it. */
export type TeamLite = { id: string; short: string; abbreviation: string | null; color: string | null };

/** One game as a call row needs it: away then home, each side's score once begun, the winner once final. */
export interface CallMatch {
  id: string;
  at: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  called: string | null;
  away: TeamLite;
  home: TeamLite;
  score: [number, number] | null;
}

export const matchOfWeek = (g: WeekGame): CallMatch | null => {
  const [a, h] = g.sides;
  if (!a || !h) return null;
  const num = (x: string | null) => (x != null && x !== "" ? Number(x) : null);
  const sa = num(a.score);
  const sh = num(h.score);
  return { id: g.id, at: g.at, state: g.state, final: g.final, called: g.called, away: a, home: h, score: sa != null && sh != null ? [sa, sh] : null };
};

/** A row on This week's calls (or the team's page): the game, the fan's team, the call (null: yours to make), and its game. */
export interface CallEntry {
  m: CallMatch;
  /** The team the row stands for: the caller's (a fan of it), else yours. */
  team: TeamLite;
  fan: Fan;
  call: CallPick | null;
  game: CallGame | null;
  /** You can act on it: your own call to make, or a call you haven't answered, before kickoff. */
  act: boolean;
}

/**
 * This week's call rows: every game of a couch team's that isn't a rivalry, where there's a call, or where you're a fan and it's yours
 * to make (a spectator never sees a game nobody's called). Yours to act on first, then by when: on now, to come, just played.
 */
export function callEntries(o: { matches: CallMatch[]; teams: Team[]; calls: CallGame[]; meId: string; rivalryIds: Set<string>; now: number }): CallEntry[] {
  const out: CallEntry[] = [];
  for (const m of o.matches) {
    if (o.rivalryIds.has(m.id) || (m.called && m.called !== "suspended")) continue;
    const couchSides = [m.away, m.home].map((s) => o.teams.find((t) => t.id === s.id)).filter((t): t is Team => !!t);
    if (!couchSides.length) continue;
    const game = o.calls.find((c) => c.kind === "call" && c.event === m.id) ?? null;
    const call = game?.picks[0] ?? null;
    const started = !!m.at && Date.parse(m.at) <= o.now ? true : m.state !== "pre";
    const fanOf = (id: string) => couchSides.find((t) => t.followers.some((f) => f.id === id)) ?? null;
    if (call) {
      const t = fanOf(call.userId) ?? couchSides[0];
      const fan = t.followers.find((f) => f.id === call.userId) ?? { id: call.userId, name: call.name };
      const mine = game!.picks.some((p) => p.userId === o.meId);
      out.push({ m, team: t, fan, call, game, act: !started && !mine });
      continue;
    }
    const mineTeam = fanOf(o.meId);
    if (!mineTeam || started) continue;
    out.push({ m, team: mineTeam, fan: mineTeam.followers.find((f) => f.id === o.meId)!, call: null, game, act: true });
  }
  const rank = (e: CallEntry) => (e.act ? 0 : 1);
  const time = (e: CallEntry) => (e.m.state === "in" ? 0 : e.m.state === "pre" ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || time(a) - time(b) || (a.m.at ?? "").localeCompare(b.m.at ?? ""));
}

/** The teams of each call game, by its event (from the read's schedules). */
const teamsOfGames = (calls: CallGame[]) => {
  const m = new Map(calls.filter((c) => c.teams).map((c) => [c.event, c.teams!] as const));
  return (event: string) => m.get(event) ?? null;
};

/** A fan's calls record on their team this season ("7–1"), null with none settled. */
export function fanRecord(calls: CallGame[], fan: string, team: string): Record3 {
  return callsRecord(fan, team, calls, teamsOfGames(calls));
}

/** This week's calls: the card under the rivalries. */
export function CallsCard(p: {
  league: string;
  entries: CallEntry[];
  calls: CallGame[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
  hidden: boolean;
  meId: string;
  /** C4: null, solo: your own calls (nobody backs them). */
  couchId: string | null;
  /** Nothing above holds the page's one yellow: your own call may take it. */
  yellowFree: boolean;
  watching: Watching[];
}) {
  const [all, setAll] = useState(false);
  if (!p.entries.length && !p.failed) return null;
  const shown = all ? p.entries : p.entries.slice(0, 3);
  const firstYellow = p.yellowFree ? p.entries.find((e) => e.act && !e.call && e.fan.id === p.meId)?.m.id ?? null : null;
  return (
    <section data-calls-card={p.entries.length} data-calls-solo={p.couchId ? undefined : ""} aria-label={p.couchId ? "This week's calls" : "Your calls"} className="mt-4 rounded-[4px] bg-card px-3.5 pb-1 pt-3">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="type-caption text-[17px] tracking-[0.03em]">{p.couchId ? <>This week&rsquo;s calls</> : "Your calls"}</h2>
      </div>
      {p.failed ? (
        <button type="button" onClick={p.retry} className="nd-press my-2 flex h-11 w-full items-center justify-center rounded-[4px] text-[14px] font-semibold outline-1 -outline-offset-1 outline-edge">
          {p.couchId ? "Couldn’t load calls · Try again" : "Couldn’t load your calls · Try again"}
        </button>
      ) : (
        <div className="flex flex-col">
          {shown.map((e) => (
            <CallRow key={e.m.id} e={e} {...p} yellow={firstYellow === e.m.id} watchers={p.watching.filter((w) => w.game === e.m.id)} />
          ))}
        </div>
      )}
      {!all && p.entries.length > 3 && (
        <button type="button" data-calls-more onClick={() => setAll(true)} className="nd-press inline-flex h-11 items-center text-[13px] font-bold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
          +{p.entries.length - 3} more {p.entries.length - 3 === 1 ? "call" : "calls"}
        </button>
      )}
    </section>
  );
}

/** One call: the fan and their side over the game, the backing, one action for you. `bare`: the team's page (no game line, no card). */
export function CallRow(p: {
  e: CallEntry;
  league: string;
  calls: CallGame[];
  loading: boolean;
  hidden: boolean;
  meId: string;
  /** C4: null, solo: your own call, kept in your calls (nobody backs it; change it until kickoff). */
  couchId: string | null;
  yellow: boolean;
  watchers: Watching[];
  bare?: boolean;
}) {
  const { e, league, meId } = p;
  const { m, team, fan, call } = e;
  const solo = !p.couchId;
  const pickOn = useCallPick(p.couchId, league);
  const ownPick = useOwnPick(league);
  const s = useGameScore({ id: m.id, at: m.at, state: m.state, final: m.final, called: m.called });
  const open = s.open && !p.hidden;
  const begun = s.started || m.state !== "pre" || !!e.game?.begun;
  const postponed = m.called === "postponed";
  const final = m.state === "post" || m.final;
  const other = team.id === m.home.id ? m.away : m.home;
  const teamById = (id: string) => (id === m.home.id ? m.home : m.away);
  const nm = (f: { id: string; name: string }) => (f.id === meId ? "You" : f.name);
  const picks = e.game?.picks ?? [];
  const mine = picks.find((x) => x.userId === meId) ?? null;

  // Saving: shown at once, put right by the answer (or taken back on a failure).
  const [pending, setPending] = useState<{ side: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const save = async (side: string | null) => {
    setFailed(null);
    setPending({ side });
    try {
      if (solo) await ownPick({ team: team.id, event: m.id, side });
      else await pickOn({ event: m.id, team: m.home.id, side });
      setChanging(false);
    } catch (err) {
      setFailed((err as Error).message?.includes("stands") ? "It's been backed: your call stands" : "Didn’t save · Try again");
    } finally {
      setPending(null);
    }
  };
  const shownPicks: CallPick[] = pending
    ? [...picks.filter((x) => x.userId !== meId), ...(pending.side ? [{ userId: meId, name: mine?.name ?? "You", side: pending.side }] : [])]
    : picks;
  const theCall = call ?? (pending?.side && fan.id === meId ? { userId: meId, name: fan.name, side: pending.side } : null);
  const backing = theCall ? backingOf({ picks: shownPicks }, shownPicks.find((x) => x.userId === theCall.userId) ?? theCall) : { back: [], fade: [] };
  const myPick = shownPicks.find((x) => x.userId === meId) ?? null;
  const iCalled = !!theCall && theCall.userId === meId;
  const backed = !solo && picks.length > 1;
  // Solo: the first call ever says where the record starts.
  const firstEver = solo && !p.calls.some((g) => g.picks.some((x) => x.userId === meId));

  // The result, once final and shown.
  const winner = open && final && m.score ? (m.score[0] > m.score[1] ? m.away.id : m.score[1] > m.score[0] ? m.home.id : "tie") : null;
  const verdict = winner && theCall ? (winner === "tie" ? "tie" : theCall.side === winner ? "right" : "wrong") : null;
  // The team's page shows the record big in the fan card just above: the row doesn't say it again (the check).
  const record = !p.hidden && !p.bare ? record3Words(fanRecord(solo ? p.calls.filter((c) => !c.own || c.own === team.id) : p.calls, fan.id, team.id)) : null;

  const status = postponed ? "Postponed" : !s.started ? (m.at ? `${dayOf(m.at)} ${clockOf(m.at)}` : "Time to be set") : open ? (final ? "Final" : "On now") : s.when;
  const live = s.started && open && !final;
  const scoreWords = open && s.started && m.score ? `${m.score[0]}–${m.score[1]}` : null;
  const where = team.id === m.home.id ? "vs" : "at";

  return (
    <div data-call-row={m.id} data-call-moment={!begun ? "before" : final && open ? "over" : "on"} className={p.bare ? "mt-3" : "border-t border-border py-3 first:border-t-0"}>
      {/* The voice: the fan and their side (or yours to make); their record at the right. */}
      <div className="flex min-h-6 items-center gap-2">
        {/* Solo: it's only ever you (no face: the shape's). */}
        {!solo && <Avatar id={fan.id} name={fan.name} size={20} />}
        <p className="min-w-0 flex-1 truncate text-[15px] leading-tight">
          {theCall ? (
            <>
              <b className="font-bold">{nm(fan)}</b> called <b className="font-bold">{teamById(theCall.side).short}</b>
            </>
          ) : (
            <b className="font-bold">Your call</b>
          )}
        </p>
        {record && (
          <span data-call-record className="flex-none text-[13px] text-muted-foreground">
            {fan.id === meId ? "your calls" : "calls"} <span className="type-num text-[14px] text-foreground">{record}</span>
          </span>
        )}
      </div>
      {/* The game: its words open its sheet; the status at the right, the watchers beside it while it's on. */}
      {!p.bare && (
        <button
          type="button"
          data-call-game
          onClick={() => openSports({ kind: "game", league, team: m.home.id, game: m.id })}
          aria-label={`Open ${m.away.short} at ${m.home.short}`}
          className="nd-press -mx-1 mt-1 flex min-h-9 w-[calc(100%+8px)] items-center gap-2 rounded-[3px] px-1 text-left text-[13px] text-muted-foreground focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <TeamMark abbr={team.abbreviation ?? team.short.slice(0, 3)} color={team.color} size="xs" team={teamKeyOf(league, team.id)} />
          <span className="min-w-0 flex-1 truncate">
            {team.short} {where} {other.short}
          </span>
          {s.started && !final && p.watchers.length > 0 && <Watchers xs={p.watchers} />}
          <span data-call-status className={`flex flex-none items-center gap-1.5 font-semibold ${live ? "text-foreground" : ""}`}>
            {live && <i className="size-[7px] rounded-full bg-live motion-safe:animate-pulse" aria-hidden />}
            {status}
            {scoreWords && <span className="type-num text-[14px]">{teamScoreFirst(m, team.id) ?? scoreWords}</span>}
          </span>
        </button>
      )}
      {p.bare && s.started && !final && p.watchers.length > 0 && (
        <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Watchers xs={p.watchers} />
          {watchWords(p.watchers, meId)}
        </div>
      )}
      {verdict && theCall && (
        <p data-call-result className="type-caption mt-1.5 text-[19px] leading-tight tracking-[0.01em]">
          {verdict === "tie" ? "A tie: no call settled" : `${nm(theCall.userId === fan.id ? fan : { id: theCall.userId, name: theCall.name })} ${verdict === "right" ? "called it" : "missed it"}`}
        </p>
      )}
      {(backing.back.length > 0 || backing.fade.length > 0) && <BackingLine back={backing.back} fade={backing.fade} won={verdict === "right" ? "back" : verdict === "wrong" ? "fade" : null} />}

      {!begun && !postponed && (
        <div data-call-action className={solo && iCalled && !changing ? "mt-0.5" : "mt-2.5"}>
          {p.loading ? (
            <div className="h-12 animate-pulse rounded-[4px] bg-secondary" />
          ) : !theCall || (iCalled && changing) ? (
            // Your call: two buttons, your team first (the yellow when the page's is free); one tap makes it.
            <>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Your call: who wins">
                {[team, other].map((t, i) => {
                  const on = myPick?.side === t.id;
                  const yellow = i === 0 && p.yellow && !changing;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-call-pick={t.id}
                      data-yellow={yellow || undefined}
                      aria-pressed={on}
                      disabled={!!pending}
                      onClick={() => void save(t.id)}
                      className={`nd-press flex h-12 min-w-0 items-center justify-center gap-2 rounded-[4px] px-2 text-[15px] font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${yellow ? "bg-chyron text-chyron-foreground" : on ? "bg-secondary" : "outline-1 -outline-offset-1 outline-edge"}`}
                    >
                      {on ? <Check className="size-4 flex-none" strokeWidth={2.5} aria-hidden /> : <TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} size="xs" team={teamKeyOf(league, t.id)} />}
                      <span className="truncate">{t.short} win</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {solo ? (firstEver ? "Your record starts here · change it until kickoff" : "Change it until kickoff") : changing ? "Change it until someone backs or fades it" : "The couch can back or fade it · one tap"}
              </p>
            </>
          ) : iCalled ? (
            <div className="flex min-h-11 items-center justify-between gap-3">
              <p className="min-w-0 text-[13px] text-muted-foreground">{solo ? "Yours alone until kickoff" : backed ? "It’s backed: your call stands" : "Nobody’s backed or faded it yet"}</p>
              {!backed && (
                <button type="button" data-call-change onClick={() => setChanging(true)} className="nd-press inline-flex h-11 flex-none items-center text-[14px] font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
                  Change
                </button>
              )}
            </div>
          ) : (
            // Back or fade: two outlined buttons, each with its team's mark; picked, the quiet fill with a check; tap again to clear.
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Back or fade ${fan.name}`}>
              {(["back", "fade"] as const).map((k) => {
                const side = k === "back" ? theCall.side : teamById(theCall.side).id === m.home.id ? m.away.id : m.home.id;
                const t = teamById(side);
                const on = myPick?.side === side;
                // A long name leaves the buttons (the line above names them): "Back" is never what's cut (the critique).
                const who = fan.name.length <= 9 ? ` ${fan.name}` : "";
                return (
                  <button
                    key={k}
                    type="button"
                    {...{ [`data-call-${k}`]: "" }}
                    aria-pressed={on}
                    disabled={!!pending}
                    onClick={() => void save(on ? null : side)}
                    className={`nd-press flex h-12 min-w-0 items-center justify-center gap-2 rounded-[4px] px-2 text-[15px] font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${on ? "bg-secondary" : "outline-1 -outline-offset-1 outline-edge"}`}
                  >
                    {on ? <Check className="size-4 flex-none" strokeWidth={2.5} aria-hidden /> : <TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} size="xs" team={teamKeyOf(league, t.id)} />}
                    <span className="truncate">
                      {on ? (k === "back" ? "Backing" : "Fading") : k === "back" ? "Back" : "Fade"}
                      {who}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {failed && (
            <p role="alert" className="mt-2 text-[13px] font-semibold">
              {failed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The score from the row's team's side ("24–17" for the Giants' 24). */
function teamScoreFirst(m: CallMatch, team: string): string | null {
  if (!m.score) return null;
  return team === m.home.id ? `${m.score[1]}–${m.score[0]}` : `${m.score[0]}–${m.score[1]}`;
}

/** The couch's answer: backers' faces at the left, faders' at the right, the split as C1's 3 px rule, the counts in words. */
function BackingLine({ back, fade, won }: { back: CallPick[]; fade: CallPick[]; won: "back" | "fade" | null }) {
  const n = back.length + fade.length;
  const share = n ? back.length / n : 0.5;
  return (
    <div data-call-backing={`${back.length}-${fade.length}`} className="mt-2" aria-label={`${back.length} ${back.length === 1 ? "backs" : "back"} the call, ${fade.length} ${fade.length === 1 ? "fades" : "fade"} it`}>
      <div className="flex items-center justify-between gap-3">
        <FaceStack xs={back} />
        <FaceStack xs={fade} right />
      </div>
      <div className="mt-1.5 flex h-[3px] overflow-hidden rounded-full bg-border" aria-hidden>
        <i className={`h-full ${share >= 0.5 ? "bg-foreground" : "bg-transparent"}`} style={{ width: `${share * 100}%` }} />
        <i className={`h-full ${share < 0.5 ? "bg-foreground" : "bg-transparent"}`} style={{ width: `${(1 - share) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-[13px] text-muted-foreground">
        {([["back", back], ["fade", fade]] as const).map(([k, xs]) => (
          <span key={k} className={`flex min-w-0 items-center gap-1 ${won === k && xs.length ? "font-semibold text-foreground" : ""}`}>
            {won === k && xs.length > 0 && <Check className="size-3.5 flex-none text-good" strokeWidth={3} aria-label="right" />}
            <span className="truncate">{xs.length ? `${xs.length} ${k}${xs.length === 1 ? "s" : ""}` : ""}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Watchers({ xs }: { xs: Watching[] }) {
  return (
    <span data-watchers={xs.length} className="flex flex-none items-center" aria-label={`${xs.length} watching`}>
      <FaceStack xs={xs} size={16} max={3} />
    </span>
  );
}

const watchWords = (xs: Watching[], meId: string) => {
  const names = [...xs.filter((x) => x.userId === meId), ...xs.filter((x) => x.userId !== meId)].map((x) => (x.userId === meId ? "You" : x.name));
  const words = names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return `${words} ${names.length === 1 && names[0] !== "You" ? "is" : "are"} watching`;
};

/** I'm watching (a game's sheet): one tap puts your face on its rows for the couch while it's on; who's watching beside it. */
export function WatchingRow({ league, game, couchId, meId }: { league: string; game: string; couchId: string; meId: string }) {
  const q = useWatching(couchId, league);
  const set = useSetWatching(couchId, league);
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const xs = (q.data?.watching ?? []).filter((w) => w.game === game);
  const on = pending ?? xs.some((w) => w.userId === meId);
  const others = xs.filter((w) => w.userId !== meId);
  const toggle = async () => {
    setFailed(false);
    setPending(!on);
    try {
      await set(game, !on);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  };
  return (
    <div data-watching={game} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        data-watching-toggle
        aria-pressed={on}
        onClick={() => void toggle()}
        className={`nd-press inline-flex h-11 flex-none items-center gap-1.5 rounded-[4px] px-3.5 text-[14px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${on ? "bg-secondary" : "outline-1 -outline-offset-1 outline-edge"}`}
      >
        {on ? <Check className="size-4" strokeWidth={2.5} aria-hidden /> : <Tv className="size-4" aria-hidden />}
        {on ? "Watching" : "I’m watching"}
      </button>
      {(others.length > 0 || on) && (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
          {others.length > 0 && <FaceStack xs={others} size={22} />}
          <span className="min-w-0">{others.length ? watchWords(on ? [...others, { game, userId: meId, name: "You" }] : others, meId) : "The couch sees you're watching"}</span>
        </span>
      )}
      {failed && (
        <p role="alert" className="w-full text-[13px] font-semibold">
          Didn&rsquo;t save · Try again
        </p>
      )}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sinceWords = (iso: string | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `since ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
};

/**
 * The fan card (a team's page, under its head): whose team it is on the couch, their calls record big with a tick a game of the
 * season, and the couch on their calls. `told`: the page's results are shown (else the record and ticks wait for Show the season).
 */
export function FanCard(p: {
  league: string;
  team: TeamLite;
  fans: Fan[];
  meId: string;
  season: { id: string; at: string | null }[];
  calls: CallGame[];
  told: boolean;
  onShow: () => void;
  /** C4: solo, your own calls: "Your team", nothing about a couch, and nothing drawn before your first call (PFD's R1). */
  solo?: boolean;
}) {
  const { fans, meId, calls } = p;
  // Whose team it is: yours first when it's yours, else its first fan (as the couch's table does).
  const fan = fans.find((f) => f.id === meId) ?? fans.find((f) => f.myTeam) ?? fans[0];
  if (!fan) return null;
  const you = fan.id === meId;
  const rec = fanRecord(calls, fan.id, p.team.id);
  const recWords = record3Words(rec);
  const ticks = callTicks(fan.id, p.season, calls);
  const made = ticks.filter((t) => t.kind !== "none").length;
  const couch = couchOnCalls(fan.id, calls);
  const backW = record3Words(couch.back);
  const fadeW = record3Words(couch.fade);
  const others = fans.filter((f) => f.id !== fan.id).map((f) => ({ f, r: record3Words(fanRecord(calls, f.id, p.team.id)) })).filter((x) => x.r);
  const since = sinceWords(fan.since);
  if (p.solo && !made) return null;
  return (
    <section data-fan-card={fan.id} aria-label={`${you ? "Your" : `${fan.name}'s`} calls on the ${p.team.short}`} className="mt-3 rounded-[4px] bg-card px-3.5 py-3">
      <div className="flex items-center gap-2">
        {!p.solo && <Avatar id={fan.id} name={fan.name} size={24} />}
        <p className="min-w-0 flex-1 truncate text-[14px]">
          <b className="font-semibold">{p.solo ? `Your calls on the ${p.team.short}` : you ? "Your team on the couch" : `${fan.name}’s team on the couch`}</b>
          {since && <span className="text-muted-foreground"> · {since}</span>}
        </p>
      </div>
      {!made ? (
        p.solo ? null : <p className="mt-2 text-[13px] text-muted-foreground">{you ? "No calls yet. Call their next game below: the couch can back or fade it." : `No calls from ${fan.name} yet this season.`}</p>
      ) : p.told ? (
        <>
          <div className="mt-2.5 flex items-center gap-3">
            <span className="flex flex-none flex-col">
              <span className="text-[13px] text-muted-foreground">{p.solo ? "This season" : you ? "Your calls" : "Calls"}</span>
              <span data-fan-record className="type-num text-[28px] leading-none">{recWords ?? "–"}</span>
            </span>
            <CallTicks ticks={ticks} />
          </div>
          {!p.solo && (backW || fadeW) && (
            <p data-fan-couch className="mt-2.5 text-[13px] text-muted-foreground">
              {[backW ? `Backing ${you ? "you" : fan.name} ${backW}` : null, fadeW ? `fading ${you ? "you" : "them"} ${fadeW}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          {others.map(({ f, r }) => (
            <p key={f.id} className="mt-1 text-[13px] text-muted-foreground">
              {f.id === meId ? "Your calls" : `${f.name}’s calls`} <span className="type-num text-foreground">{r}</span>
            </p>
          ))}
        </>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            {made} {made === 1 ? "call" : "calls"} this season · results hidden
          </p>
          <button type="button" onClick={p.onShow} className="nd-press inline-flex h-11 flex-none items-center rounded-[3px] px-3 text-[13px] font-semibold outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground">
            Show the season
          </button>
        </div>
      )}
    </section>
  );
}

/** A tick a game, oldest first: right the good teal, wrong a muted fill, open a hollow ink outline, no call a faint dash. Read, not
 *  tapped (the check: a wrong call outlined read as this week's open one). */
function CallTicks({ ticks }: { ticks: CallTick[] }) {
  // A daily sport's season is long: its last 24 games.
  const xs = ticks.length > 24 ? ticks.slice(-24) : ticks;
  const words = `${xs.filter((t) => t.kind === "right").length} right, ${xs.filter((t) => t.kind === "wrong").length} wrong, ${xs.filter((t) => t.kind === "none").length} without a call`;
  return (
    <span data-call-ticks role="img" aria-label={words} className="flex min-w-0 flex-1 items-center justify-end gap-[3px]">
      {xs.map((t) => (
        <i
          key={t.id}
          data-tick={t.kind}
          className={`block flex-none rounded-[1.5px] ${
            t.kind === "right"
              ? "h-[14px] w-2 bg-(--nd-good)"
              : t.kind === "wrong"
                ? "h-[14px] w-2 bg-muted-foreground opacity-45"
                : t.kind === "open"
                  ? "h-[14px] w-2 border-[1.5px] border-foreground"
                  : t.kind === "tie"
                    ? "h-[14px] w-2 bg-[linear-gradient(to_top,var(--nd-good)_50%,transparent_50%)] border border-muted-foreground"
                    : "h-[3px] w-2 bg-muted-foreground opacity-40"
          }`}
        />
      ))}
    </span>
  );
}
