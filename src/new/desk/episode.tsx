"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Check, ChevronRight, CircleHelp, Grid3x3, Plus, Repeat, Split, User, Users, X, Zap } from "lucide-react";
import { AskAiPasteSheet, checkFull } from "../backstage/ask-ai";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Face } from "../show/parts";
import { Avatar } from "../ui/bars";
import { GuardSheet, HoldSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, useDesk, type DeskEpisode, type DeskResearch, type EpisodeAnswer, type EpisodeFact, type MoveLine, type TriviaQuestion } from "./data";
import { DeleteRow, DeskHeader, DeskRow, Facts, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { NowSheet } from "./research";

// An episode's page on the desk (docs/PLAN-desk-parity.md step 4, part 4b; the mock's desk-research.js rsEpPage), from the
// season page's Episodes, Research's Not in the games yet and a run's sheet: its lower third (Early, Final or Waiting, and
// who went home unless names are hidden), Results (Hide names: counts only, on by itself for an episode you haven't seen;
// Not in the games yet with ✕ ✓ or Who?, Accept all; Disputed to its fact page; In every game by result, each one's sheet
// with Correct it, Take it out, Unlock), Answers (each a source, Take it back), Paste an answer (the plain Ask an AI, what
// it adds said first) and Ask our bot (Research's Run now), Trivia (Take it out, or Write trivia now), Bingo (a row to
// the season's bank on its squares, part 4c), History, and Clear its results last. Server: src/lib/server/desk-episode.ts.

const NOTE = "mt-3 text-[13px] leading-snug text-muted-foreground";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "all 15 games", "its one game", or with none playing it, "every game". */
const allGames = (g: number) => (g > 1 ? `all ${g} games` : g ? "its one game" : "every game");
const shown = (f: EpisodeFact) => (f.kind === "noexit" ? "Nobody went home" : `${f.unknown ? `“${f.name}”` : f.name} · ${f.label}`);
const stat = (f: EpisodeFact) =>
  ({
    wait: "Not in the games yet",
    disputed: "Disputed",
    live: f.sources >= 2 ? `In every game · ${f.sources} sources agree` : "In every game · 1 source, sure of it",
    canon: `In every game · ${f.decidedBy ?? "an admin"} decided`,
    gone: "Out of every game",
  })[f.state];

type SheetState =
  | { k: "fact"; id: string }
  | { k: "group"; label: string | null }
  | { k: "correct"; id: string }
  | { k: "all" }
  | { k: "out"; id: string }
  | { k: "answer"; id: string }
  | { k: "back"; id: string }
  | { k: "paste" }
  | { k: "added"; answer: string; confirmed: boolean; lines: MoveLine[] }
  | { k: "trivia"; id: string }
  | { k: "clear" }
  | { k: "now"; kind: "full" | "trivia" }
  | null;

export function EpisodePage({ id, n }: { id: string; n: number }) {
  const path = `/seasons/${id}/episodes/${n}`;
  const q = useDesk<DeskEpisode>(path);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [hideSet, setHide] = useState<boolean | null>(null);
  const research = useDesk<DeskResearch>(sheet?.k === "now" ? `/seasons/${id}/research` : null);
  const after = useAfterDesk();
  const changed = useChangeToast();
  const back = { label: "Season", href: paths.deskItem("season", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Episode" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Episode" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const e = q.data;
  const hide = hideSet ?? !e.seen;
  const close = () => setSheet(null);
  const fact = (fid: string) => e.facts.find((f) => f.id === fid) ?? null;
  const answer = (aid: string) => e.answers.find((a) => a.id === aid) ?? null;
  /** A change made: every desk read moves on, then its toast with Undo. */
  const done = async (out: { changeId?: string | null; text: string }) => {
    await after();
    changed(out.text, out.changeId ?? null);
  };
  /** One result decided from its row or its sheet (desk-facts.ts decideFact: canonical and locked, or reopened). */
  const decide = async (f: EpisodeFact, body: Record<string, unknown>, text: string) => {
    try {
      const out = await deskSend<{ changeId: string }>(`/facts/${f.id}`, body);
      await done({ changeId: out.changeId, text });
    } catch (err) {
      toast.quiet((err as Error).message);
    }
  };
  const accept = (f: EpisodeFact) => decide(f, { decide: "yes" }, `Accepted · in ${allGames(e.games)} as each player reveals Episode ${n}`);
  const reject = (f: EpisodeFact) => decide(f, { decide: "no" }, "Rejected · it stays out of every game");

  const waiting = e.facts.filter((f) => f.state === "wait");
  const sure = waiting.filter((f) => !f.unknown);
  const disputed = e.facts.filter((f) => f.state === "disputed");
  const inGames = e.facts.filter((f) => f.state === "live" || f.state === "canon");
  const gone = e.facts.filter((f) => f.state === "gone");
  const groups = new Map<string, EpisodeFact[]>();
  for (const f of inGames) groups.set(f.label, [...(groups.get(f.label) ?? []), f]);
  const order = [...groups.keys()].sort((a, b) => Number(groups.get(b)![0].kind === "elimination") - Number(groups.get(a)![0].kind === "elimination"));
  const triviaIn = e.trivia.filter((t) => !t.out).length;

  return (
    <div className="pb-16" data-desk-episode={n} data-hidden={hide ? "on" : "off"}>
      <DeskHeader title="Episode" back={{ label: e.season.name, href: paths.deskItem("season", id) }} name={`Episode ${n}`} />
      <LowerThird tag={e.tag} tone={e.tag === "Waiting" ? "stopped" : "quiet"} title={`Episode ${n}`} detail={`${e.date} · ${e.aired && !hide && e.wentHome ? e.wentHome : e.season.name}`} />
      {e.aired ? (
        <Facts>{e.meta}</Facts>
      ) : (
        <Section>
          <div data-not-aired className="rounded-[4px] bg-card p-3.5">
            <b className="block text-[16px]">Hasn&apos;t aired</b>
            <small className="mt-0.5 block text-[14px] leading-snug text-muted-foreground">
              Results come in after it ends{e.endsAt ? ` at ${e.endsAt}` : ""}: couches&apos; answers, and whatever our bot&apos;s schedule asks.
              {e.finalAt ? ` Players get who went home then, and their final results ${e.finalAt.when}.` : ""}
            </small>
          </div>
        </Section>
      )}

      {e.aired && (
        <Section title="Results">
          {e.finalAt && (
            <p data-final-at className="pb-2 text-[13px] leading-snug text-muted-foreground">
              Players&apos; final results {e.finalAt.passed ? "were due" : "are due"} {e.finalAt.when}: their push, and &ldquo;Final results are in&rdquo;, with what&apos;s in by then.
            </p>
          )}
          <button type="button" role="switch" aria-checked={hide} data-hide-names={hide ? "on" : "off"} onClick={() => setHide(!hide)} className="nd-press flex min-h-[60px] w-full items-center gap-3 text-left">
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]">Hide names</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">
                {hide ? (e.seen ? "Counts only: accept without seeing who did what" : `On: you haven't seen Episode ${n} yet. Counts only`) : e.seen ? `You've seen Episode ${n}` : `Shown, though you haven't seen Episode ${n}`}
              </small>
            </span>
            <Pill on={hide} />
          </button>

          <SubHead
            title="Not in the games yet"
            aside={
              sure.length ? (
                <button type="button" data-accept-all onClick={() => setSheet({ k: "all" })} className="text-[17px] font-bold text-foreground underline decoration-input underline-offset-[3px]">
                  Accept {sure.length === waiting.length && sure.length > 1 ? "all " : ""}
                  {sure.length}
                </button>
              ) : undefined
            }
          />
          {!waiting.length ? (
            <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">Nothing waiting.</p>
          ) : hide ? (
            <div data-waiting-count className="flex items-center gap-4 rounded-[4px] bg-card p-3.5">
              <b className="type-num text-[44px] leading-none">{waiting.length}</b>
              <span className="text-[14px] leading-snug">
                {[sure.length && `${sure.length} one source wasn't sure of`, waiting.length - sure.length && `${waiting.length - sure.length} not in the cast: say who, with names shown`]
                  .filter(Boolean)
                  .map((t) => (
                    <span key={String(t)} className="block">
                      {t}
                    </span>
                  ))}
              </span>
            </div>
          ) : (
            <div data-waiting className="border-b border-border">
              {waiting.map((f) => (
                <QueueRow key={f.id} f={f} onOpen={() => setSheet({ k: "fact", id: f.id })} onWho={() => setSheet({ k: "correct", id: f.id })} onYes={() => void accept(f)} onNo={() => void reject(f)} />
              ))}
            </div>
          )}
          {waiting.length > 0 && (
            <p className={NOTE}>{e.resultsBy === "admin" ? "You decide its results: nothing reaches the games until you accept it." : `Each reaches every game once ${e.confirmAt} sources agree, or once you accept it.`}</p>
          )}

          {disputed.length > 0 && (
            <>
              <SubHead title="Disputed" aside={disputed.length} />
              {hide ? (
                <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">{plural(disputed.length, "result")}: the sources split.</p>
              ) : (
                <div data-disputed className="border-b border-border">
                  {disputed.map((f) => (
                    <QueueRow key={f.id} f={f} onOpen={() => setSheet({ k: "fact", id: f.id })} />
                  ))}
                </div>
              )}
              <p className={NOTE}>A disputed result stays as it was in every game until it&apos;s settled. It&apos;s in your Inbox.</p>
            </>
          )}

          <SubHead title="In every game" aside={plural(inGames.length, "result")} />
          {hide ? (
            <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">
              {plural(inGames.length, "result")} in every game on {e.season.name}, from {plural(e.answers.length, "answer")}.
            </p>
          ) : order.length ? (
            <div data-in-games className="border-b border-border">
              {order.map((label) => (
                <GroupRow key={label} label={label} facts={groups.get(label)!} onClick={() => setSheet({ k: "group", label })} />
              ))}
            </div>
          ) : (
            <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">Nothing yet.</p>
          )}
          {gone.length > 0 && !hide && (
            <button type="button" data-gone onClick={() => setSheet({ k: "group", label: null })} className={`${LINK} mt-1`}>
              {plural(gone.length, "result")} rejected or taken out
            </button>
          )}
        </Section>
      )}

      {e.aired && (
        <Section title="Answers" aside={e.answers.length ? plural(e.answers.length, "answer") : undefined}>
          {e.answers.length > 0 && (
            <div data-answers className="border-b border-border">
              {e.answers.map((a) => (
                <DeskRow key={a.id} data="answer" onClick={() => setSheet({ k: "answer", id: a.id })} lead={<AnswerLead a={a} />} title={a.title} line={a.line} />
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Btn data-paste onClick={() => setSheet({ k: "paste" })}>
              Paste an answer
            </Btn>
            <Btn data-ask-bot onClick={() => setSheet({ k: "now", kind: "full" })}>
              Ask our bot
            </Btn>
          </div>
          <p className={NOTE}>Each answer is a source like a couch&apos;s. Take one back from its row.</p>
        </Section>
      )}

      {e.aired && (
        <Section title="Trivia" aside={e.trivia.length ? `${triviaIn} of ${e.trivia.length} asked` : undefined}>
          {e.trivia.length && hide ? (
            <p data-trivia-count className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">
              {plural(e.trivia.length, "question")} written after it, {triviaIn} asked. Shown with names.
            </p>
          ) : e.trivia.length ? (
            <div data-trivia className="border-b border-border">
              {e.trivia.map((t) => (
                <DeskRow
                  key={t.id}
                  data="trivia"
                  onClick={() => setSheet({ k: "trivia", id: t.id })}
                  lead={<IconLead icon={CircleHelp} />}
                  title={t.question}
                  line={t.out ? `Out: ${t.out}` : `${t.answer} · passed its check`}
                  end={t.out ? <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] tracking-[0.06em]">Out</span> : undefined}
                />
              ))}
            </div>
          ) : (
            <>
              <p data-trivia-none className="rounded-[4px] bg-card p-3.5 text-[14px] leading-snug text-muted-foreground">
                None written about it: {e.triviaOn ? "its trivia run comes a day before the next episode" : `trivia isn't in ${e.season.name}'s schedule`}. Its counted questions still play.
              </p>
              <button type="button" data-write-trivia onClick={() => setSheet({ k: "now", kind: "trivia" })} className={`${LINK} mt-1`}>
                Write trivia now
              </button>
            </>
          )}
        </Section>
      )}

      {/* Bingo: the season's bank on this episode's squares (part 4c). */}
      <Section title="Bingo">
        <div className="border-b border-border">
          <DeskRow
            data="bingo"
            href={paths.deskBingo(id, n)}
            lead={<IconLead icon={Grid3x3} />}
            title={e.bingo != null ? `${plural(e.bingo, "square")} of its own` : "None of its own"}
            line={e.bingoBy ?? (e.aired ? "Its cards used the season's bank" : "Its cards use the season's bank, unless it gets its own")}
          />
        </div>
      </Section>

      <LatestHistory lines={e.history} />
      <DeleteRow
        data="clear-episode"
        title={`Clear Episode ${n}'s results`}
        line={e.answers.length || e.facts.length ? `Its ${plural(e.answers.length, "answer")} and ${plural(e.facts.length, "result")} go, from every game` : "Nothing to clear"}
        off={!e.answers.length && !e.facts.length}
        onClick={() => setSheet({ k: "clear" })}
      />

      <FactSheet e={e} f={sheet?.k === "fact" ? fact(sheet.id) : null} hide={hide} onClose={close} onCorrect={(f) => setSheet({ k: "correct", id: f.id })} onOut={(f) => setSheet({ k: "out", id: f.id })} decide={decide} accept={accept} reject={reject} />
      <GroupSheet e={e} label={sheet?.k === "group" ? sheet.label : undefined} onClose={close} onFact={(f) => setSheet({ k: "fact", id: f.id })} />
      <CorrectSheet e={e} f={sheet?.k === "correct" ? fact(sheet.id) : null} onClose={close} decide={decide} />
      <MovesSheet
        open={sheet?.k === "all"}
        onClose={close}
        title={sure.length === 1 ? "Accept it?" : sure.length < waiting.length ? `Accept these ${sure.length}?` : `Accept all ${sure.length}?`}
        subtitle={`Episode ${n} · ${e.season.name}${waiting.length > sure.length ? ` · ${hide ? (waiting.length - sure.length === 1 ? "one needs" : `${waiting.length - sure.length} need`) : `${shown(waiting.find((f) => f.unknown)!).split(" · ")[0]} needs`} a name first, so ${waiting.length - sure.length === 1 ? "it waits" : "they wait"}` : ""}`}
        lines={[
          ...(hide ? [{ face: null, icon: "check" as const, label: plural(sure.length, "result one source wasn't sure of", "results one source wasn't sure of"), change: "Into every game" }] : sure.map((f) => moveOf(f, "Into every game"))),
          { face: null, icon: "people", label: `Its ${plural(e.games, "game")}`, change: "As each player reveals it" },
          { face: null, icon: "poll", label: "Shared stats and trivia", change: `Count ${sure.length > 1 ? "them" : "it"}` },
        ]}
        cta={`Accept ${sure.length}`}
        undoNote="Each is locked as you decided. Unlock one from its row."
        onConfirm={async () => done(await deskSend<{ changeId: string; text: string }>(path, { acceptAll: sure.map((f) => f.id) }))}
      />
      <TakeOutSheet e={e} f={sheet?.k === "out" ? fact(sheet.id) : null} onClose={close} decide={decide} />
      <AnswerSheet e={e} a={sheet?.k === "answer" ? answer(sheet.id) : null} hide={hide} onClose={close} onTake={(a) => setSheet({ k: "back", id: a.id })} />
      <TakeBackSheet path={path} e={e} a={sheet?.k === "back" ? answer(sheet.id) : null} hide={hide} onClose={close} done={done} />
      <AskAiPasteSheet
        open={sheet?.k === "paste"}
        onOpenChange={(o) => !o && close()}
        title={`Episode ${n}'s results`}
        what={`Your AI searches the web for everything in ${e.season.name} Episode ${n}, then answers in a form we read. Paste it back: it's a source like a couch's answer.`}
        spoiler={e.seen ? undefined : `Its answer says what happened in Episode ${n}, which you haven't seen.`}
        check={checkFull}
        tag="desk-full"
        empty={`There's nobody to ask about in Episode ${n}.`}
        question={{ key: ["new-design", "desk", `${path}/question`], load: () => deskGet<{ prompt: string | null; task: string }>(`${path}/question`) }}
        onUse={async (text, { confirmed }) => {
          // Read first: what it would add is said before it's filed (a 409 asks whether it really is this episode).
          const p = await deskSend<{ lines: MoveLine[] }>(path, { paste: text, preview: true, confirmed });
          setSheet({ k: "added", answer: text, confirmed, lines: p.lines });
        }}
      />
      <AddedSheet path={path} e={e} hide={hide} paste={sheet?.k === "added" ? sheet : null} onClose={close} done={done} />
      <TriviaSheet path={path} e={e} hide={hide} t={sheet?.k === "trivia" ? (e.trivia.find((t) => t.id === sheet.id) ?? null) : null} onClose={close} done={done} />
      <HoldSheet
        open={sheet?.k === "clear"}
        onOpenChange={(o) => !o && close()}
        title={`Clear Episode ${n}'s results?`}
        subtitle="This can't be undone"
        consequence=""
        body={
          <ul data-clear className="flex list-disc flex-col gap-2 rounded-[3px] bg-background p-3 pl-7 text-[16px] leading-normal">
            <li>
              Its {plural(e.answers.length, "answer")} and {plural(e.facts.length, "result")} go, the ones you accepted too.
            </li>
            <li>
              {e.games ? `All ${plural(e.games, "game")} on ${e.season.name} take` : `Every game on ${e.season.name} takes`} them back out: their standings go back to before Episode {n}.
            </li>
            <li>Its shared stats go with them. Couches can fill it in again.</li>
          </ul>
        }
        alt={
          waiting.length
            ? {
                label: "Clear only what's waiting",
                line: `The ${plural(waiting.length, "result")} not in the games go; what's in the games stays.`,
                onClick: async () => {
                  close();
                  try {
                    await done(await deskSend<{ changeId: string; text: string }>(`${path}?scope=waiting`, { ids: waiting.map((f) => f.id) }, "DELETE"));
                  } catch (err) {
                    toast.quiet((err as Error).message);
                  }
                },
              }
            : undefined
        }
        cta={`clear Episode ${n}`}
        restore="Can't be undone"
        onConfirm={async () => {
          const out = await deskSend<{ text: string }>(`${path}?scope=everything`, {}, "DELETE");
          await after();
          toast(out.text);
        }}
      />
      {research.data && sheet?.k === "now" && <NowSheet open onClose={close} r={research.data} kind={sheet.kind} episode={n} />}
    </div>
  );
}

function Pill({ on }: { on: boolean }) {
  return (
    <span className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-secondary"}`}>
      <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${on ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
    </span>
  );
}

/** A list's small heading inside a section (the mock's .dk-sub). */
function SubHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between gap-3">
      <h3 className="type-caption text-[19px] tracking-[0.04em] text-muted-foreground">{title}</h3>
      {aside != null && <span className="text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

function FactFace({ f, size = 40 }: { f: Pick<EpisodeFact, "photo" | "name" | "unknown" | "kind">; size?: number }) {
  if (f.unknown || f.kind === "noexit" || !f.name)
    return (
      <span aria-hidden className="type-caption grid flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground" style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}>
        {f.kind === "noexit" ? "–" : "?"}
      </span>
    );
  return <Face src={f.photo} name={f.name} className="flex-none rounded-[3px]" style={{ width: size, height: size }} />;
}

/** A result waiting or disputed (the mock's rsQRow): its face, what and why, and ✕ ✓, Who? or Decide. */
function QueueRow({ f, onOpen, onWho, onYes, onNo }: { f: EpisodeFact; onOpen: () => void; onWho?: () => void; onYes?: () => void; onNo?: () => void }) {
  const act = "nd-press grid h-11 flex-none place-items-center rounded-[3px] bg-card px-3 text-[15px] font-bold outline-1 -outline-offset-1 outline-input";
  return (
    <div data-fact-row={f.id} data-fact-state={f.state} className="flex min-h-[74px] items-center gap-3 border-t border-border py-2.5">
      <FactFace f={f} />
      <button type="button" data-fact-open onClick={onOpen} className="min-w-0 flex-1 text-left">
        <b className="block text-[16px] font-semibold leading-snug">{shown(f)}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{f.why}</small>
      </button>
      {f.state === "disputed" ? (
        <NavLink href={paths.deskItem("fact", f.id)} data-decide className={act}>
          Decide
        </NavLink>
      ) : f.unknown ? (
        <button type="button" data-who onClick={onWho} className={act}>
          Who?
        </button>
      ) : (
        <span className="flex flex-none gap-1.5">
          <button type="button" data-reject aria-label={`Reject ${shown(f)}`} onClick={onNo} className={`${act} w-11 px-0`}>
            <X className="size-5" aria-hidden />
          </button>
          <button type="button" data-accept aria-label={`Accept ${shown(f)}`} onClick={onYes} className={`${act} w-11 px-0`}>
            <Check className="size-5" aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}

/** One result in every game (the mock's rsGRow): up to three faces, what, who, and how sure. */
function GroupRow({ label, facts, onClick }: { label: string; facts: EpisodeFact[]; onClick: () => void }) {
  const names = facts.map((f) => (f.kind === "noexit" ? "Nobody" : f.name.split(" ")[0]));
  const who = names.length > 3 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const canon = facts.find((f) => f.state === "canon");
  const least = Math.min(...facts.map((f) => f.sources));
  return (
    <button type="button" data-group={label} onClick={onClick} className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2.5 text-left">
      <span className="flex w-[84px] flex-none">
        {facts.slice(0, 3).map((f, i) => (
          <span key={f.id} className={i ? "-ml-2.5" : ""}>
            <FactFace f={f} size={34} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold leading-snug">
          {label}
          {facts.length > 1 && <span className="type-num ml-1.5 text-[15px] text-muted-foreground">{facts.length}</span>}
        </b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {who} · {canon ? `${canon.decidedBy ?? "an admin"} decided` : least >= 2 ? `${least} sources agree` : "1 source, sure of it"}
        </small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

function AnswerLead({ a, size = 40 }: { a: EpisodeAnswer; size?: number }) {
  if (a.kind === "bot")
    return (
      <span className="grid flex-none place-items-center rounded-[3px] bg-plate text-plate-foreground" style={{ width: size, height: size }}>
        <Zap className="size-5" aria-hidden />
      </span>
    );
  return <Avatar id={a.person?.id ?? a.id} name={a.person?.name ?? "?"} size={size} />;
}

const ICONS: Record<NonNullable<MoveLine["icon"]>, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = { check: Check, plus: Plus, x: X, people: Users, poll: BarChart3, split: Split, grid: Grid3x3, repeat: Repeat, user: User };
const moveOf = (f: EpisodeFact, change: string): MoveLine => ({ result: true, face: f.kind === "noexit" || f.unknown ? null : { name: f.name, photo: f.photo }, icon: f.kind === "noexit" ? "x" : null, label: shown(f), change });

/** The guard's tier 2 sheet (the mock's previewSheet): what moves, a line each, then confirm. `lines` null while it's worked out. */
export function MovesSheet({ open, onClose, title, subtitle, lines, cta, undoNote, onConfirm }: { open: boolean; onClose: () => void; title: string; subtitle: string; lines: MoveLine[] | null; cta: string; undoNote: string; onConfirm: () => Promise<void> }) {
  return (
    <GuardSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      subtitle={subtitle}
      lines={lines ? [] : null}
      body={
        lines ? (
          <div data-moves className="flex flex-col gap-1.5">
            {lines.map((l, i) => {
              const Icon = l.icon ? ICONS[l.icon] : null;
              return (
                <div key={i} data-move={l.change} className="flex min-h-12 items-center gap-2.5 rounded-[3px] bg-background p-2.5">
                  {l.swatch ? <span className="mx-2 h-7 w-3 flex-none rounded-[2px]" style={{ background: l.swatch }} aria-hidden /> : l.face ? <Face src={l.face.photo} name={l.face.name} className="size-7 flex-none rounded-[3px]" /> : Icon ? <Icon className="size-6 flex-none" aria-hidden /> : <span className="size-7 flex-none" />}
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{l.label}</span>
                  <span className="text-right text-[13px] font-bold text-muted-foreground">{l.change}</span>
                </div>
              );
            })}
          </div>
        ) : undefined
      }
      cta={cta}
      undoNote={undoNote}
      onConfirm={onConfirm}
    />
  );
}

/** One result (the mock's rsFactSheet): why it's where it is, its sources, and what you can do. */
function FactSheet({
  e,
  f,
  hide,
  onClose,
  onCorrect,
  onOut,
  decide,
  accept,
  reject,
}: {
  e: DeskEpisode;
  f: EpisodeFact | null;
  hide: boolean;
  onClose: () => void;
  onCorrect: (f: EpisodeFact) => void;
  onOut: (f: EpisodeFact) => void;
  decide: (f: EpisodeFact, body: Record<string, unknown>, text: string) => Promise<void>;
  accept: (f: EpisodeFact) => Promise<void>;
  reject: (f: EpisodeFact) => Promise<void>;
}) {
  if (!f) return null;
  const says = e.answers.filter((a) => f.by.includes(a.id));
  const go = (fn: () => Promise<void>) => () => {
    onClose();
    void fn();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={hide && f.state !== "gone" ? "A result" : shown(f)} subtitle={`Episode ${e.n} · ${stat(f)}`}>
      <div data-fact-sheet={f.id}>
        <div className="flex items-center gap-3">
          {!hide && <FactFace f={f} size={56} />}
          <b className="min-w-0 flex-1 text-[16px] leading-snug">{f.state === "live" ? `In ${allGames(e.games)} and the shared stats.` : `${f.why}.`}</b>
        </div>
        <SubHead title="Says it happened" aside={says.length} />
        {says.length ? (
          says.map((a) => (
            <div key={a.id} className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
              <AnswerLead a={a} size={32} />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{a.title}</b>
                <small className="block text-[13px] text-muted-foreground">{a.line.split(" · ").pop()}</small>
              </span>
            </div>
          ))
        ) : (
          <p className="text-[14px] text-muted-foreground">No source now.</p>
        )}
        <div className="mt-4">
          {f.state === "disputed" ? (
            <NavLink href={paths.deskItem("fact", f.id)} data-decide-it onClick={onClose} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-input">
              Decide it
            </NavLink>
          ) : f.state === "wait" && f.unknown ? (
            <Btn data-who-was-it wide onClick={() => onCorrect(f)}>
              Who was it?
            </Btn>
          ) : f.state === "wait" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Btn data-fact-reject onClick={go(() => reject(f))}>
                  Reject
                </Btn>
                <Btn data-fact-accept onClick={go(() => accept(f))}>
                  Accept
                </Btn>
              </div>
              {f.kind !== "noexit" && (
                <button type="button" data-fact-correct onClick={() => onCorrect(f)} className={`${LINK} mt-1`}>
                  Something else: correct it
                </button>
              )}
              <p className={NOTE}>Accepted, it&apos;s locked as you decided and reaches {allGames(e.games)} as each player reveals Episode {e.n}.</p>
            </>
          ) : f.state === "gone" ? (
            <Btn
              data-put-back
              wide
              onClick={go(() => decide(f, f.decidedBy && f.community ? { reopen: true } : { decide: "yes" }, f.decidedBy && f.community ? "Put back · its sources decide it again" : `Put back · in ${allGames(e.games)}`))}
            >
              Put it back
            </Btn>
          ) : (
            <>
              {f.kind !== "noexit" && (
                <Btn data-fact-correct wide onClick={() => onCorrect(f)}>
                  Correct it
                </Btn>
              )}
              {f.state === "canon" ? (
                f.community && (
                  <Btn data-unlock wide className="mt-2" onClick={go(() => decide(f, { reopen: true }, "Unlocked · its sources decide it again"))}>
                    Unlock it
                  </Btn>
                )
              ) : (
                <Btn data-take-out wide className="mt-2" onClick={() => onOut(f)}>
                  Take it out of every game
                </Btn>
              )}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** A result in every game, by what happened, or the ones rejected or taken out (`label` null). */
function GroupSheet({ e, label, onClose, onFact }: { e: DeskEpisode; label: string | null | undefined; onClose: () => void; onFact: (f: EpisodeFact) => void }) {
  const F = label === undefined ? [] : label === null ? e.facts.filter((f) => f.state === "gone") : e.facts.filter((f) => f.label === label && (f.state === "live" || f.state === "canon"));
  return (
    <Sheet open={label !== undefined} onOpenChange={(o) => !o && onClose()} title={label ?? "Rejected or taken out"} subtitle={`Episode ${e.n} · ${plural(F.length, "result")}`}>
      <div data-group-sheet className="border-b border-border">
        {F.map((f) => (
          <DeskRow key={f.id} data="group-fact" onClick={() => onFact(f)} lead={<FactFace f={f} />} title={f.kind === "noexit" ? "Nobody went home" : f.unknown ? `“${f.name}”` : f.name} line={stat(f)} />
        ))}
      </div>
    </Sheet>
  );
}

/** Correct it (the mock's rsCorSheet): who it was and what happened; then it's yours, canonical and locked. */
function CorrectSheet({ e, f, onClose, decide }: { e: DeskEpisode; f: EpisodeFact | null; onClose: () => void; decide: (f: EpisodeFact, body: Record<string, unknown>, text: string) => Promise<void> }) {
  const [who, setWho] = useState<string | null>(null);
  const [what, setWhat] = useState<string | null>(null);
  const shut = () => {
    setWho(null);
    setWhat(null);
    onClose();
  };
  if (!f) return null;
  const name = who ?? (f.unknown ? f.guess : f.name);
  const options = f.kind === "elimination" ? e.choices.methods.map((m) => [m, m] as const) : f.kind === "event" ? e.choices.events.map((x) => [x.id, x.label] as const) : [];
  const current = f.kind === "event" ? (e.choices.events.find((x) => x.label === f.label)?.id ?? "") : f.label;
  // An exit with no way out given (or a moment not in the list) starts on the list's first, as the select shows it.
  const value = what ?? (options.some(([v]) => v === current) ? current : (options[0]?.[0] ?? current));
  const label = options.find(([v]) => v === value)?.[1] ?? f.label;
  return (
    <Sheet open onOpenChange={(o) => !o && shut()} title="Correct it" subtitle={`Episode ${e.n} · ${shown(f)}`}>
      <p className="mb-2 text-[14px] font-bold text-muted-foreground">Who was it?</p>
      <div role="radiogroup" aria-label="Who was it?" className="grid grid-cols-4 gap-2">
        {e.choices.cast.map((c) => (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={c.name === name}
            data-who-pick={c.name}
            onClick={() => setWho(c.name)}
            className={`nd-press flex flex-col overflow-hidden rounded-[3px] bg-card text-left ${c.name === name ? "outline-2 -outline-offset-2 outline-chyron" : ""}`}
          >
            <Face src={c.photo} name={c.name} className="aspect-square w-full text-xl" />
            <span className="truncate px-1.5 py-1 text-center text-[13px] font-semibold">{c.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      {options.length > 0 && (
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[14px] font-bold text-muted-foreground">What happened</span>
          <select data-what value={value} onChange={(ev) => setWhat(ev.target.value)} className="h-12 w-full rounded-[3px] bg-background px-3 text-[16px] outline-1 -outline-offset-1 outline-input">
            {options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
      <Btn
        data-correct-go
        tone="must"
        wide
        className="mt-4"
        disabled={!name}
        onClick={() => {
          if (!name) return;
          shut();
          void decide(
            f,
            { edit: { castawayName: name, ...(f.kind === "elimination" ? { method: value } : f.kind === "event" ? { eventType: value } : {}) } },
            `Corrected · ${name.split(" ")[0]} · ${label}, in ${allGames(e.games)}`
          );
        }}
      >
        Correct and accept
      </Btn>
      <p className={NOTE}>It&apos;s locked as you decided, and reaches {allGames(e.games)} as each player reveals Episode {e.n}.</p>
    </Sheet>
  );
}

/** Take a result out of every game (tier 2, the mock's rsTakeOut). */
function TakeOutSheet({ e, f, onClose, decide }: { e: DeskEpisode; f: EpisodeFact | null; onClose: () => void; decide: (f: EpisodeFact, body: Record<string, unknown>, text: string) => Promise<void> }) {
  return (
    <MovesSheet
      open={!!f}
      onClose={onClose}
      title="Take it out of every game?"
      subtitle={f ? `Episode ${e.n} · ${shown(f)}` : ""}
      lines={
        f
          ? [
              moveOf(f, "Out, and locked"),
              { face: null, icon: "people", label: `Its ${plural(e.games, "game")}`, change: "Scored again as each reveals it" },
              { face: null, icon: "poll", label: "Shared stats and trivia", change: "Leave it out" },
            ]
          : []
      }
      cta="Take it out"
      undoNote="Put it back from its row, or Undo."
      onConfirm={async () => {
        if (f) await decide(f, { decide: "no" }, "Taken out of every game");
      }}
    />
  );
}

/** An answer (the mock's rsAnsSheet): what it reported, and Take it back. */
function AnswerSheet({ e, a, hide, onClose, onTake }: { e: DeskEpisode; a: EpisodeAnswer | null; hide: boolean; onClose: () => void; onTake: (a: EpisodeAnswer) => void }) {
  if (!a) return null;
  const only = e.facts.filter((f) => a.only.includes(f.id));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={a.title} subtitle={`Episode ${e.n} · ${a.line.split(" · ").pop()}`}>
      <ul data-answer-sheet={a.id} className="flex flex-col gap-3">
        <li className="flex gap-3 text-[15px] leading-snug">
          <Check className="mt-0.5 size-5 flex-none" aria-hidden />
          <span>
            {plural(a.mine.length, "result")}: {a.mine.length - a.only.length} with another source agreeing{a.only.length ? `, ${a.only.length} only it reported` : ""}.
          </span>
        </li>
        <li className="flex gap-3 text-[15px] leading-snug">
          {a.kind === "bot" ? <Zap className="mt-0.5 size-5 flex-none" aria-hidden /> : <Users className="mt-0.5 size-5 flex-none" aria-hidden />}
          <span>{a.detail}</span>
        </li>
      </ul>
      {only.length > 0 && !hide && (
        <>
          <SubHead title="Only it reported" />
          {only.map((f) => (
            <div key={f.id} className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
              <FactFace f={f} size={32} />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{shown(f)}</b>
                <small className="block text-[13px] text-muted-foreground">{f.state === "live" || f.state === "canon" ? "In every game" : "Not in the games yet"}</small>
              </span>
            </div>
          ))}
        </>
      )}
      <Btn data-take-back wide className="mt-4" onClick={() => onTake(a)}>
        Take it back
      </Btn>
      <p className={NOTE}>Its results lose it as a source. What only it reported leaves every game; the rest stay.</p>
    </Sheet>
  );
}

/** What a change would move, from the server's dry run (Take it back): asked once each time its sheet opens. */
function usePreview(key: string | null, body: unknown, path: string, onFail: () => void) {
  return useQuery({
    // Not under "new-design": a change's every-read refresh would ask again (an answer just taken back is gone: a 404).
    queryKey: ["desk-preview", path, key],
    queryFn: async () => {
      try {
        return (await deskSend<{ lines: MoveLine[] }>(path, body)).lines;
      } catch (err) {
        toast.quiet((err as Error).message);
        onFail();
        throw err;
      }
    },
    enabled: !!key,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** Names hidden: the results with faces said as a count, the rest as they are. */
function counted(lines: MoveLine[] | null | undefined, hide: boolean, change: string, icon: "x" | "plus"): MoveLine[] | null {
  if (!lines) return null;
  const faces = lines.filter((l) => l.result);
  if (!hide || !faces.length) return lines;
  const rest = lines.filter((l) => !l.result);
  const games = rest.findIndex((l) => l.icon === "people");
  const one: MoveLine = { face: null, icon, label: plural(faces.length, "result"), change };
  return games < 0 ? [...rest, one] : [...rest.slice(0, games), one, ...rest.slice(games)];
}

/** Take it back (tier 2): the server works out what moves first. */
function TakeBackSheet({ path, e, a, hide, onClose, done }: { path: string; e: DeskEpisode; a: EpisodeAnswer | null; hide: boolean; onClose: () => void; done: (o: { changeId: string; text: string }) => Promise<void> }) {
  const preview = usePreview(a?.id ?? null, { takeBack: a?.id, preview: true }, path, onClose);
  return (
    <MovesSheet
      open={!!a}
      onClose={onClose}
      title="Take it back?"
      subtitle={a ? `${a.title} · Episode ${e.n}` : ""}
      lines={counted(preview.data, hide, "Out of every game", "x")}
      cta="Take it back"
      undoNote="Undo puts it back as a source."
      onConfirm={async () => {
        if (a) await done(await deskSend<{ changeId: string; text: string }>(path, { takeBack: a.id }));
      }}
    />
  );
}

/** A paste, read: what it would add (tier 2), then Add it files it as a source of the desk's own. */
function AddedSheet({ path, e, hide, paste, onClose, done }: { path: string; e: DeskEpisode; hide: boolean; paste: { answer: string; confirmed: boolean; lines: MoveLine[] } | null; onClose: () => void; done: (o: { changeId: string; text: string }) => Promise<void> }) {
  return (
    <MovesSheet
      open={!!paste}
      onClose={onClose}
      title="Add it as a source?"
      subtitle={`Episode ${e.n} · your paste`}
      lines={counted(paste?.lines, hide, "Into every game", "plus")}
      cta="Add it"
      undoNote="Take it back from its row, or Undo."
      onConfirm={async () => {
        if (paste) await done(await deskSend<{ changeId: string; text: string }>(path, { paste: paste.answer, confirmed: paste.confirmed }));
      }}
    />
  );
}

/** A trivia question (the mock's rsTrivSheet): it as a plate, why it's in or out, and Take it out or Put it back. */
function TriviaSheet({ path, e, t, hide, onClose, done }: { path: string; e: DeskEpisode; t: TriviaQuestion | null; hide: boolean; onClose: () => void; done: (o: { changeId: string; text: string }) => Promise<void> }) {
  if (!t) return null;
  const flip = async (out: boolean) => {
    onClose();
    try {
      await done(await deskSend<{ changeId: string; text: string }>(path, { trivia: t.id, out }));
    } catch (err) {
      toast.quiet((err as Error).message);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="A question" subtitle={`Trivia · written after Episode ${e.n}`}>
      <div data-trivia-sheet={t.id} className="rounded-[3px] bg-plate p-4 text-[18px] font-bold leading-snug text-plate-foreground">
        {t.question}
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {t.out ? (
          <li className="flex gap-3 text-[15px] leading-snug">
            <X className="mt-0.5 size-5 flex-none" aria-hidden />
            <span>Out: {t.out}.</span>
          </li>
        ) : (
          <>
            <li className="flex gap-3 text-[15px] leading-snug">
              <Check className="mt-0.5 size-5 flex-none" aria-hidden />
              <span>
                {hide ? "" : `The answer: ${t.answer}. `}Its check found a page saying so, one right answer, nothing past Episode {e.n}.
              </span>
            </li>
            <li className="flex gap-3 text-[15px] leading-snug">
              <CircleHelp className="mt-0.5 size-5 flex-none" aria-hidden />
              <span>Two &quot;Wrong?&quot; flags from players take it out for everyone.</span>
            </li>
          </>
        )}
      </ul>
      {!t.out ? (
        <Btn data-trivia-out wide className="mt-4" onClick={() => void flip(true)}>
          Take it out
        </Btn>
      ) : (
        t.byAdmin && (
          <Btn data-trivia-back wide className="mt-4" onClick={() => void flip(false)}>
            Put it back
          </Btn>
        )
      )}
    </Sheet>
  );
}
