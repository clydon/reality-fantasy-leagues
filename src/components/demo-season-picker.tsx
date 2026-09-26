"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const LEAGUE_TYPE_LABEL: Record<string, string> = {
  "classic-draft": "Classic Draft",
  "active-roster": "Active Roster",
  pickem: "Eliminator Pool",
};

// Mounted once in AuthGate's shell, toggled by useDemoSeasonPickerStore -- same pattern as
// ReportModal. Replaces the old one-click "Demo Season" button (which just called previewDemo()
// straight into a single hardcoded season) with a real choice of three researched real seasons,
// one per league type, each fetched once from db/migrations/0025_demo_seasons.sql and cached
// client-side from then on (see store.ts's chooseDemoSeason/demoSeasonData).
export function DemoSeasonPicker() {
  const router = useRouter();
  const { open, closePicker } = useDemoSeasonPickerStore();
  const chooseDemoSeason = useLeagueStore((s) => s.chooseDemoSeason);
  const { data, isLoading, error } = useQuery({
    queryKey: ["demo-seasons"],
    queryFn: () => api.listDemoSeasons(),
    enabled: open,
    staleTime: Infinity,
  });

  if (!open) return null;

  async function pick(id: string) {
    const { season } = await api.getDemoSeason(id);
    chooseDemoSeason(season);
    closePicker();
    router.push("/");
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-5" onClick={(e) => e.target === e.currentTarget && closePicker()}>
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-lg bg-card p-[22px] shadow-md">
        <button className="absolute right-3.5 top-3.5 p-1 text-muted-foreground hover:text-foreground" onClick={closePicker} aria-label="Close">
          ✕
        </button>
        <h3 className="mb-1 text-base font-bold">Pick a demo season</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Real seasons, real boot orders — one for each league type. You can step back through the season episode by
          episode once you&rsquo;re in.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">Could not load the demo seasons. Try again.</p>}
        <div className="flex flex-col gap-2">
          {data?.seasons.map((s) => (
            <button
              key={s.id}
              className="flex flex-col items-start gap-0.5 rounded-md border border-border p-3 text-left hover:border-primary hover:bg-secondary"
              onClick={() => pick(s.id)}
            >
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {LEAGUE_TYPE_LABEL[s.leagueTypeId] ?? s.leagueTypeId} · {s.episodeCount} episodes
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={closePicker}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
