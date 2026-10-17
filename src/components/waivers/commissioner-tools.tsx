"use client";

import { useState } from "react";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import type { LeagueState, Player, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { useShowTerms } from "@/lib/use-show-terms";
import { confirm } from "@/lib/confirm-store";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { PlainButton, SectionHead } from "@/components/draft/draft-ui";
import { Chip, Dot, Note } from "./waivers-ui";
import { rotation, timeLeft, useCastNames, useWaiversBase, when } from "./waivers-model";
import { latestEpisode, windowLine } from "./waivers-words";
import { SwapCounter, SwitchRow } from "./waiver-controls";
import { claimHref } from "./claim-screen";

// The commissioner's part of the Waivers page (the canvas's board 10; docs/PLAN-waivers-v2.md "3B").
// Nothing to start or end: while claims are open, Process now, Nudge and a claim for anyone; once
// they've processed, Undo last waiver run while free agency is on. And Open a waiver window, any week
// once an episode has results and until its waivers process. Claims stay private from the commissioner
// too -- "Claim for Dee" writes one of Dee's spots without ever showing what's in it.

/** Whether the commissioner can open a window now: a week open that isn't one, or none yet for the latest results. */
function canOpenWindow(state: LeagueState, period: WaiverPeriod | null): boolean {
  const W = StateLogic.WaiverLogic;
  if (!W.supported(state)) return false;
  if (period) return period.phase === "open" && !W.isWindow(period);
  const latest = latestEpisode(state);
  if (latest < StateLogic.startEpisode(state) || StateLogic.MidSeasonLogic.seasonOver(state)) return false;
  const ps = W.periods(state);
  const prev = ps[ps.length - 1];
  return !prev || prev.episode < latest;
}

/** "WAIVER WINDOW OPEN / Replace who's out · Swap any · due Tue 8:05 PM", with Change and Turn off. */
export function WindowControl({ state, period, now }: { state: LeagueState; period: WaiverPeriod; now: number }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const line = windowLine(state, period);
  async function turnOff() {
    const ok = await confirm("Claims for swaps (and replacements, if it opened those) are taken out. Players aren't told who claimed what.", {
      title: "Turn off this waiver window?",
      confirmLabel: "Turn off",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    await mutate(
      (s) => {
        StateLogic.WaiverLogic.openWindow(s, null, Date.now());
      },
      () => api.openWaiverWindow(leagueId!, null),
    );
    setBusy(false);
  }
  return (
    <div className="flex flex-col gap-2.5">
      <CaptionPlate tone="quiet" tag="Window" size="sm" title="Waiver window open" subtitle={`${line ? `${line} · ` : ""}due ${when(period.processAt, now)}`} />
      <div className="grid grid-cols-2 gap-2">
        <PlainButton onClick={() => setEditing(true)} disabled={busy}>
          Change
        </PlainButton>
        <PlainButton onClick={turnOff} disabled={busy} danger>
          Turn off
        </PlainButton>
      </div>
      {/* Remounted on each open, so it starts from the window as it stands. */}
      <OpenWindowSheet key={String(editing)} state={state} period={period} open={editing} onOpenChange={setEditing} now={now} />
    </div>
  );
}

/**
 * Open a waiver window (3B): replace castaways who are out (a toggle, only where the league's rule makes
 * replacements wait for windows or never happen), swap castaways still in (None · 1 … · All), and a
 * live preview of what players get -- with no names, since it can exist before a viewer has revealed
 * the episode. Also Change, for a window already open.
 */
export function OpenWindowSheet({
  state,
  period,
  open,
  onOpenChange,
  now,
}: {
  state: LeagueState;
  period: WaiverPeriod | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  now: number;
}) {
  const W = StateLogic.WaiverLogic;
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const R = StateLogic.rosterSize(state);
  const rule = W.replaceRule(state);
  const editing = !!period && W.isWindow(period);
  // Replacements every week (always / only when short) happen anyway: nothing to switch.
  const ruleDecides = rule === "always" || rule === "whenShort";
  const classic = !StateLogic.getLeagueType(state).hasActiveRoster;
  const cfg = W.windows(state).swaps;
  const [replace, setReplace] = useState(() => (editing ? W.windowReplaces(state, period) : rule !== "never"));
  const [swaps, setSwaps] = useState(() => (editing ? W.swapsAllowed(period) : cfg > 0 ? cfg : classic ? R : 1));
  const [busy, setBusy] = useState(false);
  const episode = period ? period.episode : latestEpisode(state);
  const due = period ? period.processAt : W.schedule(state, { episode, openedAt: new Date(now).toISOString() } as WaiverPeriod).processAt;
  const replaceOn = ruleDecides ? undefined : replace;
  const line = windowLine(state, { window: true, swaps, replace: replaceOn });
  const any = swaps > 0 || (!ruleDecides && replace);

  async function submit() {
    setBusy(true);
    const ok = await mutate(
      (s) => {
        W.openWindow(s, swaps, Date.now(), { replace: replaceOn });
      },
      () => api.openWaiverWindow(leagueId!, swaps, replaceOn),
    );
    setBusy(false);
    if (ok) onOpenChange(false);
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editing ? "Change waiver window" : "Open a waiver window"} hideCancel>
      <div className="flex flex-col">
        <p className="-mt-0.5 pb-1 text-[13px] text-muted-foreground">
          After Episode {episode} · claims due {when(due, now)}
        </p>
        {!ruleDecides && (
          <SwitchRow
            tone="you"
            label="Replace castaways who are out"
            hint={replace ? "Each gets a free agent. Their points stay." : "Out castaways stay on the team."}
            checked={replace}
            onChange={setReplace}
          />
        )}
        <div className="flex min-h-[64px] items-center gap-3 border-b border-border py-2.5">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold">Swap castaways still in</span>
            <span className="text-[13px] leading-snug text-muted-foreground">
              {swaps === 0 ? "Nobody still in can move." : swaps >= R ? "Any of them. Their points go too." : `Up to ${swaps} each. Their points go too.`}
            </span>
          </span>
          <SwapCounter value={swaps} roster={R} onChange={setSwaps} label="Swaps each" />
        </div>
        <div className="flex flex-col gap-2 pb-2.5 pt-3.5">
          <span className="text-[13px] text-muted-foreground">Players get</span>
          {any ? (
            <CaptionPlate tone="quiet" tag="Window" size="sm" title={line || "Swap"} subtitle={`Optional · due ${when(due, now)}`} />
          ) : (
            <div className="flex min-h-[52px] items-center rounded-[3px] border-[1.5px] border-dashed border-input px-3.5 text-sm text-muted-foreground">Nothing to claim yet</div>
          )}
        </div>
        <div className="grid grid-cols-[1fr_1.8fr] gap-2 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-[52px] rounded-[6px] border border-input text-[15px] font-semibold">
            Not now
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!any || busy}
            className="min-h-[52px] rounded-[6px] bg-chyron text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-40"
          >
            {busy ? "Saving…" : editing ? "Save" : "Open window"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export function CommissionerTools({ state, period, now }: { state: LeagueState; period: WaiverPeriod | null; now: number }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const mutate = useMutate();
  const terms = useShowTerms();
  const [busy, setBusy] = useState(false);
  const [claimFor, setClaimFor] = useState<Player | null>(null);
  const [opening, setOpening] = useState(false);
  const accounts = useLeagueStore((s) => s.playerAccounts);
  const players = rotation(state);
  const W = StateLogic.WaiverLogic;
  const canOpen = canOpenWindow(state, period);
  const n = period ? period.episode + 1 : 0;

  const openRow = canOpen && (
    <div className="flex flex-col gap-3 border-b border-border py-3.5">
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold leading-[1.3]">Open a waiver window</span>
        <span className="text-[13px] leading-[1.35] text-muted-foreground">Let everyone replace who&rsquo;s out or swap who&rsquo;s still in, this week.</span>
      </span>
      <PlainButton onClick={() => setOpening(true)} className="nav:self-start">
        Open a waiver window
      </PlainButton>
      <OpenWindowSheet key={String(opening)} state={state} period={period} open={opening} onOpenChange={setOpening} now={now} />
    </div>
  );

  async function processNow() {
    if (!(await confirm("Process every claim that's in now, and open free agency early? Anyone without a claim in misses this week's waivers.", { confirmLabel: "Process now" }))) return;
    setBusy(true);
    await mutate(
      () => {},
      () => api.processWaivers(leagueId!),
    );
    setBusy(false);
  }
  // One push to them, worded for what they may know (they might not have revealed the episode yet).
  async function nudge(p: Player) {
    setBusy(true);
    await mutate(
      () => {},
      () => api.nudgeWaivers(leagueId!, p.id),
    );
    setBusy(false);
  }
  async function undo() {
    const ok = await confirm(
      `Every ${terms.castaway} goes back, free-agency moves included, and the waiver order is put back. Claims reopen, and process when you say, or when Episode ${n} airs at the latest.`,
      { title: "Undo last waiver run?", confirmLabel: "Undo waiver run", danger: true },
    );
    if (!ok) return;
    setBusy(true);
    await mutate(
      () => {},
      () => api.undoWaiverRun(leagueId!),
    );
    setBusy(false);
  }

  if (!period) {
    if (!canOpen) return null;
    return (
      <section className="flex flex-col gap-2.5">
        <SectionHead>Commissioner tools</SectionHead>
        <div className="flex flex-col rounded-[3px] border border-border bg-card px-3.5 [&>*:last-child]:border-b-0">{openRow}</div>
      </section>
    );
  }

  if (period.phase === "open") {
    const humans = players.filter((p) => !p.automated && p.id !== me);
    const bots = players.filter((p) => p.automated);
    const inCount = players.filter((p) => p.automated || period.claimsIn.includes(p.id)).length;
    return (
      <section className="flex flex-col gap-2.5">
        <SectionHead>Commissioner tools</SectionHead>
        <div className="flex flex-col rounded-[3px] border border-border bg-card px-3.5">
          {openRow}
          <div className="flex flex-col gap-3 border-b border-border py-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold leading-[1.3]">{period.hold ? "Claims are on hold" : `Claims due ${when(period.processAt, now)}`}</span>
              <span className="text-[13px] leading-[1.35] text-muted-foreground">
                {period.hold
                  ? `Since you undid the last run, they process when you say${period.closesAt ? `, or when Episode ${n} airs` : ""}.`
                  : `Then free agency ${period.closesAt ? `until Episode ${n} airs` : `until Episode ${n}'s results`}${timeLeft(period.processAt, now) ? ` · ${timeLeft(period.processAt, now)}` : ""}`}
              </span>
            </span>
            <PlainButton onClick={processNow} disabled={busy} className="nav:self-start">
              Process now
            </PlainButton>
          </div>
          <div className="flex flex-col gap-0.5 border-b border-border py-3">
            <span className="font-semibold leading-[1.3]">
              Claims in: {inCount} of {players.length}
            </span>
            <span className="text-[13px] text-muted-foreground">Claims stay private, even from you.</span>
          </div>
          <ul>
            {humans.map((p) => {
              const owed = W.replacementsOwed(state, p.id, period).count;
              const swaps = W.swapsLeft(state, period, p.id);
              const has = period.claimsIn.includes(p.id);
              const can = [owed > 0 && `can replace ${owed}`, swaps > 0 && "can swap"].filter(Boolean).join(" · ");
              const actionable = owed > 0 || swaps > 0;
              // Nudge: someone with nothing in yet and an account to reach, once a week.
              const nudged = (period.nudged ?? []).includes(p.id);
              const reachable = accounts.some((a) => a.player_id === p.id);
              const canNudge = !has && reachable && !nudged && actionable;
              const btn =
                "min-h-11 shrink-0 rounded-[3px] border border-input px-3 text-sm font-bold text-foreground hover:bg-secondary focus-visible:outline-3 focus-visible:outline-chyron-line disabled:opacity-60";
              return (
                <li key={p.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2 last:border-b-0">
                  <Dot color={p.color} />
                  <span className="flex min-w-0 flex-1 basis-32 flex-col gap-0.5">
                    <span className="truncate font-semibold leading-[1.3]">{p.name}</span>
                    <span className="text-[13px] leading-[1.3] text-muted-foreground">
                      {has ? "Claims in" : `No claim yet${can ? ` · ${can}` : ""}${nudged ? " · nudged" : ""}`}
                    </span>
                  </span>
                  {actionable && (
                    // Two buttons don't fit beside a name on a phone: their own line, under the name.
                    <span className={cn("flex shrink-0 gap-2", canNudge && "ml-5 basis-full nav:ml-0 nav:basis-auto")}>
                      {canNudge && (
                        <button type="button" onClick={() => nudge(p)} disabled={busy} className={btn}>
                          Nudge
                        </button>
                      )}
                      <button type="button" onClick={() => setClaimFor(p)} className={btn}>
                        Claim for {p.name.split(" ")[0]}
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
            {bots.map((p) => (
              <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-b-0">
                <Dot color={p.color} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold leading-[1.3]">{p.name}</span>
                  <span className="text-[13px] leading-[1.3] text-muted-foreground">Computer player · makes its own claims</span>
                </span>
                <Chip tone="good">Claims in</Chip>
              </li>
            ))}
          </ul>
        </div>
        <Note>Process now runs every claim that&rsquo;s in, at once, and opens free agency early. Nudge sends one reminder.</Note>
        <ClaimForSheet state={state} period={period} player={claimFor} onClose={() => setClaimFor(null)} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead>Commissioner tools</SectionHead>
      <div className="flex flex-col gap-3 rounded-[3px] border border-border bg-card px-3.5 py-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold leading-[1.3]">Free agency is open</span>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">
            {period.closesAt ? `Until Episode ${n} airs, ${when(period.closesAt, now)}` : `Until Episode ${n}'s results`}
            {timeLeft(period.closesAt, now) ? ` · ${timeLeft(period.closesAt, now)}` : ""}
          </span>
        </span>
        <PlainButton danger onClick={undo} disabled={busy} className="nav:self-start">
          Undo last waiver run
        </PlainButton>
      </div>
      <Note>Undo puts every {terms.castaway} back and reopens claims, for when results were applied by mistake.</Note>
    </section>
  );
}

// Which of a player's spots to claim for them: each one they may replace, and (with a swap left) each
// castaway still in. Saving one spot never touches the rest (waivers.js saveClaim's `spot`).
function ClaimForSheet({ state, period, player, onClose }: { state: LeagueState; period: WaiverPeriod; player: Player | null; onClose: () => void }) {
  const router = useRouter();
  const base = useWaiversBase();
  const name = useCastNames(state);
  const W = StateLogic.WaiverLogic;
  const owed = player ? W.replacementsOwed(state, player.id, period) : { lossIds: [] as string[] };
  const swaps = player ? W.swapsLeft(state, period, player.id) : 0;
  const team = player ? state.castaways.filter((c) => c.status === "active" && c.ownerIds.includes(player.id)) : [];
  const go = (dropId: string) => {
    onClose();
    router.push(claimHref(base, dropId, player!.id));
  };
  return (
    <BottomSheet open={!!player} onOpenChange={(o) => !o && onClose()} title={player ? `Claim for ${player.name}` : ""} description="It stays private, even from you.">
      <div className="flex flex-col">
        {owed.lossIds.map((id) => (
          <SheetAction key={id} onClick={() => go(id)}>
            Replace {name(id)}
          </SheetAction>
        ))}
        {swaps > 0 &&
          team.map((c) => (
            <SheetAction key={c.id} onClick={() => go(c.id)}>
              Swap {name(c.id)}
            </SheetAction>
          ))}
      </div>
    </BottomSheet>
  );
}
