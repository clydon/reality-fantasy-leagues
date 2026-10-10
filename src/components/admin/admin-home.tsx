"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, Flag, Inbox, ScrollText, Users } from "lucide-react";
import type { ShowSeason } from "@/lib/game/types";
import { api } from "@/lib/api";
import * as Air from "@/lib/game/air-schedule.js";
import { useShowPaidAi } from "@/lib/paid-ai-store";
import { airSchedule, nextToAir } from "@/lib/admin-season";
import { useNowMinute } from "@/components/episodes/episode-status";
import { ActButton, AdminPage, Row, Rows, Section, count, seasonShort, useAdminShows } from "./admin-ui";

// Admin's first page (docs/PLAN-ux-redesign.md 3a; the canvas's Admin-Home): a work queue instead of
// one long page. "Needs you" is everything waiting on an admin, built from data the admin pages load
// anyway -- results to review (per episode), a cast to approve, a researched format to review, open
// reports, a season that can't tell what's aired -- most urgent first, each linking straight to where
// it's done. "Coming up" is the next episode of each airing season, and whether research will run
// on its own.
//
// Only the first item's button is chyron: it's the one thing to do now. The rest are plain.

type Todo = { key: string; icon: typeof Inbox; title: string; detail: string; href: string; action: string };

export function AdminHome() {
  const shows = useAdminShows();
  const formats = useQuery({ queryKey: ["admin-formats"], queryFn: () => api.adminListFormats() });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: () => api.adminListReports() });
  const showPaid = useShowPaidAi();
  const nowMs = useNowMinute();

  const seasons = (shows.data?.shows ?? []).flatMap((show) => show.seasons.map((season) => ({ show, season })));
  // Results come in per episode, so a season with any pending is read once more to say which.
  const withPending = seasons.filter(({ season }) => (season.pendingDecisions ?? 0) > 0);
  const decisions = useQueries({
    queries: withPending.map(({ season }) => ({
      queryKey: ["season-decisions", season.id],
      queryFn: () => api.adminListDecisions(season.id),
    })),
  });

  const urgent: Todo[] = [];
  const later: Todo[] = [];
  withPending.forEach(({ show, season }, i) => {
    const data = decisions[i]?.data;
    const name = seasonShort(show, season);
    const curator = season.resultsBy === "leagues";
    // A league-decided season's staged results don't block anyone: each commissioner applies their own.
    const list = curator ? later : urgent;
    if (!data) {
      list.push({ key: `r-${season.id}`, icon: Inbox, title: name, detail: `${count(season.pendingDecisions ?? 0, "result")} to review`, href: `/admin/seasons/${season.id}`, action: "Open" });
      return;
    }
    const byEp = new Map<number, number>();
    for (const d of data.decisions) if (d.status === "pending") byEp.set(d.episode_number, (byEp.get(d.episode_number) ?? 0) + 1);
    // Nobody playing it means nobody's waiting: still worth doing, just not first.
    const target = data.leagueCount === 0 ? later : list;
    const waiting = curator
      ? "each league applies its own"
      : data.leagueCount
        ? `${count(data.leagueCount, "league")} waiting`
        : "nobody plays it yet";
    // A backlog (a finished season pulled all at once) is one row to the season, not a row per episode.
    if (byEp.size > 2) {
      const total = [...byEp.values()].reduce((n, x) => n + x, 0);
      target.push({
        key: `r-${season.id}`,
        icon: Inbox,
        title: `${name} · ${byEp.size} episodes`,
        detail: `${count(total, "result")} to review · ${waiting}`,
        href: `/admin/seasons/${season.id}`,
        action: "Open",
      });
      return;
    }
    for (const [n, pending] of [...byEp].sort((a, b) => a[0] - b[0])) {
      target.push({
        key: `r-${season.id}-${n}`,
        icon: Inbox,
        title: `${name} · Episode ${n}`,
        detail: `${count(pending, "result")} to review · ${waiting}`,
        href: `/admin/seasons/${season.id}/episodes/${n}/review`,
        action: "Review",
      });
    }
  });
  for (const { show, season } of seasons) {
    if ((season.castStaged ?? 0) > 0 && !season.castApprovedAt) {
      urgent.push({
        key: `c-${season.id}`,
        icon: Users,
        title: `${seasonShort(show, season)} · cast`,
        detail: `${season.castStaged} pulled, not approved yet`,
        href: `/admin/seasons/${season.id}/cast`,
        action: "Review",
      });
    }
  }
  for (const f of formats.data?.formats ?? []) {
    if (f.status === "draft") {
      urgent.push({ key: `f-${f.id}`, icon: ScrollText, title: f.name, detail: "Researched rules ready to review", href: `/admin/formats/${encodeURIComponent(f.id)}`, action: "Review" });
    }
  }
  const reportCount = reports.data?.reports.length ?? 0;
  if (reportCount) later.push({ key: "reports", icon: Flag, title: "Reports", detail: `${count(reportCount, "report")} open`, href: "/admin/reports", action: "Open" });
  // An airing season with no schedule can't tell which episodes are out, so its list and auto research
  // both stall.
  for (const { show, season } of seasons) {
    if (season.status === "airing" && !airSchedule(season).hasSchedule && !show.archived) {
      later.push({
        key: `s-${season.id}`,
        icon: CalendarClock,
        title: `${seasonShort(show, season)} · schedule`,
        detail: "Set the premiere date so it knows what's aired",
        href: `/admin/seasons/${season.id}/setup`,
        action: "Set",
      });
    }
  }
  const todos = [...urgent, ...later];

  const now = nowMs === null ? null : new Date(nowMs);
  const upcoming = now
    ? seasons
        .filter(({ show }) => !show.archived)
        .map(({ show, season }) => ({ show, season, next: nextToAir(season, now) }))
        .filter((x): x is { show: (typeof seasons)[number]["show"]; season: ShowSeason; next: { n: number; at: Date } } => !!x.next)
        .sort((a, b) => a.next.at.getTime() - b.next.at.getTime())
    : [];

  const loading = shows.isLoading || formats.isLoading || reports.isLoading;

  return (
    <AdminPage title="To do">
      <Section title="Needs you">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : todos.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">Nothing&rsquo;s waiting on you.</p>
        ) : (
          <Rows>
            {todos.map((t, i) => (
              <Row
                key={t.key}
                icon={t.icon}
                href={t.href}
                title={t.title}
                detail={t.detail}
                trailing={
                  <ActButton tone={i === 0 ? "chyron" : "plain"} href={t.href}>
                    {t.action}
                  </ActButton>
                }
              />
            ))}
          </Rows>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section title="Coming up">
          <Rows>
            {upcoming.map(({ show, season, next }) => {
              const { tz } = airSchedule(season);
              const research = season.autoResearch
                ? ` · research ${season.researchDelayHours ?? 12} h later${showPaid ? "" : ", paid"}`
                : "";
              return (
                <Row
                  key={season.id}
                  icon={Clock}
                  href={`/admin/seasons/${season.id}`}
                  title={`${seasonShort(show, season)} · Episode ${next.n}`}
                  detail={`Airs ${Air.formatInTz(next.at, tz)}${research}`}
                />
              );
            })}
          </Rows>
        </Section>
      )}
    </AdminPage>
  );
}
