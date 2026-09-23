"use client";

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
import { BackupSection } from "./backup-section";
import { LeaveLeagueSection } from "./leave-league-section";

// Port of renderSetup() (public/app.js) -- same section order and the same "viewable by everyone,
// only the commissioner can edit" model: every field below disables itself via useCanManage()
// rather than the whole tab being gated, matching the original's own banner/behavior exactly.
export function SetupTab() {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">League Settings</h2>
      {!canManage && (
        <p className="mb-4 text-sm text-muted-foreground">
          Viewable by everyone — only your commissioner (or an admin) can make changes here.
        </p>
      )}

      <LeagueInfoSection state={state} />
      <PlayersSection state={state} />
      <InvitesSection />
      <TribesSection state={state} />
      <CastawaysSection state={state} />
      <GeneralSettingsSection state={state} />
      <SideBetSettingsSection state={state} />
      <FinaleSettingsSection state={state} />
      <PickEmSettingsSection state={state} />
      <BackupSection state={state} />
      <LeaveLeagueSection />
    </>
  );
}
