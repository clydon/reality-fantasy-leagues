"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { NavLink } from "../nav";
import { paths, type DeskKind } from "../routes";
import { useMe } from "../session";
import { EmptyState, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type DeskSettings, type DeskLine, type FoundItem, type Inbox } from "./data";
import { CastawayPage, CouchPage, FactPage, PersonPage, SeasonPage, ShowPage } from "./pages";
import { DeskHeader, History, ItemRow, Section } from "./parts";
import { RulebookPage } from "./rulebook";

// The admin's desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js admin), from the profile menu: Inbox
// (only what the community couldn't settle, and what settled on its own this week), Find (one search; each thing has a
// page with Override, Lock and History) and Settings. Site admins only: anyone else is told so, and every read is
// refused by its own route.

type Tab = "inbox" | "find" | "settings";

export function DeskScreen({ tab, item }: { tab: Tab | null; item: { kind: DeskKind; id: string } | null }) {
  const me = useMe();
  if (!me.isSuperAdmin) {
    return (
      <div>
        <DeskHeader title="Admin" back={{ label: "Home", href: paths.home }} badge={false} />
        <EmptyState title="The desk is for site admins" line="Results settle by the couches. Anything that needs an admin comes here." />
      </div>
    );
  }
  if (item) {
    const page = { fact: FactPage, season: SeasonPage, castaway: CastawayPage, couch: CouchPage, person: PersonPage, show: ShowPage, rulebook: RulebookPage }[item.kind];
    const Page = page;
    return <Page id={item.id} />;
  }
  return <DeskTabs tab={tab ?? "inbox"} />;
}

function DeskTabs({ tab }: { tab: Tab }) {
  const inbox = useDesk<Inbox>("/inbox");
  const n = inbox.data?.items.length ?? 0;
  const tabs: [Tab, string, string][] = [
    ["inbox", "Inbox", paths.desk()],
    ["find", "Find", paths.desk("find")],
    ["settings", "Settings", paths.desk("settings")],
  ];
  return (
    <div className="pb-16">
      <DeskHeader title="Admin" back={{ label: "Home", href: paths.home }} />
      <nav className="mx-4 mt-3 grid grid-cols-3 gap-2" aria-label="The desk">
        {tabs.map(([k, label, href]) => (
          <NavLink
            key={k}
            href={href}
            replace
            data-desk-tab={k}
            aria-current={k === tab ? "page" : undefined}
            className={`nd-press flex h-12 items-center justify-center gap-2 rounded-[3px] text-[16px] font-bold ${k === tab ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
          >
            {label}
            {k === "inbox" && n > 0 && <i className="grid size-6 place-items-center rounded-full bg-live text-[12px] not-italic text-live-foreground">{n}</i>}
          </NavLink>
        ))}
      </nav>
      {tab === "inbox" && <InboxTab data={inbox.data} loading={inbox.isLoading} />}
      {tab === "find" && <FindTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

const TAGS: Record<string, [string, "must" | "quiet"]> = {
  split: ["Disputed", "must"],
  stale: ["Disputed", "must"],
  stranded: ["Couch", "quiet"],
  phase: ["Confirm", "must"],
  suggestion: ["Report", "quiet"],
  change: ["New?", "must"],
};

function InboxTab({ data, loading }: { data: Inbox | undefined; loading: boolean }) {
  if (loading || !data) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  return (
    <>
      <Section title="Needs you" aside={data.items.length || "Nothing"}>
        {data.items.length ? (
          <div data-inbox>
            {data.items.map((i, k) => (
              <ItemRow key={`${i.href}-${k}`} data={i.kind} href={i.href} tag={TAGS[i.kind][0]} tone={TAGS[i.kind][1]} title={i.title} line={i.line} />
            ))}
          </div>
        ) : (
          <div data-inbox-empty className="flex flex-col items-center rounded-[4px] bg-card px-4 py-8 text-center">
            <Check className="size-8 text-good" strokeWidth={2.6} aria-hidden />
            <b className="type-caption mt-2 text-[22px]">Nothing needs you</b>
            <small className="text-[14px] text-muted-foreground">The couches are handling it.</small>
          </div>
        )}
      </Section>
      <Section title="This week, on its own">
        <div className="grid grid-cols-2 gap-2.5" data-week>
          {(
            [
              [data.week.researched, "episodes researched by couches"],
              [data.week.confirmed, "confirmed by 2+ sources"],
              [data.week.settled, "disputes settled without you"],
              [data.week.rulings, "house rulings kept"],
            ] as const
          ).map(([n, l]) => (
            <div key={l} className="rounded-[4px] bg-card p-3.5">
              <b className="type-num block text-[34px] leading-none">{n}</b>
              <small className="mt-1.5 block text-[14px] leading-snug text-muted-foreground">{l}</small>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">Facts settle when sources agree. A dispute reaches you when another answer couldn&apos;t settle it, or nobody checked a flag within a day (with the tie-break run on, once it has had its try).</p>
      </Section>
    </>
  );
}

const ICONS: Record<FoundItem["kind"], string> = { show: "Show", season: "Season", castaway: "Cast", couch: "Couch", person: "Person", rulebook: "Rulebook", fact: "Fact" };

function FindTab() {
  const [q, setQ] = useState("");
  const found = useDesk<{ found: FoundItem[] }>(`/find?q=${encodeURIComponent(q.trim())}`);
  return (
    <Section>
      <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input">
        <Search className="size-5 text-muted-foreground" aria-hidden />
        <input data-find value={q} onChange={(e) => setQ(e.target.value)} placeholder="A show, season, castaway, couch or person" aria-label="Find anything" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" />
      </label>
      <p className="mb-1 mt-2 text-[13px] leading-snug text-muted-foreground">Everything can be changed from its page. Changes show their reach before you save, and every one is in its history.</p>
      {q.trim() === "" && <p className="mt-3 text-[13px] text-muted-foreground">Airing now:</p>}
      <div data-found>
        {(found.data?.found ?? []).map((f, i) => (
          <ItemRow key={`${f.href}-${i}`} data={f.kind} href={f.href} tag={ICONS[f.kind]} title={f.title} line={f.line} />
        ))}
        {found.data && !found.data.found.length && <p className="mt-3 text-[14px] text-muted-foreground">Nothing matches.</p>}
      </div>
    </Section>
  );
}

function SettingsTab() {
  const q = useDesk<{ settings: DeskSettings; history: DeskLine[] }>("/settings");
  const after = useAfterDesk();
  const [sheet, setSheet] = useState<"confirm" | "couches" | "tiebreak" | null>(null);
  if (!q.data) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const s = q.data.settings;
  const put = async (body: Record<string, unknown>, done: string) => {
    try {
      await deskSend("/settings", body, "PUT");
      await after();
      setSheet(null);
      toast(done);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <>
      <Section title="Results">
        <Row title="Confirmed needs" detail={`${s.confirmAt} sources that agree`} onClick={() => setSheet("confirm")} />
        <Row title="Quick check" detail="Who went home, from one question · free" />
        <Row
          title="Tie-break run"
          detail={s.tiebreak.on ? `On · when a result is disputed for a day, our bot asks once more` : "Off · a dispute waits for someone to check it again"}
          onClick={() => setSheet("tiebreak")}
        />
      </Section>
      <Section title="Autopilot trial" aside="Our bot">
        <p className="mb-2 text-[13px] leading-snug text-muted-foreground">
          The bot&apos;s schedule, season by season: what Autopilot will be. Couches see &ldquo;Autopilot · On for this season&rdquo; while it checks results. Change it on a season&apos;s page.
        </p>
        <div data-autopilot>
          {s.autopilot.length ? (
            s.autopilot.map((a) => <ItemRow key={a.id} data="season" href={paths.deskItem("season", a.id)} tag="On" title={a.name} line={a.line} />)
          ) : (
            <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">No season&apos;s bot is on. Switch one on from its page (Find › a season).</p>
          )}
        </div>
      </Section>
      <Section title="Couches">
        <Row title="Who fills in results, for new couches" detail={s.newCouchesAnyone ? "Anyone on the couch" : "Only people who run games"} onClick={() => setSheet("couches")} />
      </Section>
      <Section title="Rulebooks">
        <div data-rulebooks-status className="rounded-[4px] bg-card p-3.5 text-[14px] leading-snug">
          {s.rulebooks.everywhere ? (
            <b>Every season&apos;s leagues play by its rulebook.</b>
          ) : s.rulebooks.seasons.length ? (
            <>
              <b className="block">Leagues play by their rulebook on {s.rulebooks.seasons.map((x) => x.name).join(", ")}.</b>
              <small className="text-muted-foreground">Everywhere else they play by their show&apos;s rules. Switch a season on from its rulebook.</small>
            </>
          ) : (
            <>
              <b className="block">Leagues play by their show&apos;s rules.</b>
              <small className="text-muted-foreground">Switch a season&apos;s leagues onto its rulebook from the rulebook&apos;s page (Find › a season). Edits reach them once they&apos;re on.</small>
            </>
          )}
        </div>
      </Section>
      <Section title="History">
        <History lines={q.data.history} emptyLine="No settings changed yet." />
      </Section>
      <Sheet open={sheet === "confirm"} onOpenChange={(o) => !o && setSheet(null)} title="Confirmed needs" subtitle="How many sources that agree confirm a result">
        <div className="flex flex-col gap-2">
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" data-confirm-at={n} aria-pressed={s.confirmAt === n} onClick={() => put({ confirmAt: n }, `Confirmed needs ${n} sources`)} className={`nd-press rounded-[3px] p-3.5 text-left ${s.confirmAt === n ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}>
              <b className="block text-[16px]">{n} sources</b>
              <small className="text-[13px] text-muted-foreground">{n === 2 ? "Recommended: two people's answers agreeing" : "Stricter: fewer results reach every league on their own"}</small>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">Every shared result is settled again with the new number.</p>
      </Sheet>
      <Sheet open={sheet === "tiebreak"} onOpenChange={(o) => !o && setSheet(null)} title="Tie-break run" subtitle={`When a result has been disputed for ${s.tiebreak.hours} hours`}>
        <div className="flex flex-col gap-2">
          {([
            [true, "On", "Our bot asks that episode's full results once more, as a source of its own. Most disputes settle; what doesn't comes to your Inbox. Free: about 2 minutes of the bot each."],
            [false, "Off", "A dispute waits for someone on a couch to check it again. A flag nobody checks within a day comes to your Inbox."],
          ] as const).map(([v, t, d]) => (
            <button key={String(v)} type="button" data-tiebreak={String(v)} aria-pressed={s.tiebreak.on === v} onClick={() => put({ tiebreak: v }, v ? "Tie-break run on" : "Tie-break run off")} className={`nd-press rounded-[3px] p-3.5 text-left ${s.tiebreak.on === v ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}>
              <b className="block text-[16px]">{t}</b>
              <small className="text-[13px] leading-snug text-muted-foreground">{d}</small>
            </button>
          ))}
        </div>
        <p data-tiebreak-reach className="mt-3 text-[13px] leading-snug text-muted-foreground">
          {s.tiebreak.reach.length ? `It reaches every season with shared results. Airing now: ${s.tiebreak.reach.join(", ")}.` : "It reaches every season with shared results. Nothing is airing now."}
        </p>
      </Sheet>
      <Sheet open={sheet === "couches"} onOpenChange={(o) => !o && setSheet(null)} title="New couches" subtitle="Who fills in results, until the couch changes it">
        <div className="flex flex-col gap-2">
          {([
            [true, "Anyone on the couch", "Recommended"],
            [false, "Only people who run games", ""],
          ] as const).map(([v, t, d]) => (
            <button key={String(v)} type="button" data-new-couches={String(v)} aria-pressed={s.newCouchesAnyone === v} onClick={() => put({ newCouchesAnyone: v }, `New couches: ${t.toLowerCase()}`)} className={`nd-press rounded-[3px] p-3.5 text-left ${s.newCouchesAnyone === v ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}>
              <b className="block text-[16px]">{t}</b>
              {d && <small className="text-[13px] text-muted-foreground">{d}</small>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
