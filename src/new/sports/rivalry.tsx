"use client";

// A rivalry on the couch (docs/PLAN-sports-couch.md C1; the design: docs/design-round/rivalry-spec.md, -first-view.md, -shape.md).
// This week's rivalry card: two couch members' teams meeting, read through the people. Before kickoff each fan's call sits where a
// scoreboard puts the score ("Called", yours in full), the sides as faces either side of a split rule, and one action for you: a
// fan's Make your call (the yellow, unless the move strip above holds it), anyone else's Pick a side (two outlined buttons, one tap).
// Once it's on, the calls open in full and the score takes its place beside the team; once it's over, who called it, in names, over
// the friendship's record. Your call is a sheet: who wins (your team chosen), by how many (a sport's usual margin), and who's told.
//
// The game under it is one Winner and margin a meeting, started by the first tap (src/lib/server/sports/rivalry.ts). Hide sports
// scores: the calls and sides stay (picks made before anything happened); the score, the result, the checks and the record wait for
// the page's Show records.

import { useState } from "react";
import { Check, Minus, Plus, Swords } from "lucide-react";
import { useRivalryGames, useRivalryPick, type RivalryGame, type WeekGame } from "../data";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { TeamMark } from "./parts";
import { clockOf, dayOf, useGameScore } from "./scores";
import { openSports } from "./sheets";
import { teamKeyOf } from "@/lib/sports/team-badge";
import { recordWords, type Fan, type Rivalry, type TeamForm } from "@/lib/sports/couch-table";
import { MARGIN_MAX, MARGIN_MIN, duelOf, finalOf, sidesOf, typicalMargin, type RivalryPick } from "@/lib/sports/rivalry";
import type { Team } from "../screens/league-page";

/** A record between two fans, as the card's foot says it: "Andrew leads Riley 2–0 this season". */
export type PairRecord = { lead: Fan | null; first: Fan; other: Fan; w: number; l: number; t: number; since: number | null };

const passKey = (id: string) => `gys_rivalry_pass:${id}`;
const passed = (id: string) => {
  try {
    return localStorage.getItem(passKey(id)) === "1";
  } catch {
    return false;
  }
};

export function RivalryCard(p: {
  r: Rivalry;
  g: WeekGame | null;
  teams: Team[];
  forms: Map<string, TeamForm>;
  hidden: boolean;
  league: string;
  meId: string;
  couchId: string | null;
  /** The move strip above holds the page's one yellow: the call steps down to outlined. */
  yellowTaken: boolean;
  record: PairRecord | null;
  /** Open Your call on arrival (the challenge's push: ?call=<event>). */
  openCall?: boolean;
  /** "This week's rivalry", or "Rivalry" for a second one. */
  heading?: string;
}) {
  const { r, g, teams, forms, hidden, league, meId, couchId } = p;
  const q = useRivalryGames(couchId, league);
  const pickOn = useRivalryPick(couchId, league);
  const game: RivalryGame | null = q.data?.games.find((x) => x.event === r.id) ?? null;
  const picks = game?.picks ?? [];
  const moment = g ?? { id: r.id, at: r.at, state: r.state, final: r.final };
  const s = useGameScore(moment);
  const open = s.open && !hidden;
  const final = !!g && (g.state === "post" || g.final);
  const begun = s.started || !!game?.begun;
  const live = s.started && open && !final;
  const postponed = g?.called === "postponed";
  const status = postponed ? "Postponed" : !s.started ? (r.at ? `${dayOf(r.at)} ${clockOf(r.at)}` : "Time to be set") : open ? (final ? "Final" : "On now") : s.when;
  const team = (id: string) => teams.find((t) => t.id === id);
  const short = (id: string | null) => (id ? (team(id)?.short ?? "") : "");
  const away = team(r.away);
  const home = team(r.home);
  const sideOf = (id: string) => g?.sides.find((x) => x.id === id);
  const fans: [string, string] = [r.fans[0].id, r.fans[1].id];
  const meFan = r.fans.find((f) => f.id === meId) ?? null;
  const otherFan = meFan ? r.fans.find((f) => f.id !== meId)! : null;
  const mine = picks.find((x) => x.userId === meId) ?? null;
  const otherCall = otherFan ? (picks.find((x) => x.userId === otherFan.id && x.side) ?? null) : null;
  const who = (f: { id: string; name: string }) => (f.id === meId ? "You" : f.name);

  // The result, once final and shown.
  const num = (id: string) => (sideOf(id)?.score != null && sideOf(id)!.score !== "" ? Number(sideOf(id)!.score) : null);
  const score: [number, number] | null = open && final && num(r.away) != null && num(r.home) != null ? [num(r.away)!, num(r.home)!] : null;
  const fin = score ? finalOf(score, r.away, r.home) : null;
  const duel = fin ? duelOf(fans, picks, fin) : null;

  // Saving a side: shown at once, put right by the answer (or taken back on a failure).
  const [pending, setPending] = useState<{ side: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheetOpen] = useState<boolean>(!!p.openCall && !begun);
  // Each opening starts the sheet afresh from the call as it stands (its key), and a closing keeps it for the sheet's fall.
  const [opened, setOpened] = useState(0);
  const setSheet = (o: boolean) => {
    if (o) setOpened((n) => n + 1);
    setSheetOpen(o);
  };
  const [sent, setSent] = useState(false);
  const [pass, setPass] = useState(() => passed(r.id));
  const shownSide = pending ? pending.side : (mine?.side ?? null);
  const shownPicks: RivalryPick[] = pending
    ? [...picks.filter((x) => x.userId !== meId), ...(pending.side ? [{ userId: meId, name: mine?.name ?? "You", side: pending.side, margin: mine?.margin ?? null, called: !!mine?.called }] : [])]
    : picks;
  const [onAway, onHome] = sidesOf(shownPicks, r.away, r.home, fans);
  const name = `${r.fans[0].name} vs ${r.fans[1].name}`;

  const save = async (side: string | null, margin?: number | null) => {
    setFailed(false);
    setPending({ side });
    try {
      await pickOn({ event: r.id, team: r.home, side, margin, name, rival: otherFan?.id });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setPending(null);
    }
  };

  const say = (t: Team | undefined, fan: Fan) => `${fan.id === meId ? "Your" : `${fan.name}'s`} ${t?.short ?? "team"}`;
  const resultLine = duel ? resultWords(duel, r.fans, picks, short, meId) : null;

  return (
    <section
      data-rivalry={r.id}
      data-rivalry-moment={!begun ? "before" : final && open ? "over" : "on"}
      aria-label={`${p.heading ?? "This week's rivalry"}: ${say(away, r.fans[0])} at ${say(home, r.fans[1])}. ${status}.`}
      className="mt-4 rounded-[4px] bg-card px-3.5 pb-2 pt-3"
    >
      <div className="flex items-center gap-2">
        <Swords className="size-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="type-caption text-[17px] tracking-[0.03em]">{p.heading ?? "This week’s rivalry"}</h2>
        <span data-rivalry-status className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          {live && <i className="size-[7px] rounded-full bg-live motion-safe:animate-pulse" aria-hidden />}
          <span className={live ? "text-foreground" : undefined}>{status}</span>
        </span>
      </div>
      {resultLine && (
        <p data-rivalry-result className="type-caption mt-2 text-[19px] leading-tight tracking-[0.01em] [text-wrap:balance]">
          {resultLine}
        </p>
      )}
      <button
        type="button"
        data-rivalry-open
        onClick={() => openSports({ kind: "game", league, team: r.home, game: r.id })}
        aria-label={`Open ${away?.short ?? ""} at ${home?.short ?? ""}`}
        className="nd-press -mx-1.5 mt-1.5 flex w-[calc(100%+12px)] flex-col gap-1.5 rounded-[3px] px-1.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-foreground"
      >
        {([r.away, r.home] as const).map((id, i) => {
          const fan = r.fans[i];
          const call = picks.find((x) => x.userId === fan.id && x.side) ?? null;
          const res = duel?.results[fan.id];
          return (
            <Side
              key={id}
              league={league}
              t={team(id)}
              fan={fan}
              name={who(fan)}
              record={open && forms.get(id) ? recordWords(forms.get(id)!) : null}
              score={open && s.started ? num(id) : null}
              call={callWords(call, short, begun, fan.id === meId)}
              result={res && call ? (res.right ? "right" : "wrong") : null}
              off={res?.off ?? null}
              lost={!!fin && fin.winner !== null && fin.winner !== id}
            />
          );
        })}
      </button>
      {(onAway.length > 0 || onHome.length > 0) && <SidesLine away={onAway} home={onHome} fans={r.fans} meId={meId} won={fin ? [fin.winner === r.away, fin.winner === r.home] : null} names={[away?.short ?? "", home?.short ?? ""]} />}

      {!begun && !postponed && couchId && (
        <div data-rivalry-action className="mt-3">
          {q.isLoading ? (
            <div className="h-12 animate-pulse rounded-[4px] bg-secondary" />
          ) : q.isError ? (
            <button type="button" onClick={() => void q.refetch()} className="nd-press flex h-11 w-full items-center justify-center rounded-[4px] text-[14px] font-semibold outline-1 -outline-offset-1 outline-edge">
              Couldn&rsquo;t load sides · Try again
            </button>
          ) : meFan && otherFan ? (
            mine?.side ? (
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-[13px] text-muted-foreground">{sent ? `${otherFan.name} gets one notification` : otherCall ? "Both calls are in" : `Waiting on ${otherFan.name}’s call`}</p>
                <button type="button" data-rivalry-change onClick={() => setSheet(true)} className="nd-press inline-flex h-11 flex-none items-center text-[14px] font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
                  Change your call
                </button>
              </div>
            ) : (
              <>
                {otherCall && (
                  <p data-rivalry-challenged className="mb-2 text-[14px] font-semibold">
                    {otherFan.name} called {short(otherCall.side)}. Your call?
                  </p>
                )}
                <CallButton yellow={!p.yellowTaken && !pass} onClick={() => setSheet(true)} line={otherCall ? "Margins stay hidden until kickoff" : `${otherFan.name} gets one notification`} />
              </>
            )
          ) : (
            <>
              <p className="mb-2 text-[13px] text-muted-foreground">Pick a side · everyone sees it · change it until kickoff</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pick a side">
                {([r.away, r.home] as const).map((id, i) => {
                  const on = shownSide === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-rivalry-side-pick={id}
                      aria-pressed={on}
                      disabled={!!pending}
                      onClick={() => void save(on ? null : id)}
                      className={`nd-press flex h-12 min-w-0 items-center justify-center gap-2 rounded-[4px] px-2 text-[15px] font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${on ? "bg-secondary" : "outline-1 -outline-offset-1 outline-edge"}`}
                    >
                      {on ? <Check className="size-4 flex-none" strokeWidth={2.5} aria-hidden /> : <TeamMark abbr={team(id)?.abbreviation ?? short(id).slice(0, 3)} color={team(id)?.color} size="xs" team={team(id) && teamKeyOf(league, id)} />}
                      <span className="truncate">{on ? `With ${r.fans[i].id === meId ? "you" : r.fans[i].name}` : short(id)}</span>
                    </button>
                  );
                })}
              </div>
              {failed && (
                <p role="alert" className="mt-2 text-[13px] font-semibold">
                  Didn&rsquo;t save · Try again
                </p>
              )}
            </>
          )}
          {meFan && failed && (
            <p role="alert" className="mt-2 text-[13px] font-semibold">
              Didn&rsquo;t save · Try again
            </p>
          )}
        </div>
      )}

      {open && p.record && (final || !begun) && p.record.w + p.record.l + p.record.t > 0 && (
        <p data-rivalry-record className="mt-2 text-[13px] text-muted-foreground">
          {recordLine(p.record, meId)}
        </p>
      )}
      {/* The foot: the game's other games, and a spectator's margin (the sheet), one row. */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          data-rivalry-more
          onClick={() => openSports({ kind: "game", league, team: r.home, game: r.id })}
          className="nd-press inline-flex h-11 items-center text-[13px] font-bold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground"
        >
          Other games on it
        </button>
        {!begun && !postponed && couchId && !meFan && !q.isLoading && !q.isError && (
          <button type="button" data-rivalry-margin onClick={() => setSheet(true)} className="nd-press inline-flex h-11 min-w-0 items-center truncate text-[13px] font-semibold text-muted-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
            {mine?.margin != null && mine.side ? `Your margin: ${mine.margin} · Change` : "Add a margin"}
          </button>
        )}
      </div>

      {couchId && (
        <CallSheet
          key={opened}
          open={sheet}
          onOpenChange={setSheet}
          league={league}
          away={away}
          home={home}
          when={r.at ? `${dayOf(r.at)} ${clockOf(r.at)}` : "Time to be set"}
          side={mine?.side ?? (meFan ? (meFan.id === r.fans[0].id ? r.away : r.home) : null)}
          margin={mine?.margin ?? typicalMargin(league)}
          other={otherFan && otherCall ? `${otherFan.name} called ${short(otherCall.side)} · margin hidden until kickoff` : null}
          tells={meFan && otherFan && !mine?.side && !otherCall ? otherFan.name : null}
          again={!!mine?.side}
          challenged={!!meFan && !!otherCall && !mine?.side}
          onPass={() => {
            try {
              localStorage.setItem(passKey(r.id), "1");
            } catch {
              /* a private window: it just isn't remembered */
            }
            setPass(true);
            setSheet(false);
          }}
          onSend={async (side, margin) => {
            const first = !mine?.side;
            const ok = await save(side, margin);
            if (ok) {
              setSheet(false);
              if (first && meFan && !otherCall) setSent(true);
            }
            return ok;
          }}
        />
      )}
    </section>
  );
}

/** A call's words at the side's right: "No call yet", "Called" / "Giants by ?", yours in full before kickoff, everyone's after. */
function callWords(call: RivalryPick | null, short: (id: string | null) => string, begun: boolean, yours: boolean): { text: string; full: boolean } | null {
  if (!call?.side) return begun ? { text: "No call", full: false } : { text: "No call yet", full: false };
  const margin = call.margin != null && (begun || yours) ? String(call.margin) : call.called ? "?" : null;
  return { text: margin ? `${short(call.side)} by ${margin}` : short(call.side), full: begun || yours };
}

/** The result in names: who called it, or how it split. */
function resultWords(duel: ReturnType<typeof duelOf>, fans: [Fan, Fan], picks: RivalryPick[], short: (id: string | null) => string, meId: string): string | null {
  const called = (f: Fan) => picks.some((x) => x.userId === f.id && x.side);
  const nm = (f: Fan) => (f.id === meId ? "You" : f.name);
  if (!called(fans[0]) && !called(fans[1])) return null;
  if (duel.who) {
    const f = fans.find((x) => x.id === duel.who)!;
    const r = duel.results[f.id];
    const pick = picks.find((x) => x.userId === f.id)!;
    return `${nm(f)} called it${r?.right && r.off !== null ? `: ${short(pick.side)} by ${pick.margin}, ${r.off === 0 ? "exactly" : `${r.off} off`}` : ""}`;
  }
  const [a, b] = fans.map((f) => duel.results[f.id]);
  if (a?.right && b?.right) return "Both had the winner, as close as each other";
  if (!a?.right && !b?.right) return "Neither called the winner";
  const winnerFan = a?.right ? fans[0] : fans[1];
  return `${nm(winnerFan)} had the winner; ${nm(winnerFan === fans[0] ? fans[1] : fans[0])} was closer`;
}

function recordLine(rec: PairRecord, meId: string): string {
  const nm = (f: Fan) => (f.id === meId ? "You" : f.name);
  const score = [rec.w, rec.l, ...(rec.t ? [rec.t] : [])].join("–");
  const when = rec.since ? `since ${rec.since}` : "this season";
  if (!rec.lead) return `${nm(rec.first)} and ${rec.other.id === meId ? "you" : rec.other.name} are level, ${score} ${when}`;
  return `${nm(rec.lead)} ${rec.lead.id === meId ? "lead" : "leads"} ${rec.other.id === meId ? "you" : rec.other.name} ${score} ${when}`;
}

/** One side: the team over its fan; at the right, the score over the call (before kickoff, the call alone). */
function Side(p: {
  league: string;
  t: Team | undefined;
  fan: Fan;
  name: string;
  record: string | null;
  score: number | null;
  call: { text: string; full: boolean } | null;
  result: "right" | "wrong" | null;
  off: number | null;
  lost: boolean;
}) {
  return (
    <div className={`flex min-h-[52px] items-center gap-3 ${p.lost ? "text-muted-foreground" : ""}`} data-rivalry-side={p.t?.id}>
      <TeamMark abbr={p.t?.abbreviation ?? p.t?.short.slice(0, 3)} color={p.t?.color} size="sm" team={p.t && teamKeyOf(p.league, p.t.id)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[16px] font-bold leading-tight">{p.t?.short}</span>
          {p.score != null && <span className="type-num flex-none text-[24px] leading-none">{p.score}</span>}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <Avatar id={p.fan.id} name={p.fan.name} size={18} />
          <span className="min-w-0 flex-1 truncate">
            {p.name}
            {p.record ? ` · ${p.record}` : ""}
          </span>
          {p.call && (
            <span data-rivalry-call className={`flex flex-none items-center gap-1 ${p.call.full ? "font-semibold text-foreground" : ""}`}>
              {p.result === "right" && <Check className="size-3.5 text-good" strokeWidth={3} aria-label="right winner" />}
              {p.call.text}
              {p.off !== null && <span className="font-normal text-muted-foreground">· {p.off === 0 ? "exact" : `${p.off} off`}</span>}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

/** The sides: away's faces at the left, home's at the right, the split as a 3 px rule (ink on the side with more). */
function SidesLine({ away, home, fans, meId, won, names }: { away: RivalryPick[]; home: RivalryPick[]; fans: [Fan, Fan]; meId: string; won: [boolean, boolean] | null; names: [string, string] }) {
  const n = away.length + home.length;
  const share = n ? away.length / n : 0.5;
  const words = (xs: RivalryPick[], fan: Fan) => `${xs.length} with ${fan.id === meId ? "you" : fan.name}`;
  return (
    <div data-rivalry-sides={`${away.length}-${home.length}`} className="mt-2.5" aria-label={`Sides: ${away.length} with ${names[0]}, ${home.length} with ${names[1]}`}>
      <div className="flex items-center justify-between gap-3">
        <FaceStack xs={away} />
        <FaceStack xs={home} right />
      </div>
      <div className="mt-1.5 flex h-[3px] overflow-hidden rounded-full bg-border" aria-hidden>
        <i className={`h-full ${share >= 0.5 ? "bg-foreground" : "bg-transparent"}`} style={{ width: `${share * 100}%` }} />
        <i className={`h-full ${share < 0.5 ? "bg-foreground" : "bg-transparent"}`} style={{ width: `${(1 - share) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-[13px] text-muted-foreground">
        {([away, home] as const).map((xs, i) => (
          <span key={i} data-sides-right={won?.[i] && xs.length ? "" : undefined} className={`flex min-w-0 items-center gap-1 ${won?.[i] && xs.length ? "font-semibold text-foreground" : ""}`}>
            {won?.[i] && xs.length > 0 && <Check className="size-3.5 flex-none text-good" strokeWidth={3} aria-label="right" />}
            <span className="truncate">{xs.length ? words(xs, fans[i]) : ""}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Make your call: the yellow plate (outlined when the page's yellow is elsewhere, or after Not this time). */
function CallButton({ yellow, line, onClick }: { yellow: boolean; line: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-rivalry-call-open={yellow ? "yellow" : "outlined"}
      onClick={onClick}
      className={`nd-press flex min-h-14 w-full flex-col items-start justify-center gap-0.5 rounded-[4px] px-3.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${yellow ? "bg-chyron text-chyron-foreground" : "outline-1 -outline-offset-1 outline-edge"}`}
    >
      <span className={yellow ? "type-caption text-[20px]" : "text-[15px] font-bold"}>Make your call</span>
      <span className={`text-[13px] ${yellow ? "font-semibold" : "text-muted-foreground"}`}>{line}</span>
    </button>
  );
}

/** Your call: who wins (yours chosen), by how many (a sport's usual margin), and who's told. */
function CallSheet(p: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  league: string;
  away: Team | undefined;
  home: Team | undefined;
  when: string;
  side: string | null;
  margin: number;
  other: string | null;
  tells: string | null;
  again: boolean;
  challenged: boolean;
  onPass: () => void;
  onSend: (side: string, margin: number) => Promise<boolean>;
}) {
  const [side, setSide] = useState<string | null>(p.side);
  const [margin, setMargin] = useState(p.margin);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const teams = [p.away, p.home].filter((t): t is Team => !!t);
  const step = (d: number) => setMargin((m) => Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, m + d)));
  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange} title="Your call" subtitle={`${p.away?.short ?? ""} at ${p.home?.short ?? ""} · ${p.when}`}>
      <div data-call-sheet className="pb-2">
        <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Who wins</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Who wins">
          {teams.map((t) => {
            const on = side === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                data-call-side={t.id}
                onClick={() => setSide(t.id)}
                className={`nd-press flex h-16 min-w-0 items-center gap-2.5 rounded-[4px] bg-secondary px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${on ? "outline-2 -outline-offset-2 outline-foreground" : "outline-1 -outline-offset-1 outline-border"}`}
              >
                <TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} size="sm" team={teamKeyOf(p.league, t.id)} />
                <b className="min-w-0 flex-1 truncate text-[16px] font-semibold">{t.short}</b>
                {on && <Check className="size-5 flex-none" strokeWidth={3} aria-hidden />}
              </button>
            );
          })}
        </div>
        <p className="mb-2 mt-5 text-[13px] font-semibold text-muted-foreground">By how many</p>
        <div className="flex items-center gap-3" data-call-margin={margin}>
          <button type="button" aria-label="One fewer" disabled={margin <= MARGIN_MIN} onClick={() => step(-1)} className="nd-press grid size-12 flex-none place-items-center rounded-[4px] outline-1 -outline-offset-1 outline-edge disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-foreground">
            <Minus className="size-5" aria-hidden />
          </button>
          <output aria-live="polite" className="type-num min-w-0 flex-1 text-center text-[44px] leading-none">
            {margin}
          </output>
          <button type="button" aria-label="One more" disabled={margin >= MARGIN_MAX} onClick={() => step(1)} className="nd-press grid size-12 flex-none place-items-center rounded-[4px] outline-1 -outline-offset-1 outline-edge disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-foreground">
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        {p.other && <p className="mt-4 text-[14px] text-muted-foreground">{p.other}</p>}
        <button
          type="button"
          data-call-send
          disabled={!side || busy}
          onClick={async () => {
            if (!side) return;
            setBusy(true);
            setFailed(false);
            const ok = await p.onSend(side, margin);
            setBusy(false);
            if (!ok) setFailed(true);
          }}
          className="nd-press mt-4 flex min-h-16 w-full flex-col items-start justify-center gap-1 rounded-[4px] bg-chyron px-3.5 py-2.5 text-left text-chyron-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <span className="type-caption text-[22px]">{busy ? "Saving…" : p.again ? "Save your call" : "Make your call"}</span>
          <span className="text-[13px] font-semibold">
            {side ? `${teams.find((t) => t.id === side)?.short} by ${margin}` : "Pick who wins"}
            {p.tells ? ` · ${p.tells} gets one notification` : ""}
          </span>
        </button>
        <p className="mt-2 text-[13px] text-muted-foreground">{failed ? "Didn’t save · Try again" : "Sides are public; margins stay hidden until kickoff."}</p>
        {p.challenged && (
          <button type="button" data-call-pass onClick={p.onPass} className="nd-press mt-1 inline-flex h-11 items-center text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
            Not this time
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** One side's faces, four then a count (C2's backing line and watchers share it). */
export function FaceStack({ xs, right, size = 22, max = 4 }: { xs: { userId: string; name: string }[]; right?: boolean; size?: number; max?: number }) {
  return (
    <span className={`flex items-center ${right ? "flex-row-reverse" : ""}`}>
      {xs.slice(0, max).map((x, i) => (
        <span key={x.userId} className={`relative rounded-[3px] ${i ? (right ? "-mr-1.5" : "-ml-1.5") : ""}`} style={{ boxShadow: "0 0 0 2px var(--card)" }}>
          <Avatar id={x.userId} name={x.name} size={size} />
        </span>
      ))}
      {xs.length > max && <span className={`text-[12px] font-semibold text-muted-foreground ${right ? "mr-1.5" : "ml-1.5"}`}>+{xs.length - max}</span>}
    </span>
  );
}
