"use client";

import { useState } from "react";
import { BookOpen, CalendarDays, Check, Tv, Users, X, Zap } from "lucide-react";
import { researchLine } from "@/lib/desk-bot-words";
import { colourOf } from "@/lib/people";
import { airTime } from "../clock";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Face } from "../show/parts";
import { Avatar } from "../ui/bars";
import { GuardSheet } from "../ui/guards";
import { Btn, Chip, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { ArtSection } from "./art";
import { deskSend, useAfterDesk, useDesk, type DeskCastaway, type DeskCouch, type DeskFact, type DeskLine, type DeskSeason, type DeskShow, type SeasonBot, type SeasonDelete } from "./data";
import { DeskHeader, DeskRow, Facts, FieldRow, IconLead, ItemRow, LatestHistory, LockRow, LowerThird, OverrideSheet, Section, Tag } from "./parts";
import { HandOnSheet } from "./seats";
import { EpisodeNumber } from "./research";
import { SeasonDeleteRow } from "./setup";

// One thing on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminFact and adminEntity): a
// disputed fact's two sides and the admin's decision; a season (its rulebook, its cast by group, its episodes' results);
// a castaway (Override, Lock, History); a couch (who runs its games, Hand them on when nobody does, who fills in); a show (who added it,
// Looks fine or Archive for one added by name, its seasons and their rulebooks, New season: step 10 part 3). Each in the
// desk's page frame (docs/PLAN-desk-parity.md step 1, parts.tsx): Back names where you came from, what it's part of is a
// link, and History shows its latest three. Each page's own actions and its Delete come with the step that builds them.

const Loading = () => <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
const back = { label: "Find", href: paths.desk("find") };

function useAct<T>(path: string) {
  const after = useAfterDesk();
  return async (body: unknown, done: string) => {
    try {
      const out = await deskSend<T>(path, body);
      await after();
      toast(done);
      return out;
    } catch (e) {
      toast.quiet((e as Error).message);
      throw e;
    }
  };
}

function NotFound({ error }: { error: unknown }) {
  return <EmptyState title="Not here" line={(error as Error)?.message ?? "It's gone."} />;
}

// ---------- a fact ----------

const STATUS_TAG: Record<string, [string, "must" | "good" | "quiet" | "bad"]> = {
  disputed: ["Disputed", "must"],
  canonical: ["Canonical", "good"],
  removed: ["Removed", "bad"],
  reported: ["1 source", "quiet"],
  confirmed: ["Confirmed", "good"],
};

export function FactPage({ id }: { id: string }) {
  const q = useDesk<DeskFact>(`/facts/${id}`);
  const act = useAct<DeskFact>(`/facts/${id}`);
  const [deciding, setDeciding] = useState<"yes" | "no" | null>(null);
  const [editing, setEditing] = useState(false);
  if (q.error) return <><DeskHeader title="Fact" back={{ label: "Inbox", href: paths.desk() }} name={null} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Fact" back={{ label: "Inbox", href: paths.desk() }} name={null} /><Loading /></>;
  const f = q.data;
  const [tag, tone] = STATUS_TAG[f.status] ?? [f.status, "quiet"];
  return (
    <div className="pb-16" data-desk-fact={f.status}>
      <DeskHeader title="Fact" back={{ label: "Inbox", href: paths.desk() }} name={[f.name, f.label].filter(Boolean).join(" · ") || "Fact"} kind="Fact" />
      <Section>
        <div className="flex min-h-[80px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
          <Face src={f.photo} name={f.name} className="w-20 flex-none text-2xl" />
          <span className="flex flex-col justify-center gap-1 py-2 pl-3 pr-3">
            <Tag tone={tone}>{tag}</Tag>
            <b className="type-caption text-[19px] leading-tight">
              {[f.name, f.label].filter(Boolean).join(" · ")}
            </b>
            <small className="text-[13px] text-plate-muted">
              {f.season.name} · Episode {f.episode}
              {f.live ? " · in every league" : " · in no league"}
            </small>
          </span>
        </div>
        {f.locked && (
          <p data-decided className="mt-3 flex gap-2 text-[14px] leading-snug text-muted-foreground">
            <Check className="mt-0.5 size-4 flex-none text-good" aria-hidden />
            <span>
              {f.locked.by ? `${f.locked.by} decided` : "An admin decided"}: <b className="text-foreground">{f.live ? "it happened" : "it didn't happen"}</b>
              {f.applied ? " (as overridden)" : ""}. Locked: no answer moves it.
            </span>
          </p>
        )}
      </Section>
      <Section title="Part of">
        <DeskRow href={paths.deskItem("season", f.season.id)} data="part-of" lead={<IconLead icon={Tv} />} title={f.season.name} line={`The season · Episode ${f.episode}`} />
      </Section>
      <Section title="Says it happened" aside={f.yes.length}>
        {f.yes.length ? f.yes.map((s, i) => <SourceRow key={i} yes text={`${s.who}${s.couch ? ` · ${s.couch}` : ""}`} line={`${s.source} · ${airTime(Date.parse(s.at))}${s.method ? ` · said "${s.method}"` : ""}`} />) : <p className="text-[14px] text-muted-foreground">{f.community ? "Nobody any more." : "Decided before results were shared: no sources."}</p>}
      </Section>
      <Section title="Says it didn't" aside={f.no.length + f.flags.length}>
        {f.no.map((s, i) => (
          <SourceRow key={`n${i}`} text={`${s.who}${s.couch ? ` · ${s.couch}` : ""}`} line={`${s.source} · ${airTime(Date.parse(s.at))} · answered for them and didn't report it`} />
        ))}
        {f.flags.map((x, i) => (
          <SourceRow key={`f${i}`} text={`${x.who} flagged it`} line={`${x.reason}${x.note ? ` · "${x.note}"` : ""}${x.status !== "open" ? ` · ${x.status}` : ""}`} />
        ))}
        {!f.no.length && !f.flags.length && <p className="text-[14px] text-muted-foreground">Nobody.</p>}
      </Section>
      <Section title="Where it counts">
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {f.leagues} {f.leagues === 1 ? "league" : "leagues"} on {f.season.name} · {f.rulings ? `${f.rulings} house ${f.rulings === 1 ? "ruling keeps" : "rulings keep"} it whatever you decide · ` : ""}shared stats follow your decision.
        </p>
      </Section>
      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Btn data-decide="yes" onClick={() => setDeciding("yes")}>
            It happened
          </Btn>
          <Btn data-decide="no" onClick={() => setDeciding("no")}>
            It didn&apos;t happen
          </Btn>
        </div>
        {f.kind !== "noexit" && (
          <button type="button" data-edit-fact onClick={() => setEditing(true)} className="mt-1 flex min-h-11 w-full items-center justify-center text-[14px] font-semibold text-muted-foreground">
            Something else: edit the fact
          </button>
        )}
        {f.locked && f.community && (
          <Btn data-reopen wide className="mt-2" onClick={() => act({ reopen: true }, "Reopened · settled again from its sources")}>
            Unlock and reopen
          </Btn>
        )}
      </Section>
      <LatestHistory lines={f.history} />
      {deciding && (
        <GuardSheet
          open
          onOpenChange={(o) => !o && setDeciding(null)}
          title={deciding === "no" ? "Remove it for everyone?" : "Keep it for everyone?"}
          subtitle="Becomes canonical and locked. Couches with a house ruling keep theirs."
          lines={[
            { face: { kind: "castaway", name: f.name, photo: f.photo }, label: `${[f.name, f.label].filter(Boolean).join(" · ")} · Ep ${f.episode}`, change: deciding === "no" ? "Removed" : "Stays", dir: null },
            { face: { kind: "player", userId: null, name: "Leagues" }, label: `${f.leagues} ${f.leagues === 1 ? "league" : "leagues"}`, change: deciding === "no" ? (f.live ? `Corrected after each reveals Episode ${f.episode}` : "No change") : f.live ? "No change" : "It goes in", dir: null },
            ...(f.flags.some((x) => x.status === "open") ? [{ face: { kind: "player" as const, userId: null, name: "Flags" }, label: "People who flagged it", change: "Answered", dir: null }] : []),
          ]}
          cta={deciding === "no" ? "Remove it" : "Keep it"}
          undoNote="Undo it from History, or unlock and reopen it from this page."
          onConfirm={async () => {
            await act({ decide: deciding }, deciding === "no" ? "Removed for everyone · canonical" : "Kept · canonical");
          }}
        />
      )}
      {editing && <EditFactSheet fact={f} onClose={() => setEditing(false)} onSave={(edit) => act({ edit }, "Overridden · canonical")} />}
    </div>
  );
}

function SourceRow({ yes, text, line }: { yes?: boolean; text: string; line: string }) {
  return (
    <div data-source={yes ? "yes" : "no"} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
      <span className={`grid size-10 flex-none place-items-center rounded-full ${yes ? "bg-good/20 text-good" : "bg-live/20 text-live"}`}>
        {yes ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : <X className="size-4" strokeWidth={2.6} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{text}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
    </div>
  );
}

function EditFactSheet({ fact, onClose, onSave }: { fact: DeskFact; onClose: () => void; onSave: (edit: Record<string, string>) => Promise<unknown> }) {
  const [who, setWho] = useState(fact.name);
  const [method, setMethod] = useState(fact.method);
  const [eventType, setEventType] = useState(fact.eventType);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`Override · ${fact.name} · Episode ${fact.episode}`} subtitle="Becomes canonical and locked">
      <b className="block text-[15px]">Who</b>
      <select data-edit-who value={who} onChange={(e) => setWho(e.target.value)} className="mt-1.5 h-12 w-full rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input">
        {fact.choices.cast.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      {fact.kind === "elimination" && (
        <div className="mt-4">
          <b className="block text-[15px]">How they left</b>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fact.choices.methods.map((m) => (
              <Chip key={m} on={m === method} onClick={() => setMethod(m)} className="h-11">
                {m}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {fact.kind === "event" && (
        <>
          <b className="mt-4 block text-[15px]">What happened</b>
          <select data-edit-what value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1.5 h-12 w-full rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input">
            {fact.choices.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </>
      )}
      <p className="mt-3 text-[13px] text-muted-foreground">Saved as an admin override: it wins over couch answers and research, and it&apos;s in the history with undo.</p>
      <Btn
        data-edit-save
        tone="must"
        wide
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave({ castawayName: who, ...(fact.kind === "elimination" ? { method } : {}), ...(fact.kind === "event" ? { eventType } : {}) });
            onClose();
          } catch {
            setBusy(false);
          }
        }}
      >
        Save override
      </Btn>
    </Sheet>
  );
}

// ---------- a season ----------

export function SeasonPage({ id }: { id: string }) {
  const q = useDesk<DeskSeason & { bot: SeasonBot; history: DeskLine[]; setup: { line: string; next: string; facts: string; scheduled: boolean }; delete: SeasonDelete; episodeRows: { n: number; line: string }[] }>(`/seasons/${id}`);
  const act = useAct<{ people: number; leagues: number }>(`/seasons/${id}`);
  const [clearing, setClearing] = useState<{ group: string; preview: { people: number; leagues: number } | null } | null>(null);
  if (q.error) return <><DeskHeader title="Season" back={back} name={null} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Season" back={back} name={null} /><Loading /></>;
  const s = q.data;
  const noSchedule = s.status === "airing" && !s.scheduled;
  return (
    <div className="pb-16" data-desk-season>
      <DeskHeader title="Season" back={{ label: s.show.name, href: paths.deskItem("show", s.show.id) }} name={s.name} kind="Season" />
      <LowerThird
        tag={s.status === "airing" ? "Airing" : s.status === "completed" ? "Ended" : "Upcoming"}
        title={s.name}
        detail={s.setup.next}
      />
      <Facts>{s.setup.facts}</Facts>
      <Section title="Part of">
        <DeskRow href={paths.deskItem("show", s.show.id)} data="part-of" lead={<IconLead icon={Tv} />} title={s.show.name} line="The show" />
        {s.rulebook && (
          <DeskRow
            data="rulebook"
            href={paths.deskItem("rulebook", s.rulebook.id)}
            lead={<IconLead icon={BookOpen} />}
            title={`${s.name}'s rulebook`}
            line={`Version ${s.rulebook.version}${s.rulebook.edited ? " · edited" : ""} · ${s.rulebook.everywhere || s.rulebook.live ? "its games play by it" : "its games play by the show's rules"}`}
          />
        )}
      </Section>
      {/* Its Setup (docs/PLAN-desk-parity.md step 3), its Research and the bot (step 4: the bot's schedule moved there from
          this page), and what the Inbox sends here for (step 2), the row to act on with its dot: step 5 gives a season its own
          Cast; until then it's approved in classic's admin. */}
      <Section title="Running it">
        <div className="border-b border-border">
          <DeskRow href={paths.deskSeasonPage(id, "setup")} data="setup" dot={noSchedule ? "need" : undefined} lead={<IconLead icon={CalendarDays} />} title="Setup" line={s.setup.line} />
          <DeskRow href={paths.deskSeasonPage(id, "research")} data="research" lead={<IconLead icon={Zap} />} title="Research and the bot" line={researchLine({ on: s.bot.on, schedule: s.bot.schedule })} />
          {!s.castSent && (
            <DeskRow
              href={`/admin/seasons/${id}/cast`}
              data="cast"
              dot="need"
              lead={<IconLead icon={Users} />}
              title="Cast"
              line={`${s.cast.length} ${s.cast.length === 1 ? "person" : "people"}, not sent to its games · approve it in classic admin for now`}
            />
          )}
        </div>
      </Section>
      <Section title="Cast" aside={`${s.cast.length} people`}>
        {s.groups.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {s.groups.map((g) => (
              <div key={g.name} data-group={g.name} className="flex items-center gap-3 rounded-[4px] bg-card p-3">
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px]">{g.name}</b>
                  <small className="block text-[13px] text-muted-foreground">
                    {g.people} start in it{g.secretRole ? " · named like a secret role: it gives the role away" : ""}
                  </small>
                </span>
                <Btn
                  data-clear-group={g.name}
                  className="h-10 px-3 text-[13px]"
                  onClick={async () => {
                    setClearing({ group: g.name, preview: null });
                    const p = await deskSend<{ people: number; leagues: number }>(`/seasons/${id}`, { clearGroup: g.name, preview: true }).catch(() => null);
                    setClearing({ group: g.name, preview: p });
                  }}
                >
                  Not a group
                </Btn>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {s.cast.map((c) => (
            <NavLink key={c.id} href={paths.deskItem("castaway", c.id)} data-castaway={c.name} className="nd-press flex flex-col overflow-hidden rounded-[3px] bg-plate text-plate-foreground">
              <Face src={c.photo} name={c.name} className="aspect-square w-full text-xl" />
              <span className="px-1.5 py-1">
                <b className="type-caption block truncate text-[12px]">{c.name.split(" ")[0]}</b>
                <small className="block truncate text-[11px] text-plate-muted">{c.locked ? "Locked" : (c.group ?? "No group")}</small>
              </span>
            </NavLink>
          ))}
        </div>
      </Section>
      {/* Its episodes (part 4b; the mock's rsEpLine): the next one, then each aired one, each opening its own page. */}
      <Section title="Episodes" aside={s.aired ? `${s.aired} aired` : undefined}>
        {s.episodeRows.length ? (
          <div data-episodes className="border-b border-border">
            {s.episodeRows.map((e) => (
              <DeskRow key={e.n} data={`episode-${e.n}`} href={paths.deskEpisode(id, e.n)} lead={<EpisodeNumber n={e.n} />} title={`Episode ${e.n}`} line={e.line} />
            ))}
          </div>
        ) : (
          <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">Its episodes come in with its schedule.</p>
        )}
      </Section>
      <LatestHistory lines={q.data.history} />
      <SeasonDeleteRow id={id} del={s.delete} showId={s.show.id} />
      {clearing && (
        <GuardSheet
          open
          onOpenChange={(o) => !o && setClearing(null)}
          title={`Take out ${clearing.group}?`}
          subtitle="A secret role, not a group: off the season's cast and out of every league on it"
          lines={clearing.preview ? [] : null}
          body={
            clearing.preview ? (
              <p data-clear-preview className="rounded-[3px] bg-background p-3 text-[14px] leading-snug">
                {clearing.preview.people} {clearing.preview.people === 1 ? "person starts" : "people start"} in {clearing.group}. {clearing.preview.leagues}{" "}
                {clearing.preview.leagues === 1 ? "league loses it" : "leagues lose it"}: nobody is on it, and no board shows it.
              </p>
            ) : undefined
          }
          cta={`Take out ${clearing.group}`}
          undoNote="Undo it from History: the group goes back on the same people."
          onConfirm={async () => {
            await act({ clearGroup: clearing.group }, `${clearing.group} taken out`);
          }}
        />
      )}
    </div>
  );
}

// ---------- a castaway ----------

export function CastawayPage({ id }: { id: string }) {
  const q = useDesk<DeskCastaway>(`/castaways/${id}`);
  const act = useAct<DeskCastaway>(`/castaways/${id}`);
  const [field, setField] = useState<"name" | "group" | "photo" | null>(null);
  if (q.error) return <><DeskHeader title="Castaway" back={back} name={null} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Castaway" back={back} name={null} /><Loading /></>;
  const c = q.data;
  const values = { name: c.name, group: c.group ?? "", photo: c.photoUrl ?? "" };
  const labels = { name: "Name", group: "Group", photo: "Photo" };
  return (
    <div className="pb-16" data-desk-castaway>
      <DeskHeader title="Castaway" back={{ label: c.season.name, href: paths.deskItem("season", c.season.id) }} name={c.name} kind="Castaway" />
      <Section>
        <div className="flex items-center gap-3">
          <Face src={c.photo} name={c.name} className="size-[72px] flex-none rounded-[3px] text-2xl" />
          <span>
            <b className="type-caption block text-[26px] leading-none">{c.name}</b>
            <small className="text-[14px] text-muted-foreground">Cast · {c.season.name}</small>
          </span>
        </div>
      </Section>
      <Section title="Part of">
        <DeskRow href={paths.deskItem("season", c.season.id)} data="part-of" lead={<IconLead icon={Tv} />} title={c.season.name} line="The cast" />
      </Section>
      <Section>
        <FieldRow data="name" label="Name" value={c.name} onOverride={() => setField("name")} />
        <FieldRow data="group" label="Group" value={c.group ?? "No group"} onOverride={() => setField("group")} />
        <FieldRow data="photo" label="Photo" value={c.photoUrl ? "From the season cast" : "None"} onOverride={() => setField("photo")} />
      </Section>
      <Section>
        <LockRow
          locked={c.locked}
          on="Locked: no commissioner's cast entry changes them; flags still reach you"
          off="Couches can correct them while their cast is being made"
          onChange={(locked) => act({ lock: locked }, locked ? "Locked" : "Unlocked")}
        />
      </Section>
      <LatestHistory lines={c.history} />
      {field && (
        <OverrideSheet
          open
          onClose={() => setField(null)}
          title={c.name}
          reach={c.reach}
          label={labels[field]}
          value={values[field]}
          choices={field === "group" ? c.groups : undefined}
          onSave={async (value) => {
            await act({ field, value }, "Overridden · in the history with undo");
          }}
        />
      )}
    </div>
  );
}

// ---------- a couch, a show (a person is people.tsx's) ----------

export function CouchPage({ id }: { id: string }) {
  const q = useDesk<DeskCouch>(`/couches/${id}`);
  const act = useAct<DeskCouch>(`/couches/${id}`);
  const [filling, setFilling] = useState(false);
  const [handing, setHanding] = useState(false);
  if (q.error) return <><DeskHeader title="Couch" back={back} name={null} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Couch" back={back} name={null} /><Loading /></>;
  const c = q.data;
  const owner = c.members.find((m) => m.role === "owner");
  return (
    <div className="pb-16" data-desk-couch>
      <DeskHeader title="Couch" back={back} name={c.name} kind="Couch" />
      <LowerThird
        lead={
          <span className="grid size-16 flex-none grid-cols-2 gap-0.5 overflow-hidden rounded-[3px] bg-card shadow-plate">
            {c.members.slice(0, 4).map((m) => (
              <Avatar key={m.userId} id={m.userId} name={m.name} size={31} colour={colourOf(m.userId, m.colour)} />
            ))}
          </span>
        }
        tag="Couch"
        title={c.name}
        detail={c.stranded.length ? (c.stranded.length === c.games.length ? "Nobody runs its games" : "Nobody runs some of its games") : owner ? `Started by ${owner.name}` : `${c.members.length} on it`}
      />
      <Facts>
        {c.members.length} on it · {c.games.length} {c.games.length === 1 ? "game" : "games"}
        {c.rulings ? ` · ${c.rulings} house ${c.rulings === 1 ? "ruling" : "rulings"}` : ""}
      </Facts>
      {/* The Inbox's couch nobody runs (docs/PLAN-desk-parity.md step 2, the mock's dk-state): its games handed on through
          Hand on, with no one going (tier 1, Undo puts it back as it was). */}
      {c.stranded.length > 0 && (
        <section className="mt-5 px-4">
          <div data-stranded={c.stranded.map((g) => g.leagueId).join(" ")} className="rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">{c.stranded.length === c.games.length ? "Nobody runs its games" : `Nobody runs ${c.stranded.length === 1 ? c.stranded[0].name : `${c.stranded.length} of its games`}`}</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              Its only Commissioner has gone.{" "}
              {c.stranded.length > 1 ? "Hand the games to someone on the couch, and they can run them from there." : "Hand it to someone on the couch who plays it, and they can run it from there."}
            </small>
            <Btn data-hand-couch wide className="mt-3 h-12" onClick={() => setHanding(true)}>
              {c.stranded.length > 1 ? "Hand them on" : "Hand it on"}
            </Btn>
          </div>
        </section>
      )}
      <HandOnSheet open={handing} onClose={() => setHanding(false)} from={null} games={c.stranded.map((g) => ({ leagueId: g.leagueId, name: g.name, couch: c.name }))} />
      <Section title="People" aside={c.members.length}>
        <div data-field="members">
          {c.members.map((m) => (
            <DeskRow key={m.userId} href={paths.deskItem("person", m.userId)} data="member" lead={<Avatar id={m.userId} name={m.name} size={40} colour={colourOf(m.userId, m.colour)} />} title={m.name} line={m.role === "owner" ? "Started it" : "On it"} />
          ))}
          {!c.members.length && <p className="text-[14px] text-muted-foreground">Nobody.</p>}
        </div>
      </Section>
      <Section title="Games" aside={c.games.length}>
        {c.games.map((g) => (
          <FieldRow key={g.leagueId} data="game" label={`${g.gameName} · ${g.season}`} value={`${g.name} · run by ${g.runners.join(", ") || "nobody"}`} />
        ))}
        {!c.games.length && <p className="text-[14px] text-muted-foreground">No games yet.</p>}
      </Section>
      <Section title="Settings">
        <FieldRow data="fill" label="Who fills in results" value={c.anyone ? "Anyone on the couch" : "Only people who run games"} onOverride={() => setFilling(true)} />
      </Section>
      <LatestHistory lines={c.history} />
      <Sheet open={filling} onOpenChange={setFilling} title={`Override · ${c.name}`} subtitle="Who can fill in its results">
        <div className="flex flex-col gap-2">
          {([
            [true, "Anyone on the couch"],
            [false, "Only people who run games"],
          ] as const).map(([v, t]) => (
            <button
              key={String(v)}
              type="button"
              data-couch-anyone={String(v)}
              aria-pressed={c.anyone === v}
              onClick={async () => {
                setFilling(false);
                await act({ anyone: v }, `Overridden: ${t.toLowerCase()}`).catch(() => {});
              }}
              className={`nd-press rounded-[3px] p-3.5 text-left ${c.anyone === v ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}
            >
              <b className="text-[16px]">{t}</b>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** A show's kind, as its lower third says it. */
const KIND_WORDS: Record<string, string> = { competition: "A competition", series: "A series", talk: "A talk show", sport: "A sport" };

export function ShowPage({ id }: { id: string }) {
  const q = useDesk<DeskShow>(`/shows/${id}`);
  const act = useAct<DeskShow & { seasonId?: string }>(`/shows/${id}`);
  const nav = useNav();
  if (q.error) return <><DeskHeader title="Show" back={back} name={null} /><NotFound error={q.error} /></>;
  if (!q.data) return <><DeskHeader title="Show" back={back} name={null} /><Loading /></>;
  const s = q.data;
  const byName = !!s.added && !s.added.listing;
  const newSeason = async () => {
    const out = await act({ action: "season" }, s.setUp ? "Added: it plays by last season's rulebook" : "Added a season");
    const made = out.seasons.find((x) => x.id === out.seasonId);
    if (!out.seasonId) return;
    if (out.setUp && made?.rulebookId) nav.push(paths.deskItem("rulebook", made.rulebookId));
    else nav.push(paths.deskNew(out.seasonId));
  };
  return (
    <div className="pb-16" data-desk-show={s.setUp ? "game" : "watching"}>
      <DeskHeader title="Show" back={back} name={s.name} kind="Show" />
      <LowerThird
        lead={
          s.art.poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- a show's art from wherever it was found
            <img src={s.art.poster} alt="" className="size-16 flex-none rounded-[3px] object-cover shadow-plate" />
          ) : undefined
        }
        tag={s.archived ? "Archived" : s.added && !s.added.listing ? "Added by name" : s.setUp ? "A game" : "Not a game yet"}
        title={s.name}
        detail={`${s.setUp ? (KIND_WORDS[s.kind ?? ""] ?? "A competition") : "Not a game yet"} · ${s.seasons.length} ${s.seasons.length === 1 ? "season" : "seasons"}`}
      />
      <Facts>
        {s.added ? `Added by ${s.added.by ?? "someone"} ${s.added.listing ? "from the TV listings" : "by name"}` : "From the TV listings"}
        {s.archived ? " · archived" : ""}
      </Facts>
      {byName && !s.reviewed && !s.archived && (
        <Section>
          <div data-show-review className="rounded-[4px] bg-card p-3.5">
            <Tag tone="must">Look it over</Tag>
            <b className="mt-2 block text-[16px]">Added by name: not in the TV listings</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">
              It&apos;s in everyone&apos;s search with no schedule. Keep it if it&apos;s a real show; archive it if it isn&apos;t (anyone following it keeps it).
            </small>
            <div className="mt-2.5 flex gap-2">
              <Btn data-show-fine tone="must" className="h-11 flex-1 text-[15px]" onClick={() => act({ action: "reviewed" }, "Looks fine")}>
                Looks fine
              </Btn>
              <Btn data-show-archive className="h-11 flex-1 text-[15px]" onClick={() => act({ action: "archive" }, "Archived: out of everyone's search")}>
                Archive it
              </Btn>
            </div>
          </div>
        </Section>
      )}
      <Section title="Seasons" aside={s.seasons.length}>
        {s.seasons.map((x) => (
          <ItemRow
            key={x.id}
            data="season"
            href={s.setUp ? paths.deskItem("season", x.id) : paths.deskNew(x.id)}
            title={x.name}
            line={`${x.status ?? "Upcoming"}${s.setUp ? (x.rulebookId ? " · has its rulebook" : "") : " · set it up"}`}
          />
        ))}
        <Btn data-show-new-season wide className="mt-3" onClick={newSeason}>
          New season {Math.max(0, ...s.seasons.map((x) => x.number)) + 1}
        </Btn>
        {!s.setUp && (
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">Not a game yet: tap a season to set it up (anyone can, from its Make it a game, too).</p>
        )}
      </Section>
      <ArtSection show={s} act={act} />
      <LatestHistory lines={s.history} emptyLine="Nothing changed here yet." />
    </div>
  );
}
