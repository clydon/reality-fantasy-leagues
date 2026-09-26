"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { LeagueInfoSection } from "./league-info-section";
import { PlayersSection } from "./players-section";
import { InvitesSection } from "./invites-section";
import { TribesSection } from "./tribes-section";
import { CastawaysSection } from "./castaways-section";
import { GeneralSettingsSection } from "./general-settings-section";
import { SideBetSettingsSection } from "./side-bet-settings-section";
import { FinaleSettingsSection } from "./finale-settings-section";
import { PickEmSettingsSection } from "./pickem-settings-section";
import { ActiveRosterSettingsSection } from "./active-roster-settings-section";
import { WikiConnectorSection } from "./wiki-connector-section";
import { BackupSection } from "./backup-section";
import { LeaveLeagueSection } from "./leave-league-section";

// Port of renderSetup() (public/app.js) -- same section order and the same "viewable by everyone,
// only the commissioner can edit" model: every field below disables itself via useCanManage()
// rather than the whole tab being gated, matching the original's own banner/behavior exactly.
//
// ADDED since the port: guided first-time setup. A brand-new league lands here (not on Overview)
// and sees only League Info until the five basics are answered -- name, show, season, league type,
// ownership. Everything downstream of those stays hidden, because it all depends on them: there's no
// point entering a cast before the season is known, and the Pick'em/Active Roster/finale panels are
// each specific to a league type that hasn't been chosen yet.
//
// The gate is SetupLogic.isComplete (state-logic.js), which is false only for leagues created after
// this shipped -- an established league sees the whole tab exactly as before.
export function SetupTab() {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();

  const guiding = !StateLogic.SetupLogic.isComplete(state);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">League Settings</h2>
      {!canManage && (
        <p className="mb-4 text-sm text-muted-foreground">
          Viewable by everyone — only your commissioner (or an admin) can make changes here.
        </p>
      )}

      <InvitesSection />
      <LeagueInfoSection state={state} />

      {/* While guiding, LeagueInfoSection owns the whole screen: it renders its own warning line,
          reveals one question at a time, and carries the button that ends the gate. Showing Players
          or Castaways alongside it is exactly the "everything at once" the guide exists to avoid. */}
      {!guiding && (
        <>
          {/* Scoring-related sections come right after League Info -- the settings people actually
              tune during a season, ahead of roster/cast management they touch once at draft time. */}
          <GeneralSettingsSection state={state} />
          <SideBetSettingsSection state={state} />
          <FinaleSettingsSection state={state} />
          <PickEmSettingsSection state={state} />
          <ActiveRosterSettingsSection state={state} />
          <PlayersSection state={state} />
          <TribesSection state={state} />
          <CastawaysSection state={state} />
          <WikiConnectorSection state={state} />
          <BackupSection state={state} />
        </>
      )}
      {/* Always available: leaving a league can't be gated behind finishing its setup. */}
      <LeaveLeagueSection />
    </>
  );
}
