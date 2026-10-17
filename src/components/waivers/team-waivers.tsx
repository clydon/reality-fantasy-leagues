"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CaptionPlate, type CaptionTone } from "@/components/ui/caption-plate";
import { SectionHead } from "@/components/draft/draft-ui";
import { ShuffleIcon } from "@/components/icons";
import { cn } from "cn";
import { unreplaced } from "./claim-screen";
import { WhenMovesHappen } from "./when-moves-happen";
import { andList, isShared, ordinal, placeInLine, useCastNames, useNow, viewerWeek, when } from "./waivers-model";
import { FEEL_LABEL, ORDER_LABEL, deadlineWords, swapPhrase } from "./waivers-words";

// Waivers on Team (Classic) and Lineup (Active Roster), docs/PLAN-league-tabs.md: Waivers isn't a tab,
// it's linked off slot 4. Two pieces around the team: a status banner on top, in the alert strip's
// place (the strip would only repeat it), and a Waivers section under the team: the way in to the
// Waivers page (unchanged), When moves happen, and "How it works here", the league's settings in
// plain words, only the ones it has on. With waivers off, neither shows and Team is just your team.

type Name = (id: string | null | undefined) => string;

export interface TeamBanner {
  tag: string;
  tone: CaptionTone;
  title: string;
  subtitle: string;
}

const orList = (items: string[]) => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);

/** The swaps you have left this week, as "Swap 1" / "Swap up to 2" / "Swap any" ("" for none). */
function swapsNow(state: LeagueState, w: ReturnType<typeof viewerWeek>): string {
  const R = StateLogic.rosterSize(state);
  return w.swapsLeft > 0 ? swapPhrase(w.swapsAllowed >= R ? R : w.swapsLeft, R) : "";
}

/**
 * What Team's banner says, or null when there's nothing to do (or waivers are off). Pure, so the alert
 * strip can stand aside on the same rule. Read from the viewer's own copy of the league: a week opened
 * by an episode they haven't revealed shows nothing, since who you can replace would say who left.
 *   short, window open:          WINDOW OPEN · "You're short: replace Jenna and Patt" · "Swap 1 · due Sat 1:33 PM"
 *   short, some of them:         "You're short: replace 1 of 3" · "Jenna, Patt or Rob · Swap 1 · due …"
 *   short, no window needed:     REPLACE, the same title
 *   short, after claims:         REPLACE · "Free agency until …"
 *   short, waiting for a window: quiet WAITING · "You're short" · "Replacements wait for the next waiver window"
 *   not short, swaps open:       WINDOW OPEN · "Swap 1 by Tue 8:05 PM" · "Optional: trade someone still in for someone free"
 * A claim that's in is a job done: no banner (the way in says it's in).
 */
export function teamBanner(state: LeagueState, me: string | null, now: number, name: Name): TeamBanner | null {
  const W = StateLogic.WaiverLogic;
  if (!me || !W.enabled(state)) return null;
  const w = viewerWeek(state, me);
  const p = w.period;
  if (!w.inRotation || w.stage === "hidden") return null;
  const { count, outIds } = w.owed;
  const names = outIds.map((id) => name(id));
  const swap = swapsNow(state, w);
  const due = p?.hold ? "due when your commissioner says" : `due ${when(p?.processAt, now)}`;
  const all = count >= outIds.length;
  const short = `You're short: ${all ? `replace ${andList(names)}` : `replace ${count} of ${outIds.length}`}`;

  if (p && w.stage === "open" && count > 0) {
    if (w.claimIn) return null;
    return {
      tag: W.isWindow(p) ? "Window open" : "Replace",
      tone: "chyron",
      title: short,
      subtitle: [all ? null : orList(names), swap || null, due].filter(Boolean).join(" · "),
    };
  }
  if (p && w.stage === "processed" && count > 0 && W.freeAgencyOn(state)) {
    return { tag: "Replace", tone: "chyron", title: short, subtitle: `Free agency until ${p.closesAt ? when(p.closesAt, now) : `Episode ${p.episode + 1}'s results`}` };
  }
  if (count === 0 && W.replaceRule(state) === "windows" && unreplaced(state, me).length > 0) {
    return { tag: "Waiting", tone: "quiet", title: "You're short", subtitle: "Replacements wait for the next waiver window" };
  }
  if (p && w.stage === "open" && swap && !w.claimIn) {
    return { tag: "Window open", tone: "chyron", title: `${swap} ${due.replace(/^due/, "by")}`, subtitle: "Optional: trade someone still in for someone free" };
  }
  return null;
}

/** Team's banner, in the alert strip's slot. Tapping it opens Waivers. */
export function TeamWaiverBanner() {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const now = useNow();
  const name = useCastNames(state);
  const b = teamBanner(state, me, now, name);
  if (!b) return null;
  return (
    <CaptionPlate
      size="sm"
      wrap
      tag={b.tag}
      tone={b.tone}
      title={b.title}
      subtitle={b.subtitle}
      action={<span className="sr-only">Open Waivers</span>}
      href="/waivers"
    />
  );
}

/** The Waivers section under the team: the way in, When moves happen, How it works here. */
export function TeamWaiversSection() {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const now = useNow();
  if (!StateLogic.WaiverLogic.enabled(state)) return null;
  const feel = StateLogic.WaiverLogic.config(state).waiverFeel as keyof typeof FEEL_LABEL;
  return (
    <section className="flex flex-col gap-3">
      <SectionHead
        aside={
          FEEL_LABEL[feel] && (
            <span className="mb-2 rounded-[2px] bg-quiet-tag px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-quiet-tag-foreground">{FEEL_LABEL[feel]}</span>
          )
        }
      >
        Waivers
      </SectionHead>
      <WayIn state={state} me={me} now={now} />
      <WhenMovesHappen state={state} compact />
      <HowItWorksHere state={state} me={me} />
    </section>
  );
}

// The way in: the secondary button carrying an index row's content. "Waivers open" with the waiting
// dot and what you can do, by when, in chyron-line while a window's open or you're short; otherwise
// plain "Waivers" and what's there.
function WayIn({ state, me, now }: { state: LeagueState; me: string | null; now: number }) {
  const W = StateLogic.WaiverLogic;
  const w = viewerWeek(state, me);
  const p = w.period;
  const swap = swapsNow(state, w);
  const due = p?.hold ? "due when your commissioner says" : `due ${when(p?.processAt, now)}`;
  let value: string | null = null;
  if (p && w.stage === "open" && (w.owed.count > 0 || swap)) {
    value = w.claimIn ? `Claim in · change until ${when(p.processAt, now)}` : [w.owed.count ? `Replace ${w.owed.count}` : null, swap || null, due].filter(Boolean).join(" · ");
  } else if (p && w.stage === "processed" && w.owed.count > 0 && W.freeAgencyOn(state)) {
    value = `Replace ${w.owed.count} · free agency until ${p.closesAt ? when(p.closesAt, now) : `Episode ${p.episode + 1}'s results`}`;
  }
  const open = !!value;
  return (
    <Link
      href="/waivers"
      data-tour="team-waivers"
      className="flex min-h-[60px] items-center gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-foreground outline-none transition-colors hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
    >
      <ShuffleIcon className="size-[22px] shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-base font-semibold">
          {open ? "Waivers open" : "Waivers"}
          {open && !w.claimIn && <span className="size-2 shrink-0 rounded-full bg-chyron-line" aria-label="Waiting on you" />}
        </span>
        <span className={cn("truncate text-[13px]", open && !w.claimIn ? "font-semibold text-chyron-line" : "text-muted-foreground")}>
          {value ?? "Past waivers and how it works"}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
    </Link>
  );
}

/** The league's waiver settings in plain words (waivers-words.ts), only the rows it has on. */
export function waiverRows(state: LeagueState, me: string | null, castaway: string): [string, string, string?][] {
  const W = StateLogic.WaiverLogic;
  const rule = W.replaceRule(state);
  const win = W.windows(state);
  const R = StateLogic.rosterSize(state);
  const rows: [string, string, string?][] = [];
  if (rule === "always") rows.push(["Lose someone", "Replace them after the episode"]);
  if (rule === "whenShort") {
    const N = W.shortAt(state);
    const inGame = me ? StateLogic.MidSeasonLogic.inGameCount(state, me) : null;
    const lost = me ? unreplaced(state, me).length : 0;
    const detail =
      inGame == null ? undefined : inGame <= N && lost > 0 ? `You're at ${inGame}: replace ${Math.min(lost, N + 1 - inGame)}` : `You have ${inGame} still in`;
    rows.push(["Lose someone", `Replace them once you're down to ${N} still in`, detail]);
  }
  if (rule === "windows") rows.push(["Lose someone", "They wait for a waiver window"]);
  if (win.swaps > 0) {
    const s = swapPhrase(win.swaps, R);
    const when = win.schedule === "everyEpisode" ? `${s} after any episode` : win.schedule === "manual" ? `${s} when the commissioner opens a window` : `${s} every ${win.every} episodes`;
    rows.push(["Swaps", when, "Trade someone still in for someone free"]);
  } else if (rule === "windows") {
    rows.push(["Windows", win.schedule === "everyEpisode" ? "After every episode" : win.schedule === "manual" ? "When the commissioner opens one" : `Every ${win.every} episodes`]);
  }
  const pos = placeInLine(state, me);
  const order = ORDER_LABEL[state.settings.replenishOrderBy || "rolling"] ?? "Rolling";
  rows.push([
    "Claims",
    `Due ${deadlineWords(W.processHours(state))} before the episode`,
    isShared(state) ? `Everyone can claim the same ${castaway}` : pos ? `${order} order: you're ${ordinal(pos)} in line` : `${order} order`,
  ]);
  if (rule !== "never") rows.push(["Miss a claim", W.autoFillOn(state) ? "We pick for you" : "You play short"]);
  if (W.freeAgencyOn(state)) rows.push(["After claims", "Free agency until airtime"]);
  return rows;
}

function HowItWorksHere({ state, me }: { state: LeagueState; me: string | null }) {
  const terms = useShowTerms();
  const rows = waiverRows(state, me, terms.castaway);
  return (
    <div className="flex flex-col">
      <h4 className="type-caption pb-1 pt-1 text-[17px] tracking-[0.03em] text-muted-foreground">How it works here</h4>
      <dl className="grid grid-cols-[auto_1fr] border-b border-border [&>*]:border-t [&>*]:border-border">
        {rows.map(([k, v, d]) => (
          <div key={k} className="col-span-2 grid grid-cols-subgrid py-2.5">
            <dt className="pr-4 text-sm text-muted-foreground">{k}</dt>
            <dd className="flex min-w-0 flex-col gap-0.5 text-sm font-semibold">
              {v}
              {d && <span className="text-[13px] font-normal text-muted-foreground">{d}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
