"use client";

import { Lock } from "lucide-react";
import type { LeagueState, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { SectionHead } from "@/components/draft/draft-ui";
import { useHiddenResults } from "@/components/results-in-banner";
import { FinalePanel } from "@/components/mid-season/finale-panel";
import { cn } from "cn";
import { CommissionerTools, WindowControl } from "./commissioner-tools";
import { HowWaiversWork } from "./rules-sheet";
import { YourClaims, YourTeam, claimHref, openPlate, quietPlate, unreplaced } from "./claim-screen";
import { WhenMovesHappen } from "./when-moves-happen";
import { LinkRow, Note } from "./waivers-ui";
import { andList, isShared, lastRun, ordinal, resultWhy, transactions, useCastNames, useMyClaim, useNow, useWaiversBase, viewerWeek, waiverOrder, when } from "./waivers-model";

// The Waivers page (docs/PLAN-midseason-waivers.md; docs/PLAN-waivers-v2.md "Phase 2: picked design").
// One page that follows the week: claims open (your team, then your claims grouped by spot), processed
// (what you got, then free agency), a quiet week (why there's nothing to do, and when moves happen), and,
// for someone who hasn't revealed the episode that opened the week, the same week with nothing in it
// that says who left. A commissioner gets the open window's controls first and their tools last.
export function WaiversBoard() {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const canManage = useCanManage();
  const now = useNow();
  const w = viewerWeek(state, me);
  const { claim, save } = useMyClaim(w.stage === "open" ? w.period : null);
  const name = useCastNames(state);
  const wbase = useWaiversBase();
  const finaleOn = StateLogic.finalePredictionsAvailable(state);

  if (!StateLogic.WaiverLogic.enabled(state)) {
    return (
      <>
        <h2 className="type-caption mb-4 text-[28px] max-nav:hidden">Waivers</h2>
        <p className="text-base text-muted-foreground">This league has no replacements or swaps.</p>
        {canManage && <CommissionerTools state={state} period={null} now={now} />}
      </>
    );
  }

  const period = w.period;
  return (
    <div className="flex flex-col gap-[26px]">
      <h2 className="type-caption -mb-3 text-[28px] max-nav:hidden">Waivers</h2>
      {canManage && period && w.stage === "open" && StateLogic.WaiverLogic.isWindow(period) && <WindowControl state={state} period={period} now={now} />}
      {w.stage === "hidden" && period && <HiddenWeek state={state} period={period} me={me} now={now} />}
      {w.stage === "open" && period && (w.todo && me ? (
        <>
          <CaptionPlate {...openPlate(state, period, me, w, now, name)} />
          <YourTeam
            state={state}
            me={me}
            w={w}
            claim={claim}
            href={(id) => claimHref(wbase, id)}
            joins={isShared(state) && !period.hold ? when(period.processAt, now) : undefined}
          />
          {isShared(state) ? (
            <Note className="-mt-3 text-[13px]">{StateLogic.WaiverLogic.freeAgencyOn(state) ? "Then free agency until airtime." : "Your picks join your team when claims are due."}</Note>
          ) : (
            <YourClaims state={state} period={period} me={me} w={w} claim={claim} save={save} now={now} />
          )}
          {!claim.pairs.length && !isShared(state) && <Note className="-mt-3 text-[13px]">Tap Replace or Swap to make a claim.</Note>}
        </>
      ) : (
        <Quiet state={state} me={me} />
      ))}
      {w.stage === "processed" && period && <ProcessedWeek state={state} period={period} me={me} now={now} w={w} />}
      {w.stage === "none" && <Quiet state={state} me={me} />}
      <PastWaivers state={state} joined={w.stage === "processed" && StateLogic.WaiverLogic.freeAgencyOn(state) && !w.todo} />
      {w.stage !== "hidden" && (
        <div className="-mt-4 flex justify-end">
          <HowWaiversWork />
        </div>
      )}
      {canManage && w.stage !== "hidden" && <CommissionerTools state={state} period={w.stage === "none" ? null : period} now={now} />}
      {finaleOn && (
        <section className="flex flex-col gap-2">
          <SectionHead>Finale predictions</SectionHead>
          <FinalePanel state={state} />
        </section>
      )}
    </div>
  );
}

type Week = ReturnType<typeof viewerWeek>;

// ---- A quiet week: why there's nothing to do, and when moves happen ----

function Quiet({ state, me }: { state: LeagueState; me: string | null }) {
  const name = useCastNames(state);
  return (
    <>
      <CaptionPlate size="sm" {...quietPlate(state, me, name)} />
      <WhenMovesHappen state={state} />
    </>
  );
}

/** "Past waivers · After Episode 3": every outcome of the last week that processed, and why. */
function PastWaivers({ state, joined }: { state: LeagueState; joined?: boolean }) {
  const wbase = useWaiversBase();
  const run = lastRun(state);
  if (!run) return null;
  return (
    // Joined: straight under the Free agency row, as one list.
    <div className={joined ? "-mt-[26px]" : "-mt-2 border-t border-border"}>
      <LinkRow href={`${wbase}/results/${run.episode}`} title="Past waivers" detail={`After Episode ${run.episode}: who got who, and why`} />
    </div>
  );
}

// ---- Processed: what you got, then free agency ----

function ProcessedWeek({ state, period, me, now, w }: { state: LeagueState; period: WaiverPeriod; me: string | null; now: number; w: Week }) {
  const wbase = useWaiversBase();
  const name = useCastNames(state);
  const run = period.run;
  const fa = StateLogic.WaiverLogic.freeAgencyOn(state);
  const mine = (run?.results ?? []).filter((r) => r.playerId === me);
  const got = mine.filter((r) => r.outcome === "got" && r.castawayId);
  const faMoves = transactions(state).filter((tx) => tx.periodId === period.id && tx.via === "freeAgency" && tx.playerId === me);
  const missed = mine.find((r) => r.outcome === "missed" && r.passed.length);
  const faUntil = period.closesAt ? `until ${when(period.closesAt, now)}` : `until Episode ${period.episode + 1}'s results`;
  const lost = me ? unreplaced(state, me).filter((c) => w.owed.lossIds.includes(c.id)) : [];
  const inGame = me ? StateLogic.MidSeasonLogic.inGameCount(state, me) : 0;
  const autoFill = StateLogic.WaiverLogic.autoFillOn(state);
  const pairsText = [
    ...got.map((r) => (r.droppedCastawayId ? `${name(r.castawayId)} for ${name(r.droppedCastawayId)}` : name(r.castawayId))),
    ...faMoves.map((tx) => (tx.droppedCastawayId ? `${name(tx.addedCastawayId)} for ${name(tx.droppedCastawayId)}` : name(tx.addedCastawayId))),
  ];
  const choice = got.length === 1 && !isShared(state) ? (got[0].choice ?? 1) : 0;
  const first = got[0]?.castawayId ? StateLogic.getCastaway(state, got[0].castawayId) : undefined;

  return (
    <>
      {w.inRotation && (
        <div className="flex flex-col gap-3">
          {lost.length > 0 ? (
            <CaptionPlate
              tag="Short"
              tone="quiet"
              image={castawayPhotoSrc(lost[0].photoUrl) ?? undefined}
              title={mine.some((r) => r.kind === "pickup" && r.outcome === "noClaim") ? `No claim for ${andList(lost.map((c) => name(c.id)))} went in` : `Replace ${andList(lost.map((c) => name(c.id)))}`}
              subtitle={
                fa
                  ? `Free agency ${faUntil}`
                  : autoFill
                    ? `You get the top free agent when Episode ${period.episode + 1} airs`
                    : `You're playing with ${inGame}`
              }
              action={fa ? "Choose" : undefined}
              actionTone="chyron"
              href={fa ? `${wbase}/free-agency?drop=${encodeURIComponent(lost[0].id)}` : undefined}
            />
          ) : (
            <CaptionPlate
              tone={pairsText.length ? "good" : "quiet"}
              tag={pairsText.length ? "Got" : "Done"}
              image={first ? castawayPhotoSrc(first.photoUrl) ?? undefined : undefined}
              title={pairsText.length ? pairsText.join(", ") : "Waivers processed"}
              subtitle={pairsText.length ? (choice ? (choice === 1 ? "Your first choice" : `Your ${ordinal(choice)} choice`) : isShared(state) ? "On your team now" : undefined) : "No changes for you this week"}
            />
          )}
          {/* Why a choice didn't go; free agency's deadline is on its row (or the plate) below. */}
          {missed && <p className="text-sm leading-[1.45] text-muted-foreground">{resultWhy(state, missed, me, name)}</p>}
        </div>
      )}
      {w.inRotation && me && fa && w.todo && <YourTeam state={state} me={me} w={w} href={(id) => `${wbase}/free-agency?drop=${encodeURIComponent(id)}`} heading="Free agency" />}
      {fa && !w.todo && (
        <div className="border-t border-border">
          <LinkRow href={`${wbase}/free-agency`} title="Free agency" detail={`Open ${faUntil} · first come, first served`} />
        </div>
      )}
    </>
  );
}

// ---- Not revealed: the week, and nothing in it ----

function HiddenWeek({ state, period, me, now }: { state: LeagueState; period: WaiverPeriod; me: string | null; now: number }) {
  const { reveal } = useHiddenResults();
  const ids = waiverOrder(state);
  const mine = me ? ids.indexOf(me) + 1 : 0;
  const open = period.phase === "open";
  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const fill = StateLogic.WaiverLogic.autoFillOn(state);
  return (
    <>
      <CaptionPlate
        tone="quiet"
        tag={`Ep ${period.episode}`}
        title={open ? "Waivers are open" : "Waivers processed"}
        subtitle={open ? `Reveal it to make your claims · due ${when(period.processAt, now)}` : "Reveal it to see them"}
        action="Reveal"
        actionTone="chyron"
        onClick={() => reveal(period.episode)}
      />
      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<HowWaiversWork />}>Your team</SectionHead>
        <div className="relative border-y border-border py-3.5">
          {[0, 1].map((i) => (
            <div key={i} aria-hidden className={cn("flex h-14 items-center gap-3 opacity-60 blur-[3px]", i && "mt-3")}>
              <i className="size-[46px] rounded-[3px] bg-muted" />
              <span className="flex flex-1 flex-col gap-2">
                <i className="h-3 rounded-[3px] bg-muted" style={{ width: i ? "50%" : "60%" }} />
                <i className="h-2.5 rounded-[3px] bg-muted" style={{ width: i ? "70%" : "40%" }} />
              </span>
            </div>
          ))}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-7 text-center">
            <Lock className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-sm leading-[1.4]">Hidden until you&rsquo;ve seen Episode {period.episode}. Who you can replace would give it away.</span>
          </div>
        </div>
        <Note className="text-[13px]">
          Not revealed in time?{" "}
          {StateLogic.WaiverLogic.replaceRule(state) !== "never" &&
            (fill ? `Anyone you can replace gets ${activeRoster ? "the free agent with the most points" : "a free agent"} when Episode ${period.episode + 1} airs. ` : "Anyone you can replace waits: no claim, no replacement. ")}
          {isShared(state) ? "" : "You move up the waiver order."}
        </Note>
      </section>
      {!isShared(state) && mine > 0 && <Note>You&rsquo;re {ordinal(mine)} in line.</Note>}
    </>
  );
}
