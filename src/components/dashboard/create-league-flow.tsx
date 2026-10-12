"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, Copy, Plus, Share, X } from "lucide-react";
import StateLogic from "@/lib/game/state-logic.js";
import type { CatalogShow, LeagueInvite, LeagueState } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore, useIsAuthenticated, useIsSuperAdmin } from "@/lib/store";
import { termsFrom } from "@/lib/use-show-terms";
import { publicMediaSrc } from "@/lib/game/selectors";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { PlainButton } from "@/components/draft/draft-ui";
import { Chip, Field, PrimaryButton, TextSheet, fieldCls } from "@/components/setup/settings-ui";
import { m, AnimatePresence } from "@/components/motion";
import { useTourStore } from "@/lib/tour/tour-store";
import { TOUR_JOIN_CODE, buildCommissionerState } from "@/lib/tour/commissioner";
import { TOUR_LEAGUE_NAME, TOUR_SHOW_NAME, TOUR_TERMS } from "@/lib/tour/rise-and-fall";
import { cn } from "cn";
import { ResearchShowFlow } from "./research-show-flow";

// Create a league as a full-screen, four-step flow (docs/PLAN-ux-redesign.md 2a; the canvas's
// "A · Create a league", Create-1 to Create-4), at /new-league with no app shell around it:
//
//   1. Show and season. A finished season defaults to catch-up results, and says so in one line.
//   2. How to play: the three league types.
//   3. Name it, and (for a league with a draft) when the draft is. Create league.
//   4. Invite: the join code with Share, invite by username or email, add a computer player, then
//      into the league.
//
// It replaces both the old three-step card on the Dashboard and League Settings' guided setup, which
// used to ask for the name and show again, then the season, after the league was created. The league
// is created at the end of step 3 with every basic already answered, so it's marked set up straight
// away. Results, starting episode and ownership take their defaults; League Settings changes them.
//
// The store isn't switched to the new league until the person leaves step 4: switching shows the boot
// overlay, which would unmount this flow mid-invite. Step 4 talks to the API by league id instead.
//
// The commissioner's guided tour (docs/PLAN-guided-tour.md) plays it locally: it opens on step 3 with
// *Rise & Fall* already chosen and named, Create league loads the tour's league into the store
// (nothing is saved, so no boot overlay), and step 4's code copies but invites nobody.

// The order the type cards appear in. StateLogic.LEAGUE_TYPES is keyed for strategy lookup, not display.
const TYPE_ORDER = ["classic-draft", "active-roster", "pickem"] as const;

type Step = 1 | 2 | 3 | 4;
type Season = CatalogShow["seasons"][number];

const STEP_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

// How many catalogued seasons get a card; older ones are reached by typing the number.
const SEASON_CARDS = 5;

// The season a new league most likely wants: the one airing now, else the next one, else the newest.
function leadSeason(show: CatalogShow): Season | null {
  return show.seasons.find((s) => s.status === "airing") ?? show.seasons.find((s) => s.status === "upcoming") ?? show.seasons[0] ?? null;
}

export function CreateLeagueFlow() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useIsAuthenticated();
  const isSuperAdmin = useIsSuperAdmin();
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  // Decided once, on arrival: skipping the tour part-way doesn't turn this into a real create.
  const [tour] = useState(() => {
    const t = useTourStore.getState();
    return t.step !== null && t.kind === "commissioner" && !t.created;
  });

  const [step, setStep] = useState<Step>(tour ? 3 : 1);
  const [dir, setDir] = useState(1);
  // Step 1
  const [showSlug, setShowSlug] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [typingSeason, setTypingSeason] = useState(false);
  // null: follow the season (finished means catch up); otherwise the person's own choice.
  const [catchUpChoice, setCatchUpChoice] = useState<boolean | null>(null);
  const [researching, setResearching] = useState(false);
  const seasonRef = useRef<HTMLElement>(null);
  // Step 2
  const [typeId, setTypeId] = useState<string | null>(tour ? "active-roster" : null);
  // Step 3
  const [name, setName] = useState(tour ? TOUR_LEAGUE_NAME : "");
  const [draftWhen, setDraftWhen] = useState<"self" | "time">("self");
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("20:00");
  // "Now" for the past-time check while rendering; create() checks again against the real clock.
  const [openedAt] = useState(() => Date.now());
  // Creating, and after
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string; joinCode: string } | null>(null);
  const [leagueState, setLeagueState] = useState<LeagueState | null>(null);

  // Not gated on store mode like useShowCatalog: a leagueless user's store is in "mock" mode even
  // though they're signed in. Same query key, so it's shared with League Settings.
  const { data: catalog } = useQuery({
    queryKey: ["shows-catalog"],
    queryFn: () => api.listShows(),
    staleTime: 10 * 60 * 1000,
    enabled: isAuthenticated,
  });
  // Shows a user researched for themselves (test shows included) are theirs alone; an admin sees all.
  const shows = (catalog?.shows ?? []).filter((s) => isSuperAdmin || s.curated !== false || s.mine);
  const show = shows.find((s) => s.slug === showSlug) ?? null;
  const terms = termsFrom(tour ? { name: TOUR_SHOW_NAME, castaway_term: TOUR_TERMS.castaway, tribe_term: TOUR_TERMS.tribe } : show);
  const catalogSeason = show?.seasons.find((s) => s.seasonNumber === season) ?? null;
  const catchingUp = catchUpChoice ?? catalogSeason?.status === "completed";
  const leagueType = typeId ? StateLogic.LEAGUE_TYPES[typeId] : null;
  const hasDraft = !!leagueType?.hasRoster;

  // What a new league of this type starts with (roster shape, ownership), from the real defaults
  // rather than a copy of them.
  const preview = useMemo(() => {
    if (tour) return buildCommissionerState();
    const s = StateLogic.defaultState();
    if (typeId) StateLogic.updateSettings(s, "leagueTypeId", typeId);
    return s;
  }, [typeId, tour]);

  function go(next: Step) {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(null);
    window.scrollTo(0, 0);
  }

  function pickShow(s: CatalogShow) {
    setShowSlug(s.slug);
    const lead = leadSeason(s);
    setSeason(lead?.seasonNumber ?? null);
    setTypingSeason(!lead);
    setCatchUpChoice(null);
    requestAnimationFrame(() => seasonRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  function pickSeason(n: number | null) {
    setSeason(n);
    setCatchUpChoice(null);
  }

  // A scheduled draft opens on its own at that time, so one in the past would open immediately.
  const draftAt = hasDraft && draftWhen === "time" && draftDate ? new Date(`${draftDate}T${draftTime || "20:00"}`) : null;
  const draftInPast = !!draftAt && draftAt.getTime() <= openedAt;

  const canNext = tour
    ? !!name.trim()
    : step === 1
      ? !!show && season != null && !researching
      : step === 2
        ? !!leagueType
        : !!name.trim() && !(hasDraft && draftWhen === "time" && (!draftDate || draftInPast));

  async function create() {
    if (tour) {
      useTourStore.getState().create();
      setCreated({ id: "tour", name: name.trim() || TOUR_LEAGUE_NAME, joinCode: TOUR_JOIN_CODE });
      setLeagueState(useLeagueStore.getState().fullState);
      go(4);
      return;
    }
    const trimmed = name.trim();
    if (!canNext || !showSlug || !typeId || season == null) return;
    if (draftAt && draftAt.getTime() <= Date.now()) {
      setError("Pick a draft time that hasn't passed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // A retry after a failure part-way reuses the league already made rather than making another.
      let league = created;
      if (!league) {
        const r = await api.createLeague(trimmed);
        league = { id: r.league.id, name: r.league.name, joinCode: r.league.join_code };
        setCreated(league);
      } else if (league.name !== trimmed) {
        await api.renameLeague(league.id, trimmed);
        league = { ...league, name: trimmed };
        setCreated(league);
      }
      const id = league.id;
      const set = (field: string, value: unknown) => api.updateLeagueSettings(id, field, value);
      // Order matters. The show brings its format; the type comes before setupComplete because
      // Active Roster defaults to shared ownership only during setup; and catch-up is set before the
      // season, because picking the season is what files its results into the league.
      await set("showId", showSlug);
      await set("leagueTypeId", typeId);
      await set("revealedThroughEpisode", catchingUp ? 0 : null);
      await set("wikiSeason", season);
      await set("draftScheduledAt", draftAt ? draftAt.toISOString() : null);
      setLeagueState(await set("setupComplete", true));
      go(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the league. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Into the new league. switchLeague shows the boot overlay at once, which unmounts this page, so
  // the navigation starts alongside it rather than after.
  async function enter(to: string) {
    if (!created) return;
    // The tour's league is already the one loaded.
    if (tour) {
      router.push(to);
      return;
    }
    setBusy(true);
    try {
      const me = await api.me();
      const loading = switchLeague(created.id);
      setLeagues(me.leagues);
      router.push(to);
      await loading;
    } catch {
      setBusy(false);
      setError("Couldn't open the league. Try again.");
    }
  }

  function close() {
    if (created) enter("/");
    else router.push(tour ? "/" : "/dashboard");
  }

  if (!isAuthenticated && !tour) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 py-10">
        <p className="text-base">Sign in to create a league.</p>
        <PlainButton href="/">Back</PlainButton>
      </div>
    );
  }

  const heading = (text: ReactNode) => <h1 className="type-caption text-[30px] leading-none">{text}</h1>;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <header className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 py-2.5 pl-1 pr-4">
          {(step === 2 || step === 3) && !tour ? (
            <IconButton label="Back" onClick={() => go((step - 1) as Step)}>
              <ChevronLeft className="size-6" strokeWidth={2.2} />
            </IconButton>
          ) : (
            <IconButton label={created ? "Close and open the league" : "Close"} onClick={close} disabled={busy}>
              <X className="size-[22px]" strokeWidth={2.2} />
            </IconButton>
          )}
          <span className="flex-1 text-base font-semibold">New league</span>
          <span className="text-sm text-muted-foreground">{step} of 4</span>
        </div>
        <div className="flex gap-1.5 px-4" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-chyron-line" : "bg-input")} />
          ))}
        </div>
      </header>

      <main className="relative flex flex-1 flex-col overflow-x-clip px-4 pb-6 pt-5">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <m.div
            key={step}
            custom={dir}
            variants={STEP_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-3"
          >
            {step === 1 && (
              <>
                {heading("What are you watching?")}
                {researching ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-[15px] text-muted-foreground">Research your show&rsquo;s rules, then approve them to add it.</p>
                    <ResearchShowFlow
                      onCreated={(s) => {
                        // The catalog is cached for 10 minutes; without this the new show isn't in it.
                        queryClient.invalidateQueries({ queryKey: ["shows-catalog"] });
                        setShowSlug(s.slug);
                        setSeason(null);
                        setTypingSeason(true);
                        setCatchUpChoice(null);
                        setResearching(false);
                      }}
                      onCancel={() => setResearching(false)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2.5">
                      {!catalog && <p className="text-sm text-muted-foreground">Loading shows…</p>}
                      {shows.map((s) => (
                        <ShowTile key={s.slug} show={s} selected={s.slug === showSlug} onSelect={() => pickShow(s)} />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setResearching(true)}
                      className="min-h-11 self-start text-[15px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      My show isn&rsquo;t here
                    </button>
                    {show && (
                      <section ref={seasonRef} className="flex scroll-mb-28 flex-col gap-3 pt-1" aria-label="Season">
                        <h2 className="type-caption text-[24px] leading-none">Which {show.name} season?</h2>
                        {show.seasons.length > 0 && (
                          <div className="grid grid-cols-2 gap-2.5">
                            {show.seasons.slice(0, SEASON_CARDS).map((s) => (
                              <OptionCard
                                key={s.seasonNumber}
                                selected={!typingSeason && season === s.seasonNumber}
                                onClick={() => {
                                  setTypingSeason(false);
                                  pickSeason(s.seasonNumber);
                                }}
                                title={`Season ${s.seasonNumber}`}
                                detail={seasonDetail(s, terms.castaways)}
                                compact
                              />
                            ))}
                            <OptionCard
                              selected={typingSeason}
                              onClick={() => {
                                setTypingSeason(true);
                                pickSeason(null);
                              }}
                              title="Another"
                              detail="Type the number"
                              compact
                            />
                          </div>
                        )}
                        {typingSeason && (
                          <Field label="Season number" htmlFor="nl-season">
                            <input
                              id="nl-season"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              className={fieldCls}
                              placeholder="44"
                              value={season ?? ""}
                              onChange={(e) => {
                                const n = parseInt(e.target.value);
                                pickSeason(Number.isFinite(n) && n > 0 ? n : null);
                              }}
                            />
                          </Field>
                        )}
                        {season != null && catalogSeason?.status !== "upcoming" && (
                          <div className="flex flex-col items-start">
                            <p className="text-[13px] leading-snug text-muted-foreground">
                              {catchingUp
                                ? "You'll catch up: each episode's results stay hidden until your league reveals them."
                                : "Results arrive as each episode is logged."}
                            </p>
                            <button
                              type="button"
                              onClick={() => setCatchUpChoice(!catchingUp)}
                              className="min-h-11 text-[13px] font-semibold text-foreground underline underline-offset-4"
                            >
                              {catchingUp ? "Get them live instead" : "Catch up from episode 1 instead"}
                            </button>
                          </div>
                        )}
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                {heading("How do you want to play?")}
                <div className="flex flex-col gap-2.5 pt-1">
                  {TYPE_ORDER.map((id) => {
                    const copy = typeCopy(id, terms.castaway, terms.castaways);
                    return (
                      <OptionCard
                        key={id}
                        selected={typeId === id}
                        onClick={() => setTypeId(id)}
                        title={StateLogic.LEAGUE_TYPES[id].name}
                        lead={copy.lead}
                        detail={copy.detail}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && (
              <form
                className="flex flex-col gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  create();
                }}
              >
                {heading(hasDraft ? "Name it and set the draft" : "Name your league")}
                <Field label="League name" htmlFor="nl-name">
                  <input
                    id="nl-name"
                    className={fieldCls}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                </Field>
                {hasDraft && (
                  <fieldset className="flex flex-col gap-2.5">
                    <legend className="mb-1.5 text-sm font-semibold">When&rsquo;s the draft?</legend>
                    <RadioCard
                      name="draft-when"
                      checked={draftWhen === "self"}
                      onChange={() => setDraftWhen("self")}
                      title="Start it myself"
                      detail="Open it from Draft once everyone's in"
                    />
                    <RadioCard
                      name="draft-when"
                      checked={draftWhen === "time"}
                      onChange={() => setDraftWhen("time")}
                      title="Pick a time"
                      detail="The draft opens on its own then"
                    />
                    {draftWhen === "time" && (
                      <div className="flex flex-col gap-1.5 pl-[50px]">
                        <div className="flex gap-2.5">
                          <input
                            type="date"
                            aria-label="Draft date"
                            className={cn(fieldCls, "min-w-0 flex-[1.3]")}
                            value={draftDate}
                            min={todayLocal()}
                            onChange={(e) => setDraftDate(e.target.value)}
                          />
                          <input
                            type="time"
                            aria-label="Draft time"
                            className={cn(fieldCls, "min-w-0 flex-1")}
                            value={draftTime}
                            onChange={(e) => setDraftTime(e.target.value)}
                          />
                        </div>
                        {draftInPast && <p className="text-[13px] font-semibold text-live">Pick a time that hasn&rsquo;t passed.</p>}
                      </div>
                    )}
                  </fieldset>
                )}
                {hasDraft && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">{leagueType?.hasActiveRoster ? "Lineup" : "Teams"}</span>
                    <div className="flex flex-col gap-0.5 rounded-[3px] bg-card px-3.5 py-3">
                      <span className="text-[15px] font-semibold">{rosterLine(preview, terms.castaways)}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {preview.settings.ownershipMode === "shared"
                          ? "Blind draft: everyone picks privately, and the same person can be on several teams."
                          : `Snake draft: each ${terms.castaway} goes to one team.`}{" "}
                        Change it in League Settings before the draft.
                      </span>
                    </div>
                  </div>
                )}
                {/* Lets the keyboard's Go/Done key submit; the visible button is in the footer. */}
                <button type="submit" hidden />
              </form>
            )}

            {step === 4 && created && (
              <InviteStep league={created} state={leagueState} hasDraft={hasDraft} draftAt={draftAt} onState={setLeagueState} tour={tour} />
            )}
          </m.div>
        </AnimatePresence>
      </main>

      {!(step === 1 && researching) && (
        // While the tour's host is on it sits at the foot of the screen: the footer grows by its height
        // (--tour-h) so the button stays above it.
        <footer className="sticky bottom-0 z-10 border-t border-border bg-background px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px)+var(--tour-h,0px))] pt-3">
          {error && (
            <p role="alert" className="mb-2.5 text-sm font-semibold text-live">
              {error}
            </p>
          )}
          {step < 3 && (
            <PrimaryButton className="min-h-[52px] w-full text-base" disabled={!canNext} onClick={() => go((step + 1) as Step)}>
              Next
            </PrimaryButton>
          )}
          {step === 3 && (
            <>
              <p className="mb-2.5 text-center text-[13px] text-muted-foreground">You&rsquo;ll be the commissioner and the first player.</p>
              <div data-tour="create-league">
                <PrimaryButton className="min-h-[52px] w-full text-base" disabled={!canNext || busy} onClick={create}>
                  {busy ? "Creating…" : "Create league"}
                </PrimaryButton>
              </div>
            </>
          )}
          {step === 4 && (
            // Bone, not chyron: on this step Share is the one yellow thing.
            <button
              type="button"
              disabled={busy}
              onClick={() => enter(hasDraft ? "/draft" : "/")}
              data-tour="invite-enter"
              className="min-h-[52px] w-full rounded-[3px] bg-foreground px-5 text-base font-bold text-background transition-[filter] hover:brightness-[0.94] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-50"
            >
              {busy ? "Opening…" : hasDraft ? "Go to the draft" : "Go to your league"}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

// Step 4: the join code to share, invites, and the players so far.
function InviteStep({
  league,
  state,
  hasDraft,
  draftAt,
  onState,
  tour,
}: {
  league: { id: string; name: string; joinCode: string };
  state: LeagueState | null;
  hasDraft: boolean;
  draftAt: Date | null;
  onState: (s: LeagueState) => void;
  /** The commissioner's tour: the code copies, but nobody is invited or added. */
  tour?: boolean;
}) {
  const markCopied = useTourStore((s) => s.markCopied);
  const [copied, setCopied] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [addingBot, setAddingBot] = useState(false);

  const players = (state?.players ?? []).filter((p) => !p.disabled);
  const bots = players.filter((p) => p.automated).length;

  async function copy() {
    if (tour) markCopied();
    try {
      await navigator.clipboard.writeText(league.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the code is on screen anyway */
    }
  }

  async function share() {
    const text = `Join ${league.name}: use code ${league.joinCode} at ${window.location.origin}`;
    if (tour || !navigator.share) return copy();
    try {
      await navigator.share({ text });
    } catch {
      /* share sheet dismissed */
    }
  }

  async function invite() {
    const trimmed = identifier.trim();
    if (!trimmed) return;
    setSending(true);
    setNote(null);
    try {
      const { invite } = await api.sendInvite(league.id, trimmed);
      setInvites((list) => [invite, ...list]);
      setIdentifier("");
    } catch (err) {
      setNote({ text: err instanceof ApiError ? err.message : "Couldn't send the invite.", error: true });
    } finally {
      setSending(false);
    }
  }

  async function addBot(botName: string) {
    setAddingBot(false);
    setNote(null);
    try {
      onState(await api.addPlayer(league.id, botName, true));
    } catch (err) {
      setNote({ text: err instanceof ApiError ? err.message : "Couldn't add the computer player.", error: true });
    }
  }

  const when = draftAt
    ? `Get your people in before the draft, ${draftAt.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
    : hasDraft
      ? "Get your people in, then start the draft."
      : "Get your people in before the first episode.";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-caption text-[32px] leading-none">{league.name} is ready</h1>
        <p className="text-[15px] text-muted-foreground">{when}</p>
      </div>

      <CaptionPlate
        tone="quiet"
        tag={
          <>
            Join
            <br />
            code
          </>
        }
        title={<span className="text-[40px] leading-none tracking-[0.1em]">{league.joinCode}</span>}
        subtitle="Anyone with the code can join"
        className="min-h-[88px]"
        aria-label={`Join code ${league.joinCode}`}
      />

      <div className="flex gap-2.5">
        <PrimaryButton className="flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 text-base" onClick={share}>
          <Share className="size-5" strokeWidth={2.2} aria-hidden />
          Share invite
        </PrimaryButton>
        <PlainButton className="min-h-[52px] flex-1" onClick={copy} tour="invite-copy">
          {copied ? <Check className="size-[18px]" strokeWidth={2.4} aria-hidden /> : <Copy className="size-[18px]" strokeWidth={2.2} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </PlainButton>
      </div>

      {tour ? (
        <p className="-mt-2 text-sm text-muted-foreground">On the tour nothing is sent, and the code joins nothing.</p>
      ) : (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          invite();
        }}
      >
        <Field label="Or invite by username or email" htmlFor="nl-invite">
          <div className="flex gap-2">
            <input
              id="nl-invite"
              className={cn(fieldCls, "min-w-0 flex-1")}
              placeholder="name@example.com"
              autoComplete="off"
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <button
              type="submit"
              disabled={sending || !identifier.trim()}
              className="min-h-12 shrink-0 rounded-[3px] border border-input bg-card px-4 text-[15px] font-bold hover:bg-secondary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line disabled:opacity-40"
            >
              {sending ? "Sending…" : "Invite"}
            </button>
          </div>
        </Field>
      </form>
      )}

      {note && <p className={cn("-mt-2 text-sm", note.error ? "font-semibold text-live" : "text-muted-foreground")}>{note.text}</p>}

      <section className="flex flex-col gap-1.5">
        <h2 className="type-caption text-[24px] leading-none">Players</h2>
        <div className="mt-1.5 flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">
          {players.map((p, i) => (
            <div key={p.id} className="flex min-h-[52px] items-center gap-3">
              <span className="size-3 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
              <span className="text-[13px] text-muted-foreground">{i === 0 ? "You · commissioner" : p.automated ? "Computer" : ""}</span>
            </div>
          ))}
          {invites.map((inv) => (
            <div key={inv.id} className="flex min-h-[52px] items-center gap-3">
              <span className="size-3 shrink-0 rounded-[3px] border border-input" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base">{inv.identifier}</span>
              <Chip tone="quiet">Invited</Chip>
            </div>
          ))}
        </div>
        {!tour && (
          <PlainButton className="mt-2" onClick={() => setAddingBot(true)}>
            <Plus className="size-[18px]" strokeWidth={2.2} aria-hidden />
            Add a computer player
          </PlainButton>
        )}
      </section>

      {addingBot && (
        <TextSheet
          title="Add a computer player"
          label="Name"
          help="It drafts and plays on its own. You can hand its seat to a real person later, from League Settings."
          initial={`Computer ${bots + 1}`}
          submit="Add"
          onSubmit={addBot}
          onClose={() => setAddingBot(false)}
        />
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 shrink-0 items-center justify-center rounded-[3px] text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line disabled:opacity-40 [&_svg]:pointer-events-none"
    >
      {children}
    </button>
  );
}

// A show as a wide tile: its key art when an admin has set one, else a plain panel with the name.
function ShowTile({ show, selected, onSelect }: { show: CatalogShow; selected: boolean; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = publicMediaSrc(show.art_url);
  const art = !!src && !failed;
  const lead = leadSeason(show);
  const chip = lead ? `Season ${lead.seasonNumber}${lead.status === "airing" ? " airing" : lead.status === "upcoming" ? " soon" : ""}` : null;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full overflow-hidden rounded-[3px] px-3 text-left transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
        // Key art gets the canvas's 84px; a plain tile only needs room for the name.
        art ? "h-[84px] items-end bg-black pb-2.5 text-white" : "h-16 items-center",
        !art && (selected ? "bg-plate pl-12 text-plate-foreground" : "border border-input bg-card text-foreground"),
        selected && "outline-3 outline-offset-2 outline-chyron-line"
      )}
    >
      {art && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
          <img src={src!} alt="" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0)_70%)]" />
        </>
      )}
      {selected && (
        <span
          className={cn(
            "absolute left-2.5 flex size-[26px] items-center justify-center rounded-full bg-chyron text-chyron-foreground",
            art ? "top-2.5" : "top-1/2 -translate-y-1/2"
          )}
        >
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
      )}
      <span className="type-caption relative min-w-0 flex-1 truncate text-[26px] leading-none">{show.name}</span>
      {chip && (
        <span
          className={cn(
            "relative ml-2 shrink-0 rounded-[2px] px-2 py-0.5 text-xs font-bold",
            art ? "bg-[rgba(10,10,14,0.72)] text-white" : selected ? "bg-plate-foreground/10 text-plate-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {chip}
        </span>
      )}
    </button>
  );
}

// A selectable card: a white plate with a chyron outline when chosen, a quiet panel otherwise.
function OptionCard({
  selected,
  onClick,
  title,
  lead,
  detail,
  compact,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  lead?: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-[3px] px-4 py-3.5 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
        selected ? "bg-plate text-plate-foreground outline-3 outline-offset-2 outline-chyron-line" : "border border-input bg-card text-foreground hover:bg-secondary"
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className={cn("type-caption leading-none", compact ? "text-[22px]" : "text-[24px]")}>{title}</span>
        {selected && <Check className="size-[22px] shrink-0" strokeWidth={3} aria-hidden />}
      </span>
      {lead && <span className="text-[15px] font-semibold">{lead}</span>}
      {detail && <span className={cn("text-[13px] leading-snug", selected ? "text-plate-muted" : "text-muted-foreground")}>{detail}</span>}
    </button>
  );
}

// A radio choice as a 64px row; the native input stays for keyboard and screen readers.
function RadioCard({ name, checked, onChange, title, detail }: { name: string; checked: boolean; onChange: () => void; title: string; detail: string }) {
  return (
    <label
      className={cn(
        "flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[3px] border px-3.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-chyron-line",
        checked ? "border-chyron-line bg-card" : "border-input"
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full border-2", checked ? "border-chyron-line" : "border-muted-foreground")}
      >
        {checked && <span className="size-2.5 rounded-full bg-chyron-line" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function seasonDetail(s: Season, castaways: string) {
  const cast = s.castSize ? ` · ${s.castSize} ${castaways}` : "";
  if (s.status === "airing") return `Airing${cast}`;
  if (s.status === "upcoming") {
    const d = s.premiereDate ? new Date(s.premiereDate) : null;
    return d && !Number.isNaN(d.getTime()) ? `Starts ${d.toLocaleDateString([], { month: "short", day: "numeric" })}` : "Upcoming";
  }
  return `Finished${cast}`;
}

// The type cards' words. The type's own description is written for League Settings; these are the
// canvas's shorter pitch, in the show's terms.
function typeCopy(id: string, castaway: string, castaways: string): { lead: string; detail: string } {
  if (id === "active-roster")
    return {
      lead: "Draft a roster, start some each week.",
      detail: "Starters score for what they do that episode, by the show's own rules. Set your lineup before each episode airs.",
    };
  if (id === "pickem")
    return {
      lead: `No draft. Pick one ${castaway} a week.`,
      detail: `Pick someone you think survives the episode. No repeats until you've used every ${castaway} still in. Longest streak wins.`,
    };
  return {
    lead: "Draft a team. Last one standing wins.",
    detail: `Snake-draft your ${castaways}. They earn a point each time someone else goes home, so the longer they last, the more you get.`,
  };
}

function rosterLine(state: LeagueState, castaways: string) {
  const s = state.settings;
  if (StateLogic.getLeagueType(state).hasActiveRoster) return `${s.activeSlots} starters, ${s.benchSlots} bench`;
  return `Teams of ${StateLogic.rosterSize(state)} ${castaways}`;
}

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
