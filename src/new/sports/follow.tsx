"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { sportsApi, useCouchTeams, useCurrentCouch, useHome, useYourTeams, type YourFollows } from "../data";
import { Avatar } from "../ui/bars";
import { toast } from "../ui/toast";

// Following, in one look everywhere (docs/PLAN-sports-couch.md A3; the shape: docs/design-round/league-follow-shape.md): the team
// sheet's toggle, lifted here so a league's Follow (search's league row, the league's sheet) is the same control in the same words.
// A pill, never the yellow (it's a state, not the screen's action: the One Chyron Rule); Follow outlined, Following filled.

/** Follow / Following, 44 px tall and one width either way (the line beside it never jumps). `label` is what it follows, for the
 *  spoken name ("Follow the NFL"). Following is a quiet raised fill with a check, a state (the check: a filled foreground pill was
 *  the loudest thing on the sheet after the yellow); Follow an outline. */
export function FollowToggle({ on, onClick, label, disabled, data }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; data?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? "Following" : "Follow"} ${label}`}
      data-follow-toggle={data ?? ""}
      disabled={disabled}
      onClick={onClick}
      className={`nd-press inline-flex min-h-11 min-w-[7.5rem] flex-none items-center justify-center gap-1 rounded-full px-3.5 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-60 ${on ? "bg-secondary text-foreground" : "outline-1 -outline-offset-1 outline-edge"}`}
    >
      {on && <Check className="size-4 flex-none" strokeWidth={2.5} aria-hidden />}
      {on ? "Following" : "Follow"}
    </button>
  );
}

/** Up to three faces of who follows, yours first (the team sheet's stack). */
export function FollowFaces({ who }: { who: { id: string; name: string }[] }) {
  if (!who.length) return null;
  return (
    <span className="flex flex-none -space-x-1.5" aria-hidden>
      {who.slice(0, 3).map((f) => (
        <Avatar key={f.id} id={f.id} name={f.name} size={24} />
      ))}
    </span>
  );
}

/** "the NFL": a short caps name takes "the" ("the NFL", "the ZTCF"); a long one reads alone ("Premier League" too takes it). */
export const theLeague = (name: string) => (/^the /i.test(name) ? name : `the ${name}`);

/**
 * A league's follow, as you have it (the follows read), with its toggle: at once on screen, then as the server answers; a toast
 * saying what moved (what leaves your shows, what stays), and back as it was with the server's words when it's refused.
 * `playsHere`: a game of yours is in the league, so its card stays whatever the follow says.
 */
export function useLeagueFollow(league: string, leagueName: string, opts: { playsHere?: boolean } = {}) {
  const qc = useQueryClient();
  const mine = useYourTeams();
  const [busy, setBusy] = useState(false);
  const follows = mine.data;
  const on = !!follows?.leagues.includes(league);
  const teamsHere = (follows?.teams ?? []).filter((t) => t.league === league);
  const set = (next: YourFollows) => qc.setQueryData(["new-design", "your-teams"], next);
  const toggle = async () => {
    if (!follows || busy) return;
    const next = !on;
    const the = theLeague(leagueName);
    set({ ...follows, leagues: next ? [...follows.leagues, league] : follows.leagues.filter((l) => l !== league) });
    setBusy(true);
    try {
      set(await sportsApi.followLeague(league, next));
      await qc.invalidateQueries({ queryKey: ["new-design", "couch-teams"] });
      // One voice with the follow's toast: no closing full stop (the check).
      const stay = teamsHere.length === 1 ? `. The ${teamsHere[0].short} stay followed` : teamsHere.length > 1 ? `. Your ${teamsHere.length} teams there stay followed` : "";
      toast(next ? `Following ${the}: it's on your shows` : opts.playsHere ? `Unfollowed. Your game keeps ${the} on your shows` : `Unfollowed: ${the} leaves your shows${stay}`);
    } catch (e) {
      set(follows);
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { on, ready: !!follows, busy, toggle, teamsHere };
}

/** Following a team: yours (the couch's read, or your own without a couch), toggled with the old sheet's words. A team's page and
 *  search's card share it (docs/PLAN-sports-couch.md B2, B3). `names` once the team is known (its short name, its league's). */
export function useTeamFollow(league: string, team: string, names: { short: string; leagueName: string | null } | null) {
  const { data: home } = useHome();
  const couch = useCurrentCouch(home);
  const me = home?.user.id ?? "";
  const qc = useQueryClient();
  const couchTeams = useCouchTeams(couch?.id ?? null);
  const mine = useYourTeams();
  const [over, setOver] = useState<boolean | null>(null);
  const followers = couchTeams.data?.teams.find((t) => t.league === league && t.id === team)?.followers ?? [];
  const on = over ?? (couch ? followers.some((f) => f.id === me) : !!mine.data?.teams.some((t) => t.league === league && t.id === team));
  const short = names?.leagueName ?? league.split("/").pop()!.toUpperCase();
  const toggle = async () => {
    if (!names) return;
    const next = !on;
    // Following a team follows its league too: say so when that puts the league on your shows.
    const newLeague = next && !!mine.data && !mine.data.leagues.includes(league);
    setOver(next);
    try {
      qc.setQueryData(["new-design", "your-teams"], await sportsApi.follow(league, team, next));
      await qc.invalidateQueries({ queryKey: ["new-design", "couch-teams"] });
      toast(next ? (newLeague ? `Following the ${names.short}: ${theLeague(short)} is on your shows` : `Following the ${names.short}: their games lead your guide`) : `Unfollowed: their games leave your guide`);
    } catch (e) {
      setOver(!next);
      toast.quiet((e as Error).message);
    }
  };
  return { on, toggle, followers, couch, me, mine, short, ready: !!names && (couch ? couchTeams.isSuccess : mine.isSuccess) };
}
