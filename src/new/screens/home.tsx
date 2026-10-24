"use client";

import { Tv, Users } from "lucide-react";
import { useCurrentCouch, useHome, type HomeShow } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import { TopBar } from "../ui/bars";
import { Btn, EmptyState, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { ShowArt } from "../ui/show-bar";

// The hub (/home), step 0c's shell: the top bar, hello, the couch you're looking at, and your shows as real cards
// (tapping one changes the channel: its art grows into the show's header). The rest of the hub is a placeholder
// until step 0d ports it from the mock (refine.js wireHub, couchpages.js).

function greeting(hour: number) {
  return hour < 5 ? "Evening" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
}

export function HomeScreen() {
  const me = useMe();
  const { data: home, error, refetch } = useHome();
  const couch = useCurrentCouch(home);
  return (
    <div className="pb-[110px]">
      <TopBar me={me} />
      {error ? (
        <EmptyState title="Couldn't load your couch" line={error.message} action={<Btn wide onClick={() => refetch()}>Try again</Btn>} />
      ) : !home ? (
        <HomeSkeleton />
      ) : (
        <>
          <p className="px-4 pt-2 text-[15px] leading-[1.45] text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {greeting(new Date().getHours())}, {me.name}.
            </strong>{" "}
            {home.moves.length ? `${home.moves.length} ${home.moves.length === 1 ? "move" : "moves"} due.` : "You're all set."}
          </p>
          {couch && (
            <Preview id="hub.couch-switcher" tag={false} className="mx-4 mt-2.5">
              <button type="button" className="flex h-12 w-full items-center gap-2.5 rounded-[3px] bg-card pl-2 pr-3 text-left">
                <span className="grid size-[30px] flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground">
                  <Users className="size-4" aria-hidden />
                </span>
                <b className="flex-1 truncate text-[15px] font-semibold">{couch.name}</b>
                <small className="text-[13px] text-muted-foreground">
                  {couch.members.length} {couch.members.length === 1 ? "person" : "people"}
                </small>
              </button>
            </Preview>
          )}
          <section className="mt-8">
            <SectionHead title="Your shows" aside={home.shows.length ? "Tap to open" : undefined} />
            {home.shows.length ? (
              <div className="flex gap-3 overflow-x-auto px-4 pb-[18px] pt-1 [scrollbar-width:none] [scroll-snap-type:x_mandatory]">
                {home.shows.map((s) => (
                  <ShowCard key={s.seasonId} show={s} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Tv} title="No shows yet" line="Shows you follow or play a game on show up here." />
            )}
          </section>
          <Preview id="hub.sections" className="mx-4 mt-6" />
        </>
      )}
    </div>
  );
}

/** A show on your shelf: its art, its name, the season, and the games you play on it. */
function ShowCard({ show }: { show: HomeShow }) {
  return (
    <NavLink
      href={paths.show(show.seasonId)}
      channel
      className="nd-press relative isolate flex h-[232px] w-[164px] flex-none snap-start flex-col justify-end overflow-hidden rounded-[4px] p-[11px] text-white shadow-[0_12px_26px_rgba(0,0,0,.45)]"
    >
      <ShowArt seasonId={show.seasonId} artUrl={show.show.artUrl} name={show.show.name} morph className="absolute inset-0 -z-[2] size-full" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,0)_35%,rgba(10,8,14,.9)_100%)]" />
      <b className="type-caption text-[28px] leading-[.92]">{show.show.name.replace(/^The /, "")}</b>
      <span className="mt-1 text-xs font-semibold opacity-90">
        {show.seasonNumber ? `Season ${show.seasonNumber}` : show.seasonName}
        {show.upNext && !show.upNext.live ? ` · Ep ${show.upNext.number}` : ""}
      </span>
      {show.games.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1">
          {/* By game, once each: the same game on two couches is one chip. */}
          {[...new Set(show.games.map((g) => g.gameName))].map((name) => (
            <span key={name} className="rounded-[2px] bg-[rgba(10,8,14,.6)] px-[5px] py-[3px] text-[10px] font-bold backdrop-blur-sm">
              {name}
            </span>
          ))}
        </span>
      )}
    </NavLink>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy className="animate-pulse px-4 pt-3">
      <div className="h-4 w-56 rounded-[3px] bg-card" />
      <div className="mt-4 h-12 rounded-[3px] bg-card" />
      <div className="mt-10 h-6 w-36 rounded-[3px] bg-card" />
      <div className="mt-4 flex gap-3">
        <div className="h-[232px] w-[164px] rounded-[4px] bg-card" />
        <div className="h-[232px] w-[164px] rounded-[4px] bg-card" />
      </div>
    </div>
  );
}
