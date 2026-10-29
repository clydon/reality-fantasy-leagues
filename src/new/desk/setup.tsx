"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Check, Clock, Hash, Pencil, Tv, Users } from "lucide-react";
import { useNav } from "../nav";
import { paths } from "../routes";
import { HoldSheet } from "../ui/guards";
import { Btn, BtnLink, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskSetup, type SeasonDelete } from "./data";
import { ChoiceCard, DeleteRow, DeskHeader, DeskRow, Facts, Field, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { forgetDeskPage } from "./trail";

// A season's Setup (docs/PLAN-desk-parity.md step 3; the mock's desk-setup.js), from the season page's Running it › Setup
// and the Inbox's airing season with no schedule: the season as it's set in the lower third (its status, name and next
// episode), The season (Name, Status), its Schedule as it reads now, Results (Who decides results), History and the
// season's Delete, last, the same as the season page's (SeasonDeleteRow). Name, Status and Who decides are tier 1, a toast
// with Undo and a History line. The schedule's rows (When it airs, Episodes, TV listing) and finding it in the listings are
// part 3b's: until then they open classic admin's Setup. Server: src/lib/server/desk-setup.ts.

const STATUS: [DeskSetup["status"], string, string][] = [
  ["upcoming", "Upcoming", "Not on yet: no episode counts as aired. Games can start ahead of it."],
  ["airing", "Airing", "Each episode counts as aired once its time passes."],
  ["completed", "Ended", "Every episode counts as aired. No new games start on it, its public pool closes, and trivia can ask about all of it."],
];
const STATUS_WORD = Object.fromEntries(STATUS.map(([k, w]) => [k, w])) as Record<DeskSetup["status"], string>;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const allEpisodes = (s: DeskSetup) => (s.count ? `All ${s.count} episodes` : "Every episode so far");
const NOTE = "mt-3 text-[13px] leading-snug text-muted-foreground";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]";

/** A Setup change: every desk read moves on, then its toast with Undo. */
function useSetupChange(id: string) {
  const changed = useChangeToast();
  const after = useAfterDesk();
  return async (body: Record<string, unknown>) => {
    const out = await deskSend<{ changeId: string; text: string }>(`/seasons/${id}/setup`, body);
    await after();
    changed(out.text, out.changeId);
  };
}

export function SetupPage({ id }: { id: string }) {
  const q = useDesk<DeskSetup>(`/seasons/${id}/setup`);
  const [sheet, setSheet] = useState<"name" | "status" | "results" | "episodes" | null>(null);
  const back = { label: "Season", href: paths.deskItem("season", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Setup" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Setup" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const s = q.data;
  const classic = `/admin/seasons/${id}/setup`;
  const close = () => setSheet(null);
  return (
    <div className="pb-16" data-desk-setup={s.status}>
      <DeskHeader title="Setup" back={{ label: s.name, href: paths.deskItem("season", id) }} name="Setup" />
      <LowerThird tag={s.scheduled ? STATUS_WORD[s.status] : "No schedule"} tone={s.scheduled ? "quiet" : "stopped"} title={s.name} detail={s.next} />
      <Facts>{s.facts}</Facts>
      {!s.scheduled && (
        <section className="mt-5 px-4">
          <div data-setup-none className="rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">No schedule yet</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              Nothing knows when it airs: no reminders, no guide card, no Coming up, and no research until it has one. The TV listings usually have it.
            </small>
            <BtnLink data-setup-classic href={classic} tone="must" wide className="mt-3.5">
              Set it in classic admin
            </BtnLink>
            <small className="mt-2 block text-[13px] leading-snug text-muted-foreground">Finding it in the TV listings comes to the desk next; until then, classic admin sets it.</small>
          </div>
        </section>
      )}
      <Section title="The season">
        <div className="border-b border-border">
          <DeskRow data="setup-name" onClick={() => setSheet("name")} lead={<IconLead icon={Pencil} />} title="Name" line={s.ownName ?? `${s.defaultName} · the show and its number`} />
          <DeskRow data="setup-status" onClick={() => setSheet("status")} lead={<IconLead icon={Activity} />} title="Status" line={s.rows.status} />
        </div>
      </Section>
      <Section title="Schedule" aside={s.source ?? undefined}>
        {s.rundown.length > 0 && (
          <div data-setup-rundown className="border-t border-border">
            {s.rundown.map((r, i) =>
              r.kind === "gap" ? (
                <p key={`gap-${i}`} className="border-b border-border py-3 pl-[70px] text-[14px] text-muted-foreground">
                  {r.text}
                </p>
              ) : (
                <div key={r.number} data-setup-run={r.number} className="flex min-h-[66px] items-center gap-3 border-b border-border py-2.5">
                  <span className={`flex w-[58px] flex-none flex-col gap-[3px] ${r.today ? "pl-2 shadow-[inset_2px_0_0_var(--foreground)]" : ""}`}>
                    <small className={`type-caption text-[12px] tracking-[0.06em] ${r.today ? "text-foreground" : "text-muted-foreground"}`}>{r.day}</small>
                    <b className="type-num whitespace-nowrap text-[24px] leading-none">
                      {r.hm}
                      <i className="ml-0.5 text-[11px] font-bold not-italic text-muted-foreground">{r.ap}</i>
                    </b>
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] font-semibold leading-snug">{r.title}</b>
                    <small className="mt-px block text-[13px] text-muted-foreground">{r.date}</small>
                  </span>
                </div>
              )
            )}
          </div>
        )}
        {s.episodes.length > 0 && s.status !== "completed" && (
          <button type="button" data-setup-all onClick={() => setSheet("episodes")} className={`${LINK} mt-1`}>
            {allEpisodes(s)}
          </button>
        )}
        <div className="mt-2 border-b border-border">
          <DeskRow data="setup-when" href={classic} lead={<IconLead icon={Clock} />} title="When it airs" line={s.rows.when} />
          <DeskRow data="setup-count" href={classic} lead={<IconLead icon={Hash} />} title="Episodes" line={s.rows.episodes} />
          <DeskRow data="setup-listing" href={classic} lead={<IconLead icon={Tv} />} title="TV listing" line={s.rows.listing} />
        </div>
        <p className={NOTE}>Changing these comes to the desk next: until then they open classic admin&apos;s Setup.</p>
      </Section>
      <Section title="Results">
        <div className="border-b border-border">
          <DeskRow data="setup-results" onClick={() => setSheet("results")} lead={<IconLead icon={Check} />} title="Who decides results" line={s.rows.results} />
        </div>
      </Section>
      <LatestHistory lines={s.history} />
      <SeasonDeleteRow id={id} del={s.delete} showId={s.show.id} />
      <NameSheet open={sheet === "name"} onClose={close} s={s} />
      <StatusSheet open={sheet === "status"} onClose={close} s={s} />
      <ResultsSheet open={sheet === "results"} onClose={close} s={s} />
      <Sheet open={sheet === "episodes"} onOpenChange={(o) => !o && close()} title={allEpisodes(s)} subtitle={`${s.name} · ${s.zone} time`}>
        <div data-setup-episodes>
          {s.episodes.map((e) => (
            <div key={e.number} data-setup-episode={e.number} className={`flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0 ${e.aired ? "text-muted-foreground" : ""}`}>
              <span className="type-num w-8 text-[22px] text-muted-foreground">{e.number}</span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{e.date}</b>
                <small className="block text-[13px] text-muted-foreground">
                  {e.time}
                  {e.finale ? " · the finale" : ""}
                </small>
              </span>
              {e.aired ? <i className="type-caption rounded-[2px] bg-secondary px-1.5 pb-0.5 pt-[3px] text-[11px] not-italic leading-none tracking-[0.06em]">Aired</i> : e.tonight ? <i className="type-caption rounded-[2px] bg-chyron px-1.5 pb-0.5 pt-[3px] text-[11px] not-italic leading-none tracking-[0.06em] text-chyron-foreground">Tonight</i> : null}
            </div>
          ))}
        </div>
        <p className={NOTE}>{s.linked ? "From its TV listing, kept current each morning." : "Set by hand: from the first, at one time. An episode research dates differently keeps its own."}</p>
      </Sheet>
    </div>
  );
}

function NameSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DeskSetup }) {
  const change = useSetupChange(s.id);
  const [v, setV] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = v ?? s.ownName ?? "";
  const shut = () => {
    setV(null);
    setError(null);
    onClose();
  };
  const save = async () => {
    const next = value.trim();
    if (next === (s.ownName ?? "") || (next === s.defaultName && !s.ownName)) return shut();
    setBusy(true);
    try {
      await change({ name: next });
      shut();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Name" subtitle={s.defaultName}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field
          data="season-name"
          label="Name"
          value={value}
          placeholder={s.defaultName}
          maxLength={60}
          error={error}
          hint={`Blank shows the show and its number: ${s.defaultName}.`}
          onChange={(e) => {
            setV(e.target.value);
            setError(null);
          }}
        />
        <Btn data-setup-save type="submit" tone="must" wide className="mt-4" disabled={busy}>
          Save
        </Btn>
      </form>
    </Sheet>
  );
}

function StatusSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DeskSetup }) {
  const change = useSetupChange(s.id);
  const go = (body: Record<string, unknown>) => {
    onClose();
    change(body).catch((e) => toast.quiet((e as Error).message));
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Status" subtitle={s.name}>
      <div className="flex flex-col gap-2">
        {STATUS.map(([k, t, d]) => (
          <ChoiceCard key={k} attrs={{ "data-setup-status": k }} on={s.status === k} title={t} line={d} onClick={() => (k !== s.status || (s.linked && !s.held) ? go({ status: k }) : onClose())} />
        ))}
      </div>
      {s.linked && !s.held && <p className={NOTE}>Its TV listing&apos;s dates move it on each morning. One you choose here, even the one it has, holds until you go back to the listing&apos;s.</p>}
      {s.linked && s.held && (
        <>
          <button type="button" data-setup-status-back onClick={() => go({ statusBack: true })} className={`${LINK} mt-2`}>
            Back to its listing&apos;s dates
          </button>
          <p className="text-[13px] leading-snug text-muted-foreground">They&apos;d make it {STATUS_WORD[s.byDates ?? s.status]}.</p>
        </>
      )}
    </Sheet>
  );
}

function ResultsSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DeskSetup }) {
  const change = useSetupChange(s.id);
  const go = (by: "leagues" | "admin") => {
    onClose();
    if (by !== s.resultsBy) change({ resultsBy: by }).catch((e) => toast.quiet((e as Error).message));
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Who decides results" subtitle={s.name}>
      <div className="flex flex-col gap-2">
        <ChoiceCard
          attrs={{ "data-setup-results": "leagues" }}
          on={s.resultsBy === "leagues"}
          recommended
          title="Sources that agree"
          line={`Couches' answers and our bot's. A result reaches every game on it once ${s.confirmAt} agree; what they can't settle comes to your Inbox.`}
          onClick={() => go("leagues")}
        />
        <ChoiceCard
          attrs={{ "data-setup-results": "admin" }}
          on={s.resultsBy === "admin"}
          title="You decide"
          line="What you accept on the desk reaches every game on it too, even with no other source. It counts from when you switch: results the games already have stay as they are."
          onClick={() => go("admin")}
        />
      </div>
      {s.resultsBy === "admin" && s.onlyYours > 0 && (
        <p data-setup-only-yours className={NOTE}>
          Back to sources that agree, {plural(s.onlyYours, "result")} only you accepted {s.onlyYours === 1 ? "leaves" : "leave"} its games.
        </p>
      )}
      <p className={NOTE}>Either way, a dispute you settle reaches every game on it.</p>
    </Sheet>
  );
}

/**
 * A season's Delete (decision 4), the last thing on its page and its Setup: refused while games play it (ended ones too),
 * listing them; otherwise a hold, gone for good.
 */
export function SeasonDeleteRow({ id, del, showId }: { id: string; del: SeasonDelete; showId: string }) {
  const nav = useNav();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const blocked = del.games.length > 0;
  return (
    <>
      <DeleteRow data="season" title={`Delete ${del.name}`} line={del.line} onClick={() => setOpen(true)} />
      <Sheet open={open && blocked} onOpenChange={setOpen} title={`${del.name} can't go yet`} subtitle="Not yet">
        <p data-season-blocked className="text-[16px] leading-snug">
          {plural(del.games.length, "game")} {del.games.length === 1 ? "plays" : "play"} it. Delete or move them first, then the season.
        </p>
        <div className="mb-1 mt-4 flex items-baseline justify-between">
          <h3 className="type-caption text-[18px]">In the way</h3>
          <span className="text-[13px] text-muted-foreground">{plural(del.games.length, "game")}</span>
        </div>
        <div className="border-b border-border">
          {del.games.slice(0, 6).map((g) => (
            <DeskRow
              key={g.id}
              data="season-blocker"
              href={g.couch ? paths.deskItem("couch", g.couch.id) : undefined}
              lead={<IconLead icon={Users} />}
              title={g.name}
              line={`${g.couch ? g.couch.name : "On no couch"}${g.ended ? " · ended" : ""}`}
            />
          ))}
        </div>
        {del.games.length > 6 && <p className={NOTE}>And {del.games.length - 6} more.</p>}
        <p className={NOTE}>Ended games count too. A game is deleted from its Backstage until the desk gives games pages of their own.</p>
      </Sheet>
      <HoldSheet
        open={open && !blocked}
        onOpenChange={setOpen}
        title={`Delete ${del.name}?`}
        subtitle="This can't be undone"
        consequence=""
        body={
          <ul data-season-delete className="flex list-disc flex-col gap-2 rounded-[3px] bg-background p-3 pl-7 text-[16px] leading-normal">
            <li>Its episodes, cast and results go.</li>
            {del.pool != null && <li>Its public pool goes with it{del.pool ? `, and the ${plural(del.pool, "person", "people")} playing it` : ""}.</li>}
            {del.practice > 0 && <li>{plural(del.practice, "practice game")} on it {del.practice === 1 ? "goes" : "go"} too.</li>}
            {del.followers > 0 && <li>{plural(del.followers, "person", "people")} following it {del.followers === 1 ? "loses" : "lose"} it from their shows and the guide.</li>}
            <li>{del.show} and its other seasons are untouched.</li>
          </ul>
        }
        cta={`delete ${del.name}`}
        restore="Can't be undone"
        onConfirm={async () => {
          await deskSend(`/seasons/${id}`, {}, "DELETE");
          forgetDeskPage(paths.deskItem("season", id));
          forgetDeskPage(paths.deskSeasonPage(id, "setup"));
          const show = paths.deskItem("show", showId);
          nav.back(show, (prev) => prev === show);
          toast(`Deleted ${del.name}`);
          // Every desk read moves on but this season's own, which are gone.
          await client.invalidateQueries({ queryKey: ["new-design"], predicate: (x) => !String(x.queryKey[2] ?? "").startsWith(`/seasons/${id}`) });
        }}
      />
    </>
  );
}
