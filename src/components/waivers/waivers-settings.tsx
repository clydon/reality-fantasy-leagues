"use client";

import { useState } from "react";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { useShowTerms } from "@/lib/use-show-terms";
import { Field, LockedValue, NotInThisLeague, ReadOnlyNote, RowList, SettingsPage, StepperRow, ToggleRow, fieldCls } from "@/components/setup/settings-ui";
import { SectionHead } from "@/components/draft/draft-ui";
import { cn } from "cn";
import { RulesSheet } from "./rules-sheet";
import { addDropEpisodes, andList } from "./waivers-model";

// League Settings › Waivers (the canvas's board 9): what's on, when waivers process, the order and
// free agency -- then a preview of the week players see, and the "How waivers work" sheet written
// from these same settings. Replaces Swaps & pickups for a league on waivers.

const ORDER = {
  rolling: "Rolling, from reverse draft order",
  leastPoints: "By standings, fewest points first",
  mostPoints: "By standings, most points first",
};
const HOURS = [12, 24, 48];

export function WaiversSettingsPage() {
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const terms = useShowTerms();
  const [preview, setPreview] = useState(false);
  const W = StateLogic.WaiverLogic;

  async function update(field: string, value: unknown) {
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value),
    );
  }

  const type = StateLogic.getLeagueType(state);
  if (!type.supportsReplenish && !type.supportsTrade) {
    return (
      <SettingsPage title="Waivers">
        <NotInThisLeague what="pickups or add/drops" />
      </SettingsPage>
    );
  }
  const activeRoster = !!type.hasActiveRoster;
  const pickups = StateLogic.replenishAvailable(state);
  const addDrops = StateLogic.tradeAvailable(state);
  const anyOn = pickups || addDrops;
  const every = StateLogic.MidSeasonLogic.swapEvery(state);
  const weeks = addDropEpisodes(state);
  const H = W.processHours(state);
  const fa = W.freeAgencyOn(state);
  const orderBy = (state.settings.replenishOrderBy || "rolling") as keyof typeof ORDER;
  const catchUp = Number.isInteger(state.settings.revealedThroughEpisode);
  const shared = state.settings.ownershipMode === "shared";
  const replenishAt = StateLogic.MidSeasonLogic.replenishAt(state);

  return (
    <SettingsPage title="Waivers">
      <ReadOnlyNote />
      <RowList>
        {type.supportsReplenish && (
          <ToggleRow
            label="Pickups"
            hint={
              activeRoster
                ? `When a roster runs low on ${terms.castaways} still in the game, its owner picks up free agents to fill it again.`
                : `When one of a player's ${terms.castaways} leaves, they pick up a free agent to replace them.`
            }
            checked={state.settings.replenishEnabled}
            disabled={!canManage}
            onChange={(v) => update("replenishEnabled", v)}
          />
        )}
        {activeRoster && pickups && (
          <StepperRow
            label="Pick up when down to"
            hint={`${terms.Castaways} still in the game. Default ${Math.max(0, state.settings.activeSlots - 1)}: the moment a team can't fill all ${state.settings.activeSlots} starting spots.`}
            value={replenishAt}
            min={0}
            disabled={!canManage}
            onChange={(n) => update("replenishAt", n)}
          />
        )}
        {type.supportsTrade && (
          <ToggleRow
            label="Add/drops"
            hint={`Drop one ${terms.castaway} still in and add a free agent. Optional for each player.`}
            checked={state.settings.tradeEnabled}
            disabled={!canManage}
            onChange={(v) => update("tradeEnabled", v)}
          />
        )}
        {addDrops && (
          <StepperRow
            label="Add/drops every"
            hint={`${every === 1 ? "episode" : "episodes"}${weeks.length ? `: after ${andList(weeks.slice(0, 5))}${weeks.length > 5 ? "…" : ""}` : ""}. Default 3: enough to fix a bad pick without chasing every result.`}
            value={every}
            min={1}
            disabled={!canManage}
            onChange={(n) => update("swapEvery", n)}
          />
        )}
      </RowList>

      {anyOn &&
        (canManage ? (
          <>
            <Field
              label="Waivers process"
              htmlFor="wv-hours"
              hint={
                catchUp
                  ? `In a catch-up league, waivers process this long after you apply an episode's results, and free agency runs until you unlock the next one.`
                  : `Waivers open as soon as an episode's results are applied; ${fa ? "free agency runs from processing until the next episode airs" : "nothing changes between processing and airtime"}. A league with no air schedule processes this long after waivers open.`
              }
            >
              <select id="wv-hours" className={fieldCls} value={H} onChange={(e) => update("waiverProcessHours", Number(e.target.value))}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h} hours before the next episode
                  </option>
                ))}
              </select>
            </Field>
            {!shared && (
            <Field
              label="Waiver order"
              htmlFor="wv-order"
              hint={
                (orderBy === "rolling"
                  ? "Starts with the draft's last pick; anyone whose claim goes through drops to the back. Or reset every week by standings."
                  : "Reset every week by the standings. Or rolling: anyone whose claim goes through drops to the back.") +
                (shared ? " In a shared league nobody's taken off the board, so the order never decides who gets someone." : "")
              }
            >
              <select id="wv-order" className={fieldCls} value={orderBy} onChange={(e) => update("replenishOrderBy", e.target.value)}>
                {Object.entries(ORDER).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            )}
            <Field
              label="Free agency"
              htmlFor="wv-fa"
              hint={`First come, first served for anyone still free, including ${terms.castaways} just dropped in waivers.${shared ? "" : " Free-agency moves don't change the waiver order."} Or turn it off: waivers only, and an unfilled pickup is assigned when the episode airs.`}
            >
              <select id="wv-fa" className={fieldCls} value={fa ? "on" : "off"} onChange={(e) => update("freeAgencyEnabled", e.target.value === "on")}>
                <option value="on">Until the episode airs</option>
                <option value="off">Off: waivers only</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <LockedValue label="Waivers process" value={`${H} hours before the next episode`} lock={false} />
            {!shared && <LockedValue label="Waiver order" value={ORDER[orderBy] ?? orderBy} lock={false} />}
            <LockedValue label="Free agency" value={fa ? "Until the episode airs" : "Off: waivers only"} lock={false} />
          </>
        ))}

      {anyOn && (
        <section className="flex flex-col gap-2.5">
          <SectionHead>What your players see</SectionHead>
          <div className="flex flex-col gap-3 rounded-[3px] border border-border bg-card p-3.5">
            <h4 className="type-caption text-[17px]">A normal week</h4>
            <ol className="flex gap-1">
              {[
                [catchUp ? "You unlock" : "You apply", "Waivers open"],
                ["Until then", "Private claims"],
                [catchUp ? "Then" : `${H}h before`, "Waivers process"],
                ...(fa ? [[catchUp ? "Till next" : "Till airtime", "Free agency"]] : [[catchUp ? "Next" : "Airtime", "Episode airs"]]),
              ].map(([when, what], i) => (
                <li key={i} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className={cn("h-1 rounded-[1px]", i === 0 ? "bg-chyron-line" : "bg-input")} />
                  <span className="truncate text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground">{when}</span>
                  <span className="text-[13px] leading-[1.3]">{what}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm leading-[1.45] text-muted-foreground">
              Everyone makes private claims. {H === 24 ? "A day" : `${H} hours`} before the episode, {shared ? "every claim processes at once, and everyone gets who they claimed: nobody's taken off the board in this league." : <>{pickups && addDrops ? "pickups process first, then add/drops," : "they process"} in waiver order.</>}
              {fa ? " Then anyone still free is first come, first served until it airs." : ""}
            </p>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="min-h-11 self-start rounded-[3px] border border-input px-3.5 text-sm font-bold hover:bg-secondary focus-visible:outline-3 focus-visible:outline-chyron-line"
            >
              See &ldquo;How waivers work&rdquo;
            </button>
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            That&rsquo;s the sheet players see, written from these settings. A change to timing applies to this week&rsquo;s waivers too, if they haven&rsquo;t processed.
          </p>
          <RulesSheet open={preview} onOpenChange={setPreview} />
        </section>
      )}

      {anyOn && canManage && (
        <section className="flex flex-col gap-2">
          <SectionHead>Running waivers</SectionHead>
          <p className="text-[15px] leading-normal text-muted-foreground">
            Nothing to start or end. While waivers are open, the Waivers page has Process now and a claim for any player; once they&rsquo;ve processed, Undo last
            waiver run.
          </p>
        </section>
      )}
    </SettingsPage>
  );
}
