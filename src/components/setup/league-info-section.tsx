"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { useShowCatalog, useShowTerms } from "@/lib/use-show-terms";
import { Field, LockedValue, MoreOptions, ReadOnlyNote, SettingsPage, StepperRow, fieldCls } from "./settings-ui";

// League Settings > League setup (docs/PLAN-ux-redesign.md, 2b): name, show, season, league type,
// results, draft date and roster size, with Starts-at and Ownership behind "More options". Each is a
// full-width field with its label above; anything locked renders as plain text with a lock, and one
// sentence says why (read-only-distinction), instead of a greyed-out control.
//
// League Type still comes from state-logic.js's LEAGUE_TYPES registry -- a league type is code (a draft
// strategy plus a scoring strategy), so it can only ever be what's been written. Shows and seasons are
// DATA from the admin-managed catalog over /api/shows (db/migrations/0006_shows_and_seasons.sql), which
// is what lets a super-admin add a show without a deploy. The Season picker is driven by the selected
// show's seasons, falling back to a free-text number when the catalog has none.
//
// A new league arrives here with these already answered by the create-league flow (/new-league), so
// there's no guided version of this page any more.
export function LeagueSetupPage() {
  const state = useLeagueStore((s) => s.state);
  return (
    <SettingsPage title="League setup">
      <ReadOnlyNote />
      <LeagueSetupForm state={state} />
    </SettingsPage>
  );
}

export function LeagueSetupForm({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const renameLeagueLocally = useLeagueStore((s) => s.renameLeagueLocally);
  const canManage = useCanManage();
  const mutate = useMutate();
  const terms = useShowTerms();
  const [name, setName] = useState(leagueName ?? "");
  // "Another season…" picked from the Season list: type a number the catalog doesn't have.
  const [typingSeason, setTypingSeason] = useState(false);

  const leagueType = StateLogic.getLeagueType(state);
  // Locks once the league has started playing -- the draft, or picks or lineups made -- so a switch
  // can't orphan them. Results arriving from the season don't count; see seasonUnderway.
  const seasonUnderway = StateLogic.seasonUnderway(state);

  const revealedThrough = StateLogic.RevealLogic.revealedThrough(state);
  const catchingUp = revealedThrough !== null;
  const startEp = StateLogic.startEpisode(state);
  // Episodes before the start count as already watched, so a catching-up league that has revealed
  // only those hasn't really begun yet.
  const revealedPastStart = catchingUp && (revealedThrough ?? 0) > startEp - 1;

  // The catalog, not state-logic's SHOWS. Shared query with useShowTerms. In mock mode there's no real
  // session, so this simply doesn't load and the show falls back to the league's stored showId.
  const { data: catalog } = useShowCatalog();
  const shows = catalog?.shows ?? [];
  const currentShow = shows.find((s) => s.slug === state.settings.showId);
  const seasons = currentShow?.seasons ?? [];
  // A commissioner researching an uncatalogued season adds it (db/episode-research.js ensureSeasonRow),
  // so the league's own season may not be among the catalogued ones -- the list keeps an off-catalog
  // pick, and offers to type one.
  const seasonOffCatalog = state.settings.wikiSeason != null && !seasons.some((s) => s.seasonNumber === state.settings.wikiSeason);
  // Locked when there's nothing to choose between -- one show (or none loaded) means the picker would
  // be decorative.
  const nothingToPickShow = shows.length <= 1;
  const nothingToPickType = Object.keys(StateLogic.LEAGUE_TYPES).length <= 1;
  const showLocked = !canManage || seasonUnderway || nothingToPickShow;
  const typeLocked = !canManage || seasonUnderway || nothingToPickType;
  // Season locks with its show: a season belongs to one, and the league's cast and results come from it.
  // Ownership locks on "season underway" but not on the registry-size check -- both of its options
  // always exist. It has to lock before the draft runs: flipping it mid-draft would swap the draft
  // mechanic out from under picks already made.
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
    // The name is a column on `leagues`, not a field in the JSONB, so mutate() updates nothing the
    // switcher and mobile header read (store.leagues/leagueName, from GET /api/me on load).
    if (leagueId) renameLeagueLocally(leagueId, trimmed);
  }

  async function updateSetting(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  // Seasons belong to a show, so a season number carried across a show change is meaningless.
  async function changeShow(slug: string) {
    await mutate(
      (s) => {
        StateLogic.updateSettings(s, "showId", slug || null);
        StateLogic.updateSettings(s, "wikiSeason", null);
      },
      async () => {
        await api.updateLeagueSettings(leagueId!, "showId", slug || null);
        return api.updateLeagueSettings(leagueId!, "wikiSeason", null);
      }
    );
  }

  // The episode the league starts playing at. A catching-up league has, by definition, watched the
  // episodes before it -- so its reveal pointer moves up to just before the start too (the route
  // applies those episodes' results when it does).
  async function changeStart(n: number) {
    n = Math.max(1, Math.floor(n) || 1);
    if (n === startEp) return;
    const revealTo = catchingUp && (revealedThrough ?? 0) < n - 1 ? n - 1 : null;
    await mutate(
      (s) => {
        StateLogic.updateSettings(s, "startEpisode", n);
        if (revealTo !== null) StateLogic.updateSettings(s, "revealedThroughEpisode", revealTo);
      },
      async () => {
        const state = await api.updateLeagueSettings(leagueId!, "startEpisode", n);
        return revealTo !== null ? api.updateLeagueSettings(leagueId!, "revealedThroughEpisode", revealTo) : state;
      }
    );
  }

  const selectedSeason = seasons.find((x) => x.seasonNumber === state.settings.wikiSeason);
  const seasonLabel = (n: number | null | undefined) => {
    if (n == null) return "Not picked";
    const s = seasons.find((x) => x.seasonNumber === n);
    return s?.name || `Season ${n}`;
  };
  const showName = currentShow?.name ?? state.settings.showId ?? "Not picked";
  const hasSeason = state.settings.wikiSeason != null;

  const results = hasSeason && (
    <>
      {!canManage || revealedPastStart ? (
        <LockedValue label="Results" value={catchingUp ? "Catch up, one episode at a time" : "Live, as they come in"} lock={canManage} />
      ) : (
        <Field label="Results" htmlFor="ls-results">
          <select
            id="ls-results"
            className={fieldCls}
            value={catchingUp ? "catchup" : "live"}
            onChange={(e) => updateSetting("revealedThroughEpisode", e.target.value === "catchup" ? startEp - 1 : null)}
          >
            <option value="live">Live, as they come in</option>
            <option value="catchup">Catch up, one episode at a time</option>
          </select>
        </Field>
      )}
      <p className="-mt-3 text-[13px] leading-snug text-muted-foreground">
        {catchingUp
          ? !revealedPastStart
            ? `This league plays from episode ${startEp} whatever has already aired. Reveal episodes one at a time from Episodes.`
            : `Revealed through episode ${revealedThrough}. Reveal the rest from Episodes.`
          : "Results are offered as soon as they're in. Pick catch up if your league is starting a season that has already aired."}
      </p>
    </>
  );

  // Catch-up and the starting episode (a league formed mid-season: earlier episodes are shown, but not
  // scored, and no picks or lineups for them). Locked once the league has started playing.
  const startAt = hasSeason && (
    <>
      {!canManage || seasonUnderway || revealedPastStart ? (
        <LockedValue label="Starts at episode" value={startEp} lock={canManage} />
      ) : (
        <StepperRow
          label="Starts at episode"
          hint={
            startEp > 1
              ? `Episodes 1–${startEp - 1} are already watched: shown, but nothing in them scores.`
              : "Start later if your league is joining a season partway through."
          }
          value={startEp}
          min={1}
          onChange={changeStart}
        />
      )}
    </>
  );

  const ownership = leagueType.hasRoster && (
    <>
      {ownershipLocked ? (
        <LockedValue
          label="Ownership"
          value={
            state.settings.ownershipMode === "shared"
              ? `Shared: the same ${terms.castaway} can be on several teams`
              : `Exclusive: each ${terms.castaway} on one team`
          }
          lock={canManage}
        />
      ) : (
        <Field
          label="Ownership"
          htmlFor="ls-ownership"
          hint={
            state.settings.ownershipMode === "shared"
              ? "Everyone picks privately (a blind draft), then all picks are revealed together. Nobody comes off the board, so there are no Pickups or Swaps."
              : `A snake draft, one turn at a time: each ${terms.castaway} belongs to one player.`
          }
        >
          <select
            id="ls-ownership"
            className={fieldCls}
            value={state.settings.ownershipMode}
            onChange={(e) => updateSetting("ownershipMode", e.target.value)}
          >
            <option value="exclusive">Exclusive</option>
            <option value="shared">Shared</option>
          </select>
        </Field>
      )}
      <OwnershipNudge state={state} castSize={selectedSeason?.castSize ?? null} seasonUnderway={seasonUnderway} />
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <Field label="League name" htmlFor="ls-name">
          <input
            id="ls-name"
            className={fieldCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </Field>
      ) : (
        <LockedValue label="League name" value={leagueName} lock={false} />
      )}

      {
        (showLocked ? (
          <LockedValue label="Show" value={showName} lock={canManage && seasonUnderway} />
        ) : (
          <Field label="Show" htmlFor="ls-show">
            <select id="ls-show" className={fieldCls} value={state.settings.showId ?? ""} onChange={(e) => changeShow(e.target.value)}>
              {!state.settings.showId && <option value="">Pick a show</option>}
              {shows.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
              {/* A show that's since been archived (or a catalog that hasn't loaded) still shows the
                  stored value rather than silently rendering a different show as selected. */}
              {state.settings.showId && !currentShow && (
                <option value={state.settings.showId}>
                  {state.settings.showId}
                  {shows.length > 0 ? " (not in catalog)" : ""}
                </option>
              )}
            </select>
          </Field>
        ))}

      {
        (!canManage || seasonUnderway ? (
          <LockedValue label="Season" value={seasonLabel(state.settings.wikiSeason)} lock={canManage} />
        ) : seasons.length > 0 && !typingSeason ? (
          <Field
            label="Season"
            htmlFor="ls-season"
            hint={
              selectedSeason?.castSize
                ? `${selectedSeason.castSize} ${selectedSeason.castSize === 1 ? terms.castaway : terms.castaways} in the show's catalog.`
                : undefined
            }
          >
            <select
              id="ls-season"
              className={fieldCls}
              value={state.settings.wikiSeason ?? ""}
              onChange={(e) => {
                if (e.target.value === "other") return setTypingSeason(true);
                updateSetting("wikiSeason", e.target.value ? parseInt(e.target.value) : null);
              }}
            >
              <option value="">Pick a season</option>
              {seasons.map((s) => (
                <option key={s.seasonNumber} value={s.seasonNumber}>
                  {s.name || `Season ${s.seasonNumber}`}
                  {s.status === "airing" ? " (airing)" : s.status === "upcoming" ? " (upcoming)" : ""}
                </option>
              ))}
              {seasonOffCatalog && <option value={state.settings.wikiSeason!}>Season {state.settings.wikiSeason}</option>}
              <option value="other">Another season…</option>
            </select>
          </Field>
        ) : (
          // No catalogued seasons for this show: a free-text number, so a league isn't blocked waiting
          // on an admin to add one.
          <Field label="Season number" htmlFor="ls-season-n">
            <input
              id="ls-season-n"
              type="number"
              inputMode="numeric"
              className={fieldCls}
              defaultValue={state.settings.wikiSeason ?? ""}
              placeholder="44"
              autoFocus={typingSeason}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const n = v === "" ? null : parseInt(v);
                if (n !== state.settings.wikiSeason) updateSetting("wikiSeason", Number.isFinite(n as number) ? n : null);
                setTypingSeason(false);
              }}
            />
          </Field>
        ))}

      {
        (typeLocked ? (
          <div className="flex flex-col gap-1">
            <LockedValue label="League type" value={leagueType.name} lock={canManage && seasonUnderway} />
            <p className="text-[13px] leading-snug text-muted-foreground">{leagueType.description}</p>
          </div>
        ) : (
          <Field label="League type" htmlFor="ls-type" hint={leagueType.description}>
            <select id="ls-type" className={fieldCls} value={leagueType.id} onChange={(e) => updateSetting("leagueTypeId", e.target.value)}>
              {Object.values(StateLogic.LEAGUE_TYPES).map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
          </Field>
        ))}

      {results}

      {leagueType.hasRoster && !canManage && (
        <LockedValue
          label="Draft date"
          value={
            state.settings.draftScheduledAt
              ? new Date(state.settings.draftScheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
              : "Not set"
          }
          lock={false}
        />
      )}
      {leagueType.hasRoster && canManage && (
        <Field
          label="Draft date"
          htmlFor="ls-draft"
          hint={state.draftForceStarted ? "The draft was started by hand, so the date no longer matters." : undefined}
        >
          <input
            id="ls-draft"
            type="datetime-local"
            className={fieldCls}
            defaultValue={state.settings.draftScheduledAt ? toLocalInput(state.settings.draftScheduledAt) : ""}
            onBlur={(e) => updateSetting("draftScheduledAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </Field>
      )}

      {/* Active Roster derives its roster size from its starters and bench (Lineups), so a separate
          number here would silently do nothing. */}
      {leagueType.hasRoster && !leagueType.hasActiveRoster && (
        <StepperRow
          label="Roster size"
          hint={`${terms.Castaways} each player drafts.`}
          value={state.settings.teamSize}
          min={1}
          disabled={!canManage}
          onChange={(n) => updateSetting("teamSize", n)}
        />
      )}

      {/* Set once, so they sit behind More options. */}
      {(startAt || ownership) && (
        <MoreOptions>
          {startAt}
          {ownership}
        </MoreOptions>
      )}

      {canManage && seasonUnderway && (
        <p className="text-[13px] leading-snug text-muted-foreground">
          Show, season, league type and ownership are locked because this league has started playing.
        </p>
      )}
    </div>
  );
}

// datetime-local wants the viewer's local time, not the stored UTC instant.
function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Setup-time nudge toward shared ownership ("critically suggested, not required"): advice, never a
// block, and only while exclusive is selected and the draft hasn't run. Exclusive ownership needs one
// distinct castaway per roster slot per player, so it's player count times roster size that runs a
// cast dry. The cast size compared against is the league's own cast when it has one, and otherwise the
// selected season's catalogued cast size.
function OwnershipNudge({
  state,
  castSize: catalogued,
  seasonUnderway,
}: {
  state: LeagueState;
  castSize: number | null;
  seasonUnderway: boolean;
}) {
  const terms = useShowTerms();
  if (state.settings.ownershipMode !== "exclusive" || seasonUnderway) return null;
  const seats = StateLogic.BlindDraftLogic.eligiblePlayers(state).length;
  const needed = seats * StateLogic.rosterSize(state);
  const castSize = state.castaways.length || catalogued || 0;
  const fromCatalog = state.castaways.length === 0 && !!catalogued;
  if (seats === 0) return null;
  if (castSize === 0) {
    return (
      <p className="-mt-3 text-[13px] leading-snug text-muted-foreground">
        Exclusive ownership needs {needed} different {terms.castaways} for {seats} player{seats === 1 ? "" : "s"}. If the cast is smaller
        than that, switch to shared.
      </p>
    );
  }
  if (needed > castSize) {
    return (
      <p className="-mt-3 text-[13px] font-semibold leading-snug text-live">
        {seats} players × {StateLogic.rosterSize(state)} picks needs {needed} {terms.castaways}, but{" "}
        {fromCatalog ? "this season has" : "the cast has"} {castSize}. The draft can&rsquo;t fill every team: switch to shared ownership, or
        make rosters smaller.
      </p>
    );
  }
  if (needed > castSize * 0.75) {
    return (
      <p className="-mt-3 text-[13px] leading-snug text-muted-foreground">
        {needed} of {castSize} {terms.castaways} would be taken, leaving little for Pickups or Swaps. Shared ownership is worth a look.
      </p>
    );
  }
  return null;
}
