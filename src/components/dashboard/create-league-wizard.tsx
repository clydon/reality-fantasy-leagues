"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m, AnimatePresence } from "@/components/motion";

const PANEL = "mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm";
const PANEL_TITLE = "mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground";

// Known shows get a face; anything else in the catalog (added via Admin, or eventually the AI
// research flow) falls back to a plain marker rather than a wrong-looking icon.
const SHOW_ICON: Record<string, string> = { survivor: "🏝️", traitors: "🔪", challenge: "🧗" };

// The three league types, in the order docs/PLAN-new-user-onboarding-flow.md's step 2 mockup shows
// them -- StateLogic.LEAGUE_TYPES itself is keyed for the draft/scoring-strategy lookup, not display
// order.
const TYPE_ORDER = ["classic-draft", "active-roster", "pickem"];

type Step = 1 | 2 | 3;

const STEP_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

// Restructured from one name field into three short steps
// (docs/PLAN-new-user-onboarding-flow.md phase B): what show, how to play, then name it -- the two
// identity-defining choices moved up front, in front of a brand-new, nothing-to-show-yet league.
// Season, ownership mode, invites and roster size are unaffected and still live on /setup
// afterwards. Only reads today's admin-curated show catalog (the "+ Add it" tile is wired up once
// docs/PLAN-ai-generated-show-formats.md's research flow exists, per that plan's phase 3).
export function CreateLeagueWizard({
  busy,
  run,
  enterLeague,
}: {
  busy: string | null;
  run: (key: string, fn: () => Promise<void>) => Promise<void>;
  enterLeague: (leagueId: string, message: string, to?: string) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [showId, setShowId] = useState<string | null>(null);
  const [leagueTypeId, setLeagueTypeId] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Not gated on store mode: this renders for a leagueless user, whose store mode is "mock" (no
  // league loaded yet) even though they're really signed in -- same reasoning as Dashboard's own
  // direct api.me()/myInvites() calls above.
  const { data: catalog } = useQuery({
    queryKey: ["shows-catalog"],
    queryFn: () => api.listShows(),
    staleTime: 10 * 60 * 1000,
  });
  const shows = catalog?.shows ?? [];

  function go(next: Step) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || !showId || !leagueTypeId) return;
    run("create", async () => {
      const { league } = await api.createLeague(trimmed);
      await api.updateLeagueSettings(league.id, "showId", showId);
      await api.updateLeagueSettings(league.id, "leagueTypeId", leagueTypeId);
      await enterLeague(
        league.id,
        `Created ${league.name}. Set it up below, then share join code ${league.join_code} or send invites.`,
        "/setup"
      );
    });
  }

  return (
    <div className={PANEL}>
      <h3 className={PANEL_TITLE}>Create a League &middot; Step {step} of 3</h3>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          {step === 1 && (
            <m.div key="1" custom={dir} variants={STEP_VARIANTS} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <p className="mb-2 text-sm font-semibold">What are you playing?</p>
              <div className="grid grid-cols-2 gap-2">
                {shows.map((s) => (
                  <button
                    key={s.slug}
                    className={`flex flex-col items-center gap-1 rounded-md border p-3 text-center hover:border-primary hover:bg-secondary ${
                      showId === s.slug ? "border-primary bg-secondary" : "border-border"
                    }`}
                    onClick={() => {
                      setShowId(s.slug);
                      go(2);
                    }}
                  >
                    <span className="text-xl" aria-hidden>
                      {SHOW_ICON[s.slug] ?? "🎬"}
                    </span>
                    <span className="text-sm font-medium">{s.name}</span>
                  </button>
                ))}
                <button
                  disabled
                  title="Coming soon — research your own show's rules"
                  className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border p-3 text-center text-muted-foreground opacity-60"
                >
                  <span className="text-xl" aria-hidden>
                    ➕
                  </span>
                  <span className="text-sm font-medium">Add it</span>
                  <span className="text-[0.65rem]">don&rsquo;t see your show?</span>
                </button>
              </div>
            </m.div>
          )}

          {step === 2 && (
            <m.div key="2" custom={dir} variants={STEP_VARIANTS} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <p className="mb-2 text-sm font-semibold">How do you want to play?</p>
              <div className="flex flex-col gap-2">
                {TYPE_ORDER.map((id) => {
                  const lt = StateLogic.LEAGUE_TYPES[id];
                  return (
                    <button
                      key={id}
                      className={`flex flex-col items-start gap-0.5 rounded-md border p-3 text-left hover:border-primary hover:bg-secondary ${
                        leagueTypeId === id ? "border-primary bg-secondary" : "border-border"
                      }`}
                      onClick={() => {
                        setLeagueTypeId(id);
                        go(3);
                      }}
                    >
                      <span className="text-sm font-semibold">{lt.name}</span>
                      <span className="text-xs text-muted-foreground">{lt.description}</span>
                    </button>
                  );
                })}
              </div>
              <button className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => go(1)}>
                &larr; Back
              </button>
            </m.div>
          )}

          {step === 3 && (
            <m.div key="3" custom={dir} variants={STEP_VARIANTS} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <p className="mb-2 text-sm font-semibold">Name it</p>
              <div className="flex gap-1.5">
                <Input
                  className="min-w-0 flex-1"
                  placeholder="League name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <Button onClick={handleCreate} disabled={!!busy || !name.trim()}>
                  {busy === "create" ? "Creating…" : "Create League"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">You&apos;ll be the commissioner and the first player.</p>
              <button className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => go(2)}>
                &larr; Back
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
