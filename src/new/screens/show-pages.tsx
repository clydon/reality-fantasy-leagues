"use client";

import { Eye, KeyRound } from "lucide-react";
import { type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChangesPage } from "../backstage/changes";
import { GameSettingsPage, SettingsList, useGameSettingsPage } from "../backstage/game-settings";
import { ResultsPage } from "../backstage/results";
import { RulesPage } from "../backstage/rules";
import { EndGames } from "../backstage/settings";
import { WaiversAdminPage } from "../backstage/waivers";
import { useBackstage, useGameSettings } from "../data";
import { useNav } from "../nav";
import { JobRow, RUNNER_JOBS } from "../manage/jobs";
import { paths, type BackstagePage } from "../routes";
import { EmptyState } from "../ui/parts";
import { ShowBar } from "../ui/show-bar";
import { isTabOf, useShow, type ShowData } from "./show-space";

// What was Backstage (settings Round 3a retired it: docs/design-round/settings-r3-spec.md, "Retiring Backstage"). Its address
// stays, so old links, pushes and the tour land somewhere true:
// - its home, Members & roles and Game settings are **Games you run**: the games you run on this show, a row each with what
//   needs you, each opening its Manage this game (game-settings.tsx), finished ones folded, and Bring a game back below;
// - Recent changes is the couch's to read, as before;
// - Results (a runner's fix, reached from an episode), Waivers (a game's week) and the rulebook (This season's rules) are pages a
//   game's Manage this game opens, titled for what they are, their Back to Games you run.

const TITLES = { results: "Results", waivers: "Waivers", rules: "This season's rules" } as const;

export function BackstageScreen({ seasonId, page }: { seasonId: string; page?: BackstagePage }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const name = show.header?.show.name ?? "Show";
  const runs = show.runs.length > 0;
  const bar = (title: string, back: { label: string; to: string; accepts?: (prev: string) => boolean }, status?: ReactNode) =>
    show.header ? (
      <ShowBar
        show={{ seasonId, name, seasonNumber: show.header.seasonNumber, artUrl: show.header.show.artUrl, backdropUrl: show.header.show.backdropUrl }}
        back={{ label: back.label, onClick: () => nav.back(back.to, back.accepts) }}
        status={status}
        title={title}
      />
    ) : (
      <div className="h-24 animate-pulse bg-card" aria-busy />
    );
  const toShow = { label: name.replace(/^The /, ""), to: paths.show(seasonId), accepts: isTabOf(seasonId) };
  const toGames = { label: "Games you run", to: paths.backstage(seasonId) };
  const fromGame = !!useSearchParams().get("game");
  const runThis = (
    <>
      <KeyRound className="size-3.5" aria-hidden />
      You run these
    </>
  );
  const runOne = (
    <>
      <KeyRound className="size-3.5" aria-hidden />
      You run this
    </>
  );

  if (page === "history") {
    return (
      <>
        {bar(
          "Recent changes",
          toShow,
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
        {bar("Games you run", toShow)}
        <EmptyState icon={KeyRound} title="You don't run a game here" line="Whoever runs a game can make you a Helper or a Commissioner, from its Who's playing." />
        {/* Every game you ran here archived: still the way to bring one back (asked only then: a player's ask is refused). */}
        {show.couch && show.games.some((g) => g.archived && g.yourRole === "commissioner") && <EndGames seasonId={seasonId} couchId={show.couch.id} restoreOnly />}
      </>
    );
  }
  if (page === "results" || page === "waivers" || page === "rules") {
    const Page = { results: ResultsPage, waivers: WaiversAdminPage, rules: RulesPage }[page];
    // Opened from a game's Manage this game (`?game=`): Back says so, and history takes it there.
    const back = fromGame ? { label: "Manage this game", to: paths.backstage(seasonId), accepts: () => true } : toGames;
    return (
      <>
        {bar(TITLES[page], back, fromGame ? <>{runOne}</> : runThis)}
        <Page seasonId={seasonId} show={show} />
        <GameSettingsPage seasonId={seasonId} show={show} />
      </>
    );
  }
  return (
    <>
      {bar("Games you run", toShow, runThis)}
      <GamesYouRun seasonId={seasonId} show={show} />
    </>
  );
}

/** Games you run here: what needs you, then the games (running, a night's, finished), each opening its Manage this game. */
function GamesYouRun({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const bs = useBackstage(seasonId, couchId, null, { enabled: show.runs.length > 0 });
  const data = useGameSettings(seasonId, couchId);
  const one = useGameSettingsPage();
  const jobs = (bs.data?.needs ?? []).filter((n) => RUNNER_JOBS.has(n.id));
  if (!data.data || !couchId) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  return (
    <div data-games-you-run className="pb-12">
      {jobs.length > 0 && (
        <section data-runner-jobs className="mt-5 px-4">
          <p className="type-caption pb-1 text-[13px] tracking-[0.05em] text-muted-foreground">Needs you</p>
          <div className="rounded-[10px] bg-card px-3.5">
            {jobs.map((n) => (
              <JobRow key={`${n.id}-${n.leagueId ?? ""}-${n.request?.id ?? ""}`} seasonId={seasonId} couchId={couchId} need={n} />
            ))}
          </div>
        </section>
      )}
      <SettingsList seasonId={seasonId} couchId={couchId} games={data.data.games} show={show} onOpen={(id) => one.showWith({ game: id, from: "games" })} />
      <GameSettingsPage seasonId={seasonId} show={show} />
      <EndGames seasonId={seasonId} couchId={couchId} restoreOnly />
    </div>
  );
}
