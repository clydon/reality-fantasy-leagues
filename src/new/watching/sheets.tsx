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
  type ListingHit,
} from "../data";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { AddNewBlock, ListingsCredit, SearchNote, SearchRows, SuggestionCard, seasonLine, useShowSearch, type SearchRow } from "./search";
import { WhereAsk, type WhereSeason } from "./where";

// The watching sheets (docs/PLAN-new-design.md step 10 part 1), opened from anywhere signed in with openWatching:
//   add    Add a show (the mock's refine.js addShowSheet): "Search or add a show", suggestions before you type (what the
//          couch watches that you don't, then what's on now), as you type the shows here and in the TV listings, then
//          "Add '<name>' as a new show". A tap asks where you are (when anything has aired) and adds it; the sheet stays
//          open for the next one.
//   where  Where you are in a season (the show space's Change, Add to my shows, The couch is watching's Add): the stepper,
//          then saved, following it if you weren't.
//   listing  Add to my shows from a TV listing (the guide's Also on, step 11 part 2): where you are, read from the listing's
//          season as Add a show does, then added.

export type WhereTarget = WhereSeason & { seen: number; following: boolean; plays: boolean };
type WatchingSheet = { kind: "add" } | { kind: "where"; target: WhereTarget } | { kind: "listing"; hit: ListingHit };

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
  const onOpenChange = (o: boolean) => !o && close();
  return (
    <>
      <AddShowSheet key={`add-${n}`} open={sheet?.kind === "add"} onOpenChange={onOpenChange} />
      <WhereSheet key={`where-${n}`} target={sheet?.kind === "where" ? sheet.target : null} onOpenChange={onOpenChange} />
      <ListingSheet key={`listing-${n}`} hit={sheet?.kind === "listing" ? sheet.hit : null} onOpenChange={onOpenChange} />
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
          busy={busy}
          cta={t.following ? "Save" : "Add to my shows"}
          onSave={async (seen) => {
            setBusy(true);
            try {
              await watching.follow(t.seasonId, { following: true, seenThrough: seen });
              await refresh();
              toast(savedLine(t.label, t.following, seen));
              close();
            } catch (e) {
              toast((e as Error).message);
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
function ListingSheet({ hit, onOpenChange }: { hit: ListingHit | null; onOpenChange: (o: boolean) => void }) {
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
            onSave={async (seen) => {
              setBusy(true);
              try {
                const r = await watching.add({ listing: h.tvmazeId, seenThrough: seen });
                await refresh();
                toast(`${r.label} added to your shows${r.ready ? "" : " · not a game yet"}`);
                close();
              } catch (e) {
                toast((e as Error).message);
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

type Step = { kind: "season"; s: WhereSeason; ready: boolean } | { kind: "listing"; hit: ListingHit } | { kind: "name"; name: string } | null;

function AddShowSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
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
  useEffect(() => {
    if (!open || step) return;
    const t = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open, step]);

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
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const addSeason = (s: WhereSeason, ready: boolean, seen: number) =>
    run(async () => {
      try {
        await watching.follow(s.seasonId, { following: true, seenThrough: seen });
      } catch (e) {
        // You play it: it's followed, and where you are moves with your games.
        if ((e as { status?: number }).status !== 409) throw e;
        await watching.follow(s.seasonId, { following: true });
      }
      await done(s.label, ready);
    });
  const pickSeason = (s: WhereSeason, ready: boolean) => {
    if (mine.has(s.seasonId)) return toast(`${s.label} is already on your list`);
    // Nothing's aired yet: nothing to ask.
    if (s.aired === 0) return addSeason(s, ready, 0);
    setStep({ kind: "season", s, ready });
  };
  const pick = (r: SearchRow) => {
    if (r.kind === "season") return pickSeason(r.season, r.season.ready);
    setStep({ kind: "listing", hit: r.hit });
  };

  const title = !step ? "Add a show" : step.kind === "name" ? `Add ${step.name}?` : "Where are you?";
  const subtitle = !step ? "Everything on TV. Playing is optional." : step.kind === "name" ? "A show nobody here has added yet" : step.kind === "season" ? step.s.label : step.hit.name;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle}>
      <div data-add-show={step ? step.kind : "search"}>
        {step && (
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
                <SearchRows rows={search.rows} onPick={pick} />
                <SearchNote loading={search.loading} unavailable={search.unavailable} />
                {!search.exact && !search.loading && q.trim().length >= 2 && <AddNewBlock q={q} any={search.rows.length > 0} onPick={() => setStep({ kind: "name", name: q.trim() })} />}
              </>
            )}
            <ListingsCredit />
          </>
        )}
        {step?.kind === "season" && <WhereAsk s={step.s} start={0} cta="Add to my shows" busy={busy} onSave={(seen) => addSeason(step.s, step.ready, seen)} />}
        {step?.kind === "listing" && (
          <ListingWhere
            hit={step.hit}
            busy={busy}
            onSave={(seen) =>
              run(async () => {
                const r = await watching.add({ listing: step.hit.tvmazeId, seenThrough: seen });
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
                run(async () => {
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
function ListingWhere({ hit, busy, onSave }: { hit: ListingHit; busy: boolean; onSave: (seen: number) => void }) {
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
  };
  return <WhereAsk s={s} start={0} cta="Add to my shows" busy={busy} onSave={onSave} />;
}
