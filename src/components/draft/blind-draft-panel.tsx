"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { useShowTerms } from "@/lib/use-show-terms";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "cn";

// Blind draft's submission UI (shared ownership mode) -- the alternative to the turn-based
// DraftOrderPanel/DraftStatusPanel/FreeAgentsPanel trio, which don't apply here: there are no turns
// and no free agents (nothing is ever removed from availability, so every player is offered the
// whole active cast).
//
// Deliberately does NOT use useMutate: every other mutation in this app is "mutate state, get the
// whole new state back", but a blind submission's contents never enter league state at all (see
// src/lib/server/blind-draft.ts), so there's nothing for mock mode to mutate locally and the errors
// here are real, user-facing validation messages rather than the generic alert() useMutate does.
// Shared mode can't be reached in mock mode anyway (the demo league is exclusive), so a mock branch
// would be dead code.
export function BlindDraftPanel({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();

  // Commissioner can submit on someone's behalf so an absent player can't stall the draft; they
  // cannot READ anyone else's picks, which is why the "your locked picks" fetch below is only ever
  // made for your own seat. See the GET route's comment.
  const [actingPlayerId, setActingPlayerId] = useState<string>(myPlayerId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Roster derives this from its slot settings, so ask through rosterSize rather than
  // reading teamSize -- otherwise a blind draft in an Active Roster league would demand the wrong
  // number of picks from what the routes will accept.
  const teamSize = StateLogic.rosterSize(state);
  const started = StateLogic.isDraftStarted(state);
  const revealed = StateLogic.BlindDraftLogic.isRevealed(state);
  const eligible = StateLogic.BlindDraftLogic.eligiblePlayers(state);
  const waitingOn = StateLogic.BlindDraftLogic.waitingOn(state);
  const activeCast = state.castaways.filter((c) => c.status === "active");
  const iHaveLocked = !!actingPlayerId && StateLogic.BlindDraftLogic.hasLocked(state, actingPlayerId);

  // Your own submission survives a page refresh -- it isn't in league state (that's the whole point),
  // so it takes its own request. Only ever for YOUR seat, never for whoever the commissioner is
  // acting as: the route refuses anyone else's anyway. Keyed on the locked-in count so withdrawing
  // (or a poll landing someone else's lock) refetches rather than showing a stale list.
  const { data: myPicksData } = useQuery({
    queryKey: ["blind-picks", leagueId, myPlayerId, state.blindDraft.lockedPlayerIds.length],
    queryFn: () => api.myBlindPicks(leagueId!, myPlayerId!),
    enabled: !!leagueId && !!myPlayerId && !revealed,
  });
  const myLockedPicks = myPicksData?.castawayIds ?? null;

  function toggle(castawayId: string) {
    setError(null);
    setSelected((cur) => {
      if (cur.includes(castawayId)) return cur.filter((id) => id !== castawayId);
      if (cur.length >= teamSize) return cur; // full -- deselect something first
      return [...cur, castawayId];
    });
  }

  async function lockIn() {
    if (!leagueId || !actingPlayerId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.lockBlindPicks(leagueId, actingPlayerId, selected);
      setState(next);
      setSelected([]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not lock in your picks.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!leagueId || !actingPlayerId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.unlockBlindPicks(leagueId, actingPlayerId);
      setState(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not withdraw your picks.");
    } finally {
      setBusy(false);
    }
  }

  // DraftBoard swaps this panel out for Draft Results once the reveal has happened, so there's no
  // post-reveal branch here; this guard only covers the brief window where a poll lands the revealed
  // state before the parent re-renders.
  if (revealed) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/40 bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-base font-bold">Blind draft</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Everyone picks {teamSize} {teamSize === 1 ? terms.castaway : terms.castaways} privately. Nothing is revealed
        until every player has locked in — then all picks reveal at once. The same {terms.castaway} can be picked by
        more than one
        player, so there&rsquo;s no rush to claim anyone.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Locked in:</span>
        {eligible.map((p) => {
          const locked = StateLogic.BlindDraftLogic.hasLocked(state, p.id);
          return (
            <Badge
              key={p.id}
              className={cn("text-white", !locked && "opacity-40")}
              style={{ background: p.color }}
              title={locked ? `${p.name} has locked in` : `Waiting on ${p.name}`}
            >
              {p.name}
              {locked ? " ✓" : " …"}
            </Badge>
          );
        })}
      </div>

      {!started ? (
        <p className="text-sm text-muted-foreground">
          Waiting for the commissioner to start the draft before picks can be submitted.
        </p>
      ) : (
        <>
          {canManage && (
            <label className="mb-2 flex flex-wrap items-center gap-1.5 text-sm">
              Submitting as:
              <Select size="sm" value={actingPlayerId} onChange={(e) => { setActingPlayerId(e.target.value); setSelected([]); setError(null); }}>
                <option value="">— player —</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {StateLogic.BlindDraftLogic.hasLocked(state, p.id) ? " (locked in)" : ""}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted-foreground">
                You can submit for an absent player, but you can&rsquo;t see anyone else&rsquo;s picks.
              </span>
            </label>
          )}

          {iHaveLocked ? (
            <div className="rounded-md border border-dashed border-border bg-secondary/40 p-3">
              <p className="text-sm font-semibold">
                {actingPlayerId === myPlayerId ? "You’re locked in." : "That player is locked in."}{" "}
                <span className="font-normal text-muted-foreground">
                  {waitingOn.length === 0
                    ? "Revealing…"
                    : `Waiting on ${waitingOn.length} other player${waitingOn.length === 1 ? "" : "s"}.`}
                </span>
              </p>
              {actingPlayerId === myPlayerId && myLockedPicks && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Your picks:{" "}
                  {myLockedPicks.map((id) => StateLogic.getCastaway(state, id)?.name || "?").join(", ")}
                </p>
              )}
              <Button variant="secondary" size="sm" className="mt-2" disabled={busy} onClick={withdraw}>
                Withdraw &amp; re-pick
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm">
                {actingPlayerId ? (
                  <>
                    Selected <b>{selected.length}</b> of <b>{teamSize}</b>.
                  </>
                ) : (
                  "Choose which player you're submitting for."
                )}
              </p>
              <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                {activeCast.map((c) => {
                  const isSelected = selected.includes(c.id);
                  const selectable = !!actingPlayerId && (isSelected || selected.length < teamSize);
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={selectable ? 0 : undefined}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border-2 bg-card p-2.5 text-center shadow-sm",
                        isSelected ? "border-primary bg-primary/5" : "border-border",
                        selectable ? "cursor-pointer hover:border-primary" : "opacity-60"
                      )}
                      onClick={() => selectable && toggle(c.id)}
                      onKeyDown={(e) => selectable && e.key === "Enter" && toggle(c.id)}
                    >
                      <CastawayAvatar
                        castaway={c}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-xs font-bold"
                      />
                      <div className="text-xs font-medium leading-tight">{c.name}</div>
                      {isSelected && (
                        <div className="rounded bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">
                          Picked
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button disabled={busy || !actingPlayerId || selected.length !== teamSize} onClick={lockIn}>
                Lock In {selected.length}/{teamSize}
              </Button>
            </>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
