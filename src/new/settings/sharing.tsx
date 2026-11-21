"use client";

import { ChevronRight, EyeOff } from "lucide-react";
import { SHARE_DEFAULT } from "@/lib/sharing";
import type { HomeShow, Profile, profileApi } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { PageSection, SwitchRow } from "./controls";
import { plain } from "./keep-up";

// Privacy (settings Round 1, C6; docs/design-round/settings-r1-spec.md): one switch, "Your couches see how far you've watched"
// (Where I am, with When I'm watching merged into it), and what someone on your couch sees about you as it changes. GIFs and
// reactions show whenever you post one (posting is the choice), and your picks once they lock (the games need them): two facts,
// not switches. Then the shows you've hidden from your couch, each a link to it. The server enforces it (guard.ts rule 3).

type Save = (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => Promise<void>;

/** Your settings' Privacy row: the one switch's outcome. */
export const privacyValue = (p: Profile | undefined) => (!p ? "…" : (p.sharing.on.where ?? SHARE_DEFAULT.where) ? "Your couches see how far you've watched" : "How far you've watched is hidden");

/** The Privacy page. `viewer`: someone else on the couch you're on, whose eyes the preview is seen through. `hidden`: shows you've
 *  hidden from your couch. */
export function PrivacyPage({ p, save, viewer, hidden }: { p: Profile | undefined; save: Save; viewer: string | null; hidden: HomeShow[] }) {
  const me = useMe();
  const on = p?.sharing.on.where ?? SHARE_DEFAULT.where;
  const name = p?.name ?? me.name;
  const lines = [
    { k: "where", text: on ? (p?.sharing.lines.where ?? `How far ${name} has watched`) : null },
    { k: "now", text: on ? (p?.sharing.lines.now ?? `When ${name} is watching along`) : null },
    { k: "gifs", text: p?.sharing.lines.gifs ?? `${name}'s episode GIFs, once posted` },
  ];
  return (
    <div data-settings-sharing data-level={on ? "where" : "hidden"} className="pb-10">
      <PageSection title="How far you've watched">
        <SwitchRow
          data="share-where"
          on={on}
          disabled={!p}
          title="Your couches see how far you've watched"
          line={on ? "Which episode you're up to on each show, and when you're watching along" : "Off · they see your games, but not where you're up to"}
          onChange={(next) => void save({ sharing: { where: next } }, next ? "Your couches see how far you've watched" : "How far you've watched is hidden from your couches", { sharing: { where: !next } })}
        />
        <div className="mt-2 rounded-[4px] bg-card p-3" data-sharing-preview>
          <span className="type-caption mb-1.5 block text-[13px] tracking-[0.06em] text-muted-foreground">{viewer ? `What ${viewer} sees about you` : "What your couch sees about you"}</span>
          {lines.map((l) => (
            <div key={l.k} data-sees={l.k} data-shown={l.text ? "yes" : "no"} className={`flex min-h-[34px] items-center gap-2.5 text-[14px] ${l.text ? "" : "text-muted-foreground"}`}>
              {l.text ? (
                <Avatar id={me.id} name={name} size={22} />
              ) : (
                <span className="grid size-[22px] flex-none place-items-center rounded-[3px] bg-secondary" aria-hidden>
                  <EyeOff className="size-[13px]" />
                </span>
              )}
              <span className="min-w-0">{l.text ?? "Hidden"}</span>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection title="Always shown" line="Nothing here is a setting: it's what playing together needs.">
        <p className="border-t border-border py-3 text-[14px] leading-snug first:border-t-0">
          <b className="block text-[15px] font-semibold">Your GIFs and reactions</b>
          <span className="text-muted-foreground">When you post one. Posting is the choice.</span>
        </p>
        <p className="border-t border-border py-3 text-[14px] leading-snug">
          <b className="block text-[15px] font-semibold">Your picks</b>
          <span className="text-muted-foreground">Once they lock: the games need them.</span>
        </p>
      </PageSection>

      <PageSection
        data="settings-hidden"
        title="Hidden from your couch"
        line={hidden.length ? "Nobody on your couches sees anything of these." : "Hide a show from the ⋯ menu on the show."}
      >
        {hidden.map((s) => (
          <NavLink key={s.seasonId} data-hidden-show={s.seasonId} href={paths.show(s.seasonId)} className="nd-press flex min-h-[56px] items-center gap-3 border-t border-border py-2 first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-semibold">{plain(s)}</b>
              <small className="block text-[13px] text-muted-foreground">Hidden from your couch</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </NavLink>
        ))}
      </PageSection>
    </div>
  );
}
