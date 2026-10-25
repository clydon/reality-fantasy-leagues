"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, KeyRound, Minus, Plus, Search, Tv, Users } from "lucide-react";
import { logOutTo } from "@/lib/auth-client";
import { invitesLetIn } from "@/lib/signups";
import type { WayIn } from "@/lib/server/way-in";
import { saveFirstRun, useCatalog, type CatalogSeason } from "../data";
import { JoinCouchSheet, NewCouchSheet } from "../couch/couch-sheets";
import { useNav } from "../nav";
import { paths, START_STEPS } from "../routes";
import { Btn } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { followsOf, whereCap, whereLabel, writeFirstRun, type FirstRunPicks } from "../way-in";
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
  const update = (p: Omit<FirstRunPicks, "at">) => {
    writeFirstRun(p);
    firstRunChanged();
  };
  const byId = useMemo(() => new Map((catalog ?? []).map((s) => [s.seasonId, s])), [catalog]);
  const chosen = picks.picked.filter((id) => byId.has(id));

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
  // The wall, then anything found by searching that isn't on it.
  const shown = catalog ? [...catalog.filter((s) => s.wall), ...catalog.filter((s) => !s.wall && on.has(s.seasonId))] : null;
  const n = catalog ? picks.picked.filter((id) => catalog.some((s) => s.seasonId === id)).length : 0;
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
                  on.has(s.seasonId) ? "scale-[.97] shadow-[0_0_0_3px_var(--chyron)]" : ""
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
      <SearchSheet open={searching} onOpenChange={setSearching} catalog={catalog ?? []} picked={on} onPick={(s) => {
        if (!on.has(s.seasonId)) toggle(s.seasonId);
        setSearching(false);
        toast(`${s.label} added`);
      }} />
      <Foot>
        <Btn tone="must" wide className="type-caption h-14 text-[20px]" disabled={!n} data-next onClick={onNext}>
          {n ? `Next · ${n} picked` : "Pick at least one"}
        </Btn>
      </Foot>
    </>
  );
}

/** Search the catalog: every season set up so far, by show. Anything else is Add a show's (step 10). */
function SearchSheet({
  open,
  onOpenChange,
  catalog,
  picked,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  catalog: CatalogSeason[];
  picked: Set<string>;
  onPick: (s: CatalogSeason) => void;
}) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open]);
  const t = q.trim().toLowerCase();
  const hits = t ? catalog.filter((s) => `${s.show} ${s.label}`.toLowerCase().includes(t)).slice(0, 12) : catalog.filter((s) => s.wall);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Find a show" subtitle="Every show set up for games so far">
      <label className="flex h-[50px] items-center gap-2.5 rounded-[3px] bg-background px-3 outline-2 -outline-offset-2 outline-chyron-line">
        <Search className="size-[18px] text-muted-foreground" aria-hidden />
        <input ref={input} data-search-input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Show name" autoComplete="off" aria-label="Show name" className="h-full flex-1 bg-transparent text-[16px] outline-none" />
      </label>
      {!t && <p className="type-caption mb-1 mt-4 text-[13px] tracking-[0.06em] text-muted-foreground">On now and coming up</p>}
      <div className="mt-1" data-search-results>
        {hits.map((s) => (
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
      {t && !hits.length && (
        <Preview id="start.add-show" className="mt-3">
          <div className="flex min-h-16 items-center gap-3 p-2">
            <span className="grid size-12 flex-none place-items-center rounded-[3px] outline-2 -outline-offset-2 outline-dashed outline-input">
              <Plus className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px]">Add &ldquo;{q.trim()}&rdquo;</b>
              <small className="text-[12px] text-muted-foreground">Not set up yet? Add it by name and follow it</small>
            </span>
          </div>
        </Preview>
      )}
    </Sheet>
  );
}

// ---------- 2: where are you in them ----------

function Stepper({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-none items-center" data-stepper={label}>
      <button type="button" aria-label={`Earlier in ${label}`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} className="grid size-11 place-items-center rounded-[3px] bg-card disabled:opacity-40">
        <Minus className="size-5" aria-hidden />
      </button>
      <b className="type-num w-9 text-center text-[24px]" aria-live="polite">
        {value}
      </b>
      <button type="button" aria-label={`Later in ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid size-11 place-items-center rounded-[3px] bg-card disabled:opacity-40">
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** One season's row: its art, where you are in words, and the stepper (none before its premiere). */
export function WhereRow({ s, seen, onChange }: { s: Pick<CatalogSeason, "seasonId" | "label" | "show" | "artUrl" | "artPosition" | "aired" | "status" | "premiere">; seen: number; onChange: (n: number) => void }) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-t border-border py-2 first:border-t-0" data-where={s.label}>
      <ShowArt seasonId={`where-${s.seasonId}`} artUrl={s.artUrl} name={s.show[0]} position={s.artPosition} className="h-12 w-16 flex-none rounded-[3px] text-[22px]" />
      <div className="min-w-0 flex-1">
        <b className="type-caption block truncate text-[17px]">{s.label}</b>
        <small className="block text-[12px] leading-snug text-muted-foreground" data-where-line>
          {whereLabel(s, seen)}
        </small>
      </div>
      {s.aired !== 0 && <Stepper value={seen} max={whereCap(s.aired)} label={s.label} onChange={onChange} />}
    </div>
  );
}

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
  // Nothing picked (a reload on a new phone): back to the shows.
  useEffect(() => {
    if (loaded && catalog && !chosen.length) router.replace(paths.start(1));
  }, [loaded, catalog, chosen.length, router]);
  return (
    <>
      <Heading step={2} />
      <div className="mt-[18px] border-t border-border">
        {chosen.map((id) => {
          const s = byId.get(id)!;
          return <WhereRow key={id} s={s} seen={Math.min(picks.where[id] ?? 0, whereCap(s.aired))} onChange={(n) => update({ picked: picks.picked, where: { ...picks.where, [id]: n } })} />;
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

// ---------- 3: save your shows (the account) ----------

function SaveShows({ way, chosen, byId, picks, error }: { way: WayIn; chosen: string[]; byId: Map<string, CatalogSeason>; picks: FirstRunPicks; error: string | null }) {
  const router = useRouter();
  const [check, setCheck] = useState<string | null>(null);
  // Signed in (back from Google, or here by the address): nothing to make; your people next.
  useEffect(() => {
    if (way.me) router.replace(paths.start(START_STEPS));
  }, [way.me, router]);
  const n = chosen.length;
  const art = chosen.slice(0, 4).map((id) => byId.get(id)!);
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
