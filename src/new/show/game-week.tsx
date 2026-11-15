"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, Lock, MessageCircleQuestion, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { bets as betWrites, moves as moveWrites, type GameView, type TableRow, type WaiverWeek } from "../data";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { Btn, Chip } from "../ui/parts";
import { toast } from "../ui/toast";
import type { SideBet } from "@/lib/game/week-view";
import { signed } from "./lineup-sheet";
import { faceIn, first } from "./moves";
import { Face } from "./parts";
import { scoreWords, type WeekCard, type WeekSide } from "./this-week";

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
      {small && faces && <Starters g={g} faces={faces} className="mt-2.5 justify-center" />}
    </div>
  );
}

/** A sport's positions in the order a lineup card reads them (quarterback first, defense last); anything else after, as given. */
const POSITION_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "OP", "K", "PK", "DEF", "DST", "D/ST", "PG", "SG", "G", "SF", "PF", "F", "C", "UTIL"];
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
      {byPosition(g, faces).map((id) => {
        const c = faceIn(g, id);
        return (
          <span key={id} className="flex w-[32px] flex-col items-center">
            <Face src={c?.photo ?? null} name={c?.name} out={c?.left} className="size-[30px] rounded-[2px] text-[13px]" />
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
          {w.state}
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
export function waiverLine(ww: WaiverWeek | undefined, g: GameView, when: (iso: string) => string, words: ShowData["words"]): string | null {
  if (!ww || ww.shared || !ww.period || ww.revealFirst !== null) return null;
  const name = (id: string | undefined) => first(faceIn(g, id ?? "")?.name ?? ww.free.find((f) => f.id === id)?.name ?? "someone");
  if (ww.stage === "open") {
    const spot = ww.spots.find((s) => s.addIds.length);
    if (spot) {
      const order = spot.addIds.slice(0, 2).map((id) => name(id));
      return `Your claim is in: ${order[0]} first${order[1] ? `, then ${order[1]}` : ""}${ww.period.due ? ` · claims run ${when(ww.period.due)}` : ""}`;
    }
    if (ww.replace.length) return `${name(ww.replace[0])} went home in ${words.ep} ${ww.period.episode}. You're owed a replacement.`;
    return null;
  }
  if (ww.stage === "processed" && ww.run && ww.run.episode === ww.period.episode) {
    const mine = ww.run.moves.find((m) => m.you && m.add);
    if (mine?.add) {
      const why = mine.choice && mine.choice > 1 && mine.why ? `, your ${mine.why.replace(/\.?$/, ".").replace(/^(\d+\w+) choice: /, "$1 choice: ")}` : ".";
      const early = ww.period.due && Date.parse(ww.run.at) < Date.parse(ww.period.due) ? " It ran early: everyone owed one had claimed." : "";
      return `You got ${first(mine.add.name)}${why}${early}`;
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
  else if (played.length) detail = `${words.ep} ${played[0].episode}: waiting to be settled`;
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
export function BetsBody({ g, words, seasonId, runs }: { g: GameView; words: ShowData["words"]; seasonId: string; runs: boolean }) {
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
          <BetItem key={x.betId} g={g} x={x} words={words} runs={runs} onSaved={refresh} />
        ))}
      {b.postTo !== null && <PostBet g={g} episode={b.postTo} words={words} onSaved={refresh} />}
    </div>
  );
}

function BetItem({ g, x, words, runs, onSaved }: { g: GameView; x: SideBet; words: ShowData["words"]; runs: boolean; onSaved: () => void }) {
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
        <Calls g={g} x={x} runs={runs} onSaved={onSaved} />
      )}
    </article>
  );
}

/** Everyone's calls on a locked bet; once its episode is in, the marks, and for whoever runs the game, Settle. */
function Calls({ g, x, runs, onSaved }: { g: GameView; x: SideBet; runs: boolean; onSaved: () => void }) {
  const calls = useMemo(() => x.everyone ?? [], [x.everyone]);
  const answers = useMemo(() => [...new Set(calls.map((c) => c.guess.trim()))], [calls]);
  const [pick, setPick] = useState<string | null>(null);
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
            <Avatar id={g.table.find((r) => r.playerId === c.playerId)?.userId ?? c.playerId} name={c.name} size={26} />
            <span className="min-w-0 flex-1 text-[15px]">
              <b className="font-semibold">{c.you ? "You" : first(c.name)}</b> <span className="text-muted-foreground">·</span> {c.guess}
            </span>
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
      {!x.played && <p className="mt-1.5 text-[13px] text-muted-foreground">Locked. Settled once the {x.episode ? "episode" : "game"} is in.</p>}
      {x.played && !x.settled && !runs && <p className="mt-1.5 text-[13px] text-muted-foreground">Waiting to be settled.</p>}
      {x.played && x.calls < 2 && <p className="mt-1.5 text-[13px] text-muted-foreground">Fewer than two called it, so it pays nothing.</p>}
      {canSettle && !x.settled && (
        <div className="mt-3 rounded-[3px] bg-secondary/60 p-3" data-settle>
          <p className="text-[14px] font-semibold">What happened?</p>
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
  const ids = [...r.team].sort((a, b) => Number(!!faceIn(g, a)?.left) - Number(!!faceIn(g, b)?.left));
  return (
    <section className="mt-8 px-4" data-your-team data-game-you>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Your team</h2>
        <button type="button" data-door-you onClick={onSheet} className="inline-flex min-h-11 items-center gap-0.5 text-[14px] font-semibold">
          Week by week
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      {exclusive && <p className="-mt-1 mb-1 text-[13px] text-muted-foreground">Only you have them: one owner each.</p>}
      <ul>
        {ids.map((id) => {
          const c = faceIn(g, id);
          if (!c) return null;
          const line = c.left ? (c.out ? `Out · ${words.ep} ${c.out}` : "Out") : [c.role, c.tribe?.name].filter(Boolean).join(" · ") || "Still in";
          return (
            <li key={id}>
              <button type="button" data-door-cast={id} onClick={() => onFace(id)} className="nd-press flex min-h-14 w-full items-center gap-3 border-t border-border py-1.5 text-left">
                <Face src={c.photo} name={c.name} out={c.left} className="size-10 flex-none rounded-[2px] text-[15px]" />
                <span className="min-w-0 flex-1">
                  <b className={`block truncate text-[16px] font-semibold ${c.left ? "text-muted-foreground" : ""}`}>{c.name}</b>
                  <small className="block text-[13px] text-muted-foreground">{line}</small>
                </span>
                <span className="type-num text-[22px]">{fmt(c.points ?? 0)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- the matchup sheet's body ----------

type Line = { id: string; points: number; why: string[] };

/** Who `pid` played in week `n` and both lineups: played (each side's lines), locked (who started, no points yet), or still to
 *  lock (yours as it stands, theirs hidden). */
export function matchupOf(g: GameView, pid: string, n: number) {
  const row = (id: string | null | undefined) => (id ? (g.table.find((r) => r.playerId === id) ?? null) : null);
  const a = row(pid);
  const sq = g.plays.rows[pid]?.find((s) => s.episode === n) ?? null;
  const next = g.matchups?.next && g.matchups.next.episode === n && pid === g.playerId ? g.matchups.next : null;
  const oppId = sq?.result?.against ?? next?.opponent ?? null;
  const b = row(oppId && oppId !== pid ? oppId : null);
  const wa = a?.weeks.find((w) => w.episode === n) ?? null;
  const wb = b?.weeks.find((w) => w.episode === n) ?? null;
  const played = !!sq && sq.points !== null;
  const lock = g.locked && g.locked.episode === n && pid === g.playerId ? g.locked : null;
  return { a, b, sq, wa, wb, played, lock, next, quiet: played && !sq?.result };
}

export function MatchupTitle(g: GameView, pid: string, n: number, words: ShowData["words"]): { title: string; subtitle: string } {
  const m = matchupOf(g, pid, n);
  const an = m.a ? (m.a.you ? "You" : first(m.a.name)) : "";
  const bn = m.b ? (m.b.you ? "you" : first(m.b.name)) : m.sq?.result?.median ? "the median" : "nobody";
  const title = `${words.ep} ${n} · ${an} vs ${bn}`;
  let subtitle: string;
  if (m.quiet) subtitle = "Counted for nobody · records unchanged";
  else if (m.played && m.sq?.result) {
    const r = m.sq.result;
    const verb = r.r === "W" ? (m.a?.you ? "You won" : `${an} won`) : r.r === "L" ? (m.a?.you ? "You lost" : `${an} lost`) : "A tie";
    subtitle = `${verb} · ${scoreWords(r.us, r.them)}`;
  } else if (m.lock) subtitle = "Locked · results when they're in";
  else subtitle = "Lineups lock when it airs";
  return { title, subtitle };
}

/** Two lineups on one signed points scale (data round 3's B): each starter a face, a name, a bar from zero and the reasons;
 *  the bench, which didn't count, folded. */
export function MatchupBody({ g, pid, n, words, onFace }: { g: GameView; pid: string; n: number; words: ShowData["words"]; onFace: (id: string) => void }) {
  const m = matchupOf(g, pid, n);
  const [bench, setBench] = useState(false);
  const linesA: Line[] | null = m.played && !m.wa ? [] : m.wa ? m.wa.started : m.lock && m.a?.you ? m.lock.mine.map((id) => ({ id, points: 0, why: [] })) : m.a?.you && g.lineup?.episode === n ? g.lineup.starters.map((id) => ({ id, points: 0, why: [] })) : null;
  const linesB: Line[] | "hidden" | null = m.played && !m.wb ? (m.b ? [] : null) : m.wb ? m.wb.started : m.lock?.theirs ? m.lock.theirs.map((id) => ({ id, points: 0, why: [] })) : m.b ? "hidden" : null;
  const all = [...(linesA ?? []), ...(Array.isArray(linesB) ? linesB : []), ...(bench ? [...(m.wa?.bench ?? []), ...(m.wb?.bench ?? [])] : [])];
  const max = Math.max(1, ...all.map((l) => Math.abs(l.points)));
  const neg = all.some((l) => l.points < 0);
  return (
    <div className="pb-3" data-matchup-sheet={`${pid}:${n}`}>
      <div className="grid grid-cols-2 gap-3">
        <Column g={g} who={m.a} total={m.wa?.total ?? m.sq?.result?.us ?? (m.played ? (m.sq?.points ?? null) : null)} lines={linesA} max={max} neg={neg} played={m.played} onFace={onFace} />
        <Column g={g} who={m.b} total={m.wb?.total ?? m.sq?.result?.them ?? null} lines={linesB} max={max} neg={neg} played={m.played} onFace={onFace} />
      </div>
      {m.played && !m.wa && (
        <p className="mt-2 text-[13px] text-muted-foreground" data-matchup-no-lines>
          Each player&apos;s line for this week isn&apos;t in yet, only the totals.
        </p>
      )}
      {m.played && !!m.wa && (
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          One points scale for both lineups{neg ? ": below zero to the left" : ""}
        </p>
      )}
      {m.played && ((m.wa?.bench.length ?? 0) > 0 || (m.wb?.bench.length ?? 0) > 0) && (
        <div className="mt-3 border-t border-border">
          <button type="button" onClick={() => setBench((o) => !o)} aria-expanded={bench} data-matchup-bench className="flex min-h-11 w-full items-center gap-1.5 text-[14px] font-semibold">
            <ChevronDown className={`size-4 transition-transform ${bench ? "" : "-rotate-90"}`} aria-hidden />
            Bench · didn&apos;t count
          </button>
          {bench && (
            <div className="grid grid-cols-2 gap-3 pb-1">
              <Column g={g} who={null} total={null} lines={m.wa?.bench.map((x) => ({ ...x, why: [] })) ?? []} max={max} neg={neg} played dim onFace={onFace} />
              <Column g={g} who={null} total={null} lines={m.wb?.bench.map((x) => ({ ...x, why: [] })) ?? []} max={max} neg={neg} played dim onFace={onFace} />
            </div>
          )}
        </div>
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

function Column({ g, who, total, lines, max, neg, played, dim, onFace }: { g: GameView; who: TableRow | null; total: number | null; lines: Line[] | "hidden" | null; max: number; neg: boolean; played: boolean; dim?: boolean; onFace: (id: string) => void }) {
  return (
    <div className="min-w-0">
      {who && (
        <div className="mb-2 flex items-center gap-2">
          <Avatar id={who.userId ?? who.playerId} name={who.name} size={28} />
          <b className="type-caption min-w-0 truncate text-[20px]">{who.you ? "You" : first(who.name)}</b>
          {total !== null && <b className="type-num ml-auto text-[26px] leading-none">{fmt(total)}</b>}
        </div>
      )}
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
                <button type="button" data-door-cast={l.id} onClick={() => onFace(l.id)} className={`nd-press flex w-full flex-col border-t border-border py-1.5 text-left ${dim ? "opacity-70" : ""}`}>
                  <span className="flex w-full items-center gap-1.5">
                    <Face src={c?.photo ?? null} name={c?.name} out={c?.left} className="size-7 flex-none rounded-[2px] text-[12px]" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{first(c?.name ?? "")}</span>
                    {c?.role && <span className="text-[11px] font-bold tracking-[0.04em] text-muted-foreground">{c.role}</span>}
                    {played && <b className={`type-num text-[17px] ${l.points > 0 ? "text-good" : l.points < 0 ? "text-muted-foreground" : "text-muted-foreground"}`}>{signed(l.points)}</b>}
                  </span>
                  {played && (
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
    </div>
  );
}
