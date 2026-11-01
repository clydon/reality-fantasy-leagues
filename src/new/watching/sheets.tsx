"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, Search } from "lucide-react";
import {
  useAfterWatching,
  useCatalog,
  useCurrentCouch,
  useHome,
  useListingSeason,
  watching,
  type CatalogSeason,
  type Home,
  type KeepUp,
  type ListingHit,
} from "../data";
import { keepToPath, PracticeFinish, PracticeNote, PracticeStrip, said, type PracticePath } from "../tour/practice";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { useReducedMotion } from "../welcome/hooks";
import { AddNewBlock, ListingsCredit, SearchNote, SearchRows, SuggestionCard, seasonLine, useShowSearch, type SearchRow } from "./search";
import { WhereAsk, type WhereSeason } from "./where";
import { episodeWordFromTitles } from "@/lib/game/show-words";

// The watching sheets (docs/PLAN-new-design.md step 10 part 1), opened from anywhere signed in with openWatching:
//   add    Add a show (the mock's refine.js addShowSheet): "Search or add a show", suggestions before you type (what the
//          couch watches that you don't, then what's on now), as you type the shows here and in the TV listings, then
//          "Add '<name>' as a new show". A tap asks where you are (when anything has aired) and adds it; the sheet stays
//          open for the next one.
//   where  Where you are in a season (the show space's Change, Add to my shows, The couch is watching's Add): the stepper,
//          then saved, following it if you weren't.
//   listing  Add to my shows from a TV listing (the guide's Also on, step 11 part 2): where you are, read from the listing's
//          season as Add a show does, then added; `then` goes on from there (part 3: Plan a watch along on the show it made).
// Add a show also runs as the first-time tour's practice (docs/PLAN-first-time-tour.md version 2): the same sheet with a Practice
// strip, the show's name typed in for you and its row ringed, and every save (follow, add from a listing, add by name) ending in
// the practice finish instead: nothing is written.

export type WhereTarget = WhereSeason & { seen: number; following: boolean; plays: boolean; keepUp?: KeepUp };
/** The tour's practice: the show to type in (null: none, search anything), the season to ring, and what to do once it closes.
 *  `demo`: after yours, the shows it adds by itself (the user, 2026-11-01: you don't need a game to add a show), each found by its
 *  listing; `onDemo` hears the ones it added, `onAdded` that you added yours. */
export type AddPractice = { name: string | null; seasonId: string | null; demo?: AddDemo[]; onDemo?: (tvmazeIds: number[]) => void; onAdded?: () => void; onClose: () => void };
export type AddDemo = { query: string; tvmazeId: number };
type WatchingSheet =
  | { kind: "add"; practice?: AddPractice }
  | { kind: "where"; target: WhereTarget }
  | { kind: "listing"; hit: ListingHit; then?: (seasonId: string) => void };

type Store = { sheet: WatchingSheet | null; n: number };
let store: Store = { sheet: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { sheet: null, n: 0 };

/** Open Add a show, or where you are in a season. */
export function openWatching(sheet: WatchingSheet) {
  store = { ...store, sheet: null };
  emit();
  setTimeout(() => {
    store = { sheet, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, sheet: null };
  emit();
};

function useWatchingSheet(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

export function WatchingSheets() {
  const { sheet, n } = useWatchingSheet();
  const practice = sheet?.kind === "add" ? sheet.practice : undefined;
  const onOpenChange = (o: boolean) => {
    if (o) return;
    close();
    practice?.onClose();
  };
  return (
    <>
      <AddShowSheet key={`add-${n}`} open={sheet?.kind === "add"} practice={practice} onOpenChange={onOpenChange} />
      <WhereSheet key={`where-${n}`} target={sheet?.kind === "where" ? sheet.target : null} onOpenChange={onOpenChange} />
      <ListingSheet key={`listing-${n}`} hit={sheet?.kind === "listing" ? sheet.hit : null} then={sheet?.kind === "listing" ? sheet.then : undefined} onOpenChange={onOpenChange} />
    </>
  );
}

/** "Saved · you're on Episode 4", "The Amazing Race 38 added to your shows". */
function savedLine(label: string, following: boolean, seen: number) {
  if (!following) return `${label} added to your shows`;
  return seen ? `Saved · you're on Episode ${seen}` : "Saved · not started yet";
}

function WhereSheet({ target, onOpenChange }: { target: WhereTarget | null; onOpenChange: (o: boolean) => void }) {
  const refresh = useAfterWatching();
  const [busy, setBusy] = useState(false);
  // The last one asked about, kept while the sheet slides away.
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  const t = target ?? shown;
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange} title={t?.following || t?.plays ? "Where you are" : "Add to my shows"} subtitle={t ? (t.following || t.plays ? t.label : `Where are you in ${t.show}?`) : undefined}>
      {t && (
        <WhereAsk
          s={t}
          start={t.seen}
          plays={t.plays}
          keepUp={t.keepUp}
          busy={busy}
          cta={t.following ? "Save" : "Add to my shows"}
          onSave={async (seen, live) => {
            setBusy(true);
            try {
              // A show set to move along by itself keeps that (Settings); otherwise Live is the switch's.
              await watching.follow(t.seasonId, { following: true, seenThrough: seen, ...(t.keepUp === "auto" ? {} : { keepUp: live ? "ask" : "off" }) });
              await refresh();
              toast(savedLine(t.label, t.following, seen));
              close();
            } catch (e) {
              toast.quiet((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Sheet>
  );
}

/** Add to my shows from a TV listing: where you are in the season adding it would follow, then it's yours. */
function ListingSheet({ hit, then, onOpenChange }: { hit: ListingHit | null; then?: (seasonId: string) => void; onOpenChange: (o: boolean) => void }) {
  const refresh = useAfterWatching();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(hit);
  if (hit && hit !== shown) setShown(hit);
  const h = hit ?? shown;
  return (
    <Sheet open={!!hit} onOpenChange={onOpenChange} title="Add to my shows" subtitle={h ? `Where are you in ${h.name}?` : undefined}>
      {h && (
        <div data-add-listing={h.tvmazeId}>
          <ListingWhere
            hit={h}
            busy={busy}
            onSave={async (seen, live) => {
              setBusy(true);
              try {
                const r = await watching.add({ listing: h.tvmazeId, seenThrough: seen, live });
                await refresh();
                toast(`${r.label} added to your shows${r.ready ? "" : " · not a game yet"}`);
                close();
                then?.(r.seasonId);
              } catch (e) {
                toast.quiet((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
          <ListingsCredit />
        </div>
      )}
    </Sheet>
  );
}

// ---------- Add a show ----------

/** Who on your couch openly watches each season (not you). */
function watchersOf(home: Home | undefined, couchId: string | null, me: string) {
  const couch = home?.couches.find((c) => c.id === couchId);
  return (seasonId: string) => (couch?.members ?? []).filter((m) => m.userId !== me && m.watching.includes(seasonId)).map((m) => m.name);
}

type Step =
  | { kind: "season"; s: WhereSeason; ready: boolean }
  | { kind: "listing"; hit: ListingHit }
  | { kind: "name"; name: string }
  // The tour's practice, where the save would have been (`demo`: one the tour added itself), and the end of its demo.
  | { kind: "practiced"; label: string; demo?: boolean }
  | { kind: "demoed"; labels: string[] }
  | null;

/** "Harry Potter and Sunday Night Football", "A, B and C". */
const listOf = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? ""));

/** The tour's own doing, slow enough to follow (the user, 2026-11-01): the typing's wait for the sheet to come up, then a letter;
 *  a row or button ringed before it's tapped, the tap pressed in, Where are you seen before its button's ringed, and what was
 *  added held long enough to read. */
const TYPE_AFTER = 900;
const TYPE_EACH = 100;
const RING = 1500;
const PRESS = 220;
const SEE = 1000;
const READ = 1700;

function AddShowSheet({ open, practice, onOpenChange }: { open: boolean; practice?: AddPractice; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const reduce = useReducedMotion();
  const couch = useCurrentCouch(home);
  // Read once Add a show opens, not on every page it's mounted on (step 11, from Noticed).
  const [asked, setAsked] = useState(open);
  if (open && !asked) setAsked(true);
  const listed = useCatalog(asked).data?.seasons;
  const catalog = useMemo(() => listed ?? [], [listed]);
  const refresh = useAfterWatching();
  const [q, setQ] = useState("");
  const [step, setStep] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const me = home?.user.id ?? "";
  // On your list: what you follow or play.
  const mine = useMemo(() => new Set((home?.shows ?? []).filter((s) => s.following || s.games.length).map((s) => s.seasonId)), [home]);
  const watchers = useMemo(() => watchersOf(home, couch?.id ?? null, me), [home, couch?.id, me]);
  const search = useShowSearch(q, catalog, mine, watchers);
  // Not for the tour's practice: the name's typed in for you, and a phone's keyboard coming up would only cover it.
  useEffect(() => {
    if (!open || step || practice) return;
    const t = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open, step, practice]);
  // The tour's practice types the show's name in, a letter at a time, once the sheet is up.
  const typing = practice?.name ?? null;
  useEffect(() => {
    if (!open || !typing) return;
    const timers = reduce
      ? [setTimeout(() => setQ(typing), TYPE_AFTER)]
      : Array.from(typing, (_, i) => setTimeout(() => setQ(typing.slice(0, i + 1)), TYPE_AFTER + i * TYPE_EACH));
    return () => timers.forEach(clearTimeout);
  }, [open, typing, reduce]);
  // The practice's demo (runDemo): the row it's about to tap, ringed; and what it reads as it goes (the rows found, the step).
  const [ringedKey, setRingedKey] = useState<string | null>(null);
  const [demoOn, setDemoOn] = useState(false);
  const demoing = useRef(false);
  const run_ = useRef(0);
  const rowsNow = useRef<SearchRow[]>([]);
  const stepNow = useRef<Step>(null);
  useEffect(() => {
    rowsNow.current = search.rows;
    stepNow.current = step;
  });
  useEffect(() => () => void run_.current++, []);

  // Before you type: what the couch watches that you don't, then what's on now or coming up, six at most.
  const suggestions = useMemo(() => {
    const out: { key: string; title: string; sub: string; art: string | null; position: string; s: WhereSeason; ready: boolean }[] = [];
    for (const h of home?.couchShows ?? []) {
      const who = watchers(h.seasonId);
      if (!who.length || mine.has(h.seasonId)) continue;
      const label = `${h.show.name.replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
      out.push({
        key: h.seasonId,
        title: label,
        sub: `${who.slice(0, 2).join(" and ")} ${who.length === 1 ? "watches" : "watch"}`,
        art: h.show.artUrl,
        position: "center",
        s: { seasonId: h.seasonId, label, show: h.show.name, artUrl: h.show.artUrl, artPosition: "center", aired: h.latestAired, status: (h.status ?? "airing") as CatalogSeason["status"], premiere: h.premiereDate },
        ready: h.ready !== false,
      });
    }
    for (const c of catalog.filter((x) => x.wall && !mine.has(x.seasonId))) {
      if (out.some((o) => o.key === c.seasonId)) continue;
      out.push({ key: c.seasonId, title: c.label, sub: seasonLine(c), art: c.artUrl, position: c.artPosition, s: c, ready: c.ready });
    }
    return out.slice(0, 6);
  }, [home, catalog, mine, watchers]);

  const done = async (label: string, ready: boolean) => {
    await refresh();
    toast(`${label} added to your shows${ready ? "" : " · not a game yet"}`);
    setStep(null);
  };
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // A practice add, where the save would be: its finish. The tour hears you added yours (it's on Home's guide for a moment).
  const addedForPractice = (label: string) => {
    setStep({ kind: "practiced", label, demo: demoing.current });
    if (!demoing.current) practice?.onAdded?.();
  };
  const addSeason = (s: WhereSeason, ready: boolean, seen: number, live = false) => {
    // The tour's practice saves nothing: its finish stands in.
    if (practice) return addedForPractice(s.label);
    return run(async () => {
      try {
        await watching.follow(s.seasonId, { following: true, seenThrough: seen, ...(live ? { keepUp: "ask" as const } : {}) });
      } catch (e) {
        // You play it: it's followed, and where you are moves with your games.
        if ((e as { status?: number }).status !== 409) throw e;
        await watching.follow(s.seasonId, { following: true });
      }
      await done(s.label, ready);
    });
  };
  const pickSeason = (s: WhereSeason, ready: boolean) => {
    if (mine.has(s.seasonId)) return toast.quiet(`${s.label} is already on your list`);
    // Nothing's aired yet: nothing to ask.
    if (s.aired === 0) return addSeason(s, ready, 0);
    setStep({ kind: "season", s, ready });
  };
  const pick = (r: SearchRow) => {
    if (r.kind === "season") return pickSeason(r.season, r.season.ready);
    setStep({ kind: "listing", hit: r.hit });
  };
  // The practice's demo (the user, 2026-11-01): after yours, a couple more the tour adds by itself (a show that's no game, a
  // ballgame), every step the real one: the name typed, its row ringed and tapped, Where are you, Add to my shows (still saving
  // nothing), each slow enough to follow. A row that doesn't come (the listings down) is passed over.
  const runDemo = async () => {
    const run = ++run_.current;
    const alive = () => run === run_.current;
    // Reduced motion: the name goes in at once, but each screen gets the same time to be read.
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    /** The tour's tap, seen: what it's about to tap ringed (a row by `ringed`, a button here), pressed in, then tapped. */
    const tap = async (el: HTMLElement | null, ring: boolean) => {
      if (!el) return;
      if (ring) {
        el.setAttribute("data-tour-tap", "ring");
        await sleep(RING * 0.6);
      }
      el.setAttribute("data-tour-tap", "press");
      await sleep(PRESS);
      el.removeAttribute("data-tour-tap");
    };
    const added: string[] = [];
    const ids: number[] = [];
    demoing.current = true;
    setDemoOn(true);
    for (const d of practice?.demo ?? []) {
      setStep(null);
      setRingedKey(null);
      setQ("");
      await sleep(TYPE_AFTER);
      if (reduce) setQ(d.query);
      else
        for (let i = 1; i <= d.query.length; i++) {
          if (!alive()) return;
          setQ(d.query.slice(0, i));
          await sleep(TYPE_EACH);
        }
      let row: SearchRow | null = null;
      for (let t = 0; t < 80 && !row; t++) {
        await sleep(100);
        if (!alive()) return;
        row = rowsNow.current.find((r) => (r.kind === "listing" ? r.hit.tvmazeId === d.tvmazeId : r.season.tvmazeId === d.tvmazeId)) ?? null;
      }
      if (!row) continue;
      setRingedKey(row.key);
      await sleep(RING);
      if (!alive()) return;
      await tap(document.querySelector<HTMLElement>("[role=dialog][data-open] [data-practice-pick]"), false);
      if (!alive()) return;
      setRingedKey(null);
      pick(row);
      // Where are you (unless nothing's aired: then it's added straight away), then its Add to my shows: the real button.
      let save: HTMLButtonElement | null = null;
      for (let t = 0; t < 100 && !save && stepNow.current?.kind !== "practiced"; t++) {
        await sleep(100);
        if (!alive()) return;
        save = document.querySelector<HTMLButtonElement>("[role=dialog][data-open] [data-where-save]");
      }
      if (save) {
        await sleep(SEE);
        if (!alive()) return;
        await tap(save, true);
        if (!alive()) return;
        save.click();
        await sleep(200);
      }
      const now = stepNow.current;
      if (now?.kind === "practiced") {
        added.push(now.label);
        ids.push(d.tvmazeId);
        await sleep(READ);
      }
    }
    if (!alive()) return;
    demoing.current = false;
    setDemoOn(false);
    setStep({ kind: "demoed", labels: added });
    practice?.onDemo?.(ids);
  };

  // A practice's finish: yours (then the demo, when there's one), one the demo added (on its way to the next), the demo's end.
  const yoursDone = step?.kind === "practiced" && !step.demo;
  const demoMore = !!practice?.demo?.length;
  const title = !step
    ? "Add a show"
    : step.kind === "demoed"
      ? "Tell your couch"
      : step.kind === "practiced"
        ? step.demo
          ? "Added"
          : "That's how you add a show"
        : step.kind === "name"
          ? `Add ${step.name}?`
          : "Where are you?";
  const subtitle = !step
    ? "Everything on TV. Playing is optional."
    : step.kind === "practiced" || step.kind === "demoed"
      ? "Practice run"
      : step.kind === "name"
        ? "A show nobody here has added yet"
        : step.kind === "season"
          ? step.s.label
          : step.hit.name;
  // The practice's one path (tour/practice.tsx keepToPath): the show it typed in, where you are and Add to my shows, then its finish;
  // nothing while the demo adds its shows by itself. A practice with no show typed in takes any show.
  const here = (sel: string) => document.querySelector(`[role=dialog][data-open] ${sel}`);
  const path: PracticePath | null = !practice
    ? null
    : demoOn
      ? { on: "[data-practice-demo-never]", next: () => null, word: "Just watch: the tour's adding these for you" }
      : !step
        ? practice.name
          ? { on: "[data-practice-pick]", next: () => here("[data-practice-pick]") ?? here("[data-add-input]"), word: `For practice, tap ${said(practice.name)}` }
          : null
        : step.kind === "season" || step.kind === "listing"
          ? { on: "[data-where-ask]", next: () => here("[data-where-save]") }
          : step.kind === "practiced" || step.kind === "demoed"
            ? { on: "[data-practice-close]", next: () => here("[data-practice-close]") }
            : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle}>
      <div data-add-show={step ? step.kind : "search"} onClickCapture={keepToPath(path)}>
        {practice && !yoursDone && step?.kind !== "demoed" && <PracticeStrip />}
        {step?.kind === "practiced" &&
          (step.demo ? (
            <p data-practice-added className="text-[15px] font-semibold leading-snug">
              {said(step.label)} added, for practice
            </p>
          ) : (
            <PracticeFinish
              line={`${said(step.label)} won't show up on your list: this was just to show you how.`}
              done={demoMore ? "Show me" : "Done"}
              onDone={() => (demoMore ? void runDemo() : onOpenChange(false))}
            >
              <PracticeNote>You don&rsquo;t need a game to add a show. Tell your couch what you&rsquo;re watching!</PracticeNote>
            </PracticeFinish>
          ))}
        {step?.kind === "demoed" && (
          <PracticeFinish
            line={step.labels.length ? `${listOf(step.labels.map(said))} won't show up either: just practice.` : "Nothing was saved: it was all practice."}
            onDone={() => onOpenChange(false)}
          >
            <PracticeNote>Shows you add land on your Home, and in your couch&rsquo;s TV guide when you share what you watch.</PracticeNote>
          </PracticeFinish>
        )}
        {step && step.kind !== "practiced" && step.kind !== "demoed" && (
          <button type="button" onClick={() => setStep(null)} className="-ml-1 mb-2 flex h-10 items-center gap-1 text-[14px] font-semibold text-muted-foreground">
            <ChevronLeft className="size-4" aria-hidden /> Back to search
          </button>
        )}
        {!step && (
          <>
            <label className="flex h-[50px] items-center gap-2.5 rounded-[3px] bg-background px-3 outline-2 -outline-offset-2 outline-chyron-line">
              <Search className="size-[18px] text-muted-foreground" aria-hidden />
              <input
                ref={input}
                data-add-input
                value={q}
                // The tour's practice types the name for you.
                readOnly={!!practice?.name}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search or add a show"
                aria-label="Search or add a show"
                autoComplete="off"
                className="h-full flex-1 bg-transparent text-[16px] outline-none"
              />
            </label>
            {!q.trim() ? (
              suggestions.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5" data-suggestions>
                  {suggestions.map((x) => (
                    <SuggestionCard key={x.key} title={x.title} sub={x.sub} art={x.art} position={x.position} on={mine.has(x.key)} onClick={() => pickSeason(x.s, x.ready)} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[14px] leading-normal text-muted-foreground">Type any show: what&rsquo;s here, and everything in the TV listings.</p>
              )
            ) : (
              <>
                <SearchRows rows={search.rows} onPick={pick} ringed={ringedKey ?? (demoOn ? undefined : (practice?.seasonId ?? undefined))} />
                <SearchNote loading={search.loading} unavailable={search.unavailable} />
                {!search.exact && !search.loading && q.trim().length >= 2 && <AddNewBlock q={q} any={search.rows.length > 0} onPick={() => setStep({ kind: "name", name: q.trim() })} />}
              </>
            )}
            <ListingsCredit />
          </>
        )}
        {step?.kind === "season" && <WhereAsk s={step.s} start={0} cta="Add to my shows" busy={busy} onSave={(seen, live) => addSeason(step.s, step.ready, seen, live)} />}
        {step?.kind === "listing" && (
          <ListingWhere
            hit={step.hit}
            busy={busy}
            onSave={(seen, live) =>
              practice
                ? addedForPractice(step.hit.name)
                : run(async () => {
                    const r = await watching.add({ listing: step.hit.tvmazeId, seenThrough: seen, live });
                    await done(r.label, r.ready);
                  })
            }
          />
        )}
        {step?.kind === "name" && (
          <div data-add-name>
            <p className="text-[14px] leading-normal text-muted-foreground">
              It isn&rsquo;t in the TV listings, so it&rsquo;s added by its name: its episodes and air times come later. It isn&rsquo;t a game yet: anyone on the couch can make it one.
            </p>
            <Btn
              tone="must"
              wide
              data-add-name-go
              className="mt-4"
              disabled={busy}
              onClick={() =>
                practice
                  ? addedForPractice(step.name)
                  : run(async () => {
                      const r = await watching.add({ name: step.name });
                      await done(r.label, r.ready);
                    })
              }
            >
              {busy ? "Adding…" : "Add to my shows"}
            </Btn>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Where you are in a show from the TV listings: its season, read from the listing first (how much has aired). */
function ListingWhere({ hit, busy, onSave }: { hit: ListingHit; busy: boolean; onSave: (seen: number, live: boolean) => void }) {
  const { data, error } = useListingSeason(hit.tvmazeId);
  if (error) return <p className="text-[14px] text-live">{(error as Error).message}</p>;
  if (!data) return <div aria-busy className="h-[150px] animate-pulse rounded-[4px] bg-background" />;
  const season = data.season;
  const s: WhereSeason = {
    seasonId: `tv-${hit.tvmazeId}`,
    label: season ? `${hit.name.replace(/\s*\([^)]*\)\s*$/, "")} ${season.number}` : hit.name,
    show: hit.name,
    artUrl: hit.thumb,
    artPosition: "center",
    aired: season ? season.aired : 0,
    status: season?.status ?? "upcoming",
    premiere: season?.premiere ?? null,
    episodes: data.episodes,
    // A sport's word from its titles ("Game"), as adding it will save (0142).
    episodeWord: hit.kind === "sport" ? (episodeWordFromTitles(data.episodes.map((e) => e.title)) ?? "Event") : undefined,
  };
  return <WhereAsk s={s} start={0} cta="Add to my shows" busy={busy} onSave={onSave} />;
}
