"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ShowSeason } from "@/lib/game/types";
import { api } from "@/lib/api";
import { AI_MODELS, estimate } from "@/lib/ai-cost";
import * as Air from "@/lib/game/air-schedule.js";
import { confirm } from "@/lib/confirm-store";
import { useShowPaidAi } from "@/lib/paid-ai-store";
import { TIME_ZONES } from "@/lib/admin-season";
import { Field, MoreOptions, StepperRow, ToggleRow, fieldCls } from "@/components/setup/settings-ui";
import { PlainButton } from "@/components/draft/draft-ui";
import { ActButton, Notice, Rows, Section, count, errorText } from "./admin-ui";
import { SeasonRules } from "./season-rule-check";
import { BotResearchSection } from "./bot-research-settings";
import { SeasonFrame } from "./season-frame";
import { cn } from "cn";

// A season's Setup and Rules tabs (docs/PLAN-ux-redesign.md 3b). Setup is everything set once when a
// season is catalogued and rarely again -- its name and wiki page, when it airs, whether research runs
// on its own, who decides its results -- with Delete at the bottom in a Danger zone. Text fields save
// when you leave them; choices save as they're made.

export function SeasonSetupPage({ seasonId }: { seasonId: string }) {
  return <SeasonFrame seasonId={seasonId}>{({ season, refetch }) => <SetupTab season={season} refetch={refetch} />}</SeasonFrame>;
}

function SetupTab({ season, refetch }: { season: ShowSeason; refetch: () => unknown }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const showPaid = useShowPaidAi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const id = (k: string) => `season-${season.id}-${k}`;

  async function save(changes: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await api.adminUpdateSeason(season.id, changes);
      // Lowering the episode count clears what was saved past it; say what went.
      const p = res.pruned;
      if (p) {
        const parts = [
          p.pendingResults && `${count(p.pendingResults, "pending result")}`,
          p.researchedEpisodes && `research for ${count(p.researchedEpisodes, "episode")}`,
          p.wikiReadTrimmed && "the extra episodes in the cached wiki read",
        ].filter(Boolean);
        setNote(
          (parts.length ? `Cleared past episode ${changes.episodeCount}: ${parts.join(", ")}.` : "Saved. Nothing past that episode to clear.") +
            (p.decidedResultsKept ? ` ${count(p.decidedResultsKept, "decided result")} past it ${p.decidedResultsKept === 1 ? "was" : "were"} kept; review them.` : ""),
        );
      } else {
        setNote("Saved.");
      }
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["season-decisions", season.id] });
    } catch (e) {
      setError(errorText(e, "Couldn't save that."));
    } finally {
      setBusy(false);
    }
  }

  /** Saves a text field when it's left, only if it changed. */
  const onBlurSave = (key: string, current: string | null | undefined, transform: (v: string) => unknown = (v) => v) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    if (v !== (current ?? "")) save({ [key]: transform(v) });
  };

  async function deleteSeason() {
    const ok = await confirm(
      `Delete season ${season.seasonNumber}? This clears its cast, cached wiki results, research, and every pending review item it produced, so you can start it over. Leagues on the season keep their own cast, episodes and scores.`,
      { danger: true, confirmLabel: "Delete season" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.adminDeleteSeason(season.id);
      await queryClient.invalidateQueries({ queryKey: ["admin-shows"] });
      if (res.leaguesAffected > 0) {
        await confirm(
          `Deleted. ${count(res.leaguesAffected, "league")} still point${res.leaguesAffected === 1 ? "s" : ""} at season ${season.seasonNumber}; re-add the season and they'll pick it back up.`,
          { title: "Season deleted", confirmLabel: "OK", cancelLabel: "Close" },
        );
      }
      router.push("/admin/shows");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const tz = season.airTz || "America/New_York";
  const completed = season.status === "completed";

  return (
    <>
      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}

      <Section title="Season">
        <div className="flex flex-col gap-5">
          <Field label="Name" htmlFor={id("name")} hint="Blank uses the number.">
            <input id={id("name")} className={fieldCls} placeholder={`Season ${season.seasonNumber}`} defaultValue={season.name ?? ""} disabled={busy} onBlur={onBlurSave("name", season.name)} />
          </Field>
          <Field label="Status" htmlFor={id("status")}>
            <select id={id("status")} className={fieldCls} value={season.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
              <option value="upcoming">Upcoming</option>
              <option value="airing">Airing</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field label="Wiki page" htmlFor={id("wiki")} hint="Paste it straight from your browser. The connector reads the cast and results from it.">
            <input
              id={id("wiki")}
              type="url"
              className={fieldCls}
              placeholder="https://survivor.fandom.com/wiki/Survivor_51"
              defaultValue={season.wikiUrl ?? ""}
              disabled={busy}
              onBlur={onBlurSave("wikiUrl", season.wikiUrl)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Schedule">
        <div className="flex flex-col gap-5">
          <Field
            label="Episodes"
            htmlFor={id("count")}
            hint={completed && !season.episodeCount ? "Set it: until then only episodes with data are listed." : "Caps the episode list. Anything saved past it is cleared."}
          >
            <input
              id={id("count")}
              type="number"
              min={1}
              inputMode="numeric"
              className={cn(fieldCls, "max-w-[140px]")}
              placeholder="?"
              defaultValue={season.episodeCount ?? ""}
              disabled={busy}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== String(season.episodeCount ?? "")) save({ episodeCount: v ? Number(v) : null });
              }}
            />
          </Field>
          <Field
            label="Premiere date"
            htmlFor={id("premiere")}
            hint={!completed && !season.premiereDate ? "Set it so the list knows which episodes have aired." : "Weekly from here. The wiki's own air dates win where it has them."}
          >
            <input
              id={id("premiere")}
              type="date"
              className={cn(fieldCls, "max-w-[220px]")}
              defaultValue={season.premiereDate ?? ""}
              disabled={busy}
              onBlur={(e) => e.target.value !== (season.premiereDate ?? "") && save({ premiereDate: e.target.value || null })}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Field label="Airs at" htmlFor={id("time")}>
              <input
                id={id("time")}
                type="time"
                className={cn(fieldCls, "w-[150px]")}
                defaultValue={season.airTime ?? Air.DEFAULT_AIR_TIME}
                disabled={busy}
                onBlur={(e) => e.target.value && e.target.value !== season.airTime && save({ airTime: e.target.value })}
              />
            </Field>
            <Field label="Time zone" htmlFor={id("tz")}>
              <select id={id("tz")} className={cn(fieldCls, "w-[170px]")} value={tz} disabled={busy} onChange={(e) => save({ airTz: e.target.value })}>
                {TIME_ZONES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Auto research">
        {showPaid ? (
          <Rows>
            <ToggleRow
              label="Research each episode on its own"
              hint={
                season.autoResearch
                  ? "Runs that long after each episode airs, from when it was switched on. Results still wait for your review."
                  : "Off: research only runs when you ask."
              }
              checked={!!season.autoResearch}
              disabled={busy}
              // Sensible first values when switching on: 12 hours after each episode airs.
              onChange={(on) =>
                save(
                  on
                    ? { autoResearch: true, researchDelayHours: season.researchDelayHours ?? 12, researchModel: season.researchModel ?? AI_MODELS[0].id }
                    : { autoResearch: false },
                )
              }
            />
            {season.autoResearch && (
              <>
                <StepperRow
                  label="Hours after it airs"
                  hint={
                    season.researchDelayHours == null && season.researchWeekday != null && season.researchTime
                      ? `Now: weekly, ${Air.WEEKDAYS[season.researchWeekday]} ${season.researchTime}`
                      : undefined
                  }
                  value={season.researchDelayHours ?? 12}
                  min={0}
                  max={336}
                  disabled={busy}
                  onChange={(n) => save({ researchDelayHours: n })}
                />
                <div className="py-3">
                  <Field label="Model" htmlFor={id("model")}>
                    <select
                      id={id("model")}
                      className={fieldCls}
                      value={season.researchModel ?? AI_MODELS[0].id}
                      disabled={busy}
                      onChange={(e) => save({ researchModel: e.target.value })}
                    >
                      {AI_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} · {estimate("research", m.id)} an episode
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}
          </Rows>
        ) : (
          // Auto-research spends on a schedule, so with paid actions hidden it can still be switched off,
          // never on.
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-[15px] leading-snug text-muted-foreground">
              {season.autoResearch
                ? "On: it runs paid web research after every episode airs, even with paid actions hidden."
                : "Off. Turn on paid AI in Site settings to set it up."}
            </p>
            {season.autoResearch && (
              <ActButton disabled={busy} onClick={() => save({ autoResearch: false })}>
                Switch off
              </ActButton>
            )}
          </div>
        )}
      </Section>

      <BotResearchSection season={season} busy={busy} save={save} />

      <Section title="Results">
        {/* Who decides the season's results (db/migrations/0054). Controlled, so cancelling the confirm
            leaves the select where it was. Neither direction changes any league's existing results. */}
        <Field
          label="Who decides"
          htmlFor={id("results")}
          hint={
            season.resultsBy === "admin"
              ? `What you accept goes into every league on the season.${season.resultsAdminSince ? ` Since ${new Date(season.resultsAdminSince).toLocaleDateString()}.` : ""}`
              : "Each league's commissioner applies their own results. What's staged here is what they see."
          }
        >
          <select
            id={id("results")}
            className={fieldCls}
            value={season.resultsBy ?? "leagues"}
            disabled={busy}
            onChange={async (e) => {
              const to = e.target.value as "admin" | "leagues";
              const ok = await confirm(
                to === "admin"
                  ? `From now on, results you accept for season ${season.seasonNumber} go into every league on it. Results each league already has stay as they are, and nothing accepted before now is pushed.`
                  : `Results you accept for season ${season.seasonNumber} will stop reaching leagues; each league's commissioner applies their own. Results leagues already have stay as they are.`,
                { confirmLabel: to === "admin" ? "Admin decides" : "Each league decides" },
              );
              if (ok) save({ resultsBy: to });
            }}
          >
            <option value="admin">Admin decides, pushed to every league</option>
            <option value="leagues">Each league decides</option>
          </select>
        </Field>
      </Section>

      <DangerZone>
        <PlainButton danger disabled={busy} onClick={deleteSeason} className="self-start">
          Delete season
        </PlainButton>
        <p className="text-[13px] leading-snug text-muted-foreground">
          Clears its cast, wiki read, research and pending results so it can be started over. Leagues keep their own cast, episodes and scores.
        </p>
      </DangerZone>
    </>
  );
}

/** Rare, destructive actions, collapsed at the bottom of a page. */
export function DangerZone({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-border pt-2">
      <MoreOptions label="Danger zone">
        <div className="flex flex-col gap-3">{children}</div>
      </MoreOptions>
    </div>
  );
}

// The Rules tab: the season's "check for rule changes" (docs/PLAN-season-rule-changes.md), for when a
// show changes how it's played partway through. Never in the way of episodes. Its insides are still the
// pre-redesign review screen.
export function SeasonRulesPage({ seasonId, startCheck = false }: { seasonId: string; startCheck?: boolean }) {
  return (
    <SeasonFrame seasonId={seasonId}>
      {({ show, season }) => (
        <SeasonRules
          seasonId={season.id}
          seasonLabel={`${show.name} ${season.name || `season ${season.seasonNumber}`}`}
          castApproved={!!season.castApprovedAt}
          locked={false}
          startCheck={startCheck}
          Row={RulesStatus}
        />
      )}
    </SeasonFrame>
  );
}

// SeasonRules' status row, in this page's terms: the status as a line, its one action under it.
function RulesStatus({ status, disabled, children }: { n: ReactNode; title: string; status: string; done: boolean; disabled?: boolean; children?: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", disabled && "opacity-60")}>
      <p className="min-w-0 flex-1 text-[15px] leading-snug">{status}</p>
      {children}
    </div>
  );
}
