"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { airTime } from "../clock";
import { epName, type GameLabel } from "@/lib/game/show-words";
import { gameAdmin, momentVotes, useMomentVotes, type GameSettings, type OpenVote } from "../data";
import { useAfter, useServerUndo } from "../backstage/settings";
import type { ShowData } from "../screens/show-space";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Choice } from "./choice";

// Settings Round 3b (A17, BACKLOG 230; docs/design-round/settings-r3b-spec.md, "When the show's rules change mid-season"; PFD R4
// and R5): a game's say when the show gains a moment mid-season, on Manage this game (from the start, from the next episode, or the
// players vote), each moment it gained with how it counts here; and the players' vote, a quiet line under the strip that opens a
// sheet with both answers equal, neither chosen, each saying what it does to the standings, the default named "for now".

const pts = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n * 100) / 100}`;

/** When the show adds a moment: the game's rule, and the moments it's gained (Manage this game, How it plays). */
export function NewMoments({ seasonId, couchId, g, ep, names }: { seasonId: string; couchId: string; g: GameSettings; ep: string; names?: Record<number, GameLabel> | null }) {
  const m = g.moments!;
  // A team's game by its name ("Chiefs at Bills"), else "Ep 4".
  const at = (n: number) => epName({ episode: ep, ep, names }, n, "short");
  const after = useAfter();
  const undo = useServerUndo(seasonId, couchId);
  const [busy, setBusy] = useState(false);
  const can = g.commissioner && !g.lockedDown && !g.span.over;
  const set = async (rule: "start" | "next" | "vote") => {
    if (!can || busy || (m.set && m.rule === rule)) return;
    setBusy(true);
    try {
      const r = await gameAdmin.settings(seasonId, couchId, g.leagueId, { set: { newMoments: rule }, text: `New moments in ${g.name}: ${RULES[rule].said}` });
      await after();
      toast(`Saved: new moments ${RULES[rule].said}`, undo(r.batch));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const decide = async (id: string, to: "start" | "next", name: string, from: number) => {
    setBusy(true);
    try {
      const r = await momentVotes.decide(seasonId, couchId, g.leagueId, id, to);
      await after();
      toast(to === "start" ? `"${name}" counts from the start` : `"${name}" counts from ${at(from)}`, undo(r.batch));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-settings="moments" className="flex flex-col gap-2 pb-2">
      <p className="text-[14px] leading-snug text-muted-foreground">When the show gets a moment its rules didn&apos;t have. A fix to a moment it had always counts as the results say.</p>
      {(["start", "next", "vote"] as const).map((k) => (
        <Choice
          key={k}
          data={`moments-${k}`}
          title={RULES[k].title}
          line={RULES[k].line(ep)}
          recommended={k === m.rec}
          chosen={m.rule === k}
          why={can ? null : g.commissioner ? (g.lockedDown ? "Frozen for the season" : "It's over") : "The Commissioner's to change"}
          onPick={() => void set(k)}
        />
      ))}
      {/* The check's fix: Recommended says why (the show's first season here, or a format it knows). */}
      <p data-moments-why className="text-[13px] leading-snug text-muted-foreground">
        Recommended {m.rec === "start" ? "from the start: this show's rules are still settling (its first season here, or its seasons differ)" : "from the next episode: the app knows this show's format season to season"}.
      </p>
      {m.added.length > 0 && (
        <div data-moments-added className="mt-2">
          <p className="type-caption pb-1.5 text-[13px] tracking-[0.05em] text-muted-foreground">New this season</p>
          {m.added.map((a) => {
            const now = a.settled ? (a.settled.to === "start" ? "Counts from the start" : `Counts from ${at(a.from)}`) : a.rule === "vote" ? `Counts from ${at(a.from)} for now · the players are voting` : `Counts from ${at(a.from)}`;
            const how = a.settled
              ? a.settled.by === "vote"
                ? ` · the players voted ${Math.max(a.settled.start ?? 0, a.settled.next ?? 0)}–${Math.min(a.settled.start ?? 0, a.settled.next ?? 0)}`
                : a.settled.by === "nobody"
                  ? " · nobody voted"
                  : ""
              : a.tally
                ? ` · ${a.tally.start + a.tally.next} of ${a.tally.of} voted${a.tally.tie ? ", tied: your call" : ""}`
                : "";
            // The Commissioner's call (the check's fix): only where it's theirs, a tie in the vote or a moment the game's rule placed;
            // never over an open vote, which the players settle.
            const open = !a.settled && g.commissioner && can && (a.rule === "next" || !!a.tally?.tie);
            return (
              <div key={a.id} data-moment-added={a.id} className="border-t border-border py-2.5 first:border-t-0">
                <b className="block text-[15px] font-semibold leading-snug">
                  {a.name} <span className="type-num font-normal text-muted-foreground">{pts(a.points)}</span>
                </b>
                <small className="block text-[13px] leading-snug text-muted-foreground">
                  {now}
                  {how}
                </small>
                {open && (
                  <div data-moment-call className="mt-2 flex flex-col gap-1.5">
                    <p className="text-[13px] font-semibold">{a.tally?.tie ? "The vote tied. Your call:" : "Your call, if the couch wants it different:"}</p>
                    <Choice data="moment-start" dataset={{ "data-moment-decide": "start" }} title="Count it from the start" line={`Scores it in the ${ep}s already played too.`} chosen={false} onPick={() => !busy && void decide(a.id, "start", a.name, a.from)} />
                    <Choice data="moment-next" dataset={{ "data-moment-decide": "next" }} title={`Keep it from ${at(a.from)}`} line="Nothing already played changes." chosen={false} onPick={() => !busy && void decide(a.id, "next", a.name, a.from)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const RULES = {
  start: { title: "Count it from the start", line: () => "Every episode is scored again with it. Suits a new show, whose first rules are a guess.", said: "count from the start", value: "From the start" },
  next: { title: "From the next episode", line: (ep: string) => `${ep}s already played keep their points. Suits a format you know.`, said: "count from the next episode", value: "From the next episode" },
  vote: { title: "Let the players vote", line: () => "From the next episode for now; the players vote until it airs, and the Commissioner breaks a tie.", said: "go to the players' vote", value: "The players vote" },
} as const;

/** The line's value on How it plays. */
export const newMomentsValue = (m: NonNullable<GameSettings["moments"]>) => `${RULES[m.rule].value}${m.added.some((a) => !a.settled && a.rule === "vote") ? " · a vote is open" : ""}`;

/**
 * The players' vote, under the strip: one quiet line while a vote is open in one of your games ("Vote · Count 'Mutinied to another
 * tribe' from the start?"), opening the vote. Never the yellow (PFD R2: your own moves own it); it's due when the episode airs.
 */
export function MomentVoteLine({ show }: { show: ShowData }) {
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const plays = show.games.some((g) => g.yourRole);
  const data = useMomentVotes(seasonId, couchId, plays);
  const [open, setOpen] = useState<OpenVote | null>(null);
  const votes = data.data?.votes ?? [];
  if (!votes.length || !couchId) return null;
  const v = votes.find((x) => !x.mine) ?? votes[0];
  return (
    <>
      <section className="px-3 pt-1.5" data-moment-vote-line={v.id}>
        <button type="button" onClick={() => setOpen(v)} className="nd-press flex min-h-12 w-full items-center gap-2.5 rounded-[3px] bg-card px-3 py-1.5 text-left outline-1 -outline-offset-1 outline-border">
          <span className="min-w-0 flex-1">
            <span className="type-caption block truncate text-[12px] tracking-[0.05em] text-muted-foreground">
              {v.mine ? "You voted" : "Vote"} · {v.gameName}
              {v.closes ? ` · by ${airTime(Date.parse(v.closes))}` : ""}
              {votes.length > 1 ? ` · +${votes.length - 1} more` : ""}
            </span>
            {/* Never cut (the check's fix): the question leads, and a long name takes a second line. */}
            <b className="block text-pretty text-[15px] font-semibold leading-snug">From the start? &ldquo;{v.name}&rdquo;</b>
          </span>
          <span className="flex flex-none items-center gap-0.5 text-[14px] font-bold">
            {v.mine ? "See it" : "Vote"}
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </button>
      </section>
      {open && <MomentVoteSheet seasonId={seasonId} couchId={couchId} v={votes.find((x) => x.id === open.id && x.leagueId === open.leagueId) ?? open} ep={show.words.ep} names={show.words.names} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The vote itself: the moment and its points; two equal answers, each with what it does to the standings; the default named. */
export function MomentVoteSheet({ seasonId, couchId, v, ep, names, onClose }: { seasonId: string; couchId: string; v: OpenVote; ep: string; names?: Record<number, GameLabel> | null; onClose: () => void }) {
  // A team's game by its name ("Chiefs at Bills"), else "Ep 4".
  const at = (n: number) => epName({ episode: ep, ep, names }, n, "short");
  const after = useAfter();
  const [busy, setBusy] = useState(false);
  const vote = async (answer: "start" | "next") => {
    setBusy(true);
    try {
      await momentVotes.cast(seasonId, couchId, v.leagueId, v.id, answer);
      await after();
      toast(answer === "start" ? "Voted: from the start" : `Voted: from ${at(v.from)}`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const earlier = v.earlier.length
    ? v.earlier
        .slice(0, 4)
        .map((x) => `${x.name} ${pts(x.points)} in ${at(x.episode)}`)
        .join(", ") + (v.earlier.length > 4 ? `, and ${v.earlier.length - 4} more` : "")
    : null;
  const startLine = earlier
    ? `Scores it in ${ep}s already played: ${earlier}${v.unseen ? `, plus any in the ${v.unseen} you haven't watched` : ""}, for whoever had them playing.`
    : v.unseen
      ? `Scores it in ${ep}s already played too, including ${v.unseen} you haven't watched.`
      : `Scores it in ${ep}s already played. It hasn't happened in any yet.`;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`“${v.name}” is new`} subtitle={`${pts(v.points)} in ${v.gameName} · the show added it this season`}>
      <div data-moment-vote={v.id} className="flex flex-col gap-2 pb-2">
        <p className="text-[15px] leading-snug">Should it count in the {ep}s already played, or only from {at(v.from)} on?</p>
        <Choice data="vote-start" title="From the start" line={startLine} chosen={v.mine === "start"} onPick={() => !busy && void vote("start")} />
        <Choice data="vote-next" title={`From ${at(v.from)}`} line={`Nothing already played changes. It counts from ${at(v.from)} on.`} chosen={v.mine === "next"} onPick={() => !busy && void vote("next")} />
        <p className="text-[13px] leading-snug text-muted-foreground" data-vote-standing>
          For now it counts from {at(v.from)}. {v.voted} of {v.of} voted{v.closes ? `; the vote closes ${airTime(Date.parse(v.closes))}` : ""}. More than half decides it; nobody voting keeps {at(v.from)}.
        </p>
        {/* Quiet (the check's fix): leaving isn't an answer, so it's never the heaviest thing here. */}
        <button type="button" onClick={onClose} className="mt-1 min-h-11 text-[15px] font-semibold text-muted-foreground">
          {v.mine ? "Done" : "Not now"}
        </button>
      </div>
    </Sheet>
  );
}
