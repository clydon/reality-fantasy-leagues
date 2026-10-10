"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import type { SeasonChange } from "@/lib/game/formats/index";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// League Settings > Rule changes this season (docs/PLAN-season-rule-changes.md). When a show changes
// how it's played partway through a season, an admin records the change for the whole season; this is
// where each league's commissioner decides whether it scores HERE, and for how much (decided
// 2026-10-06: a running league's scoring is its commissioner's call). Nothing changes until they adopt.
//
// Only Active Roster leagues see it: a change adds scoring events, and those are what Active Roster
// scores. Every other league type scores by who leaves, which reaches every league regardless.
//
// `state` is the viewer's copy (SpoilerLogic.viewThrough), which leaves out any change from an episode
// they haven't seen -- the card itself would say a twist is coming.
export function RuleChangesSection({ state }: { state: LeagueState }) {
  const canManage = useCanManage();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const Logic = StateLogic.RuleChangeLogic;

  if (!StateLogic.getLeagueType(state).hasActiveRoster) return null;
  const pending = canManage ? Logic.pending(state) : [];
  const adopted = Logic.adoptedStatus(state);
  if (!pending.length && !adopted.length) return null;

  async function act(changeId: string, action: "adopt" | "decline" | "remove", points?: Record<string, number>) {
    await mutate(
      (s) => {
        if (action === "adopt") Logic.adopt(s, changeId, points);
        else if (action === "decline") Logic.decline(s, changeId);
        else Logic.remove(s, changeId);
      },
      () => api.leagueRuleChange(leagueId!, changeId, action, points)
    );
  }

  return (
    <section className="flex flex-col">
      <h3 className="type-caption pb-1.5 text-[22px]">Rule changes this season</h3>
      <p className="mb-3 text-[13px] leading-snug text-muted-foreground">
        The show has changed how it&rsquo;s played partway through the season. A change only counts in this league once your
        commissioner adopts it, and only from the episode it starts — nothing before that is rescored.
      </p>

      {pending.map((c) => (
        <PendingChange key={`${c.id}:${c.version}`} state={state} change={c} updateOf={adopted.find((a) => a.change.id === c.id)?.change} onAct={act} />
      ))}

      {adopted.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Scored in this league</div>
          {adopted.map(({ change, status }) => (
            <div key={change.id} className="flex flex-wrap items-center gap-2 border-t border-border py-2.5 text-sm">
              <span className="font-semibold">From episode {change.effectiveEpisode}</span>
              <span className="min-w-0 flex-1 text-muted-foreground">{change.summary || "A rule change"}</span>
              {status === "updated" &&
                (pending.some((p) => p.id === change.id) ? (
                  <span className="text-xs font-semibold">Updated since — review it above</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Kept this version (it&rsquo;s been updated since)</span>
                ))}
              {status === "withdrawn" && <span className="text-xs font-semibold text-destructive">Withdrawn by the site admin</span>}
              {canManage && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={async () => {
                    const ok = await confirm(
                      `Stop scoring this change? Points from its events come off from episode ${change.effectiveEpisode} on. You can adopt it again while it's offered.`,
                      { confirmLabel: "Stop scoring it" }
                    );
                    if (ok) await act(change.id, "remove");
                  }}
                >
                  Stop scoring it
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PendingChange({
  state,
  change,
  updateOf,
  onAct,
}: {
  state: LeagueState;
  change: SeasonChange;
  /** The version this league adopted, when this is an admin's edit of it. */
  updateOf?: SeasonChange;
  onAct: (changeId: string, action: "adopt" | "decline" | "remove", points?: Record<string, number>) => Promise<void>;
}) {
  const Logic = StateLogic.RuleChangeLogic;
  const events = change.delta.addEvents ?? [];
  const [points, setPoints] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      events.map((e) => {
        // Re-reviewing an update: start from what this league already set, not the suggestion.
        const own = updateOf ? state.settings.eventPoints?.[e.id] : undefined;
        return [e.id, String(typeof own === "number" ? own : Logic.suggestedPoints(state, e))];
      })
    )
  );
  const [busy, setBusy] = useState(false);
  let skipped: { what: string; why: string }[] = [];
  try {
    skipped = Logic.fit(state, change);
  } catch {
    skipped = [{ what: "this change", why: "it doesn't fit this league's rules" }];
  }
  const label = (id: string) => StateLogic.formatOf(state).events.find((e) => e.id === id)?.label ?? id;
  const valid = events.every((e) => Number.isFinite(parseFloat(points[e.id])));

  async function run(action: "adopt" | "decline") {
    setBusy(true);
    try {
      await onAct(change.id, action, action === "adopt" ? Object.fromEntries(events.map((e) => [e.id, parseFloat(points[e.id])])) : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-[3px] border border-chyron-line/50 bg-card p-3.5 text-sm">
      <p className="font-semibold">
        {updateOf ? "Updated: " : ""}Rules changed from episode {change.effectiveEpisode}
      </p>
      {change.summary && <p className="mt-0.5 text-muted-foreground">{change.summary}</p>}

      {events.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="text-xs font-semibold">New scoring events — points in this league</div>
          {events.map((e) => (
            <label key={e.id} className="flex items-center gap-2">
              <Input
                type="number"
                step="0.25"
                className="w-20"
                value={points[e.id] ?? ""}
                onChange={(ev) => setPoints((p) => ({ ...p, [e.id]: ev.target.value }))}
              />
              <span>
                {e.label}
                {e.implied && <span className="text-xs text-muted-foreground"> (automatic)</span>}
              </span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">Suggested values are filled in. 0 tracks it without scoring it.</p>
        </div>
      )}
      {(change.delta.addExitMethods ?? []).length > 0 && (
        <p className="mt-2 text-xs">
          <span className="font-semibold">New ways of leaving:</span> {(change.delta.addExitMethods ?? []).map((x) => x.name).join(", ")}
        </p>
      )}
      {(change.delta.retireEvents ?? []).length > 0 && (
        <p className="mt-2 text-xs">
          <span className="font-semibold">No longer scored from episode {change.effectiveEpisode}:</span>{" "}
          {(change.delta.retireEvents ?? []).map(label).join(", ")}
        </p>
      )}
      {skipped.length > 0 && (
        <ul className="mt-2 text-xs text-muted-foreground">
          {skipped.map((s, i) => (
            <li key={i}>
              Left out here: {s.what} — {s.why}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="xs" disabled={busy || !valid} onClick={() => run("adopt")}>
          {updateOf ? "Use the update" : "Adopt"}
        </Button>
        <Button variant="secondary" size="xs" disabled={busy} onClick={() => run("decline")}>
          {updateOf ? "Keep the version we have" : "Not for this league"}
        </Button>
      </div>
    </div>
  );
}
