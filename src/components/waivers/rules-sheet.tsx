"use client";

import { useState, type ReactNode } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AsideLink } from "./waivers-ui";
import { addDropEpisodes, andList } from "./waivers-model";

// "How waivers work" (the canvas's board 7): the week in five steps, then the rules as plain
// questions -- written from this league's own settings, so it never describes a rule the league
// doesn't play by. The same text is League Settings › Waivers' preview of what players see.

/** The link that opens the sheet, for a section heading's right-hand side. */
export function HowWaiversWork({ label = "How waivers work" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AsideLink onClick={() => setOpen(true)}>{label}</AsideLink>
      <RulesSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function RulesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const leagueName = useLeagueStore((s) => s.leagueName);
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="How waivers work"
      description={leagueName ? `${leagueName}'s rules` : undefined}
      hideCancel
      focusSheet
      footer={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-3 min-h-12 w-full rounded-[3px] bg-plate text-[15px] font-bold text-plate-foreground shadow-plate focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
        >
          Done
        </button>
      }
    >
      <RulesContent />
    </BottomSheet>
  );
}

/** The weekday and time an episode of this season airs, from its schedule: "Wed 8:00 PM". */
function airSlot(state: LeagueState): Date | null {
  const aired = state.episodes.filter((e) => e.airsAt).sort((a, b) => a.number - b.number);
  const next = aired.find((e) => Date.parse(e.airsAt!) > Date.now()) ?? aired[aired.length - 1];
  return next ? new Date(next.airsAt!) : null;
}
const slot = (d: Date) => `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;

export function RulesContent() {
  const state = useLeagueStore((s) => s.state);
  const accounts = useLeagueStore((s) => s.playerAccounts);
  const terms = useShowTerms();
  const W = StateLogic.WaiverLogic;
  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const pickups = StateLogic.replenishAvailable(state);
  const addDrops = StateLogic.tradeAvailable(state);
  const fa = W.freeAgencyOn(state);
  const H = W.processHours(state);
  const shared = state.settings.ownershipMode === "shared";
  const orderBy = state.settings.replenishOrderBy || "rolling";
  const catchUp = Number.isInteger(state.settings.revealedThroughEpisode);
  const air = catchUp ? null : airSlot(state);
  const process = air ? new Date(air.getTime() - H * 3_600_000) : null;
  const before = H === 24 ? "a day" : H === 48 ? "two days" : `${H} hours`;
  const commish = accounts.find((a) => a.role === "commissioner");
  const commishName = commish ? StateLogic.getPlayer(state, commish.player_id)?.name : null;
  const weeks = addDropEpisodes(state);
  const replenishAt = StateLogic.MidSeasonLogic.replenishAt(state);

  const steps: { when: string; title: string; text: ReactNode }[] = [
    {
      when: air ? slot(air) : "When an episode airs",
      title: "An episode airs",
      text: fa ? "Free agency closes the moment it starts." : "Anything you haven't claimed by then waits for next week.",
    },
    {
      when: catchUp ? "When it's unlocked" : "Usually the next day",
      title: "Results are in, and waivers open",
      text: (
        <>
          Once {commishName ?? "your commissioner"} applies the results.{" "}
          Reveal the episode to see what&rsquo;s yours to do.
        </>
      ),
    },
    {
      when: process ? `Until ${slot(process)}` : `For ${H} hours`,
      title: "Make your claims, in private",
      text: shared
        ? "Choose who you want. Change your mind as often as you like. Nobody sees anyone else's claims."
        : "Claim up to three, in order. Change them as often as you like. Nobody sees anyone else's claims.",
    },
    {
      when: process ? `${slot(process)}, ${before} before the next episode` : `${H} hours after waivers open`,
      title: "Waivers process, all at once",
      text: shared
        ? "Everyone gets who they claimed: in this league nobody's taken off the board."
        : pickups && addDrops
          ? "Pickups first, then add/drops, each in waiver order."
          : "Every claim, in waiver order.",
    },
  ];
  if (fa) {
    steps.push({
      when: air ? `Until ${slot(air)}` : "Until the next episode's results",
      title: "Free agency",
      text: `Anyone still free${addDrops ? ", including whoever was just dropped," : ""} is first come, first served.${
        addDrops ? " Use an add/drop you haven't spent" : ""
      }${pickups ? `${addDrops ? ", or fill" : " Fill"} a pickup your claims missed` : ""}${pickups || addDrops ? "." : ""}`,
    });
  }

  const qa: [string, ReactNode][] = [];
  if (pickups) {
    qa.push([
      "When do I get a pickup?",
      activeRoster
        ? `When your roster is down to ${replenishAt} ${terms.castaways} still in the game, you pick up enough free agents to get back to ${replenishAt + 1}. Each one replaces one of yours who's out.`
        : `Every time one of your ${terms.castaways} leaves the game, you pick up one free agent to replace them. Not when the winner is crowned.`,
    ]);
    if (!activeRoster) {
      qa.push([
        "What happens to their points?",
        "They come off your total, and your pickup counts in full, as if they'd been yours all season. Someone still in is always worth more than someone out.",
      ]);
    }
  }
  if (addDrops) {
    qa.push([
      "When can I add/drop?",
      <>
        After {weeks.length ? <b className="font-semibold text-foreground">Episode{weeks.length === 1 ? "" : "s"} {andList(weeks)}</b> : "every few episodes"}. Drop one {terms.castaway} who&rsquo;s still in and add a
        free agent, by waiver claim{fa ? " or in free agency" : ""}. One per add/drop week, and optional.
        {!activeRoster && " Whoever you drop takes their points with them."}
      </>,
    ]);
  }
  if (!shared) qa.push([
    "How does the waiver order work?",
    orderBy === "rolling" ? (
      <>
        <b className="font-semibold text-foreground">Rolling waivers.</b> It starts in reverse draft order. Anyone whose claim goes through drops to the
        back, so sitting a week out moves you up.
      </>
    ) : (
      `By the standings, ${orderBy === "leastPoints" ? "fewest" : "most"} points first, reset every week.`
    ),
  ]);
  qa.push([
    "What if two of us want the same one?",
    shared
      ? `You can both have them: in this league nobody's taken off the board.`
      : `Whoever's higher in the waiver order gets them, and the other gets their next choice.${pickups && addDrops ? " A pickup always beats an add/drop." : ""}`,
  ]);
  if (fa && orderBy === "rolling" && !shared) qa.push(["Does free agency cost my waiver spot?", "No. Only a claim that goes through in waivers sends you to the back."]);
  if (pickups) {
    const fallback = activeRoster ? "the free agent with the most points" : "one at random";
    qa.push([
      "What if I don't make a claim?",
      fa
        ? `For a pickup, choose from who's left in free agency. Still nobody when the episode airs and you get ${fallback}, so you're never a ${terms.castaway} short.`
        : `For a pickup, you get ${fallback} when the episode airs, so you're never a ${terms.castaway} short.`,
    ]);
  }
  qa.push([
    "What if I haven't watched the episode yet?",
    `Your claims wait until you reveal it, since being owed a pickup would give away who left. Not revealed in time: any pickup you're owed is assigned when the next episode airs${
      addDrops ? ", there's no add/drop for you that week" : ""
    }${shared ? "" : ", and you move up the waiver order"}.`,
  ]);
  qa.push(["Can I trade with another player?", "Not yet. Add/drops are with free agents only."]);
  qa.push(["Can I see other people's claims?", "No. Once claims process you'll see every transaction, and why."]);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <h3 className="type-caption mt-1 text-[19px] text-muted-foreground">Every week</h3>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 border-b border-border py-3 last:border-b-0">
            <span className="type-num flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-[19px]">{i + 1}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-chyron-line">{s.when}</span>
              <span className="font-semibold leading-[1.3]">{s.title}</span>
              <span className="text-sm leading-[1.4] text-muted-foreground">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <h3 className="type-caption mt-2 text-[19px] text-muted-foreground">The rules</h3>
      <dl className="flex flex-col">
        {qa.map(([q, a]) => (
          <div key={q} className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
            <dt className="font-semibold leading-[1.3]">{q}</dt>
            <dd className="text-sm leading-[1.45] text-muted-foreground">{a}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13px] text-muted-foreground">
        {commishName ? `${commishName}, your commissioner,` : "Your commissioner"} sets these in League Settings › Waivers.
      </p>
    </div>
  );
}
