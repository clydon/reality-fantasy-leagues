"use client";

import { useState } from "react";
import { ArrowLeftRight, KeyRound, LayoutTemplate, LogOut, MonitorSmartphone, Plus } from "lucide-react";
import { logOutTo } from "@/lib/auth-client";
import type { WayIn } from "@/lib/server/way-in";
import { couches as couchApi, setCouch, switchDesign, useAfterCouch, useCouchInvite, useCurrentCouch, useHome, type JoinGame } from "../data";
import { couchLine, FaceStack, openCouchSheet } from "../couch/couch-sheets";
import { JoinGameRow, JoinGameSheet, joinLine } from "../couch/join-game";
import { gameColour } from "../games";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import { Avatar, PageHeader, Wordmark } from "../ui/bars";
import { Btn, BtnLink, EmptyState, Row, SectionHead } from "../ui/parts";
import { Preview } from "../ui/preview";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { InviteWayIn } from "../welcome/invite";

// Settings (/settings) and joining a couch (/join/[code]). Settings has your couches (step 9) and going back to the
// classic design; the rest is step 15 (mock settings.js). The join page is real signed in (step 9 part 1) and for
// someone new (part 2: welcome/invite.tsx makes the account). First run is welcome/first-run.tsx.

export function SettingsScreen() {
  const me = useMe();
  const { data: home } = useHome();
  const current = useCurrentCouch(home);
  const [switching, setSwitching] = useState(false);
  const couches = home?.couches.map((c) => c.name) ?? [];
  return (
    <div className="pb-16">
      <PageHeader title="Settings" back={{ label: "Home", parent: paths.home }} />
      <div className="mx-4 mt-5 flex items-center gap-3 rounded-[3px] bg-card p-3">
        <Avatar id={me.id} name={me.name} size={56} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[17px] font-semibold">{me.name}</b>
          {couches.length > 0 && (
            <small className="mt-0.5 block text-[13px] text-muted-foreground">{couches.length > 2 ? `On ${couches.length} couches` : `On ${couches.join(" and ")}`}</small>
          )}
        </div>
        <Preview id="settings.profile" tag={false}>
          <Btn className="h-10 px-3.5 text-sm">Edit</Btn>
        </Preview>
      </div>
      <Preview id="settings.account" className="mx-4 mt-6" />
      <section className="mt-8" data-settings-couches>
        <SectionHead title="Your couches" aside={home ? `${home.couches.length}` : undefined} />
        <div className="flex flex-col px-4">
          {home?.couches.map((c) => (
            <button
              key={c.id}
              type="button"
              data-settings-couch={c.name}
              onClick={() => openCouchSheet({ kind: "details", couchId: c.id })}
              className="nd-press flex min-h-[64px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
            >
              <FaceStack people={c.members} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold">
                  {c.name}
                  {c.id === current?.id && <span className="ml-2 text-[12px] font-semibold text-muted-foreground">On the hub</span>}
                </b>
                <small className="block truncate text-[13px] text-muted-foreground">{couchLine(c)}</small>
              </span>
            </button>
          ))}
          {current && home && home.couches.length > 1 && (
            <Row icon={ArrowLeftRight} title="Switch couches" detail={`The hub shows ${current.name}`} onClick={() => openCouchSheet({ kind: "switch" })} />
          )}
          <Row icon={Plus} title="Start a couch" detail="Name it, get a code, send it to your people" onClick={() => openCouchSheet({ kind: "new" })} />
          <Row icon={KeyRound} title="Join a couch" detail="Got a code? Pull up a seat" onClick={() => openCouchSheet({ kind: "join" })} />
        </div>
      </section>
      <section className="mt-8">
        <SectionHead title="The new design" />
        <div className="flex flex-col px-4">
          <Row
            icon={MonitorSmartphone}
            title={switching ? "Switching…" : "Back to the classic design"}
            detail="Your games are the same in both. Come back any time from the menu."
            onClick={async () => {
              if (switching) return;
              setSwitching(true);
              try {
                await switchDesign("classic");
              } catch {
                setSwitching(false);
                toast("Couldn't switch. Try again.");
              }
            }}
          />
          <Row
            icon={LayoutTemplate}
            title="The full design"
            detail="Every screen as it's designed, with demo people. Opens in a new tab."
            onClick={() => window.open("/mock", "_blank", "noopener")}
          />
          <Row icon={LogOut} title="Sign out" onClick={() => logOutTo(paths.welcome)} />
        </div>
      </section>
    </div>
  );
}

/**
 * An invite (/join/[code]; the mock's round2.js joinRoute): the couch first (whose code, who's on it), then joining it,
 * then its games, each saying who may join (Join, Ask to join, Locked). Someone new (signed out, back from making an
 * account with ?welcome=1, or not let in yet) joins through welcome/invite.tsx: an account, where you are, the couch.
 */
export function JoinScreen({ code, way, welcome }: { code: string; way: WayIn; welcome: boolean }) {
  const q = useCouchInvite(code.toUpperCase());
  const after = useAfterCouch();
  const nav = useNav();
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const inv = q.data;
  if (q.error) {
    return (
      <div className="pb-16">
        <PageHeader title="Join a couch" back={{ label: "Home", parent: way.me ? paths.home : paths.welcome }} />
        <EmptyState
          icon={KeyRound}
          title="No couch with that code"
          line={`Check ${code.toUpperCase()} with whoever sent it.`}
          action={<BtnLink href={way.me ? paths.home : paths.welcome}>{way.me ? "Home" : "Game Your Show"}</BtnLink>}
        />
      </div>
    );
  }
  const lead = inv?.seasons[0];
  // Someone new: signed out, back from making an account, or not let in yet (early access).
  const newcomer = !way.me || welcome || !way.me.approved;
  return (
    <div className="pb-16" data-join-page={inv?.couch.name ?? ""}>
      <section className="relative isolate overflow-hidden px-4 pb-6 pt-[calc(14px+env(safe-area-inset-top,0px))]">
        {lead && (
          <>
            <ShowArt seasonId={lead.seasonId} artUrl={lead.artUrl} name={lead.name} className="absolute inset-0 -z-[2] size-full" />
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(22,20,29,.35),rgba(22,20,29,.82)_55%,var(--background))]" />
          </>
        )}
        <NavLink href={way.me ? paths.home : paths.welcome} aria-label="Home" className="inline-block">
          <Wordmark />
        </NavLink>
        <span className="type-caption mt-[88px] block w-fit bg-chyron py-1 pl-[7px] pr-3.5 text-[13px] tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          Invite · {code.toUpperCase()}
        </span>
        <h1 className="type-caption mt-2 min-h-[46px] text-[48px] leading-[.95]">{inv ? (inv.from ? `${inv.from} saved you a seat` : "Pull up a seat") : ""}</h1>
        {inv && (
          <div className="mt-3 flex items-center gap-2.5 text-[15px] font-semibold">
            <FaceStack people={inv.couch.faces} size={26} />
            {inv.couch.name} · {inv.couch.size} on the couch
          </div>
        )}
      </section>
      {!inv ? (
        <div aria-busy className="mx-4 h-60 animate-pulse rounded-[4px] bg-card" />
      ) : (
        <>
          <section className="px-4">
            {inv.onIt ? (
              <p className="text-[15px] leading-snug text-muted-foreground" data-on-couch>
                You&rsquo;re on the couch: its chat, its TV guide, its watch alongs. Each game decides who can play.
              </p>
            ) : newcomer ? (
              <InviteWayIn code={code} inv={inv} way={way} welcome={welcome} />
            ) : inv.signedIn ? (
              <>
                <p className="text-[15px] leading-snug text-muted-foreground">Join the couch for its chat, its TV guide and its watch alongs. Each game decides who can play.</p>
                <Btn
                  tone="must"
                  wide
                  className="mt-3"
                  data-join-couch
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await couchApi.join(code);
                      setCouch(r.couchId);
                      await after();
                      toast(`You joined ${r.name}`);
                    } catch (e) {
                      toast((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Joining…" : `Join ${inv.couch.name}`}
                </Btn>
              </>
            ) : null}
          </section>
          {inv.seasons.map((s) => (
            <section key={s.seasonId} className="mt-7 px-4" data-join-season={s.seasonId}>
              <SectionHead title={`${s.name.replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""} games`} aside={s.next ? `Episode ${s.next} is next` : undefined} flush />
              {inv.onIt ? (
                s.games.map((g) => <JoinGameRow key={g.leagueId} couchId={inv.couch.id} g={g} strong onJoin={setJoining} />)
              ) : (
                <ul>
                  {s.games.map((g) => (
                    <li key={g.leagueId} className="border-t border-border py-3 first:border-t-0" data-join-game={g.gameName}>
                      <div className="flex items-center gap-2.5">
                        <i className="size-3 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
                        <b className="type-caption flex-1 text-[20px]">{g.gameName}</b>
                        <span className="rounded-[2px] bg-secondary px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">{g.shared ? "Shared" : "Exclusive"}</span>
                      </div>
                      <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{joinLine({ ...g, you: null })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {inv.onIt && (
            <div className="mt-8 px-4">
              {lead ? (
                <Btn tone="ink" wide data-go-show onClick={() => nav.push(paths.show(lead.seasonId))}>
                  Go to {lead.name.replace(/^The /, "")}
                  {lead.seasonNumber ? ` ${lead.seasonNumber}` : ""}
                </Btn>
              ) : (
                <BtnLink tone="ink" wide href={paths.home}>
                  Go to {inv.couch.name}
                </BtnLink>
              )}
            </div>
          )}
          {inv.onIt && <JoinGameSheet couchId={inv.couch.id} game={joining} onOpenChange={(o) => !o && setJoining(null)} />}
        </>
      )}
    </div>
  );
}
