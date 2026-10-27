"use client";

import { useState, type ReactNode } from "react";
import { whereWords } from "@/lib/sharing";
import { Check, ChevronRight, Eye, EyeOff, Grid3x3, Lock, MessageCircle, Plus } from "lucide-react";
import { airTime, calm, calmWhen, dayOf, justAired, ticks, timeOf } from "../clock";
import { AskAiSheet, checkFull } from "../backstage/ask-ai";
import { backstage, chatCouch, useAfterResults, useChatBadge, useWatchCard, type GameView, type PasteResult } from "../data";
import { gameColour, gameInk, ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { episodesOf, openWhere, type ShowData } from "../screens/show-space";
import { useMe } from "../session";
import { namesOf } from "../hub/sections";
import { PlayIt } from "./games";
import { Avatar, useNow } from "../ui/bars";
import { Btn, BtnLink, GuardChip } from "../ui/parts";
import { toast } from "../ui/toast";
import { ShowArt } from "../ui/show-bar";
import { doneCards, isRequired, moveCard, openMoves, type MoveCard } from "./moves";
import { Block, Face } from "./parts";
import { WaiversRanPlate } from "./waivers";
import { CatchUpSheet, CatchUpStrips } from "../couch/join-game";
import { openStartGame } from "../couch/start-game";
import { openPlan, PlanInvite, PlanPlates } from "../couch/watch-plans";
import { useOpenMorning, useOpenReveal } from "./reveal";
import { StatsCard } from "./stats";
import { rateLabel, RateRow } from "./rate";
import { CallResultRow, CallRow, openCall } from "./calls";
import { PollRow } from "./polls";
import { bingoEpisode as toBingo, BingoRow, openBingo, type BingoTarget } from "./bingo";
import { WatchAlongCard } from "./watch-along";
import { RemindRow } from "./remind";
import { SeenItCard } from "./seen-it";
import { useSeasonPolls } from "../data";

// Tonight (the mock's refine.js tabTonight, option 2C, 2026-10-24): the phase as a heading from the clock, then
// Your moves as swipeable cards (open first with the one yellow button on the first, then what you've already set
// as done cards with Change; all done starts with one "You're set" card), Extras this week (optional, no counts),
// Watch along (step 13: watch-along.tsx; and the couch's planned nights, step 11 part 3), your games and the cast's stats. No dock before airtime and
// no commissioner job (5B: Backstage and
// a dot on the show's ⋯ carry it). After an episode, by the results' stage (step 2): waiting for results (the
// stage bar), results in (the one yellow: Reveal; a move that waits on them says so), the morning update once the
// final scores land after an early reveal, and the last episode's recap until the next one airs. All real: the stats card is
// stats.tsx's (step 3); Rate it in Extras
// (step 12 part 1: the latest episode you've seen, rate.tsx); Call it for the next episode and the couch's open polls in Extras
// (part 2: calls.tsx, polls.tsx), Weekly Calls' calls a move card; your bingo card in Extras, and in Tonight while it's on (part
// 3: bingo.tsx), Weekly Bingo's a card in Your moves. Results from
// everyone (step 6b): a player who has seen an episode with only its early results gets a quiet "Full scores need one
// paste · Fill it in" when the couch lets anyone fill them in. A streaming season (step 14; the mock's streaming.js wTonight):
// before its drop, the drop plate (every episode at once, when, the countdown); after it, your next episode at your own pace,
// with Watch along first. Under the heading, the reminder ask's row while nothing reaches you (remind.tsx).

export function Tonight({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const playing = show.games.some((g) => g.yourRole);
  const [catchUp, setCatchUp] = useState<GameView | null>(null);
  return (
    <>
      {playing && <WaiversRanPlate seasonId={seasonId} show={show} />}
      {playing && <CatchUpStrips show={show} onOpen={setCatchUp} />}
      <CatchUpSheet show={show} game={catchUp} onOpenChange={(o) => !o && setCatchUp(null)} />
      <DropPlate show={show} />
      {!playing && <SeenItCard show={show} />}
      <PhaseHead show={show} />
      {playing && <RemindRow seasonId={seasonId} show={show} />}
      {!playing && <Following show={show} />}
      {playing && <AfterEpisode seasonId={seasonId} show={show} />}
      {playing && <FillItIn seasonId={seasonId} show={show} />}
      <WatchAlongCard seasonId={seasonId} show={show} place="lead" />
      <OnTonight show={show} />
      {playing && <YourMoves seasonId={seasonId} show={show} />}
      {playing && <LastTime show={show} />}
      <Extras show={show} />
      <WatchAlongCard seasonId={seasonId} show={show} place="below" />
      <PlannedNights seasonId={seasonId} show={show} />
      {!playing && <WhosWatching show={show} />}
      {!playing && (!show.solo || !show.ready) && <PlayIt show={show} />}
      {playing && <YourGames seasonId={seasonId} show={show} />}
      <StatsCard seasonId={seasonId} show={show} />
    </>
  );
}

/** "Episode 6 · Wed 8:05 PM · in 4 days", "On air · Episode 6 · Locked at 8:05 PM"; at your own pace (step 14), "Episode 4 ·
 *  Your own pace" or "You finished it". Before a streaming drop the drop plate says it all. */
function PhaseHead({ show }: { show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  let title: ReactNode;
  let aside: string | null = null;
  const eps = show.episodes;
  const n = episodesOf(show);
  if (show.dropAt != null && show.dropAt > now) return null;
  if (!up?.live && (eps?.reveal || eps?.waiting)) {
    // An episode's results come first: in (to reveal), or not yet.
    title = `Episode ${eps.reveal?.episode ?? eps.waiting!.episode}`;
    aside = eps.reveal ? (eps.reveal.stage === "early" ? "Early results" : "Results") : justAired(eps.waiting!.airAt) ? "Just aired" : "Aired";
  } else if (show.ownPace && !up) {
    const seen = show.following || show.plays ? show.seenThrough : null;
    aside = "Your own pace";
    if (seen == null) title = n ? `All ${n} episodes are out` : "Every episode is out";
    else if (n && seen >= n) {
      title = "You finished it";
      aside = `All ${n} episodes`;
    } else title = `Episode ${seen + 1}`;
  } else if (up?.live) {
    title = (
      <>
        <i className="size-[9px] animate-pulse rounded-full bg-live" aria-hidden />
        On air · Episode {up.number}
      </>
    );
    aside = t != null ? `Locked at ${timeOf(t)}` : null;
  } else if (up) {
    title = `Episode ${up.number}`;
    aside = t != null ? calmWhen(t, now) : null;
  } else if (show.header?.episodeCount && show.latestAired >= show.header.episodeCount) {
    title = "Season over";
  } else {
    title = show.latestAired ? `Episode ${show.latestAired}` : "Coming up";
    aside = show.latestAired ? "Aired" : null;
  }
  return (
    <div data-phase className="mx-4 mt-[18px] flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
      <b className="type-caption flex items-center gap-2 text-[22px]">{title}</b>
      {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
    </div>
  );
}

/** Before a streaming season drops (step 14; the mock's b-dropbox): every episode at once, when, the countdown (calm days, then
 *  the clock inside the last day), the service, and who on the couch is waiting for it (who follows it openly: nothing more). */
function DropPlate({ show }: { show: ShowData }) {
  const me = useMe();
  const at = show.dropAt;
  const now = useNow(at != null && ticks(at));
  if (at == null || at <= now || !show.header) return null;
  const n = episodesOf(show);
  const who = (show.people ?? []).filter((p) => p.userId !== me.id && p.watching).map((p) => p.name);
  const line = [show.header.show.network, show.solo ? null : who.length ? `${namesOf(who)} ${who.length === 1 ? "is" : "are"} waiting for it` : "Be the first on the couch"];
  return (
    <section className="mt-[18px] px-4">
      <div data-drop-plate className="flex flex-col gap-1 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
        <span className="type-caption self-start bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          {n ? `All ${n} episodes at once` : "Every episode at once"}
        </span>
        <b className="type-caption mt-1 text-[30px] leading-none">Drops {airTime(at)}</b>
        <span data-drop-countdown className="type-num text-[34px] leading-none">
          {calm(at, now)}
        </span>
        <small className="text-[13px] leading-snug text-plate-muted">{line.filter(Boolean).join(" · ")}</small>
      </div>
    </section>
  );
}

// ---------- a show you don't play (step 10) ----------

/** On your shows: the one spoiler chip (Change opens where you are) and, watching privately, a line saying so. Not on them:
 *  who on the couch watches it, and Add to my shows. */
function Following({ show }: { show: ShowData }) {
  const me = useMe();
  if (!show.following) {
    const who = (show.people ?? []).filter((p) => p.userId !== me.id && (p.watching || p.playing.length)).map((p) => p.name);
    return (
      <section className="mt-[18px] px-4">
        <div data-follow-card className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
          {who.length > 0 && (
            <span className="flex">
              {(show.people ?? [])
                .filter((p) => p.userId !== me.id && (p.watching || p.playing.length))
                .slice(0, 6)
                .map((p, i) => (
                  <span key={p.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--card)] ${i ? "-ml-1.5" : ""}`}>
                    <Avatar id={p.userId} name={p.name} size={30} />
                  </span>
                ))}
            </span>
          )}
          <b className="text-[17px] leading-tight">
            {who.length ? `${namesOf(who)} ${show.streaming ? (who.length === 1 ? "is streaming" : "are streaming") : who.length === 1 ? "watches" : "watch"} this` : "Not on your shows"}
          </b>
          <small className="text-[13.5px] leading-snug text-muted-foreground">
            {/* A streaming season has an Up next only before its drop (schedule.ts upNext). */}
            {show.streaming && show.dropAt != null && show.upNext
              ? `All ${episodesOf(show) || "its"} episodes drop ${airTime(show.dropAt)}. Add it and it's on your list, ready; nothing past your episode ever shows.`
              : show.streaming && who.length
                ? `All ${episodesOf(show) || "its"} episodes are out. Add it to watch along with their reactions, at your own pace.`
                : "Add it and the couch sees you watch it (or watch privately). Nothing past your episode ever shows."}
          </small>
          <Btn wide className="mt-1" data-follow-add onClick={() => openWhere(show)}>
            <Plus className="size-5" aria-hidden />
            Add to my shows
          </Btn>
        </div>
      </section>
    );
  }
  return (
    <section className="mt-[18px] px-4" data-following>
      <GuardChip seenThrough={show.seenThrough} onChange={() => openWhere(show)} />
      {show.watchingPrivately && (
        <p data-private-line className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <EyeOff className="size-4 flex-none" aria-hidden />
          Watching privately: the couch doesn&rsquo;t see this on your list
        </p>
      )}
    </section>
  );
}

/** Who on the couch watches it (openly) or plays a game on it, you first, and how far each is where they share it (step 15 part
 *  3's Where I am: "On Episode 5", "Caught up", "2 ahead"; at your own pace "Ep 4 of 8" with a bar), and who's watching along right
 *  now, which says the episode (step 13 part 2: the Watch along card's read, only from those who share When I'm watching). */
function WhosWatching({ show }: { show: ShowData }) {
  const me = useMe();
  const card = useWatchCard(show.header?.seasonId ?? null, show.couch?.id ?? null, !!show.header);
  const nowOf = (userId: string) => (card.data?.now ?? []).find((w) => w.userId === userId);
  const total = episodesOf(show) ?? 0;
  const mine = show.following && show.seenThrough != null && Number.isFinite(show.seenThrough) ? show.seenThrough : null;
  const seenOf = (p: { userId: string; seen?: number | null }) => (p.userId === me.id ? mine : (p.seen ?? null));
  const where = (seen: number | null) => (seen == null ? null : whereWords(seen, { aired: show.streaming ? total : show.latestAired, total, ownPace: show.ownPace }));
  const people = (show.people ?? []).filter((p) => p.watching || p.playing.length || p.userId === me.id);
  const list = [...people.filter((p) => p.userId === me.id && (show.following || p.playing.length)), ...people.filter((p) => p.userId !== me.id)];
  if (!list.length || show.solo) return null;
  const others = list.filter((p) => p.userId !== me.id).length;
  const gameOf = (id: string) => show.games.find((g) => g.leagueId === id)?.gameName;
  return (
    <Block title="Who's watching" aside={show.ownPace ? `${list.length} · at their own pace` : `${list.length} on the couch`}>
      <div data-whos-watching>
        {list.map((p) => {
          const you = p.userId === me.id;
          const plays = p.playing.map(gameOf).filter(Boolean);
          const on = you ? null : nowOf(p.userId);
          const seen = seenOf(p);
          const at = where(seen);
          const ahead = !you && seen != null && mine != null && seen > mine ? seen - mine : 0;
          return (
            <div key={p.userId} data-watcher={p.name} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
              <Avatar id={p.userId} name={p.name} size={34} />
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-2 text-[15px] font-semibold">
                  {p.name}
                  {you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-px text-[10px] tracking-[0.05em] text-background">You</span>}
                </b>
                <small className="block text-[13px] text-muted-foreground" data-watcher-where={at ?? undefined}>
                  {on ? (
                    <span data-watching-now className="font-semibold text-good">
                      Watching now · Episode {on.episode}
                    </span>
                  ) : (
                    [
                      plays.length ? `Plays ${plays.join(" and ")}` : null,
                      at ?? (plays.length ? null : you && show.watchingPrivately ? "Watching privately" : "Watches it"),
                      you && show.watchingPrivately && at ? "private" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  )}
                </small>
                {show.ownPace && seen != null && total > 0 && seen > 0 && (
                  <span className="mt-1.5 block h-[3px] w-full max-w-[160px] overflow-hidden rounded-full bg-border" aria-hidden>
                    <i className="block h-full bg-chyron-line" style={{ width: `${Math.min(100, (seen / total) * 100)}%` }} />
                  </span>
                )}
              </span>
              {ahead > 0 && (
                <span data-ahead={ahead} className="type-caption flex-none text-[12px] tracking-[0.04em] text-muted-foreground">
                  {ahead} ahead
                </span>
              )}
            </div>
          );
        })}
        {!others && <p className="mt-1 text-[13px] text-muted-foreground">Nobody else on the couch watches it yet.</p>}
      </div>
    </Block>
  );
}

// ---------- Your moves ----------

function YourMoves({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const open = show.moves.filter(isRequired);
  const kinds = open.map((m) => m.kind);
  // A move whose game is waiting on results you haven't revealed says so, and its button is the reveal.
  const waitsOn = (leagueId: string) => show.play?.find((g) => g.leagueId === leagueId)?.revealFirst ?? null;
  const cards = open.map((m) => {
    const c = moveCard(m, seasonId, kinds.filter((k) => k === m.kind).length > 1);
    const n = waitsOn(m.leagueId);
    if (!n || (c.tab !== "lineup" && c.tab !== "pool")) return c;
    const when = m.deadline ? ` · ${c.tab === "lineup" ? "locks" : "closes"} ${airTime(Date.parse(m.deadline))}` : "";
    return { ...c, line: `After you reveal Episode ${n}${when}`, action: `Reveal Episode ${n}`, reveal: n };
  });
  // With results to reveal, the reveal plate above is the one yellow.
  const quiet = !!show.episodes?.reveal;
  const done = show.play ? doneCards(show.play) : [];
  // Weekly Calls' cards open Call it for their episode (step 12 part 2), Weekly Bingo's its card (part 3).
  const onCall = (episode: number) => openCall({ seasonId, couchId: show.couch?.id ?? null, episode, label: rateLabel(show), solo: show.solo });
  const onBingo = (episode: number) => openBingo({ seasonId, couchId: show.couch?.id ?? null, episode, label: rateLabel(show), solo: show.solo });
  const due = open[0]?.deadline ? Date.parse(open[0].deadline) : t;

  let body: ReactNode;
  if (up?.live) {
    body = <DoneCard icon={Lock} title="Your moves are locked" line="Scores stay hidden until you reveal" />;
  } else if (!cards.length && !done.length) {
    body = (
      <DoneCard
        icon={Check}
        title={up ? `You're set for Episode ${up.number}` : "Nothing due"}
        line={t != null ? `Change anything until ${airTime(t)}` : "Nothing to set until the next episode"}
        action={up && show.play?.length ? <Btn onClick={() => openMoves("lineup")} wide className="mt-1">Change</Btn> : undefined}
      />
    );
  } else {
    // Open moves first (the first one's button the one yellow), then what you've set, as done cards; with nothing
    // open, one "You're set" card leads them.
    const items: { key: string; node: ReactNode }[] = [
      ...(cards.length || !up
        ? []
        : [{ key: "set", node: <SetCard title={`You're set for Episode ${up.number}`} line={t != null ? `Change anything until ${airTime(t)}` : "Change anything until it airs"} /> }]),
      ...cards.map((c, i) => ({ key: c.key, node: <OpenCard card={c} n={i + 1} must={i === 0 && !quiet} onCall={onCall} /> })),
      ...done.map((c) => ({ key: c.key, node: <DoneMove card={c} onCall={onCall} onBingo={onBingo} /> })),
    ];
    // A new set of cards (a save made one done) starts back at the first, so what's still due is in view.
    body = <MoveCards key={items.map((it) => it.key).join()} items={items} />;
  }
  return (
    <Block title="Your moves" aside={up?.live ? "Locked" : cards.length ? `${cards.length} to do before ${due != null ? dayOf(due) : "airtime"}` : "All done"}>
      {body}
    </Block>
  );
}

/** The cards, one in view at a time, swiped sideways, with a dot each. */
function MoveCards({ items }: { items: { key: string; node: ReactNode }[] }) {
  const [at, setAt] = useState(0);
  return (
    <>
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]"
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
          setAt(Math.round(el.scrollLeft / (w + 10)));
        }}
      >
        {items.map((it) => (
          <div key={it.key} className={`flex flex-none snap-start ${items.length > 1 ? "w-[calc(100%-36px)]" : "w-full"}`}>
            {it.node}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
          {items.map((it, i) => (
            <i key={it.key} className={`h-1 w-[18px] rounded-[2px] transition-colors ${i === at ? "bg-foreground" : "bg-border"}`} />
          ))}
        </div>
      )}
    </>
  );
}

/** A move still to make: its number, what it is, and its button (yellow only on the first). */
function OpenCard({ card: c, n, must, onCall }: { card: MoveCard & { reveal?: number }; n: number; must: boolean; onCall: (episode: number) => void }) {
  const openReveal = useOpenReveal();
  return (
    <div data-move={c.key} className="flex w-full flex-col gap-1.5 rounded-[4px] bg-card p-4">
      <span className="type-num text-[30px] leading-none text-muted-foreground">{n}</span>
      <b className="type-caption text-[26px] leading-none">{c.title}</b>
      <small className="mb-2.5 block text-sm leading-snug text-muted-foreground">{c.line}</small>
      {c.reveal ? (
        <Btn tone={must ? "must" : "optional"} wide className="mt-auto" onClick={() => openReveal(c.reveal!)}>
          {c.action}
        </Btn>
      ) : c.href ? (
        <BtnLink href={c.href} tone={must ? "must" : "optional"} wide className="mt-auto">
          {c.action}
        </BtnLink>
      ) : c.call ? (
        <Btn tone={must ? "must" : "optional"} wide className="mt-auto" onClick={() => onCall(c.call!)}>
          {c.action}
        </Btn>
      ) : (
        <Btn tone={must ? "must" : "optional"} wide className="mt-auto" onClick={() => openMoves(c.tab ?? "lineup", c.leagueId ?? null)}>
          {c.action}
        </Btn>
      )}
    </div>
  );
}

/** A move you've made that can still change; or Weekly Bingo's card, ready for the show (a card's icon, not a tick). */
function DoneMove({ card: c, onCall, onBingo }: { card: MoveCard; onCall: (episode: number) => void; onBingo: (episode: number) => void }) {
  return (
    <div data-done={c.key} className="flex w-full flex-col gap-1.5 rounded-[4px] bg-background p-4 outline-1 -outline-offset-1 outline-border">
      {c.bingo ? (
        <span className="grid size-[30px] place-items-center rounded-[3px] bg-secondary">
          <Grid3x3 className="size-4" aria-hidden />
        </span>
      ) : (
        <span className="grid size-[30px] place-items-center rounded-full bg-good/20 text-good">
          <Check className="size-4" strokeWidth={2.6} aria-hidden />
        </span>
      )}
      <b className="type-caption text-[26px] leading-none">{c.title}</b>
      <small className="mb-2.5 block text-sm leading-snug text-muted-foreground">{c.line}</small>
      <Btn wide className="mt-auto" onClick={() => (c.bingo ? onBingo(c.bingo) : c.call ? onCall(c.call) : openMoves(c.tab ?? "lineup", c.leagueId ?? null))}>
        {c.action}
      </Btn>
    </div>
  );
}

/** Nothing left to do: the first of the done cards. */
function SetCard({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-[4px] bg-background p-4 outline-1 -outline-offset-1 outline-border">
      <span className="grid size-[34px] place-items-center rounded-full bg-good/20 text-good">
        <Check className="size-[18px]" strokeWidth={2.6} aria-hidden />
      </span>
      <b className="type-caption text-[26px] leading-none">{title}</b>
      <small className="block text-sm leading-snug text-muted-foreground">{line}</small>
    </div>
  );
}

function DoneCard({ icon: Icon, title, line, action }: { icon: typeof Check; title: string; line: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[4px] bg-background p-4 outline-1 -outline-offset-1 outline-border">
      <span className="grid size-[34px] place-items-center rounded-full bg-good/20 text-good">
        <Icon className="size-[18px]" strokeWidth={2.6} aria-hidden />
      </span>
      <b className="type-caption text-[26px] leading-none">{title}</b>
      <small className="block mb-1 text-sm leading-snug text-muted-foreground">{line}</small>
      {action}
    </div>
  );
}

// ---------- after an episode ----------

/** The three stages of an episode's results, for the bar under Waiting and early results. */
function StageBar({ episode, stage, airAt }: { episode: number; stage: "waiting" | "early" | "final"; airAt: string | null }) {
  const steps: [typeof stage, string, string][] = [
    ["waiting", "Aired", airAt ? (justAired(airAt) ? "Just now" : airTime(Date.parse(airAt))) : "It's out"],
    ["early", "Early results", "Who went home"],
    ["final", "Final scores", "Every point"],
  ];
  const at = steps.findIndex((s) => s[0] === stage);
  return (
    <div data-stage-bar={stage} className="mt-3 rounded-[4px] p-3.5 outline-1 -outline-offset-1 outline-border">
      <span className="type-caption block text-[13px] tracking-[0.04em] text-muted-foreground">Episode {episode} results</span>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {steps.map(([k, title, line], i) => (
          <div key={k} aria-current={i === at ? "step" : undefined}>
            <i className={`block h-1 rounded-[2px] ${i < at ? "bg-good" : i === at ? "bg-foreground" : "bg-secondary"}`} />
            <b className={`mt-2 block text-[15px] ${i <= at ? "" : "text-muted-foreground"}`}>{title}</b>
            <small className="block text-xs leading-snug text-muted-foreground">{line}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "riley", "riley and sam", "riley, sam and jordan" … "have revealed". */
const revealedWords = (who: string[]) =>
  `${who.length <= 2 ? who.join(" and ") : `${who.slice(0, -1).join(", ")} and ${who[who.length - 1]}`} ${who.length === 1 ? "has" : "have"} revealed`;

/** What an episode's results need from you now: waiting for them, revealing them, or seeing its final scores. */
function AfterEpisode({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const openReveal = useOpenReveal();
  const openMorning = useOpenMorning();
  const eps = show.episodes;
  // Who the chat's reveal lines say has revealed it (the frame polls this with the Chat tab's badge).
  const revealed = useChatBadge(seasonId, chatCouch(show), eps?.reveal?.episode ?? null).data?.revealed ?? [];
  if (!eps || show.upNext?.live) return null;
  // Catching up in step with it (step 9): the strip above reveals it, moving your linked games with it; one way, not two.
  const inStep = !!eps.reveal && (show.play ?? []).some((g) => g.catchUp?.week === eps.reveal!.episode);
  if (eps.reveal && !inStep) {
    const n = eps.reveal.episode;
    const early = eps.reveal.stage === "early";
    return (
      <section className="mt-[26px] px-4">
        <div data-results-in={n} className="relative isolate overflow-hidden rounded-[4px] p-4 shadow-[0_14px_30px_rgba(0,0,0,.4)]">
          {show.header && <ShowArt seasonId={show.header.seasonId} artUrl={show.header.show.artUrl} name={show.header.show.name} className="absolute inset-0 -z-[2] size-full blur-[2px] brightness-[.4]" />}
          <span className="type-caption inline-block bg-chyron py-1 pl-2 pr-4 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
            Episode {n}
          </span>
          <b className="type-caption mt-3 block text-[34px] leading-none text-white">{early ? "Early results are in" : "Results are in"}</b>
          <small className="mt-2 block text-sm leading-snug text-white/85">
            {early ? "Who went home, Survival Pool and Outlast. Weekly Lineup's full scores come later." : "Watched it? Reveal for every game at once. Nothing shows until then."}
          </small>
          {revealed.length > 0 && (
            <small data-revealed className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-white/85">
              <MessageCircle className="mt-px size-3.5 flex-none" aria-hidden />
              {revealedWords(revealed)} · chat is folded for you
            </small>
          )}
          <Btn tone="must" wide className="mt-4" onClick={() => openReveal(n)}>
            <Eye className="size-5" aria-hidden />
            Reveal Episode {n}
          </Btn>
        </div>
        {early && <StageBar episode={n} stage="early" airAt={eps.episodes.find((e) => e.number === n)?.airAt ?? null} />}
      </section>
    );
  }
  if (eps.waiting) {
    return (
      <section className="mt-[26px] px-4">
        <div data-waiting={eps.waiting.episode} className="flex items-start gap-3 rounded-[4px] bg-card p-4">
          <span className="mt-1 grid size-6 flex-none place-items-center rounded-full bg-chyron-line/20">
            <i className="size-2.5 animate-pulse rounded-full bg-chyron-line" />
          </span>
          <span>
            <b className="type-caption block text-[24px] leading-none">Waiting for results</b>
            <small className="mt-1.5 block text-sm leading-snug text-muted-foreground">Who went home usually lands a little after the episode ends. Nothing is spoiled in the meantime.</small>
          </span>
        </div>
        <StageBar episode={eps.waiting.episode} stage="waiting" airAt={eps.waiting.airAt} />
      </section>
    );
  }
  if (eps.final) {
    const n = eps.final.episode;
    return (
      <section className="mt-[26px] px-4">
        <button
          type="button"
          data-morning={n}
          onClick={() => openMorning(n)}
          className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
        >
          {/* Good news, not a duty: teal (yellow is for what you must do). */}
          <span className="type-caption -mr-[13px] flex items-center whitespace-nowrap bg-good py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] text-good-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
            Morning update
          </span>
          <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
            <span className="text-[17px] font-bold">Final scores are in</span>
            <span className="text-[13px] text-plate-muted">Episode {n} · every point counted</span>
          </span>
          <span className="grid place-items-center px-3">
            <ChevronRight className="size-5" aria-hidden />
          </span>
        </button>
      </section>
    );
  }
  return null;
}

/** A player's quiet ask (step 6b): Episode N's full scores need one paste, and anyone on the couch can do it. */
function FillItIn({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const [open, setOpen] = useState(false);
  const refresh = useAfterResults();
  const n = show.episodes?.fill?.episode ?? null;
  const couchId = show.couch?.id ?? null;
  if (!n || !couchId) return null;
  // Pasted, or fetched by One tap: the same thanks.
  const thanks = async (r: PasteResult) => {
    setOpen(false);
    await refresh();
    if (r.kind !== "full") return;
    toast(r.applied ? "Thanks! Every game on the couch is scored" : `Thanks! ${r.waiting} ${r.waiting === 1 ? "result waits" : "results wait"} for whoever runs the games`);
  };
  return (
    <section className="mt-[26px] px-4">
      <button type="button" data-fill-it={n} onClick={() => setOpen(true)} className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left outline-1 -outline-offset-1 outline-input">
        <span className="min-w-0 flex-1">
          <b className="block text-[16px]">Full scores need one paste</b>
          <small className="block text-[13px] text-muted-foreground">Episode {n} · anyone on the couch can do it · about 2 minutes</small>
        </span>
        <span className="text-[15px] font-bold">Fill it in</span>
      </button>
      <AskAiSheet
        open={open}
        onOpenChange={setOpen}
        title={`Fill in Episode ${n}`}
        what={`An AI searches the web for everything that happened in Episode ${n}, then answers in a format we can read: every game on the couch scores.`}
        seasonId={seasonId}
        couchId={couchId}
        episode={n}
        kind="full"
        check={checkFull}
        onUse={async (answer, opts) => thanks(await backstage.paste(seasonId, couchId, { episode: n, kind: "full", answer, ...opts }))}
        onTapped={thanks}
        seasonName={show.header ? `${show.header.show.name} ${show.header.seasonNumber}` : "this season"}
      />
    </section>
  );
}

/** The last episode you've seen, until the next one airs: who went home and your night in each game. */
function LastTime({ show }: { show: ShowData }) {
  const eps = show.episodes;
  const e = eps?.episodes[0];
  if (!eps || eps.reveal || eps.waiting || !e || e.status !== "seen" || e.number < show.latestAired || show.upNext?.live) return null;
  const lines = e.lines ?? [];
  return (
    <Block title={`Episode ${e.number}`} aside={e.stage === "early" ? "Early results" : "Results"}>
      <div data-last-time={e.number} className="flex flex-col gap-2.5">
        {(e.out ?? []).map((c) => (
          <div key={c.id} className="flex min-h-[64px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <Face src={c.photo} name={c.name} className="w-16 flex-none text-2xl" />
            <span className="type-caption -mr-[13px] flex items-center bg-live py-0 pl-3 pr-[22px] text-sm tracking-[0.04em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              Out
            </span>
            <span className="flex flex-1 flex-col justify-center py-2 pl-5 pr-3">
              <b className="type-caption text-[19px]">{c.name}</b>
              <small className="block text-[13px] text-plate-muted">{[c.method, c.place ? `finished ${ordinal(c.place)}` : null].filter(Boolean).join(" · ")}</small>
            </span>
          </div>
        ))}
        {lines.length > 0 && (
          <div className="rounded-[4px] bg-card px-3.5 pb-1 pt-3">
            <span className="type-caption block text-[13px] tracking-[0.04em] text-muted-foreground">Your night</span>
            {lines.map((l) => (
              <div key={`${l.leagueId}-${l.gameType}`} className="grid grid-cols-[110px_1fr] items-baseline gap-x-2.5 border-t border-border py-2.5 first-of-type:border-t-0">
                <span className="type-caption text-[13px] tracking-[0.04em]" style={{ color: l.gameType === "predictions" ? "var(--muted-foreground)" : gameInk(l.gameName) }}>
                  {l.gameName}
                </span>
                <span className="min-w-0">
                  <b className="block text-[17px]">{l.big}</b>
                  <small className="block truncate text-[13px] text-muted-foreground">{l.line}</small>
                </span>
              </div>
            ))}
          </div>
        )}
        {e.out?.length === 0 && lines.length === 0 && <p className="text-sm text-muted-foreground">Nobody went home in Episode {e.number}.</p>}
        <NavLink href={`${paths.show(show.header?.seasonId ?? "", "episodes")}?page=ep${e.number}`} replace className="flex h-11 items-center justify-center gap-1 rounded-[3px] font-bold outline-1 -outline-offset-1 outline-input">
          What happened in Episode {e.number} <ChevronRight className="size-4" aria-hidden />
        </NavLink>
      </div>
    </Block>
  );
}

// ---------- Extras this week ----------

function ExtraRow({ title, line, state, onClick }: { title: string; line: string; state: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">{state}</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** The episode Rate it asks about: the latest you've seen that has aired (step 12 part 1), on a show you follow or play. */
function toRate(show: ShowData): number | null {
  const playing = show.games.some((g) => g.yourRole);
  if (!show.header || (!show.following && !playing)) return null;
  const n = Math.min(show.seenThrough ?? show.latestAired, show.latestAired);
  return n >= 1 ? n : null;
}

/** The episode Call it asks about: the next to air (step 12 part 2), on a show that's a game you follow or play, unless your Weekly
 *  Calls game here already asks for it as a move. */
function toCall(show: ShowData): number | null {
  const up = show.upNext;
  const playing = show.games.some((g) => g.yourRole);
  if (!show.header || !show.ready || !up || up.live || (!show.following && !playing)) return null;
  if (show.games.some((g) => g.yourRole && g.gameType === "weekly-calls")) return null;
  return up.number;
}

function Extras({ show }: { show: ShowData }) {
  const up = show.upNext;
  const predictions = show.moves.filter((m) => m.kind === "prediction");
  const rate = toRate(show);
  const call = toCall(show);
  // Your bingo card (Weekly Bingo's is a card in Your moves), and how the latest you've seen went once you ticked it.
  const bingo = show.games.some((g) => g.yourRole && g.gameType === "weekly-bingo") ? null : toBingo(show);
  const couchId = show.couch?.id ?? null;
  // The couch's polls still open on this show (step 12 part 2): yours to vote in until it airs.
  const polls = useSeasonPolls(show.header?.seasonId ?? null, couchId, !show.solo && !!couchId);
  const open = (polls.data?.polls ?? []).some((p) => p.open);
  if (up?.live || (!predictions.length && !call && !rate && !bingo && !open)) return null;
  return (
    <Block title="Extras this week" aside="Optional">
      {predictions.map((m) => (
        <ExtraRow key={m.leagueId} title={m.text} line={`Closes at airtime · ${m.leagueName}`} state="Open" onClick={() => openMoves("predict")} />
      ))}
      {call && show.header && <CallRow target={{ seasonId: show.header.seasonId, couchId, episode: call, label: rateLabel(show), solo: show.solo }} />}
      {couchId && (polls.data?.polls ?? []).filter((p) => p.open).map((p) => <PollRow key={p.id} p={p} couchId={couchId} />)}
      {rate && show.header && (
        <RateRow
          target={{ seasonId: show.header.seasonId, couchId, episode: rate, label: rateLabel(show), solo: show.solo }}
          verdict={show.episodes?.episodes.find((e) => e.number === rate)?.verdict}
        />
      )}
      {/* How your calls on it went (step 12 part 2), on a show that's a game: a talk show's say what happened here. */}
      {rate && show.header && show.ready && (
        <CallResultRow target={{ seasonId: show.header.seasonId, couchId, episode: rate, label: rateLabel(show), solo: show.solo }} need="mine" />
      )}
      {bingo && show.header && (
        <BingoRow target={bingoTarget(show, bingo)} title={up && bingo === up.number ? "Your bingo card" : undefined} />
      )}
      {rate && show.header && show.ready && rate !== bingo && <BingoRow target={bingoTarget(show, rate)} need="mine" />}
    </Block>
  );
}

const bingoTarget = (show: ShowData, episode: number): BingoTarget => ({
  seasonId: show.header!.seasonId,
  couchId: show.couch?.id ?? null,
  episode,
  label: rateLabel(show),
  solo: show.solo,
});

/** While the episode's on (the mock's during phase): your bingo card, tick it as it happens. */
function OnTonight({ show }: { show: ShowData }) {
  const up = show.upNext;
  if (!up?.live || toBingo(show) !== up.number || !show.header) return null;
  return (
    <Block title="Tonight" aside="On air">
      <BingoRow target={bingoTarget(show, up.number)} />
    </Block>
  );
}

// ---------- Watch along: watch-along.tsx (step 13) ----------

/** The couch's planned nights for this show (step 11 part 3; the mock's w-plan), and Plan a watch along when your next episode
 *  has none. On a couch only. */
function PlannedNights({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const me = useMe();
  const couchId = show.couch?.id ?? null;
  if (show.solo || !couchId || !show.header) return null;
  const plans = (show.home?.plans ?? []).filter((p) => p.couchId === couchId && p.seasonId === seasonId);
  const next = show.upNext?.number ?? (show.seenThrough ?? show.latestAired) + 1;
  // A season watched at your own pace that you've finished has no next episode to plan (step 14).
  const finished = show.ownPace && !show.upNext && episodesOf(show) > 0 && next > episodesOf(show);
  return (
    <section className="mt-2.5 flex flex-col gap-2.5 px-4" data-planned-nights>
      <PlanPlates plans={plans} me={me.id} />
      {!finished && !plans.some((p) => p.episode === next) && (
        <PlanInvite
          onClick={() => openPlan({ kind: "new", seasonId, couchId })}
          // A season watched at your own pace has no live airing (step 14): a night is a shared start, the premiere's from its drop.
          title={show.streaming && show.upNext ? "Plan a watch along for the premiere" : undefined}
          line={show.ownPace || show.streaming ? "Pick a time, start at the same moment, anyone can pause" : undefined}
        />
      )}
    </section>
  );
}

// ---------- Your games ----------

/** The line under your place: points, your streak now, or who's still in. */
export function yourLine(g: GameView): string {
  const me = g.you;
  if (!me) return "Not on the table yet";
  if (g.gameType === "pickem") return `streak ${me.week ?? 0}`;
  if (g.gameType === "weekly-calls") return `${me.total} ${me.total === 1 ? "call" : "calls"} right`;
  if (g.gameType === "weekly-bingo") return `${me.total} ${me.total === 1 ? "line" : "lines"}`;
  if (g.gameType === "active-roster") return `${me.total} pts`;
  const team = me.team.map((id) => g.cast.find((c) => c.id === id)).filter((c) => !!c);
  return `${team.filter((c) => !c.knocked).length} of ${team.length} still in`;
}

/** Your place in a game: "1st", or "T2" for a tie. */
export const placeOf = (g: GameView) => (!g.you ? "—" : g.you.rank.startsWith("T") ? g.you.rank : ordinal(g.you.place));

function YourGames({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const tab = paths.show(seasonId, "games");
  if (!show.play) return <div aria-busy className="mx-4 mt-[26px] h-[150px] animate-pulse rounded-[4px] bg-card" />;
  const twin = (g: GameView) => show.play!.filter((x) => x.gameType === g.gameType).length > 1;
  return (
    <section className="mt-[26px] px-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="type-caption text-[24px]">Your games</h2>
        <NavLink href={tab} replace className="text-[15px] font-semibold">
          Standings
        </NavLink>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {show.play.map((g) => (
          <NavLink
            key={g.leagueId}
            href={tab}
            replace
            data-game={g.leagueId}
            className="nd-press flex min-h-[104px] flex-col gap-1.5 rounded-b-[4px] border-t-[3px] bg-card p-3"
            style={{ borderTopColor: gameColour(g.gameName) }}
          >
            <span className="type-caption truncate text-xs tracking-[0.04em] text-muted-foreground">{twin(g) ? g.name : g.gameName}</span>
            <b className="type-num text-[36px] leading-none">{placeOf(g)}</b>
            <small className="block text-xs text-muted-foreground">{yourLine(g)}</small>
          </NavLink>
        ))}
        {!show.solo && (
          <button
            type="button"
            data-tonight-start
            onClick={() => openStartGame({ seasonId, couchId: show.couch?.id ?? null })}
            className="nd-press flex min-h-[104px] w-full flex-col justify-center gap-1.5 rounded-[4px] p-3 text-left text-muted-foreground outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
          >
            <Plus className="size-5" aria-hidden />
            <b className="text-[15px] text-foreground">Start a game</b>
            <small className="block text-xs">Anyone on the couch can</small>
          </button>
        )}
      </div>
    </section>
  );
}
