"use client";

import { useState } from "react";
import { answerShowChange, useAfterResults, useShowChange, type ShowChange } from "../data";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";

// Something the rulebook doesn't have, on an episode's page (docs/PLAN-new-design.md step 6c part 2; the mock's rulebook.js
// rbNewCard): research about this episode said the show changed how it's played, and anyone who plays here and has seen
// it says It's new or Not new. Counted by couch: enough couches agreeing (and more than disagree) has our bot add it to the
// season's rulebook from this episode, for every couch following it; a couch with its own copy is asked first, in Scoring
// rules. More saying it isn't puts it away; a split goes to our admin.

const TAG: Record<ShowChange["status"], [string, string]> = {
  open: ["New?", "bg-chyron text-chyron-foreground"],
  checking: ["Checking", "bg-secondary text-foreground"],
  added: ["Added", "bg-good text-background"],
  desk: ["Checking", "bg-secondary text-foreground"],
  not_new: ["Not new", "bg-secondary text-foreground"],
};

export function ShowChangeCard({ seasonId, couchId, episode, seasonName }: { seasonId: string; couchId: string | null; episode: number; seasonName: string }) {
  const q = useShowChange(seasonId, couchId, episode);
  const refresh = useAfterResults();
  const [busy, setBusy] = useState(false);
  const c = q.data?.change;
  if (!couchId || !c) return null;
  const answer = async (isNew: boolean) => {
    setBusy(true);
    try {
      const r = await answerShowChange(seasonId, couchId, episode, isNew);
      await q.refetch();
      const now = r.change;
      if (now?.status === "checking") toast("Thanks · it's being added for every couch");
      else if (!now) toast("Thanks · not new, then");
      else toast(isNew ? "Thanks · one more couch saying so adds it" : "Thanks · noted");
      if (now?.status === "added") await refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const [tag, tone] = TAG[c.status];
  return (
    <section data-show-change={episode} data-status={c.status} className="mt-[26px]">
      <div className="flex gap-3 rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-border">
        <span className={`type-caption h-fit flex-none px-2 py-0.5 text-[11px] ${tone}`}>{tag}</span>
        <div className="min-w-0 flex-1">
          <Body c={c} episode={episode} seasonName={seasonName} />
          {c.status === "open" && (
            <div className="mt-2.5 flex gap-2">
              <Btn data-show-change-new className="h-11 flex-1 text-[15px]" disabled={busy} aria-pressed={c.yours === true} onClick={() => answer(true)}>
                It&apos;s new
              </Btn>
              <Btn data-show-change-not className="h-11 flex-1 text-[15px]" disabled={busy} aria-pressed={c.yours === false} onClick={() => answer(false)}>
                Not new
              </Btn>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// The rulebook's own lines for a change ("+ New advantage: Block a Vote") without the desk's diff marks.
const plain = (summary: string) =>
  summary
    .split(" · ")
    .map((l) => l.replace(/^[+~−-]\s*/, ""))
    .join(" · ");

function Body({ c, episode, seasonName }: { c: ShowChange; episode: number; seasonName: string }) {
  // The note as research wrote it, its own sentence: no second full stop after one it already has.
  const said = (
    <>
      <q className="italic">{c.note}</q>
      {/[.!?]$/.test(c.note.trim()) ? "" : "."}
    </>
  );
  if (c.status === "added") {
    return (
      <>
        <b className="block text-[15px] leading-snug">It&apos;s in the rulebook now</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {c.added?.summary ? `${plain(c.added.summary)}. ` : ""}From Episode {c.added?.from ?? episode}, for every couch on {seasonName}. A couch with its own rulebook is asked first, in Scoring rules.
        </small>
      </>
    );
  }
  if (c.status === "checking") {
    return (
      <>
        <b className="block text-[15px] leading-snug">Adding it to the rulebook</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Couches agree it&apos;s new: our bot is working out where it goes. Nothing changes until it&apos;s in.</small>
      </>
    );
  }
  if (c.status === "desk") {
    return (
      <>
        <b className="block text-[15px] leading-snug">Our admin is checking it</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Research said: {said} Nothing changes until it&apos;s settled.</small>
      </>
    );
  }
  const more = Math.max(1, c.need - c.yes);
  const tally =
    c.yours === false && c.yes >= 1
      ? `You said it's not new. ${c.yes === 1 ? "Another couch says it is" : `${c.yes} say it is`}, so ${c.yes === c.no ? "our admin checks it" : "it's still open"}. Nothing changes until then.`
      : c.yours === true
        ? `Thanks. ${more === 1 ? "One more couch" : `${more} more couches`} saying so adds it for every couch.`
        : c.reportedHere
          ? `Your couch's research found it. ${more === 1 ? "Another couch" : `${more} more couches`} saying so adds it for every couch.`
          : c.yes
            ? `${c.yes === 1 ? "Another couch reported it" : `${c.yes} couches say so`}; ${more === 1 ? "one more yes" : `${more} more`} adds it for every couch.`
            : `${c.need} couches saying so adds it for every couch.`;
  return (
    <>
      <b className="block text-[15px] leading-snug">Something the rulebook doesn&apos;t have</b>
      <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
        This episode&apos;s research says: {said} {tally}
      </small>
    </>
  );
}
