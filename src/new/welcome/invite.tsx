"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logOutTo } from "@/lib/auth-client";
import type { WayIn } from "@/lib/server/way-in";
import { couches as couchApi, saveFirstRun, setCouch, type CouchInvite } from "../data";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { AccountForm, CheckEmail, GoogleButton, OrLine, UsernameSheet } from "./account";
import { WhereRow } from "../watching/where";

// An invite for someone new (docs/PLAN-new-design.md step 9 part 2; the mock's landing.js joinRoute, joinAccount and
// joinWhereSheet): the couch is on the page first (JoinScreen), then joining asks for an account (a sheet: Google when
// it's set up, else the account form), then where you are in the couch's shows (so nothing on it spoils them; nothing
// seen until you say), then you're on the couch and its games are yours to join. An emailed link or Google comes back
// with ?welcome=1, which carries on from where you are. An account early access hasn't let in joins when the desk's
// Who gets in lets invites in (the join lets it in), and otherwise is told it's on the list.

type Phase = "idle" | "account" | "where" | "waiting";

export function InviteWayIn({ code, inv, way, welcome }: { code: string; inv: CouchInvite; way: WayIn; welcome: boolean }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState(!!way.me);
  const [named, setNamed] = useState(!way.me || !!way.me.username);
  const [phase, setPhase] = useState<Phase>("idle");
  const [check, setCheck] = useState<string | null>(null);
  const [where, setWhere] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const here = `${paths.join(code)}?welcome=1`;
  const name = inv.couch.name;

  // Back from Google or an emailed link: on to where you are.
  const carried = useRef(false);
  useEffect(() => {
    if (welcome && way.me && named && !carried.current) {
      carried.current = true;
      setPhase("where");
    }
  }, [welcome, way.me, named]);

  async function join() {
    setBusy(true);
    try {
      if (inv.seasons.length) {
        await saveFirstRun(inv.seasons.map((s) => ({ seasonId: s.seasonId, seenThrough: Math.min(where[s.seasonId] ?? 0, s.aired) })));
      }
      const r = await couchApi.join(code);
      setCouch(r.couchId);
      setPhase("idle");
      toast(`Welcome to ${r.name}`);
      // The page reads the invite again: you're on it, and its games are yours to join.
      await qc.invalidateQueries({ queryKey: ["new-design"] });
    } catch (e) {
      if ((e as { status?: number }).status === 403) setPhase("waiting");
      else toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (phase === "waiting") {
    return (
      <div className="rounded-[4px] bg-card p-4" data-waiting>
        <b className="type-caption block text-[26px]">You&rsquo;re on the list</b>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
          We&rsquo;re letting people in a few at a time, and your shows are saved. Once you&rsquo;re in, open this invite again to join {name}.
        </p>
        <Btn wide className="mt-3" onClick={() => logOutTo(paths.welcome)}>
          Sign out
        </Btn>
      </div>
    );
  }

  return (
    <div data-invite-way-in>
      <p className="text-[15px] leading-snug text-muted-foreground">You&rsquo;re invited to {name}: its chat, its TV guide, its watch alongs. Each game decides who can play.</p>
      <Btn tone="must" wide className="mt-3" data-join-couch disabled={busy} onClick={() => setPhase(signedIn ? "where" : "account")}>
        {busy ? "Joining…" : `Join ${name}`}
      </Btn>
      {!signedIn && (
        <p className="mt-3 text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <a href={paths.signin(paths.join(code))} className="font-bold text-foreground underline underline-offset-[3px]">
            Sign in
          </a>
        </p>
      )}

      <Sheet open={phase === "account"} onOpenChange={(o) => !o && setPhase("idle")} title="Make an account" subtitle={`Free. Then you're on ${name}.`}>
        <div className="flex flex-col gap-2.5" data-invite-account>
          {check ? (
            <CheckEmail email={check} line={`Open it on this phone to finish joining ${name}.`} />
          ) : (
            <>
              {way.google && (
                <>
                  <GoogleButton callbackURL={here} errorCallbackURL={`${paths.join(code)}?error=google`} />
                  <OrLine />
                </>
              )}
              <AccountForm
                callbackURL={here}
                onMade={(m) => {
                  if ("checkEmail" in m) return setCheck(m.checkEmail);
                  setSignedIn(true);
                  setPhase("idle");
                  // One sheet down, the next up.
                  setTimeout(() => setPhase("where"), 300);
                }}
              />
            </>
          )}
        </div>
      </Sheet>

      <Sheet
        open={phase === "where"}
        onOpenChange={(o) => !o && setPhase("idle")}
        title={inv.seasons.length === 1 ? `Where are you in ${inv.seasons[0].name.replace(/^The /, "")}${inv.seasons[0].seasonNumber ? ` ${inv.seasons[0].seasonNumber}` : ""}?` : "Where are you in its shows?"}
        subtitle="So nothing on the couch spoils it"
      >
        <div data-invite-where>
          {inv.seasons.map((s) => {
            const label = `${s.name.replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;
            return (
              <WhereRow
                key={s.seasonId}
                s={{ seasonId: s.seasonId, label, show: s.name, artUrl: s.artUrl, artPosition: "center", aired: s.aired, status: s.aired ? "airing" : "upcoming", premiere: null }}
                seen={where[s.seasonId] ?? 0}
                onChange={(n) => setWhere({ ...where, [s.seasonId]: n })}
              />
            );
          })}
          {!inv.seasons.length && <p className="text-[15px] text-muted-foreground">{name} isn&rsquo;t playing anything right now.</p>}
          <Btn tone="must" wide className="mt-4" data-where-go disabled={busy} onClick={join}>
            {busy ? "Joining…" : "Continue"}
          </Btn>
        </div>
      </Sheet>

      <UsernameSheet open={!named} email={way.me?.email ?? null} onDone={() => setNamed(true)} />
    </div>
  );
}
