"use client";

import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import type { LeagueState, WaiverClaim, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { PhotoSquare, SectionHead } from "@/components/draft/draft-ui";
import { useHiddenResults } from "@/components/results-in-banner";
import { FinalePanel } from "@/components/mid-season/finale-panel";
import { ShuffleIcon } from "@/components/icons";
import { cn } from "cn";
import { CommissionerTools } from "./commissioner-tools";
import { HowWaiversWork } from "./rules-sheet";
import {
  Chip,
  LinkRow,
  Mini,
  Note,
  OrderAfterRun,
  OrderList,
  RunResults,
  SwapGlyph,
  TxRows,
  WeekStrip,
  faTitle,
  orderSentence,
} from "./waivers-ui";
import {
  addDropEpisodes,
  andList,
  freeAgencyUntil,
  isShared,
  pickupSlots,
  lastRun,
  lossesOf,
  nextAddDropAfter,
  ordinal,
  rotation,
  thenList,
  timeLeft,
  transactions,
  useCastNames,
  useMyClaim,
  useNow,
  useWaiversBase,
  viewerWeek,
  waiverOrder,
  when,
} from "./waivers-model";

// The Waivers page (docs/PLAN-midseason-waivers.md; the "Mid-Season Moves" canvas). One page that
// follows the week: waivers open (board 1), your claims in (4), processed with free agency on (5),
// between weeks (8), and, for someone who hasn't revealed the episode that opened them, the same week
// with nothing in it that says who left (6). The commissioner's tools sit under the player's own part
// (10). Classic has it as a tab; Active Roster reaches it from Research.
export function WaiversBoard() {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const canManage = useCanManage();
  const now = useNow();
  const w = viewerWeek(state, me);
  const { claim } = useMyClaim(w.stage === "open" ? w.period : null);
  const finaleOn = StateLogic.finalePredictionsAvailable(state);

  if (!StateLogic.WaiverLogic.enabled(state)) {
    return (
      <>
        <h2 className="type-caption mb-4 text-[28px] max-nav:hidden">Waivers</h2>
        <p className="text-base text-muted-foreground">This league doesn&rsquo;t have pickups or add/drops turned on.</p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <h2 className="type-caption -mb-4 text-[28px] max-nav:hidden">Waivers</h2>
      {w.stage === "hidden" && w.period && <HiddenWeek state={state} period={w.period} me={me} now={now} />}
      {w.stage === "open" && w.period && <OpenWeek state={state} period={w.period} me={me} now={now} claim={claim} w={w} />}
      {w.stage === "processed" && w.period && <ProcessedWeek state={state} period={w.period} me={me} now={now} w={w} />}
      {w.stage === "none" && <BetweenWeeks state={state} me={me} now={now} />}
      {canManage && w.period && w.stage !== "hidden" && <CommissionerTools state={state} period={w.period} now={now} />}
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

// ---- Open: make your claims (boards 1 and 4) ----

function OpenWeek({ state, period, me, now, claim, w }: { state: LeagueState; period: WaiverPeriod; me: string | null; now: number; claim: WaiverClaim; w: Week }) {
  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const set = w.claimIn && (w.owed.count === 0 || claim.pickupIds.length > 0);
  const left = timeLeft(period.processAt, now);
  const lock = activeRoster && period.closesAt ? ` · lineups lock ${when(period.closesAt, now, true)}` : "";
  return (
    <>
      <div className="flex flex-col gap-4">
        {set ? (
          <CaptionPlate tone="good" tag="Set" title="Your claims are in" subtitle={`Change them until ${when(period.processAt, now)}${left ? ` · ${left}` : ""}`} />
        ) : (
          <CaptionPlate
            tag="Open"
            title={`Waivers after Episode ${period.episode}`}
            subtitle={period.hold ? "On hold: they process when your commissioner says" : `Waivers process ${when(period.processAt, now)}${lock || (left ? ` · ${left}` : "")}`}
          />
        )}
        <WeekStrip state={state} period={period} now={now} lock={activeRoster} />
        {!set && (
          <Note>
            Claims process {period.hold ? "when your commissioner says" : when(period.processAt, now)}
            {isShared(state) ? ", all at once: nobody's taken off the board in this league, so everyone gets who they claim" : ` in waiver order${StateLogic.replenishAvailable(state) && period.addDrop ? ", pickups first" : ""}`}.
            {StateLogic.WaiverLogic.freeAgencyOn(state) && ` Then free agency: anyone still free, first come, first served, ${freeAgencyUntil(state, period, now)}.`}
          </Note>
        )}
      </div>
      {w.inRotation && <YourClaims state={state} period={period} me={me} now={now} claim={claim} w={w} />}
      {!isShared(state) && <OrderSection state={state} period={period} me={me} />}
      <RecentTransactions state={state} me={me} />
    </>
  );
}

/** "Your claims": the pickup row, then the add/drop row, each opening its picker. */
export function YourClaims({
  state,
  period,
  me,
  now,
  claim,
  w,
  heading = true,
}: {
  state: LeagueState;
  period: WaiverPeriod;
  me: string | null;
  now: number;
  claim: WaiverClaim;
  w: Week;
  heading?: boolean;
}) {
  const base = useWaiversBase();
  const terms = useShowTerms();
  const name = useCastNames(state);
  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const losses = lossesOf(state, w.owed.lossIds);
  const max = pickupSlots(state, w.owed.count);
  const shared = isShared(state);
  const tradeOn = StateLogic.tradeAvailable(state);
  const nextAD = nextAddDropAfter(state, period.episode);
  const pickupList = claim.pickupIds.filter((id) => StateLogic.getCastaway(state, id));
  const adds = claim.addIds.filter((id) => StateLogic.getCastaway(state, id));
  // Your pickup goes first: if it lands someone your add/drop also wants, the add/drop moves on.
  const overlap = pickupList.find((id) => adds.includes(id));
  const afterOverlap = overlap ? adds.find((id) => id !== overlap && adds.indexOf(id) > adds.indexOf(overlap)) : undefined;
  const inGame = me ? StateLogic.MidSeasonLogic.inGameCount(state, me) : 0;
  const slots = activeRoster ? state.settings.activeSlots : 0;
  const rows: ReactNode[] = [];

  if (w.owed.count > 0) {
    const replace = andList(losses.map((c) => name(c.id)));
    const title = activeRoster ? `Pickup · you're down to ${inGame}` : `Pickup · replace ${replace}`;
    rows.push(
      pickupList.length ? (
        <LinkRow
          key="pickup"
          href={`${base}/pickup`}
          title={title}
          detail={
            <span className="flex items-center gap-1.5 pt-1">
              {pickupList.map((id, i) => (
                <Mini key={id} c={StateLogic.getCastaway(state, id)} n={shared ? undefined : i + 1} />
              ))}
              <span className="ml-1.5 min-w-0 leading-tight">{thenList(pickupList.map(name))}</span>
            </span>
          }
          end={<span className="text-[13px] text-muted-foreground">Edit</span>}
        />
      ) : (
        <LinkRow
          key="pickup"
          href={`${base}/pickup`}
          tour="waivers-pickup"
          lead={losses[0] ? <PhotoSquare castaway={losses[0]} size={46} faded /> : undefined}
          title={title}
          detail={
            activeRoster
              ? `Pick up ${w.owed.count} to fill all ${slots} starting spots`
              : shared
                ? `Choose who replaces ${replace}`
                : `Claim up to ${max}, in order${w.owed.count > 1 ? `: you get ${w.owed.count}` : ""}`
          }
          hot
          end={<span className="size-2 shrink-0 rounded-full bg-chyron" aria-label="Needs you" />}
        />
      ),
    );
  }
  if (period.addDrop && tradeOn) {
    rows.push(
      claim.dropId && adds.length ? (
        <LinkRow
          key="ad"
          href={`${base}/add-drop`}
          title="Add/drop"
          detail={
            <span className="flex items-center gap-1.5 pt-1">
              <Mini c={StateLogic.getCastaway(state, claim.dropId)} drop />
              <span aria-hidden className="text-muted-foreground">→</span>
              {adds.map((id, i) => (
                <Mini key={id} c={StateLogic.getCastaway(state, id)} n={shared ? undefined : i + 1} />
              ))}
              <span className="ml-1.5 min-w-0 leading-tight">
                {name(claim.dropId)} for {thenList(adds.map(name))}
              </span>
            </span>
          }
          end={<span className="text-[13px] text-muted-foreground">Edit</span>}
        />
      ) : (
        <LinkRow
          key="ad"
          href={`${base}/add-drop`}
          lead={<SwapGlyph />}
          title="Add/drop · optional"
          detail={`Drop one, add a free agent. Open this week${nextAD ? `, then after Episode ${nextAD}` : ""}.`}
          end={<span className="shrink-0 text-[13px] text-muted-foreground">Not using</span>}
        />
      ),
    );
  } else if (tradeOn && nextAD) {
    rows.push(<LinkRow key="ad" lead={<SwapGlyph />} title="Add/drops" detail={`Next after Episode ${nextAD}`} />);
  }

  const saved = pickupList.length > 0 || (!!claim.dropId && adds.length > 0);
  return (
    <section className="flex flex-col gap-2.5">
      {heading && <SectionHead aside={<HowWaiversWork />}>Your claims</SectionHead>}
      {rows.length > 0 ? (
        <div className="border-t border-border">{rows}</div>
      ) : (
        <Note>
          Nothing to claim this week: all of yours are still in{tradeOn ? ", and add/drops aren't open" : ""}.{shared ? "" : " A quiet week moves you up the waiver order."}
        </Note>
      )}
      {saved && (
        <Note>
          You&rsquo;ll see what you got when waivers process{period.hold ? "" : `, ${when(period.processAt, now)}`}.
          {overlap && ` If your pickup lands ${name(overlap)}, your add/drop goes for ${afterOverlap ? name(afterOverlap) : "nobody else, and you keep " + name(claim.dropId)}.`}
        </Note>
      )}
      {!activeRoster && w.owed.count === 0 && rows.length > 0 && StateLogic.replenishAvailable(state) && (
        <Note>No pickup for you this week: all your {terms.castaways} are still in.</Note>
      )}
    </section>
  );
}

function OrderSection({ state, period, me }: { state: LeagueState; period: WaiverPeriod; me: string | null }) {
  const ids = waiverOrder(state);
  const players = rotation(state);
  const bot = (id: string) => !!players.find((p) => p.id === id)?.automated;
  const isIn = (id: string) => bot(id) || period.claimsIn.includes(id);
  const rolling = (state.settings.replenishOrderBy || "rolling") === "rolling";
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{ids.filter(isIn).length} of {ids.length} have claims in</span>}>
        Waiver order
      </SectionHead>
      <OrderList state={state} ids={ids} me={me} chip={(id) => (isIn(id) ? <Chip tone="good">Claims in</Chip> : <Chip>Not yet</Chip>)} />
      <Note>
        Claims are private.{" "}
        {rolling
          ? "Rolling waivers: anyone whose claim goes through drops to the back, so a quiet week moves you up."
          : `Set by the standings, ${state.settings.replenishOrderBy === "leastPoints" ? "fewest" : "most"} points first.`}
      </Note>
    </section>
  );
}

function RecentTransactions({ state, me, limit = 4, footer }: { state: LeagueState; me: string | null; limit?: number; footer?: ReactNode }) {
  const tx = transactions(state).slice(0, limit);
  if (!tx.length && !footer) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHead>Transactions</SectionHead>
      <TxRows state={state} entries={tx} me={me} />
      {footer}
    </section>
  );
}

// ---- Processed: every transaction and why, then free agency (board 5) ----

function ProcessedWeek({ state, period, me, now, w }: { state: LeagueState; period: WaiverPeriod; me: string | null; now: number; w: Week }) {
  const base = useWaiversBase();
  const name = useCastNames(state);
  const run = period.run;
  const fa = StateLogic.WaiverLogic.freeAgencyOn(state);
  const mine = run?.results.filter((r) => r.playerId === me && r.outcome === "got") ?? [];
  const got = mine.map((r) => r.castawayId!).filter(Boolean);
  const justDropped = (run?.results ?? []).filter((r) => r.kind === "addDrop" && r.outcome === "got" && r.droppedCastawayId).map((r) => r.droppedCastawayId!);
  const stillFree = justDropped.filter((id) => StateLogic.getCastaway(state, id) && !(StateLogic.getCastaway(state, id)!.ownerIds.length));
  const faMoves = transactions(state).filter((tx) => tx.periodId === period.id && tx.via === "freeAgency");
  const rolling = (state.settings.replenishOrderBy || "rolling") === "rolling";
  const nextAD = nextAddDropAfter(state, period.episode);
  const canAddDrop = w.addDropOpen && !w.addDropUsed && StateLogic.tradeAvailable(state);
  const losses = lossesOf(state, w.owed.lossIds);
  // Free agency counts too: what you added since waivers processed.
  const myFa = faMoves.filter((tx) => tx.playerId === me);
  const allGot = [...got, ...myFa.map((tx) => tx.addedCastawayId)];
  const firstPhoto = allGot[0] ? castawayPhotoSrc(StateLogic.getCastaway(state, allGot[0])?.photoUrl) ?? undefined : undefined;
  const faLine = myFa.map((tx) => (tx.droppedCastawayId ? `${name(tx.addedCastawayId)} for ${name(tx.droppedCastawayId)}` : name(tx.addedCastawayId))).join(", ");

  const choices = mine.map((r) => r.choice ?? 1);
  const choiceLine =
    mine.length === 0 || isShared(state)
      ? ""
      : choices.every((c) => c === 1)
        ? mine.length === 1
          ? "Your 1st choice"
          : mine.length === 2
            ? "Both 1st choices"
            : "All 1st choices"
        : mine.map((r) => `${name(r.castawayId)}, ${ordinal(r.choice ?? 1)} choice`).join(" · ");
  const forLine = mine.filter((r) => r.droppedCastawayId).map((r) => `${name(r.castawayId)} for ${name(r.droppedCastawayId)}`).join(", ");

  return (
    <>
      <div className="flex flex-col gap-4">
        {w.inRotation && w.owed.count > 0 ? (
          <CaptionPlate
            tag="Pickup"
            image={losses[0] ? castawayPhotoSrc(losses[0].photoUrl) ?? undefined : undefined}
            title={`Replace ${andList(losses.map((c) => name(c.id)))}`}
            subtitle={fa ? `Choose from free agency ${freeAgencyUntil(state, period, now, true)}` : `One is assigned when Episode ${period.episode + 1} airs`}
            action={fa ? "Choose" : undefined}
            actionTone="chyron"
            href={fa ? `${base}/free-agency` : undefined}
          />
        ) : (
          w.inRotation && (
            <CaptionPlate
              tone={allGot.length ? "good" : "quiet"}
              tag={allGot.length ? "Yours" : "Done"}
              image={firstPhoto}
              title={allGot.length ? `You ${got.length ? "got" : "added"} ${andList(allGot.map(name))}` : "Waivers processed"}
              subtitle={
                allGot.length
                  ? [choiceLine, forLine, myFa.length && `${faLine} in free agency`].filter(Boolean).join(" · ")
                  : "No changes for you this week"
              }
            />
          )
        )}
        {fa && (
          <CaptionPlate
            size="sm"
            tone="quiet"
            tag="FA"
            title={faTitle(state, period, now)}
            subtitle={
              isShared(state)
                ? canAddDrop
                  ? "Your add/drop is unused · it happens as you tap"
                  : "Moves happen as you tap"
                : stillFree.length
                ? `${andList(stillFree.map(name))} ${stillFree.length === 1 ? "is" : "are"} back · first come`
                : canAddDrop
                  ? "Your add/drop is unused · first come"
                  : "Anyone still free · first come"
            }
            href={`${base}/free-agency`}
            action={<span className="sr-only">Open</span>}
          />
        )}
        <WeekStrip state={state} period={period} now={now} lock={!!StateLogic.getLeagueType(state).hasActiveRoster} />
      </div>

      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<HowWaiversWork label="How it works" />}>Waivers after Episode {period.episode}</SectionHead>
        <Note>
          {run?.by === "commissioner" ? "Processed early by your commissioner" : "Processed"} {when(run?.at, now)}
          {isShared(state)
            ? ": everyone got who they claimed."
            : run?.results.some((r) => r.kind === "pickup") && run.results.some((r) => r.kind === "addDrop")
              ? ": pickups first, then add/drops, in waiver order."
              : ", in waiver order."}
        </Note>
        <RunResults state={state} period={period} me={me} />
      </section>

      {faMoves.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead>In free agency</SectionHead>
          <TxRows state={state} entries={faMoves} me={me} />
        </section>
      )}

      {!isShared(state) && (
      <section className="flex flex-col gap-2.5">
        <SectionHead>Waiver order now</SectionHead>
        <OrderAfterRun state={state} period={period} me={me} />
        <Note>
          {rolling ? "Rolling waivers: everyone whose claim went through dropped to the back, in the order they processed." : "Set by the standings, recomputed every week."}
          {nextAD && nextAD !== period.episode ? ` Add/drops open again after Episode ${nextAD}.` : ""}
        </Note>
      </section>
      )}
    </>
  );
}

// ---- Not revealed: the week, and nothing in it (board 6) ----

function HiddenWeek({ state, period, me, now }: { state: LeagueState; period: WaiverPeriod; me: string | null; now: number }) {
  const { reveal } = useHiddenResults();
  const ids = waiverOrder(state);
  const mine = me ? ids.indexOf(me) + 1 : 0;
  const open = period.phase === "open";
  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const fa = StateLogic.WaiverLogic.freeAgencyOn(state);
  const n = period.episode + 1;
  return (
    <>
      <div className="flex flex-col gap-4">
        <CaptionPlate
          tone="quiet"
          tag={`Ep ${period.episode}`}
          title={open ? "Waivers are open" : "Waivers processed"}
          subtitle={open ? "Reveal it to make your claims" : "Reveal it to see them"}
          action="Reveal"
          actionTone="chyron"
          onClick={() => reveal(period.episode)}
        />
        <WeekStrip state={state} period={period} now={now} lock={activeRoster} />
      </div>
      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<HowWaiversWork />}>Your claims</SectionHead>
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
            <span className="text-sm leading-[1.4]">Hidden until you&rsquo;ve seen Episode {period.episode}. Whether you&rsquo;re owed a pickup would give it away.</span>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2.5">
        <SectionHead>If you don&rsquo;t reveal in time</SectionHead>
        <div className="border-t border-border">
          {StateLogic.replenishAvailable(state) && (
            <div className="flex min-h-14 flex-col justify-center gap-0.5 border-b border-border py-2">
              <span className="font-semibold">Any pickup you&rsquo;re owed</span>
              <span className="text-[13px] text-muted-foreground">
                {activeRoster ? "The free agent with the most points" : "A free agent at random"} when Episode {n} airs
              </span>
            </div>
          )}
          {period.addDrop && StateLogic.tradeAvailable(state) && (
            <div className="flex min-h-14 flex-col justify-center gap-0.5 border-b border-border py-2">
              <span className="font-semibold">Your add/drop</span>
              <span className="text-[13px] text-muted-foreground">None{fa ? " by waiver claim" : ""}{isShared(state) ? "" : ", and you move up the waiver order"}</span>
            </div>
          )}
        </div>
      </section>
      {!isShared(state) && (
        <section className="flex flex-col gap-2.5">
          <SectionHead aside={mine > 0 && <span className="pb-1.5 text-[13px] text-muted-foreground">You&rsquo;re {ordinal(mine)} of {ids.length}</span>}>Waiver order</SectionHead>
          <Note>{orderSentence(state, ids, me)}. Who has claims in stays hidden until you reveal.</Note>
        </section>
      )}
    </>
  );
}

// ---- Between weeks: the season ahead (board 8) ----

function BetweenWeeks({ state, me, now }: { state: LeagueState; me: string | null; now: number }) {
  const base = useWaiversBase();
  const ids = waiverOrder(state);
  const mine = me ? ids.indexOf(me) + 1 : 0;
  const latest = StateLogic.SpoilerLogic.latestWithResults(state);
  const over = StateLogic.MidSeasonLogic.seasonOver(state) && latest > 0;
  const pickups = StateLogic.replenishAvailable(state);
  const start = StateLogic.startEpisode(state);
  const nextEp = latest >= start ? latest + 1 : start;
  const nextWaivers = pickups ? nextEp : nextAddDropAfter(state, nextEp - 1);
  const airs = nextWaivers ? state.episodes.find((e) => e.number === nextWaivers)?.airsAt ?? null : null;
  const run = lastRun(state);
  const rolling = (state.settings.replenishOrderBy || "rolling") === "rolling";
  const H = StateLogic.WaiverLogic.processHours(state);
  return (
    <>
      {over ? (
        <CaptionPlate tone="quiet" tag="Done" title="No more waivers this season" subtitle="Nobody's left in the game to pick up." />
      ) : (
        nextWaivers && (
          <CaptionPlate
            tone="quiet"
            tag={`Ep ${nextWaivers}`}
            title={`Next ${pickups ? "waivers" : "add/drops"} after Episode ${nextWaivers}`}
            subtitle={`${airs ? `${Date.parse(airs) <= now ? "Aired" : "Airs"} ${when(airs, now, true)} · ` : ""}waivers open with its results`}
          />
        )
      )}
      <SeasonAhead state={state} nextWaivers={nextWaivers} hours={H} />
      {!isShared(state) && (
        <section className="flex flex-col gap-2.5">
          <SectionHead aside={mine > 0 && <span className="pb-1.5 text-[13px] text-muted-foreground">You&rsquo;re {ordinal(mine)} of {ids.length}</span>}>Waiver order</SectionHead>
          <Note>
            {orderSentence(state, ids, me)}.{rolling ? " Sit a week out and you'll move up." : ""}
          </Note>
        </section>
      )}
      <RecentTransactions
        state={state}
        me={me}
        limit={3}
        footer={run && <LinkRow href={`${base}/results/${run.episode}`} title={`All of Episode ${run.episode}'s waivers, and why`} />}
      />
    </>
  );
}

function SeasonAhead({ state, nextWaivers, hours }: { state: LeagueState; nextWaivers: number | null; hours: number }) {
  const terms = useShowTerms();
  const total = state.episodes.length ? Math.max(...state.episodes.map((e) => e.number)) : 0;
  const start = StateLogic.startEpisode(state);
  const ads = addDropEpisodes(state);
  const latest = StateLogic.SpoilerLogic.latestWithResults(state);
  const pickups = StateLogic.replenishAvailable(state);
  const fa = StateLogic.WaiverLogic.freeAgencyOn(state);
  const nextAD = nextAddDropAfter(state, latest);
  const away = nextAD ? nextAD - latest : null;
  if (total < 2) return null;
  const eps = Array.from({ length: total - start + 1 }, (_, i) => start + i);
  return (
    <section className="flex flex-col gap-3">
      <SectionHead aside={<HowWaiversWork />}>The season</SectionHead>
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Episodes and add/drop weeks">
        {eps.map((n) => {
          const aired = n <= latest;
          const fin = n === total;
          const ad = ads.includes(n);
          const label = [`Episode ${n}`, ad && "add/drops", fin && "finale, no waivers after", n === nextWaivers && "next", aired && "done"].filter(Boolean).join(", ");
          return (
            <li
              key={n}
              aria-label={label}
              className={cn(
                "flex h-[58px] flex-col items-center justify-center gap-[5px] rounded-[3px] border border-border text-muted-foreground",
                aired && "border-transparent bg-card text-foreground",
                n === nextWaivers && "border-2 border-chyron-line text-foreground",
                fin && "border-dashed",
              )}
            >
              <span className="type-num text-[20px]">{n}</span>
              <span className="flex h-3.5 items-center justify-center">
                {fin ? (
                  <span className="text-[10px] font-bold tracking-[0.04em]">FINALE</span>
                ) : ad ? (
                  <ShuffleIcon className={cn("size-3.5", aired ? "text-muted-foreground" : "text-foreground")} aria-hidden />
                ) : aired ? (
                  <Check className="size-3.5 text-muted-foreground" aria-hidden />
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2 text-sm leading-[1.4]">
        {pickups && (
          <p>
            <b className="font-semibold">Pickups</b> <span className="text-muted-foreground">can follow any episode: one for each of your {terms.castaways} who leaves.</span>
          </p>
        )}
        {ads.length > 0 && (
          <p className="flex items-start gap-2.5">
            <ShuffleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <b className="font-semibold">Add/drops</b>{" "}
              <span className="text-muted-foreground">
                after Episodes {andList(ads)}.{away ? ` Next in ${away} episode${away === 1 ? "" : "s"}.` : ""}
              </span>
            </span>
          </p>
        )}
        <p className="text-muted-foreground">
          Waivers process {hours === 24 ? "a day" : `${hours} hours`} before each episode{fa ? "; free agency runs until it airs" : ""}.
        </p>
      </div>
    </section>
  );
}
