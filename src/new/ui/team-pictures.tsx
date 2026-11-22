"use client";

import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { badgeTeamOf } from "@/lib/sports/team-badge";

// A team's picture as your couch set it (docs/PLAN-team-logos.md L4), in place of our badge. Our badge for a team carries its key
// (team-badge.ts teamBadgeSrc's `team`); your couches' pictures come once a session from /api/me/team-pictures (couch-pictures.ts
// yourTeamPictures: usually none). Anything that shows a photo (Face, CastawayAvatar, the roster's rows) hands a badge to
// <TeamPicture> and keeps drawing everything else itself, so a list of thousands of people asks nothing extra.

/** Your team pictures: a team's key to its picture's link. Empty while loading, signed out, or when none are set. */
export function useTeamPictures(): Record<string, string> {
  return (
    useQuery({
      queryKey: ["new-design", "team-pictures"],
      queryFn: async () => {
        const r = await fetch("/api/me/team-pictures");
        return r.ok ? ((await r.json()) as { pictures: Record<string, string> }).pictures : {};
      },
      staleTime: 10 * 60_000,
      retry: false,
    }).data ?? {}
  );
}

/** True when this photo is our badge for a team, so <TeamPicture> should draw it. */
export const isTeamBadge = (src: string | null | undefined) => badgeTeamOf(src) !== null;

/** Our badge for a team, or your couch's picture for it when there is one: an <img> with the caller's own classes. */
export function TeamPicture({ src, ...props }: { src: string } & Omit<ComponentProps<"img">, "src">) {
  const pictures = useTeamPictures();
  const key = badgeTeamOf(src);
  // eslint-disable-next-line @next/next/no-img-element -- a data: badge or a couch's own picture, both already the size shown
  return <img src={(key && pictures[key]) || src} alt="" {...props} />;
}

/** Your couch's picture for a team by its key (team-badge.ts teamKeyOf), or null: for a mark that isn't a photo (TeamMark, the
 *  scorebug's slab). */
export function useTeamPicture(key: string | null | undefined): string | null {
  const pictures = useTeamPictures();
  return (key && pictures[key]) || null;
}
