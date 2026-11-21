"use client";

import { useState } from "react";
import { ArrowLeftRight, CalendarClock, ChevronRight, UserPlus, X } from "lucide-react";
import { airTime } from "../clock";
import { couches, useAfterCouch, useBackstage, type Need } from "../data";
import type { ShowData } from "../screens/show-space";
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

/** The jobs a runner still does by hand: a game's setup, someone asking to join, and (Settings Round 3b) a waiver window that's due. */
export const RUNNER_JOBS = new Set<Need["id"]>(["draft", "invite", "request", "waivers"]);

/** A game's Manage this game over Games you run, opened at one of its lines (`line`: the job's). */
export const manageHref = (seasonId: string, leagueId: string, line?: string) =>
  `${paths.backstage(seasonId)}?page=game-settings&game=${leagueId}&from=games${line ? `&line=${line}` : ""}`;

/** A waiver job's words: "Waivers close Tue 7 PM · 3 of 5 picked", or "2 teams are short · Open a waiver window". */
export function waiverJobWords(need: Need): { title: string; detail: string } {
  const w = need.waivers;
  if (!w) return { title: need.title, detail: need.detail };
  const game = need.title.replace(/^Waivers close in /, "");
  if (w.kind === "closing") return { title: `Waivers close ${w.due ? airTime(Date.parse(w.due)) : "soon"}`, detail: `${w.picked} of ${w.of} picked · ${game}` };
  return { title: need.title, detail: need.detail };
}

export function JobRow({ seasonId, couchId, need }: { seasonId: string; couchId: string | null; need: Need }) {
  if (need.id === "request") return <RequestJob couchId={couchId} need={need} />;
  if (need.id === "invite") return <InviteJob couchId={couchId} need={need} />;
  if (need.id === "waivers") return <WaiverNeedJob seasonId={seasonId} need={need} />;
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

/** A waiver window that's due (Settings Round 3b): it opens the game's Replacing people who leave in place, where the week is run. */
function WaiverNeedJob({ seasonId, need }: { seasonId: string; need: Need }) {
  const w = waiverJobWords(need);
  return (
    <NavLink href={manageHref(seasonId, need.leagueId!, "waivers")} data-job="waivers" data-waiver-job={need.waivers?.kind} className="nd-press flex min-h-[72px] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
      <span className="grid size-12 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
        <ArrowLeftRight className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] leading-tight">{w.title}</b>
        <small className="block text-[13px] text-muted-foreground">{w.detail}</small>
      </span>
      <span className="text-[15px] font-bold text-chyron-line">{need.waivers?.kind === "closing" ? "See picks" : "Open"}</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/**
 * A runner's job under the strip (Settings Round 3b, BACKLOG 157; PFD R2 and R5): one quiet line, never a second yellow, only while
 * a job is really theirs to do now (someone asking to join, a waiver window that's due; a draft to start is the strip's own move
 * already). It names the game, the job, and "+N more" past one; a tap opens that game's Manage this game at the job.
 */
export function RunnerLine({ show }: { show: ShowData }) {
  const seasonId = show.header?.seasonId ?? "";
  const runs = show.runs.length > 0 && !!show.couch;
  const bs = useBackstage(seasonId, show.couch?.id ?? null, null, { enabled: runs });
  if (!runs) return null;
  const jobs = (bs.data?.needs ?? []).filter((n) => (n.id === "request" || n.id === "waivers") && n.leagueId);
  if (!jobs.length) return null;
  const job = jobs[0];
  const game = show.games.find((g) => g.leagueId === job.leagueId);
  // The game is the caption's: the title is the job alone (the check's fix: one name for the game, never two).
  const words = job.id === "waivers" ? waiverJobWords(job) : { title: job.request ? `${job.request.name} asked to join` : job.title, detail: job.detail };
  const more = jobs.length - 1;
  return (
    <section className="px-3 pt-1.5" data-runner-line={job.id}>
      <NavLink href={manageHref(seasonId, job.leagueId!, job.id === "waivers" ? "waivers" : undefined)} className="nd-press flex min-h-12 items-center gap-2.5 rounded-[3px] bg-card px-3 py-1.5 outline-1 -outline-offset-1 outline-border">
        <span className="min-w-0 flex-1">
          <span className="type-caption block truncate text-[12px] tracking-[0.05em] text-muted-foreground">You run {game?.name ?? "this game"}{more > 0 ? ` · +${more} more` : ""}</span>
          <b className="block text-pretty text-[15px] font-semibold leading-snug">{words.title}</b>
        </span>
        <span className="flex flex-none items-center gap-0.5 text-[14px] font-bold">
          {job.id === "request" ? "Let in" : job.waivers?.kind === "closing" ? "See picks" : "Open"}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </NavLink>
    </section>
  );
}
