"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, RotateCcw } from "lucide-react";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, type DeskSettings, type FlagCheck } from "./data";
import { ItemRow, useChangeToast } from "./parts";

// Settings › Games on their rulebook (docs/PLAN-desk-parity.md part 7c; the mock's desk-shows.js svRbSheet): the seasons on
// their rulebook by themselves, then Every season at once. Off, Check every league runs the flag's check as a desk job (it
// writes nothing; each league and season on its own, rolled back) with its progress, then the tally: the leagues that score
// exactly the same, the ones that stay on their show's built-in rules (each a link, with why), and Switch on for every
// season (tier 2: what moves said first; Undo). A league that would score differently, or a season whose rulebook isn't
// what its research reads, keeps it off, each said. On, Switch it off: every league back on its show's built-in rules but
// a season switched on by itself, which stays on.

const KEY = ["new-design", "desk", "/settings/rulebooks"] as const;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** A list's small heading (the mock's .dk-sub). */
function SubHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-1 mt-5 flex items-baseline justify-between gap-3">
      <h2 className="type-caption text-[18px] tracking-[0.04em] text-muted-foreground">{title}</h2>
      {aside != null && <span className="text-right text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

function Points({ items }: { items: [typeof Check, string][] }) {
  return (
    <ul className="my-4 flex flex-col gap-2.5">
      {items.map(([Icon, t]) => (
        <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-muted-foreground">
          <Icon className="mt-px size-[18px] flex-none text-foreground" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** How far the check has got: a bar and a count. */
function Running({ c }: { c: FlagCheck }) {
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  return (
    <div data-flag-running className="rounded-[4px] bg-background p-3.5">
      <span className="block h-1.5 overflow-hidden rounded-[3px] bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={c.total || 1} aria-valuenow={c.done} aria-label="Checking every league">
        <i className="block h-full bg-foreground transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </span>
      <small className="mt-2.5 block text-[13px] text-muted-foreground">
        Checking every league and season, each on its own, rolled back{c.total ? ` · ${c.done} of ${c.total}` : ""}
      </small>
    </div>
  );
}

/** What the check found, then the switch (or what keeps it off). */
function Tally({ c, onSwitch, onAgain, busy }: { c: FlagCheck; onSwitch: () => void; onAgain: () => void; busy: boolean }) {
  const stay = c.stay ?? [];
  const differ = c.differ ?? [];
  const seasons = c.seasons ?? [];
  const same = c.same ?? 0;
  return (
    <div data-flag-tally>
      <div className="mb-1.5 grid grid-cols-2 gap-0.5 overflow-hidden rounded-[4px]">
        <div className="bg-background px-3.5 py-3">
          <b data-flag-same className="type-num block text-[32px] leading-none">{same}</b>
          <small className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">score exactly the same</small>
        </div>
        <div className="bg-background px-3.5 py-3">
          <b data-flag-stay className="type-num block text-[32px] leading-none">{stay.length}</b>
          <small className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">stay on their show&apos;s built-in rules</small>
        </div>
      </div>
      <div data-flag-stays>
        {stay.map((l) => (
          <ItemRow key={l.id} data={`flag-stay-${l.id}`} href={paths.deskItem("game", l.id)} title={l.name} line={l.line} />
        ))}
      </div>
      {differ.length > 0 && (
        <>
          <SubHead title="Would score differently" aside={String(differ.length)} />
          <div data-flag-differs>
            {differ.map((l) => (
              <ItemRow key={l.id} data={`flag-differ-${l.id}`} href={paths.deskItem("game", l.id)} tag="Differs" tone="bad" title={l.name} line={l.line} />
            ))}
          </div>
        </>
      )}
      {seasons.length > 0 && (
        <>
          <SubHead title="Research reads something else" aside={String(seasons.length)} />
          <div data-flag-seasons>
            {seasons.map((s) => (
              <ItemRow key={s.id} data={`flag-season-${s.id}`} href={paths.deskItem("season", s.id)} title={s.name} line="Its rulebook isn't the one its research reads" />
            ))}
          </div>
        </>
      )}
      {c.ok ? (
        <>
          <Points
            items={[
              [Check, "Every season's rulebook is the one its research reads."],
              [BookOpen, `${plural(same, "league")} ${same === 1 ? "scores" : "score"} from their season's rulebook from now on. Nothing they've scored moves.`],
              [RotateCcw, "Switching it off puts every league back on its built-in rules, but a season switched on by itself."],
            ]}
          />
          {c.fresh ? (
            <Btn data-flag-on tone="must" wide disabled={busy} onClick={onSwitch}>
              {busy ? "Switching on…" : "Switch on for every season"}
            </Btn>
          ) : (
            <>
              <p className="mb-3 text-[13px] leading-snug text-muted-foreground">That check is over 15 minutes old: check again before it goes on.</p>
              <Btn data-flag-again wide onClick={onAgain}>
                Check again
              </Btn>
            </>
          )}
        </>
      ) : (
        <>
          <p data-flag-held className="my-4 text-[14px] leading-snug text-muted-foreground">
            It stays off while a game would score differently or a season&apos;s research reads something else: fix its rulebook, then check again.
          </p>
          <Btn data-flag-again wide onClick={onAgain}>
            Check again
          </Btn>
        </>
      )}
    </div>
  );
}

export function RulebooksSheet({ open, onClose, rb }: { open: boolean; onClose: () => void; rb: DeskSettings["rulebooks"] }) {
  const after = useAfterDesk();
  const changeToast = useChangeToast();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => deskGet<{ check: FlagCheck | null }>("/settings/rulebooks"),
    enabled: open && !rb.everywhere,
    refetchInterval: (query) => (query.state.data?.check?.state === "running" ? 1000 : false),
  });
  const c = q.data?.check ?? null;
  const start = async () => {
    try {
      await deskSend("/settings/rulebooks", { check: true });
      await q.refetch();
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const flip = async (on: boolean) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeIds: string[]; leagues: number }>("/settings/rulebooks", { on });
      await after();
      onClose();
      changeToast(on ? `Rulebooks for every season · ${plural(out.leagues, "league")}` : `Every season back on its built-in rules${rb.seasons.length ? ` · ${rb.seasons.map((s) => s.name).join(", ")} stays on` : ""}`, out.changeIds[0]);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // The latest check is shown while it runs, and after it (a passed one too old to switch on from says so, with Check again).
  const shown = c && (c.state === "running" || c.state === "done") ? c : null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Games on their rulebook" subtitle="Season by season, or every season at once">
      <p className="mb-2 text-[13px] leading-snug text-muted-foreground">
        {rb.everywhere ? "Every season's games play by its rulebook." : "Off, games play by their show's built-in rules. A season can go first from its rulebook's page."}
      </p>
      <div data-rulebooks-seasons>
        {rb.seasons.map((x) => (
          <ItemRow key={x.id} data="season" href={paths.deskItem("season", x.id)} tag="On" title={x.name} line={`On by itself · ${plural(x.games, "game")} ${x.games === 1 ? "plays" : "play"} by its rulebook`} />
        ))}
      </div>
      <SubHead title="Every season at once" aside={rb.everywhere ? `On · ${plural(rb.leagues, "league")}` : "Off"} />
      <p className="mb-3 text-[13px] leading-snug text-muted-foreground">
        Every league scores from its season&apos;s rulebook, and research reads it too.
        {rb.everywhere ? "" : " Before it goes on, every league is checked: each has to score exactly as it does now."}
      </p>
      <div data-flag>
        {rb.everywhere ? (
          <>
            <Points
              items={[
                [RotateCcw, "Off, every league goes back to its show's built-in rules, which were never removed. What they've scored doesn't move."],
                ...rb.seasons.map((s): [typeof Check, string] => [BookOpen, `${s.name}, on by itself, stays on.`]),
                [Check, "A couch that made the rules its own keeps them."],
              ]}
            />
            <Btn data-flag-off wide disabled={busy} onClick={() => void flip(false)}>
              {busy ? "Switching off…" : "Switch it off"}
            </Btn>
          </>
        ) : shown?.state === "running" ? (
          <Running c={shown} />
        ) : shown ? (
          <Tally c={shown} busy={busy} onSwitch={() => void flip(true)} onAgain={() => void start()} />
        ) : (
          <>
            {c?.state === "failed" && <p className="mb-3 text-[13px] leading-snug text-live">The last check stopped: {c.error}</p>}
            {c?.state === "stopped" && <p className="mb-3 text-[13px] leading-snug text-live">The last check stopped before it finished.</p>}
            <Btn data-flag-check wide disabled={!q.data} onClick={() => void start()}>
              <Check className="size-5" aria-hidden />
              Check every league
            </Btn>
            <p className="mt-2 text-center text-[13px] text-muted-foreground">Writes nothing · about a minute</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
