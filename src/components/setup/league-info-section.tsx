"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { useShowCatalog, useShowTerms } from "@/lib/use-show-terms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InfoHint } from "@/components/info-hint";

// Port of renderSetup()'s League Name + Draft Schedule panels, plus the League Type / Show / Season
// pickers (not in the live app at all).
//
// League Type still comes from state-logic.js's LEAGUE_TYPES registry -- a league type is code (a
// draft strategy plus a scoring strategy), so it can only ever be what's been written.
//
// Shows and seasons, by contrast, are DATA: they come from the admin-managed catalog over
// /api/shows (db/migrations/0006_shows_and_seasons.sql), not from state-logic's SHOWS. That's what
// lets a super-admin add a show without a deploy. The Season picker is driven by the selected show's
// seasons, falling back to a free-text number when the catalog has none, so a league can still name
// a season the admin hasn't catalogued yet.
//
// GUIDED SETUP: on a brand-new league this panel is a short wizard rather than a form -- one
// question at a time, in the order SetupLogic defines (name, show, season, type, ownership), with a
// checklist above it and a confirm button at the end. Ordering and done-ness live in SetupLogic so
// they're testable without React; this file only renders them.
export function LeagueInfoSection({ state }: { state: LeagueState }) {
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

  const Setup = StateLogic.SetupLogic;
  const guiding = !Setup.isComplete(state);
  const basicsAnswered = Setup.basicsAnswered(state, leagueName);
  // While guiding, a step's control appears only once everything before it is answered. Afterwards
  // every control is simply visible, as it always was.
  const visible = (stepId: string) => !guiding || Setup.isStepVisible(state, leagueName, stepId);
  const revealedThrough = StateLogic.RevealLogic.revealedThrough(state);
  const catchingUp = revealedThrough !== null;
  const startEp = StateLogic.startEpisode(state);
  // Episodes before the start count as already watched, so a catching-up league that has revealed
  // only those hasn't really begun yet.
  const revealedPastStart = catchingUp && (revealedThrough ?? 0) > startEp - 1;

  // The catalog, not state-logic's SHOWS. Shared query with useShowTerms, so the Show picker and
  // every terminology label in the app come from one fetch. In mock mode there's no real session,
  // so this simply doesn't load and the picker falls back to showing the league's stored showId.
  const { data: catalog } = useShowCatalog();
  const shows = catalog?.shows ?? [];
  const currentShow = shows.find((s) => s.slug === state.settings.showId);
  const seasons = currentShow?.seasons ?? [];
  // A show's catalog isn't only an admin's any more: a commissioner researching an uncatalogued season
  // adds it (db/episode-research.js ensureSeasonRow). So a show having SOME catalogued seasons no longer
  // means the league's own is among them -- the list keeps an off-catalog pick, and offers to type one.
  const seasonOffCatalog = state.settings.wikiSeason != null && !seasons.some((s) => s.seasonNumber === state.settings.wikiSeason);
  // Locked when there's nothing to choose between -- one show (or none loaded) means the picker
  // would be decorative, same reasoning the League Type picker uses. Never locked while guiding,
  // though: "pick the show" is a step the commissioner has to be able to answer even if the answer
  // is the only show in the catalog.
  const showLocked = !canManage || seasonUnderway || (!guiding && shows.length <= 1);
  const typeLocked =
    !canManage || seasonUnderway || (!guiding && Object.keys(StateLogic.LEAGUE_TYPES).length <= 1);
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
    // The name lives outside league state (it's a column on `leagues`, not a field in the JSONB),
    // so the mutate() above updates nothing the sidebar reads -- the switcher and the mobile top
    // bar both render store.leagues/leagueName, which only ever came from GET /api/me on load.
    // Without this the rename didn't show up anywhere in the chrome until a reload.
    if (leagueId) renameLeagueLocally(leagueId, trimmed);
  }

  async function updateSetting(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  // Seasons belong to a show, so a season number carried across a show change is meaningless --
  // "44" means Survivor 44, not Traitors 44. Clearing it also re-opens the season step in the guide,
  // which is the correct thing to ask next.
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
  async function changeStart(value: string) {
    const n = Math.max(1, Math.floor(Number(value)) || 1);
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

  async function finishSetup() {
    await mutate(
      (s) => StateLogic.SetupLogic.complete(s),
      () => api.updateLeagueSettings(leagueId!, "setupComplete", true)
    );
  }

  const selectedSeason = seasons.find((x) => x.seasonNumber === state.settings.wikiSeason);

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        {guiding ? "Set up your league" : "League Info"}
      </h3>

      {/* One question at a time (via `visible()` below, driven by SetupLogic.isStepVisible) still
          needs some indication the league isn't playable yet -- a plain warning line rather than a
          checklist that had to be read closely to understand. */}
      {guiding && (
        <p className="mb-3 text-xs font-semibold text-primary">
          Finish the fields below before you can start your league.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          Name:
          <Input value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </label>
      </div>

      {/* Draft schedule isn't one of the basics, so it waits until the guide is done -- a date for a
          draft is meaningless before the league type that decides whether there IS a draft. */}
      {!guiding && leagueType.hasRoster && (
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
        {visible("show") && (
          <label className="flex items-center gap-1.5 text-sm">
            Show:
            <Select value={state.settings.showId ?? ""} disabled={showLocked} onChange={(e) => changeShow(e.target.value)}>
              {/* A new league genuinely hasn't picked one, so say so rather than showing the first
                  show as though it were chosen. */}
              {!state.settings.showId && <option value="">— pick a show —</option>}
              {shows.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
              {/* If the catalog hasn't loaded (mock mode) or the league points at a show that's since
                  been archived, still show the stored value rather than silently rendering a
                  different show as selected. */}
              {state.settings.showId && !currentShow && (
                <option value={state.settings.showId}>
                  {state.settings.showId}
                  {shows.length > 0 ? " (not in catalog)" : ""}
                </option>
              )}
            </Select>
          </label>
        )}

        {visible("season") && (
          <label className="flex items-center gap-1.5 text-sm">
            Season:
            {seasons.length > 0 && !typingSeason ? (
              <Select
                value={state.settings.wikiSeason ?? ""}
                disabled={!canManage}
                onChange={(e) => {
                  if (e.target.value === "other") return setTypingSeason(true);
                  updateSetting("wikiSeason", e.target.value ? parseInt(e.target.value) : null);
                }}
              >
                <option value="">— pick a season —</option>
                {seasons.map((s) => (
                  <option key={s.seasonNumber} value={s.seasonNumber}>
                    {s.name || `Season ${s.seasonNumber}`}
                    {s.status === "airing" ? " (airing)" : s.status === "upcoming" ? " (upcoming)" : ""}
                  </option>
                ))}
                {seasonOffCatalog && <option value={state.settings.wikiSeason!}>Season {state.settings.wikiSeason}</option>}
                <option value="other">Another season…</option>
              </Select>
            ) : (
              // No catalogued seasons for this show: keep a free-text number so a league isn't
              // blocked waiting on an admin to add one. The connector will guess a page title for it.
              <Input
                type="number"
                className="w-20"
                disabled={!canManage}
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
            )}
          </label>
        )}

        {visible("type") && (
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
        )}

        {/* Catch-up mode (StateLogic.RevealLogic). Asked during guided setup because it's a decision
            about a season that may already be in progress, and it stops being worth anything the
            moment the connector has filed the results the league was trying not to see. Locked once
            something has been revealed -- there's no putting an episode back. */}
        {visible("pace") && state.settings.wikiSeason != null && (
          <label className="flex items-center gap-1.5 text-sm">
            Results:
            <Select
              value={catchingUp ? "catchup" : "live"}
              disabled={!canManage || revealedPastStart}
              onChange={(e) => updateSetting("revealedThroughEpisode", e.target.value === "catchup" ? startEp - 1 : null)}
            >
              <option value="live">Live — as the wiki has them</option>
              <option value="catchup">Catch up — reveal one episode at a time</option>
            </Select>
          </label>
        )}

        {/* A league formed mid-season: episodes before this are ones everyone has watched -- shown,
            but not scored, and no picks or lineups for them. Locked once the league has started
            playing, like the other basics. */}
        {visible("pace") && state.settings.wikiSeason != null && (
          <label className="flex items-center gap-1.5 text-sm">
            Starts at episode:
            <Input
              key={startEp}
              type="number"
              min={1}
              className="w-16"
              defaultValue={startEp}
              disabled={!canManage || seasonUnderway || revealedPastStart}
              onBlur={(e) => changeStart(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          </label>
        )}

        {visible("ownership") && leagueType.hasRoster && (
          <label className="flex items-center gap-1.5 text-sm">
            Ownership:
            <InfoHint
              text={`Exclusive: a snake draft, one turn at a time — each ${terms.castaway} belongs to a single player. Shared: everyone picks privately (a blind draft) and the same ${terms.castaway} can end up on more than one team.`}
            />
            <Select
              value={state.settings.ownershipMode}
              disabled={ownershipLocked}
              onChange={(e) => updateSetting("ownershipMode", e.target.value)}
            >
              <option value="exclusive">Exclusive</option>
              <option value="shared">Shared</option>
            </Select>
          </label>
        )}
      </div>

      {/* The catalogued cast size makes the shared-ownership nudge below concrete before anyone has
          entered a cast -- that check previously had nothing to compare against. */}
      {selectedSeason?.castSize ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {selectedSeason.name || `Season ${selectedSeason.seasonNumber}`} has {selectedSeason.castSize}{" "}
          {selectedSeason.castSize === 1 ? terms.castaway : terms.castaways} per the show catalog.
        </p>
      ) : null}

      {visible("type") && <p className="mt-2 text-xs text-muted-foreground">{leagueType.description}</p>}
      {/* Say why, rather than leaving a greyed-out picker to be puzzled over. */}
      {canManage && seasonUnderway && (
        <p className="mt-1 text-xs text-muted-foreground">
          Show, league type and ownership are locked because this league has started playing (the draft has begun, or
          picks or lineups have been made).
        </p>
      )}

      {visible("pace") && state.settings.wikiSeason != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {catchingUp
            ? !revealedPastStart
              ? `Catching up: this league plays from episode ${startEp} whatever the wiki already knows. Reveal episodes one at a time from the Episodes tab.`
              : `Catching up: revealed through episode ${revealedThrough}. Locked now that the season has started — reveal the rest from the Episodes tab.`
            : `Live: results are offered for review as soon as the connector reads them. Switch to catch up if your league is starting a season that has already aired episodes.`}
          {startEp > 1 &&
            ` Starts at episode ${startEp}: episodes 1–${startEp - 1} are ones you've already watched — shown, but nothing in them scores, and ${terms.castaways} already out can't be drafted or picked.`}
        </p>
      )}

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
      {visible("ownership") && leagueType.hasRoster && state.settings.ownershipMode === "exclusive" && !seasonUnderway && (() => {
        const seats = StateLogic.BlindDraftLogic.eligiblePlayers(state).length;
        const needed = seats * StateLogic.rosterSize(state);
        const catalogued = selectedSeason?.castSize ?? null;
        const castSize = state.castaways.length || catalogued || 0;
        const fromCatalog = state.castaways.length === 0 && !!catalogued;
        if (seats === 0) return null;
        if (castSize === 0) {
          return (
            <p className="mt-1 text-xs text-muted-foreground">
              Exclusive ownership needs {needed} distinct {terms.castaways} for {seats} player
              {seats === 1 ? "" : "s"}. Once you&rsquo;ve entered the cast (or picked a season), switch to shared
              ownership if that doesn&rsquo;t fit.
            </p>
          );
        }
        if (needed > castSize) {
          return (
            <p className="mt-1 text-xs font-semibold text-destructive">
              {seats} players x {StateLogic.rosterSize(state)} roster slots needs {needed} {terms.castaways}, but{" "}
              {fromCatalog ? "this season has" : "the cast has"} {castSize}. The draft can&rsquo;t fill every roster —
              switch to shared ownership, or reduce roster size.
            </p>
          );
        }
        if (needed > castSize * 0.75) {
          return (
            <p className="mt-1 text-xs text-muted-foreground">
              Heads up: {needed} of {castSize} {terms.castaways} would be claimed, leaving little room for Pickups
              or Swap. Shared ownership is worth considering.
            </p>
          );
        }
        return null;
      })()}

      {visible("ownership") && leagueType.hasRoster && state.settings.ownershipMode === "shared" && (
        <p className="mt-1 text-xs text-muted-foreground">
          Everyone picks privately, then all picks are revealed together once everyone has locked in. Nobody is ever
          removed from the board, so there&rsquo;s no Pickups or Swap in this mode.
        </p>
      )}

      {/* Ends the guide. Only offered once every question is answered, and only to someone who can
          actually change these -- a member watching a league being set up gets the checklist, not
          the button. There's no "skip": the five answers are cheap, and skipping them is what
          produced a league full of the wrong show's cast. */}
      {guiding && canManage && (
        <div className="mt-3 border-t border-border pt-3">
          {basicsAnswered ? (
            <Button onClick={finishSetup}>Looks good — open the rest of League Settings</Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Answer the highlighted step to continue. Nothing here is locked in — you can change any of it until
              the draft runs or the first episode is logged.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
