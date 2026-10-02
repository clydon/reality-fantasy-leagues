"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";

// Spoiler protection's opt-out (db/migrations/0034's user_settings). On by default: new episode
// results wait behind "Results are in!" until you reveal them. Off: they appear as soon as they land,
// and result pushes name who went home.
export function SpoilerSection() {
  const [protectedOn, setProtectedOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const switchLeague = useLeagueStore((s) => s.switchLeague);

  useEffect(() => {
    api
      .getMySettings()
      .then((r) => setProtectedOn(!r.showResultsImmediately))
      .catch(() => setProtectedOn(true));
  }, []);

  async function toggle(on: boolean) {
    setProtectedOn(on);
    setError(null);
    try {
      await api.setMySettings({ showResultsImmediately: !on });
      // Reload the open league so its view picks the change up straight away.
      if (mode === "live" && leagueId) await switchLeague(leagueId);
    } catch {
      setProtectedOn(!on);
      setError("Couldn't save that — try again.");
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
      <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Spoilers</h3>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={protectedOn ?? true}
          disabled={protectedOn === null}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>
          <span className="font-semibold">Hide new results until I reveal them</span>
          <span className="block text-xs text-muted-foreground">
            When an episode&rsquo;s results come in, you&rsquo;ll see &ldquo;Results are in!&rdquo; instead — standings, scores and
            who went home stay hidden until you tap Reveal. Turn off to see results as soon as they land.
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
