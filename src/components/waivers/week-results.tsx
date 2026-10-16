"use client";

import { useLeagueStore } from "@/lib/store";
import { SectionHead } from "@/components/draft/draft-ui";
import { Note, OrderAfterRun, RunResults, TxRows } from "./waivers-ui";
import { HowWaiversWork } from "./rules-sheet";
import { isShared, periodFor, transactions, useNow, when } from "./waivers-model";

// One past waiver week, in full: every claim's outcome and why, then free agency and the order it
// left (the canvas's "All of Episode 3's waivers, and why", from the between-weeks board).
export function WeekResults({ episode }: { episode: number }) {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const now = useNow();
  const period = periodFor(state, episode);
  if (!period || !period.run) {
    return <p className="text-base text-muted-foreground">Episode {episode}&rsquo;s waivers haven&rsquo;t processed, or you haven&rsquo;t revealed that episode yet.</p>;
  }
  const later = transactions(state).filter((tx) => tx.periodId === period.id && tx.via !== "waivers");
  return (
    <div className="flex flex-col gap-[30px]">
      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<HowWaiversWork label="How it works" />}>Waivers after Episode {episode}</SectionHead>
        <Note>
          Processed {when(period.run.at, now)}
          {period.run.by === "commissioner" ? " by your commissioner" : ""}
          {isShared(state) ? ": everyone got who they claimed." : ", in waiver order."}
        </Note>
        <RunResults state={state} period={period} me={me} />
      </section>
      {later.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHead>Then</SectionHead>
          <TxRows state={state} entries={later} me={me} />
        </section>
      )}
      {!isShared(state) && (
        <section className="flex flex-col gap-2.5">
          <SectionHead>Waiver order after</SectionHead>
          <OrderAfterRun state={state} period={period} me={me} />
        </section>
      )}
    </div>
  );
}
