"use client";

import { useState } from "react";
import { CalendarClock, ChevronRight, UserPlus, X } from "lucide-react";
import { couches, useAfterCouch, type Need } from "../data";
import { openCouchSheet } from "../couch/couch-sheets";
import { Avatar } from "../ui/bars";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";

// A runner's jobs (Backstage's Needs you until settings Round 3a; docs/design-round/settings-r3-spec.md, "Needs you"): someone
// asking to join (Let in, or decline quietly), a game with nobody to play against yet (your code for the couch), a draft to set
// up. Shown on each game's Manage this game and on Games you run. Results aren't a runner's job any more: the bot settles every
// season (C30), and a runner's fix lives on the episode's page.

/** The jobs a runner still does by hand: a game's setup and someone asking to join. */
export const RUNNER_JOBS = new Set<Need["id"]>(["draft", "invite", "request"]);

export function JobRow({ seasonId, couchId, need }: { seasonId: string; couchId: string | null; need: Need }) {
  if (need.id === "request") return <RequestJob couchId={couchId} need={need} />;
  if (need.id === "invite") return <InviteJob couchId={couchId} need={need} />;
  return <DraftJob seasonId={seasonId} need={need} />;
}

/** Someone asking to join a game you run (step 9): their face, what they asked, Let in or decline, quietly. */
function RequestJob({ couchId, need }: { couchId: string | null; need: Need }) {
  const after = useAfterCouch();
  const [busy, setBusy] = useState(false);
  const r = need.request!;
  const answer = async (letIn: boolean) => {
    if (!couchId) return;
    setBusy(true);
    try {
      await couches.answer(couchId, r.id, letIn);
      await after();
      toast(letIn ? `${r.name} can join now. They'll pick where they start.` : "Declined quietly");
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-job="request" data-request={r.name} className="flex min-h-[72px] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
      <Avatar id={r.userId} name={r.name} size={44} />
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] leading-tight">{need.title}</b>
        <small className="block text-[13px] text-muted-foreground">{need.detail}</small>
      </span>
      <Btn tone="must" className="h-11 px-3.5" disabled={busy} data-let-in onClick={() => answer(true)}>
        Let in
      </Btn>
      <button type="button" aria-label={`Not now: decline ${r.name} quietly`} data-decline disabled={busy} onClick={() => answer(false)} className="grid size-11 flex-none place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input">
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** A game with nobody to play against yet (classic's "Invite players"): your code for the couch. */
function InviteJob({ couchId, need }: { couchId: string | null; need: Need }) {
  return (
    <button
      type="button"
      data-job="invite"
      onClick={() => couchId && openCouchSheet({ kind: "invite", couchId })}
      className="nd-press flex min-h-[72px] w-full items-center gap-3 border-t border-border py-2.5 text-left first:border-t-0"
    >
      <span className="grid size-12 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
        <UserPlus className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] leading-tight">{need.title}</b>
        <small className="block text-[13px] text-muted-foreground">{need.detail}</small>
      </span>
      <span className="text-[15px] font-bold text-chyron-line">Invite</span>
    </button>
  );
}

/** A draft to set up: its time, in the room (or the blind draft). */
function DraftJob({ seasonId, need }: { seasonId: string; need: Need }) {
  return (
    <NavLink
      href={`${paths.showPage(seasonId, need.draft === "blind" ? "blind" : "draft")}?game=${need.leagueId}`}
      data-job="draft"
      className="nd-press flex min-h-[72px] items-center gap-3 border-t border-border py-2.5 first:border-t-0"
    >
      <span className="grid size-12 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
        <CalendarClock className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] leading-tight">{need.title}</b>
        <small className="block text-[13px] text-muted-foreground">{need.detail}</small>
      </span>
      <span className="text-[15px] font-bold text-chyron-line">Schedule</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}
