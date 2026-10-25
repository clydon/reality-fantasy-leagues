"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BookOpen, Check, Eye, Plus, ShieldCheck, Trophy, Users, X } from "lucide-react";
import { backstage, ourRules, useAfterResults, useScoringRules, type GameRules, type OurRules, type PreviewLine } from "../data";
import { gameColour } from "../games";
import type { ShowData } from "../screens/show-space";
import { HowItWorksPage } from "../show/how-it-works";
import { GuardSheet } from "../ui/guards";
import { usePushedPage } from "../ui/page";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Stepper } from "./waivers";

// Backstage › Scoring rules (the mock's backstage.js bsRules with rulebook.js's rbBsHead, docs/PLAN-new-design.md steps 6a
// and 6b part 3): which rulebook these games follow, or the couch's own copy (Make it ours: choose what counts, add moments
// the couch answers, the show's changes asked first, Follow it again), How it works, and each game's points as it counts
// them, which a Commissioner can change (the season is scored again). Anything that can move standings is previewed
// first; every change has its Undo on the toast and in Recent changes.

type Ours = OurRules;
const pts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

export function RulesPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const data = useScoringRules(seasonId, couchId);
  const how = usePushedPage("how-it-works");
  const after = useAfterResults();
  const [sheet, setSheet] = useState<"ours" | "follow" | "counts" | "add" | null>(null);
  if (data.error) return <EmptyState icon={Trophy} title="Scoring rules aren't yours to see here" line={(data.error as Error).message} />;
  if (!data.data || !couchId) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const { rulebook, games, ours } = data.data;
  const copy = ours.copy;

  /** A change made: its toast, with Undo through Recent changes. */
  const done = async (batch: string | null | undefined, said: string) => {
    await after();
    if (!batch) return;
    toast(said, {
      undo: async () => {
        try {
          await backstage.undo(seasonId, couchId, batch);
          await after();
          toast("Undone");
        } catch (e) {
          toast((e as Error).message);
        }
      },
    });
  };

  return (
    <div className="pb-12">
      <section className="mt-6 px-4">
        <div data-rulebook data-ours={copy ? "yes" : "no"} className="flex items-start gap-3.5 rounded-[4px] bg-card p-3.5">
          <span className="grid size-11 flex-none place-items-center rounded-[3px] bg-foreground text-background">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <b className="block text-[18px] leading-tight">{copy ? "Your couch's own rulebook" : `Following ${rulebook.season ? `${rulebook.name}'s` : `the ${rulebook.name}`} rulebook`}</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              {copy
                ? `Copied from ${copy.from}. You choose what counts. Fixes still reach you; when the show changes, you choose.`
                : `What can happen in the show, shared by every couch on it. Updates reach you on their own.${rulebook.following > 1 ? ` ${rulebook.following} games play by it.` : ""}`}
            </small>
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Btn data-rules-how onClick={() => how.show()}>
            <BookOpen className="size-[18px]" aria-hidden />
            How it works
          </Btn>
          {copy ? (
            <Btn data-follow-again onClick={() => (ours.canChange ? setSheet("follow") : toast("Only a Commissioner changes the rules"))}>
              Follow it again
            </Btn>
          ) : (
            <Btn data-make-ours onClick={() => (ours.canChange ? setSheet("ours") : toast("Only a Commissioner changes the rules"))}>
              Make it ours
            </Btn>
          )}
        </div>
        {ours.ownRules.length > 0 && (
          <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">
            {ours.ownRules.join(" and ")} {ours.ownRules.length === 1 ? "plays" : "play"} by rules of {ours.ownRules.length === 1 ? "its" : "their"} own from the classic app, so {ours.ownRules.length === 1 ? "it keeps" : "they keep"} them.
          </p>
        )}
        {copy && ours.updates.length > 0 && <Updates seasonId={seasonId} couchId={couchId} ours={ours} done={done} />}
      </section>

      {copy && (
        <section className="mt-7 px-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="type-caption text-[24px] leading-none">What counts</h2>
            <span className="text-[13px] text-muted-foreground">Your copy</span>
          </div>
          <button
            type="button"
            data-what-counts
            onClick={() => (ours.canChange ? setSheet("counts") : toast("Only a Commissioner changes the rules"))}
            className="nd-press flex min-h-[60px] w-full items-center gap-3 border-b border-border py-2 text-left"
          >
            <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-secondary">
              <Check className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">
                {ours.moments.filter((m) => m.counts).length} of {ours.moments.length} moments count
              </b>
              <small className="text-[13px] text-muted-foreground">Turn any of them off</small>
            </span>
          </button>
          {ours.own.map((m) => (
            <OwnMoment key={m.id} seasonId={seasonId} couchId={couchId} m={m} canChange={ours.canChange} done={done} />
          ))}
          {ours.canChange && (
            <button type="button" data-add-moment onClick={() => setSheet("add")} className="nd-press mt-3 flex w-full items-center gap-3 rounded-[3px] p-3 text-left outline-1 -outline-offset-1 outline-input">
              <Plus className="size-5 flex-none" aria-hidden />
              <span className="min-w-0">
                <b className="block text-[15px]">Add a moment</b>
                <small className="block text-[13px] leading-snug text-muted-foreground">Something the show doesn&apos;t track. The couch answers it each episode.</small>
              </span>
            </button>
          )}
        </section>
      )}

      <p className="mx-4 mt-6 flex items-start gap-2 text-[14px] leading-snug text-muted-foreground">
        <Trophy className="mt-0.5 size-4 flex-none" aria-hidden />
        Points are always the couch&apos;s to change, whichever rulebook you follow.
      </p>
      {games.map((g) => (
        <GamePoints key={g.leagueId} g={g} seasonId={seasonId} couchId={couchId} canChange={ours.canChange} done={done} />
      ))}

      {sheet === "ours" && <OursSheet seasonId={seasonId} couchId={couchId} name={rulebook.name} onClose={() => setSheet(null)} done={done} />}
      {sheet === "follow" && copy && <FollowSheet seasonId={seasonId} couchId={couchId} from={copy.from} onClose={() => setSheet(null)} done={done} />}
      {sheet === "counts" && <CountsSheet seasonId={seasonId} couchId={couchId} ours={ours} onClose={() => setSheet(null)} done={done} />}
      {sheet === "add" && <AddMomentSheet seasonId={seasonId} couchId={couchId} onClose={() => setSheet(null)} done={done} />}
      {show.header && <HowItWorksPage seasonId={seasonId} couchId={couchId} name={show.header.show.name} seasonNumber={show.header.seasonNumber} artUrl={show.header.show.artUrl} />}
    </div>
  );
}

type Done = (batch: string | null | undefined, said: string) => Promise<void>;

function OursSheet({ seasonId, couchId, name, onClose, done }: { seasonId: string; couchId: string; name: string; onClose: () => void; done: Done }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Make it ours?" subtitle={`${name}'s rulebook, copied for this couch`}>
      <ul data-ours-sheet className="flex flex-col gap-3">
        {(
          [
            [Check, "Choose what counts", "Turn moments off, or add your own that the couch answers"],
            [ShieldCheck, "Fixes still reach you", "When a result or a rule is corrected, your copy gets it too"],
            [Bell, "Show changes ask first", "A new twist comes as a suggestion: add it or skip it"],
          ] as const
        ).map(([Icon, t, d]) => (
          <li key={t} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-5 flex-none" aria-hidden />
            <span>
              <b className="block text-[15px]">{t}</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">{d}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] leading-snug text-muted-foreground">Points are already yours either way. Follow it again any time.</p>
      <Btn
        data-ours-confirm
        tone="must"
        wide
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await ourRules.make(seasonId, couchId);
            onClose();
            await done(r.batch, "It's yours now · undo from Recent changes");
          } catch (e) {
            toast((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Make it ours
      </Btn>
    </Sheet>
  );
}

function FollowSheet({ seasonId, couchId, from, onClose, done }: { seasonId: string; couchId: string; from: string; onClose: () => void; done: Done }) {
  const [p, setP] = useState<{ lines: PreviewLine[]; off: number; own: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    ourRules
      .followPreview(seasonId, couchId)
      .then((r) => live && setP(r))
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
  }, [seasonId, couchId]);
  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-3 rounded-[3px] bg-background p-2.5 text-[15px]">
      <span className="font-semibold">{label}</span>
      <span className="text-right text-[13px] font-bold text-muted-foreground">{value}</span>
    </div>
  );
  return (
    <GuardSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Follow it again?"
      subtitle={failed ?? `Your copy goes. ${from}'s rulebook comes back, with every update since.`}
      head={
        p && (
          <div data-follow-summary className="flex flex-col gap-1.5">
            {row("Moments you turned off", p.off ? `${p.off} count again` : "None")}
            {row("Your own moments", p.own ? `${p.own} removed` : "None")}
            {row("Points", "Stay as you set them")}
          </div>
        )
      }
      lines={failed ? [] : (p?.lines ?? null)}
      cta="Follow it again"
      undoNote="Undo from Recent changes."
      onConfirm={async () => {
        const r = await ourRules.follow(seasonId, couchId);
        await done(r.batch, "Following it again");
      }}
    />
  );
}

/** The show changed (from the desk): asked first, and only once you've seen its episode. */
function Updates({ seasonId, couchId, ours, done }: { seasonId: string; couchId: string; ours: Ours; done: Done }) {
  const [taking, setTaking] = useState<Ours["updates"][number] | null>(null);
  const hidden = ours.updates.filter((u) => u.status === "hidden");
  return (
    <div data-updates className="mt-3 flex flex-col gap-2">
      {ours.updates
        .filter((u) => u.status !== "hidden")
        .map((u) => (
          <div key={u.id} data-update={u.status} className="flex items-start gap-3 rounded-[4px] bg-card p-3.5">
            <span className="w-9 flex-none text-center">
              <small className="type-caption block text-[11px] text-muted-foreground">Ep</small>
              <b className="type-num text-[26px] leading-none">{u.from}</b>
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">The show changed</b>
              {u.lines.map((l) => (
                <small key={l} className="block text-[13px] leading-snug text-muted-foreground">
                  {l}
                </small>
              ))}
              <small className="mt-1 block text-[13px] font-semibold">
                {u.status === "ask" ? "Add it to your rulebook?" : u.status === "added" ? "Added to yours" : "Skipped. Your copy leaves it out"}
              </small>
              {u.status === "ask" && ours.canChange && (
                <span className="mt-2 flex gap-2">
                  <Btn data-update-take className="h-10 flex-1 text-[14px]" onClick={() => setTaking(u)}>
                    Add it
                  </Btn>
                  <Btn
                    data-update-skip
                    className="h-10 flex-1 text-[14px]"
                    onClick={async () => {
                      try {
                        const r = await ourRules.update(seasonId, couchId, u.id, false);
                        await done(r.batch, "Skipped · your copy leaves it out");
                      } catch (e) {
                        toast((e as Error).message);
                      }
                    }}
                  >
                    Skip
                  </Btn>
                </span>
              )}
            </span>
            {u.status === "ask" && <span className="type-caption flex-none rounded-[2px] bg-good px-2 py-0.5 text-[12px] text-good-foreground">New</span>}
          </div>
        ))}
      {hidden.length > 0 && (
        <div data-update-hidden className="flex items-start gap-3 rounded-[4px] bg-card p-3.5 text-muted-foreground">
          <Eye className="mt-0.5 size-5 flex-none" aria-hidden />
          <span>
            <b className="block text-[15px] text-foreground">
              {hidden.length} {hidden.length === 1 ? "update" : "updates"} from Episode {Math.min(...hidden.map((u) => u.from))}
            </b>
            <small className="text-[13px]">It shows once you&apos;ve seen it</small>
          </span>
        </div>
      )}
      {taking && (
        <PreviewGuard
          title="Add it to your rulebook?"
          subtitle={`From Episode ${taking.from}. Earlier episodes keep their scores.`}
          load={() => ourRules.update(seasonId, couchId, taking.id, true, true)}
          cta="Add it"
          onClose={() => setTaking(null)}
          onConfirm={async () => {
            const r = await ourRules.update(seasonId, couchId, taking.id, true);
            await done(r.batch, "Added to your rulebook");
          }}
        />
      )}
    </div>
  );
}

/** A tier-2 guard whose moves come from the server's dry run. */
function PreviewGuard({ title, subtitle, load, cta, onClose, onConfirm }: { title: string; subtitle: string; load: () => Promise<{ lines: PreviewLine[] }>; cta: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [lines, setLines] = useState<PreviewLine[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    load()
      .then((r) => live && setLines(r.lines))
      .catch((e: Error) => live && setFailed(e.message));
    return () => {
      live = false;
    };
    // The guard opens once per change; `load` is that change's dry run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <GuardSheet open onOpenChange={(o) => !o && onClose()} title={title} subtitle={failed ?? subtitle} lines={failed ? [] : lines} cta={cta} undoNote="Undo from Recent changes until the next episode airs." onConfirm={onConfirm} />
  );
}

function OwnMoment({ seasonId, couchId, m, canChange, done }: { seasonId: string; couchId: string; m: Ours["own"][number]; canChange: boolean; done: Done }) {
  const [removing, setRemoving] = useState(false);
  return (
    <div data-own-moment={m.id} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2">
      <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-secondary">
        <Users className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px]">{m.label}</b>
        <small className="text-[13px] text-muted-foreground">
          Yours · the couch answers{m.counted === "eachTime" ? ", each time" : ""} · {pts(m.points)}
        </small>
      </span>
      {canChange && (
        <button type="button" data-own-remove aria-label={`Take out ${m.label}`} onClick={() => setRemoving(true)} className="grid size-11 flex-none place-items-center rounded-[3px] text-muted-foreground">
          <X className="size-5" aria-hidden />
        </button>
      )}
      {removing && (
        <PreviewGuard
          title={`Take out ${m.label}?`}
          subtitle="The couch stops answering it, and it stops counting in every game."
          load={() => ourRules.remove(seasonId, couchId, m.id, true)}
          cta="Take it out"
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            const r = await ourRules.remove(seasonId, couchId, m.id);
            await done(r.batch, `${m.label} taken out`);
          }}
        />
      )}
    </div>
  );
}

function CountsSheet({ seasonId, couchId, ours, onClose, done }: { seasonId: string; couchId: string; ours: Ours; onClose: () => void; done: Done }) {
  const [off, setOff] = useState(() => new Set(ours.moments.filter((m) => !m.counts).map((m) => m.id)));
  const [confirming, setConfirming] = useState(false);
  const groups = useMemo(() => {
    const out: { group: string; items: Ours["moments"] }[] = [];
    for (const m of ours.moments) {
      const g = out.find((x) => x.group === m.group) ?? (out.push({ group: m.group, items: [] }), out[out.length - 1]);
      g.items.push(m);
    }
    return out;
  }, [ours.moments]);
  const changed = ours.moments.some((m) => off.has(m.id) === m.counts);
  if (confirming)
    return (
      <PreviewGuard
        title="Change what counts?"
        subtitle="For the whole season: every episode is scored again."
        load={() => ourRules.counts(seasonId, couchId, [...off], true)}
        cta="Save what counts"
        onClose={onClose}
        onConfirm={async () => {
          const r = await ourRules.counts(seasonId, couchId, [...off]);
          await done(r.batch, "Saved what counts");
        }}
      />
    );
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="What counts" subtitle="Tap one to turn it off for this couch">
      <div data-counts-sheet>
        {groups.map((g) => (
          <div key={g.group} className="mb-2">
            <p className="type-caption border-b border-border pb-1.5 pt-2 text-[13px] tracking-[0.04em] text-muted-foreground">{g.group}</p>
            {g.items.map((m) => {
              const counts = !off.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="switch"
                  aria-checked={counts}
                  data-moment={m.id}
                  onClick={() =>
                    setOff((s) => {
                      const n = new Set(s);
                      if (n.has(m.id)) n.delete(m.id);
                      else n.add(m.id);
                      return n;
                    })
                  }
                  className="flex min-h-12 w-full items-center gap-3 border-b border-border text-left"
                >
                  <span className={`min-w-0 flex-1 text-[15px] ${counts ? "" : "text-muted-foreground line-through"}`}>{m.label}</span>
                  <span className={`grid size-7 flex-none place-items-center rounded-[3px] ${counts ? "bg-good text-background" : "bg-secondary text-muted-foreground"}`}>
                    {counts ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <X className="size-4" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        <Btn data-counts-done tone="must" wide className="mt-3" onClick={() => (changed ? setConfirming(true) : onClose())}>
          {changed ? "Save" : "Done"}
        </Btn>
      </div>
    </Sheet>
  );
}

function AddMomentSheet({ seasonId, couchId, onClose, done }: { seasonId: string; couchId: string; onClose: () => void; done: Done }) {
  const [label, setLabel] = useState("");
  const [counted, setCounted] = useState<"yesNo" | "eachTime">("yesNo");
  const [points, setPoints] = useState(1);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Add a moment" subtitle="Something anyone watching could see happen">
      <div data-add-sheet>
        <label className="flex flex-col gap-1.5">
          <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">What happens?</span>
          <input
            data-moment-label
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Cries at Tribal Council"
            className="h-12 rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input"
          />
        </label>
        <p className="type-caption mb-1.5 mt-4 text-[13px] tracking-[0.04em] text-muted-foreground">Counted</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["yesNo", "Yes or no, each episode"],
              ["eachTime", "Every time it happens"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              data-counted={k}
              aria-pressed={counted === k}
              onClick={() => setCounted(k)}
              className={`nd-press min-h-12 rounded-[3px] px-3 text-[14px] font-semibold ${counted === k ? "bg-foreground text-background" : "bg-background"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Stepper title="Points" line="Suggested: each game's points can differ" value={pts(points)} onStep={(d) => setPoints((p) => Math.max(-5, Math.min(5, p + d)) || (d > 0 ? 1 : -1))} />
        </div>
        <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
          <Users className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>
            The couch answers it after each episode: anyone who&apos;s seen it can tick who did it, and two agreeing settles it (whoever runs the games settles it alone). Things you can see,
            not judgement calls like &ldquo;funniest moment&rdquo;.
          </span>
        </p>
        <Btn
          data-add-it
          tone="must"
          wide
          className="mt-3"
          disabled={!label.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await ourRules.add(seasonId, couchId, { label: label.trim(), counted, points });
              onClose();
              await done(r.batch, "Added · the couch answers it from the episode page");
            } catch (e) {
              toast((e as Error).message);
              setBusy(false);
            }
          }}
        >
          Add it
        </Btn>
      </div>
    </Sheet>
  );
}

function GamePoints({ g, seasonId, couchId, canChange, done }: { g: GameRules; seasonId: string; couchId: string; canChange: boolean; done: Done }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const items = (g.points ?? []).flatMap((grp) => grp.items.filter((i) => i.points !== undefined));
  const changed = Object.fromEntries(Object.entries(draft).filter(([id, v]) => items.find((i) => i.id === id)?.points !== v));
  const n = Object.keys(changed).length;
  return (
    <section data-points={g.gameName} className="mt-7 px-4">
      <div className="mb-3 flex items-center gap-3">
        <i className="h-8 w-1.5 flex-none rounded-[2px]" style={{ background: gameColour(g.gameName) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="type-caption text-[24px] leading-none">{g.gameName}</h2>
          <small className="text-[13px] text-muted-foreground">{g.points ? `${g.name}'s points` : g.name}</small>
        </div>
      </div>
      {g.points ? (
        <>
          {g.points.map((grp) => (
            <div key={grp.id} className="mb-4">
              <span className="type-caption block border-b border-border pb-1.5 text-[14px] tracking-[0.04em] text-muted-foreground">{grp.label}</span>
              {grp.items
                .filter((i) => i.points !== undefined)
                .map((i) => {
                  const v = draft[i.id] ?? i.points!;
                  return editing ? (
                    <div key={i.id} data-points-item={i.id} className="border-b border-border py-1.5">
                      <Stepper
                        title={i.label}
                        line={i.league ? "The couch answers" : changed[i.id] !== undefined ? `Was ${pts(i.points!)}` : undefined}
                        value={pts(v)}
                        onStep={(d) => setDraft((x) => ({ ...x, [i.id]: Math.max(-50, Math.min(50, v + d)) }))}
                      />
                    </div>
                  ) : (
                    <div key={i.id} data-points-item={i.id} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-border py-1.5">
                      <span className="text-[15px] font-semibold">
                        {i.label}
                        {i.league && <small className="ml-2 rounded-[2px] bg-secondary px-1.5 py-px text-[11px] font-bold text-muted-foreground">The couch answers</small>}
                      </span>
                      <b className={`type-num flex-none text-[22px] ${i.points! < 0 ? "text-muted-foreground" : ""}`}>{pts(i.points!)}</b>
                    </div>
                  );
                })}
            </div>
          ))}
          {canChange && !editing && (
            <Btn data-change-points={g.leagueId} wide onClick={() => setEditing(true)}>
              Change the points
            </Btn>
          )}
          {editing && (
            <div data-points-bar className="nd-fixed-x fixed bottom-0 z-30 border-t border-border bg-[rgba(22,20,29,.96)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-md">
              <b className="block text-[15px]">{n ? `${n} ${n === 1 ? "moment" : "moments"} changed` : "Tap − or + to change a moment's points"}</b>
              <small className="block text-[13px] text-muted-foreground">For the whole season: every episode is scored again.</small>
              <div className="mt-2 flex gap-2">
                <Btn
                  className="h-12 w-[34%]"
                  onClick={() => {
                    setDraft({});
                    setEditing(false);
                  }}
                >
                  Cancel
                </Btn>
                <Btn data-points-save tone="must" className="h-12 flex-1" disabled={!n} onClick={() => setConfirming(true)}>
                  Save points
                </Btn>
              </div>
            </div>
          )}
          {editing && <div className="h-36" aria-hidden />}
          {confirming && (
            <PreviewGuard
              title="Change the points?"
              subtitle={`${g.gameName}: every episode is scored again with the new points.`}
              load={() => ourRules.points(seasonId, couchId, g.leagueId, changed, true)}
              cta="Save points"
              onClose={() => setConfirming(false)}
              onConfirm={async () => {
                const r = await ourRules.points(seasonId, couchId, g.leagueId, changed);
                setDraft({});
                setEditing(false);
                await done(r.batch, "Points saved · the season is scored again");
              }}
            />
          )}
        </>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {g.lines.map((l) => (
            <li key={l} className="rounded-[3px] bg-card p-3 text-[15px] leading-snug">
              {l}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
