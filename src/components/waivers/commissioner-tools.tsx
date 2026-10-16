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
import { PlainButton, SectionHead } from "@/components/draft/draft-ui";
import { Chip, Dot, Note } from "./waivers-ui";
import { lossesOf, rotation, timeLeft, useCastNames, useWaiversBase, when } from "./waivers-model";

// The commissioner's part of the Waivers page (the canvas's board 10). There's nothing to start or
// end: while waivers are open, Process now and a claim for anyone; once they've processed, Undo last
// waiver run while free agency is still on. Claims stay private from the commissioner too -- "Claim
// for Dee" writes Dee's claim without ever showing what's in it.
export function CommissionerTools({ state, period, now }: { state: LeagueState; period: WaiverPeriod; now: number }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const mutate = useMutate();
  const terms = useShowTerms();
  const [busy, setBusy] = useState(false);
  const [claimFor, setClaimFor] = useState<Player | null>(null);
  const accounts = useLeagueStore((s) => s.playerAccounts);
  const players = rotation(state);
  const n = period.episode + 1;

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

  if (period.phase === "open") {
    const humans = players.filter((p) => !p.automated && p.id !== me);
    const bots = players.filter((p) => p.automated);
    const inCount = players.filter((p) => p.automated || period.claimsIn.includes(p.id)).length;
    return (
      <section className="flex flex-col gap-2.5">
        <SectionHead>Commissioner tools</SectionHead>
        <div className="flex flex-col rounded-[3px] border border-border bg-card px-3.5">
          <div className="flex flex-col gap-3 border-b border-border py-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold leading-[1.3]">{period.hold ? "Waivers are on hold" : `Waivers process ${when(period.processAt, now)}`}</span>
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
              {inCount} of {players.length} have claims in
            </span>
            <span className="text-[13px] text-muted-foreground">Claims stay private, even from you.</span>
          </div>
          <ul>
            {humans.map((p) => {
              const owed = StateLogic.WaiverLogic.pickupsOwed(state, p.id).count;
              const has = period.claimsIn.includes(p.id);
              const can = [owed > 0 && `owed ${owed === 1 ? "a pickup" : `${owed} pickups`}`, period.addDrop && "can add/drop"].filter(Boolean).join(" · ");
              const actionable = owed > 0 || period.addDrop;
              // Nudge: someone with nothing in yet and an account to reach, once a week.
              const nudged = (period.nudged ?? []).includes(p.id);
              const reachable = accounts.some((a) => a.player_id === p.id);
              const canNudge = !has && reachable && !nudged;
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
        <ClaimForSheet state={state} player={claimFor} onClose={() => setClaimFor(null)} />
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

// Which of a player's claims to make for them. Saving one part never touches the other (waivers.js
// saveClaim), so a pickup claimed for Dee leaves an add/drop Dee made untouched.
function ClaimForSheet({ state, player, onClose }: { state: LeagueState; player: Player | null; onClose: () => void }) {
  const router = useRouter();
  const base = useWaiversBase();
  const name = useCastNames(state);
  const period = StateLogic.WaiverLogic.current(state);
  const owed = player ? StateLogic.WaiverLogic.pickupsOwed(state, player.id) : { count: 0, lossIds: [] };
  const go = (path: string) => {
    onClose();
    router.push(`${base}/${path}?for=${encodeURIComponent(player!.id)}`);
  };
  return (
    <BottomSheet
      open={!!player}
      onOpenChange={(o) => !o && onClose()}
      title={player ? `Claim for ${player.name}` : ""}
      description="It stays private, even from you."
    >
      <div className="flex flex-col">
        {owed.count > 0 && (
          <SheetAction onClick={() => go("pickup")}>Pickup · replace {lossesOf(state, owed.lossIds).map((c) => name(c.id)).join(" and ")}</SheetAction>
        )}
        {period?.addDrop && <SheetAction onClick={() => go("add-drop")}>Add/drop</SheetAction>}
      </div>
    </BottomSheet>
  );
}
