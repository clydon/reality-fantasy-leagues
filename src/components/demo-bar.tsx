"use client";

import { useQuery } from "@tanstack/react-query";
import { useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import { DEMO_LEAGUE_TYPE_LABELS, type DemoLeagueTypeId } from "@/lib/game/demo-season-builder";
import { Button } from "@/components/ui/button";

const LEAGUE_TYPE_IDS: DemoLeagueTypeId[] = ["classic-draft", "active-roster", "pickem"];

// Port of AuthGate's old inline "🎬 Previewing demo data — nothing here is saved." banner, now
// present on every page (mounted once in AuthGate's shell, same as MobileNav/ReportModal) rather
// than living inline there and the episode scrubber living separately on Overview only. A single
// compact row -- the label text and a second row for the scrubber were tried first and cut for
// taking up too much space: the dropdowns and episode controls already say what's loaded, a label
// saying so again added nothing.
//   - Show/game-type dropdowns (switchDemoSeason) instead of plain text, so you can change either
//     without leaving the page or losing your place in the episode cursor (switchDemoSeason clamps
//     it to the new season's episode count).
//   - The episode scrubber (jump to first/prev/next/jump to last) sits in the same row.
export function DemoBar({ onExit }: { onExit: () => void }) {
  const demoSeasonData = useLeagueStore((s) => s.demoSeasonData);
  const demoLeagueTypeId = useLeagueStore((s) => s.demoLeagueTypeId);
  const demoEpisodeCursor = useLeagueStore((s) => s.demoEpisodeCursor);
  const switchDemoSeason = useLeagueStore((s) => s.switchDemoSeason);
  const setDemoEpisodeCursor = useLeagueStore((s) => s.setDemoEpisodeCursor);
  // Shares the picker's own cache (same queryKey) -- whichever of the two components mounts first
  // fetches it, and the other reads the cache instantly.
  const { data: catalog } = useQuery({
    queryKey: ["demo-seasons"],
    queryFn: () => api.listDemoSeasons(),
    enabled: !!demoSeasonData,
    staleTime: Infinity,
  });

  async function changeShow(showId: string) {
    if (!demoLeagueTypeId || showId === demoSeasonData?.id) return;
    const { season } = await api.getDemoSeason(showId);
    switchDemoSeason(season, demoLeagueTypeId);
  }

  function changeLeagueType(leagueTypeId: DemoLeagueTypeId) {
    if (!demoSeasonData || leagueTypeId === demoLeagueTypeId) return;
    switchDemoSeason(demoSeasonData, leagueTypeId);
  }

  return (
    <div className="sticky top-0 z-[1000] flex flex-wrap items-center justify-center gap-2 bg-primary px-3 py-1.5 text-center text-[0.8rem] text-primary-foreground">
      {demoSeasonData && demoLeagueTypeId ? (
        <>
          <select
            className="rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 text-[0.78rem] text-primary-foreground"
            value={demoSeasonData.id}
            onChange={(e) => changeShow(e.target.value)}
          >
            {(catalog?.seasons ?? [{ id: demoSeasonData.id, name: demoSeasonData.showName }]).map((s) => (
              <option key={s.id} value={s.id} className="text-foreground">
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 text-[0.78rem] text-primary-foreground"
            value={demoLeagueTypeId}
            onChange={(e) => changeLeagueType(e.target.value as DemoLeagueTypeId)}
          >
            {LEAGUE_TYPE_IDS.map((id) => (
              <option key={id} value={id} className="text-foreground">
                {DEMO_LEAGUE_TYPE_LABELS[id]}
              </option>
            ))}
          </select>
          {demoEpisodeCursor !== null && (
            <span className="flex items-center gap-1.5">
              <button
                className="rounded-md border border-primary-foreground/30 px-2 py-0.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                disabled={demoEpisodeCursor <= 1}
                onClick={() => setDemoEpisodeCursor(1)}
                title="Jump to episode 1"
              >
                ⏮
              </button>
              <button
                className="rounded-md border border-primary-foreground/30 px-2 py-0.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                disabled={demoEpisodeCursor <= 1}
                onClick={() => setDemoEpisodeCursor(demoEpisodeCursor - 1)}
                title="Previous episode"
              >
                ←
              </button>
              <span className="font-mono text-[0.75rem]">
                Ep <b>{demoEpisodeCursor}</b>/{demoSeasonData.episodeCount}
              </span>
              <button
                className="rounded-md border border-primary-foreground/30 px-2 py-0.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                disabled={demoEpisodeCursor >= demoSeasonData.episodeCount}
                onClick={() => setDemoEpisodeCursor(demoEpisodeCursor + 1)}
                title="Next episode"
              >
                →
              </button>
              <button
                className="rounded-md border border-primary-foreground/30 px-2 py-0.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                disabled={demoEpisodeCursor >= demoSeasonData.episodeCount}
                onClick={() => setDemoEpisodeCursor(demoSeasonData.episodeCount)}
                title="Jump to the last episode"
              >
                ⏭
              </button>
            </span>
          )}
        </>
      ) : null}
      <Button variant="secondary" size="sm" onClick={onExit}>
        Exit Tour
      </Button>
    </div>
  );
}
