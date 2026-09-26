"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useShowTerms } from "@/lib/use-show-terms";

// Active Roster's per-episode UI inside EpisodeCard: each player's active lineup for THIS episode
// (read-only -- see overview/active-roster-lineup-grid.tsx for where lineups are actually SET, tap by
// tap, the same self-service pattern as Eliminator Pool's pick), the commissioner's lineup lock, and
// the scoring-event log.
//
// Lineups are per-episode by design (see ActiveRosterLogic): this component only ever reads
// `ep.lineups`, so there's no way for it to touch a different episode's lineup and change what that
// episode already scored.
//
// Doesn't use useMutate: lock/event calls have real validation messages worth showing inline rather
// than useMutate's generic alert(), and Active Roster isn't reachable in mock mode (the demo league is
// classic-draft), so a mock branch would be dead code.
export function EpisodeActiveRosterSection({ ep, state }: { ep: Episode; state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();

  const events = StateLogic.formatOf(state).events;
  // Implied events come from exits and roles on their own, so only the rest can be logged by hand.
  const loggable = events.filter((e) => !e.implied);
  const episodeEvents = StateLogic.ActiveRosterLogic.episodeEvents(state, ep);
  const [eventType, setEventType] = useState(loggable[0]?.id ?? "");
  const [eventCastawayId, setEventCastawayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = !!ep.lineupsLocked;
  const activeSlots = state.settings.activeSlots;

  async function run(fn: () => Promise<LeagueState>) {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Lineups</h4>
        {locked ? (
          <Badge variant="secondary" className="bg-good/15 text-good">
            Locked
          </Badge>
        ) : (
          <Badge variant="secondary">Open</Badge>
        )}
        {canManage && (
          <Button
            variant="secondary"
            size="xs"
            disabled={busy}
            onClick={() => run(() => (locked ? api.unlockLineups(leagueId!, ep.id) : api.lockLineups(leagueId!, ep.id)))}
          >
            {locked ? "Reopen lineups" : "Lock lineups"}
          </Button>
        )}
      </div>
      <div className="mb-3 flex flex-col gap-1.5">
        {state.players.map((p) => {
          const lineup = StateLogic.activeRosterLineupFor(state, ep.id, p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-xs">
              <Badge className="text-white" style={{ background: p.color }}>
                {p.name}
              </Badge>
              <span className="flex-1">
                {lineup.length === 0 ? (
                  <span className="italic text-muted-foreground">no lineup set</span>
                ) : (
                  lineup.map((id) => StateLogic.getCastaway(state, id)?.name || "?").join(", ")
                )}
              </span>
              <span className="text-muted-foreground">
                {lineup.length}/{activeSlots}
              </span>
            </div>
          );
        })}
      </div>

      <h4 className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Events</h4>
      {episodeEvents.length === 0 ? (
        <div className="mb-2 text-sm italic text-muted-foreground">No events logged for this episode.</div>
      ) : (
        <div className="mb-2 flex flex-col gap-1.5">
          {episodeEvents.map((sev) => {
            const def = events.find((e) => e.id === sev.type);
            const c = StateLogic.getCastaway(state, sev.castawayId);
            const pts = StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
            // Who this actually scored for: every player who had that castaway active this episode.
            // In shared ownership that can be more than one.
            const scoredFor = state.players.filter((p) =>
              StateLogic.activeRosterLineupFor(state, ep.id, p.id).includes(sev.castawayId)
            );
            return (
              <div key={sev.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">{def?.label || sev.type}</span>
                <span className="flex-1">{c?.name || "?"}</span>
                {scoredFor.length > 0 ? (
                  scoredFor.map((p) => (
                    <Badge key={p.id} className="text-white" style={{ background: p.color }} title={`Active for ${p.name}`}>
                      {p.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground" title={`Nobody had this ${terms.castaway} active this episode`}>
                    benched — no points
                  </span>
                )}
                <span className="font-mono font-bold">+{pts}</span>
                {sev.implied ? (
                  <span className="text-muted-foreground" title="Follows from how they left or their role, so it updates with those">
                    auto
                  </span>
                ) : (
                  canManage && (
                    <button title="Remove event" disabled={busy} onClick={() => run(() => api.removeScoringEvent(leagueId!, ep.id, sev.id))}>
                      ✕
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-1.5">
          <Select size="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {loggable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <Select size="sm" value={eventCastawayId} onChange={(e) => setEventCastawayId(e.target.value)}>
            <option value="">— {terms.castaway} —</option>
            {state.castaways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={busy || !eventCastawayId}
            onClick={async () => {
              const ok = await run(() => api.addScoringEvent(leagueId!, ep.id, eventType, eventCastawayId));
              if (ok) setEventCastawayId("");
            }}
          >
            + Log Event
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
