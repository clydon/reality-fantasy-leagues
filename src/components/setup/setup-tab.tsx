"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Calculator, Download, Flag, LayoutGrid, Link2, Shield, Target, TriangleAlert, Users } from "lucide-react";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { useLeagueStore, useCanManage, useIsSuperAdmin } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { commissionerItems } from "@/lib/game/commissioner-items";
import { api } from "@/lib/api";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { cn } from "cn";
import { IndexRow, RowList } from "./settings-ui";
import { LeaveLeagueButton } from "./leave-league-section";
import { ResetLeagueButton } from "./backup-section";

// League Settings as a list of pages (docs/PLAN-ux-redesign.md, 2b; the canvas's "Settings-Index"):
// the join code, then one row per page, each showing its current value so the list doubles as a
// summary, then a collapsed Danger zone. Each page has its own URL under /setup, so the alert strip
// and pushes can link straight to one.
//
// Still "viewable by everyone, only the commissioner can edit": every page renders for a member, with
// its controls disabled (useCanManage) rather than hidden.
//
// There's no guided setup here any more: the create-league flow (/new-league) asks for the show,
// season, type and name before the league exists.
export function SetupTab() {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <h2 className="type-caption text-[28px] max-nav:hidden">League Settings</h2>
      {!canManage && (
        <p className="text-sm text-muted-foreground">Viewable by everyone. Only your commissioner (or an admin) can make changes.</p>
      )}
      <JoinCode />
      <SettingsList state={state} />
      <DangerZone />
    </div>
  );
}

function SettingsList({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const type = StateLogic.getLeagueType(state);
  const s = state.settings;
  const live = mode === "live" && !!leagueId;

  // Same query the Linked leagues page reads, so opening it is instant.
  const { data: links } = useQuery({
    queryKey: ["league-link", leagueId],
    queryFn: () => api.getLeagueLinks(leagueId!),
    enabled: live,
  });
  const showLinks = !!links && (links.linked.length > 0 || (canManage && links.candidates.length > 0));
  // Invites still waiting are part of the Players row's value, not a to-do (the same query Overview's
  // old commissioner list read).
  const { data: invites } = useQuery({
    queryKey: ["league-invites", leagueId],
    queryFn: () => api.listLeagueInvites(leagueId!),
    enabled: live,
    staleTime: 60_000,
  });
  const waiting = (invites?.invites ?? []).filter((inv) => inv.status === "pending").length;
  // The commissioner's to-dos (lib/game/commissioner-items.ts) as chyron dots on the rows that fix
  // them; the one that blocks the league is also Overview's status plate.
  const todo = new Set(canManage ? commissionerItems(state).map((it) => it.id) : []);

  const seats = state.players.filter((p) => !p.disabled);
  const inactive = seats.filter((p) => p.active === false).length;
  const catchingUp = StateLogic.RevealLogic.revealedThrough(state) !== null;
  const setupLine = [
    terms.showName && s.wikiSeason != null ? `${terms.showName} ${s.wikiSeason}` : (terms.showName ?? null),
    type.name,
    s.wikiSeason != null ? (catchingUp ? "catch-up results" : "live results") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pendingChanges = type.hasActiveRoster && canManage ? StateLogic.RuleChangeLogic.pending(state).length : 0;
  const rulesLine = type.hasActiveRoster
    ? [
        s.leagueRulesetData ? "Your own rules" : `${StateLogic.formatOf(state).name}'s rules`,
        changedPoints(state) > 0 ? `${changedPoints(state)} points changed` : null,
        pendingChanges > 0 ? `${pendingChanges} rule change${pendingChanges === 1 ? "" : "s"} to review` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : type.hasWeeklyPicks
      ? `${s.pickemCorrectPoints} point${s.pickemCorrectPoints === 1 ? "" : "s"} per correct pick`
      : `A point per elimination outlasted · ${StateLogic.rosterSize(state)} per team`;

  const midSeason = type.supportsReplenish || type.supportsTrade;
  const predLine = [
    s.bonusEnabled ? "Predictions on" : "Predictions off",
    type.supportsFinalePredictions ? (s.finalePredictionsEnabled ? "finale on" : "finale off") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <RowList>
      <IndexRow
        href="/setup/players"
        icon={Users}
        title="Players & invites"
        value={[
          `${seats.length} player${seats.length === 1 ? "" : "s"}`,
          inactive ? `${inactive} to activate` : null,
          waiting ? `${waiting} invite${waiting === 1 ? "" : "s"} waiting` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        alert={canManage && (inactive > 0 || todo.has("players"))}
      />
      <IndexRow href="/setup/league" icon={Flag} title="League setup" value={setupLine} alert={todo.has("draft")} />
      {type.hasActiveRoster && (
        <IndexRow
          href="/setup/lineups"
          icon={LayoutGrid}
          title="Lineups"
          value={`${s.activeSlots} starter${s.activeSlots === 1 ? "" : "s"}, ${s.benchSlots} bench${s.hideStartersUntilLock ? " · hidden until airtime" : ""}`}
        />
      )}
      <IndexRow href="/setup/rules" icon={Calculator} title="Scoring & rules" value={rulesLine} alert={pendingChanges > 0} />
      {/* Pickups and add/drops, run as waivers (docs/PLAN-midseason-waivers.md), shared ownership included. */}
      {midSeason && (
        <IndexRow
          href="/setup/waivers"
          icon={ArrowLeftRight}
          title="Waivers"
          value={
            [
              StateLogic.replenishAvailable(state) ? "Pickups" : null,
              StateLogic.tradeAvailable(state) ? `add/drops every ${StateLogic.MidSeasonLogic.swapEvery(state)}` : null,
            ]
              .filter(Boolean)
              .join(", ")
              .replace(/^a/, "A") || "Off"
          }
        />
      )}
      <IndexRow href="/setup/predictions" icon={Target} title="Predictions" value={predLine} />
      <IndexRow
        href="/setup/cast"
        icon={Shield}
        title={`${terms.Tribes} & ${terms.castaways}`}
        value={`${state.tribes.length} ${state.tribes.length === 1 ? terms.tribe : terms.tribes} · ${state.castaways.length} ${state.castaways.length === 1 ? terms.castaway : terms.castaways}`}
      />
      {showLinks && (
        <IndexRow
          href="/setup/linked"
          icon={Link2}
          title="Linked leagues"
          value={links!.linked.length ? `Linked with ${links!.linked.map((l) => l.name).join(", ")}` : "Not linked"}
        />
      )}
      <IndexRow href="/setup/backup" icon={Download} title="Backup" value="Download or restore this league" />
    </RowList>
  );
}

// How many events this league scores differently from the recommended values.
function changedPoints(state: LeagueState) {
  const rec = StateLogic.defaultEventPoints(state);
  return Object.keys(rec).filter((id) => StateLogic.ActiveRosterLogic.pointsFor(state, id) !== rec[id]).length;
}

// The league's join code as a caption plate, with Share (the phone's share sheet, or a copy).
function JoinCode() {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const code = useLeagueStore((s) => s.leagues.find((l) => l.id === s.leagueId)?.join_code);
  const [copied, setCopied] = useState(false);
  if (!leagueId || !code) return null;

  async function share() {
    const text = `Join ${leagueName ?? "my league"}: use code ${code} at ${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(code!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* share sheet dismissed, or clipboard blocked: the code is on screen anyway */
    }
  }

  return (
    // Quiet, not chyron: the code isn't "now" or "yours", and the alert strip above may already be yellow.
    <CaptionPlate
      tone="quiet"
      tag={
        <>
          Join
          <br />
          code
        </>
      }
      title={<span className="text-[30px] tracking-[0.08em]">{code}</span>}
      subtitle="Anyone with the code can join"
      action={copied ? "Copied" : "Share"}
      onClick={share}
      aria-label={`Join code ${code}. Share it`}
    />
  );
}

// Page-level destructive actions, collapsed at the bottom (plan 1c): Leave league, and for a site
// admin, Reset all data.
function DangerZone() {
  const [open, setOpen] = useState(false);
  const mode = useLeagueStore((s) => s.mode);
  const membership = useLeagueStore((s) => s.membership);
  const isSuperAdmin = useIsSuperAdmin();
  const canLeave = mode === "live" && !!membership?.playerId;
  const canReset = mode === "live" && isSuperAdmin;
  if (!canLeave && !canReset) return null;
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-12 items-center gap-2 rounded-[3px] border border-live/35 px-4 text-[15px] font-bold text-live hover:bg-live/10 focus-visible:outline-3 focus-visible:outline-chyron-line"
        )}
      >
        <TriangleAlert className="size-[18px]" strokeWidth={2.2} aria-hidden />
        <span className="flex-1 text-left">Danger zone</span>
        <span className="text-sm font-semibold text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 pb-2">
          {canLeave && <LeaveLeagueButton />}
          {canReset && <ResetLeagueButton />}
        </div>
      )}
    </div>
  );
}
