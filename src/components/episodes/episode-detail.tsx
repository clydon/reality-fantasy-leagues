"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { Button } from "@/components/ui/button";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { EpisodeBetRow } from "./episode-bet-row";
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
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
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
              className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-border text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron"
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
          subtitle="Watched it? Results stay hidden until you say so."
          action="Reveal"
          onClick={() => markResultsSeen(ep.number)}
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
  const exits = episodeExits(state, ep);
  const inPlay = StateLogic.inPlay(state, ep.number);
  const type = StateLogic.getLeagueType(state);
  const hasBets = state.settings.bonusEnabled && (ep.bets || []).length > 0;

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
          {exits.length > 0 && (
            <div className="flex flex-col gap-3">
              {exits.map(({ ev, c }) => (
                <CaptionPlate
                  key={c.id}
                  tone="live"
                  tag="Out"
                  image={castawayPhotoSrc(c.photoUrl) ?? undefined}
                  title={c.name}
                  subtitle={[
                    ev.method,
                    typeof ev.juryVotes === "number" && `${ev.juryVotes} jury vote${ev.juryVotes === 1 ? "" : "s"}`,
                    ownersLine(state, c),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </div>
          )}
          <Section title="What happened">
            <EpisodeRecap ep={ep} state={state} showExits={false} />
            <EpisodeChanges ep={ep} state={state} />
          </Section>
        </>
      )}

      {/* Side bets are proposed and guessed on Overview (bet-card.tsx) -- here it's how they went,
          plus the commissioner's grading and editing behind each bet's ✏️. */}
      {hasBets && (
        <Section title="Predictions">
          <div className="divide-y divide-border border-y border-border">
            {(ep.bets || []).map((bet) => (
              <EpisodeBetRow key={bet.id} ep={ep} bet={bet} state={state} />
            ))}
          </div>
        </Section>
      )}

      {/* Before the league's start episode there's nothing to field -- it's history. Eliminator Pool
          picks are made on Overview only (see pickem-pick-grid.tsx), never here. */}
      {inPlay && type.hasActiveRoster && <EpisodeActiveRosterSection ep={ep} state={state} />}
    </>
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
