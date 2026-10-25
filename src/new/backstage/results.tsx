"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CircleQuestionMark, EyeOff, ListChecks, PenLine, Sparkles, UsersRound, Zap } from "lucide-react";
import { airTime, timeOf } from "../clock";
import { backstage, useAfterResults, useBackstage, useWays, type Backstage, type BackstageEpisode, type Chosen, type PasteResult, type PreviewLine, type ResultRow, type Shown, type Ways } from "../data";
import type { ShowData } from "../screens/show-space";
import { Block, Face } from "../show/parts";
import { GuardSheet } from "../ui/guards";
import { Btn, Chip, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { AskAiSheet, BetaChip, checkFull, checkQuick, priceOf } from "./ask-ai";
import { Corrections, CouchFlags, FillState, QuestionCard } from "./community";

// Backstage › Results (the mock's backstage.js bsResults with refine.js's 5B and bot.js's ways, docs/PLAN-new-design.md
// step 5), for whoever runs a game here. Two passes over one episode, both through Ask an AI (copy and paste, free):
// Tonight: who went home (the quick check: Survival Pool and Outlast settle, the episode's early results) and Full scores
// (every moment: Weekly Lineup's points, final). What its sources agree on applies to every game here on its own and
// shows you nothing (option 5B), so you can still watch it fresh: Show me and Undo are there. What they disagree on waits
// for you to tick, then a preview of what changes (tier 2) before it applies. Results from everyone (step 6b): every
// answer is shared with every couch on the season, so the full scores say who filled them in and how far the sources
// agree; who can fill them in is the couch's (community.tsx), and so are the corrections the shared check made and any
// house ruling. How results get in (step 6c, bot.js): copy and paste, One tap (our bot asks ChatGPT; unlocked once for the
// whole couch) and Autopilot (coming soon), every price "Free during beta"; a quick check that couldn't be sure is kept on
// the server and waits here (its names behind Show me), whoever sent it, the bot's own scheduled check included.

type Ask = { kind: "quick" | "full"; episode: number } | null;
type Guard = { title: string; cta: string; items: Chosen[]; quick: boolean; episode: number; replace?: string | null; wait?: { id: string; right: boolean } };

export function ResultsPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const asked = Number(useSearchParams().get("ep")) || null;
  const [episode, setEpisode] = useState<number | null>(asked);
  const bs = useBackstage(seasonId, couchId, episode);
  const [looking, setLooking] = useState<number | null>(null);
  const n = bs.data?.episode?.number ?? null;
  const shown = useBackstage(seasonId, couchId, n, { show: true, enabled: looking != null && looking === n });
  const [ask, setAsk] = useState<Ask>(null);
  const [byHand, setByHand] = useState<{ episode: number; replace: string | null; wait: string | null } | null>(null);
  const [guard, setGuard] = useState<Guard | null>(null);
  const refresh = useAfterResults();
  const ways = useWays(seasonId, couchId);
  const seasonName = show.header ? `${show.header.show.name} ${show.header.seasonNumber}` : "this season";
  // A One tap that finishes after its sheet was closed: when it leaves the running list, the results it sent are read.
  const runningIds = (ways.data?.running ?? []).map((r) => r.id).join();
  const wasRunning = useRef(runningIds);
  useEffect(() => {
    const before = wasRunning.current.split(",").filter(Boolean);
    wasRunning.current = runningIds;
    if (before.some((id) => !runningIds.split(",").includes(id))) void refresh();
  }, [runningIds, refresh]);

  if (bs.error) return <EmptyState icon={CircleQuestionMark} title="Results aren't yours to fill in here" line={(bs.error as Error).message} />;
  if (!bs.data || !couchId) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const data = bs.data;
  const ep = data.episode;
  const look = ep && looking === ep.number ? (shown.data?.shown ?? null) : null;
  const games = data.games.length;
  const allGames = `${games} ${games === 1 ? "game" : "games"}`;

  const undo = async (batch: string, what: string) => {
    try {
      await backstage.undo(seasonId, couchId, batch);
      setLooking(null);
      await refresh();
      toast(`Undone: ${what}`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  // What an answer did, pasted or fetched by One tap: the same toasts, and nothing of it shown.
  const said = async (r: PasteResult) => {
    setAsk(null);
    await refresh();
    if (r.kind === "quick") {
      if (r.applied) {
        const batch = r.applied.batch;
        toast(`Applied to ${r.applied.games} ${r.applied.games === 1 ? "game" : "games"} · nothing shown to you`, { undo: () => void undo(batch, "who went home") });
      } else if (r.waiting?.doubt === "not-found") toast(r.waiting.line);
      else toast("It couldn't be sure · it waits for you here");
    } else {
      const batch = r.batch;
      const line = r.applied ? `${r.applied} ${r.applied === 1 ? "result" : "results"} applied to ${r.games} ${r.games === 1 ? "game" : "games"}` : "Nothing applied on its own";
      toast(`${line}${r.waiting ? ` · ${r.waiting} ${r.waiting === 1 ? "waits" : "wait"} for you` : ""}`, batch ? { undo: () => void undo(batch, "the full results") } : {});
    }
  };
  const onUse = async (answer: string, opts: { confirmed: boolean }) => {
    if (!ask) return;
    await said(await backstage.paste(seasonId, couchId, { episode: ask.episode, kind: ask.kind, answer, ...opts }));
  };
  // A One tap still going for a pass of this episode (the sheet can be closed while it asks).
  const asking = (kind: "quick" | "full") => (ep ? (ways.data?.running.find((r) => r.episode === ep.number && r.kind === kind) ?? null) : null);

  return (
    <div className="pb-12">
      {data.open.length > 1 && (
        <div className="flex gap-2 px-4 pt-5" role="group" aria-label="Episode">
          {data.open.map((o) => (
            <Chip key={o.number} on={o.number === ep?.number} onClick={() => setEpisode(o.number)}>
              Episode {o.number}
            </Chip>
          ))}
        </div>
      )}
      {!ep ? (
        <Block title="Who went home">
          <Clear title="Nothing has aired yet" line={data.next?.airAt ? `Episode ${data.next.number} airs ${airTime(Date.parse(data.next.airAt))}. Ask who went home once it has.` : "Ask who went home once the first episode airs."} />
        </Block>
      ) : (
        <>
          <Block title={`Episode ${ep.number}: who went home`} aside={settles(data, "quick")}>
            <QuickCard
              ep={ep}
              data={data}
              look={look}
              looking={looking === ep.number}
              asking={!!asking("quick")}
              onAsk={() => setAsk({ kind: "quick", episode: ep.number })}
              onShow={() => setLooking(ep.number)}
              onUndo={(batch) => undo(batch, "who went home")}
              onByHand={(replace, wait) => setByHand({ episode: ep.number, replace, wait })}
              onApplyWaiting={(items, wait) => setGuard({ title: `Apply who went home in Episode ${ep.number}?`, cta: `Apply to ${allGames}`, items, quick: true, episode: ep.number, wait: { id: wait, right: true } })}
            />
          </Block>
          {ways.data && <ResultsWays seasonId={seasonId} couchId={couchId} ways={ways.data} anyone={data.fill.anyone} seasonName={seasonName} />}
          <Block title="Full scores" aside={settles(data, "full")}>
            <FillState seasonId={seasonId} couchId={couchId} data={data} />
            {ep.questions > 0 && <QuestionCard episode={ep.number} count={ep.questions} tiebreakAt={ep.tiebreakAt} onAsk={() => setAsk({ kind: "full", episode: ep.number })} />}
            <FullCard
              ep={ep}
              look={look}
              looking={looking === ep.number}
              asking={!!asking("full")}
              onAsk={() => setAsk({ kind: "full", episode: ep.number })}
              onShow={() => setLooking(ep.number)}
              onUndo={(batch) => undo(batch, "the full results")}
              onApply={(items) => setGuard({ title: `Apply ${items.length} of Episode ${ep.number}'s results?`, cta: `Apply ${items.length} to ${allGames}`, items, quick: false, episode: ep.number })}
            />
          </Block>
          <p className="px-4 pt-6 text-[13px] leading-relaxed text-muted-foreground">
            One paste covers {games === 1 ? "your game" : `all ${games} games`} here: {data.games.map((g) => g.name).join(", ")}.
            {ep.later.length ? ` ${ep.later.join(" and ")} ${ep.later.length === 1 ? "is" : "are"} catching up, and get Episode ${ep.number} when it's revealed there.` : ""}
            {" Results are shared with every couch on this show: what any of them sends reaches your games too, and what's wrong can be flagged from any episode."}
            {data.resultsBy === "admin" ? " An admin also checks this season's results; what they accept reaches your games on its own." : ""}
          </p>
        </>
      )}
      <Corrections seasonId={seasonId} couchId={couchId} corrections={data.corrections} />
      <CouchFlags flags={data.flags} />

      {ask && (
        <AskAiSheet
          open
          onOpenChange={(o) => !o && setAsk(null)}
          title={ask.kind === "quick" ? `Who went home in Episode ${ask.episode}?` : `Fill in Episode ${ask.episode}`}
          what={
            ask.kind === "quick"
              ? `An AI searches tonight's recaps for who left ${show.header?.show.name ?? "the show"} in Episode ${ask.episode}, then answers in a format we can read.`
              : `An AI searches the web for everything that happened in Episode ${ask.episode}, then answers in a format we can read: every game here scores.`
          }
          spoiler="Its answer says who went home. If you haven't watched, copy it without reading: when its sources agree it applies on its own, and we show you nothing."
          seasonId={seasonId}
          couchId={couchId}
          episode={ask.episode}
          kind={ask.kind}
          check={ask.kind === "quick" ? checkQuick : checkFull}
          onUse={onUse}
          onTapped={said}
          seasonName={seasonName}
        />
      )}
      {byHand && (
        <ByHandSheet
          seasonId={seasonId}
          couchId={couchId}
          episode={byHand.episode}
          onClose={() => setByHand(null)}
          onNext={(items) => {
            const wait = byHand.wait ? { id: byHand.wait, right: false } : undefined;
            setGuard({ title: `Apply who went home in Episode ${byHand.episode}?`, cta: `Apply to ${allGames}`, items, quick: true, episode: byHand.episode, replace: byHand.replace, wait });
            setByHand(null);
          }}
        />
      )}
      {guard && (
        <ApplyGuard
          seasonId={seasonId}
          couchId={couchId}
          guard={guard}
          next={data.next}
          onClose={() => setGuard(null)}
          onDone={async (batch) => {
            setLooking(null);
            await refresh();
            toast(`Applied to ${allGames}`, { undo: () => void undo(batch, guard.quick ? "who went home" : "those results") });
          }}
        />
      )}
    </div>
  );
}

/** "Settles Survival Pool and Outlast": the games each pass settles here. */
function settles(data: Backstage, pass: "quick" | "full"): string | undefined {
  const names = [...new Set(data.games.map((g) => g.gameName))];
  const quick = names.filter((g) => g === "Survival Pool" || g === "Outlast");
  const full = names.filter((g) => g === "Weekly Lineup");
  const list = pass === "quick" ? quick : full;
  if (!list.length) return pass === "full" ? "Every moment" : undefined;
  return `Settles ${list.join(" and ")}`;
}

function Clear({ title, line }: { title: string; line: string }) {
  return (
    <div data-results-clear className="flex items-center gap-3 rounded-[4px] bg-card p-3.5">
      <Check className="size-[26px] flex-none text-good" strokeWidth={2.6} aria-hidden />
      <span>
        <b className="block text-[15px]">{title}</b>
        <small className="text-[13px] text-muted-foreground">{line}</small>
      </span>
    </div>
  );
}

/** The plate a result sits on once it's in: hidden (a blurred stand-in and no names) until Show me. */
function Plate({ kind, title, line, faces }: { kind: string; title: string; line: ReactNode; faces?: { name: string; photo: string | null }[] | null }) {
  return (
    <div className="mt-3.5 flex items-center gap-3 rounded-[3px] bg-plate p-2.5 text-plate-foreground">
      {faces?.length ? (
        <span className="flex flex-none -space-x-3">
          {faces.slice(0, 3).map((f) => (
            <Face key={f.name} src={f.photo} name={f.name} className="size-14 rounded-[3px] ring-2 ring-plate" />
          ))}
        </span>
      ) : faces ? (
        // Shown, and nobody went home (step 6c): nothing hidden, everyone stays in.
        <span data-nobody-face className="grid size-14 flex-none place-items-center rounded-[3px] bg-[#d9d5df] text-plate-foreground">
          <UsersRound className="size-6" aria-hidden />
        </span>
      ) : (
        <span data-hidden-face className="grid size-14 flex-none place-items-center rounded-[3px] bg-[linear-gradient(135deg,#8a8496,#4b4656)] text-white/80 blur-[0.5px]">
          <EyeOff className="size-6" aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="type-caption block text-[11px] tracking-[0.06em] text-plate-muted">{kind}</span>
        <b className="block text-[17px] leading-tight">{title}</b>
        <small className="block text-[12px] font-bold text-[#0b7568]">{line}</small>
      </span>
    </div>
  );
}

function QuickCard({
  ep,
  data,
  look,
  looking,
  asking,
  onAsk,
  onShow,
  onUndo,
  onByHand,
  onApplyWaiting,
}: {
  ep: BackstageEpisode;
  data: Backstage;
  look: Shown | null;
  looking: boolean;
  /** One tap is asking about it right now. */
  asking: boolean;
  onAsk: () => void;
  onShow: () => void;
  onUndo: (batch: string) => void;
  onByHand: (replace: string | null, wait: string | null) => void;
  onApplyWaiting: (items: Chosen[], wait: string) => void;
}) {
  const q = ep.quick && !ep.quick.undone ? ep.quick : null;
  const own = !!q?.own;
  const head = (
    <div className="flex items-start gap-3">
      <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-secondary">
        <Zap className="size-5" aria-hidden />
      </span>
      <span className="flex-1">
        <b className="block text-[16px]">Quick check</b>
        <small className="text-[13px] leading-snug text-muted-foreground">
          One question for an AI: who went home. When its sources agree it applies on its own, so your players can reveal and you can still watch it fresh.
        </small>
      </span>
    </div>
  );

  const waiting = ep.stage === "none" ? ep.wait : null;
  if (waiting) {
    const names = looking ? (look?.wait ?? null) : null;
    const how = waiting.via === "tap" ? "asked" : "pasted";
    const from =
      waiting.via === "autopilot"
        ? "Our bot's own check"
        : `${waiting.mine ? `You ${how}` : waiting.by ? `${waiting.by} ${how}` : how[0].toUpperCase() + how.slice(1)} ${timeOf(Date.parse(waiting.at))}`;
    return (
      <div data-quick="waiting" data-wait={waiting.via} className="rounded-[4px] bg-card p-3.5">
        {head}
        <Plate kind={`Episode ${ep.number} · waiting for you`} title="It couldn't be sure" line={waiting.line} faces={names ? names.map((o) => ({ name: o.name, photo: o.photo })) : null} />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {from} · {waiting.sources === 1 ? "one source" : `${waiting.sources} sources`}
        </p>
        {names ? (
          <>
            <ul data-wait-names className="mt-3 flex flex-col gap-1 text-[14px]">
              {names.length ? (
                names.map((o) => (
                  <li key={o.name}>
                    <b>{o.name}</b> · {o.matched ? o.method : "not someone in this cast"}
                  </li>
                ))
              ) : (
                <li>It says nobody went home</li>
              )}
            </ul>
            <div className="mt-3 flex gap-2">
              <Btn
                data-wait-right
                tone="must"
                className="flex-1"
                disabled={names.length > 0 && !names.some((o) => o.matched)}
                onClick={() => onApplyWaiting(names.length ? names.filter((o) => o.matched).map((o) => ({ castawayName: o.name, method: o.method })) : [{ nobody: true }], waiting.id)}
              >
                It&apos;s right
              </Btn>
              <Btn data-wait-wrong className="flex-1" onClick={() => onByHand(null, waiting.id)}>
                Not right
              </Btn>
            </div>
          </>
        ) : (
          <div className="mt-3 flex gap-2">
            <Btn data-show-me className="flex-1" onClick={onShow}>
              Show me
            </Btn>
            <Btn className="flex-1" onClick={onAsk} disabled={asking}>
              {asking ? "Asking…" : "Ask again"}
            </Btn>
          </div>
        )}
      </div>
    );
  }

  if (ep.stage === "none") {
    return (
      <div data-quick="ask" className="rounded-[4px] bg-card p-3.5">
        {head}
        {asking && <Asking />}
        <Btn data-ask="quick" tone="must" wide className="mt-3.5" onClick={onAsk}>
          <Sparkles className="size-5" aria-hidden />
          {asking ? "See it asking" : "Ask an AI"}
        </Btn>
        <button type="button" data-by-hand onClick={() => onByHand(null, null)} className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold text-muted-foreground">
          <PenLine className="size-4" aria-hidden />
          Watched it? Enter who went home yourself
        </button>
      </div>
    );
  }

  // In: who went home is in every game that can take it (on its own, entered, or as part of the full results).
  const at = q ? timeOf(Date.parse(q.at)) : null;
  const outs = look?.out ?? null;
  return (
    <div data-quick={own ? "own" : "in"} className="rounded-[4px] bg-card p-3.5">
      {head}
      <Plate
        kind={`Episode ${ep.number}${at ? ` · ${own ? "applied" : "entered"} ${at}` : ""}`}
        title={outs ? (outs.length ? outs.map((o) => o.name).join(" & ") : "Nobody went home") : own ? "Applied on its own" : "Who went home is in"}
        line={
          outs
            ? outs.map((o) => o.method).filter(Boolean).join(" · ") || "In every game here"
            : own
              ? `${q?.who ? "Sources agreed" : "Applied"} · nothing shown to you`
              : q?.who
                ? `Entered by ${q.who.name}`
                : "In every game here"
        }
        faces={outs}
      />
      <div className="mt-2.5 flex gap-2">
        {!looking && (
          <Btn data-show-me className="flex-1" onClick={onShow}>
            Show me
          </Btn>
        )}
        {q?.undoable && (
          <Btn data-undo={q.batch} className="flex-1" onClick={() => onUndo(q.batch)}>
            Undo
          </Btn>
        )}
        {looking && ep.stage === "early" && q?.undoable && (
          <Btn className="flex-1" onClick={() => onByHand(q.batch, null)}>
            Not right
          </Btn>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
        {q?.undoable && q.undoUntil ? `Undo until ${airTime(Date.parse(q.undoUntil))}, when Episode ${ep.number + 1} airs. ` : ""}
        Your players can reveal it now{data.games.length > 1 ? ", in every game here" : ""}.
      </p>
    </div>
  );
}

function FullCard({
  ep,
  look,
  looking,
  asking,
  onAsk,
  onShow,
  onUndo,
  onApply,
}: {
  ep: BackstageEpisode;
  look: Shown | null;
  looking: boolean;
  /** One tap is asking about it right now. */
  asking: boolean;
  onAsk: () => void;
  onShow: () => void;
  onUndo: (batch: string) => void;
  onApply: (items: Chosen[]) => void;
}) {
  const f = ep.full && !ep.full.undone ? ep.full : null;
  const own = !!f?.own;
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  return (
    <div data-full={ep.stage} className="flex flex-col gap-3">
      {f && (
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <span className="grid size-8 flex-none place-items-center rounded-full bg-good/20 text-good">
            <Check className="size-4" strokeWidth={2.6} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">
              {f.count} {f.count === 1 ? "result" : "results"} {own ? "applied on their own" : "applied"}
            </b>
            <small className="block text-[12.5px] text-muted-foreground">
              {f.who?.name ?? "On its own"} · {timeOf(Date.parse(f.at))}
              {f.undoable && f.undoUntil ? ` · undo until ${airTime(Date.parse(f.undoUntil))}` : ""}
            </small>
          </span>
          {f.undoable && (
            <Btn data-undo={f.batch} className="h-10 px-3 text-[14px]" onClick={() => onUndo(f.batch)}>
              Undo
            </Btn>
          )}
        </div>
      )}

      {ep.waiting > 0 && (
        <div data-waiting={ep.waiting} className="rounded-[4px] bg-card p-3.5">
          <b className="block text-[16px]">
            {ep.waiting} {ep.waiting === 1 ? "result waits" : "results wait"} for you
          </b>
          <small className="text-[13px] leading-snug text-muted-foreground">The sources don&apos;t agree, or weren&apos;t sure. Nothing of these applies unless you tick it.</small>
          {looking && look ? (
            <>
              <div className="mt-3 flex flex-col">
                {look.waiting.map((r) => (
                  <TickRow key={r.id} row={r} on={ticked.has(r.id!)} onTick={() => setTicked((t) => toggle(t, r.id!))} />
                ))}
              </div>
              <Btn
                data-apply-waiting
                tone="must"
                wide
                className="mt-3"
                disabled={!ticked.size}
                onClick={() => onApply([...ticked].map((id) => ({ id })))}
              >
                {ticked.size ? `Apply ${ticked.size} ${ticked.size === 1 ? "result" : "results"}` : "Tick what's right"}
              </Btn>
            </>
          ) : (
            <Btn data-show-me className="mt-3" wide onClick={onShow}>
              Show me
            </Btn>
          )}
        </div>
      )}

      {ep.stage === "final" && !ep.waiting ? (
        <>
          {!f && <Clear title={`Episode ${ep.number}'s full scores are in`} line="In every game here" />}
          {looking && look ? <AppliedList rows={look.applied} /> : !f ? null : (
            <Btn data-show-me wide onClick={onShow}>
              Show me what applied
            </Btn>
          )}
        </>
      ) : (
        !ep.waiting && (
          <div data-full-ask className="rounded-[4px] bg-card p-3.5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-secondary">
                <ListChecks className="size-5" aria-hidden />
              </span>
              <span className="flex-1">
                <b className="block text-[16px]">Fill in Episode {ep.number}</b>
                <small className="text-[13px] leading-snug text-muted-foreground">
                  Everything that happened, for every game&apos;s points. Ask an AI, paste its answer back: what its sources agree on applies on its own. About 2 minutes.
                </small>
              </span>
            </div>
            {asking && <Asking />}
            <Btn data-ask="full" tone={ep.stage === "early" ? "must" : "optional"} wide className="mt-3.5" onClick={onAsk}>
              <Sparkles className="size-5" aria-hidden />
              {asking ? "See it asking" : "Ask an AI"}
            </Btn>
          </div>
        )
      )}
      {ep.stage !== "final" && f && looking && look && <AppliedList rows={look.applied.filter((r) => r.kind !== "elimination")} />}
    </div>
  );
}

/** One tap is asking ChatGPT right now (the sheet was closed while it runs): a line on the card. */
function Asking() {
  return (
    <p data-asking className="mt-3 flex items-center gap-2.5 text-[13px] font-semibold">
      <span className="size-4 flex-none animate-spin rounded-full border-2 border-border border-t-foreground motion-reduce:animate-none" aria-hidden />
      ChatGPT is looking it up · usually under 2 minutes
    </p>
  );
}

/**
 * How results get in (step 6c, the mock's bot.js): copy and paste (free, always), One tap (unlocked once for the whole
 * couch) and Autopilot (coming soon; "on" while an admin runs the bot's schedule for this season), each with what it will
 * cost and "Free during beta". Unlocking One tap is tier 1: a sheet that says what it is, nothing charged.
 */
function ResultsWays({ seasonId, couchId, ways, anyone, seasonName }: { seasonId: string; couchId: string; ways: Ways; anyone: boolean; seasonName: string }) {
  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useAfterResults();
  const auto = ways.autopilot.quick || ways.autopilot.full;
  const current = auto ? "autopilot" : ways.tap.unlocked ? "tap" : "paste";
  const autoLine = auto
    ? `On for this season: our bot ${[ways.autopilot.quick && "checks who went home minutes after each episode, and keeps checking until it's sure", ways.autopilot.full && "fills in every point within the hour, checked again overnight"].filter(Boolean).join(", and ")}.`
    : "Results arrive on their own: who went home minutes after the episode, every point within the hour, checked again overnight. Nobody taps anything.";
  const unlock = async () => {
    setBusy(true);
    try {
      await backstage.unlock(seasonId, couchId);
      setUnlocking(false);
      await refresh();
      toast(`One tap unlocked for ${seasonName} · free during beta`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Block title="How results get in" aside={<BetaChip />}>
      <div data-ways={current} className="flex flex-col gap-2">
        <Way
          id="paste"
          name="Copy and paste"
          price="Free"
          on={current === "paste"}
          tag={current === "paste" ? "How you do it now" : null}
          line={`${anyone ? "Anyone on the couch" : "Whoever runs a game here"} copies our question into ChatGPT and pastes the answer. About 2 minutes an episode.`}
          onClick={() => ways.tap.unlocked && toast("One tap stays unlocked this season; copy and paste always works too")}
        />
        <Way
          id="tap"
          name="One tap"
          price={`${priceOf(ways.prices.tap)} a season`}
          on={current === "tap"}
          tag={ways.tap.unlocked ? `Unlocked for this season${ways.tap.by ? ` by ${ways.tap.by}` : ""}` : null}
          line={`"Ask ChatGPT for me": our bot asks and sends it in. One tap an episode, for the whole couch.${ways.bot.available ? "" : " Our bot isn't answering right now."}`}
          onClick={() => (ways.tap.unlocked ? undefined : ways.canUnlock ? setUnlocking(true) : toast("Whoever runs the games here can unlock it"))}
        />
        <Way
          id="autopilot"
          name="Autopilot"
          price={`${priceOf(ways.tap.unlocked ? ways.prices.autopilotAfterTap : ways.prices.autopilot)} a season`}
          on={current === "autopilot"}
          soon={!auto}
          tag={auto ? "On for this season" : null}
          line={autoLine}
          onClick={() => !auto && toast("Autopilot is coming soon · we'll tell you when it's ready")}
        />
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
        Prices are what they&apos;ll be after beta; nothing is charged now.{auto ? "" : " Autopilot is coming soon."}
        {ways.tap.unlocked ? ` With One tap it will be ${priceOf(ways.prices.autopilotAfterTap)}.` : ""} Who went home is always free.
      </p>
      <Sheet open={unlocking} onOpenChange={setUnlocking} title="Unlock One tap?" subtitle={`${seasonName} · for everyone on the couch`}>
        <div data-unlock-sheet className="flex items-center gap-3.5 rounded-[4px] bg-background p-3.5">
          <b className="text-[44px] leading-none">{priceOf(ways.prices.tap)}</b>
          <span className="text-[16px] font-semibold">
            for the whole season
            <small className="mt-1 block text-[13px] font-normal leading-snug text-muted-foreground">
              Every episode&apos;s results with one tap, for anyone on the couch. Copy and paste still works too.
            </small>
          </span>
        </div>
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <BetaChip />
          Nothing is charged during beta.
        </p>
        <Btn data-unlock tone="must" wide className="mt-3" disabled={busy} onClick={unlock}>
          Unlock for {seasonName}
        </Btn>
      </Sheet>
    </Block>
  );
}

function Way({ id, name, price, line, on, tag, soon, onClick }: { id: string; name: string; price: string; line: string; on: boolean; tag: string | null; soon?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-way={id}
      aria-pressed={on}
      aria-disabled={soon || undefined}
      onClick={onClick}
      className={`block w-full rounded-[4px] p-3.5 text-left outline-[1.5px] -outline-offset-[1.5px] ${on ? "bg-background outline-foreground" : "bg-card outline-transparent"} ${soon ? "opacity-55" : ""}`}
    >
      <span className="flex items-center gap-2.5">
        <i className={`size-[18px] flex-none rounded-full ${on ? "shadow-[inset_0_0_0_5px_var(--foreground)]" : "shadow-[inset_0_0_0_2px_var(--input)]"}`} aria-hidden />
        <b className="type-caption flex-1 text-[20px]">{name}</b>
        <span className="text-[14px] font-bold">
          {price}
          {soon && <span className="font-semibold text-muted-foreground"> · Coming soon</span>}
        </span>
      </span>
      <small className="ml-7 mt-1 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      {tag && <span className="type-caption ml-7 mt-2 inline-block text-[11px] tracking-[0.06em] text-good">{tag}</span>}
    </button>
  );
}

const toggle = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

function TickRow({ row, on, onTick }: { row: ResultRow; on: boolean; onTick: () => void }) {
  return (
    <button type="button" data-tick={row.id} aria-pressed={on} onClick={onTick} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
      <span className={`grid size-6 flex-none place-items-center rounded-[3px] ${on ? "bg-foreground text-background" : "outline-2 -outline-offset-2 outline-input"}`}>
        {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
      </span>
      <Face src={row.photo} name={row.name} className="size-10 flex-none rounded-[3px]" />
      <span className="min-w-0 flex-1">
        <span className="type-caption block text-[11px] tracking-[0.06em] text-muted-foreground">{row.label}</span>
        <b className="block text-[15px]">{row.name}</b>
        <small className="block text-[12px] text-chyron-line">
          {row.confidence === "high" ? "The sources disagree" : `${row.confidence ?? "Low"} confidence`} · {row.sources === 1 ? "1 source" : `${row.sources} sources`}
        </small>
      </span>
    </button>
  );
}

function AppliedList({ rows }: { rows: ResultRow[] }) {
  if (!rows.length) return null;
  return (
    <div data-applied className="flex flex-col">
      {rows.map((r, i) => (
        <div key={`${r.kind}-${r.name}-${i}`} className="flex min-h-[52px] items-center gap-3 border-t border-border py-1.5 first:border-t-0">
          <Face src={r.photo} name={r.name} className="size-9 flex-none rounded-[3px]" />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">{r.name}</b>
            <small className="block text-[12.5px] text-muted-foreground">{r.label}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Entering who went home yourself: tap them, say how, then the preview. */
function ByHandSheet({ seasonId, couchId, episode, onClose, onNext }: { seasonId: string; couchId: string; episode: number; onClose: () => void; onNext: (items: Chosen[]) => void }) {
  const cast = useBackstage(seasonId, couchId, episode, { show: true });
  const shown = cast.data?.shown;
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  // Nobody went home (step 6c): the episode is marked like any other, with no one out. Tapping someone clears it.
  const [nobody, setNobody] = useState(false);
  const methods = (shown?.methods ?? []).filter((m) => m !== "Other");
  const first = methods[0] ?? "Other";
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`Who went home in Episode ${episode}?`} subtitle="Tap who left, then how">
      {!shown ? (
        <div aria-busy className="h-48 animate-pulse rounded-[3px] bg-background" />
      ) : (
        <div data-by-hand-sheet>
          <div className="grid grid-cols-4 gap-2">
            {shown.cast.map((c) => {
              const on = picked.has(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={on}
                  data-out={c.name}
                  onClick={() => {
                    setNobody(false);
                    setPicked((p) => {
                      const next = new Map(p);
                      if (next.has(c.name)) next.delete(c.name);
                      else next.set(c.name, first);
                      return next;
                    });
                  }}
                  className={`flex flex-col items-center gap-1 rounded-[3px] p-1 text-center text-[12px] font-semibold ${on ? "bg-foreground text-background" : ""}`}
                >
                  <Face src={c.photo} name={c.name} className="aspect-square w-full rounded-[3px]" />
                  <span className="line-clamp-1">{c.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
          {[...picked].map(([name, method]) => (
            <div key={name} className="mt-3">
              <b className="block text-[14px]">How {name.split(" ")[0]} left</b>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {methods.map((m) => (
                  <Chip key={m} on={m === method} onClick={() => setPicked((p) => new Map(p).set(name, m))}>
                    {m}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            data-nobody
            aria-pressed={nobody}
            onClick={() => {
              setNobody((v) => !v);
              setPicked(new Map());
            }}
            className={`mt-3 flex min-h-12 w-full items-center gap-3 rounded-[3px] px-3 text-left text-[15px] font-semibold ${nobody ? "bg-foreground text-background" : "bg-background"}`}
          >
            <span className={`grid size-6 flex-none place-items-center rounded-[3px] ${nobody ? "bg-background text-foreground" : "outline-2 -outline-offset-2 outline-input"}`}>
              {nobody && <Check className="size-4" strokeWidth={3} aria-hidden />}
            </span>
            <span>
              Nobody went home
              <small className={`block text-[12.5px] font-normal ${nobody ? "text-background/75" : "text-muted-foreground"}`}>A non-elimination episode: everyone stays in</small>
            </span>
          </button>
          <Btn
            tone="must"
            wide
            className="mt-4"
            disabled={!picked.size && !nobody}
            onClick={() => onNext(nobody ? [{ nobody: true }] : [...picked].map(([castawayName, method]) => ({ castawayName, method })))}
          >
            {picked.size || nobody ? "See what changes" : "Tap who went home"}
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** Tier 2: the server's dry run of what these results do to every game here, then apply (one batch, with Undo). */
function ApplyGuard({
  seasonId,
  couchId,
  guard,
  next,
  onClose,
  onDone,
}: {
  seasonId: string;
  couchId: string;
  guard: Guard;
  next: Backstage["next"];
  onClose: () => void;
  onDone: (batch: string) => Promise<void>;
}) {
  const [lines, setLines] = useState<PreviewLine[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    backstage
      .preview(seasonId, couchId, { episode: guard.episode, items: guard.items, quick: guard.quick })
      .then((r) => live && setLines(r.lines))
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
  }, [seasonId, couchId, guard]);
  return (
    <GuardSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={guard.title}
      subtitle={failed ?? "Here's what changes for the couch"}
      lines={failed ? [] : lines}
      cta={guard.cta}
      undoNote={next?.airAt ? `You can undo this from Recent changes until Episode ${next.number} airs.` : "You can undo this from Recent changes."}
      onConfirm={async () => {
        // Not right: what applied first comes off, then yours goes in.
        if (guard.replace) await backstage.undo(seasonId, couchId, guard.replace);
        const r = await backstage.apply(seasonId, couchId, { episode: guard.episode, items: guard.items, quick: guard.quick, wait: guard.wait });
        await onDone(r.batch);
      }}
    />
  );
}
