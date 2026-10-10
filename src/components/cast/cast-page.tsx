"use client";

import { PageBackLink } from "@/components/back-link";
import { useLeagueStore } from "@/lib/store";
import { CastByTribe } from "@/components/overview/cast-by-tribe";

// The Cast page (docs/PLAN-ux-declutter.md): the board that used to sit at the bottom of Overview after
// the draft, for every league type. Grouped by current tribe, a dot per owner under each face, tap one
// for its stats. Read-only for everyone. Reached from the count under the Episodes list; on a phone the
// header names it and backs up to Episodes (mobile-nav.tsx).
export function CastPage() {
  const state = useLeagueStore((s) => s.state);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 max-nav:hidden">
        <PageBackLink />
        <h2 className="type-caption text-[28px]">The cast</h2>
      </div>
      {state.castaways.length === 0 ? (
        <p className="text-base text-muted-foreground">No cast yet.</p>
      ) : (
        <CastByTribe state={state} bare title={null} />
      )}
    </div>
  );
}
