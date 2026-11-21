"use client";

import { useState, type ReactNode } from "react";
import { BellRing, CalendarClock, ChevronRight, Eye, EyeOff, ListChecks, LogOut, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { gameAdmin, useAfterReveal, useAfterWatching, useAiredEpisodes, useProfile, useShowNotify, watching, type KeepUp, type OutPreview } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { openWhere, type ShowData } from "../screens/show-space";
import { useReach } from "../show/remind";
import { ShowNotifySheet } from "../show/notify-sheet";
import { useNow } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { PushedPage, usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { muteEnd } from "./api";
import { Choice, Fold } from "./controls";

// A show's settings for you (settings Round 2; docs/design-round/settings-r2-spec.md, -first-view.md, -shape.md): the page behind
// the gear on the show's bar (Round 0's "one gear on every bar"). It answers "how does this show treat me?" with a value on every
// row, so most visits end at the first view:
//   1. Episodes you've watched: the value with the episode's air date; opens Where you are. A sport whose scores show live has
//      nothing to set, and says so.
//   2. When a new episode airs (a show you follow and don't play, still airing): Ask me (Recommended) · Mark it watched · Nothing.
//   3. When results show here (A7): your default, or this season's own: after you've watched · straight away. Straight away and
//      Mark it watched ask first, since Undo can't unsee a result.
//   4. Notifications: the show's own sheet (Round 1), Mute first.
//   5. Hide this show from your couch (C17), on a couch.
//   6. Leave all your games here (held) or Remove from your shows (Undo), red, last.
// The ⋯ keeps the things to do (invite, a watch along, How it works, the drafts). Everything here saves at once, with Undo.

const KEY = "you";

/** Opening this page (`?page=you` over the show). */
export function useShowSettings() {
  return usePushedPage(KEY);
}

/** No single word alone on a value's last line (the check's finding): its last two words stay together. */
const keepLast = (s: string) => s.replace(/ (\S+)$/, "\u00a0$1");

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null);

/** A row with its icon and a switch, in the page's row shape (the switch drawn as Your settings' are). */
function IconSwitch({ on, icon, title, line, onChange, data }: { on: boolean; icon: ReactNode; title: string; line: string; onChange: (on: boolean) => void; data: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} data-setting={data} onClick={() => onChange(!on)} className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left">
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{keepLast(line)}</small>
      </span>
      <span aria-hidden className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-secondary shadow-[inset_0_0_0_1px_var(--edge)]"}`}>
        <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${on ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
      </span>
    </button>
  );
}

/** A row that opens something else (Where you are, Notifications): icon, name over value, chevron; or a fixed fact, no chevron. */
function OpenRow({ icon, title, value, onClick, data }: { icon: ReactNode; title: string; value: ReactNode; onClick?: () => void; data: string }) {
  const body = (
    <>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small data-row-value className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {typeof value === "string" ? keepLast(value) : value}
        </small>
      </span>
      {onClick && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
    </>
  );
  return onClick ? (
    <button type="button" data-show-row={data} onClick={onClick} className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
      {body}
    </button>
  ) : (
    <div data-show-row={data} className="flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 first:border-t-0">
      {body}
    </div>
  );
}

/** "Show results straight away?": the inline ask (Round 1's), the safe choice filled, on the left. */
function Ask({ title, line, yes, onYes, onNo, data }: { title: string; line: string; yes: string; onYes: () => void; onNo: () => void; data: string }) {
  return (
    <div data-ask={data} className="mb-2 mt-1 rounded-[3px] bg-card p-3 outline-1 -outline-offset-1 outline-border">
      <p className="flex gap-2 text-[14px] leading-snug">
        <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden />
        <span>
          <b className="font-semibold">{title}</b> {line}
        </span>
      </p>
      <div className="mt-3 flex gap-2">
        <Btn tone="ink" className="flex-1" data-ask-no onClick={onNo}>
          Keep it as it is
        </Btn>
        <button
          type="button"
          data-ask-yes
          onClick={onYes}
          className="nd-press flex h-[52px] flex-1 items-center justify-center rounded-[3px] bg-card px-2 text-center text-[15px] font-bold leading-tight outline-1 -outline-offset-1 outline-edge"
        >
          {yes}
        </button>
      </div>
    </div>
  );
}

const KEEP_UP: { id: KeepUp; title: string; value: string; line: string }[] = [
  { id: "ask", title: "Ask me if I've seen it", value: "Ask me if I've seen it", line: "When each one ends, Tonight asks. Nothing shows until you say" },
  { id: "auto", title: "Mark it watched", value: "Mark it watched", line: "Each one counts as watched as soon as it airs" },
  { id: "off", title: "Nothing", value: "Nothing: you move it yourself", line: "You mark what you've watched, here or on Tonight" },
];

export function ShowSettingsPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const page = useShowSettings();
  const nav = useNav();
  const afterWatching = useAfterWatching();
  const afterReveal = useAfterReveal();
  const now = useNow(false);
  const h = show.header;
  const open = page.open && !!h;
  const { data: p } = useProfile(open);
  const notify = useShowNotify(seasonId, open).data;
  const { phone, reaches } = useReach(open);
  const aired = useAiredEpisodes(open && show.seenThrough ? seasonId : null).data?.episodes;
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [asking, setAsking] = useState<"auto" | "now" | null>(null);
  const [leave, setLeave] = useState<OutPreview | null | false>(false);
  if (!h) return null;

  const name = `${h.show.name.replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
  const back = h.show.name.replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "");
  const ep = show.words.ep;
  const sport = h.show.kind === "sport";
  const finished = h.status === "completed";
  // Your account's choice, in this kind's words; then this season's own, if it has one.
  const defaultNow = sport ? !p?.hideSportsScores : p ? !p.hideScores : false;
  const resultsNow = show.results ? show.results === "now" : defaultNow;
  const defaultWords = sport ? (defaultNow ? "live" : "after you've watched") : defaultNow ? "straight away" : "after you've watched";
  const sportLive = sport && resultsNow;
  const onCouch = !!show.couch && !show.solo;
  const canFollowSet = show.following && !show.plays && !finished && !sportLive;

  const save = async (change: Parameters<typeof watching.follow>[1], said: string, undo: Parameters<typeof watching.follow>[1]) => {
    try {
      await watching.follow(seasonId, change);
      await afterWatching();
      toast(said, {
        undo: async () => {
          try {
            await watching.follow(seasonId, undo);
            await afterWatching();
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };

  // 1. How far you've watched, with the episode's air date (it names the episode; a number alone doesn't).
  const seen = show.seenThrough;
  const seenDay = seen ? day(aired?.find((e) => e.number === seen)?.airAt) : null;
  const total = h.episodeCount ?? null;
  const watchedValue = sportLive
    ? "Scores show live: there's nothing to set"
    : seen == null
      ? "Results show straight away here"
      : seen === 0
        ? show.plays
          ? "Not started · moves as you reveal"
          : "Not started"
        : finished && total && seen >= total && !show.plays
          ? `All ${total} · finished`
          : `Through ${ep} ${seen}${seenDay ? ` · ${seenDay}` : ""}${show.plays ? " · moves as you reveal" : ""}`;

  // 4. What this show may send you: a mute first, then kinds off here, then whether anything reaches you at all.
  const offHere = (notify?.moments ?? []).filter((m) => m.on && !m.here).map((m) => m.title.toLowerCase());
  const notifyValue = !notify
    ? "…"
    : notify.muted
      ? `Muted ${muteEnd(notify.muted, now)} · every season`
      : offHere.length
        ? `${offHere.join(" and ").replace(/^./, (c) => c.toUpperCase())} off here`
        : reaches === false || phone === "blocked"
          ? // The phone's fact first: nothing rings, whatever this show's switches say (both reviewers).
            `${phone === "blocked" ? "Blocked" : "Off"} on this phone · this show's are on`
          : "On";

  // When the next episode starts (for Mute's first choice): the one coming up, not one on now.
  const nextAt = show.upNext && !show.upNext.live ? (show.upNext.airAt ?? null) : null;

  return (
    <>
      <PushedPage open={open} onClose={page.close} title="Your settings" back={back}>
        <div data-show-settings={seasonId} className="pb-12">
          {/* The show carries its own settings: its art behind its name (the bar says whose: Your settings). A show with no art has
              no empty band: just its name (the check's finding). */}
          {h.show.artUrl ? (
            <div className="relative h-[112px] overflow-hidden">
              <ShowArt seasonId={`settings-${seasonId}`} artUrl={h.show.artUrl} name={back} bare className="absolute inset-0 size-full" />
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,14,21,.15),rgba(16,14,21,.92))]" />
              <b className="type-caption absolute inset-x-4 bottom-3 block truncate text-[44px] leading-none text-white" data-show-settings-name>
                {name}
              </b>
            </div>
          ) : (
            <b className="type-caption block truncate px-4 pb-1 pt-5 text-[44px] leading-none" data-show-settings-name>
              {name}
            </b>
          )}

          <div className="px-4 pt-1">
            <OpenRow
              data="watched"
              icon={<ListChecks className="size-5" aria-hidden />}
              title="Episodes you've watched"
              value={watchedValue}
              onClick={sportLive ? undefined : () => openWhere(show, undefined, true)}
            />

            {canFollowSet && (
              <Fold id="new-episode" icon={CalendarClock} title="When a new episode airs" value={KEEP_UP.find((k) => k.id === show.keepUp)?.value ?? "Nothing: you move it yourself"}>
                <div role="radiogroup" aria-label="When a new episode airs" className="pl-[52px]">
                  {KEEP_UP.map((k) => (
                    <Choice
                      key={k.id}
                      data={`keep-${k.id}`}
                      on={show.keepUp === k.id}
                      title={k.title}
                      line={k.line}
                      recommended={k.id === "ask"}
                      onPick={() =>
                        k.id === "auto"
                          ? setAsking("auto")
                          : (setAsking(null), save({ keepUp: k.id }, `${name}: ${k.value.toLowerCase()}`, { keepUp: show.keepUp }))
                      }
                    />
                  ))}
                  {asking === "auto" && show.keepUp !== "auto" && (
                    <Ask
                      data="auto"
                      title="Mark each one watched as it airs?"
                      line="Its results, stats and the couch's chat show as soon as it airs, even the week you watch late."
                      yes="Mark it watched"
                      onNo={() => setAsking(null)}
                      onYes={() => {
                        setAsking(null);
                        void save({ keepUp: "auto" }, `${name}: marked watched as each one airs`, { keepUp: show.keepUp });
                      }}
                    />
                  )}
                </div>
              </Fold>
            )}

            <Fold
              id="results-here"
              icon={ShieldCheck}
              title="When results show here"
              value={!p ? "…" : show.results == null ? `Your default: ${defaultWords}` : show.results === "now" ? (sport ? "Live, here" : "Straight away, here") : "After you've watched, here"}
            >
              <div role="radiogroup" aria-label="When results show here" className="pl-[52px]">
                <Choice
                  data="results-default"
                  on={show.results == null}
                  title="Your default"
                  line={`${defaultWords.replace(/^./, (c) => c.toUpperCase())}, as set in Your settings`}
                  onPick={() => (setAsking(null), save({ results: null }, `${name}: results follow your default`, { results: show.results }))}
                />
                <Choice
                  data="results-wait"
                  on={show.results === "wait"}
                  title="After I've watched"
                  line={sport ? "A game that's begun says only when it started, until you tap Show the score" : "Each episode's results wait until you say you've watched it"}
                  onPick={() => (setAsking(null), save({ results: "wait" }, `${name}: results wait until you've watched`, { results: show.results }))}
                />
                <Choice
                  data="results-now"
                  on={show.results === "now"}
                  title={sport ? "Live" : "Straight away"}
                  line={sport ? "Scores as they happen" : "As soon as they're known, even the week you watch late"}
                  onPick={() => (sport ? save({ results: "now" }, `${name}: scores show live`, { results: show.results }) : setAsking("now"))}
                />
                {asking === "now" && show.results !== "now" && (
                  <Ask
                    data="now"
                    title={`Show ${name}'s results straight away?`}
                    line="Standings, posters and notifications will say who went home as soon as it's known. Undo can't unsee it."
                    yes="Show them"
                    onNo={() => setAsking(null)}
                    onYes={() => {
                      setAsking(null);
                      void save({ results: "now" }, `${name}: results show straight away`, { results: show.results });
                    }}
                  />
                )}
                <p className="pb-1 pt-1 text-[13px] leading-snug text-muted-foreground">Your games at your own pace always wait for your reveal.</p>
              </div>
            </Fold>

            <OpenRow data="notify" icon={<BellRing className="size-5" aria-hidden />} title="Notifications" value={notifyValue} onClick={() => setNotifyOpen(true)} />

            {onCouch && (show.following || show.plays) && (
              <IconSwitch
                data="private"
                on={show.watchingPrivately}
                icon={show.watchingPrivately ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                title="Hide this show from my couch"
                line={show.watchingPrivately ? "Only you see it. Chat and the games still work" : "Your couch sees you watch it and how far you are"}
                onChange={(on) =>
                  save({ following: true, private: on }, on ? `${name}: hidden from your couch` : `${name}: your couch sees it again`, { following: true, private: !on })
                }
              />
            )}
          </div>

          {/* Leaving comes last, in red, after a gap: never in the first view (PFD R2). */}
          {(show.plays && show.couch) || (!show.plays && show.following) ? (
            <div className="mt-8 px-4">
              {show.plays && show.couch ? (
                <button
                  type="button"
                  data-show-leave
                  onClick={async () => {
                    setLeave(null);
                    try {
                      setLeave(await gameAdmin.leave(seasonId, show.couch!.id, true));
                    } catch (e) {
                      setLeave(false);
                      toast.quiet((e as Error).message);
                    }
                  }}
                  className="nd-press flex min-h-[60px] w-full items-center gap-3 border-y border-border py-2 text-left"
                >
                  <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-live">
                    <LogOut className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-semibold text-live">Leave all my games here</b>
                    <small className="mt-0.5 block text-[13px] text-muted-foreground">To leave just one, use that game&rsquo;s ⋯</small>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  data-show-remove
                  onClick={async () => {
                    const priv = show.watchingPrivately;
                    try {
                      await watching.follow(seasonId, { following: false });
                      await afterWatching();
                      nav.push(paths.home);
                      toast(`${back} removed from your shows`, {
                        undo: async () => {
                          try {
                            await watching.follow(seasonId, { following: true, private: priv });
                            await afterWatching();
                          } catch (e) {
                            toast.quiet((e as Error).message);
                          }
                        },
                      });
                    } catch (e) {
                      toast.quiet((e as Error).message);
                    }
                  }}
                  className="nd-press flex min-h-[60px] w-full items-center gap-3 border-y border-border py-2 text-left"
                >
                  <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-live">
                    <X className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-semibold text-live">Remove from my shows</b>
                    <small className="mt-0.5 block text-[13px] text-muted-foreground">How far you&rsquo;ve watched is kept if you add it again</small>
                  </span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </PushedPage>
      <ShowNotifySheet seasonId={seasonId} open={notifyOpen} onOpenChange={setNotifyOpen} nextAt={nextAt} finished={finished} />
      {/* Tier 3: hard to undo, so a hold; never as a game's last Commissioner. */}
      <HoldSheet
        open={leave !== false}
        onOpenChange={(o) => !o && setLeave(false)}
        title="Leave all your games here?"
        consequence={
          leave
            ? `You leave ${leave.games.join(", ")}. ${leave.drafted ? "Your teams and points stay in the standings, but nobody plays them." : "Nothing's been drafted yet, so your seats just go."} You stay on the couch, and whoever runs the games can bring you back.`
            : null
        }
        problem={leave ? leave.problem : null}
        cta="leave"
        onConfirm={async () => {
          await gameAdmin.leave(seasonId, show.couch!.id);
          await afterReveal();
          toast("You've left the games here");
          nav.push(paths.home);
        }}
      />
    </>
  );
}
