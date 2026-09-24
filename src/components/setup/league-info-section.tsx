"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

// Port of renderSetup()'s League Name + Draft Schedule panels, plus the League Type / Show / Season
// pickers (not in the live app at all).
//
// League Type still comes from state-logic.js's LEAGUE_TYPES registry -- a league type is code (a
// draft strategy plus a scoring strategy), so it can only ever be what's been written.
//
// Shows and seasons, by contrast, are DATA: they come from the admin-managed catalog over
// /api/shows (db/migrations/0006_shows_and_seasons.sql), not from state-logic's SHOWS, which is now
// only the bootstrap default for a new league's settings.showId. That's what lets a super-admin add
// a show without a deploy. The Season picker is driven by the selected show's seasons, falling back
// to a free-text number when the catalog has none, so a league can still name a season the admin
// hasn't catalogued yet.
export function LeagueInfoSection({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [name, setName] = useState(leagueName ?? "");

  const draftStarted = StateLogic.isDraftStarted(state);
  const leagueType = StateLogic.getLeagueType(state);
  // Locks once EITHER the draft has started (classic-draft's own signal) OR any episode exists
  // (a league-type-agnostic "season is underway" signal, needed now that a second league type --
  // pickem -- exists whose isDraftStarted() is permanently false: without this, a pickem league
  // with weeks of logged picks could still switch to classic-draft and silently orphan them).
  const seasonUnderway = draftStarted || state.episodes.length > 0;
  const typeLocked = !canManage || seasonUnderway || Object.keys(StateLogic.LEAGUE_TYPES).length <= 1;

  // The catalog, not state-logic's SHOWS. Available to any signed-in user; in mock mode there's no
  // real session, so this simply doesn't load and the picker falls back to showing the league's
  // stored showId.
  const mode = useLeagueStore((s) => s.mode);
  const { data: catalog } = useQuery({
    queryKey: ["shows-catalog"],
    queryFn: () => api.listShows(),
    enabled: mode === "live",
  });
  const shows = catalog?.shows ?? [];
  const currentShow = shows.find((s) => s.slug === state.settings.showId);
  const seasons = currentShow?.seasons ?? [];
  // Locked when there's nothing to choose between -- one show (or none loaded) means the picker would
  // be decorative, same reasoning the League Type picker uses.
  const showLocked = !canManage || seasonUnderway || shows.length <= 1;
  // Ownership mode locks on the same "season underway" signal, but NOT on the registry-size check
  // the other two carry -- both of its options always exist, so there's nothing to wait for. It has
  // to be locked before the draft runs rather than merely before episodes exist: flipping it
  // mid-draft would swap the draft mechanic out from under picks already made.
  const ownershipLocked = !canManage || seasonUnderway;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === leagueName) return;
    await mutate(
      () => {
        /* mock mode has no persisted league name to rename */
      },
      () => api.renameLeague(leagueId!, trimmed)
    );
  }

  async function updateSetting(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">League Info</h3>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          Name:
          <Input value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </label>
      </div>
      {leagueType.hasRoster && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            Draft scheduled for:
            <Input
              type="datetime-local"
              disabled={!canManage}
              defaultValue={state.settings.draftScheduledAt ? state.settings.draftScheduledAt.slice(0, 16) : ""}
              onBlur={(e) => updateSetting("draftScheduledAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </label>
          {state.draftForceStarted && <span className="text-xs text-muted-foreground">(force-started — schedule is moot)</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          League Type:
          <Select value={leagueType.id} disabled={typeLocked} onChange={(e) => updateSetting("leagueTypeId", e.target.value)}>
            {Object.values(StateLogic.LEAGUE_TYPES).map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
              </option>
            ))}
          </Select>
        </label>
        {leagueType.hasRoster && (
          <label className="flex items-center gap-1.5 text-sm">
            Ownership:
            <Select
              value={state.settings.ownershipMode}
              disabled={ownershipLocked}
              onChange={(e) => updateSetting("ownershipMode", e.target.value)}
            >
              <option value="exclusive">Exclusive — snake draft, one owner each</option>
              <option value="shared">Shared — blind draft, castaways can be shared</option>
            </Select>
          </label>
        )}
        <label className="flex items-center gap-1.5 text-sm">
          Show:
          <Select
            value={state.settings.showId}
            disabled={showLocked}
            onChange={(e) => updateSetting("showId", e.target.value)}
          >
            {/* If the catalog hasn't loaded (mock mode) or the league points at a show that's since
                been archived, still show the stored value rather than silently rendering a
                different show as selected. */}
            {shows.length === 0 && <option value={state.settings.showId}>{state.settings.showId}</option>}
            {shows.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
            {shows.length > 0 && !currentShow && (
              <option value={state.settings.showId}>{state.settings.showId} (not in catalog)</option>
            )}
          </Select>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Season:
          {seasons.length > 0 ? (
            <Select
              value={state.settings.wikiSeason ?? ""}
              disabled={!canManage}
              onChange={(e) => updateSetting("wikiSeason", e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">— none —</option>
              {seasons.map((s) => (
                <option key={s.seasonNumber} value={s.seasonNumber}>
                  {s.name || `Season ${s.seasonNumber}`}
                  {s.status === "airing" ? " (airing)" : s.status === "upcoming" ? " (upcoming)" : ""}
                </option>
              ))}
            </Select>
          ) : (
            // No catalogued seasons for this show: keep a free-text number so a league isn't blocked
            // waiting on an admin to add one. The connector will guess a page title for it.
            <Input
              type="number"
              className="w-20"
              disabled={!canManage}
              defaultValue={state.settings.wikiSeason ?? ""}
              placeholder="44"
              onBlur={(e) => {
                const v = e.target.value.trim();
                const n = v === "" ? null : parseInt(v);
                if (n !== state.settings.wikiSeason) updateSetting("wikiSeason", Number.isFinite(n as number) ? n : null);
              }}
            />
          )}
        </label>
      </div>
      {/* The catalogued cast size makes the shared-ownership nudge below concrete before anyone has
          entered a cast -- that check previously had nothing to compare against. */}
      {(() => {
        const s = seasons.find((x) => x.seasonNumber === state.settings.wikiSeason);
        return s?.castSize ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {s.name || `Season ${s.seasonNumber}`} has {s.castSize} castaways per the show catalog.
          </p>
        ) : null;
      })()}
      <p className="mt-2 text-xs text-muted-foreground">{leagueType.description}</p>
      {/* Setup-time nudge toward shared ownership, per Feature C's "critically suggested, not
          required" framing -- deliberately advice, never a block, and only while exclusive is still
          selected and the draft hasn't run. Exclusive ownership needs one distinct castaway per
          roster slot per player, so it's the combination of player count and roster size that runs a
          cast dry, not either alone.

          The cast size compared against is the league's own entered cast when it has one, and
          otherwise the selected season's catalogued cast size -- which is why that field exists on
          show_seasons. Before the catalog, an un-populated league had nothing to compare against and
          this fell back to a vague "once you've entered the cast" line; now it can be specific from
          the moment a season is picked. */}
      {leagueType.hasRoster && state.settings.ownershipMode === "exclusive" && !seasonUnderway && (() => {
        const seats = StateLogic.BlindDraftLogic.eligiblePlayers(state).length;
        const needed = seats * StateLogic.rosterSize(state);
        const catalogued = seasons.find((x) => x.seasonNumber === state.settings.wikiSeason)?.castSize ?? null;
        const castSize = state.castaways.length || catalogued || 0;
        const fromCatalog = state.castaways.length === 0 && !!catalogued;
        if (seats === 0) return null;
        if (castSize === 0) {
          return (
            <p className="mt-1 text-xs text-muted-foreground">
              Exclusive ownership needs {needed} distinct castaways for {seats} player{seats === 1 ? "" : "s"}. Once
              you&rsquo;ve entered the cast (or picked a season), switch to shared ownership if that doesn&rsquo;t fit.
            </p>
          );
        }
        if (needed > castSize) {
          return (
            <p className="mt-1 text-xs font-semibold text-destructive">
              {seats} players x {StateLogic.rosterSize(state)} roster slots needs {needed} castaways, but{" "}
              {fromCatalog ? "this season has" : "the cast has"} {castSize}. The draft can&rsquo;t fill every roster —
              switch to shared ownership, or reduce roster size.
            </p>
          );
        }
        if (needed > castSize * 0.75) {
          return (
            <p className="mt-1 text-xs text-muted-foreground">
              Heads up: {needed} of {castSize} castaways would be claimed, leaving little room for Replenish or Swap.
              Shared ownership is worth considering.
            </p>
          );
        }
        return null;
      })()}
      {leagueType.hasRoster && state.settings.ownershipMode === "shared" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Shared ownership runs a blind draft: everyone submits their whole set of picks privately and nothing
          reveals until every player has locked in. Because nobody is ever taken off the board, Replenish and Swap
          don&rsquo;t apply — there are no free agents to draw from.
        </p>
      )}
    </div>
  );
}
