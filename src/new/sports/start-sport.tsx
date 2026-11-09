"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useHome, useCurrentCouch, useLeagueSlates, useSportRail, useTeamSchedule, type RailGame } from "../data";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { begun, clockOf, dayOf } from "./scores";
import { useStartSport } from "./start";
import type { StartWhen } from "./team";
import { versus } from "./team";

// Start a game on a team (docs/PLAN-start-a-game-gpt.md U1's sports slice; U0's board "Start a game on a team": B, settled, in a
// sport's words). When it runs is the team's own games: Next game, Rest of season, Against a rival (their meetings), or Pick games
// (tap the first, then the last, like dates). Start from is the sport's standard games that fit (the server's rail: Pick'em,
// Pick a few, a draft, Squares, Best Ball), each in the engine's own words; the white card names the one picked with its line and
// How it plays. The quick changes stay dashed, "Coming for sports", until the engine rolls a sport's games (the board's note).
// Start it adds the games and starts it (start.ts), the couch told after a 10-second Undo; yellow is Start it alone.

type Mode = "next" | "season" | "rival" | "pick" | "week";

/** What a game starts on: a team's games (from its sheet), a league's slate (its sheet), or a sport's season on the couch. */
export type SportTarget =
  | { kind: "team"; league: string; team: string; teamName: string; when: StartWhen }
  | { kind: "slate"; league: string; leagueName: string }
  | { kind: "season"; seasonId: string; league: string; label: string; starts: { number: number; title: string | null; airAt: string | null }[] };

const MODES: Record<SportTarget["kind"], [Mode, string][]> = {
  team: [
    ["next", "Next game"],
    ["season", "Rest of season"],
    ["rival", "Against a rival"],
    ["pick", "Pick games"],
  ],
  slate: [
    ["week", "This week"],
    ["season", "The season"],
  ],
  season: [
    ["next", "Next game"],
    ["season", "Every game left"],
  ],
};

const Label = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="mb-2 mt-5 flex items-baseline justify-between gap-3 first:mt-1">
    <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{children}</span>
    {aside}
  </div>
);

export function SportStartSheet({
  target,
  onOpenChange,
  onBack,
}: {
  target: SportTarget | null;
  onOpenChange: (o: boolean) => void;
  onBack?: () => void;
}) {
  const { data: home } = useHome();
  const couch = useCurrentCouch(home);
  const team = target?.kind === "team" ? target : null;
  const sched = useTeamSchedule(team?.league ?? null, team?.team ?? null);
  const slates = useLeagueSlates(target?.kind === "slate" ? target.league : null);
  const s = sched.data;
  const when = team?.when;
  const initial: Mode =
    target?.kind === "slate" ? "week" : !when ? "next" : when.kind === "season" ? "season" : when.kind === "meetings" ? "rival" : when.kind === "games" ? "pick" : "next";
  const [mode, setMode] = useState<Mode>(initial);
  const [against, setAgainst] = useState<string | null>(when?.kind === "meetings" ? when.against : null);
  const [picked, setPicked] = useState<string[]>(when?.kind === "games" ? when.games : []);
  const [first, setFirst] = useState<string | null>(null);
  const [game, setGame] = useState("pickem");
  const [tell, setTell] = useState(true);
  const [rules, setRules] = useState(false);
  const { start, busy } = useStartSport();
  const now = Date.now();

  const coming = useMemo(() => (s ? s.games.filter((g) => !g.calledOff && !begun(g, now)) : []), [s, now]);
  const rivals = useMemo(() => {
    const m = new Map<string, { id: string; short: string; n: number }>();
    for (const g of coming) if (g.opponent) m.set(g.opponent.id, { id: g.opponent.id, short: g.opponent.short, n: (m.get(g.opponent.id)?.n ?? 0) + 1 });
    return [...m.values()];
  }, [coming]);
  // The games it runs over, as picked.
  const games =
    mode === "next"
      ? coming.slice(0, 1)
      : mode === "season"
        ? coming.filter((g) => g.stage !== "pre" && g.stage !== "post")
        : mode === "rival"
          ? coming.filter((g) => g.opponent?.id === against)
          : coming.filter((g) => picked.includes(g.id));
  // A slate's season: its usual cut's episodes; a season here: its games still to start.
  const usual = slates.data?.stages.flatMap((st) => st.slates).find((x) => x.usual && x.stage === slates.data?.usual?.stage);
  const count =
    target?.kind === "team" ? games.length : target?.kind === "slate" ? (mode === "week" ? 1 : (usual?.episodes ?? 1)) : target?.kind === "season" ? (mode === "next" ? 1 : target.starts.length) : 0;
  const rail = useSportRail(target?.league ?? null, Math.max(1, count), target?.kind === "slate");
  const list = rail.data?.games ?? [];
  const chosen: RailGame | undefined = list.find((g) => g.id === game && !g.why) ?? list.find((g) => !g.why);

  const firstStart = target?.kind === "season" ? target.starts[0] : null;
  const readout =
    target?.kind === "slate"
      ? mode === "week"
        ? `${slates.data?.leagueName ?? target.leagueName}: this week's games`
        : (usual?.name ?? `${target.leagueName}, week by week`)
      : target?.kind === "season"
        ? mode === "next"
          ? `${firstStart?.airAt ? `${dayOf(firstStart.airAt)} ${clockOf(firstStart.airAt)}` : ""} ${firstStart?.title ?? ""}`.trim()
          : target.label
        : games.length === 0
      ? mode === "rival" && !against
        ? "Pick a rival"
        : mode === "pick"
          ? "Tap the first game, then the last"
          : "No games coming up"
      : games.length === 1
        ? `${games[0].at ? `${dayOf(games[0].at)} ${clockOf(games[0].at)}` : "Time to be set"} ${versus(games[0])}`
        : `${games[0].at ? dayOf(games[0].at) : ""} – ${games[games.length - 1].at ? dayOf(games[games.length - 1].at!) : ""}`;
  const nTag =
    target?.kind === "slate" ? (mode === "week" ? "1 week" : usual?.episodes ? `${usual.episodes} wks` : "Season") : count === 1 ? "1 game" : `${count} games`;
  const at0 = target?.kind === "team" ? games[0]?.at : target?.kind === "season" ? firstStart?.airAt : null;
  const kickoff = at0 ? `${dayOf(at0)} ${clockOf(at0)}` : "the first game";
  const nextLine = chosen
    ? chosen.spec.get && (chosen.spec.get as { by?: string }).by === "draft"
      ? `Next: everyone drafts before ${kickoff}`
      : chosen.id === "squares"
        ? `Next: everyone takes squares before ${kickoff}`
        : `Next: everyone picks before ${kickoff}`
    : "";

  const tapGame = (id: string) => {
    if (!first) {
      setFirst(id);
      setPicked([id]);
      return;
    }
    const a = coming.findIndex((g) => g.id === first);
    const b = coming.findIndex((g) => g.id === id);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    setPicked(coming.slice(lo, hi + 1).map((g) => g.id));
    setFirst(null);
  };

  const ready = target?.kind === "team" ? games.length > 0 : target?.kind === "season" ? target.starts.length > 0 : !!target;
  const go = () => {
    if (!target || !chosen || !ready) return;
    const close = () => onOpenChange(false);
    if (target.kind === "slate") return void start({ league: target.league, slate: {}, game: chosen.id, tell, only: mode === "week" }, close);
    if (target.kind === "season") return void start({ seasonId: target.seasonId, game: chosen.id, tell, only: mode === "next" }, close);
    const where =
      mode === "season" ? { whole: "season" as const } : mode === "rival" && against ? { whole: "meetings" as const, against } : { games: games.map((g) => g.id) };
    void start({ league: target.league, team: target.team, game: chosen.id, tell, ...where }, close);
  };

  const foot = (
    <div data-start-foot className="flex flex-col gap-1">
      <p className="type-caption truncate text-[17px]">{chosen ? chosen.name : ""}</p>
      <p className="mb-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{nextLine}</p>
      <Btn tone="must" wide data-start-go className="type-caption text-[22px]" disabled={busy || !chosen || !ready} onClick={go}>
        {busy ? "Starting…" : "Start it"}
      </Btn>
    </div>
  );

  return (
    <Sheet
      open={!!target}
      onOpenChange={onOpenChange}
      title="Start a game"
      subtitle={target ? `${target.kind === "team" ? (s?.team.name ?? target.teamName) : target.kind === "slate" ? target.leagueName : target.label}${couch ? ` · ${couch.name}` : ""}` : undefined}
      back={onBack ? { label: `Back to ${target?.kind === "team" ? `the ${target.teamName}` : target?.kind === "slate" ? target.leagueName : "the season"}`, onClick: onBack } : undefined}
      foot={foot}
    >
      <div data-sport-start className="pb-4">
        {target?.kind === "team" && !s ? (
          <p className="text-[14px] text-muted-foreground">{sched.error ? "Couldn't load their games. Try again in a minute." : "Loading their games…"}</p>
        ) : (
          <>
            <Label>When it runs</Label>
            <div role="radiogroup" aria-label="When it runs" className="grid grid-cols-2 gap-[3px] rounded-[4px] bg-background p-[3px]">
              {MODES[target?.kind ?? "team"].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  data-sport-mode={id}
                  onClick={() => setMode(id)}
                  className={`h-11 rounded-[3px] text-[15px] font-semibold ${mode === id ? "bg-foreground text-background" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div data-start-readout className="mt-2.5 flex h-10 overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
              <span className="tag-cut type-caption grid flex-none place-items-center bg-quiet-tag pl-2.5 pr-5 text-[14px] tracking-[0.04em] text-quiet-tag-foreground">{nTag}</span>
              <span className="tag-tuck type-caption flex min-w-0 flex-1 items-center truncate pl-5 pr-3 text-[17px]">{readout}</span>
            </div>
            {mode === "rival" && (
              <div className="mt-2.5 flex flex-wrap gap-1.5" data-sport-rivals>
                {rivals.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={against === r.id}
                    onClick={() => setAgainst(r.id)}
                    className={`nd-press min-h-11 rounded-[4px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 ${against === r.id ? "bg-foreground text-background outline-foreground" : "outline-edge"}`}
                  >
                    {r.short} <span className="font-normal opacity-80">· {r.n}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === "pick" && (
              <div className="mt-2" data-sport-pick>
                <p className="text-[13px] text-muted-foreground">{first ? "Now tap the last game, or the same one again for just that one." : "Tap the first game, then the last."}</p>
                <div className="mt-1 max-h-[260px] overflow-y-auto">
                  {coming.map((g) => {
                    const on = picked.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={on}
                        data-pick-game={g.id}
                        onClick={() => tapGame(g.id)}
                        className="nd-press flex min-h-12 w-full items-center gap-3 border-b border-border text-left"
                      >
                        <span className={`grid size-5 flex-none place-items-center rounded-[3px] outline-1 -outline-offset-1 ${on ? "bg-foreground text-background outline-foreground" : "outline-edge"}`}>
                          {on && <Check className="size-3.5" aria-hidden />}
                        </span>
                        <span className="w-[92px] flex-none text-[13px] font-bold">{g.at ? dayOf(g.at) : "To be set"}</span>
                        <span className="min-w-0 flex-1 truncate text-[15px]">{versus(g)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Label>Start from</Label>
            <div role="group" aria-label="Start from" className="-mx-4 flex snap-x snap-proximity scroll-pl-4 gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none]">
              {list.map((x) => {
                const on = chosen?.id === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={on}
                    aria-disabled={!!x.why}
                    data-sport-game={x.id}
                    onClick={() => !x.why && setGame(x.id)}
                    className={`flex min-h-[88px] w-[152px] flex-none snap-start flex-col items-start gap-[5px] rounded-[4px] border p-2.5 text-left ${on ? "border-foreground bg-foreground text-background" : x.why ? "border-dashed border-input text-muted-foreground" : "border-input text-foreground"}`}
                  >
                    <span className="line-clamp-2 text-[15px] font-bold leading-tight">{x.name}</span>
                    <span className={`line-clamp-3 text-[13px] leading-snug ${on ? "text-background/70" : "text-muted-foreground"}`}>{x.why ?? x.sub}</span>
                  </button>
                );
              })}
            </div>

            {chosen && (
              <div data-start-card className="mt-3 rounded-[3px] bg-plate px-3 pb-3 pt-3.5 text-plate-foreground shadow-plate">
                <span className="type-caption text-[24px] leading-none" data-start-name>
                  {chosen.name}
                </span>
                <p className="mt-1.5 text-[14px] leading-snug">{chosen.about}</p>
                <p className="mt-1 text-[13px] leading-snug text-plate-muted">{chosen.line}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5" aria-label="Quick changes, coming for sports">
                  {["More competitive", "More casual", "Different scoring", "Surprise me"].map((q) => (
                    <span key={q} aria-disabled className="flex min-h-11 items-center rounded-[4px] border border-dashed border-plate-muted/50 px-2 text-[13px] font-semibold text-plate-muted">
                      {q}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-plate-muted">Coming for sports, once our engine can roll a sport&rsquo;s games.</p>
                <button type="button" aria-expanded={rules} onClick={() => setRules(!rules)} className="type-caption mt-2.5 text-[13px] tracking-[0.05em] underline underline-offset-[3px]" data-start-rules>
                  How it plays
                </button>
                {rules && (
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13.5px] leading-snug">
                    {chosen.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Label>The couch</Label>
            <button
              type="button"
              role="switch"
              aria-checked={tell}
              data-start-tell={tell ? "on" : "off"}
              onClick={() => setTell(!tell)}
              className="flex min-h-[60px] w-full items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">Tell the couch</span>
                <span className="block text-[13px] leading-snug text-muted-foreground">One alert when it starts, with a way to join, after a 10-second Undo</span>
              </span>
              <span className={`relative h-7 w-12 flex-none rounded-full transition-colors ${tell ? "bg-foreground" : "outline-1 -outline-offset-1 outline-edge"}`}>
                <span className={`absolute top-1 size-5 rounded-full transition-[left] ${tell ? "left-6 bg-background" : "left-1 bg-muted-foreground"}`} />
              </span>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
