"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Sparkles, Users } from "lucide-react";
import { roster as rosterApi, useRoster, type Roster as RosterData, type StatItem } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn, EmptyState } from "../ui/parts";
import { toast } from "../ui/toast";
import { PasteSheet } from "./recaps";

// A sport's Players tab (rosters.ts, db/migrations/0144): who's playing, by team, each with what they play. TV listings only list a
// sport's broadcasters, so a sport nobody's made a game of gets its players from the sports data (0149, sports/cast.ts: its linked
// games' rosters, with headshots, credited under the roster), on their own; a team whose players come from its box scores waits
// for its first game. Only when the sports data hasn't got its games is it Fill in who's playing, which asks ChatGPT (our bot, else
// copy and paste). A roster isn't a spoiler: who's on a team is known before the game. A sport that's a game keeps the cast tab
// (cast.tsx), with its stats.
// Each person's photo is the sports data's headshot, else Wikipedia's (show-art.ts, found as the roster lands), else their
// initials, and their stats (0150, from the games' box scores) in two lines: so far, the games you've seen added up (the server
// never sends a game past your mark), and coming in ("2026 regular season"). The stats bar says what they cover, that they're
// coming in from the sports data, and when a later game's wait for you to see it. Someone a box score brought in (a team with no
// roster) shows once you've seen that game.

export function Roster({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const read = useRoster(seasonId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const r = read.data;
  const asking = !!r?.asking;
  const was = useRef(asking);
  useEffect(() => {
    if (was.current && !asking) {
      if (r?.message) toast.quiet(r.message);
      else toast(`Filled in who's playing`);
    }
    was.current = asking;
  }, [asking, r?.message]);
  const people = show.words.people.toLowerCase();
  if (read.error) return <EmptyState icon={Users} title={`Couldn't load the ${people}`} line={(read.error as Error).message} />;
  if (!r) return <div className="mx-4 mt-5 h-72 animate-pulse rounded-[4px] bg-card" aria-busy />;
  const ask = async () => {
    setBusy(true);
    try {
      const out = await rosterApi.ask(seasonId);
      qc.setQueryData(["new-design", "roster", seasonId], out);
      // The sports data had them: in at once, no ask to wait on.
      if (out.groups.length && out.source) toast(`Filled in from ${out.source}`);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!r.groups.length) {
    if (asking && r.via === "sports")
      return (
        <section className="mt-5 px-4" data-roster-fill="sports">
          <div className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
            <b className="flex items-center gap-2 text-[17px] leading-tight">
              <Users className="size-[18px] flex-none" aria-hidden />
              Getting who&rsquo;s playing
            </b>
            <small className="text-[13.5px] leading-snug text-muted-foreground">Each team&rsquo;s {people} from {r.sportsName}. It takes a moment.</small>
          </div>
        </section>
      );
    if (!r.canFill && r.held)
      return (
        <div data-roster-held>
          <EmptyState icon={Users} title={`The ${people} show up once you've seen ${show.words.episode} ${r.held.episode}`} line={`${r.sportsName} lists each team's ${people} from the games they play. Who played is a spoiler until you've seen it.`} />
        </div>
      );
    if (!r.canFill && r.waiting.length)
      return (
        <div data-roster-waiting>
          <EmptyState icon={Users} title={`The ${people} show up once they've played`} line={`${r.sportsName} lists ${listOf(r.waiting)}'s ${people} from their games. They're here after the first one.`} />
        </div>
      );
    if (!r.canFill) return <EmptyState icon={Users} title={`No ${people} yet`} line={`The ${people} show up here once the season's cast is in.`} />;
    return (
      <section className="mt-5 px-4" data-roster-fill={asking ? "asking" : "ask"}>
        <div className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
          <b className="flex items-center gap-2 text-[17px] leading-tight">
            <Sparkles className="size-[18px] flex-none" aria-hidden />
            Fill in who&rsquo;s playing
          </b>
          <small className="text-[13.5px] leading-snug text-muted-foreground">
            {asking
              ? "ChatGPT is looking it up. It takes a minute or two; you can leave this page."
              : r.unlisted
                ? `TV listings only list a sport's broadcasters, and ${r.sportsName} doesn't have these games. ChatGPT can find each team's ${people}. Everyone on the show sees them.`
                : `TV listings only list a sport's broadcasters. ChatGPT can find each team's ${people}. Everyone on the show sees them.`}
          </small>
          {!asking && r.message && <small className="text-[13px] font-semibold leading-snug text-live">{r.message}</small>}
          {!asking && (
            <div className="mt-1 flex flex-col gap-1.5">
              {r.available && (
                <Btn tone="must" wide data-roster-ask disabled={busy} onClick={ask}>
                  {busy ? "Asking…" : "Ask ChatGPT for me"}
                </Btn>
              )}
              <button type="button" data-roster-paste onClick={() => setPaste(true)} className="self-start py-1.5 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
                {r.available ? "Or copy and paste it yourself" : "Our bot's away: copy and paste instead"}
              </button>
            </div>
          )}
        </div>
        <PasteSheet
          open={paste}
          onOpenChange={setPaste}
          prompt={async () => (await rosterApi.prompt(seasonId)).prompt}
          save={async (answer) => {
            const out = await rosterApi.paste(seasonId, answer);
            qc.setQueryData(["new-design", "roster", seasonId], out);
            return out.filled;
          }}
        />
      </section>
    );
  }

  return (
    <div className="pb-6" data-roster>
      {asking && (
        <p data-roster-finding className="mx-4 mt-5 text-[13px] leading-snug text-muted-foreground">
          Finding their photos on Wikipedia. They show up in a minute.
        </p>
      )}
      <StatsBar show={show} r={r} />
      {r.groups.map((g) => (
        <section key={g.name} className="mt-6 px-4" data-roster-group={g.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="type-caption text-[22px]">{g.name}</h2>
            <span className="text-[13px] text-muted-foreground">{g.people.length}</span>
          </div>
          {g.people.map((p) => (
            <div key={p.name} data-roster-person={p.name} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2">
              {p.photoUrl ? (
                // The sports data's headshot, or a Wikimedia Commons thumbnail (both credited in Settings, Credits).
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" data-roster-photo className="size-11 flex-none rounded-[3px] bg-secondary object-cover object-top" loading="lazy" />
              ) : (
                <span aria-hidden className="type-caption grid size-11 flex-none place-items-center rounded-[3px] bg-secondary text-[15px]">
                  {p.name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold">{p.name}</b>
                {p.role && <small className="block truncate text-[13px] text-muted-foreground">{p.role}</small>}
                {p.stats?.soFar && r.stats.through != null && (
                  <StatLine data="so-far" label={`Thru ${show.words.ep} ${r.stats.through}`} items={p.stats.soFar} />
                )}
                {p.stats?.comingIn && <StatLine data="coming-in" label={r.stats.comingInLabel ?? "Coming in"} items={p.stats.comingIn} />}
              </span>
            </div>
          ))}
        </section>
      ))}
      {r.held && (
        <p data-roster-held className="mx-4 mt-5 text-[13px] leading-snug text-muted-foreground">
          More {people} show up once you&rsquo;ve seen {show.words.episode} {r.held.episode}.
        </p>
      )}
      {r.waiting.length > 0 && (
        <p data-roster-waiting className="mx-4 mt-5 text-[13px] leading-snug text-muted-foreground">
          {listOf(r.waiting)}&rsquo;s {people} show up once {r.waiting.length === 1 ? "it's" : "they've"} played.
        </p>
      )}
      {r.source && (
        <p data-roster-source className="mx-4 mt-5 text-[12.5px] leading-snug text-muted-foreground">
          {show.words.people}, headshots{r.groups.some((g) => g.people.some((p) => p.stats)) ? " and stats" : ""} from {r.source}.
        </p>
      )}
    </div>
  );
}

/** The games past where you are whose stats are in: "Game 3's stats open once you've seen it", "Games 1–3's ... as you see them". */
const waitingLine = (ep: string, from: number, to: number) =>
  from >= to ? `${ep} ${to}'s stats open once you've seen it.` : `${ep}s ${from}\u2013${to}'s stats open as you see them.`;

/** "Fremantle", "Fremantle and Brisbane Lions", "A, B and C". */
const listOf = (names: string[]) => (names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** Someone's numbers on a line, wrapping to a second at most: "Thru Game 3 · 2-13 H-AB · 1 R · 1 RBI". A race's places have no label. */
function StatLine({ label, items, data }: { label: string; items: StatItem[]; data: string }) {
  return (
    <small data-roster-stats={data} className="mt-0.5 line-clamp-2 text-[12.5px] tabular-nums text-foreground/85">
      <span className="text-muted-foreground">{label}</span>
      {items.map((i, n) => (
        <span key={n}>
          {" · "}
          {/* A value stays with its label when the line wraps. */}
          <b className="font-semibold">{i.value}</b>
          {i.label && `\u00a0${i.label}`}
        </span>
      ))}
    </small>
  );
}

/** Above the roster: what the stats cover, the sports data filling them in, and a later game's waiting for you to see it. */
function StatsBar({ show, r }: { show: ShowData; r: RosterData }) {
  const s = r.stats;
  const asking = s.asking;
  const was = useRef(asking);
  useEffect(() => {
    if (was.current && !asking) {
      if (s.message) toast.quiet(s.message);
      else toast("Stats are in");
    }
    was.current = asking;
  }, [asking, s.message]);
  const any = s.comingInLabel != null || s.through != null || s.newer != null;
  if (!any && !asking && !s.message) return null;
  const ep = show.words.episode;
  return (
    <section className="mt-5 px-4" data-roster-statsbar={asking ? "asking" : "shown"}>
      <div className="flex flex-col gap-1.5 rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-border">
        <b className="flex items-center gap-2 text-[15px] leading-tight">
          <BarChart3 className="size-[17px] flex-none" aria-hidden />
          {s.through != null ? `Stats through ${ep} ${s.through}` : any ? "Stats coming in" : asking ? "Getting their stats…" : "No stats yet"}
        </b>
        <small className="text-[13px] leading-snug text-muted-foreground" data-roster-statsline>
          {[
            s.comingInLabel ? `Coming in: ${s.comingInLabel}.` : null,
            s.through == null && s.newer == null && any ? `Each ${ep.toLowerCase()}'s stats add up here once you've seen it.` : null,
            s.newer != null ? waitingLine(ep, (s.through ?? 0) + 1, s.newer) : null,
            asking ? `Getting the latest from ${r.sportsName}.` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </small>
        {!asking && !any && s.message && <small className="text-[13px] font-semibold leading-snug text-live">{s.message}</small>}
      </div>
    </section>
  );
}
