"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, KeyRound, Search, Tv, Users } from "lucide-react";
import { logOutTo } from "@/lib/auth-client";
import { invitesLetIn } from "@/lib/signups";
import type { WayIn } from "@/lib/server/way-in";
import { saveFirstRun, useCatalog, useListingSeason, type CatalogSeason } from "../data";
import { JoinCouchSheet, NewCouchSheet } from "../couch/couch-sheets";
import { useNav } from "../nav";
import { paths, START_STEPS } from "../routes";
import { Btn } from "../ui/parts";
import { WhereRow, type WhereSeason } from "../watching/where";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { followsOf, listingKey, nameKeyOf, whereCap, writeFirstRun, type ExtraPick, type FirstRunPicks } from "../way-in";
import { AddNewBlock, ListingsCredit, SearchNote, SearchRows, useShowSearch } from "../watching/search";
import { AccountForm, CheckEmail, GoogleButton, OrLine, UsernameSheet } from "./account";
import { firstRunChanged, forgetFirstRun, useFirstRun, useHydrated } from "./hooks";

// First run (/start/1..4, docs/PLAN-new-design.md step 9 part 2; the mock's landing.js startRoute): shows first, the
// account third. 1 What are you watching (the catalog's seasons on now or coming up, and a search over every season set
// up so far; any other show is step 10's Add a show), 2 Where are you in them (a stepper each, never past what's aired),
// 3 Save your shows (making the account; skipped when you're signed in), 4 Bring your people (start a couch, join one
// with a code, or just you). The picks wait on this device (way-in.ts) until there's an account, then go to
// POST /api/me/first-run, which follows each season with where you are and makes the new design the one you open on.
// An account still waiting to get in (early access: the desk's Who gets in) is told so at step 4; an invite code lets it
// in when the desk says invites do.

const STEPS = [
  { title: "What are\nyou watching?", line: "Pick as many as you like. Play them with friends, or just follow along." },
  { title: "Where are\nyou in them?", line: "We only ever show what you've seen. No spoilers, ever." },
  { title: "Save your\nshows", line: "Free. So we remember where you are, on any phone, and never spoil a thing." },
  { title: "Bring your\npeople?", line: "Games are better with friends. A couch is your group: everyone you play every show with." },
];

const DAYS: Record<string, string> = { Mon: "Mondays", Tue: "Tuesdays", Wed: "Wednesdays", Thu: "Thursdays", Fri: "Fridays", Sat: "Saturdays", Sun: "Sundays" };
const status = (s: CatalogSeason) =>
  s.status === "airing" ? (s.airsOn ? (DAYS[s.airsOn] ?? "On now") : "On now") : s.status === "upcoming" ? "Coming up" : "Finished";

export function StartScreen({ step, way, error }: { step: number; way: WayIn; error: string | null }) {
  const nav = useNav();
  const router = useRouter();
  const catalog = useCatalog().data?.seasons ?? null;
  const picks = useFirstRun();
  const loaded = useHydrated();
  // A change keeps the picks from the TV listings and by name (step 10) unless it says otherwise.
  const update = (p: Omit<FirstRunPicks, "at">) => {
    writeFirstRun({ extra: picks.extra, ...p });
    firstRunChanged();
  };
  const byId = useMemo(() => new Map((catalog ?? []).map((s) => [s.seasonId, s])), [catalog]);
  const chosen = picks.picked.filter((id) => byId.has(id) || !!picks.extra?.[id]);

  // Signed out, the last step is the account; signed in, there's no account step.
  useEffect(() => {
    if (!way.me && step === START_STEPS) router.replace(paths.start(3));
  }, [way.me, step, router]);

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-[calc(112px+env(safe-area-inset-bottom,0px))]" data-first-run={step}>
      <header className="-mx-1.5 flex h-14 items-center gap-3 pt-[env(safe-area-inset-top,0px)]">
        {step < START_STEPS ? (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (step > 1 ? nav.back(paths.start(step - 1)) : nav.back(way.me ? paths.home : paths.welcome))}
            className="grid size-11 place-items-center rounded-[3px]"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : (
          <span className="w-11" />
        )}
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: START_STEPS }, (_, i) => (
            <i key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-chyron-line" : "bg-secondary"}`} />
          ))}
        </div>
        <span className="pr-1.5 text-[13px] font-semibold text-muted-foreground">
          {step} of {START_STEPS}
        </span>
      </header>
      {step === 1 && <PickShows catalog={catalog} picks={picks} update={update} openSearch={loaded && new URLSearchParams(window.location.search).has("search")} onNext={() => nav.push(paths.start(2))} />}
      {step === 2 && <WhereYouAre catalog={catalog} byId={byId} chosen={chosen} picks={picks} update={update} loaded={loaded} way={way} />}
      {step === 3 && <SaveShows way={way} chosen={chosen} byId={byId} picks={picks} error={error} />}
      {step === START_STEPS && way.me && <YourPeople way={way} picks={picks} byId={byId} loaded={loaded} catalogReady={!!catalog} />}
    </div>
  );
}

function Heading({ step }: { step: number }) {
  const s = STEPS[step - 1];
  return (
    <>
      <h1 className="type-caption mt-3 whitespace-pre-line text-[46px] leading-[.9]">{s.title}</h1>
      <p className="mt-2.5 text-[15px] leading-[1.45] text-muted-foreground">{s.line}</p>
    </>
  );
}

/** The step's one button, at the foot of the phone over a fade. */
function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="nd-fixed-x fixed bottom-0 z-10 bg-[linear-gradient(transparent,var(--background)_30%)] px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3">{children}</div>
  );
}

// ---------- 1: what are you watching ----------

function PickShows({
  catalog,
  picks,
  update,
  openSearch,
  onNext,
}: {
  catalog: CatalogSeason[] | null;
  picks: FirstRunPicks;
  update: (p: Omit<FirstRunPicks, "at">) => void;
  openSearch: boolean;
  onNext: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    if (openSearch && !opened.current) {
      opened.current = true;
      setSearching(true);
    }
  }, [openSearch]);
  const on = new Set(picks.picked);
  const toggle = (id: string) => {
    const picked = on.has(id) ? picks.picked.filter((x) => x !== id) : [...picks.picked, id];
    update({ picked, where: { ...picks.where, [id]: picks.where[id] ?? 0 } });
  };
  // A show from the TV listings, or one typed in: picked with its name and art kept on the device (step 10).
  const pickExtra = (key: string, e: ExtraPick) => {
    if (on.has(key)) return;
    update({ picked: [...picks.picked, key], where: { ...picks.where, [key]: 0 }, extra: { ...picks.extra, [key]: e } });
  };
  // The wall, then anything found by searching that isn't on it.
  const shown = catalog ? [...catalog.filter((s) => s.wall), ...catalog.filter((s) => !s.wall && on.has(s.seasonId))] : null;
  const extras = picks.picked.filter((id) => picks.extra?.[id]);
  const n = catalog ? picks.picked.filter((id) => catalog.some((s) => s.seasonId === id) || picks.extra?.[id]).length : 0;
  return (
    <>
      <Heading step={1} />
      <button
        type="button"
        data-search-shows
        onClick={() => setSearching(true)}
        className="mt-[18px] flex h-[50px] w-full items-center gap-2.5 rounded-[3px] bg-card px-3.5 text-left text-[15px] text-muted-foreground outline-1 -outline-offset-1 outline-input"
      >
        <Search className="size-[18px]" aria-hidden />
        Search any show
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2.5" data-show-wall>
        {shown === null
          ? Array.from({ length: 4 }, (_, i) => <span key={i} aria-busy className="aspect-[3/4] animate-pulse rounded-[4px] bg-card" />)
          : shown.map((s) => (
              <button
                key={s.seasonId}
                type="button"
                data-pick={s.label}
                aria-pressed={on.has(s.seasonId)}
                onClick={() => toggle(s.seasonId)}
                className={`relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[4px] p-2.5 text-left text-white transition-[transform,box-shadow] duration-300 ${
                  on.has(s.seasonId) ? "scale-[.97] shadow-[0_0_0_3px_var(--chyron-line)]" : ""
                }`}
              >
                <ShowArt seasonId={s.seasonId} artUrl={s.artUrl} name={s.show} position={s.artPosition} className="absolute inset-0 -z-[2] size-full" />
                <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,transparent_40%,rgba(10,8,14,.92))]" />
                <span
                  aria-hidden
                  className={`absolute right-2 top-2 grid size-[30px] place-items-center rounded-full transition-all duration-300 ${on.has(s.seasonId) ? "scale-110 bg-chyron text-chyron-foreground" : "bg-[rgba(10,8,14,.55)] text-transparent"}`}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <b className="type-caption text-[20px]">{s.show}</b>
                <small className="text-[12px] opacity-85">
                  {s.season} · {status(s)}
                </small>
              </button>
            ))}
        {shown &&
          extras.map((id) => (
            <button
              key={id}
              type="button"
              data-pick={picks.extra![id].name}
              aria-pressed
              onClick={() => toggle(id)}
              className="relative isolate flex aspect-[3/4] scale-[.97] flex-col justify-end overflow-hidden rounded-[4px] p-2.5 text-left text-white shadow-[0_0_0_3px_var(--chyron-line)]"
            >
              <ShowArt seasonId={`extra-${id}`} artUrl={picks.extra![id].artUrl} name={picks.extra![id].name} className="absolute inset-0 -z-[2] size-full" />
              <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,transparent_40%,rgba(10,8,14,.92))]" />
              <span aria-hidden className="absolute right-2 top-2 grid size-[30px] scale-110 place-items-center rounded-full bg-chyron text-chyron-foreground">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <b className="type-caption text-[20px]">{picks.extra![id].name}</b>
              <small className="text-[12px] opacity-85">{id.startsWith("tv:") ? "From the TV listings" : "Added by name"} · not a game yet</small>
            </button>
          ))}
        {shown && (
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[4px] bg-card text-center outline-2 -outline-offset-2 outline-dashed outline-input"
          >
            <Search className="size-6" aria-hidden />
            <b className="type-caption text-[20px]">Something else</b>
            <small className="text-[12px] text-muted-foreground">Any show at all</small>
          </button>
        )}
      </div>
      <SearchSheet
        open={searching}
        onOpenChange={setSearching}
        catalog={catalog ?? []}
        picked={on}
        onPick={(s) => {
          if (!on.has(s.seasonId)) toggle(s.seasonId);
          setSearching(false);
          toast(`${s.label} added`);
        }}
        onPickExtra={(key, e) => {
          pickExtra(key, e);
          setSearching(false);
          toast(`${e.name} added`);
        }}
      />
      <Foot>
        <Btn tone="must" wide className="type-caption h-14 text-[20px]" disabled={!n} data-next onClick={onNext}>
          {n ? `Next · ${n} picked` : "Pick at least one"}
        </Btn>
      </Foot>
    </>
  );
}

/** Search every show (the catalog's seasons) and the TV listings, or add one by name (step 10's search: watching/search.tsx). */
function SearchSheet({
  open,
  onOpenChange,
  catalog,
  picked,
  onPick,
  onPickExtra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  catalog: CatalogSeason[];
  picked: Set<string>;
  onPick: (s: CatalogSeason) => void;
  onPickExtra: (key: string, e: ExtraPick) => void;
}) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open]);
  const t = q.trim().toLowerCase();
  const none = useMemo(() => new Set<string>(), []);
  const search = useShowSearch(q, catalog, none);
  const wall = catalog.filter((s) => s.wall);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Find a show" subtitle="Anything on TV. Playing is optional.">
      <label className="flex h-[50px] items-center gap-2.5 rounded-[3px] bg-background px-3 outline-2 -outline-offset-2 outline-chyron-line">
        <Search className="size-[18px] text-muted-foreground" aria-hidden />
        <input ref={input} data-search-input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or add a show" autoComplete="off" aria-label="Search or add a show" className="h-full flex-1 bg-transparent text-[16px] outline-none" />
      </label>
      {!t ? (
        <>
          <p className="type-caption mb-1 mt-4 text-[13px] tracking-[0.06em] text-muted-foreground">On now and coming up</p>
          <div className="mt-1" data-search-results>
            {wall.map((s) => (
              <button key={s.seasonId} type="button" data-hit={s.label} onClick={() => onPick(s)} className="nd-press flex min-h-16 w-full items-center gap-3 border-b border-border text-left">
                <ShowArt seasonId={`search-${s.seasonId}`} artUrl={s.artUrl} name={s.show[0]} position={s.artPosition} className="size-12 flex-none rounded-[3px] text-[22px]" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px]">{s.label}</b>
                  <small className="text-[12px] text-muted-foreground">
                    {s.season} · {status(s)}
                  </small>
                </span>
                {picked.has(s.seasonId) && <span className="type-caption flex-none rounded-[2px] bg-chyron px-[7px] py-[3px] text-[11px] tracking-[0.05em] text-chyron-foreground">Picked</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <SearchRows
            rows={search.rows}
            picked={picked}
            onPick={(r) => (r.kind === "season" ? onPick(r.season) : onPickExtra(listingKey(r.hit.tvmazeId), { name: r.hit.name, artUrl: r.hit.thumb }))}
          />
          <SearchNote loading={search.loading} unavailable={search.unavailable} />
          {!search.exact && !search.loading && t.length >= 2 && (
            <AddNewBlock q={q} any={search.rows.length > 0} onPick={() => onPickExtra(nameKeyOf(q), { name: q.trim().replace(/\s+/g, " "), artUrl: null })} />
          )}
        </>
      )}
      <ListingsCredit />
    </Sheet>
  );
}

// ---------- 2: where are you in them ----------

function WhereYouAre({
  catalog,
  byId,
  chosen,
  picks,
  update,
  loaded,
  way,
}: {
  catalog: CatalogSeason[] | null;
  byId: Map<string, CatalogSeason>;
  chosen: string[];
  picks: FirstRunPicks;
  update: (p: Omit<FirstRunPicks, "at">) => void;
  loaded: boolean;
  way: WayIn;
}) {
  const nav = useNav();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Saved and on the way to your people: the picks are cleared, which mustn't send you back to the shows.
  const saved = useRef(false);
  // Nothing picked (a reload on a new phone): back to the shows.
  useEffect(() => {
    if (!saved.current && loaded && catalog && !chosen.length) router.replace(paths.start(1));
  }, [loaded, catalog, chosen.length, router]);
  return (
    <>
      <Heading step={2} />
      <div className="mt-[18px] border-t border-border">
        {chosen.map((id) => {
          const onChange = (n: number) => update({ picked: picks.picked, where: { ...picks.where, [id]: n } });
          const s = byId.get(id);
          if (!s) return <ExtraWhere key={id} id={id} e={picks.extra![id]} seen={picks.where[id] ?? 0} onChange={onChange} />;
          return <WhereRow key={id} s={s} seen={Math.min(picks.where[id] ?? 0, whereCap(s.aired))} onChange={onChange} />;
        })}
      </div>
      <Foot>
        <Btn
          tone="must"
          wide
          className="type-caption h-14 text-[20px]"
          data-next
          disabled={busy || !chosen.length}
          onClick={async () => {
            if (!way.me) return nav.push(paths.start(3));
            // Signed in already: saved now, and on to your people.
            setBusy(true);
            try {
              await saveFirstRun(followsOf({ ...picks, picked: chosen }, (sid) => byId.get(sid)?.aired));
              saved.current = true;
              forgetFirstRun();
              nav.push(paths.start(START_STEPS));
            } catch (e) {
              toast((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Next"}
        </Btn>
      </Foot>
    </>
  );
}

/** Where you are in a show from the TV listings (read from its listing: how much has aired), or one added by name (no
 *  episodes yet, so nothing to set). */
function ExtraWhere({ id, e, seen, onChange }: { id: string; e: ExtraPick; seen: number; onChange: (n: number) => void }) {
  const tv = id.startsWith("tv:") ? Number(id.slice(3)) : null;
  const { data } = useListingSeason(tv);
  const season = data?.season ?? null;
  const s: WhereSeason = {
    seasonId: id,
    label: season ? `${e.name} ${season.number}` : e.name,
    show: e.name,
    artUrl: e.artUrl,
    artPosition: "center",
    aired: tv == null || !data ? 0 : (season?.aired ?? 0),
    status: season?.status ?? "upcoming",
    premiere: season?.premiere ?? null,
  };
  if (tv != null && !data) return <div aria-busy className="my-2 h-[60px] animate-pulse rounded-[3px] bg-card" />;
  return <WhereRow s={s} seen={Math.min(seen, whereCap(s.aired))} onChange={onChange} line={tv == null ? "Added by name: its episodes come later" : undefined} />;
}

// ---------- 3: save your shows (the account) ----------

function SaveShows({ way, chosen, byId, picks, error }: { way: WayIn; chosen: string[]; byId: Map<string, CatalogSeason>; picks: FirstRunPicks; error: string | null }) {
  const router = useRouter();
  const [check, setCheck] = useState<string | null>(null);
  // Signed in (back from Google, or here by the address): nothing to make; your people next.
  useEffect(() => {
    if (way.me) router.replace(paths.start(START_STEPS));
  }, [way.me, router]);
  const n = chosen.length;
  const art = chosen.slice(0, 4).map((id) => byId.get(id) ?? { seasonId: id, artUrl: picks.extra?.[id]?.artUrl ?? null, show: picks.extra?.[id]?.name ?? "?", artPosition: "center" });
  const next = paths.start(START_STEPS);
  return (
    <>
      <Heading step={3} />
      <div className="mt-[18px] flex flex-col gap-2.5">
        {n > 0 && (
          <div className="flex items-center gap-2.5 rounded-[4px] bg-card px-3 py-2.5" data-saving={n}>
            <span className="flex">
              {art.map((s) => (
                <ShowArt key={s.seasonId} seasonId={`why-${s.seasonId}`} artUrl={s.artUrl} name={s.show[0]} position={s.artPosition} className="-mr-2 h-10 w-[30px] rounded-[2px] text-[14px] shadow-[0_0_0_2px_var(--card)]" />
              ))}
            </span>
            <small className="ml-2 text-[13px] leading-snug text-muted-foreground">
              <b className="text-foreground">
                {n} show{n > 1 ? "s" : ""}
              </b>{" "}
              and where you are in each
            </small>
          </div>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-live">
            Couldn&rsquo;t sign in with Google. Try again, or make an account below.
          </p>
        )}
        {check ? (
          <CheckEmail email={check} line="Open it on this phone and your shows come with you." />
        ) : (
          <>
            {way.google && (
              <>
                <GoogleButton callbackURL={next} errorCallbackURL={`${paths.start(3)}?error=google`} />
                <OrLine />
              </>
            )}
            <AccountForm
              callbackURL={next}
              onMade={async (m) => {
                if ("checkEmail" in m) return setCheck(m.checkEmail);
                try {
                  await saveFirstRun(followsOf({ ...picks, picked: chosen }, (sid) => byId.get(sid)?.aired));
                  forgetFirstRun();
                } catch {
                  /* kept on the device: step 4 saves them */
                }
                // A full load: the pages read who's signed in on the server.
                window.location.assign(next);
              }}
            />
          </>
        )}
        <p className="mt-1 text-center text-[13px] leading-normal text-muted-foreground">
          Already have an account?{" "}
          <a href={paths.signin(next)} className="font-bold text-foreground underline underline-offset-[3px]">
            Sign in
          </a>
        </p>
      </div>
    </>
  );
}

// ---------- 4: bring your people ----------

function Choice({ icon: Icon, title, line, quiet, onClick, ...rest }: { icon: typeof Users; title: string; line: string; quiet?: boolean; onClick: () => void; [k: `data-${string}`]: string | boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={`nd-press mb-2.5 flex min-h-[82px] w-full items-center gap-3.5 rounded-[4px] px-3.5 text-left outline-1 -outline-offset-1 outline-border ${quiet ? "" : "bg-card"}`}
    >
      <span className={`grid size-12 flex-none place-items-center rounded-[3px] ${quiet ? "bg-secondary" : "bg-chyron text-chyron-foreground"}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <b className="block text-[17px]">{title}</b>
        <small className="text-[13px] leading-[1.4] text-muted-foreground">{line}</small>
      </span>
    </button>
  );
}

function YourPeople({ way, picks, byId, loaded, catalogReady }: { way: WayIn; picks: FirstRunPicks; byId: Map<string, CatalogSeason>; loaded: boolean; catalogReady: boolean }) {
  const nav = useNav();
  const me = way.me!;
  const [sheet, setSheet] = useState<"new" | "join" | null>(null);
  const [named, setNamed] = useState(!!me.username);
  // Back from Google or an emailed link: the shows still on this device are saved now.
  const saved = useRef(false);
  useEffect(() => {
    if (!loaded || !catalogReady || saved.current || !picks.picked.length) return;
    saved.current = true;
    saveFirstRun(followsOf(picks, (sid) => byId.get(sid)?.aired))
      .then(() => forgetFirstRun())
      .catch(() => {
        saved.current = false;
      });
  }, [loaded, catalogReady, picks, byId]);
  const waiting = !me.approved;
  return (
    <>
      {waiting ? (
        <div data-waiting>
          <h1 className="type-caption mt-3 text-[46px] leading-[.9]">
            You&rsquo;re on
            <br />
            the list
          </h1>
          <p className="mt-2.5 text-[15px] leading-[1.45] text-muted-foreground">
            We&rsquo;re letting people in a few at a time. Your shows are saved, and where you are in each.
          </p>
          {invitesLetIn(way.signups) ? (
            <>
              <p className="mt-5 text-[15px] leading-[1.45]">Got an invite code from a friend? It lets you straight in.</p>
              <div className="mt-4">
                <Choice icon={KeyRound} title="Join a friend's couch" line="Type the code they sent" data-choice="join" onClick={() => setSheet("join")} />
              </div>
            </>
          ) : (
            <p className="mt-5 text-[15px] leading-[1.45]">Once you&rsquo;re in, signing in takes you straight to your shows.</p>
          )}
          <Btn wide className="mt-3" onClick={() => logOutTo(paths.welcome)}>
            Sign out
          </Btn>
        </div>
      ) : (
        <div data-people>
          <Heading step={START_STEPS} />
          <div className="mt-[18px]">
            <Choice icon={Users} title="Start a couch" line="Name it, get a code, send it to your group" data-choice="new" onClick={() => setSheet("new")} />
            <Choice icon={KeyRound} title="Join a friend's couch" line="Got a code? Pull up a seat" data-choice="join" onClick={() => setSheet("join")} />
            <Choice icon={Tv} quiet title="Just me for now" line="Follow your shows, rate episodes, watch along. Invite anyone later." data-choice="solo" onClick={() => nav.push(paths.home)} />
          </div>
        </div>
      )}
      {!waiting && <NewCouchSheet open={sheet === "new"} onOpenChange={(o) => !o && setSheet(null)} />}
      <JoinCouchSheet open={sheet === "join"} onOpenChange={(o) => !o && setSheet(null)} />
      <UsernameSheet open={!named} email={me.email} onDone={() => setNamed(true)} />
    </>
  );
}
