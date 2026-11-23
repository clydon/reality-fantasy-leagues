"use client";

// The victory lap (docs/PLAN-sports-couch.md C3; the design: docs/design-round/victory-lap-spec.md (Intent), -first-view.md (PFD),
// -shape.md (Impeccable)). When a couch member's team wins, that fan gets one prompt, easy to ignore: This week's lap card (under the
// move strip) and the game's sheet once it's final. Take a victory lap opens the lap sheet: a GIF (React with a GIF's picker, already
// searching "<team> win"), then a line if they like, then Post: it lands in the game's thread in the league's room (no push) and on
// the couch's feed. Not this time ends the prompt on every phone; the sheet keeps a quiet "Take a victory lap" until the team plays
// again. The thesis: the result earns the GIF, so a lap always wears the final that earned it, from the fan's side.
//
// Hide sports scores: a lap says who won, so nothing of one (the prompt included) is drawn for anyone who hasn't shown its game.

import { useState } from "react";
import { Trophy } from "lucide-react";
import { useLapActions, type GifHit, type Lap, type LapResult, type OpenLap } from "../data";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { GifPicker } from "../ui/gif-sheet";
import { Sheet } from "../ui/sheet";
import { GifTile } from "../show/react";
import { TeamMark } from "./parts";
import { dayOf, useGameScore } from "./scores";
import { teamKeyOf } from "@/lib/sports/team-badge";
import type { Fan } from "@/lib/sports/couch-table";
import { leagueName } from "@/lib/sports/matchup";

const LINE_MAX = 120;

/** A lap's game as the hiding rules read it: a final. */
const momentOf = (l: { event: string; at?: string | null; eventAt?: string | null }) => ({ id: l.event, at: l.at ?? l.eventAt ?? null, state: "post" as const, final: true, called: null });

/** Whether a lap's game may be told to you (not hiding scores, or you've shown it). */
export function useLapShown(l: { event: string; at?: string | null; eventAt?: string | null } | null): boolean {
  const s = useGameScore(l ? momentOf(l) : null);
  return !!l && s.open && !s.recording;
}

/** "Giants 24–17 Bears": the final from the fan's team's side. */
export const lapWords = (r: LapResult) => `${r.team.short} ${r.score[0]}–${r.score[1]} ${r.opponent.short}`;

/** The one mark a lap wears everywhere it's drawn: a small trophy and "Victory lap", muted, on no fill. */
export function LapTag({ className = "" }: { className?: string }) {
  return (
    <span data-lap-tag className={`type-caption inline-flex items-center gap-1 text-[12px] tracking-[0.06em] text-muted-foreground ${className}`}>
      <Trophy className="size-[13px]" aria-hidden />
      Victory lap
    </span>
  );
}

/** The result a lap wears, in a line: the team's xs mark, "Giants 24–17 Bears", the numbers in the number type. */
export function LapResultLine({ r, league, after }: { r: LapResult; league: string; after?: string }) {
  return (
    <span data-lap-result className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <TeamMark abbr={r.team.abbreviation ?? r.team.short.slice(0, 3)} color={r.team.color} size="xs" team={teamKeyOf(league, r.team.id)} />
      <span className="min-w-0 truncate">
        <span className="font-semibold text-foreground">{r.team.short}</span> <span className="type-num text-[14px] text-foreground">{r.score[0]}–{r.score[1]}</span> {r.opponent.short}
        {after ? ` · ${after}` : ""}
      </span>
    </span>
  );
}

/** "vs Bears", or "at Riley's Eagles" when a couch fan has the other side (the rivalry, said by its opponent). */
function againstWords(l: OpenLap, fansOf: (team: string) => Fan[], meId: string) {
  const fans = fansOf(l.opponent.id).filter((f) => f.id !== meId);
  const who = fans.length === 1 ? `${fans[0].name}’s ` : fans.length > 1 ? `${fans[0].name} and ${fans.length - 1} more’s ` : "";
  return `${l.home === false ? "at" : "vs"} ${who}${l.opponent.short}`;
}

/** Your open lap to show (the newest you haven't answered), when its game may be told to you. */
export function useOpenLap(open: OpenLap[] | undefined, opts: { event?: string } = {}): OpenLap | null {
  const lap = (open ?? []).find((l) => (opts.event ? l.event === opts.event : !l.skipped)) ?? null;
  return useLapShown(lap) ? lap : null;
}

/**
 * This week's lap card, under the move strip: the result your way round in the caption type, what else it settled, and the ask (the ink
 * button, never the page's yellow: a lap isn't a due move). Gone once answered.
 */
export function LapCard(p: { lap: OpenLap | null; laps: Lap[]; league: string; couchId: string; meId: string; gifs: boolean; fansOf: (team: string) => Fan[] }) {
  const { lap } = p;
  const { take } = useLapActions(p.couchId, p.league);
  // The sheet keeps its lap once opened: posting answers the lap, and the card (with the read) lets it go while the sheet shows it posted.
  const [sheetLap, setSheetLap] = useState<OpenLap | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const sheet = <LapSheet lap={sheetLap} league={p.league} couchId={p.couchId} gifs={p.gifs} onClose={() => setSheetLap(null)} />;
  // The sheet stays in one place in the tree, so posting (which answers the lap and takes the card away) never remounts it.
  if (!lap) return <>{null}{sheet}</>;
  const coFans = p.laps.filter((l) => l.event === lap.event && l.userId !== p.meId);
  const skip = async () => {
    setFailed(false);
    setLeaving(true);
    try {
      await take({ event: lap.event, team: lap.team.id, skip: true });
    } catch {
      setLeaving(false);
      setFailed(true);
    }
  };
  return (
    <>
    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"}`}>
      <section data-lap-card={lap.event} aria-label={`${lap.team.short} won: take a victory lap`} className="mt-4 min-h-0 overflow-hidden">
        <div className="rounded-[4px] bg-card px-3.5 pb-2 pt-2.5">
          <div className="flex items-center gap-2.5">
            <TeamMark abbr={lap.team.abbreviation ?? lap.team.short.slice(0, 3)} color={lap.team.color} size="sm" team={teamKeyOf(p.league, lap.team.id)} />
            <h2 className="type-caption min-w-0 flex-1 truncate text-[22px] leading-none">{lap.team.short} won</h2>
            <span className="type-num flex-none text-[20px] leading-none">
              {lap.score[0]}–{lap.score[1]}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] leading-4 text-muted-foreground">
            {againstWords(lap, p.fansOf, p.meId)}
            {lap.called && <span className="font-semibold text-foreground"> · You called it</span>}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Btn tone="ink" data-lap-take className="h-11! flex-1" onClick={() => setSheetLap(lap)}>
              Take a victory lap
            </Btn>
            <button type="button" data-lap-skip onClick={() => void skip()} className="nd-press inline-flex h-11 flex-none items-center px-2 text-[14px] font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-foreground">
              Not this time
            </button>
          </div>
          {coFans.length > 0 && (
            <p data-lap-cofans className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Avatar id={coFans[0].userId} name={coFans[0].name} size={16} />
              {coFans.length === 1 ? `${coFans[0].name} took one` : `${coFans[0].name} and ${coFans.length - 1} more took one`}
            </p>
          )}
          {failed && (
            <p role="alert" className="mt-1 text-[13px] font-semibold">
              Didn&rsquo;t save · Try again
            </p>
          )}
        </div>
      </section>
    </div>
    {sheet}
    </>
  );
}

/**
 * The game's sheet once it's final, for the winning fan: the ask alone (the bug above says the score). After Not this time, a quiet
 * "Take a victory lap" until the team plays again; after a lap, nothing (the laps below show it).
 */
export function LapPrompt({ lap, league, couchId, gifs }: { lap: OpenLap | null; league: string; couchId: string; gifs: boolean }) {
  const { take } = useLapActions(couchId, league);
  const [sheetLap, setSheetLap] = useState<OpenLap | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [failed, setFailed] = useState(false);
  const sheet = <LapSheet lap={sheetLap} league={league} couchId={couchId} gifs={gifs} onClose={() => setSheetLap(null)} />;
  if (!lap) return <>{null}{sheet}</>;
  const quiet = lap.skipped || skipped;
  const skip = async () => {
    setFailed(false);
    setSkipped(true);
    try {
      await take({ event: lap.event, team: lap.team.id, skip: true });
    } catch {
      setSkipped(false);
      setFailed(true);
    }
  };
  return (
    <>
    <div data-lap-prompt={quiet ? "quiet" : "ask"} className="mt-3">
      {quiet ? (
        <button type="button" data-lap-take onClick={() => setSheetLap(lap)} className="nd-press inline-flex h-11 items-center gap-1.5 text-[14px] font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
          <Trophy className="size-4" aria-hidden />
          Take a victory lap
        </button>
      ) : (
        // Flush on the sheet (a panel on the sheet's own ground read as a stray indent: the check).
        <div>
          <p className="text-[15px]">
            <b className="font-semibold">{lap.team.short} won</b>
            {lap.called && <span className="text-muted-foreground"> · You called it</span>}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Btn tone="ink" data-lap-take className="h-11! flex-1" onClick={() => setSheetLap(lap)}>
              Take a victory lap
            </Btn>
            <button type="button" data-lap-skip onClick={() => void skip()} className="nd-press inline-flex h-11 flex-none items-center px-2 text-[14px] font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-foreground">
              Not this time
            </button>
          </div>
          {failed && (
            <p role="alert" className="mt-1 text-[13px] font-semibold">
              Didn&rsquo;t save · Try again
            </p>
          )}
        </div>
      )}
    </div>
    {sheet}
    </>
  );
}

/** The lap sheet: a GIF (the picker alone), then the line and Post (never both at once), then the lap as the couch will see it. */
function LapSheet({ lap, league, couchId, gifs, onClose }: { lap: OpenLap | null; league: string; couchId: string; gifs: boolean; onClose: () => void }) {
  return <LapSheetBody key={lap?.event ?? "none"} lap={lap} league={league} couchId={couchId} gifs={gifs} onClose={onClose} />;
}

function LapSheetBody({ lap, league, couchId, gifs, onClose }: { lap: OpenLap | null; league: string; couchId: string; gifs: boolean; onClose: () => void }) {
  const { take, takeBack } = useLapActions(couchId, league);
  const [gif, setGif] = useState<GifHit | null>(null);
  const [picking, setPicking] = useState(true);
  const [line, setLine] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  if (!lap) return null;
  const step: "pick" | "say" | "posted" = posted ? "posted" : gifs && picking ? "pick" : "say";
  const subtitle = `${lapWords(lap)}${lap.at ? ` · ${dayOf(lap.at)}` : ""}`;
  const post = async () => {
    if (saving) return;
    setSaving(true);
    setFailed(null);
    try {
      await take({ event: lap.event, team: lap.team.id, gif, line: line.trim() || undefined });
      setPosted(true);
    } catch (e) {
      setFailed((e as Error).message?.includes("isn't a win") ? "That win's lap has closed: they've played again" : "Didn’t post · Try again");
    } finally {
      setSaving(false);
    }
  };
  const back = async () => {
    setSaving(true);
    try {
      await takeBack(lap.event);
      setPosted(false);
    } catch {
      setFailed("Didn’t take it back · Try again");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Victory lap" subtitle={subtitle}>
      <div data-lap-sheet={step} aria-busy={saving || undefined} key={step} className="motion-safe:animate-[chat-in_150ms_ease-out]">
        {step === "pick" ? (
          <>
            <GifPicker active onPick={(g) => (setGif(g), setPicking(false))} initial={`${lap.team.short} win`} placeholder="Search any GIF" />
            <Btn wide className="mt-3" onClick={onClose}>
              Not now
            </Btn>
          </>
        ) : step === "say" ? (
          <>
            {gif && (
              <>
                <GifTile gif={gif} you wide />
                <div className="-mt-0.5 flex justify-end">
                  <button type="button" data-lap-again onClick={() => setPicking(true)} className="nd-press inline-flex h-11 items-center px-1 text-sm font-semibold text-chyron-line">
                    Pick another
                  </button>
                </div>
              </>
            )}
            <label className="mt-1 block">
              <span className="sr-only">Add a line</span>
              <input
                data-lap-line
                value={line}
                maxLength={LINE_MAX}
                onChange={(e) => setLine(e.target.value)}
                placeholder={gif ? "Add a line (optional)" : "Say something"}
                autoComplete="off"
                className="h-12 w-full rounded-[3px] border border-input bg-background px-3 text-base outline-0 focus-visible:border-foreground"
              />
            </label>
            <p className="mt-2 text-[13px] text-muted-foreground">To the {leagueName(league)} room and On the couch · waits for anyone hiding scores</p>
            <Btn tone="must" wide data-lap-post className="mt-3" disabled={saving || (!gif && !line.trim())} onClick={() => void post()}>
              {saving ? "Posting…" : "Post it"}
            </Btn>
            {failed && (
              <p role="alert" className="mt-2 text-[13px] font-semibold">
                {failed}
              </p>
            )}
          </>
        ) : (
          <>
            <LapPreview r={lap} league={league} gif={gif} line={line.trim() || null} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Posted · in the room&rsquo;s {lap.home === false ? `${lap.team.short} at ${lap.opponent.short}` : `${lap.opponent.short} at ${lap.team.short}`} thread</span>
              <button type="button" data-lap-back disabled={saving} onClick={() => void back()} className="nd-press inline-flex h-11 flex-none items-center px-1 text-sm font-semibold underline underline-offset-[3px]">
                Take it back
              </button>
            </div>
            {failed && (
              <p role="alert" className="text-[13px] font-semibold">
                {failed}
              </p>
            )}
            <Btn tone="ink" wide className="mt-3" onClick={onClose}>
              Done
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** A lap as the couch sees it: the tag and the result, the GIF, the line. */
function LapPreview({ r, league, gif, line }: { r: LapResult; league: string; gif: GifHit | null; line: string | null }) {
  return (
    <div data-lap-preview className="rounded-[4px] bg-card p-2">
      {/* The room's form: the tag over the result (the check: one lap language everywhere). */}
      <div className="flex flex-col gap-1 px-1 pb-1.5">
        <LapTag />
        <LapResultLine r={r} league={league} />
      </div>
      {gif && <GifTile gif={gif} you wide />}
      {line && <p className="px-1 pt-2 text-[15px]">{line}</p>}
    </div>
  );
}

/** The game's sheet, once final: the couch's laps on it, each GIF whole with its name strip and the line under it. */
export function VictoryLaps({ laps, meId }: { laps: Lap[]; meId: string }) {
  if (!laps.length) return null;
  return (
    <section data-victory-laps={laps.length}>
      <div className="mb-2.5 mt-6 flex items-center gap-1.5 text-muted-foreground">
        <Trophy className="size-4" aria-hidden />
        <span className="type-caption text-[15px] tracking-[0.04em]">Victory laps</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {laps.map((l) => (
          <div key={l.messageId} data-lap={l.userId} className={`min-w-0 ${laps.length === 1 ? "col-span-2" : ""}`}>
            {l.gif ? (
              <GifTile gif={l.gif} name={l.name} you={l.userId === meId} wide={laps.length === 1} />
            ) : (
              <span className="type-caption flex h-6 items-center bg-plate px-2 text-[14px] text-plate-foreground">{l.userId === meId ? "You" : l.name}</span>
            )}
            {l.line && <p className="mt-1 text-[13px] leading-snug">{l.line}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
