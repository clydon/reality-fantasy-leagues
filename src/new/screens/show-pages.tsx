"use client";

import { ArrowLeftRight, CircleQuestionMark, KeyRound, RotateCcw, SlidersHorizontal, Trophy, Users, type LucideIcon } from "lucide-react";
import { useNav } from "../nav";
import { BACKSTAGE_PAGES, paths, type BackstagePage } from "../routes";
import { PageHeader } from "../ui/bars";
import { EmptyState, Row, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { ShowBar } from "../ui/show-bar";
import type { PreviewId } from "../preview";
import { isTabOf, useShow } from "./show-space";

// Pages pushed over a show space (step 0c's shells): Backstage and its pages, waivers, the draft room and the
// blind draft. Each is a route of its own, deeper than the show, so it pushes in from the right; back returns to
// the tab you left. Backstage is steps 5 and 6a (mock backstage.js, guards.js), waivers 6a (waivers.js), the
// drafts 7 (draft.js).

const PAGES = {
  results: { title: "Results", icon: CircleQuestionMark, detail: "How results get in, and what each game has applied", preview: "backstage.results" },
  waivers: { title: "Waivers", icon: ArrowLeftRight, detail: "Open a waiver window, and how waivers run", preview: "backstage.waivers" },
  rules: { title: "Scoring rules", icon: Trophy, detail: "The rulebook these games follow, or your own", preview: "backstage.rules" },
  members: { title: "Members & roles", icon: Users, detail: "Who plays, who runs each game, join requests", preview: "backstage.members" },
  settings: { title: "Game settings", icon: SlidersHorizontal, detail: "Lineup size, joining, lock it down, end a game", preview: "backstage.settings" },
  history: { title: "Recent changes", icon: RotateCcw, detail: "Everything changed in these games, with undo", preview: "backstage.history" },
} as const satisfies Record<BackstagePage, { title: string; icon: LucideIcon; detail: string; preview: PreviewId }>;

export function BackstageScreen({ seasonId, page }: { seasonId: string; page?: BackstagePage }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const name = show.header?.show.name ?? "Show";

  if (page) {
    return (
      <>
        <PageHeader title={PAGES[page].title} back={{ label: "Backstage", parent: paths.backstage(seasonId) }} />
        <Preview id={PAGES[page].preview} className="mx-4 mt-5" />
      </>
    );
  }

  const games = [...new Set(show.games.map((g) => g.gameName))];
  return (
    <>
      {show.header ? (
        <ShowBar
          show={{ seasonId, name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl }}
          back={{ label: name.replace(/^The /, ""), onClick: () => nav.back(paths.show(seasonId), isTabOf(seasonId)) }}
          status={
            show.runs.length ? (
              <>
                <KeyRound className="size-3.5" aria-hidden />
                You run this
              </>
            ) : undefined
          }
          title="Backstage"
        />
      ) : (
        <div className="h-24 animate-pulse bg-card" aria-busy />
      )}
      {show.header && !show.runs.length ? (
        <EmptyState
          icon={KeyRound}
          title="Backstage is for whoever runs a game"
          line="Players never see it. Whoever runs a game here can hand it to you, or share it, in Members & roles."
        />
      ) : (
        <div className="pb-10">
          <Preview id="backstage.needs" className="mx-4 mt-5" />
          <section className="mt-8">
            <SectionHead
              title={show.header?.seasonNumber ? `${name.replace(/^The /, "")} ${show.header.seasonNumber}` : name}
              aside={[show.couch?.name, games.length ? `${games.length} ${games.length === 1 ? "game" : "games"}` : null].filter(Boolean).join(" · ")}
            />
            <div className="flex flex-col px-4">
              {BACKSTAGE_PAGES.map((key) => {
                const p = PAGES[key];
                return <Row key={key} href={paths.backstage(seasonId, key)} icon={p.icon} title={p.title} detail={p.detail} />;
              })}
            </div>
          </section>
          <p className="px-4 pt-8 text-sm leading-relaxed text-muted-foreground">
            Backstage is only for people who run a game. Players never see it. Hand a game to someone else, or share it, in
            Members &amp; roles.
          </p>
        </div>
      )}
    </>
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
