"use client";

import { ChevronRight, Plus } from "lucide-react";
import { CHAT_CHOICES } from "@/lib/moments";
import { FaceStack, openCouchSheet } from "../couch/couch-sheets";
import type { GameRef, Home, HomeShow, Profile } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { useNow } from "../ui/bars";
import { ShowArt } from "../ui/show-bar";
import { muteEnd } from "./api";
import { PageSection } from "./controls";
import { plain } from "./keep-up";

// Your shows, couches and games (settings Round 1; docs/design-round/settings-r1-spec.md): the map. Each couch, show and game
// you're in, its name over what's set for you there, so "where did I turn that off?" is a glance, and each opens its own home: a
// couch its page; a show its ⋯ menu (its settings for you, until Round 2 gives it a gear); a game its page. A show lists your
// games on it, three at most, then "+N more" (a busy season has dozens: the memory "Many games, held height").

const ROLE: Record<string, string> = { commissioner: "You run it", admin: "Helper", member: "Playing" };
const SHOWN_GAMES = 3;

/** Your settings' row value: how many of each. */
export function yoursValue(home: Home | undefined) {
  if (!home) return "…";
  const shows = home.shows.filter(mine).length;
  const couches = home.couches.length;
  const games = home.shows.reduce((n, s) => n + s.games.filter((g) => !g.archived).length, 0);
  return [plural(shows, "show"), couches ? plural(couches, "couch") : "no couch", games ? plural(games, "game") : null].filter(Boolean).join(" · ");
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : w.endsWith("ch") ? "es" : "s"}`;
/** A show of yours: one you follow, or one you play. */
const mine = (s: HomeShow) => s.following || s.games.length > 0;

/** How far you've watched, in Round 0's words. */
function watchedLine(s: HomeShow) {
  if (s.show.kind === "sport") return "Sports";
  if (s.seenThrough === null) return "Results straight away";
  if (!s.latestAired) return "Not on yet";
  if (s.seenThrough >= s.latestAired) return s.status === "completed" ? "Watched it all" : "Watched them all";
  return s.seenThrough ? `Watched through Ep ${s.seenThrough}` : "Not started";
}

export function YoursPage({ home, p }: { home: Home | undefined; p: Profile | undefined }) {
  const now = useNow(false);
  if (!home) return <div aria-busy className="mx-4 mt-4 h-40 animate-pulse rounded-[3px] bg-card" />;
  const shows = home.shows.filter(mine).sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"));
  const muted = new Map((p?.notify.elsewhere.shows ?? []).map((x) => [x.showId, x]));
  const chats = new Map((p?.notify.elsewhere.couches ?? []).map((x) => [x.couchId, x.chat]));
  return (
    <div data-settings-yours className="pb-10">
      <PageSection title="Couches" line={home.couches.length ? undefined : "A couch is your people: you see what they watch, and play together."}>
        {home.couches.map((c) => {
          const chat = chats.get(c.id);
          return (
            <button
              key={c.id}
              type="button"
              data-yours-couch={c.name}
              onClick={() => openCouchSheet({ kind: "details", couchId: c.id })}
              className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
            >
              <span className="grid w-[60px] flex-none place-items-start">
                <FaceStack people={c.members} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold">{c.name}</b>
                <small className="block truncate text-[13px] text-muted-foreground">
                  {c.members.length} {c.members.length === 1 ? "person" : "people"}
                  {c.yourRole === "owner" ? " · you run it" : ""}
                  {" · "}
                  {chat ? `chat: ${CHAT_CHOICES.find((x) => x.id === chat)!.title.toLowerCase()}` : "chat: your default"}
                </small>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
            </button>
          );
        })}
        {!home.couches.length && (
          <button
            type="button"
            data-yours-no-couch
            onClick={() => openCouchSheet({ kind: "switch" })}
            className="nd-press flex min-h-[60px] w-full items-center gap-3 py-2 text-left"
          >
            <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Start a couch or join one</b>
              <small className="block text-[13px] text-muted-foreground">Name it and send the code, or use a code you were sent</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        )}
      </PageSection>

      <PageSection title="Shows" line={shows.length ? undefined : "Shows you follow or play show up here."}>
        {shows.map((s) => {
          const ex = muted.get(s.show.id);
          const set = [watchedLine(s), ex?.muted ? `Muted ${muteEnd(ex.muted, now)}` : ex?.off.length ? "Some notifications off" : null, s.private ? "Hidden from your couch" : null].filter(Boolean);
          const games = s.games.filter((g) => !g.archived);
          return (
            <div key={s.seasonId} data-yours-show={s.seasonId} className="border-t border-border first:border-t-0">
              <NavLink href={`${paths.show(s.seasonId)}?menu=1`} className="nd-press flex min-h-[64px] items-center gap-3 py-2">
                <span className="grid w-[60px] flex-none place-items-start">
                  <ShowArt seasonId={s.seasonId} artUrl={s.show.artUrl} name={plain(s)} bare className="size-10 rounded-[3px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{plain(s)}</b>
                  <small className="block text-[13px] leading-snug text-muted-foreground">{set.join(" · ")}</small>
                </span>
                <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
              </NavLink>
              {games.length > 0 && (
                <ul className="mb-2 ml-[72px] flex flex-col">
                  {games.slice(0, SHOWN_GAMES).map((g: GameRef) => (
                    <li key={g.leagueId}>
                      <NavLink href={paths.gamePage(s.seasonId, g.leagueId)} data-yours-game={g.leagueId} className="nd-press flex min-h-11 items-center gap-2 text-[14px]">
                        <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                        <small className="flex-none text-[13px] text-muted-foreground">{ROLE[g.yourRole ?? "member"] ?? "Playing"}</small>
                      </NavLink>
                    </li>
                  ))}
                  {games.length > SHOWN_GAMES && (
                    <li>
                      <NavLink href={paths.show(s.seasonId, "games")} className="flex min-h-11 items-center text-[14px] font-semibold text-muted-foreground underline underline-offset-[3px]">
                        +{games.length - SHOWN_GAMES} more on {plain(s)}
                      </NavLink>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </PageSection>
    </div>
  );
}
