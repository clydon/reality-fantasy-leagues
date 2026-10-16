"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { YourClaims } from "./waivers-board";
import { LinkRow, WeekStrip, faTitle } from "./waivers-ui";
import { isShared, ordinal, timeLeft, useMyClaim, useNow, useWaiversBase, viewerWeek, waiverOrder, when } from "./waivers-model";

// Active Roster's way into waivers (the canvas's board 13): its tab bar is full, so Research -- where
// you decide who's worth picking up -- opens with the week's waivers, the way a fantasy app's Players
// tab holds them. The plate and your claim rows, then a row into the full Waivers page (order,
// transactions, commissioner tools). Nothing while no week is running.
export function ResearchWaivers() {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const base = useWaiversBase();
  const now = useNow();
  const w = viewerWeek(state, me);
  const { claim } = useMyClaim(w.stage === "open" ? w.period : null);
  if (!StateLogic.WaiverLogic.enabled(state) || !w.period) return null;
  const p = w.period;
  const ids = waiverOrder(state);
  const pos = me ? ids.indexOf(me) + 1 : 0;
  const lock = p.closesAt ? `lineups lock ${when(p.closesAt, now, true)}` : "";

  return (
    <section className="mb-5 flex flex-col gap-4" aria-label="Waivers">
      {w.stage === "hidden" ? (
        <CaptionPlate tone="quiet" tag={`Ep ${p.episode}`} title="Waivers are open" subtitle={`Reveal Episode ${p.episode} to make claims`} href={base} action="Waivers" />
      ) : w.stage === "open" ? (
        <CaptionPlate
          tag="Open"
          title={`Waivers after Episode ${p.episode}`}
          subtitle={[`Waivers process ${when(p.processAt, now, true)}`, lock || timeLeft(p.processAt, now)].filter(Boolean).join(" · ")}
          href={base}
        />
      ) : (
        <CaptionPlate tone="quiet" tag="FA" title={faTitle(state, p, now)} subtitle={w.owed.count ? "Your pickup is still to fill · first come" : "Waivers processed · see what everyone got"} href={base} action="See" />
      )}
      {w.stage === "open" && (
        <>
          <WeekStrip state={state} period={p} now={now} lock />
          <YourClaims state={state} period={p} me={me} now={now} claim={claim} w={w} />
        </>
      )}
      {w.stage !== "hidden" && (
        <div className="border-t border-border">
          <LinkRow href={base} title="Waivers" detail={isShared(state) ? "Everyone's moves this week" : pos ? `You're ${ordinal(pos)} of ${ids.length} in the waiver order · transactions` : "Waiver order and transactions"} />
          {w.stage === "processed" && w.owed.count > 0 && <LinkRow href={`${base}/free-agency`} title="Free agency" detail="Fill your pickup now" hot />}
          <LinkRow
            href="/lineup"
            title={`Set your Episode ${p.episode + 1} lineup`}
            detail={[w.owed.count ? "Your pickup fills the empty spot when it lands" : null, p.closesAt ? `locks ${when(p.closesAt, now, true)}` : null].filter(Boolean).join(" · ") || undefined}
          />
        </div>
      )}
    </section>
  );
}
