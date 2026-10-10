"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { Button } from "@/components/ui/button";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { CaptionPlate, colourTag } from "@/components/ui/caption-plate";
import { useHiddenResults } from "@/components/results-in-banner";
import { castawayPhotoSrc, isKnockedOut } from "@/lib/game/selectors";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { finishedPlace, ordinal } from "@/components/scoreboard/scoreboard-tab";
import { bootOrderThrough, episodeBanks, predictionsRight } from "@/lib/game/classic-view";
import { episodePicks } from "@/lib/game/pool-view";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";
import { EpisodeBetRow } from "./episode-bet-row";
import { ProposePrediction } from "./propose-prediction";
import { EpisodeActiveRosterSection } from "./episode-active-roster-section";
import { EpisodeChanges, EpisodeRecap } from "./episode-recap";
import { EpisodeEditor } from "./episode-editor";
import { airsInLabel, episodeDate, episodeExits, episodeStatus, hiddenBefore, ownersLine, useNowMinute } from "./episode-status";

// One episode's own page, /episodes/N (docs/PLAN-ux-redesign.md, 2e; the canvas's "Episode 3 reveal"
// boards). Opens on what happened -- who went home as caption plates, the episode's wins, any role or
// tribe changes, predictions, lineups -- and a commissioner's editing sits behind ⋯ → Edit results.
// Results the viewer hasn't revealed stay behind the reveal, as everywhere else.
export function EpisodeDetail({ number }: { number: number }) {
  const state = useLeagueStore((s) => s.state);
  const ep = state.episodes.find((e) => e.number === number);
  if (!ep) {
    return (
      <div className="flex flex-col items-start gap-3">
        <BackLink />
        <p className="text-base text-muted-foreground">There&rsquo;s no episode {number} in this league.</p>
      </div>
    );
  }
  // Keyed by id so switching league (or renumbering) starts the page fresh, out of edit mode.
  return <EpisodeView key={ep.id} ep={ep} state={state} />;
}

function EpisodeView({ ep, state }: { ep: Episode; state: LeagueState }) {
  const router = useRouter();
  const canManage = useCanManage();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const { reveal } = useHiddenResults();
  const mutate = useMutate();
  const now = useNowMinute();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const status = episodeStatus(ep, now);
  const blockedBy = hiddenBefore(state, ep);
  const shut = status.kind === "hidden" || blockedBy !== null;
  const inPlay = StateLogic.inPlay(state, ep.number);
  const format = StateLogic.formatOf(state);
  const date = episodeDate(ep, status.kind === "upcoming");

  async function handleDelete() {
    setMenuOpen(false);
    if (
      !(await confirm("Delete this episode and everything recorded for it? Placements from it will be undone.", {
        danger: true,
        confirmLabel: "Delete",
      }))
    )
      return;
    await mutate(
      (s) => StateLogic.removeEpisode(s, ep.id),
      () => api.removeEpisode(leagueId!, ep.id)
    );
    router.replace("/episodes");
  }

  const meta = [date, ep.title].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink className="max-nav:hidden" />
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 className="type-caption text-[28px] max-nav:hidden">Episode {ep.number}</h2>
            {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
            {(!inPlay || (format.hasMerge && ep.postMerge)) && (
              <div className="flex flex-wrap gap-1.5">
                {!inPlay && <Chip>Before this league started · not scored</Chip>}
                {format.hasMerge && ep.postMerge && <Chip>Post-merge</Chip>}
              </div>
            )}
          </div>
          {canManage && !shut && !editing && (
            <button
              type="button"
              aria-label="Episode actions"
              className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-border text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line"
              onClick={() => setMenuOpen(true)}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {status.kind === "hidden" && blockedBy === null ? (
        <CaptionPlate
          tag={`Ep ${ep.number}`}
          title={`Episode ${ep.number} is in`}
          subtitle="Hidden until you're ready."
          action="Reveal"
          onClick={() => reveal(ep.number)}
        />
      ) : blockedBy !== null ? (
        <CaptionPlate
          tone="quiet"
          tag="First"
          title={`Reveal episode ${blockedBy}`}
          subtitle={`Episode ${ep.number} stays shut until you've seen episode ${blockedBy}.`}
          action="Open"
          href={`/episodes/${blockedBy}`}
        />
      ) : editing ? (
        <EpisodeEditor ep={ep} state={state} onDone={() => setEditing(false)} />
      ) : (
        <ReadView ep={ep} state={state} status={status.kind} now={now} onEdit={canManage ? () => setEditing(true) : undefined} />
      )}

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title={`Episode ${ep.number}`}>
        <SheetAction
          onClick={() => {
            setMenuOpen(false);
            setEditing(true);
          }}
        >
          Edit results
        </SheetAction>
        <SheetAction danger onClick={handleDelete}>
          Delete episode
        </SheetAction>
      </BottomSheet>
    </div>
  );
}

function ReadView({
  ep,
  state,
  status,
  now,
  onEdit,
}: {
  ep: Episode;
  state: LeagueState;
  status: "scored" | "upcoming" | "waiting" | "hidden";
  now: number | null;
  onEdit?: () => void;
}) {
  const me = useMyPlayerId();
  const exits = episodeExits(state, ep);
  const inPlay = StateLogic.inPlay(state, ep.number);
  const type = StateLogic.getLeagueType(state);
  const hasBets = state.settings.bonusEnabled && (ep.bets || []).length > 0;
  // New predictions go on the episode about to be played (the one the server adds them to), until it
  // has results -- the same window Overview's old "Propose a Prediction" box had.
  const canPropose =
    state.settings.bonusEnabled && !!me && (status === "upcoming" || status === "waiting") && StateLogic.currentEpisode(state)?.id === ep.id;
  // Classic scores by boot order (the canvas's Classic "Episode 3" board): where each one finished,
  // who banked it, and the boot order so far.
  const classic = type.hasRoster && !type.hasActiveRoster;
  const banks = classic && inPlay ? episodeBanks(state, ep) : [];
  const called = predictionsRight(state, ep, me);
  // Eliminator Pool (the canvas's Pool "Episode 3" board): how your pick did, then everyone's.
  const pool = !!type.hasWeeklyPicks && inPlay;
  // When your pick is who went home, the card above already says so: no second plate for them.
  const myPickOut = pool && me ? (ep.picks || []).find((p) => p.playerId === me)?.castawayId : undefined;
  const exitPlates = exits.filter(({ c }) => c.id !== myPickOut);

  return (
    <>
      {status !== "scored" ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-base text-muted-foreground">
            {status === "upcoming" && ep.airsAt && now !== null
              ? `${airsInLabel(Date.parse(ep.airsAt), now)}. Results show up here once it has.`
              : "Nothing recorded for this episode yet."}
          </p>
          {onEdit && status !== "upcoming" && (
            <Button className="max-nav:min-h-11" onClick={onEdit}>
              Enter results
            </Button>
          )}
        </div>
      ) : (
        <>
          {pool && <YourPickResult state={state} ep={ep} />}
          {exitPlates.length > 0 && (
            <div className="flex flex-col gap-3">
              {exitPlates.map(({ ev, c }) => (
                <CaptionPlate
                  key={c.id}
                  tone="live"
                  tag="Out"
                  image={castawayPhotoSrc(c.photoUrl) ?? undefined}
                  title={c.name}
                  subtitle={[
                    ev.method,
                    typeof ev.juryVotes === "number" && `${ev.juryVotes} jury vote${ev.juryVotes === 1 ? "" : "s"}`,
                    classic ? finishedPlace(state, c) && `finished ${ordinal(finishedPlace(state, c)!)}` : ownersLine(state, c),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </div>
          )}
          {(banks.length > 0 || called.right.length > 0) && (
            <div className="flex flex-col gap-3">
              {/* Each owner's points, the tag in their own colour (a tag, never a fill). */}
              {banks.map(({ player, castaway, points }) => (
                <CaptionPlate
                  key={`${player.id}-${castaway.id}`}
                  size="sm"
                  tag={`+${points}`}
                  tagStyle={colourTag(player.color)}
                  title={player.id === me ? `You bank ${points}` : `${player.name} banks ${points}`}
                  subtitle={`${castaway.name.split(" ")[0]} was on ${player.id === me ? "your" : "their"} team`}
                />
              ))}
              {called.right.length > 0 && (
                <CaptionPlate
                  size="sm"
                  tone="good"
                  tag="Called it"
                  title={called.right.length === 1 ? "Your prediction was right" : `${called.right.length} predictions right`}
                  subtitle={
                    called.right.length === 1 ? `${called.right[0].label} · +${called.points}` : `+${called.points} from predictions`
                  }
                />
              )}
            </div>
          )}
          {classic && inPlay && <BootOrder state={state} ep={ep} />}
          {pool && <EveryonesPicks state={state} ep={ep} />}
          <Section title="What happened">
            <EpisodeRecap ep={ep} state={state} showExits={false} />
            <EpisodeChanges ep={ep} state={state} />
          </Section>
        </>
      )}

      {/* Predictions are guessed on Overview (bet-card.tsx) and proposed here, on the upcoming episode --
          here it's also how they went, plus the commissioner's grading and editing in each one's ⋯ sheet. */}
      {(hasBets || canPropose) && (
        <Section title="Predictions">
          {hasBets && (
            <div className="divide-y divide-border border-y border-border">
              {(ep.bets || []).map((bet) => (
                <EpisodeBetRow key={bet.id} ep={ep} bet={bet} state={state} />
              ))}
            </div>
          )}
          {canPropose && <ProposePrediction state={state} />}
        </Section>
      )}

      {/* Before the league's start episode there's nothing to field -- it's history. Eliminator Pool
          picks are made on the Pick page (pick/pick-page.tsx), never here. */}
      {inPlay && type.hasActiveRoster && <EpisodeActiveRosterSection ep={ep} state={state} />}
    </>
  );
}

// Everyone out so far, first out first, each with where they finished; then how many are still in
// and how many of those are yours.
function BootOrder({ state, ep }: { state: LeagueState; ep: Episode }) {
  const me = useMyPlayerId();
  const terms = useShowTerms();
  const out = bootOrderThrough(state, ep.number);
  if (out.length === 0) return null;
  const outIds = new Set(out.map((c) => c.id));
  const stillIn = state.castaways.filter((c) => !outIds.has(c.id));
  const mine = me ? stillIn.filter((c) => c.ownerIds.includes(me)).length : 0;
  const myTeam = me ? state.castaways.filter((c) => c.ownerIds.includes(me)).length : 0;
  let yours: string | null = null;
  if (myTeam > 0 && mine === 0) yours = "none of them yours";
  else if (myTeam > 0 && mine < myTeam) yours = `${mine} of yours among them`;
  else if (myTeam > 0) yours = myTeam === 1 ? "yours among them" : myTeam === 2 ? "both of yours among them" : `all ${mine} of yours among them`;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="section-title">Boot order</h3>
      <ol className="flex flex-wrap gap-x-2 gap-y-3">
        {out.map((c) => {
          const place = finishedPlace(state, c);
          const thisEp = c.exitEpisodeId === ep.id;
          return (
            <li key={c.id} className="flex w-[52px] flex-col items-center gap-1">
              <CastawayAvatar
                castaway={c}
                className={cn(
                  "flex size-[52px] items-center justify-center rounded-[2px] bg-secondary text-xs font-bold text-muted-foreground [&_img]:object-top",
                  isKnockedOut(state, c) && "grayscale brightness-[.6]",
                  thisEp && "outline-2 outline-offset-1 outline-live",
                )}
              />
              <span className={cn("type-num text-[17px] leading-none", isKnockedOut(state, c) ? "text-live" : "text-good")}>
                {place ? ordinal(place) : "Out"}
              </span>
              <span className="w-full truncate text-center text-[11px] leading-tight text-muted-foreground">{c.name.split(" ")[0]}</span>
            </li>
          );
        })}
      </ol>
      <p className="flex items-baseline gap-2 text-[13px] text-muted-foreground">
        <span className="type-num text-[28px] leading-none text-foreground">{stillIn.length}</span>
        <span>
          {terms.castaways} still in{yours ? `, ${yours}` : ""}
        </span>
      </p>
    </section>
  );
}

// Your pick for a decided episode: the photo full width with how it went on a caption across its foot
// (the reveal's vote-out card, in good or live tone), and the streak it leaves you on.
function YourPickResult({ state, ep }: { state: LeagueState; ep: Episode }) {
  const me = useMyPlayerId();
  const mine = episodePicks(state, ep).find((r) => r.player.id === me);
  if (!mine) return null;
  const { castaway: c, correct, streak, ended } = mine;
  if (!c) {
    return (
      <CaptionPlate
        tone="quiet"
        tag="No pick"
        title="You didn't pick"
        subtitle={ended > 0 ? `Your streak ends at ${ended}` : "No streak this week"}
      />
    );
  }
  const photo = castawayPhotoSrc(c.photoUrl);
  const caption = (
    <>
      <span
        className={cn(
          "type-caption px-3 py-[3px] text-[15px] tracking-[0.05em]",
          correct ? "bg-good text-good-foreground" : "bg-live text-live-foreground",
        )}
      >
        {correct ? "Your pick survived" : "Your pick went home"}
      </span>
      <span className="flex max-w-full flex-col gap-[3px] bg-plate py-2 pl-3 pr-3.5 text-plate-foreground shadow-plate">
        <span className="type-caption text-[30px] font-black leading-[0.95]">{c.name}</span>
        <span className="text-[13px] text-plate-muted">
          {correct ? `Your streak is now ${streak}` : ended > 0 ? `Your streak ends at ${ended}` : "Back to zero"}
        </span>
      </span>
    </>
  );
  if (!photo) return <div className="flex flex-col items-start">{caption}</div>;
  return (
    <figure className="relative m-0 h-[230px] overflow-hidden rounded-[3px] bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- cast photos are plain files under /photos, any size */}
      <img src={photo} alt="" className={cn("size-full object-cover [object-position:center_15%]", !correct && "grayscale")} />
      <figcaption className="absolute bottom-3.5 left-0 right-7 flex flex-col items-start">{caption}</figcaption>
    </figure>
  );
}

// Everyone else's pick for the episode: who they went with, the streak it left them on (or the one
// it ended), and Safe or Out.
function EveryonesPicks({ state, ep }: { state: LeagueState; ep: Episode }) {
  const me = useMyPlayerId();
  const rows = episodePicks(state, ep).filter((r) => r.player.id !== me);
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="section-title">{me ? "Everyone else's picks" : "Everyone's picks"}</h3>
      <div className="flex flex-col border-b border-border">
        {rows.map(({ player, castaway: c, correct, streak, ended }) => (
          <div key={player.id} className="flex min-h-16 items-center gap-3 border-t border-border py-2">
            {c ? (
              <CastawayAvatar
                castaway={c}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-[11px] font-bold text-muted-foreground [&_img]:object-top",
                  !correct && "grayscale brightness-[.6]",
                )}
              />
            ) : (
              <span className="size-11 shrink-0 rounded-[2px] border-2 border-dashed border-border" aria-hidden />
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-base font-semibold">
                {player.name}{" "}
                <span className="font-normal text-muted-foreground">{c ? `picked ${c.name.split(" ")[0]}` : "didn't pick"}</span>
              </span>
              <span className="text-[13px] text-muted-foreground">
                {correct ? `Streak ${streak}` : ended > 0 ? `Streak ends at ${ended}` : "No streak"}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-[2px] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide",
                correct ? "bg-good text-good-foreground" : c ? "bg-live text-live-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {correct ? "Safe" : c ? "Out" : "Missed"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Hides itself when it has nothing to show (e.g. an episode with exits but no wins or changes).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 empty:hidden [&:not(:has(>div>*))]:hidden">
      <h3 className="section-title">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[2px] bg-muted px-1.5 py-0.5 text-[12px] font-semibold text-muted-foreground">{children}</span>;
}

function BackLink({ className }: { className?: string }) {
  return (
    <Link
      href="/episodes"
      className={`-ml-1 inline-flex min-h-11 items-center gap-0.5 self-start pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground ${className ?? ""}`}
    >
      <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden />
      Episodes
    </Link>
  );
}
