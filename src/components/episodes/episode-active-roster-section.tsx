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
import { CastawayAvatar } from "@/components/castaway-avatar";

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
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
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

  // This episode's events per castaway, with what each is worth.
  const byCastaway = new Map<string, { events: typeof episodeEvents; points: number }>();
  for (const sev of episodeEvents) {
    const entry = byCastaway.get(sev.castawayId) ?? { events: [], points: 0 };
    entry.events.push(sev);
    entry.points = StateLogic.roundPoints(entry.points + StateLogic.ActiveRosterLogic.pointsFor(state, sev.type));
    byCastaway.set(sev.castawayId, entry);
  }
  const pointsOf = (cid: string) => byCastaway.get(cid)?.points ?? 0;
  const lineups = state.players.map((p) => {
    const ids = StateLogic.activeRosterLineupFor(state, ep.id, p.id);
    return {
      player: p,
      carried: ids.length > 0 && StateLogic.ActiveRosterLogic.lineupIsCarried(state, ep.id, p.id),
      ids: [...ids].sort((a, b) => pointsOf(b) - pointsOf(a)),
      total: StateLogic.roundPoints(ids.reduce((sum, cid) => sum + pointsOf(cid), 0)),
    };
  });
  const fielded = new Set(lineups.flatMap((l) => l.ids));
  // Everyone who scored this episode without being in anyone's lineup -- the points left on benches.
  const unfielded = [...byCastaway.entries()]
    .filter(([cid]) => !fielded.has(cid))
    .sort((a, b) => b[1].points - a[1].points);

  const eventChips = (evs: typeof episodeEvents) =>
    evs.map((sev) => {
      const def = events.find((e) => e.id === sev.type);
      const pts = StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
      return (
        <span key={sev.id} className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[0.7rem]">
          {def?.label || sev.type}
          <span className="font-mono font-bold">{pts >= 0 ? `+${pts}` : pts}</span>
          {!sev.implied && canManage && (
            <button
              className="text-muted-foreground hover:text-destructive"
              title="Remove event"
              disabled={busy}
              onClick={() => run(() => api.removeScoringEvent(leagueId!, ep.id, sev.id))}
            >
              ✕
            </button>
          )}
        </span>
      );
    });

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
      <div className="mb-3 flex flex-col gap-2">
        {lineups.map(({ player: p, ids, total, carried }) => (
          <div key={p.id} className="rounded-md border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5 text-xs">
              <Badge className="text-white" style={{ background: p.color }}>
                {p.name}
              </Badge>
              {carried && (
                <span className="text-muted-foreground" title="No lineup was set for this episode, so the last one chosen is used">
                  last lineup reused
                </span>
              )}
              <span className="ml-auto text-muted-foreground">
                {ids.length}/{activeSlots}
              </span>
              <span className="font-mono text-sm font-bold">{total}</span>
            </div>
            {ids.length === 0 ? (
              <div className="px-2 py-1.5 text-xs italic text-muted-foreground">no lineup set</div>
            ) : (
              ids.map((cid) => {
                const c = StateLogic.getCastaway(state, cid);
                const scored = byCastaway.get(cid);
                return (
                  <div key={cid} className="flex items-center gap-2 border-t border-border px-2 py-1.5 first:border-t-0">
                    {c && (
                      <CastawayAvatar
                        castaway={c}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.65rem] font-bold"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c?.name ?? "?"}</div>
                      {scored && <div className="mt-0.5 flex flex-wrap gap-1">{eventChips(scored.events)}</div>}
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold">{scored ? scored.points : 0}</span>
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      <h4 className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        Events not in a lineup
      </h4>
      {unfielded.length === 0 ? (
        <div className="mb-2 text-sm italic text-muted-foreground">
          {episodeEvents.length === 0 ? "No events logged for this episode." : `Every ${terms.castaway} who scored was in a lineup.`}
        </div>
      ) : (
        <div className="mb-2 flex flex-col gap-1.5">
          {unfielded.map(([cid, scored]) => {
            const c = StateLogic.getCastaway(state, cid);
            const owners = (c?.ownerIds ?? []).map((id) => StateLogic.getPlayer(state, id)).filter((o): o is NonNullable<typeof o> => !!o);
            return (
              <div key={cid} className="flex items-center gap-2">
                {c && (
                  <CastawayAvatar
                    castaway={c}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.65rem] font-bold opacity-80"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="truncate">{c?.name ?? "?"}</span>
                    {owners.length > 0 ? (
                      owners.map((o) => (
                        <Badge key={o.id} variant="outline" className="h-4 text-[0.6rem]" style={{ borderColor: o.color, color: o.color }} title={`Benched by ${o.name}`}>
                          {o.name} bench
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[0.65rem] text-muted-foreground">free agent</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">{eventChips(scored.events)}</div>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold text-muted-foreground">{scored.points}</span>
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
              markResultsSeen(ep.number); // entering it is seeing it -- see episode-card.tsx
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
