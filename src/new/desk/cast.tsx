"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPaste, Lock, Zap } from "lucide-react";
import { pickOf } from "@/lib/desk-cast-diff";
import { AskAiPasteSheet, type AnswerCheck } from "../backstage/ask-ai";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Face } from "../show/parts";
import { GuardSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, type CastFace, type CastPicks, type CastReviewChange, type DeskCast, type MoveLine } from "./data";
import { MovesSheet } from "./episode";
import { DeskHeader, DeskRow, Facts, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { SeasonDeleteRow } from "./setup";

// A season's Cast (docs/PLAN-desk-parity.md step 5, part 5a; the mock's desk-cast.js csPage), from the season page's Running it
// and the Inbox's cast item: the lower third (In the games, Not sent, No cast), where its cast came from and when it was sent;
// an answer that changes something leads (See what changed: a new spelling asks Same person or Someone new, a starting group it
// has differently Keep ours or Use theirs, someone new joins as nobody's, someone it no longer lists is only said), then Send to
// its games (tier 2, what moves said first). Getting it: Ask our bot (queued behind the other Run nows; the page polls while
// it asks) or Paste it (Ask an AI on the same question). Then its starting groups, the cast by group, History and the season's
// Delete. Server: src/lib/server/desk-cast-page.ts. Starting groups' Hold and secret roles together, and a castaway's page, are
// part 5b's.

const NOTE = "mt-2.5 text-[13px] leading-snug text-muted-foreground";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const firstOf = (name: string) => name.split(" ")[0];

/** A pasted answer looks whole: JSON with a list of castaways. */
const checkCast: AnswerCheck = (text) => {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  let n = 0;
  try {
    const json = a >= 0 && b > a ? JSON.parse(text.slice(a, b + 1)) : null;
    n = Array.isArray(json?.castaways) ? json.castaways.length : 0;
  } catch {
    n = 0;
  }
  return n ? { ok: true, line: `Looks right: ${plural(n, "person", "people")}` } : { ok: false, line: "That doesn't look like the whole answer. Copy all of it, from { to }." };
};

type SheetState = { k: "diff" } | { k: "send"; lines: MoveLine[] | null; title: string } | { k: "paste" } | { k: "clear"; group: string; preview: { people: number; leagues: number } | null } | null;

export function CastPage({ id }: { id: string }) {
  const path = `/seasons/${id}/cast`;
  const q = useQuery({
    queryKey: ["new-design", "desk", path],
    queryFn: () => deskGet<DeskCast>(path),
    staleTime: 15_000,
    // While our bot looks it up: its answer as it lands.
    refetchInterval: (x) => (x.state.data?.asking ? 4000 : false),
    retry: (n, e) => (e as { status?: number }).status !== 403 && (e as { status?: number }).status !== 404 && n < 2,
  });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [picks, setPicks] = useState<CastPicks>({});
  const [busy, setBusy] = useState(false);
  const after = useAfterDesk();
  const changed = useChangeToast();
  const back = { label: "Season", href: paths.deskItem("season", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Cast" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Cast" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const d = q.data;
  const close = () => setSheet(null);
  const ask = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await deskSend<{ text: string; waits: string | null }>(path, { ask: true });
      await after();
      toast(r.waits ? `${r.text} · ${r.waits}` : r.text);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openDiff = () => {
    setPicks({});
    setSheet({ k: "diff" });
  };
  const review = d.review;
  const toSend = async () => {
    if (!review) return;
    setSheet({ k: "send", lines: null, title: d.games ? `Send to its ${plural(d.games, "game")}?` : "Send it?" });
    try {
      const p = await deskSend<{ lines: MoveLine[]; title: string }>(path, { send: true, answer: review.answerId, picks, preview: true });
      setSheet({ k: "send", lines: p.lines, title: p.title });
    } catch (e) {
      close();
      toast.quiet((e as Error).message);
      await after();
    }
  };
  const secret = d.groups.some((g) => g.secretRole);
  const T = d.terms;
  return (
    <div className="pb-16" data-desk-cast={d.state}>
      <DeskHeader title="Cast" back={{ label: d.name, href: paths.deskItem("season", id) }} name="Cast" />
      <LowerThird tag={d.tag} tone={d.state === "none" ? "stopped" : "quiet"} title={d.name} detail={d.detail} />
      {(d.meta || d.asking) && (
        <Facts>
          {d.asking && (
            <span data-cast-asking className="block font-semibold text-foreground">
              {d.asking}
            </span>
          )}
          {d.meta}
        </Facts>
      )}

      {review && (
        <Section>
          <div data-cast-review className="rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[18px] font-semibold leading-snug">{review.title}</b>
            <small className="mt-1 block text-[15px] leading-snug text-muted-foreground">{review.line}</small>
            <Btn data-cast-see tone="must" wide className="mt-4" onClick={openDiff}>
              See what changed
            </Btn>
          </div>
        </Section>
      )}
      {d.state === "none" && (
        <Section>
          <div data-cast-none className="rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[18px] font-semibold leading-snug">No cast yet</b>
            <small className="mt-1 block text-[15px] leading-snug text-muted-foreground">Nothing to draft or pick from until it has one. Our bot looks it up, or you paste it.</small>
            <Btn data-cast-ask tone="must" wide className="mt-4" disabled={busy || !!d.asking} onClick={() => void ask()}>
              Ask our bot for it
            </Btn>
            <Btn data-cast-paste wide className="mt-2" onClick={() => setSheet({ k: "paste" })}>
              Paste it
            </Btn>
          </div>
        </Section>
      )}

      {d.state !== "none" && (
        <Section title="Getting it">
          <div className="border-b border-border">
            <DeskRow
              data="cast-ask"
              onClick={() => void ask()}
              lead={<IconLead icon={Zap} />}
              title="Ask our bot again"
              line={d.asking ? "Asking now: its answer shows here, with what changed" : "ChatGPT reads the cast from the web. Shows what changed before anything is sent"}
            />
            <DeskRow data="cast-paste" onClick={() => setSheet({ k: "paste" })} lead={<IconLead icon={ClipboardPaste} />} title="Paste it" line="Ask an AI yourself, paste its answer, and look it over" />
          </div>
        </Section>
      )}

      {d.groups.length > 0 && (
        <Section title={`Starting ${T.groups}`} aside={plural(d.groups.length, T.group, T.groups)}>
          <div className="flex flex-col gap-2">
            {d.groups.map((g) => (
              <div key={g.name} data-group={g.name} className="flex items-center gap-3 rounded-[4px] bg-card p-3">
                <span className="h-9 w-2.5 flex-none rounded-[2px]" style={{ background: g.color ?? "var(--input)" }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{g.name}</b>
                  <small className="block text-[13px] text-muted-foreground">
                    {g.people} start in it{g.secretRole ? " · named like a secret role, so it gives the role away" : ""}
                  </small>
                </span>
                <Btn
                  data-clear-group={g.name}
                  className="h-10 px-3 text-[13px]"
                  onClick={async () => {
                    setSheet({ k: "clear", group: g.name, preview: null });
                    const p = await deskSend<{ people: number; leagues: number }>(`/seasons/${id}`, { clearGroup: g.name, preview: true }).catch(() => null);
                    setSheet({ k: "clear", group: g.name, preview: p });
                  }}
                >
                  Not a {T.group}
                </Btn>
              </div>
            ))}
          </div>
          <p className={NOTE}>These are the {T.groups} they started in. After a swap, each game&apos;s {T.groups} come from the episode&apos;s results.</p>
        </Section>
      )}

      {d.cast.length > 0 && (
        <Section title={`The ${T.people}`} aside={`${d.cast.length}${d.cast.some((c) => c.out) ? ` · ${d.cast.filter((c) => c.out).length} out` : ""}`}>
          <CastGrid d={d} secret={secret} />
          {secret && <p className={NOTE}>Shown still in or out: a {T.group} here would give the secret role away.</p>}
        </Section>
      )}

      <LatestHistory lines={d.history} emptyLine="Nothing yet." />
      <SeasonDeleteRow id={id} del={d.delete} showId={d.show.id} />

      {review && <DiffSheet open={sheet?.k === "diff"} onClose={close} d={d} picks={picks} setPicks={setPicks} onSend={() => void toSend()} />}
      <MovesSheet
        open={sheet?.k === "send"}
        onClose={close}
        title={sheet?.k === "send" ? sheet.title : ""}
        subtitle={`${d.name} · ${review ? plural(review.changes.filter((c) => c.change.k !== "gone").length, "change") : ""}`}
        lines={sheet?.k === "send" ? sheet.lines : null}
        cta={d.games ? `Send to ${plural(d.games, "game")}` : "Send it"}
        undoNote="Undo from History puts the cast back as it was sent."
        onConfirm={async () => {
          try {
            const out = await deskSend<{ changeId: string; text: string }>(path, { send: true, answer: review?.answerId ?? null, picks });
            close();
            await after();
            changed(out.text, out.changeId);
          } catch (e) {
            close();
            toast.quiet((e as Error).message);
            await after();
          }
        }}
      />
      <AskAiPasteSheet
        open={sheet?.k === "paste"}
        onOpenChange={(o) => !o && close()}
        title={`${d.name}'s cast`}
        subtitle="Ask an AI · about 2 minutes"
        what={`Your AI searches the web for everyone in ${d.name}, then answers in a form we read. Paste it back, look it over, and send it to its games.`}
        check={checkCast}
        tag="desk-cast"
        question={{ key: ["new-design", "desk-question", id, "cast"], load: () => deskGet<{ prompt: string | null; task: string }>(`${path}/question`) }}
        onUse={async (text) => {
          const r = await deskSend<{ text: string }>(path, { paste: text });
          const next = await q.refetch();
          await after();
          // What it changes opens straight away; an answer that changes nothing says so.
          if (next.data?.review) openDiff();
          else {
            close();
            toast(r.text);
          }
        }}
      />
      {sheet?.k === "clear" && (
        <GuardSheet
          open
          onOpenChange={(o) => !o && close()}
          title={`Take out ${sheet.group}?`}
          subtitle="A secret role, not a group: off the season's cast and out of every league on it"
          lines={sheet.preview ? [] : null}
          body={
            sheet.preview ? (
              <p data-clear-preview className="rounded-[3px] bg-background p-3 text-[14px] leading-snug">
                {sheet.preview.people} {sheet.preview.people === 1 ? "person starts" : "people start"} in {sheet.group}. {sheet.preview.leagues}{" "}
                {sheet.preview.leagues === 1 ? "league loses it" : "leagues lose it"}: nobody is on it, and no board shows it.
              </p>
            ) : undefined
          }
          cta={`Take out ${sheet.group}`}
          undoNote="Undo it from History: the group goes back on the same people."
          onConfirm={async () => {
            try {
              await deskSend(`/seasons/${id}`, { clearGroup: sheet.group });
              await after();
              toast(`${sheet.group} taken out`);
            } catch (e) {
              toast.quiet((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

/** The cast by starting group, four across (the real desk's grid); with a secret-role group, Still in and Out instead. */
function CastGrid({ d, secret }: { d: DeskCast; secret: boolean }) {
  const T = d.terms;
  const groups: [string, CastFace[], string | null][] =
    secret || !d.groups.length
      ? [
          ["Still in", d.cast.filter((c) => !c.out), null],
          ["Out", d.cast.filter((c) => c.out), null],
        ]
      : [
          ...d.groups.map((g): [string, CastFace[], string | null] => [g.name, d.cast.filter((c) => c.group === g.name), g.color]),
          [`No ${T.group}`, d.cast.filter((c) => !c.group), null],
        ];
  return (
    <div className="flex flex-col gap-4">
      {groups
        .filter(([, L]) => L.length)
        .map(([name, L, color]) => (
          <div key={name} data-cast-group={name}>
            <div className="mb-2 flex items-baseline gap-2">
              {color && <i className="inline-block size-3.5 self-center rounded-[2px]" style={{ background: color }} aria-hidden />}
              <b className="type-caption text-[22px] leading-none">{name}</b>
              <small className="text-[14px] text-muted-foreground">{L.length}</small>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {L.map((c) => (
                <NavLink
                  key={c.id}
                  href={paths.deskItem("castaway", c.id)}
                  data-castaway={c.name}
                  data-out={c.out ?? undefined}
                  className="nd-press flex flex-col overflow-hidden rounded-[3px] bg-plate text-plate-foreground"
                >
                  <Face src={c.photo} name={c.name} className={`aspect-square w-full text-xl ${c.out ? "grayscale" : ""}`} />
                  <span className="px-1.5 py-1">
                    <b className="type-caption block truncate text-[12px]">{firstOf(c.name)}</b>
                    <small className="block truncate text-[11px] text-plate-muted">{c.out ? `Out · Ep ${c.out}` : c.locked ? "Locked" : "Still in"}</small>
                  </span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

/** What changed (the mock's csDiffSheet): each change and its choice, then Send to its games. */
function DiffSheet({ open, onClose, d, picks, setPicks, onSend }: { open: boolean; onClose: () => void; d: DeskCast; picks: CastPicks; setPicks: (p: CastPicks) => void; onSend: () => void }) {
  const r = d.review!;
  const T = d.terms;
  const pick = (c: CastReviewChange["change"]) => pickOf(c, picks);
  const seg = (c: CastReviewChange["change"], opts: [string, string][]) => (
    <div className="mt-2.5 flex gap-[3px] rounded-[3px] bg-background p-[3px] outline-1 -outline-offset-1 outline-input" role="radiogroup" aria-label={c.k === "spell" ? "Same person?" : `Starting ${T.group}`}>
      {opts.map(([v, t]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={pick(c) === v}
          data-pick={v}
          onClick={() => setPicks({ ...picks, [c.key]: v as CastPicks[string] })}
          className={`h-11 flex-1 rounded-[2px] text-[14px] font-bold ${pick(c) === v ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
  const row = ({ change: c, photo, note }: CastReviewChange) => {
    const head = (title: string, line: string) => (
      <div className="flex items-center gap-3">
        <Face src={photo} name={c.k === "add" ? c.name : c.k === "spell" ? c.from : c.name} className="size-11 flex-none rounded-[3px] text-base" />
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] font-semibold leading-snug">{title}</b>
          <small className="block text-[14px] leading-snug text-muted-foreground">{line}</small>
        </span>
      </div>
    );
    if (c.k === "spell")
      return (
        <>
          {head(c.to, `A new spelling of ${c.from}?`)}
          {seg(c, [
            ["same", "Same person"],
            ["new", "Someone new"],
          ])}
          <p className={NOTE}>{pick(c) === "same" ? `${firstOf(c.from)} is renamed in every game. Teams, picks and results keep them.` : `${c.to} joins every game as nobody's, beside ${firstOf(c.from)}. Usually it's a spelling.`}</p>
        </>
      );
    if (c.k === "group")
      return (
        <>
          {head(`The answer says ${firstOf(c.name)} started on ${c.to}`, note ?? `We have ${c.from ?? `no ${T.group}`}.`)}
          {seg(c, [
            ["ours", c.from ? `Keep ${c.from}` : `Keep no ${T.group}`],
            ["theirs", `Use ${c.to}`],
          ])}
        </>
      );
    if (c.k === "add") return head(c.name, `New${c.group ? ` · starts on ${c.group}` : ""}: joins every game as nobody's`);
    return head(c.name, "Not in this answer. They stay in every game: remove them from their page if they shouldn't be here");
  };
  const many = r.changes.filter((c) => c.change.k === "add").length > 6;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="What changed" subtitle={`${d.name} · ${r.from}`}>
      <div data-cast-diff className="flex flex-col">
        {r.first && (
          <p data-cast-first className="mb-3 text-[15px] leading-snug">
            {d.games ? `Everyone in it joins its ${plural(d.games, "game")}.` : "It's sent to the first game made on it."}
          </p>
        )}
        {r.changes.map((c, i) => (
          <div key={c.change.key} data-change={c.change.k} data-change-key={c.change.key} className={`${i ? "mt-3.5 border-t border-border pt-3.5" : ""} ${many && c.change.k === "add" ? "!mt-1.5 !pt-1.5" : ""}`}>
            {row(c)}
          </div>
        ))}
        <ul className="mt-4 flex flex-col gap-3">
          <li className="flex gap-3 text-[15px] leading-snug">
            <Lock className="mt-0.5 size-5 flex-none" aria-hidden />
            <span>Sending never takes anyone out of a game. Someone the answer no longer lists shows here, to remove from their page.</span>
          </li>
        </ul>
        <Btn data-cast-send tone="must" wide className="mt-4" onClick={onSend}>
          {d.games ? `Send to its ${plural(d.games, "game")}` : "Send it"}
        </Btn>
      </div>
    </Sheet>
  );
}
