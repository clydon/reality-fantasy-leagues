"use client";

import { useState, type ReactNode } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { AsideLink } from "./waivers-ui";
import { deadlineWords, ruleAnswers } from "./waivers-words";

// "How waivers work" (docs/PLAN-waivers-v2.md "A player learning the rules"): three short answers for
// THIS league -- when one of yours is voted out, when you can swap someone still in, who gets a free
// agent two of you want -- then the week in a few lines. Written from the league's own settings, so it
// never describes a rule the league doesn't play by. League Settings › Waivers previews the same sheet.

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
  const W = StateLogic.WaiverLogic;
  const a = ruleAnswers(state);
  const fa = W.freeAgencyOn(state);
  const H = W.processHours(state);
  const catchUp = Number.isInteger(state.settings.revealedThroughEpisode);
  const air = catchUp ? null : airSlot(state);
  const due = air ? slot(new Date(air.getTime() - H * 3_600_000)) : null;
  const replaces = W.replaceRule(state) !== "never" || W.windows(state).schedule === "manual";
  const commish = accounts.find((x) => x.role === "commissioner");
  const commishName = commish ? StateLogic.getPlayer(state, commish.player_id)?.name : null;

  const three: [string, ReactNode][] = [
    ["When one of yours is voted out", a.out],
    ["Swapping someone still in", a.swap],
    ["Who gets a free agent two of you want", a.order],
  ];
  const week: ReactNode[] = [
    <>
      Claims are due <b className="font-semibold text-foreground">{deadlineWords(H)} before</b> each episode{due ? `, ${due}` : ""}. Nobody sees anyone else&rsquo;s.
    </>,
    fa ? "Then free agency: anyone still free, first come, first served, until it airs." : null,
    replaces ? (W.autoFillOn(state) ? "No claim in for someone you can replace? They get the top free agent when the episode airs." : "No claim in for someone you can replace? You play short until you claim one.") : null,
    "Replace someone and their points stay. Swap someone and their points go with them.",
    "Haven't watched yet? Your claims wait until you reveal it: who you can replace would give it away.",
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <dl className="flex flex-col">
        {three.map(([q, ans]) => (
          <div key={q} className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
            <dt className="font-semibold leading-[1.3]">{q}</dt>
            <dd className="text-sm leading-[1.45] text-muted-foreground">{ans}</dd>
          </div>
        ))}
      </dl>
      <h3 className="type-caption mt-1 text-[19px] text-muted-foreground">Each week</h3>
      <ul className="flex flex-col gap-2 text-sm leading-[1.45] text-muted-foreground">
        {week.map((line, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-[7px] size-[5px] shrink-0 bg-muted-foreground" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="pt-1 text-[13px] text-muted-foreground">
        {commishName ? `${commishName}, your commissioner,` : "Your commissioner"} sets these in League Settings › Waivers.
      </p>
    </div>
  );
}
