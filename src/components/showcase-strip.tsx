"use client";

import { m } from "@/components/motion";

// LoginScreen's pre-signup pitch (docs/PLAN-new-user-onboarding-flow.md phase 1): the only taste a
// stranger gets of the three shows/modes before committing to an account. Copy for the three shows
// and the three league types is pulled from the User Manual's "The Game Modes Explained" section
// (Classic/Active Roster/Eliminator Pool) so it matches what a player reads once they're in.
// Pure copy/layout, no backend dependency -- ships independently of everything else in either plan.
const SHOWS = [
  { icon: "🏝️", name: "Survivor" },
  { icon: "🔪", name: "Traitors" },
  { icon: "🧗", name: "Challenge" },
];

const stagger = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.25 } }),
};

export function ShowcaseStrip() {
  return (
    <m.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] text-center shadow-sm"
    >
      <p className="mb-3 text-sm font-semibold">Draft a show&rsquo;s cast. Score what actually happens to them.</p>
      <div className="mb-2 flex items-center justify-center gap-4">
        {SHOWS.map((show, i) => (
          <m.span
            key={show.name}
            custom={i}
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            <span className="text-lg" aria-hidden>
              {show.icon}
            </span>
            {show.name}
          </m.span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">draft &amp; hold &middot; weekly start/sit &middot; pick to survive each week</p>
    </m.div>
  );
}
