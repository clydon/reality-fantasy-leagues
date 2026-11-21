"use client";

import type { HomeShow } from "../data";

// The shows whose "When a new episode airs" can be set (keep-up.ts, db/migrations/0141 show_follows.keep_up): since settings Round 2
// (C15) each show's own settings page sets it (settings/show-page.tsx); When results show lists them, each a link there.

export const plain = (s: HomeShow) => `${s.show.name.replace(/\s*\([^)]*\)\s*$/, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

/** Shows you follow, still on, that you don't play (a game's reveals move that one): the ones that can move along by
 *  themselves. */
export const autoShows = (shows: HomeShow[] | undefined) => (shows ?? []).filter((s) => s.following && !s.games.length && s.status !== "completed");
