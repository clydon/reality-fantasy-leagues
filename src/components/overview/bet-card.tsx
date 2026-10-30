"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Bet, Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { isBetSettled } from "@/lib/game/selectors";
import { useLeagueStore, useCanManage, useCanGuess, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { MoreButton, fieldCls } from "@/components/setup/settings-ui";
import { ActButton } from "@/components/ui/act-ui";
import { GuessLine, QuestionLine } from "@/components/predictions/prediction-ui";

// One open prediction on Overview (renderBetCard() in public/app.js, restyled for direction A): the
// question as a row, everyone's guess under it, and your own guess field while you haven't made one.
// Its ⋯ sheet: the commissioner's way to the episode page to grade it, and Remove (the commissioner,
// or whoever asked it until a second guess is in).
export function BetCard({ ep, bet, state }: { ep: Episode; bet: Bet; state: LeagueState }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const [guess, setGuess] = useState("");
  const canManage = useCanManage();
  const canGuessBets = useCanGuess();
  const myPlayerId = useMyPlayerId();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();

  const guesses = bet.predictions || [];
  const mine = myPlayerId ? guesses.find((p) => p.playerId === myPlayerId) : null;
  // A guess locks when the episode starts, as a lineup does (BetLogic.closed, step A4).
  const canGuessThis = canGuessBets && !mine && !StateLogic.BetLogic.closed(ep);
  const isCreator = !!myPlayerId && bet.createdByPlayerId === myPlayerId;
  const canDelete = canManage || (isCreator && guesses.length < 2);
  const needsOneMore = guesses.length === 1 && !isBetSettled(bet);
  const trimmed = guess.trim();

  async function submitGuess() {
    if (!trimmed || !myPlayerId) return;
    const playerId = myPlayerId;
    await mutate(
      (s) => StateLogic.addBetPrediction(s, ep.id, bet.id, playerId, trimmed),
      () => api.addBetPrediction(leagueId!, ep.id, bet.id, playerId, trimmed)
    );
    setGuess("");
  }

  async function handleDelete() {
    setMenuOpen(false);
    await mutate(
      (s) => StateLogic.removeBet(s, ep.id, bet.id),
      () => api.removeBet(leagueId!, ep.id, bet.id)
    );
  }

  return (
    <li className="flex flex-col gap-1.5 py-3">
      <QuestionLine
        bet={bet}
        ep={ep}
        state={state}
        showEpisode
        action={canDelete ? <MoreButton label="Prediction actions" onClick={() => setMenuOpen(true)} className="-my-1.5 -mr-2" /> : undefined}
      />
      {guesses.length > 0 && (
        <ul className="flex flex-col">
          {guesses.map((p) => (
            // Grading is on the episode's page (the ⋯ sheet goes there): here a guess shows how it went
            // once graded, and nothing before -- an open question has nothing to grade yet.
            <GuessLine key={p.id} state={state} pred={p} bet={bet} showPending={false} />
          ))}
        </ul>
      )}
      {needsOneMore && <p className="text-[13px] text-muted-foreground">One more guess and it pays out.</p>}
      {canGuessThis && (
        <form
          data-tour="bet-guess"
          className="mt-1 flex gap-2 sm:max-w-[480px]"
          onSubmit={(e) => {
            e.preventDefault();
            submitGuess();
          }}
        >
          <input
            className={`${fieldCls} min-h-11 min-w-0 flex-1`}
            aria-label={`Your guess: ${bet.label}`}
            placeholder="Your guess"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
          />
          {/* Chyron only once there's something to send: a page of open questions isn't a page of yellow. */}
          <ActButton type="submit" tone={trimmed ? "chyron" : "plain"} disabled={!trimmed}>
            Guess
          </ActButton>
        </form>
      )}
      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Prediction" description={canManage ? undefined : "Until a second person guesses"}>
        {canManage && guesses.length > 0 && (
          <SheetAction onClick={() => router.push(`/episodes/${ep.number}`)} detail={`Episode ${ep.number}`}>
            Grade guesses
          </SheetAction>
        )}
        {canDelete && (
          <SheetAction danger onClick={handleDelete}>
            Remove prediction
          </SheetAction>
        )}
      </BottomSheet>
    </li>
  );
}
