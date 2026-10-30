"use client";

import type { ReactNode } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { MAX_BENCH, MAX_STARTERS, MAX_TEAM } from "@/lib/game/game-spec/index.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { useShowCatalog, useShowTerms } from "@/lib/use-show-terms";
import { Segmented } from "@/components/waivers/waiver-controls";
import { cn } from "cn";
import { Field, GroupHead, LockedValue, ReadOnlyNote, RowList, SettingsPage, StepperRow, ToggleRow, fieldCls } from "./settings-ui";

// League Settings > Teams & draft (docs/PLAN-settings-order.md). The settings that decide how many teams
// the cast can feed, in the order the arithmetic runs: who owns a castaway (shared or exclusive), how big
// a team is (the roster, or the starters and bench), what that leaves of the cast (the fit line), then when
// the draft is. They used to be spread over League setup (behind "More options"), Lineups and a roster
// stepper, and the waiver suggestion at the end of the chain is worked out from all of them.
export function TeamsDraftPage() {
  const state = useLeagueStore((s) => s.state);
  const type = StateLogic.getLeagueType(state);
  if (!type.hasRoster) {
    return (
      <SettingsPage title="Teams & draft">
        <p className="text-base text-muted-foreground">This league has no draft: every player picks each episode.</p>
      </SettingsPage>
    );
  }
  return (
    <SettingsPage title="Teams & draft">
      <ReadOnlyNote />
      <TeamsDraftForm state={state} />
    </SettingsPage>
  );
}

function TeamsDraftForm({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const terms = useShowTerms();
  const type = StateLogic.getLeagueType(state);
  const s = state.settings;
  const shared = s.ownershipMode === "shared";
  // Same lock the League setup page used: flipping ownership mid-draft would swap the draft mechanic out
  // from under picks already made.
  const ownershipLocked = !canManage || StateLogic.seasonUnderway(state);
  const draftStarted = StateLogic.isDraftStarted(state);

  const { data: catalog } = useShowCatalog();
  const season = catalog?.shows.find((x) => x.slug === s.showId)?.seasons.find((x) => x.seasonNumber === s.wikiSeason);

  async function update(field: string, value: unknown) {
    await mutate(
      (st) => StateLogic.updateSettings(st, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value)
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4" aria-label="Teams">
        <GroupHead>Teams</GroupHead>
        {ownershipLocked ? (
          <LockedValue
            label="Ownership"
            value={shared ? `Shared: the same ${terms.castaway} can be on several teams` : `Exclusive: each ${terms.castaway} on one team`}
            lock={canManage}
          />
        ) : (
          <div className="flex flex-col gap-1.5" data-tour="ownership">
            <span className="text-sm font-semibold">Ownership</span>
            <Segmented
              label="Ownership"
              value={shared ? "shared" : "exclusive"}
              onChange={(v) => update("ownershipMode", v)}
              options={[
                { value: "exclusive", label: "Exclusive" },
                { value: "shared", label: "Shared" },
              ]}
            />
            <p className="text-[13px] leading-snug text-muted-foreground">
              {shared
                ? `A blind draft: everyone picks privately, then all picks are revealed together. The same ${terms.castaway} can be on several teams, so the cast never runs out.`
                : `A snake draft, one turn at a time: each ${terms.castaway} belongs to one player, so the cast sets how many players fit.`}
            </p>
          </div>
        )}

        <RowList>
          {type.hasActiveRoster ? (
            <>
              <StepperRow label="Starters" hint="Score each episode" value={s.activeSlots} min={1} max={Math.max(MAX_STARTERS, s.activeSlots)} disabled={!canManage} onChange={(n) => update("activeSlots", n)} />
              <StepperRow label="Bench" hint="Drafted, but score nothing until started" value={s.benchSlots} min={0} max={Math.max(MAX_BENCH, s.benchSlots)} disabled={!canManage} onChange={(n) => update("benchSlots", n)} />
            </>
          ) : (
            <StepperRow label="Roster size" hint={`${terms.Castaways} each player drafts`} value={s.teamSize} min={1} max={Math.max(MAX_TEAM, s.teamSize)} disabled={!canManage} onChange={(n) => update("teamSize", n)} />
          )}
        </RowList>

        <FitLine state={state} catalogued={season?.castSize ?? null} />
      </section>

      <section className="flex flex-col gap-4" aria-label="Draft">
        <GroupHead>Draft</GroupHead>
        {canManage ? (
          <Field
            label="Draft date"
            htmlFor="td-draft"
            hint={
              state.draftForceStarted
                ? "The draft was started by hand, so the date no longer matters."
                : draftStarted
                  ? "The draft is underway."
                  : "The draft opens on its own then. Leave it empty to start it yourself from Draft."
            }
          >
            <input
              id="td-draft"
              type="datetime-local"
              className={fieldCls}
              defaultValue={s.draftScheduledAt ? toLocalInput(s.draftScheduledAt) : ""}
              onBlur={(e) => update("draftScheduledAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </Field>
        ) : (
          <LockedValue
            label="Draft date"
            value={s.draftScheduledAt ? new Date(s.draftScheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not set"}
            lock={false}
          />
        )}
        {type.hasActiveRoster && (
          <RowList>
            <ToggleRow
              label="Hide starters until airtime"
              hint="Others only see whether you've set your lineup until it locks when the episode airs, so nobody can copy it."
              checked={!!s.hideStartersUntilLock}
              disabled={!canManage}
              onChange={(v) => update("hideStartersUntilLock", v)}
            />
          </RowList>
        )}
      </section>
    </div>
  );
}

/**
 * What the cast can feed: how many teams fit, and what the players so far leave over (the free agents
 * waivers draw on). A line, not a card, and red only when the draft couldn't fill every team.
 */
function FitLine({ state, catalogued }: { state: LeagueState; catalogued: number | null }) {
  const terms = useShowTerms();
  const shared = state.settings.ownershipMode === "shared";
  const roster = StateLogic.rosterSize(state);
  const seats = StateLogic.BlindDraftLogic.eligiblePlayers(state).length;
  const castSize = state.castaways.length || catalogued || 0;
  const fromCatalog = state.castaways.length === 0 && !!catalogued;

  if (shared) {
    return <Line>Shared teams can all pick the same {terms.castaways}, so any number of players fits.</Line>;
  }
  if (castSize === 0) {
    return (
      <Line>
        Each player takes {roster} different {terms.castaways}. Once the cast is in, this shows how many players it can feed.
      </Line>
    );
  }
  const room = Math.floor(castSize / Math.max(1, roster));
  const needed = seats * roster;
  const left = castSize - needed;
  const cast = `${castSize} ${terms.castaways}${fromCatalog ? " in this season" : ""}`;
  if (seats > room) {
    return (
      <Line tone="live">
        {cast} feed {room} {room === 1 ? "team" : "teams"} of {roster}, and {seats} {seats === 1 ? "player is" : "players are"} in. The draft can&rsquo;t fill every team: switch to
        shared ownership, or make rosters smaller.
      </Line>
    );
  }
  const tight = needed > castSize * 0.75;
  return (
    <Line tone={tight ? "strong" : "plain"}>
      {cast}: room for {room} {room === 1 ? "team" : "teams"} of {roster}.
      {seats > 0 && (
        <>
          {" "}
          {seats} {seats === 1 ? "player so far takes" : "players so far take"} {needed}, leaving {left} free for waivers.
        </>
      )}
      {tight && " That is tight. Shared ownership avoids running the cast dry."}
    </Line>
  );
}

function Line({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "strong" | "live" }) {
  return (
    <p className={cn("text-[13px] leading-snug", tone === "live" ? "font-semibold text-live" : tone === "strong" ? "text-foreground" : "text-muted-foreground")}>
      {children}
    </p>
  );
}

// datetime-local wants the viewer's local time, not the stored UTC instant.
function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
