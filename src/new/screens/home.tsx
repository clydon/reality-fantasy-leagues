"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCurrentCouch, useHome, type Couch, type Home } from "../data";
import { CouchPages, MoreOnTheCouch } from "../hub/couch-pages";
import { Guide, StreamingRail } from "../hub/guide";
import { ProfileSheet } from "../hub/profile";
import { BothWatch, CouchWatching, Feed, Foot, GetGoing, GrowNote, nextShow, OnNow, StatusLine, UpNext, YourShows } from "../hub/sections";
import { useMe } from "../session";
import { TopBar } from "../ui/bars";
import { Btn, EmptyState } from "../ui/parts";

// The hub (/home; the mock's refine.js wireHub), in its two shapes:
//   grows with you: a new member's first week, or a couch with no games yet. The status line, Get the couch going
//     (a new couch), Up next, your shows, the guide, the feed, and a note of what shows up as the couch plays.
//   focus first: the status line, Up next, who's on now, your shows, the "you both watch" nudge, the guide, the
//     streaming rail, what the couch is watching, the feed, and More on the couch (six pages, one tap each).
// `?hub=focus`, `?hub=grow` (a new member) or `?hub=new` (a brand-new couch) shows that shape, for a look.

const WEEK = 7 * 24 * 60 * 60 * 1000;

function grows(couch: Couch | null, meId: string) {
  if (!couch || couch.games.length === 0) return true;
  const joined = couch.members.find((m) => m.userId === meId)?.joinedAt;
  return !!joined && Date.now() - Date.parse(joined) < WEEK;
}

export function HomeScreen() {
  const me = useMe();
  const { data: home, error, refetch } = useHome();
  const couch = useCurrentCouch(home);
  const asked = useSearchParams().get("hub");
  const [profile, setProfile] = useState(false);
  const shape = asked === "grow" || asked === "focus" ? asked : asked === "new" || grows(couch, me.id) ? "grow" : "focus";
  const newCouch = asked === "new" || (asked !== "grow" && (!couch || couch.games.length === 0));
  return (
    <div className="pb-[110px]" data-hub={home ? shape : undefined}>
      <TopBar me={me} onProfile={() => setProfile(true)} />
      {error ? (
        <EmptyState title="Couldn't load your couch" line={error.message} action={<Btn wide onClick={() => refetch()}>Try again</Btn>} />
      ) : !home ? (
        <HomeSkeleton />
      ) : shape === "grow" ? (
        <GrowHub home={home} couch={couch} newCouch={newCouch} />
      ) : (
        <FocusHub home={home} couch={couch} />
      )}
      <ProfileSheet open={profile} onOpenChange={setProfile} me={me} couch={couch} />
      <CouchPages home={home} couch={couch} />
    </div>
  );
}

function FocusHub({ home, couch }: { home: Home; couch: Couch | null }) {
  const up = nextShow(home);
  return (
    <>
      <StatusLine home={home} />
      {up && <UpNext home={home} show={up} couch={couch} />}
      <OnNow />
      <YourShows home={home} />
      <BothWatch />
      <Guide />
      <StreamingRail />
      <CouchWatching />
      <Feed />
      <MoreOnTheCouch />
      <Foot />
    </>
  );
}

function GrowHub({ home, couch, newCouch }: { home: Home; couch: Couch | null; newCouch: boolean }) {
  const up = nextShow(home);
  return (
    <>
      <StatusLine home={home} />
      {newCouch && <GetGoing couch={couch} />}
      {up && <UpNext home={home} show={up} couch={couch} />}
      <YourShows home={home} />
      <Guide />
      <Feed />
      <GrowNote />
      <Foot />
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy className="animate-pulse px-4 pt-2">
      <div className="h-11 rounded-[3px] bg-card" />
      <div className="mt-3 h-[330px] rounded-[4px] bg-card" />
      <div className="mt-10 h-6 w-36 rounded-[3px] bg-card" />
      <div className="mt-4 flex gap-3">
        <div className="h-[232px] w-[164px] rounded-[4px] bg-card" />
        <div className="h-[232px] w-[164px] rounded-[4px] bg-card" />
      </div>
    </div>
  );
}
