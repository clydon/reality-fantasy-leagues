"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Hourglass, LayoutGrid, MessageCircleQuestion, Shield, Target, Users } from "lucide-react";
import type { Castaway, Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useCanManage, useMyPlayerId } from "@/lib/store";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { DashAside } from "@/components/overview/dash-card";
import { useHiddenResults } from "@/components/results-in-banner";
import { useResultsDue } from "@/lib/episode-results";
import { cn } from "cn";
import { ResultsTask } from "./results-task";
import { ScoredHeadline, scoredText } from "./episode-lines";
import { airsInLabel, episodeExits, episodeStatus, hiddenBefore, ownersLine, useNowMinute } from "./episode-status";

// The top of Episodes (the rundown before the list): the week in play and the last results, each as
// a section headed by its episode, so the tab says what's happening now before it says what happened.
//
//   This week -- the episode being played: when it airs (or that it has), the commissioner's job once
//                it has aired with nothing recorded (results-task.tsx), and "Your week": the choices
//                this league type asks of you for it -- lineup, pick, team, predictions -- each a row
//                that says where you stand and opens where it's done, plus how many others are ready.
//   Last time -- the latest results: a Reveal while they're waiting for you, else who went home and
//                what it meant for you, with the episode's page as its Recap link.
//
// Whichever holds the screen's "now" goes first: new results to reveal, unless the commissioner has
// results to fill in. Both read the viewer's trimmed state, so nothing here spoils anything.
export function EpisodesWeek({ state }: { state: LeagueState }) {
  const now = useNowMinute();
  const due = useResultsDue(now);
  const week = weekEpisode(state, now);
  const last = lastEpisode(state, now);
  const lastHidden = !!last && episodeStatus(last, now).kind === "hidden";
  const sections = [
    week && <ThisWeek key="week" ep={week} state={state} now={now} due={due?.id === week.id} />,
    last && <LastTime key="last" ep={last} state={state} now={now} quiet={!!due} />,
  ];
  if (lastHidden && !due) sections.reverse();
  return <div className="mb-8 flex flex-col gap-8">{sections}</div>;
}

/** The episode in play: the earliest in play that this viewer has neither results nor a hidden
 *  reveal for -- one that's aired and waiting, or the next to air. */
export function weekEpisode(state: LeagueState, now: number | null): Episode | null {
  return (
    [...state.episodes]
      .sort((a, b) => a.number - b.number)
      .find((ep) => StateLogic.inPlay(state, ep.number) && ["waiting", "upcoming"].includes(episodeStatus(ep, now).kind)) ?? null
  );
}

/** The latest results: the first one waiting to be revealed (revealing it reveals any before it,
 *  so a later one stays shut), else the latest decided. */
export function lastEpisode(state: LeagueState, now: number | null): Episode | null {
  const sorted = [...state.episodes].filter((ep) => StateLogic.inPlay(state, ep.number)).sort((a, b) => a.number - b.number);
  const hidden = sorted.find((ep) => episodeStatus(ep, now).kind === "hidden" && hiddenBefore(state, ep) === null);
  if (hidden) return hidden;
  return [...sorted].reverse().find((ep) => episodeStatus(ep, now).kind === "scored") ?? null;
}

// ---------- This week ----------

function ThisWeek({ ep, state, now, due }: { ep: Episode; state: LeagueState; now: number | null; due: boolean }) {
  const canManage = useCanManage();
  const status = episodeStatus(ep, now);
  const aired = status.kind === "waiting" && !!ep.airsAt;
  const onNow = aired && now !== null && now - Date.parse(ep.airsAt!) < 2 * 3600_000;
  let when: string;
  if (status.kind === "upcoming") when = now !== null ? `${airsInLabel(status.airsAt, now)} · ${dayTime(status.airsAt)}` : dayTime(status.airsAt);
  else if (onNow) when = "On now";
  else if (aired) when = now !== null ? airedLabel(Date.parse(ep.airsAt!), now) : "Aired";
  else when = "Results pending";

  return (
    <section className="flex flex-col gap-3" aria-labelledby="week-heading">
      <Heading id="week-heading" kicker="This week" when={when} aside={<DashAside href={`/episodes/${ep.number}`}>Details</DashAside>}>
        Episode {ep.number}
      </Heading>
      {due && <ResultsTask ep={ep} />}
      {!due && status.kind === "waiting" && !onNow && (
        <p className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
          <Hourglass className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} aria-hidden />
          {canManage
            ? "Nothing recorded yet. Open the episode to enter its results."
            : "Results show up here once they're in. You choose when to reveal them."}
        </p>
      )}
      <YourWeek ep={ep} state={state} now={now} />
    </section>
  );
}

// Your choices for the episode, as rows. Each opens where it's done; a chyron-line dot marks one still
// waiting on you (the settings index's "needs you" dot).
function YourWeek({ ep, state, now }: { ep: Episode; state: LeagueState; now: number | null }) {
  const me = useMyPlayerId();
  if (!me) return null;
  const type = StateLogic.getLeagueType(state);
  const drafted = !type.hasRoster || !!StateLogic.currentDraftTurn(state)?.isComplete;
  const locked = now !== null && StateLogic.hasAired(ep, now);
  const time = ep.airsAt ? dayTime(Date.parse(ep.airsAt)) : null;
  const players = state.players.filter((p) => !p.disabled && p.active !== false);
  const rows: ReactNode[] = [];
  let ready: string | null = null;

  if (type.hasActiveRoster && drafted) {
    const lineup = lineupOf(state, ep, me);
    const lineupLocked = StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
    const open = lineup.need - lineup.starters.length;
    rows.push(
      <WeekRow
        key="lineup"
        href="/lineup"
        icon={LayoutGrid}
        title="Your lineup"
        value={
          lineupLocked
            ? `${lineup.starters.length} starting · locked`
            : open > 0
              ? `${open} empty slot${open === 1 ? "" : "s"}${time ? ` · locks ${time}` : ""}`
              : `Set${time ? ` · locks ${time}` : ""}`
        }
        alert={!lineupLocked && open > 0}
        faces={lineup.starters}
      />
    );
    if (!lineupLocked) {
      const set = players.filter((p) => {
        const l = lineupOf(state, ep, p.id);
        return l.starters.length >= l.need;
      }).length;
      ready = `${set} of ${players.length} lineups set`;
    }
  }

  if (type.hasWeeklyPicks) {
    const pick = StateLogic.pickEmPickFor(state, ep.id, me);
    const c = pick ? StateLogic.getCastaway(state, pick.castawayId) : null;
    rows.push(
      <WeekRow
        key="pick"
        href="/pick"
        icon={Target}
        title="Your pick"
        value={
          c
            ? `${c.name}${locked ? " · locked in" : time ? ` · change until ${time}` : ""}`
            : locked
              ? "No pick this week"
              : `Not picked yet${time ? ` · closes ${time}` : ""}`
        }
        alert={!c && !locked}
        faces={c ? [c] : []}
      />
    );
    if (!locked) {
      const picked = players.filter((p) => StateLogic.pickEmPickFor(state, ep.id, p.id)).length;
      ready = `${picked} of ${players.length} picked`;
    }
  }

  if (type.hasRoster && !type.hasActiveRoster && drafted) {
    const team = state.castaways.filter((c) => c.ownerIds.includes(me));
    const stillIn = team.filter((c) => c.status !== "eliminated");
    if (team.length > 0) {
      rows.push(
        <WeekRow
          key="team"
          href="/"
          icon={Shield}
          title="Your team"
          value={stillIn.length === team.length ? `All ${team.length} still in` : `${stillIn.length} of ${team.length} still in`}
          faces={stillIn}
        />
      );
    }
  }

  if (StateLogic.betsOn(state)) {
    const bets = ep.bets || [];
    const open = bets.filter((b) => !(b.predictions || []).some((p) => p.playerId === me)).length;
    if (bets.length > 0 || !locked) {
      rows.push(
        <WeekRow
          key="predictions"
          href={bets.length > 0 ? "/#predictions" : `/episodes/${ep.number}`}
          icon={MessageCircleQuestion}
          title="Predictions"
          value={
            bets.length === 0
              ? "None yet · add one"
              : open > 0 && !locked
                ? `${open} to guess`
                : open > 0
                  ? `${bets.length - open} of ${bets.length} guessed`
                  : `All ${bets.length} guessed`
          }
          alert={open > 0 && !locked}
        />
      );
    }
  }

  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col">
      <h4 className="type-caption pb-1 pt-1 text-[17px] tracking-[0.03em] text-muted-foreground">Your week</h4>
      <div className="flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">{rows}</div>
      {ready && (
        <p className="flex items-center gap-2 pt-2.5 text-[13px] text-muted-foreground">
          <Users className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
          {ready}
        </p>
      )}
    </div>
  );
}

function WeekRow({
  href,
  icon: Icon,
  title,
  value,
  alert,
  faces = [],
}: {
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  value: string;
  alert?: boolean;
  faces?: Castaway[];
}) {
  const shown = faces.slice(0, 4);
  return (
    <Link href={href} className="flex min-h-[60px] items-center gap-3 py-2 outline-none hover:bg-accent/40 focus-visible:bg-accent">
      <Icon className="size-[22px] shrink-0 text-muted-foreground" strokeWidth={2} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-base font-semibold">
          {title}
          {alert && <span className="size-2 shrink-0 rounded-full bg-chyron-line" aria-label="Needs you" />}
        </span>
        <span className={cn("truncate text-[13px]", alert ? "font-semibold text-chyron-line" : "text-muted-foreground")}>{value}</span>
      </span>
      {shown.length > 0 && (
        <span className="flex shrink-0 -space-x-1.5" aria-hidden>
          {shown.map((c) => (
            <CastawayAvatar
              key={c.id}
              castaway={c}
              className="flex size-8 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-[11px] font-bold text-muted-foreground ring-2 ring-background [&_img]:object-top"
            />
          ))}
        </span>
      )}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
    </Link>
  );
}

// ---------- Last time ----------

function LastTime({ ep, state, now, quiet }: { ep: Episode; state: LeagueState; now: number | null; quiet: boolean }) {
  const me = useMyPlayerId();
  const { reveal } = useHiddenResults();
  const hidden = episodeStatus(ep, now).kind === "hidden";
  const exits = hidden ? [] : episodeExits(state, ep);
  const mine = hidden ? null : scoredText(ep, state, me);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="last-heading">
      <Heading
        id="last-heading"
        kicker={hidden ? "New results" : "Last time"}
        when={ep.title ?? undefined}
        aside={hidden ? undefined : <DashAside href={`/episodes/${ep.number}`}>Recap</DashAside>}
      >
        Episode {ep.number}
      </Heading>
      {hidden ? (
        <CaptionPlate
          tag={`Ep ${ep.number}`}
          tone={quiet ? "quiet" : "chyron"}
          title={`Episode ${ep.number} is in`}
          subtitle="Hidden until you're ready"
          action="Reveal"
          actionTone={quiet ? undefined : "chyron"}
          onClick={() => reveal(ep.number)}
        />
      ) : (
        <>
          {exits.length > 0 && exits.length <= 3 ? (
            <div className="flex flex-col gap-2">
              {exits.map(({ ev, c }) => (
                <CaptionPlate
                  key={c.id}
                  size="sm"
                  tone="live"
                  tag="Out"
                  image={castawayPhotoSrc(c.photoUrl) ?? undefined}
                  title={c.name}
                  subtitle={[ev.method, ownersLine(state, c, me)].filter(Boolean).join(" · ")}
                />
              ))}
            </div>
          ) : (
            <p className="text-base font-semibold">
              <ScoredHeadline ep={ep} state={state} />
            </p>
          )}
          {mine && <p className="text-sm leading-snug text-muted-foreground">{mine}</p>}
        </>
      )}
    </section>
  );
}

// ---------- shared ----------

function Heading({ id, kicker, when, aside, children }: { id: string; kicker: string; when?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between gap-3">
        <h3 id={id} className="section-title">
          {children}
        </h3>
        {aside}
      </div>
      <p className="text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">{kicker}</span>
        {when ? ` · ${when}` : ""}
      </p>
    </div>
  );
}

/** Your starters for an episode that are still in the game, and how many slots you could fill. */
function lineupOf(state: LeagueState, ep: Episode, playerId: string) {
  const available = state.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status !== "eliminated");
  const ids = StateLogic.activeRosterLineupFor(state, ep.id, playerId);
  const starters = ids.map((id) => available.find((c) => c.id === id)).filter((c): c is Castaway => !!c);
  return { starters, need: Math.min(StateLogic.ActiveRosterLogic.activeSlots(state), available.length) };
}

/** "Thu 8:00 PM". */
function dayTime(t: number): string {
  return new Date(t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** "Aired today" / "Aired last night" / "Aired Thu, Oct 15", by calendar day in the viewer's zone. */
function airedLabel(airsAt: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const days = day(now) - day(airsAt);
  if (days <= 0) return "Aired today";
  if (days === 1) return new Date(airsAt).getHours() >= 17 ? "Aired last night" : "Aired yesterday";
  return `Aired ${new Date(airsAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`;
}
