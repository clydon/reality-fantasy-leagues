"use client";

import { matchSlots } from "@/lib/lineup-slots";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { PriceEnd } from "./price-end";
import { Check, ChevronRight, Lock, MessageCircleQuestion, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { bets as betWrites, moves as moveWrites, type GameView, type TableRow, type WaiverWeek } from "../data";
import type { ShowData } from "../screens/show-space";
import { Avatar, Faces } from "../ui/bars";
import { ordinal } from "../games";
import { Btn, Chip } from "../ui/parts";
import { toast } from "../ui/toast";
import type { SideBet } from "@/lib/game/week-view";
import { signed } from "./lineup-sheet";
import { castName, faceIn, first, openMoves } from "./moves";
import { Face } from "./parts";
import { oneGame, recordWords, scoreWords, type WeekCard, type WeekSide } from "./this-week";

// The parts a game's own page leads with (the design round's step 2: docs/design-round/step2-game-page-spec.md): This week (the
// matchup: you and who you play, each with a record, the starters, the one state line and the move), the side bets row and its
// sheet (call, post, settle), Your team, and the matchup sheet's body (two lineups on one points scale: data round 3's B, the
// why of a week). Lower Third: faces and condensed numbers over the show's art, one plate for the move only while it's due.

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace("-", "−");

/** Ink for a tag on a colour read from the show's art: plate ink on a light one, white on a dark one. */
export function inkOn(colour: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour.trim());
  const rgb = m ? [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255) : (colour.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((n) => Number(n) / 255);
  if (rgb.length < 3) return "var(--plate-foreground)";
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "var(--plate-foreground)" : "#ffffff";
}

// ---------- This week ----------

/** One side of the matchup, centred toward the other so the two read as one figure: their face, name and record (and their seed),
 *  and (a show's few) their starters under them. */
function Side({ g, s, faces, small }: { g: GameView; s: WeekSide; faces: string[] | "hidden" | null; small: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center" data-week-side={s.playerId}>
      <Avatar id={s.userId ?? s.playerId} name={s.name} size={56} />
      <b className="type-caption mt-2 max-w-full text-[26px] leading-[.95] [overflow-wrap:anywhere]">{s.name}</b>
      <span className="type-num mt-1 text-[15px] text-muted-foreground" data-week-record>
        {s.record ?? ""}
        {s.seed !== null && <span className="ml-1.5 tracking-[0.04em]">· Seed {s.seed}</span>}
      </span>
      {small && faces && <Starters g={g} faces={faces} count={s.name === "You" ? (g.lineup?.slots ?? undefined) : undefined} className="mt-2.5 justify-center" />}
    </div>
  );
}

/** A sport's positions in the order a lineup card reads them (quarterback first, defense last); anything else after, as given. */
export const POSITION_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "OP", "K", "PK", "DEF", "DST", "D/ST", "PG", "SG", "G", "SF", "PF", "F", "C", "UTIL"];
const byPosition = (g: GameView, ids: string[]) =>
  [...ids].sort((a, b) => {
    const pa = POSITION_ORDER.indexOf((faceIn(g, a)?.role ?? "").toUpperCase()), pb = POSITION_ORDER.indexOf((faceIn(g, b)?.role ?? "").toUpperCase());
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });

/** Starters as faces (a sport's with their position under each); "hidden": the other side before it locks (dashed places). */
function Starters({ g, faces, count, className = "" }: { g: GameView; faces: string[] | "hidden"; count?: number; className?: string }) {
  if (faces === "hidden") {
    const n = count ?? g.lineup?.slots ?? 2;
    return (
      <span role="img" aria-label="Their lineup shows when it locks" className={`flex gap-1 ${className}`} data-week-hidden>
        {Array.from({ length: Math.min(n, 4) }, (_, i) => (
          <span key={i} className="grid size-[30px] place-items-center rounded-[2px] border border-dashed border-edge text-muted-foreground">
            {i === 0 && <Lock className="size-3" aria-hidden />}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={`flex flex-wrap gap-1 ${className}`} data-week-starters>
      {count !== undefined &&
        Array.from({ length: Math.max(0, count - faces.length) }, (_, i) => <span key={`gap-${i}`} aria-label="A place still to fill" className="size-[30px] rounded-[2px] border border-dashed border-foreground/60" />)}
      {byPosition(g, faces).map((id) => {
        const c = faceIn(g, id);
        return (
          <span key={id} className="flex w-[32px] flex-col items-center">
            <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} className="size-[30px] rounded-[2px] text-[13px]" />
            {c?.role && <span className="mt-0.5 text-[11px] font-bold tracking-[0.02em] text-muted-foreground">{c.role}</span>}
          </span>
        );
      })}
    </span>
  );
}

/** A plate for a result you're seeing for the first time (the news): the week's tag in its result's tone, never yellow. */
function NewsPlate({ last, onOpen, words }: { last: NonNullable<WeekCard["last"]>; onOpen: () => void; words: ShowData["words"] }) {
  const tone = last.result === "win" ? "bg-good text-good-foreground" : "bg-quiet-tag text-quiet-tag-foreground";
  return (
    <button type="button" data-open-last data-week-news onClick={onOpen} className="nd-press mt-3 block w-full text-left">
      <span className="flex min-h-[52px] overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
        <span className={`tag-cut type-caption flex flex-none items-center whitespace-nowrap py-1 pl-3 pr-[26px] text-[15px] tracking-[0.04em] ${tone}`}>
          {words.ep} {last.episode}
        </span>
        <span className="tag-tuck flex min-w-0 flex-1 flex-col justify-center py-2 pl-[26px] pr-3">
          <b className="type-caption text-[19px] [overflow-wrap:anywhere]">{last.line.replace(`${words.ep} ${last.episode} · `, "")}</b>
          <span className="mt-[3px] text-[13px] leading-[1.3] text-plate-muted">See how it went</span>
        </span>
        <span className="grid w-11 flex-none place-items-center">
          <ChevronRight className="size-[22px]" aria-hidden />
        </span>
      </span>
    </button>
  );
}

/** This week: the matchup over the show's art (or your place and gap), its one state line, the move while it's due, last week. */
export function WeekBlock({ g, w, colour, note, move, reveal, news, onMatchup, onLast, words }: { g: GameView; w: WeekCard; colour: string | null; note?: string | null; move: ReactNode; reveal: ReactNode; news?: boolean; onMatchup: (episode: number | null) => void; onLast: (episode: number, playerId?: string) => void; words: ShowData["words"] }) {
  const small = (g.lineup?.slots ?? 2) <= 4;
  const champion = w.champion;
  const [tag, ...rest] = w.label.split(" · ");
  const label = w.them ? `Open the matchup: you, ${w.you.record ?? ""}, against ${w.them.name}, ${w.them.record ?? ""}` : "Open your week";
  return (
    <section className="relative px-4 pb-1" data-week-card data-week-tone={w.tone} data-week-kind={w.kind}>
      <p className="flex min-h-7 items-center gap-2.5" data-week-label>
        {tag && (
          <span className="tag-cut gp-tag-in type-caption flex h-7 flex-none items-center bg-quiet-tag pl-2.5 pr-[22px] text-[15px] tracking-[0.04em] text-quiet-tag-foreground" style={colour ? { background: colour, color: inkOn(colour) } : undefined}>
            {tag}
          </span>
        )}
        <span className="type-caption truncate text-[15px] tracking-[0.06em] text-foreground/85">{rest.join(" · ")}</span>
      </p>
      {champion ? (
        <button type="button" data-open-matchup onClick={() => onMatchup(w.episode)} className="nd-press mt-3 flex w-full items-center gap-3 text-left">
          <Avatar id={champion.userId ?? champion.playerId} name={champion.name} size={56} />
          <span className="min-w-0">
            <b className="type-caption block text-[30px] leading-[.95]">{champion.name === "You" ? "You won it" : `${champion.name} won it`}</b>
            <span className="type-num mt-1 block text-[15px] text-muted-foreground">{champion.record}</span>
          </span>
        </button>
      ) : w.kind === "matchup" ? (
        <button type="button" data-open-matchup onClick={() => onMatchup(w.episode)} aria-label={label} className="nd-press mx-auto mt-3 grid w-full max-w-[340px] grid-cols-[1fr_auto_1fr] items-start gap-1">
          <Side g={g} s={w.you} faces={w.mine} small={small} />
          <span className="type-caption mt-[18px] text-[19px] tracking-[0.06em] text-foreground/70">{w.score ? `${w.score.you}–${w.score.them}` : "vs"}</span>
          {w.them ? (
            <Side g={g} s={w.them} faces={w.theirs} small={small} />
          ) : (
            <div className="flex min-w-0 flex-col items-center text-center">
              <span className="type-caption grid size-14 place-items-center rounded-[3px] border border-dashed border-edge text-[15px] text-muted-foreground">–</span>
              <b className="type-caption mt-2 text-[22px] leading-[.95] text-muted-foreground">{w.stand === "median" ? "The middle score" : "A bye"}</b>
              <span className="mt-1 text-[13px] leading-snug text-muted-foreground">{w.stand === "median" ? "Odd one out: beat the others' middle score" : "Nobody to play"}</span>
            </div>
          )}
        </button>
      ) : (
        <button type="button" data-open-matchup onClick={() => onMatchup(w.episode)} aria-label={label} className="nd-press mt-3 flex w-full items-center gap-3 text-left">
          <Avatar id={w.you.userId ?? w.you.playerId} name="You" size={56} />
          <b className="type-caption text-[26px] leading-[.95]">{w.kind === "solo" ? "Your season" : "You"}</b>
        </button>
      )}
      {!small && w.kind === "matchup" && w.mine && (
        // A sport's lineup: yours by position, theirs in one line (a second row of nine would lose whose is whose).
        <div className="mt-3" data-week-rows>
          <Starters g={g} faces={w.mine} />
          {w.them && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground" data-week-theirs>
              {w.theirs === "hidden" ? <Lock className="size-3.5 flex-none" aria-hidden /> : null}
              {w.theirs === "hidden" ? `${w.them.name}'s ${g.lineup?.slots ?? ""} show when the week locks` : Array.isArray(w.theirs) ? `${w.them.name}'s ${w.theirs.length} are locked in · the matchup has them` : null}
            </p>
          )}
        </div>
      )}
      {w.state && (
        <p className="mt-3 text-[15px] leading-snug text-foreground/90" data-week-state>
          {!small && w.them ? w.state.replace(/ · [^·]*'s shows when it locks$/, "") : w.state}
        </p>
      )}
      {note && (
        <p className="mt-2 text-[15px] leading-snug text-foreground/90" data-week-waivers>
          {note}
        </p>
      )}
      {reveal}
      {move}
      {w.last &&
        (news ? (
          <NewsPlate last={w.last} words={words} onOpen={() => onLast(w.last!.episode, w.last!.playerId)} />
        ) : (
          <button type="button" data-open-last onClick={() => onLast(w.last!.episode, w.last!.playerId)} className="nd-press mt-3 flex min-h-11 w-full items-center gap-2.5 border-t border-border pt-2 text-left">
            <ResultSquare r={w.last.result} />
            <span className="min-w-0 flex-1 text-[15px] font-semibold">{w.last.line.replace(`${words.ep} ${w.last.episode} · `, "")}</span>
            <span className="text-[13px] text-muted-foreground">
              {words.ep} {w.last.episode}
            </span>
            <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
          </button>
        ))}
    </section>
  );
}

/** A week's result as the season grid squares it: W teal, L and T on the input fill, a quiet week a dash. */
export function ResultSquare({ r }: { r: "win" | "loss" | "tie" | "quiet" | "final" }) {
  const t = r === "win" ? "W" : r === "loss" ? "L" : r === "tie" ? "T" : r === "final" ? "F" : "–";
  return <b className={`type-num grid size-6 flex-none place-items-center rounded-[2px] text-[14px] ${r === "win" ? "bg-good text-good-foreground" : r === "quiet" ? "border border-dashed border-edge text-muted-foreground" : "bg-input text-foreground"}`}>{t}</b>;
}

/** The waiver week in a line (an exclusive draft's): who you lost and that you're owed one, your claim once it's in, what the
 *  week gave you once it ran (and why, when it wasn't your first choice). Null when there's no week, or shared teams. */
export function waiverLine(ww: WaiverWeek | undefined, g: GameView, when: (iso: string) => string, words: ShowData["words"], short?: boolean): string | null {
  if (!ww || ww.shared || !ww.period || ww.revealFirst !== null) return null;
  const name = (id: string | undefined) => castName(faceIn(g, id ?? "") ?? ww.free.find((f) => f.id === id), g) || "someone";
  if (ww.stage === "open") {
    const spot = ww.spots.find((s) => s.addIds.length);
    if (spot) {
      const order = spot.addIds.slice(0, 2).map((id) => name(id));
      return `Your claim is in: ${order[0]} first${order[1] ? `, then ${order[1]}` : ""}${ww.period.due ? ` · claims run ${when(ww.period.due)}` : ""}`;
    }
    if (ww.replace.length) return `${name(ww.replace[0])} went home in ${words.ep} ${ww.period.episode}.${short ? "" : " You're owed a replacement."}`;
    return null;
  }
  if (ww.stage === "processed" && ww.run && ww.run.episode === ww.period.episode) {
    const mine = ww.run.moves.find((m) => m.you && m.add);
    if (mine?.add) {
      const why = mine.choice && mine.choice > 1 && mine.why ? `, your ${mine.why.replace(/\.?$/, ".").replace(/^(\d+\w+) choice: /, "$1 choice: ")}` : ".";
      const early = ww.period.due && Date.parse(ww.run.at) < Date.parse(ww.period.due) ? " It ran early: everyone owed one had claimed." : "";
      return `You got ${castName(faceIn(g, mine.add.id) ?? mine.add, g)}${why}${early}`;
    }
  }
  return null;
}

// ---------- side bets: the row and its sheet ----------

/** The side bets row: how many on the episode the move is for, how many you've called; for whoever runs the game, calls to settle. */
export function SideBetsRow({ g, words, onOpen, runs }: { g: GameView; words: ShowData["words"]; onOpen: () => void; runs: boolean }) {
  const b = g.bets;
  if (!b) return null;
  const open = b.bets.filter((x) => x.open);
  const played = b.bets.filter((x) => x.played);
  const ep = open[0]?.episode ?? b.postTo;
  let detail: string;
  if (runs && b.unsettled > 0) detail = `${b.unsettled} ${b.unsettled === 1 ? "call" : "calls"} to settle on ${words.ep} ${played[0]?.episode}${open.length ? ` · ${open.length} open on ${words.ep} ${ep}, you've called ${open.filter((x) => x.mine).length}` : ""}`;
  else if (open.length) detail = `${open.length} on ${words.ep} ${ep} · you've called ${open.filter((x) => x.mine).length}`;
  else if (played.length && played.every((x) => x.settled)) detail = `${words.ep} ${played[0].episode}: you called ${played.filter((x) => x.mine?.correct).length} of ${played.length} right`;
  else if (played.length) detail = `${words.ep} ${played[0].episode}: ${played.some((x) => x.stage === "early") ? "settled with the final results" : "waiting to be settled"}`;
  else if (b.postTo !== null) detail = `None on ${words.ep} ${b.postTo} yet · post one`;
  else return null;
  return (
    <button type="button" onClick={onOpen} data-side-bets-row className="nd-press mx-4 mt-1 flex min-h-[56px] w-[calc(100%-32px)] items-center gap-3 border-b border-border py-2 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <MessageCircleQuestion className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold">Side bets</b>
        <small className={`mt-0.5 block text-[13px] ${runs && b.unsettled > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{detail}</small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

const WORTH = [1, 2, 3, 5];

/** The side bets sheet's body: each bet (your call, everyone's once it's locked, the marks once it's settled), Settle for whoever
 *  runs the game, and Post a side bet. */
export function BetsBody({ g, words, seasonId, runs, onPerson }: { g: GameView; words: ShowData["words"]; seasonId: string; runs: boolean; onPerson?: (playerId: string) => void }) {
  const qc = useQueryClient();
  const b = g.bets;
  const refresh = () => qc.invalidateQueries({ queryKey: ["new-design", "games", seasonId] });
  if (!b) return null;
  return (
    <div className="pb-3" data-bets-sheet>
      {b.bets.length === 0 && <p className="mt-1 text-[15px] text-muted-foreground">No side bets yet. Anyone playing can post one: a question about the next {words.episode.toLowerCase()}, worth a few points to whoever calls it.</p>}
      {[...b.bets]
        .sort((p, q) => (runs ? Number(q.played && !q.settled) - Number(p.played && !p.settled) : 0))
        .map((x) => (
          <BetItem key={x.betId} g={g} x={x} words={words} runs={runs} onSaved={refresh} onPerson={onPerson} />
        ))}
      {b.postTo !== null && <PostBet g={g} episode={b.postTo} words={words} onSaved={refresh} />}
    </div>
  );
}

function BetItem({ g, x, words, runs, onSaved, onPerson }: { g: GameView; x: SideBet; words: ShowData["words"]; runs: boolean; onSaved: () => void; onPerson?: (playerId: string) => void }) {
  const [call, setCall] = useState(x.mine?.text ?? "");
  const [busy, setBusy] = useState(false);
  const changed = call.trim() !== (x.mine?.text ?? "");
  const save = async () => {
    setBusy(true);
    try {
      if (x.mine) await moveWrites.unguess(g.leagueId, x.epId, x.betId, x.mine.id);
      if (call.trim()) await moveWrites.guess(g.leagueId, x.epId, x.betId, g.playerId, call.trim());
      await onSaved();
      toast(call.trim() ? `Called: ${call.trim()}` : "Your call is taken back");
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const meta = [`${x.points} ${x.points === 1 ? "pt" : "pts"}`, x.byYou ? "posted by you" : x.by ? `posted by ${first(x.by)}` : null, `${x.calls} called`].filter(Boolean).join(" · ");
  return (
    <article className="border-t border-border py-3.5 first:border-t-0" data-bet={x.betId} data-bet-state={x.open ? "open" : x.settled ? "settled" : x.played ? "to-settle" : "locked"}>
      <p className="text-[13px] text-muted-foreground">
        {words.ep} {x.episode} · {meta}
      </p>
      <h3 className="mt-1 text-[17px] font-semibold leading-snug">{x.label}</h3>
      {x.open ? (
        <div className="mt-2.5">
          {x.options ? (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Your call">
              {x.options.map((o) => (
                <Chip key={o} on={call === o} role="radio" aria-checked={call === o} data-call={o} onClick={() => setCall(call === o ? "" : o)} className="h-11 px-3.5 text-[15px]">
                  {o}
                </Chip>
              ))}
            </div>
          ) : (
            <input value={call} onChange={(e) => setCall(e.target.value)} placeholder="Your call" aria-label="Your call" className="h-11 w-full rounded-[3px] bg-input/40 px-3 outline-1 -outline-offset-1 outline-input" />
          )}
          <p className="mt-2 text-[13px] text-muted-foreground">Everyone&apos;s calls show when {words.ep} {x.episode} starts.{x.calls < 2 ? " It pays once two have called it." : ""}</p>
          {changed && (
            <Btn tone="ink" wide disabled={busy} onClick={save} className="mt-2.5" data-call-save>
              {busy ? "Saving…" : call.trim() ? `Call it: ${call.trim()}` : "Take back your call"}
            </Btn>
          )}
        </div>
      ) : (
        <Calls g={g} x={x} runs={runs} onSaved={onSaved} onPerson={onPerson} />
      )}
    </article>
  );
}

/** Everyone's calls on a locked bet; once its episode is in, the marks, and for whoever runs the game, Settle. */
function Calls({ g, x, runs, onSaved, onPerson }: { g: GameView; x: SideBet; runs: boolean; onSaved: () => void; onPerson?: (playerId: string) => void }) {
  const calls = useMemo(() => x.everyone ?? [], [x.everyone]);
  const answers = useMemo(() => [...new Set(calls.map((c) => c.guess.trim()))], [calls]);
  // The AI's answer, when it gave one it wasn't sure enough to settle with, starts chosen (BACKLOG 87).
  const aiPick = x.ai?.answer && !x.ai.settled ? (answers.find((a) => a.toLowerCase() === x.ai!.answer!.toLowerCase()) ?? null) : null;
  const [pick, setPick] = useState<string | null>(aiPick);
  const [busy, setBusy] = useState(false);
  const settle = async (right: string) => {
    setBusy(true);
    try {
      for (const c of calls) await betWrites.mark(g.leagueId, x.epId, x.betId, c.predId, c.guess.trim().toLowerCase() === right.toLowerCase());
      await onSaved();
      const winners = calls.filter((c) => c.guess.trim().toLowerCase() === right.toLowerCase()).map((c) => (c.you ? "you" : first(c.name)));
      toast(right ? `Settled: ${right}${winners.length && x.calls >= 2 ? ` · +${x.points} to ${winners.join(" and ")}` : ""}` : "Settled: nobody called it");
      setPick(null);
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const flip = async (predId: string, now: boolean | null) => {
    try {
      await betWrites.mark(g.leagueId, x.epId, x.betId, predId, now === true ? false : true);
      await onSaved();
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    }
  };
  if (!calls.length) return <p className="mt-2 text-[14px] text-muted-foreground">Nobody called it.</p>;
  const canSettle = runs && x.played;
  return (
    <div className="mt-2">
      <ul className="flex flex-col">
        {calls.map((c) => (
          <li key={c.predId} className="flex min-h-11 items-center gap-2.5" data-call-of={c.playerId}>
            {/* Who called it opens their sheet in the game (the drill pass, 2026-11-17). */}
            <button type="button" data-door-person={c.playerId} disabled={!onPerson} onClick={() => onPerson?.(c.playerId)} className="nd-press flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left disabled:pointer-events-none">
              <Avatar id={g.table.find((r) => r.playerId === c.playerId)?.userId ?? c.playerId} name={c.name} size={26} />
              <span className="min-w-0 flex-1 text-[15px]">
                <b className="font-semibold">{c.you ? "You" : first(c.name)}</b> <span className="text-muted-foreground">·</span> {c.guess}
              </span>
            </button>
            {c.correct !== null &&
              (canSettle ? (
                <button type="button" onClick={() => flip(c.predId, c.correct)} aria-label={`${c.correct ? "Right" : "Wrong"}: tap to change`} className="grid size-11 place-items-center">
                  <Mark ok={c.correct} />
                </button>
              ) : (
                <Mark ok={c.correct} />
              ))}
            {c.correct === true && x.calls >= 2 && <span className="type-num text-[15px]">+{x.points}</span>}
          </li>
        ))}
      </ul>
      {!x.played && <p className="mt-1.5 text-[13px] text-muted-foreground">Locked. The AI settles it with the final results.</p>}
      <Settled x={x} runs={canSettle} />
      {x.played && x.calls < 2 && <p className="mt-1.5 text-[13px] text-muted-foreground">Fewer than two called it, so it pays nothing.</p>}
      {canSettle && !x.settled && (
        <div className="mt-3 rounded-[3px] bg-secondary/60 p-3" data-settle>
          <p className="text-[14px] font-semibold">What happened?</p>
          {x.ai && (
            <p className="mt-1 text-[13px] text-muted-foreground" data-settle-ai>
              {x.ai.answer ? `The AI's answer: ${x.ai.answer}, but it wasn't sure enough to settle it.` : "The AI couldn't find the answer in the episode's sources."}
              {x.ai.answer && x.ai.evidence ? ` ${x.ai.evidence}` : ""}
            </p>
          )}
          {!x.ai && x.stage === "early" && <p className="mt-1 text-[13px] text-muted-foreground">The AI settles it with the final results, or settle it now.</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {answers.map((a) => (
              <Chip key={a} on={pick === a} data-settle-answer={a} onClick={() => setPick(pick === a ? null : a)} className="h-11 px-3.5 text-[15px]">
                {a}
              </Chip>
            ))}
            {!(x.options && x.options.length === 2 && x.options.every((o) => answers.some((a) => a.toLowerCase() === o.toLowerCase()))) && (
              <Chip on={pick === ""} data-settle-answer="" onClick={() => setPick(pick === "" ? null : "")} className="h-11 px-3.5 text-[15px]">
                None of these
              </Chip>
            )}
          </div>
          {pick !== null && (
            <Btn tone="ink" wide disabled={busy} onClick={() => settle(pick)} className="mt-2.5" data-settle-save>
              {busy ? "Settling…" : pick ? `Settle: ${pick}` : "Settle: nobody called it"}
            </Btn>
          )}
          <p className="mt-2 text-[13px] text-muted-foreground">
            Each call matching it is marked right, the rest wrong. Right calls get +{x.points} in {"that"} week&apos;s total{x.calls >= 2 ? ", so a close matchup that week can change" : ""}. Tap a mark after to change it.
          </p>
        </div>
      )}
    </div>
  );
}

/** Who settled a played bet, or what it's waiting on (BACKLOG 87: the AI settles with the final results; whoever runs the game can
 *  change a mark, and the page says so). `runs`: the reader can change the marks. */
function Settled({ x, runs }: { x: SideBet; runs: boolean }) {
  if (!x.played || !x.everyone?.length) return null;
  const d = x.decided;
  const name = (who: string | null, you: boolean) => (you ? "you" : who ? first(who) : "whoever runs the game");
  let line: string | null = null;
  if (x.settled && d?.by === "ai") line = `Settled by the AI: ${x.ai?.answer ?? "nobody called it"}.${x.ai?.evidence ? ` ${x.ai.evidence}` : ""}${runs ? " Wrong? Tap a mark to change it." : ""}`;
  else if (x.settled && d?.by === "changed") line = `Changed by ${name(d.who, d.you)}. The AI said ${x.ai?.answer ?? "nobody called it"}.`;
  else if (x.settled && d?.by === "person") line = `Settled by ${name(d.who, d.you)}.`;
  else if (!x.settled && !runs) {
    if (x.stage === "early") line = "Settled with the final results.";
    else if (x.ai) line = x.ai.answer ? "Waiting on whoever runs the game: the AI wasn't sure." : "Waiting on whoever runs the game: the AI couldn't find the answer.";
    else line = "Waiting to be settled.";
  }
  if (!line) return null;
  const tag = d && x.settled ? d.by : x.stage === "early" ? "early" : "waiting";
  return (
    <p className="mt-1.5 text-[13px] text-muted-foreground" data-settled-by={tag}>
      {line.charAt(0).toUpperCase() + line.slice(1)}
    </p>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return <i className={`grid size-5 place-items-center rounded-full not-italic ${ok ? "bg-good text-good-foreground" : "bg-input text-muted-foreground"}`}>{ok ? <Check className="size-3" strokeWidth={3.5} aria-label="Right" /> : <X className="size-3" strokeWidth={3.5} aria-label="Wrong" />}</i>;
}

/** Post a side bet: the question and its worth. */
function PostBet({ g, episode, words, onSaved }: { g: GameView; episode: number; words: ShowData["words"]; onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState(2);
  const [busy, setBusy] = useState(false);
  const post = async () => {
    setBusy(true);
    try {
      await betWrites.post(g.leagueId, label.trim(), points);
      setLabel("");
      await onSaved();
      toast(`Posted for ${words.ep} ${episode}. Everyone's told.`);
    } catch (e) {
      toast.quiet(`Not posted: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-2 border-t border-border pt-4" data-post-bet>
      <h3 className="type-caption text-[20px]">Post a side bet</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">
        On {words.ep} {episode}. Ask it so a call can be right or wrong: &ldquo;Will an idol be played?&rdquo;, &ldquo;Who goes home?&rdquo;
      </p>
      <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 200))} placeholder="Your question" aria-label="Your question" data-post-label className="mt-2.5 h-11 w-full rounded-[3px] bg-input/40 px-3 outline-1 -outline-offset-1 outline-input" />
      <div className="mt-2.5 flex items-center gap-1.5" role="radiogroup" aria-label="Worth">
        <span className="mr-1 text-[14px] text-muted-foreground">Worth</span>
        {WORTH.map((n) => (
          <Chip key={n} on={points === n} role="radio" aria-checked={points === n} data-post-worth={n} onClick={() => setPoints(n)} className="h-11 min-w-11 justify-center text-[15px]">
            {n}
          </Chip>
        ))}
        <span className="ml-1 text-[14px] text-muted-foreground">pts</span>
      </div>
      <Btn tone="ink" wide disabled={busy || !label.trim()} onClick={post} className="mt-3" data-post-save>
        {busy ? "Posting…" : "Post it"}
      </Btn>
    </section>
  );
}

// ---------- your team ----------

/** Your castaways (or players): each a face, how they stand, their points so far in this game; a face opens them. */
export function YourTeam({ g, words, exclusive, onFace, onSheet }: { g: GameView; words: ShowData["words"]; exclusive: boolean; onFace: (id: string) => void; onSheet: () => void }) {
  const r = g.you;
  if (!r || !r.team.length) return null;
  // A game with a lineup (Weekly Lineup, best ball: the table's weeks): only who started scores, so each number is what they scored
  // for you as a starter, with what they scored on the bench beside it, and the numbers add up to your total (the bench's truth
  // check: docs/PLAN-game-preview.md, "Noticed, not fixed" 4). Anyone who scored for you and has left your team stays listed.
  const lineup = r.weeks.length > 0;
  const counted = new Map<string, number>();
  const benched = new Map<string, number>();
  for (const w of r.weeks) {
    for (const x of w.started) counted.set(x.id, (counted.get(x.id) ?? 0) + x.points);
    for (const x of w.bench) benched.set(x.id, (benched.get(x.id) ?? 0) + x.points);
  }
  const predictions = r.weeks.reduce((t, w) => t + (w.predictions ?? 0), 0);
  const gone = lineup ? [...counted.keys()].filter((id) => !r.team.includes(id) && (counted.get(id) ?? 0) !== 0) : [];
  const ids = [...[...r.team].sort((a, b) => Number(!!faceIn(g, a)?.knocked) - Number(!!faceIn(g, b)?.knocked)), ...gone];
  // Round 5 (B2; Designs needed 30): an auction's prices beside each, and what you spent.
  const prices = g.prices ?? null;
  const spent = prices ? prices.spent[r.playerId] : undefined;
  return (
    <section className="mt-8 px-4" data-your-team data-game-you>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Your team</h2>
        <button type="button" data-door-you onClick={onSheet} className="inline-flex min-h-11 items-center gap-0.5 text-[14px] font-semibold">
          Week by week
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      {spent !== undefined && <p data-team-spent className="-mt-1 mb-0.5 text-[13px] font-semibold">Spent {spent} of {prices!.budget}</p>}
      {(exclusive || lineup) && (
        <p className="-mt-1 mb-1 text-[13px] text-muted-foreground">
          {[exclusive ? "Only you have them: one owner each." : null, lineup ? "What each scored for you as a starter." : null].filter(Boolean).join(" ")}
        </p>
      )}
      <ul>
        {ids.map((id) => {
          const c = faceIn(g, id);
          if (!c) return null;
          const yours = r.team.includes(id);
          const paid = prices?.paid[id];
          const captain = !c.left && g.lineup && g.twists?.captain?.castawayId === id ? `Captain ×${g.twists.captain.times}` : null;
          const line = !yours ? "No longer on your team" : c.left ? (c.out ? `Out · ${words.ep} ${c.out}` : "Out") : [captain, c.role, c.tribe?.name].filter(Boolean).join(" · ") || "Still in";
          const points = lineup ? (counted.get(id) ?? 0) : (c.points ?? 0);
          const bench = lineup ? (benched.get(id) ?? 0) : 0;
          return (
            <li key={id}>
              <button type="button" data-door-cast={id} onClick={() => onFace(id)} className="nd-press flex min-h-14 w-full items-center gap-3 border-t border-border py-1.5 text-left">
                <Face src={c.photo} name={c.name} out={c.knocked || !yours} className="size-10 flex-none rounded-[2px] text-[15px]" />
                <span className="min-w-0 flex-1">
                  <b className={`block truncate text-[16px] font-semibold ${c.knocked || !yours ? "text-muted-foreground" : ""}`}>{c.name}</b>
                  <small className="block text-[13px] text-muted-foreground">{line}</small>
                </span>
                {paid ? (
                  <PriceEnd points={points} paid={paid} />
                ) : (
                  <span className="flex flex-none flex-col items-end">
                    <span className="type-num text-[22px] leading-none" data-team-points={points}>
                      {fmt(points)}
                    </span>
                    {bench !== 0 && <small className="mt-1 text-[13px] leading-none text-muted-foreground">{`${fmt(bench)} on the bench`}</small>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {lineup && predictions !== 0 && (
          <li className="flex min-h-12 items-center gap-3 border-t border-border py-1.5" data-team-predictions>
            <span className="min-w-0 flex-1 text-[16px] font-semibold">Predictions</span>
            <span className="type-num text-[22px] leading-none" data-team-points={predictions}>
              {fmt(predictions)}
            </span>
          </li>
        )}
        {lineup && (
          <li className="flex min-h-12 items-center gap-3 border-t-2 border-foreground/40 py-1.5" data-team-total>
            <span className="min-w-0 flex-1 text-[16px] font-bold">Your total</span>
            <span className="type-num text-[22px] leading-none">{fmt(r.total)}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

// ---------- the matchup sheet's body ----------

type Line = { id: string; points: number; why: string[] };

/** Who `pid` played in week `n`, and what each side shows: played (each side's lines and bench), locked (who started, who sat),
 *  or still to lock (yours as it stands; theirs their whole team, unsplit, since a split would give the lineup away). Any seat's
 *  week: the league's games (`games`) say who plays whom before the results do. */
export function matchupOf(g: GameView, pid: string, n: number) {
  const row = (id: string | null | undefined) => (id ? (g.table.find((r) => r.playerId === id) ?? null) : null);
  const a = row(pid);
  const sq = g.plays.rows[pid]?.find((s) => s.episode === n) ?? null;
  const wk = g.games && g.games.episode === n ? (g.games.games.find((x) => x.a === pid || x.b === pid) ?? null) : null;
  const next = g.matchups?.next && g.matchups.next.episode === n && pid === g.playerId ? g.matchups.next : null;
  const oppId = sq?.result?.against ?? next?.opponent ?? (wk ? (wk.a === pid ? wk.b : wk.a) : null);
  const b = row(oppId && oppId !== pid ? oppId : null);
  const wa = a?.weeks.find((w) => w.episode === n) ?? null;
  const wb = b?.weeks.find((w) => w.episode === n) ?? null;
  const played = !!sq && sq.points !== null;
  const lockedOf = (id: string | null | undefined): string[] | null => {
    if (!id) return null;
    if (g.locked && g.locked.episode === n && id === g.playerId) return g.locked.mine;
    if (g.locked && g.locked.episode === n && pid === g.playerId && id === g.matchups?.next?.opponent) return g.locked.theirs;
    if (wk?.locked) return wk.a === id ? wk.locked.a : wk.b === id ? wk.locked.b : null;
    return null;
  };
  const stand = next?.stand ?? (wk && !wk.b ? wk.stand : null) ?? (sq?.result?.median ? "median" : null);
  return { a, b, sq, wa, wb, played, lockA: lockedOf(a?.playerId), lockB: lockedOf(b?.playerId), next, stand, quiet: played && !sq?.result };
}

export function MatchupTitle(g: GameView, pid: string, n: number, words: ShowData["words"]): { title: string; subtitle: string } {
  const m = matchupOf(g, pid, n);
  const an = m.a ? (m.a.you ? "You" : first(m.a.name)) : "";
  const bn = m.b ? (m.b.you ? "you" : first(m.b.name)) : m.stand === "median" ? "the middle score" : "a bye";
  const title = `${words.ep} ${n}`;
  const pair = `${an} vs ${bn}`;
  let subtitle: string;
  if (m.quiet) subtitle = `${pair} · counted for nobody, records unchanged`;
  else if (m.played && m.sq?.result) {
    const r = m.sq.result;
    const verb = r.r === "W" ? (m.a?.you ? "you won" : `${an} won`) : r.r === "L" ? (m.a?.you ? "you lost" : `${an} lost`) : "a tie";
    subtitle = `${pair} · ${verb === "a tie" ? "a tie" : `${verb} by ${fmt(Math.abs(r.us - (r.them ?? 0)))}`}`;
  } else if (m.lockA) subtitle = `${pair} · locked, results when they're in`;
  else subtitle = `${pair} · lineups lock when it airs`;
  return { title, subtitle };
}

/** One side of a week: its starters, its bench, or (theirs before the lock) its whole team; once played, what the bench scored
 *  and the best lineup it could have started from the same people. */
interface SideLines {
  starters: Line[] | null;
  bench: Line[] | null;
  team: Line[] | null;
  total: number | null;
  best: ReturnType<typeof bestOf> | null;
  /** Yours, still to fill before the lock: how many starters short. */
  short: number;
}

function sideLines(g: GameView, who: TableRow | null, w: TableRow["weeks"][number] | null, lock: string[] | null, n: number, played: boolean, fallback: number | null): SideLines {
  const none: SideLines = { starters: null, bench: null, team: null, total: null, best: null, short: 0 };
  if (!who) return none;
  const blank = (id: string): Line => ({ id, points: 0, why: [] });
  if (played && w) return { ...none, starters: w.started, bench: w.bench.map((x) => ({ ...x, why: [] as string[] })), total: w.total, best: bestOf(w) };
  if (played) return { ...none, starters: [], total: fallback };
  if (lock) return { ...none, starters: lock.map(blank), bench: who.team.filter((id) => !lock.includes(id)).map(blank) };
  if (who.you && g.lineup?.episode === n) return { ...none, starters: g.lineup.starters.map(blank), bench: g.lineup.roster.filter((id) => !g.lineup!.starters.includes(id)).map(blank), short: Math.max(0, g.lineup.slots - g.lineup.starters.length) };
  return { ...none, team: who.team.map(blank) };
}

/** Two teams on one signed points scale (data round 3's B, and step 2b's full teams): each side's starters with a bar from zero
 *  and the reasons, then its bench (or, before the lock, the other side's whole team); once played, what each left on the bench
 *  and its best possible lineup. */
/** A week's matchup, in the card's own form at the top (two faces, the result square or "vs" between, the totals), then each side's
 *  starters on one signed points scale, then its bench (or, before the lock, the other side's whole team, by position); once
 *  played, each side's best lineup from the same people, named as the swap that would have made it (shows only: a sport's slots
 *  by position would make it wrong). Your side, before the lock, opens your lineup. */
export function MatchupBody({ g, pid, n, words, sport, onFace, onCompare, onPerson }: { g: GameView; pid: string; n: number; words: ShowData["words"]; sport?: boolean; onFace: (id: string, holder?: string) => void; onCompare: (a: string, b: string) => void; onPerson?: (playerId: string) => void }) {
  const m = matchupOf(g, pid, n);
  const A = sideLines(g, m.a, m.wa, m.lockA, n, m.played, m.sq?.result?.us ?? m.sq?.points ?? null);
  const B = sideLines(g, m.b, m.wb, m.lockB, n, m.played, m.sq?.result?.them ?? null);
  const all = [A, B].flatMap((s) => [...(s.starters ?? []), ...(s.bench ?? [])]);
  const max = Math.max(1, ...all.map((l) => Math.abs(l.points)));
  const neg = all.some((l) => l.points < 0);
  const name = (r: TableRow | null) => (r ? (r.you ? "You" : first(r.name)) : "");
  const res = m.played && m.sq?.result ? m.sq.result : null;
  const headBody = (r: TableRow, total: number | null) => (
    <>
      <Avatar id={r.userId ?? r.playerId} name={r.name} size={44} />
      <b className="type-caption mt-1.5 max-w-full truncate text-[20px] leading-none">{name(r)}</b>
      {/* A one-game game's record says nothing the score doesn't. */}
      <span className="type-num mt-1 text-[13px] text-muted-foreground">{oneGame(g) ? "" : (recordWords(r.record) ?? "")}</span>
      {total !== null && <b className="type-num mt-1.5 text-[34px] leading-none">{fmt(total)}</b>}
    </>
  );
  // Each head opens that person's sheet in the game (the drill pass, 2026-11-17: who you play, their season and their team).
  const head = (r: TableRow | null, total: number | null) =>
    r ? (
      onPerson ? (
        <button type="button" data-door-person={r.playerId} aria-label={`${name(r)}: their season`} onClick={() => onPerson(r.playerId)} className="nd-press flex min-w-0 flex-col items-center rounded-[3px] text-center">
          {headBody(r, total)}
        </button>
      ) : (
        <div className="flex min-w-0 flex-col items-center text-center">{headBody(r, total)}</div>
      )
    ) : (
      <div className="flex min-w-0 flex-col items-center text-center">
        <span className="type-caption grid size-11 place-items-center rounded-[3px] border border-dashed border-edge text-muted-foreground">–</span>
        <b className="type-caption mt-1.5 text-[18px] leading-none text-muted-foreground">{m.stand === "median" ? "The middle score" : "A bye"}</b>
        {total !== null ? <b className="type-num mt-1.5 text-[34px] leading-none">{fmt(total)}</b> : <span className="mt-1 text-[13px] text-muted-foreground">{m.stand === "median" ? "known when results are in" : "nobody to play"}</span>}
      </div>
    );
  const yours = m.a?.you && !m.played && !m.lockA && g.lineup?.episode === n;
  const pairs = A.starters?.length && B.starters?.length && !A.team && !B.team ? pairLines(g, A.starters, B.starters, m.played) : null;
  return (
    <div className="pb-3" data-matchup-sheet={`${pid}:${n}`}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2" data-matchup-head>
        {head(m.a, m.sq?.result?.us ?? A.total)}
        <span className="mt-3 flex justify-center">{res ? <ResultSquare r={res.r === "W" ? "win" : res.r === "L" ? "loss" : "tie"} /> : <span className="type-caption text-[15px] tracking-[0.06em] text-muted-foreground">vs</span>}</span>
        {head(m.b, m.sq?.result?.them ?? B.total)}
      </div>
      {yours && g.lineup && (
        <button type="button" onClick={() => openMoves("lineup", g.leagueId)} data-matchup-change className="mt-2 inline-flex min-h-11 items-center gap-0.5 text-[15px] font-semibold">
          {A.short > 0 ? `${g.lineup.slots - A.short} of ${g.lineup.slots} set · set your lineup` : "Change your lineup"}
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
      {pairs ? (
        <PairedLineups g={g} pairs={pairs} a={A.starters!} b={B.starters!} played={m.played} onCompare={onCompare} />
      ) : (
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Column g={g} who={null} total={null} lines={A.team ?? A.starters} max={max} neg={neg} played={m.played} collapse={!!A.team} label={A.team ? "Their team · season pts" : m.played ? "Starting" : "Starting · season pts"} onFace={(id) => onFace(id, m.a?.playerId)} />
        <Column g={g} who={null} total={null} lines={B.team ?? B.starters ?? (m.b ? [] : null)} max={max} neg={neg} played={m.played} collapse={!!B.team} label={B.team ? "Their team · season pts" : m.played ? "Starting" : "Starting · season pts"} onFace={(id) => onFace(id, m.b?.playerId)} />
      </div>
      )}
      {(A.team || B.team) && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground" data-matchup-hidden>
          <Lock className="size-3.5 flex-none" aria-hidden />
          {A.team && B.team ? "Until the lock, everyone on each team." : `Until the lock, everyone on ${name(m.b)}'s team.`}
        </p>
      )}
      {(A.bench || B.bench) && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-1" data-matchup-bench>
          {A.bench ? <Column g={g} who={null} total={null} lines={A.bench} max={max} neg={neg} played={m.played} dim noBars label={m.played ? "Bench" : "Bench · season pts"} onFace={(id) => onFace(id, m.a?.playerId)} /> : <div />}
          {B.bench ? <Column g={g} who={null} total={null} lines={B.bench} max={max} neg={neg} played={m.played} dim noBars label={m.played ? "Bench" : "Bench · season pts"} onFace={(id) => onFace(id, m.b?.playerId)} /> : <div />}
        </div>
      )}
      {m.played && !sport && (A.best || B.best) && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-2 text-[13px] leading-snug" data-matchup-best>
          {[A, B].map((s, i) => (
            <p key={i} className="text-muted-foreground">
              {s.best ? (
                s.best.cost > 0 && s.best.inId && s.best.outId ? (
                  // The swap that would have scored more: the two side by side that week (the drill pass, 2026-11-17).
                  <button type="button" data-best-door={`${s.best.inId}:${s.best.outId}`} onClick={() => onCompare(s.best!.inId!, s.best!.outId!)} className="nd-press -my-1 flex min-h-11 w-full items-center gap-1 py-1 text-left">
                    <span className="min-w-0 flex-1">
                      Best lineup <b className="type-num text-[15px] text-foreground">{fmt(s.best.best)}</b> (+{fmt(s.best.cost)}): {castName(faceIn(g, s.best.inId), g)} for {castName(faceIn(g, s.best.outId), g)}
                    </span>
                    <ChevronRight className="size-4 flex-none" aria-hidden />
                  </button>
                ) : s.best.cost > 0 ? (
                  <>
                    Best lineup <b className="type-num text-[15px] text-foreground">{fmt(s.best.best)}</b> (+{fmt(s.best.cost)})
                  </>
                ) : (
                  "Best lineup: as started"
                )
              ) : null}
            </p>
          ))}
        </div>
      )}
      {m.played && !m.wa && (
        <p className="mt-2 text-[13px] text-muted-foreground" data-matchup-no-lines>
          Each player&apos;s line for this week isn&apos;t in yet, only the totals.
        </p>
      )}
      {m.played && (m.wa?.predictions || m.wb?.predictions) ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Side bets that {words.episode.toLowerCase()}: {m.a?.you ? "you" : first(m.a?.name ?? "")} {signed(m.wa?.predictions ?? 0)}
          {m.b ? `, ${m.b.you ? "you" : first(m.b.name)} ${signed(m.wb?.predictions ?? 0)}` : ""} (in the totals)
        </p>
      ) : null}
    </div>
  );
}

function Column({ g, who, total, lines: given, max, neg, played, dim, noBars, label, collapse, onFace }: { g: GameView; who: TableRow | null; total: number | null; lines: Line[] | "hidden" | null; max: number; neg: boolean; played: boolean; dim?: boolean; noBars?: boolean; label?: string; collapse?: boolean; onFace: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const sorted = Array.isArray(given) ? byPosition(g, given.map((l) => l.id)).map((id) => given.find((l) => l.id === id)!) : given;
  const lines = Array.isArray(sorted) && collapse && !all && sorted.length > 8 ? sorted.slice(0, 6) : sorted;
  const hidden = Array.isArray(sorted) && Array.isArray(lines) ? sorted.length - lines.length : 0;
  return (
    <div className="min-w-0">
      {who && (
        <div className="mb-2 flex items-center gap-2">
          <Avatar id={who.userId ?? who.playerId} name={who.name} size={28} />
          <b className="type-caption min-w-0 truncate text-[20px]">{who.you ? "You" : first(who.name)}</b>
          {total !== null && <b className="type-num ml-auto text-[26px] leading-none">{fmt(total)}</b>}
        </div>
      )}
      {label && lines && lines !== "hidden" && lines.length > 0 && <p className="type-caption mt-1 text-[13px] tracking-[0.04em] text-muted-foreground">{label}</p>}
      {lines === "hidden" ? (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground" data-matchup-hidden>
          <Lock className="size-3.5" aria-hidden />
          Shows when it locks
        </p>
      ) : lines === null ? (
        <p className="text-[13px] text-muted-foreground">No lineup</p>
      ) : (
        <ul className="flex flex-col">
          {lines.map((l) => {
            const c = faceIn(g, l.id);
            const w = (Math.abs(l.points) / max) * 100;
            return (
              <li key={l.id}>
                <button type="button" data-door-cast={l.id} onClick={() => onFace(l.id)} className={`nd-press flex min-h-11 w-full flex-col justify-center border-t border-border py-1.5 text-left ${dim ? "text-muted-foreground" : ""}`}>
                  <span className="flex w-full items-center gap-1.5">
                    <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} className="size-7 flex-none rounded-[2px] text-[12px]" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{castName(c, g)}</span>
                    {c?.role && <span className="text-[11px] font-bold tracking-[0.04em] text-muted-foreground">{c.role}</span>}
                    {played ? <b className={`type-num text-[17px] ${l.points > 0 ? "text-good" : "text-muted-foreground"}`}>{signed(l.points)}</b> : <span className="type-num text-[14px] text-muted-foreground">{fmt(c?.points ?? 0)}</span>}
                  </span>
                  {played && !noBars && (
                    <span className="relative mt-1 block h-1.5 w-full" aria-hidden>
                      <span className={`absolute top-0 h-full ${neg ? "left-1/2" : "left-0"} w-px bg-edge`} />
                      {l.points !== 0 && (
                        <span
                          className={`absolute top-0 h-full rounded-[1px] ${l.points > 0 ? "bg-good" : "bg-muted-foreground/60"}`}
                          style={neg ? (l.points > 0 ? { left: "50%", width: `${w / 2}%` } : { right: "50%", width: `${w / 2}%` }) : { left: 0, width: `${w}%` }}
                        />
                      )}
                    </span>
                  )}
                  {played && l.why.length > 0 && <span className="mt-1 line-clamp-2 text-[12px] leading-tight text-muted-foreground">{l.why.join(", ")}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="inline-flex min-h-11 items-center text-[14px] font-semibold" data-matchup-more>
          {hidden} more
        </button>
      )}
    </div>
  );
}

// ---------- step 2b: the league's week, a person's season, a castaway's and an athlete's weeks ----------

/** The league's other games this week (head to head): the two faces and records, then whether each is set, locked, or the
 *  score; each opens that matchup. Yours isn't repeated (it's the card above). */
export function WeekGames({ g, words, onOpen }: { g: GameView; words: ShowData["words"]; onOpen: (playerId: string, episode: number) => void }) {
  const wk = g.games;
  if (!wk) return null;
  const others = wk.games.filter((x) => x.a !== g.playerId && x.b !== g.playerId);
  if (!others.length) return null;
  const row = (id: string | null) => (id ? (g.table.find((r) => r.playerId === id) ?? null) : null);
  const side = (r: TableRow | null, end?: boolean) =>
    r ? (
      <span className={`flex min-w-0 items-center gap-1.5 ${end ? "flex-row-reverse text-right" : ""}`}>
        <Avatar id={r.userId ?? r.playerId} name={r.name} size={26} />
        <span className="min-w-0">
          <b className="block truncate text-[15px] font-semibold leading-tight">{first(r.name)}</b>
          <span className="type-num block text-[13px] text-muted-foreground">{recordWords(r.record) ?? ""}</span>
        </span>
      </span>
    ) : (
      <span className={`text-[13px] text-muted-foreground ${end ? "text-right" : ""}`}>The middle score</span>
    );
  const status = (x: (typeof others)[number]) => {
    if (x.locked) return "Locked";
    const a = row(x.a), b = row(x.b);
    const out = [x.set.a ? null : a, x.b && x.set.b === false ? b : null].filter(Boolean) as TableRow[];
    if (!out.length) return x.b ? "Both set" : "Set";
    return `${out.map((r) => first(r.name)).join(" and ")} not set`;
  };
  return (
    <section className="mx-4 mt-5" data-week-games>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[20px]">The other games</h2>
        <span className="text-[13px] text-muted-foreground">
          {words.ep} {wk.episode}
        </span>
      </div>
      {others.map((x) => (
        <button key={x.a} type="button" data-week-game={x.a} onClick={() => onOpen(x.a, wk.episode)} className="nd-press grid min-h-[56px] w-full grid-cols-[1fr_auto_1fr_auto] items-center gap-2 border-t border-border py-1.5 text-left">
          {side(row(x.a))}
          <span className="type-caption text-[13px] tracking-[0.06em] text-muted-foreground">vs</span>
          {side(row(x.b), true)}
          <span className="flex items-center gap-0.5 pl-1 text-[13px] text-muted-foreground">
            <span className="max-w-[86px] text-right leading-tight">{status(x)}</span>
            <ChevronRight className="size-4 flex-none" aria-hidden />
          </span>
        </button>
      ))}
    </section>
  );
}

/** That week's games (head to head), on an episode's sheet: each pairing and its score; each opens its matchup. */
export function EpisodeGames({ g, episode, onOpen, unit = "week" }: { g: GameView; episode: number; onOpen: (playerId: string) => void; unit?: string }) {
  if (g.plays.kind !== "result") return null;
  const seen = new Set<string>();
  const games: { a: TableRow; b: TableRow | null; us: number; them: number | null; r: "W" | "L" | "T"; median: boolean }[] = [];
  for (const r of g.table) {
    const s = g.plays.rows[r.playerId]?.find((x) => x.episode === episode);
    if (!s?.result || seen.has(r.playerId)) continue;
    const b = s.result.against ? (g.table.find((x) => x.playerId === s.result!.against) ?? null) : null;
    seen.add(r.playerId);
    if (b) seen.add(b.playerId);
    if (b?.you) games.push({ a: b, b: r, us: s.result.them ?? 0, them: s.result.us, r: s.result.r === "W" ? "L" : s.result.r === "L" ? "W" : "T", median: false });
    else games.push({ a: r, b, us: s.result.us, them: s.result.them, r: s.result.r, median: s.result.median });
  }
  if (!games.length) return null;
  return (
    <section className="mb-3" data-episode-games>
      <p className="type-caption mb-1 text-[14px] tracking-[0.04em] text-muted-foreground">That {unit}&apos;s games</p>
      {games.map((x) => (
        <button key={x.a.playerId} type="button" data-episode-game={x.a.playerId} onClick={() => onOpen(x.a.playerId)} className="nd-press grid min-h-12 w-full grid-cols-[1fr_auto_1fr_auto] items-center gap-2 border-t border-border py-1 text-left">
          <span className="flex min-w-0 items-center gap-1.5">
            <ResultSquare r={x.r === "W" ? "win" : x.r === "L" ? "loss" : "tie"} />
            <b className="truncate text-[15px] font-semibold">{x.a.you ? "You" : first(x.a.name)}</b>
          </span>
          <span className="type-num text-[17px]">{scoreWords(x.us, x.them)}</span>
          <b className="truncate text-right text-[15px] font-semibold">{x.b ? (x.b.you ? "You" : first(x.b.name)) : x.median ? "The middle score" : "A bye"}</b>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </section>
  );
}

/** A week's best lineup from the same people (the top scores among its starters and bench, as many as started) against what was
 *  started: the cost, and the swap that would have made it (the bench player in, the starter out). Shows only: a sport's slots
 *  by position would make the plain top-N wrong. */
export function bestOf(w: TableRow["weeks"][number]): { scored: number; best: number; cost: number; inId: string | null; outId: string | null } {
  const lines = [...w.started.map((x) => ({ ...x, start: true })), ...w.bench.map((x) => ({ ...x, start: false }))].sort((p, q) => q.points - p.points);
  const pick = lines.slice(0, w.started.length);
  const scored = w.started.reduce((t, x) => t + x.points, 0);
  const best = pick.reduce((t, x) => t + x.points, 0);
  const inId = pick.find((x) => !x.start)?.id ?? null;
  const outId = [...w.started].sort((p, q) => p.points - q.points).find((x) => !pick.some((y) => y.id === x.id))?.id ?? null;
  return { scored, best, cost: Math.max(0, best - scored), inId, outId };
}

/** A week-by-week table with pinned names and a pinned total opens on its latest weeks, the leftmost one whole beside the names
 *  (scrolled to the very end, the first week's numbers peeked half-cut from under them; left at the start, the last ones did
 *  under the total): the earliest week from which every later one still fits before the total. Week headings carry
 *  data-week-col; the row's first and last headings are the pinned ones. The pinned ones stick inside the scroller's padding (the
 *  page's gutter), so the room between them is the scroller's width less both gutters, both pins and the table's cell spacing.
 *  The weeks in view share that room evenly (each widened, never narrowed), so the leftmost isn't left half-cut by the numbers'
 *  end against the total; a short season's few weeks fill the row too, up to 64px each. */
function useOpenOnLatest(scrollerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const at = (x: Element) => x.getBoundingClientRect();
    const head = el.querySelectorAll<HTMLElement>("thead tr:last-child th");
    const cols = [...el.querySelectorAll<HTMLElement>("thead th[data-week-col]")];
    if (head.length < 2 || !cols.length) return;
    const cs = getComputedStyle(el);
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    const table = el.querySelector("table");
    const gap = table ? parseFloat(getComputedStyle(table).borderSpacing) || 0 : 0;
    const pin = at(head[0]).width, total = at(head[head.length - 1]).width;
    // Where a column starts in the scrolled content, from the padding's edge (where the pinned names stick).
    const left = (x: Element) => at(x).left - box.left + el.scrollLeft - padL;
    const end = () => left(cols[cols.length - 1]) + at(cols[cols.length - 1]).width;
    const room = el.clientWidth - padL - padR - pin - total - 2 * gap;
    const from = cols.find((c) => end() - left(c) <= room) ?? cols[cols.length - 1];
    const n = cols.length - cols.indexOf(from);
    const each = Math.min(room / n, el.scrollWidth <= el.clientWidth ? 64 : Infinity) - (n > 1 ? gap * (n - 1) / n : 0);
    if (each > at(from).width + 0.5) for (const c of cols) c.style.minWidth = c.style.width = `${each}px`;
    if (el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, Math.min(left(from) - pin - gap, el.scrollWidth - el.clientWidth));
  }, [scrollerRef]);
}

/** A person's season under their week-by-week chart, as one table a week a column: the result each week (head to head: the
 *  square, who, the score), then a castaway a row (started on the raised fill, benched dim, the week they went home marked, their
 *  points for this person pinned at the end), then what the bench cost each week. */
export function PersonSeason({ g, r, words, sport, at = null, onMatchup, onWeek, onFace }: { g: GameView; r: TableRow; words: ShowData["words"]; sport?: boolean; at?: number | null; onMatchup: (episode: number) => void; onWeek?: (episode: number) => void; onFace: (id: string, episode?: number) => void }) {
  const weeks = r.weeks;
  const scroller = useRef<HTMLDivElement>(null);
  useOpenOnLatest(scroller);
  if (!weeks.length) return null;
  const sqOf = (n: number) => (g.plays.rows[r.playerId] ?? []).find((s) => s.episode === n) ?? null;
  const h2h = g.plays.kind === "result";
  const ids = byPosition(g, [...new Set([...r.team, ...weeks.flatMap((w) => [...w.started.map((x) => x.id), ...w.bench.map((x) => x.id)])])]);
  const cell = (id: string, w: (typeof weeks)[number]) => {
    const s = w.started.find((x) => x.id === id);
    if (s) return { start: true, p: s.points };
    const b = w.bench.find((x) => x.id === id);
    return b ? { start: false, p: b.points } : null;
  };
  const counted = (id: string) => weeks.reduce((t, w) => t + (w.started.find((x) => x.id === id)?.points ?? 0), 0);
  const costs = weeks.map((w) => bestOf(w));
  const season = costs.reduce((t, c) => t + c.cost, 0);
  const opp = (id: string | null | undefined) => (id ? g.table.find((x) => x.playerId === id) : undefined);
  const COL = "w-[40px] min-w-[40px]";
  return (
    <section data-person-season className="pb-2">
      <p className="mb-1.5 mt-5 flex items-baseline justify-between gap-2">
        <span className="type-caption text-[14px] tracking-[0.04em] text-muted-foreground">The season</span>
        <span className="text-[13px] text-muted-foreground">started · on the bench, dim · <i className="inline-block size-1.5 rounded-full bg-live align-middle" aria-hidden /> went home</span>
      </p>
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" data-lineup-matrix>
        <table className="border-separate border-spacing-x-[3px] border-spacing-y-0 text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-card" />
              {weeks.map((w) => {
                const s = sqOf(w.episode);
                const o = opp(s?.result?.against);
                return (
                  <th key={w.episode} data-week-col className={`${COL} pb-1 align-bottom font-normal`}>
                    {h2h && s?.result ? (
                      // The week's matchup: its square, who against and the week's name, one door.
                      <button type="button" data-person-week={w.episode} onClick={() => onMatchup(w.episode)} aria-label={`${words.episode} ${w.episode}: ${s.result.r === "W" ? "won" : s.result.r === "L" ? "lost" : "tied"} against ${o?.name ?? "the middle score"}, ${scoreWords(s.result.us, s.result.them)}`} className="nd-press flex min-h-11 w-full flex-col items-center justify-end gap-0.5">
                        <ResultSquare r={s.result.r === "W" ? "win" : s.result.r === "L" ? "loss" : "tie"} />
                        <span className="text-[11px] font-semibold">{o ? (o.you ? "You" : first(o.name)) : "Mid"}</span>
                        <span className={`type-caption block text-center text-[13px] ${w.episode === at ? "text-foreground" : "text-muted-foreground"}`}>
                          {words.ep} {w.episode}
                        </span>
                      </button>
                    ) : onWeek ? (
                      // Their week, in place: the lineup above turns to it and comes into view (the drill pass, 2026-11-17).
                      <button
                        type="button"
                        data-season-week={w.episode}
                        aria-pressed={w.episode === at}
                        aria-label={`${words.episode} ${w.episode}: their lineup that ${words.episode.toLowerCase()}`}
                        onClick={(ev) => {
                          onWeek(w.episode);
                          ev.currentTarget.closest<HTMLElement>("[data-sheet-player]")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                        }}
                        className={`nd-press type-caption flex min-h-11 w-full items-end justify-center text-center text-[13px] underline decoration-border decoration-2 underline-offset-[4px] ${w.episode === at ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {words.ep} {w.episode}
                      </button>
                    ) : (
                      <span className="type-caption block text-center text-[13px] text-muted-foreground">
                        {words.ep} {w.episode}
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="sticky right-0 z-[1] bg-card pl-2 text-right align-bottom">
                <span className="type-caption pb-0.5 text-[13px] font-normal text-muted-foreground">Pts</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const c = faceIn(g, id);
              return (
                <tr key={id}>
                  <th scope="row" className="sticky left-0 z-[1] bg-card pr-1 text-left font-normal">
                    <button type="button" data-door-cast={id} onClick={() => onFace(id)} className="flex min-h-11 max-w-[104px] items-center gap-1.5">
                      <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} className="size-6 flex-none rounded-[2px] text-[11px]" />
                      <span className={`truncate text-[13px] font-semibold ${c?.knocked ? "text-muted-foreground" : ""}`}>{castName(c, g)}</span>
                      {c?.role && <span className="text-[11px] font-bold text-muted-foreground">{c.role}</span>}
                    </button>
                  </th>
                  {weeks.map((w) => {
                    const x = cell(id, w);
                    return (
                      <td key={w.episode} className={`relative ${COL} h-11 rounded-[2px] border-t border-border p-0 text-center align-middle ${x?.start ? "bg-secondary" : ""}`}>
                        {x ? (
                          // That castaway that week: their sheet, at that episode of their story (the drill pass, 2026-11-17).
                          <button type="button" data-season-cell={`${id}:${w.episode}`} aria-label={`${castName(c, g)}, ${words.episode} ${w.episode}: ${signed(x.p)}${x.start ? "" : " on the bench"}`} onClick={() => onFace(id, w.episode)} className={`nd-press type-num grid h-11 w-full place-items-center text-[14px] ${x.start ? "text-foreground" : "text-muted-foreground"}`}>
                            {signed(x.p)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/50">·</span>
                        )}
                        {c?.out === w.episode && <i aria-label="went home" className="pointer-events-none absolute right-0.5 top-1 size-1.5 rounded-full bg-live" />}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-[1] border-t border-border bg-card pl-2 text-right">
                    <b className="type-num text-[17px]">{signed(counted(id))}</b>
                  </td>
                </tr>
              );
            })}
            {[...new Set(weeks.flatMap((w) => (w.slots ?? []).map((x) => x.slot)))].map((k) => (
                // Round 5 (B2, V-L2-004): a group slot's points each week, so the table adds up to the total.
                <tr key={`slot-${k}`} data-person-slot={k}>
                  <th scope="row" className="sticky left-0 z-[1] bg-card pr-1 text-left text-[13px] font-semibold">
                    Group slot{weeks.some((w) => (w.slots ?? []).length > 1) ? ` ${k + 1}` : ""}
                  </th>
                  {weeks.map((w) => {
                    const x = (w.slots ?? []).find((y) => y.slot === k);
                    return (
                      <td key={w.episode} className={`${COL} h-11 rounded-[2px] border-t border-border text-center ${x?.status === "held" ? "bg-secondary" : ""}`}>
                        <span className={`type-num text-[14px] ${x?.status === "held" ? "" : "text-muted-foreground"}`}>{x?.status === "held" ? signed(x.points) : "–"}</span>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-[1] border-t border-border bg-card pl-2 text-right">
                    <b className="type-num text-[17px]">{signed(weeks.reduce((t, w) => t + ((w.slots ?? []).find((y) => y.slot === k && y.status === "held")?.points ?? 0), 0))}</b>
                  </td>
                </tr>
              ))}
            {!sport && (
              <tr data-person-bench>
                <th scope="row" className="sticky left-0 z-[1] bg-card pr-1 text-left text-[13px] font-semibold text-muted-foreground">
                  Bench cost
                </th>
                {costs.map((c, i) => (
                  <td key={weeks[i].episode} className={`${COL} h-11 border-t border-border text-center`}>
                    <span className={`type-num text-[14px] ${c.cost > 0 ? "text-foreground" : "text-muted-foreground"}`}>{c.cost > 0 ? fmt(c.cost) : "0"}</span>
                  </td>
                ))}
                <td className="sticky right-0 z-[1] border-t border-border bg-card pl-2 text-right">
                  <b className="type-num text-[17px]">{fmt(season)}</b>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!sport && (
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
          Bench cost: what the best lineup from the same people would have added that {words.episode.toLowerCase()}. {season > 0 ? `${fmt(season)} over the season.` : "None this season."}
        </p>
      )}
    </section>
  );
}

/** The athlete chart's three stats' colours (Ember, Orchid, Lake: the chart set). */
export const STACK = ["#f2804b", "#a76bb0", "#5089c9"];

type Logged = { episode: number; opponent: string | null; items: { label: string; value: string }[] };

/** An athlete's season, game by game: their three main stats (the ones they record most, by how much they move), each a small bar
 *  chart on its own scale, the opponent under each game. The log stays under it as the table. */
export function AthleteChart({ games, words }: { games: Logged[]; words: ShowData["words"] }) {
  const ordered = [...games].sort((p, q) => p.episode - q.episode);
  if (ordered.length < 2) return null;
  const num = (v: string) => (/^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null);
  const labels = new Map<string, (number | null)[]>();
  ordered.forEach((gm, i) => {
    for (const it of gm.items) {
      const v = num(it.value);
      if (v === null) continue;
      if (!labels.has(it.label)) labels.set(it.label, Array(ordered.length).fill(null));
      labels.get(it.label)![i] = v;
    }
  });
  const spread = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length < 2 ? 0 : Math.max(...v) - Math.min(...v);
  };
  const picked = [...labels]
    .filter(([, xs]) => xs.filter((x) => x !== null).length >= 2 && xs.some((x) => x))
    .sort((p, q) => q[1].filter((x) => x !== null).length - p[1].filter((x) => x !== null).length || spread(q[1]) - spread(p[1]))
    .slice(0, 3);
  if (!picked.length) return null;
  return (
    <section className="mt-3" data-athlete-chart>
      <p className="type-caption mb-1 text-[14px] tracking-[0.04em] text-muted-foreground">Game by game</p>
      {picked.map(([label, xs], li) => {
        const max = Math.max(1, ...xs.map((x) => Math.abs(x ?? 0)));
        const wide = xs.length > 8;
        return (
          <div key={label} className="flex items-end gap-2 border-t border-border py-1.5" data-athlete-stat={label}>
            <span className="w-[56px] flex-none pb-0.5 text-[13px] font-semibold">{label}</span>
            <div className={`min-w-0 flex-1 ${wide ? "overflow-x-auto [scrollbar-width:none]" : ""}`}>
              <div className="flex items-end gap-1" style={{ width: wide ? xs.length * 32 : undefined }}>
                {xs.map((x, i) => (
                  <span key={i} className="flex min-w-[28px] flex-1 flex-col items-center gap-0.5">
                    <span className="type-num text-[11px] text-muted-foreground">{x ?? "–"}</span>
                    {/* A bar from the zero line: up for a positive, a muted bar under the line for a negative, the line alone for 0. */}
                    <span className="flex h-[40px] w-full flex-col justify-end">
                      {x !== null && x > 0 && <span className="block w-full rounded-[1px]" style={{ height: Math.max(2, (x / max) * 34), background: STACK[li] }} />}
                    </span>
                    <span className="block h-px w-full bg-edge" />
                    <span className="flex h-[10px] w-full flex-col">{x !== null && x < 0 && <span className="block w-full rounded-[1px] bg-muted-foreground/60" style={{ height: Math.max(2, (-x / max) * 10) }} />}</span>
                    {li === picked.length - 1 && <span className="max-w-full truncate text-[11px] text-muted-foreground">{ordered[i].opponent ?? `${words.ep}${ordered[i].episode}`}</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------- step 2c: side by side, the compare, and the game's own scoring table ----------

type Pair = { slot: string; a: Line | null; b: Line | null };

/** A number as the page shows it, and a total from the numbers shown (so the parts always add up to it). */
const r1 = (n: number) => Math.round(n * 10) / 10;
const sumShown = (xs: number[]) => r1(xs.reduce((t, x) => t + r1(x), 0));
/** A sport's position as a lineup card says it. */
export const slotWord = (r: string) => (r === "PK" ? "K" : r === "DST" || r === "D/ST" ? "DEF" : r);

/** Pairs two lineups to read across. A sport's by position (QB with QB, your nth RB with their nth RB; anyone left without a
 *  partner as Flex); a show's by rank once scored (your best against their best, "Best", "2nd best": its slots are
 *  interchangeable, so a slot pairing would be invented). Null for a show before it's scored: two plain lists then. */
export function pairLines(g: GameView, a: Line[], b: Line[], played: boolean): Pair[] | null {
  // Cast properties (chunk 5): a game with lineup slots pairs slot by slot, each side's starters matched to its slots as the engine
  // matches them (QB with QB, W/R/T with W/R/T), its own label on each row.
  const plan = g.slotPlan;
  if (plan) {
    const byId = (xs: Line[]) => new Map(xs.map((l) => [l.id, l]));
    const mineA = byId(a), mineB = byId(b);
    const oa = matchSlots(a.map((l) => l.id), plan.fits, plan.widths);
    const ob = matchSlots(b.map((l) => l.id), plan.fits, plan.widths);
    return plan.labels.map((label, i) => ({ slot: slotWord(label), a: (oa[i] && mineA.get(oa[i]!)) || null, b: (ob[i] && mineB.get(ob[i]!)) || null }));
  }
  const role = (l: Line) => (faceIn(g, l.id)?.role ?? "").toUpperCase();
  const sport = [...a, ...b].some((l) => role(l));
  const byPts = (xs: Line[]) => [...xs].sort((p, q) => q.points - p.points);
  if (!sport) {
    if (!played) return null;
    const A = byPts(a), B = byPts(b);
    return Array.from({ length: Math.max(A.length, B.length) }, (_, i) => ({ slot: i === 0 ? "Best" : `${ordinal(i + 1)} best`, a: A[i] ?? null, b: B[i] ?? null }));
  }
  const order = (r: string) => (POSITION_ORDER.indexOf(r) < 0 ? 99 : POSITION_ORDER.indexOf(r));
  const roles = [...new Set([...a, ...b].map(role))].sort((p, q) => order(p) - order(q));
  const out: Pair[] = [];
  const leftA: Line[] = [], leftB: Line[] = [];
  for (const r of roles) {
    const A = byPts(a.filter((l) => role(l) === r)), B = byPts(b.filter((l) => role(l) === r));
    const n = Math.min(A.length, B.length);
    for (let i = 0; i < n; i++) out.push({ slot: slotWord(r) || "–", a: A[i], b: B[i] });
    leftA.push(...A.slice(n));
    leftB.push(...B.slice(n));
  }
  // Flex: the rest, best against best; placed before a sport's kicker and defense, as a lineup card reads.
  const flex: Pair[] = Array.from({ length: Math.max(leftA.length, leftB.length) }, (_, i) => ({ slot: "Flex", a: byPts(leftA)[i] ?? null, b: byPts(leftB)[i] ?? null }));
  const tail = out.findIndex((p) => ["K", "DEF"].includes(p.slot));
  return tail < 0 ? [...out, ...flex] : [...out.slice(0, tail), ...flex, ...out.slice(tail)];
}

/** Yours and theirs: one pair of colours for both sides, in the bars, the compare's series and its key (never a person's colour,
 *  never the due yellow, never the win's teal). */
const YOURS = "var(--foreground)";
const THEIRS = "#8f8aa3";

/** One pair, read across from the slot in the middle. Each side's bar starts at a zero line set in from the slot and grows
 *  outward for points, on one scale; a negative is a short outline pointing back toward the slot. The higher number is bold, the
 *  lower muted. A Flex row says each player's own position. */
function PairRow({ g, p, max, played, onCompare }: { g: GameView; p: Pair; max: number; played: boolean; onCompare: (a: string, b: string) => void }) {
  const win = played && p.a && p.b ? (p.a.points > p.b.points ? "a" : p.b.points > p.a.points ? "b" : null) : null;
  const side = (l: Line | null, end: boolean, k: "a" | "b") => {
    if (!l) return <span className={`self-center text-[13px] text-muted-foreground ${end ? "text-left" : "text-right"}`}>–</span>;
    const c = faceIn(g, l.id);
    const w = (Math.abs(l.points) / max) * 100;
    const strong = win === k;
    return (
      <span className={`flex min-w-0 flex-col ${end ? "items-start" : "items-end"}`}>
        <span className={`flex w-full min-w-0 items-center gap-1.5 ${end ? "" : "flex-row-reverse"}`}>
          {played && <b className={`type-num flex-none text-[17px] ${strong ? "text-foreground" : "font-normal text-muted-foreground"}`}>{signed(r1(l.points))}</b>}
          <span className={`min-w-0 flex-1 ${end ? "text-left" : "text-right"}`}>
            <span className={`block truncate text-[14px] ${strong || !played ? "font-semibold" : "text-muted-foreground"}`}>{castName(c, g)}</span>
            {p.slot === "Flex" && c?.role && <span className="block text-[11px] font-bold text-muted-foreground">{slotWord(c.role.toUpperCase())}</span>}
          </span>
          <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} className="size-7 flex-none rounded-[2px] text-[12px]" />
        </span>
        {played && (
          <span className={`mt-1 flex h-1.5 w-full ${end ? "" : "justify-end"}`} aria-hidden>
            {l.points > 0 && <span className="h-full rounded-[1px]" style={{ width: `${Math.max(3, w)}%`, background: k === "a" ? YOURS : THEIRS, opacity: strong ? 1 : 0.55 }} />}
            {l.points < 0 && <span className={`h-full rounded-[1px] border border-muted-foreground ${end ? "" : "ml-auto"}`} style={{ width: `${Math.max(6, w / 3)}%` }} />}
          </span>
        )}
      </span>
    );
  };
  const can = !!(p.a && p.b);
  const label = can ? `${p.slot}: ${faceIn(g, p.a!.id)?.name} ${played ? signed(r1(p.a!.points)) : ""} against ${faceIn(g, p.b!.id)?.name} ${played ? signed(r1(p.b!.points)) : ""}. Compare them.` : undefined;
  return (
    <button type="button" disabled={!can} aria-label={label} onClick={() => can && onCompare(p.a!.id, p.b!.id)} data-pair={p.slot} className={`grid min-h-[52px] w-full grid-cols-[1fr_44px_1fr] items-start gap-1.5 border-t border-border py-2 text-left ${can ? "nd-press" : "cursor-default"}`}>
      {side(p.a, false, "a")}
      <span className="type-caption mt-1.5 text-center text-[13px] tracking-[0.04em] text-muted-foreground">{p.slot}</span>
      {side(p.b, true, "b")}
    </button>
  );
}

/** Two lineups read across, slot by slot (null pairing: a show before it's scored, two plain lists instead, by the caller). */
export function PairedLineups({ g, pairs, a, b, played, onCompare }: { g: GameView; pairs: Pair[]; a: Line[]; b: Line[]; played: boolean; onCompare: (a: string, b: string) => void }) {
  const max = Math.max(1, ...[...a, ...b].map((l) => Math.abs(l.points)));
  return (
    <div className="mt-2" data-matchup-pairs>
      {played && <p className="mb-1 text-center text-[13px] text-muted-foreground">Tap a pair to compare them week by week</p>}
      {pairs.map((p, i) => (
        <PairRow key={`${p.slot}-${i}`} g={g} p={p} max={max} played={played} onCompare={onCompare} />
      ))}
    </div>
  );
}

/** Two players side by side (from a matchup's pair): this week and every week of this game at its scoring, as one chart the
 *  width of the screen (yours and theirs in their pair of colours, the week you came from tinted, values on the bars when it
 *  fits), then the weeks in numbers. Who has each is said in words. */
export function CompareBody({ g, a, b, episode, words, onFace, onEpisode }: { g: GameView; a: string; b: string; episode?: number | null; words: ShowData["words"]; onFace: (id: string, episode?: number | null) => void; onEpisode?: (n: number) => void }) {
  const cw = g.castWeeks;
  const holders = (id: string) => g.table.filter((r) => r.team.includes(id));
  const whose = (id: string) => {
    const hs = holders(id);
    return hs.length ? hs.map((r) => (r.you ? "Yours" : `${first(r.name)}'s`)).join(", ") : "Free";
  };
  const ca = faceIn(g, a), cb = faceIn(g, b);
  if (!cw || !ca || !cb) return <p className="pb-3 text-[15px] text-muted-foreground">No weeks counted yet in this game.</p>;
  const sa = (cw.points[a] ?? cw.episodes.map(() => 0)).map(r1), sb = (cw.points[b] ?? cw.episodes.map(() => 0)).map(r1);
  const ta = sumShown(sa), tb = sumShown(sb);
  const at = episode != null ? cw.episodes.indexOf(episode) : -1;
  const top = Math.max(1, ...sa, ...sb), bot = Math.min(0, ...sa, ...sb);
  const n = cw.episodes.length, W = 356, colW = Math.max(30, Math.floor(W / n)), SW = Math.max(W, n * colW);
  const H = 130, PAD = 16;
  const y = (v: number) => PAD + ((top - v) / (top - bot)) * (H - PAD * 2);
  // Values on the bars only when two side by side fit (each about 6.5px a character at 11px); else the weeks in numbers below.
  const bw0 = Math.min(22, (colW - 12) / 2);
  const labels = n <= 6 && Math.max(...[...sa, ...sb].map((v) => signed(v).length)) * 6.5 <= bw0 + 2;
  const head = (c: NonNullable<typeof ca>, total: number, wk: number | null, colour: string) => (
    <button type="button" data-door-cast={c.id} onClick={() => onFace(c.id, at >= 0 ? episode : null)} className="nd-press flex min-w-0 flex-col items-center text-center">
      <Face src={c.photo} name={c.name} out={c.left} className="size-14 rounded-[3px] text-[22px]" />
      <b className="type-caption mt-1.5 flex max-w-full items-center gap-1 truncate text-[19px] leading-none">
        <i className="inline-block size-2.5 flex-none rounded-[2px]" style={{ background: colour }} aria-hidden />
        {castName(c, g)}
      </b>
      <span className="mt-0.5 text-[13px] text-muted-foreground">{[c.role ? slotWord(c.role.toUpperCase()) : null, whose(c.id)].filter(Boolean).join(" · ")}</span>
      {wk !== null && <b className="type-num mt-1 text-[26px] leading-none">{signed(wk)}</b>}
      <span className="mt-0.5 text-[13px] text-muted-foreground">
        {wk !== null ? `${words.ep} ${episode} · ` : ""}
        {fmt(total)} over {n} {n === 1 ? "week" : "weeks"}
      </span>
    </button>
  );
  return (
    <div className="pb-3" data-compare={`${a}:${b}`}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        {head(ca, ta, at >= 0 ? sa[at] : null, YOURS)}
        <span className="type-caption mt-5 text-[15px] tracking-[0.06em] text-muted-foreground">vs</span>
        {head(cb, tb, at >= 0 ? sb[at] : null, THEIRS)}
      </div>
      <p className="type-caption mb-1 mt-4 text-[14px] tracking-[0.04em] text-muted-foreground">Week by week</p>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="relative" style={{ width: SW }}>
        <svg width={SW} height={H + 20} role="img" aria-label={cw.episodes.map((e, i) => `${words.ep} ${e}: ${castName(ca, g)} ${signed(sa[i])}, ${castName(cb, g)} ${signed(sb[i])}`).join("; ")} className="block">
          {at >= 0 && <rect x={at * colW + 1} width={colW - 2} y={0} height={H + 2} rx={3} fill="var(--secondary)" />}
          <line x1={0} x2={SW} y1={y(0)} y2={y(0)} stroke="var(--edge)" strokeWidth={1} />
          {cw.episodes.map((e, i) => {
            const bw = Math.min(22, (colW - 12) / 2), x0 = i * colW + colW / 2 - bw - 1;
            return (
              <g key={e}>
                {[sa[i], sb[i]].map((v, k) => {
                  const x = x0 + k * (bw + 2);
                  return (
                    <g key={k}>
                      {v > 0 && <rect x={x} width={bw} y={y(v)} height={Math.max(1, y(0) - y(v))} fill={k ? THEIRS : YOURS} rx={1} />}
                      {v < 0 && <rect x={x + 0.5} width={bw - 1} y={y(0)} height={Math.max(1, y(v) - y(0))} fill="none" stroke="var(--muted-foreground)" rx={1} />}
                      {labels && v !== 0 && (
                        <text x={x + bw / 2} y={v > 0 ? y(v) - 4 : y(v) + 11} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
                          {signed(v)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text x={i * colW + colW / 2} y={H + 14} textAnchor="middle" fontSize={11} fontWeight={i === at ? 700 : 400} fill={i === at ? "var(--foreground)" : "var(--muted-foreground)"}>
                  {words.ep} {e}
                </text>
              </g>
            );
          })}
        </svg>
        {/* Each week a door, in place: the heads above read that week (the drill pass, 2026-11-17). */}
        {onEpisode && (
          <div className="absolute inset-0 flex">
            {cw.episodes.map((e, i) => (
              <button key={e} type="button" data-compare-week={e} aria-pressed={i === at} aria-label={`${words.ep} ${e}: ${castName(ca, g)} ${signed(sa[i])}, ${castName(cb, g)} ${signed(sb[i])}`} onClick={() => onEpisode(e)} className="h-full flex-none rounded-[3px] active:bg-foreground/[0.06]" style={{ width: colW }} />
            ))}
          </div>
        )}
        </div>
      </div>
      {!labels && (
        <table className="mt-2 w-full text-[15px]" data-compare-table>
          <thead>
            <tr className="text-[13px] text-muted-foreground">
              <th className="py-1 text-left font-normal">{words.episode}</th>
              <th className="py-1 text-right font-semibold">{castName(ca, g)}</th>
              <th className="py-1 text-right font-semibold">{castName(cb, g)}</th>
            </tr>
          </thead>
          <tbody>
            {cw.episodes.map((e, i) => (
              <tr key={e} className={`border-t border-border ${i === at ? "bg-secondary" : ""}`}>
                <td className="text-muted-foreground">
                  {onEpisode ? (
                    <button type="button" data-compare-row={e} aria-pressed={i === at} onClick={() => onEpisode(e)} className="flex min-h-11 w-full items-center text-left underline decoration-border decoration-2 underline-offset-[4px]">
                      {words.ep} {e}
                    </button>
                  ) : (
                    <span className="block py-1.5">
                      {words.ep} {e}
                    </span>
                  )}
                </td>
                <td className={`type-num py-1.5 text-right ${sa[i] > sb[i] ? "font-bold" : "text-muted-foreground"}`}>{signed(sa[i])}</td>
                <td className={`type-num py-1.5 text-right ${sb[i] > sa[i] ? "font-bold" : "text-muted-foreground"}`}>{signed(sb[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** The game's own scoring table (the stat table's game lens): everyone in the pool by the name the game reads them by (a first
 *  name, the last initial only when two would read the same), their points each week at this game's scoring and the total (from
 *  the numbers shown), and who has them as faces (yours first and ringed; three and a count past four, so a castaway everyone
 *  holds fits the same width; one holder named), or Free; filtered (All, Free, yours; a sport's positions; a search past 40),
 *  sorted by the total or by any week (tap its heading), opening on the latest week, your rows lifted on the raised fill.
 *  `ground`: what the table sits on (the page; a sheet's panel), which the pinned names and total are filled with, out over the
 *  gutters, so nothing scrolling under them shows past them. */
export function GameTable({ g, words, onFace, ground = "var(--background)" }: { g: GameView; words: ShowData["words"]; onFace: (id: string, episode?: number) => void; ground?: string }) {
  const cw = g.castWeeks;
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(40);
  const [sortBy, setSortBy] = useState<number | "total">("total");
  const scroller = useRef<HTMLDivElement>(null);
  useOpenOnLatest(scroller);
  const holders = useMemo(() => {
    const m = new Map<string, TableRow[]>();
    for (const r of g.table) for (const id of r.team) m.set(id, [...(m.get(id) ?? []), r]);
    return m;
  }, [g.table]);
  const roles = [...new Set(g.cast.map((c) => slotWord((c.role ?? "").toUpperCase())).filter(Boolean))].sort((p, q2) => (POSITION_ORDER.indexOf(p) < 0 ? 99 : POSITION_ORDER.indexOf(p)) - (POSITION_ORDER.indexOf(q2) < 0 ? 99 : POSITION_ORDER.indexOf(q2)));
  const eps = cw?.episodes ?? [];
  const shownPts = (id: string) => (cw?.points[id] ?? eps.map(() => 0)).map(r1);
  const total = (id: string) => sumShown(shownPts(id));
  const key = (id: string) => (sortBy === "total" ? total(id) : (shownPts(id)[sortBy] ?? 0));
  const mine = new Set(g.you?.team ?? []);
  const rows = g.cast
    .filter((c) => (filter === "free" ? !holders.has(c.id) && !c.left : filter === "mine" ? mine.has(c.id) : filter === "all" ? true : slotWord((c.role ?? "").toUpperCase()) === filter))
    .filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((p, q2) => key(q2.id) - key(p.id) || p.name.localeCompare(q2.name));
  const big = g.cast.length > 40;
  const chips: [string, string][] = [["all", "All"], ["free", "Free"], ["mine", "Yours"], ...roles.map((r) => [r, r] as [string, string])];
  // Who holds them, under the name: their faces, yours first; one holder named beside theirs; nobody, Free (or when they left).
  const whose = (c: (typeof g.cast)[number], yours: boolean) => {
    const hs = [...(holders.get(c.id) ?? [])].sort((p, q2) => Number(q2.you) - Number(p.you));
    const pos = c.role ? slotWord(c.role.toUpperCase()) : null;
    const said = hs.map((r) => (r.you ? "you" : first(r.name)));
    return (
      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] leading-tight text-muted-foreground" data-holders={hs.length}>
        {pos && <span className="flex-none">{pos}</span>}
        {hs.length ? (
          <>
            <Faces marks={hs.map((r) => ({ userId: r.userId ?? r.playerId, name: r.name, you: r.you }))} size={20} max={pos ? 3 : 4} ground={yours ? "var(--secondary)" : "var(--tg)"} />
            {hs.length === 1 && (
              <span className="min-w-0 truncate" aria-hidden>
                {hs[0].you ? "Yours" : first(hs[0].name)}
              </span>
            )}
            <span className="sr-only">, held by {said.length > 1 ? `${said.slice(0, -1).join(", ")} and ${said.at(-1)}` : said[0]}</span>
          </>
        ) : (
          <span className="min-w-0 truncate">{c.left ? `Out · ${words.ep} ${c.out}` : "Free"}</span>
        )}
      </span>
    );
  };
  // The pinned names and total cover the gutter beside them with the ground, so weeks scrolling under them never show past them;
  // your row's lift reaches 8px into it (as a lifted standings row does), and between two of your rows their hairline runs on
  // across the lift.
  const gutter = (side: "left" | "right", yours = false, joined = false) => {
    const lift = `linear-gradient(to ${side === "left" ? "left" : "right"}, var(--secondary) 8px, var(--tg) 8px)`;
    const background = !yours ? "var(--tg)" : joined ? `linear-gradient(var(--border), var(--border)) ${side === "left" ? "right" : "left"} top / 8px 1px no-repeat, ${lift}` : lift;
    return <span aria-hidden className={`absolute inset-y-0 w-4 ${side === "left" ? "right-full" : "left-full"}`} style={{ background }} />;
  };
  return (
    <div className="pb-3" data-game-table>
      {big && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${g.cast.length}`} aria-label="Search by name" className="mb-2 h-11 w-full rounded-[3px] bg-input/40 px-3 outline-1 -outline-offset-1 outline-input" />}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" role="radiogroup" aria-label="Who to show">
        {chips.map(([k, label]) => (
          <Chip key={k} on={filter === k} role="radio" aria-checked={filter === k} data-table-filter={k} onClick={() => setFilter(k)} className="h-11 flex-none px-3.5 text-[15px]">
            {label}
          </Chip>
        ))}
      </div>
      <p className="mb-1 text-[13px] text-muted-foreground">
        {rows.length} shown · sorted by {sortBy === "total" ? "the total" : `${words.ep} ${eps[sortBy]}`} (tap a heading to sort by it)
      </p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-muted-foreground">Nobody here by that name{filter !== "all" ? " in this filter" : ""}.</p>
      ) : (
        <div ref={scroller} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" style={{ "--tg": ground } as CSSProperties}>
          <table className="border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] bg-(--tg)">{gutter("left")}</th>
                {eps.map((e, i) => (
                  <th key={e} data-week-col className="w-[46px] min-w-[46px] pb-1">
                    <button type="button" onClick={() => setSortBy(i)} aria-pressed={sortBy === i} className={`type-caption min-h-11 w-full text-center text-[13px] ${sortBy === i ? "text-foreground underline underline-offset-4" : "font-normal text-muted-foreground"}`}>
                      {words.ep} {e}
                    </button>
                  </th>
                ))}
                <th className="sticky right-0 z-[1] bg-(--tg) pb-1 pl-3 text-right">
                  {gutter("right")}
                  <button type="button" onClick={() => setSortBy("total")} aria-pressed={sortBy === "total"} className={`type-caption min-h-11 text-[13px] ${sortBy === "total" ? "text-foreground underline underline-offset-4" : "font-normal text-muted-foreground"}`}>
                    Total
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((c, i, list) => {
                const pts = shownPts(c.id);
                const yours = mine.has(c.id);
                const joined = yours && i > 0 && mine.has(list[i - 1].id);
                return (
                  <tr key={c.id} data-table-row={c.id} className={yours ? "[&>*]:bg-secondary" : ""}>
                    <th scope="row" className={`sticky left-0 z-[1] text-left font-normal ${yours ? "" : "bg-(--tg)"}`}>
                      {gutter("left", yours, joined)}
                      <button type="button" data-door-cast={c.id} onClick={() => onFace(c.id)} className="flex min-h-12 w-[120px] items-center gap-2 border-t border-border pr-2 text-left">
                        <Face src={c.photo} name={c.name} out={c.left} className="size-7 flex-none rounded-[2px] text-[12px]" />
                        <span className="min-w-0 flex-1">
                          <b className={`block truncate text-[15px] font-semibold leading-tight ${c.left ? "text-muted-foreground" : ""}`}>{castName(c, g)}</b>
                          {whose(c, yours)}
                        </span>
                      </button>
                    </th>
                    {eps.map((e, i) => (
                      <td key={e} className="h-12 w-[46px] border-t border-border p-0 text-center align-middle">
                        {c.left && c.out !== null && e > c.out ? (
                          <span className="text-muted-foreground/60">·</span>
                        ) : (
                          // That castaway that week: their sheet, at that episode of their story (the drill pass, 2026-11-17).
                          <button type="button" data-table-cell={`${c.id}:${e}`} aria-label={`${castName(c, g)}, ${words.ep} ${e}: ${signed(pts[i])}`} onClick={() => onFace(c.id, e)} className={`nd-press type-num grid h-12 w-full place-items-center text-[15px] ${pts[i] > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                            {signed(pts[i])}
                          </button>
                        )}
                      </td>
                    ))}
                    <td className={`sticky right-0 z-[1] border-t border-border pl-3 text-right ${yours ? "" : "bg-(--tg)"}`}>
                      {gutter("right", yours, joined)}
                      <b className="type-num text-[17px]">{fmt(total(c.id))}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + 40)} className="mt-1 inline-flex min-h-11 items-center text-[15px] font-semibold" data-table-more>
          Show {Math.min(40, rows.length - shown)} more
        </button>
      )}
    </div>
  );
}
