"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { DemoLeagueTypeId } from "@/lib/game/demo-season-builder";
import { Button } from "@/components/ui/button";

const LEAGUE_TYPES: { id: DemoLeagueTypeId; label: string; blurb: string }[] = [
  { id: "classic-draft", label: "Classic Draft", blurb: "Snake draft a roster, score by elimination placement." },
  { id: "active-roster", label: "Active Roster", blurb: "Draft a roster, field an active lineup, score by weekly events." },
  { id: "pickem", label: "Eliminator Pool", blurb: "No draft — pick one survivor each episode." },
];

// Mounted once in AuthGate's shell, toggled by useDemoSeasonPickerStore -- same pattern as
// ReportModal. Two steps: which show (the 3 researched real seasons, db/migrations/
// 0026_demo_seasons_generic.sql), then which of the 3 league types to try it as -- a season carries
// no fixed game type of its own, so any of the 3x3 combinations works (demo-season-builder.ts
// computes ownership/roster-size generically for whichever type is picked).
export function DemoSeasonPicker() {
  const router = useRouter();
  const { open, closePicker } = useDemoSeasonPickerStore();
  const chooseDemoSeason = useLeagueStore((s) => s.chooseDemoSeason);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["demo-seasons"],
    queryFn: () => api.listDemoSeasons(),
    enabled: open,
    staleTime: Infinity,
  });

  if (!open) return null;

  function close() {
    setSeasonId(null);
    closePicker();
  }

  async function pick(leagueTypeId: DemoLeagueTypeId) {
    if (!seasonId) return;
    const { season } = await api.getDemoSeason(seasonId);
    chooseDemoSeason(season, leagueTypeId);
    close();
    router.push("/");
  }

  const selected = data?.seasons.find((s) => s.id === seasonId) ?? null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-5" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-lg bg-card p-[22px] shadow-md">
        <button className="absolute right-3.5 top-3.5 p-1 text-muted-foreground hover:text-foreground" onClick={close} aria-label="Close">
          ✕
        </button>
        {!selected ? (
          <>
            <h3 className="mb-1 text-base font-bold">Pick a show</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Real seasons, real boot orders. Next you&rsquo;ll pick which game type to try it as — you can step back
              through the season episode by episode once you&rsquo;re in.
            </p>
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">Could not load the demo seasons. Try again.</p>}
            <div className="flex flex-col gap-2">
              {data?.seasons.map((s) => (
                <button
                  key={s.id}
                  className="flex flex-col items-start gap-0.5 rounded-md border border-border p-3 text-left hover:border-chyron-line hover:bg-secondary"
                  onClick={() => setSeasonId(s.id)}
                >
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.episodeCount} episodes</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-1 text-base font-bold">Pick a game type</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Trying <b>{selected.name}</b> as:
            </p>
            <div className="flex flex-col gap-2">
              {LEAGUE_TYPES.map((lt) => (
                <button
                  key={lt.id}
                  className="flex flex-col items-start gap-0.5 rounded-md border border-border p-3 text-left hover:border-chyron-line hover:bg-secondary"
                  onClick={() => pick(lt.id)}
                >
                  <span className="text-sm font-semibold">{lt.label}</span>
                  <span className="text-xs text-muted-foreground">{lt.blurb}</span>
                </button>
              ))}
            </div>
            <button className="mt-2 text-xs font-semibold text-chyron-line hover:underline" onClick={() => setSeasonId(null)}>
              ← Pick a different show
            </button>
          </>
        )}
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
