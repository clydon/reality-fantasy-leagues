"use client";

import { ArrowLeftRight, Check, ChevronRight, CircleQuestionMark, Eye, KeyRound, RotateCcw, SlidersHorizontal, Trophy, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { airTime } from "../clock";
import { ChangesPage } from "../backstage/changes";
import { ResultsPage } from "../backstage/results";
import { useBackstage, useChanges, type Backstage, type Need } from "../data";
import { NavLink, useNav } from "../nav";
import { BACKSTAGE_PAGES, paths, type BackstagePage } from "../routes";
import { PageHeader } from "../ui/bars";
import { EmptyState, Row, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { ShowBar } from "../ui/show-bar";
import type { PreviewId } from "../preview";
import { isTabOf, useShow, type ShowData } from "./show-space";

// Pages pushed over a show space (step 0c's shells): Backstage and its pages, waivers, the draft room and the
// blind draft. Each is a route of its own, deeper than the show, so it pushes in from the right; back returns to
// the tab you left. Backstage is steps 5 and 6a (mock backstage.js, guards.js): its home (Needs you, then its pages),
// Results and Recent changes are real since step 5, the other four 6a's; waivers 6a (waivers.js), the drafts 7
// (draft.js). Recent changes is the couch's to read, so players reach it too (the show's ⋯ menu).

const PAGES = {
  results: { title: "Results", icon: CircleQuestionMark, detail: "Who went home, and full scores for every game" },
  waivers: { title: "Waivers", icon: ArrowLeftRight, detail: "Open a waiver window, and how waivers run", preview: "backstage.waivers" },
  rules: { title: "Scoring rules", icon: Trophy, detail: "The rulebook these games follow, or your own", preview: "backstage.rules" },
  members: { title: "Members & roles", icon: Users, detail: "Who plays, who runs each game, join requests", preview: "backstage.members" },
  settings: { title: "Game settings", icon: SlidersHorizontal, detail: "Lineup size, joining, lock it down, end a game", preview: "backstage.settings" },
  history: { title: "Recent changes", icon: RotateCcw, detail: "Everything changed in these games, with undo" },
} as const satisfies Record<BackstagePage, { title: string; icon: LucideIcon; detail: string; preview?: PreviewId }>;

export function BackstageScreen({ seasonId, page }: { seasonId: string; page?: BackstagePage }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const name = show.header?.show.name ?? "Show";
  const runs = show.runs.length > 0;
  const bar = (title: string, back: { label: string; to: string; accepts?: (prev: string) => boolean }, status?: ReactNode) =>
    show.header ? (
      <ShowBar
        show={{ seasonId, name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl }}
        back={{ label: back.label, onClick: () => nav.back(back.to, back.accepts) }}
        status={status}
        title={title}
      />
    ) : (
      <div className="h-24 animate-pulse bg-card" aria-busy />
    );
  const toShow = { label: name.replace(/^The /, ""), to: paths.show(seasonId), accepts: isTabOf(seasonId) };
  const toBackstage = { label: "Backstage", to: paths.backstage(seasonId) };
  const runThis = (
    <>
      <KeyRound className="size-3.5" aria-hidden />
      You run this
    </>
  );

  // Recent changes: everyone on the couch reads it; from Backstage for whoever runs a game, else from the show.
  if (page === "history") {
    return (
      <>
        {bar(
          "Recent changes",
          runs ? toBackstage : toShow,
          <>
            <Eye className="size-3.5" aria-hidden />
            Visible to the couch
          </>
        )}
        <ChangesPage seasonId={seasonId} show={show} />
      </>
    );
  }
  if (show.header && !runs) {
    return (
      <>
        {bar("Backstage", toShow)}
        <EmptyState
          icon={KeyRound}
          title="Backstage is for whoever runs a game"
          line="Players never see it. Whoever runs a game here can hand it to you, or share it, in Members & roles."
        />
      </>
    );
  }
  if (page === "results") {
    return (
      <>
        {bar("Results", toBackstage, runThis)}
        <ResultsPage seasonId={seasonId} show={show} />
      </>
    );
  }
  if (page) {
    const p = PAGES[page];
    return (
      <>
        <PageHeader title={p.title} back={{ label: "Backstage", parent: paths.backstage(seasonId) }} />
        {"preview" in p && <Preview id={p.preview} className="mx-4 mt-5" />}
      </>
    );
  }
  return (
    <>
      {bar("Backstage", toShow, runThis)}
      <BackstageHome seasonId={seasonId} show={show} />
    </>
  );
}

function BackstageHome({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const bs = useBackstage(seasonId, couchId, null, { enabled: show.runs.length > 0 });
  const changes = useChanges(seasonId, couchId);
  const name = show.header?.show.name ?? "Show";
  const games = show.runs.length;
  const needs = bs.data?.needs ?? [];
  const latest = changes.data?.lines[0];
  return (
    <div className="pb-10">
      <section className="mt-6">
        <SectionHead title="Needs you" aside={bs.data ? (needs.length ? `${needs.length} ${needs.length === 1 ? "job" : "jobs"}` : "All clear") : undefined} />
        <div className="px-4">
          {!bs.data ? (
            <div aria-busy className="h-[72px] animate-pulse rounded-[4px] bg-card" />
          ) : needs.length ? (
            <div className="flex flex-col">
              {needs.map((n) => (
                <Job key={`${n.id}-${n.episode}`} seasonId={seasonId} need={n} games={games} />
              ))}
            </div>
          ) : (
            <AllClear data={bs.data} />
          )}
        </div>
      </section>
      <section className="mt-8">
        <SectionHead
          title={show.header?.seasonNumber ? `${name.replace(/^The /, "")} ${show.header.seasonNumber}` : name}
          aside={[show.couch?.name, games ? `${games} ${games === 1 ? "game" : "games"}` : null].filter(Boolean).join(" · ")}
        />
        <div className="flex flex-col px-4">
          {BACKSTAGE_PAGES.map((key) => {
            const p = PAGES[key];
            const detail = key === "results" ? resultsLine(bs.data) : key === "history" && latest ? `${latest.who?.name ?? "On its own"} · ${latest.text}${latest.undone ? " · undone" : ""}` : p.detail;
            return <Row key={key} href={paths.backstage(seasonId, key)} icon={p.icon} title={p.title} detail={detail} dot={key === "results" && needs.length > 0} />;
          })}
        </div>
      </section>
      <p className="px-4 pt-8 text-sm leading-relaxed text-muted-foreground">
        Backstage is only for people who run a game. Players never see it, though everyone on the couch can read Recent changes. Hand a game to someone
        else, or share it, in Members &amp; roles.
      </p>
    </div>
  );
}

/** The Results row's line: where the latest open episode stands, naming nobody. */
function resultsLine(data: Backstage | undefined): string {
  const ep = data?.episode;
  if (!ep) return PAGES.results.detail;
  if (ep.waiting) return `Episode ${ep.number} · ${ep.waiting} waiting for you`;
  if (ep.stage === "none") return `Episode ${ep.number} · who went home isn't in yet`;
  if (ep.stage === "early") return `Episode ${ep.number} · who went home is in · full scores to come`;
  return `Episode ${ep.number} · final scores in · copy and paste, free`;
}

/** A job (the mock's .job): the one yellow tag, what it is, and Check. */
function Job({ seasonId, need, games }: { seasonId: string; need: Need; games: number }) {
  return (
    <NavLink
      href={`${paths.backstage(seasonId, "results")}?ep=${need.episode}`}
      data-job={need.id}
      className="nd-press flex min-h-[72px] items-center gap-3 border-b border-border py-2.5"
    >
      <span className="grid size-14 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
        <CircleQuestionMark className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-caption block text-[12px] tracking-[0.06em] text-muted-foreground">{games > 1 ? `All ${games} games` : "Your game"}</span>
        <b className="block text-[16px] leading-tight">{need.title}</b>
        <small className="block text-[13px] text-muted-foreground">{need.detail}</small>
      </span>
      <span className="text-[15px] font-bold text-chyron-line">Check</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

function AllClear({ data }: { data: Backstage }) {
  const next = data.next;
  return (
    <div data-all-clear className="flex items-center gap-3 rounded-[4px] bg-card p-3.5">
      <Check className="size-[26px] flex-none text-good" strokeWidth={2.6} aria-hidden />
      <span>
        <b className="block text-[15px]">You&apos;re all caught up</b>
        <small className="text-[13px] text-muted-foreground">
          {next?.airAt ? `Next: Episode ${next.number} airs ${airTime(Date.parse(next.airAt))}. Ask who went home once it has.` : "Nothing's waiting on you here."}
        </small>
      </span>
    </div>
  );
}

const SHOW_PAGE_META = {
  waivers: { title: "Waivers", preview: "show.waivers" },
  draft: { title: "Draft room", preview: "show.draft" },
  blind: { title: "Blind draft", preview: "show.blind" },
} as const satisfies Record<string, { title: string; preview: PreviewId }>;

export function ShowPageScreen({ seasonId, page }: { seasonId: string; page: keyof typeof SHOW_PAGE_META }) {
  const show = useShow(seasonId);
  const meta = SHOW_PAGE_META[page];
  return (
    <>
      <PageHeader
        title={meta.title}
        back={{ label: show.header?.show.name.replace(/^The /, "") ?? "Back", parent: paths.show(seasonId), accepts: isTabOf(seasonId) }}
      />
      <Preview id={meta.preview} className="mx-4 mt-5" />
    </>
  );
}
