"use client";

import { useState } from "react";
import { useAfterWatching, watching } from "../data";
import { toast } from "../ui/toast";

// The behind question's Not yet (the user's pick B, 2026-11-15, asked one episode at a time since 2026-11-17: step-through.tsx).
// Someone behind on an airing show has either watched it and not told the app (Joanna watches live with the couch) or is catching
// up; the app can't tell, so the progress control asks, both answers one tap. Not yet is remembered until a new episode airs, kept
// with your mark on the server (show_follows.not_yet, the same column as Live's "Not yet" on a show you watch), so a second phone
// of yours doesn't ask again.

/** "Still catching up", remembered for what's aired now (`notYet`, the show's read): asked again once a new episode airs. The
 *  answer shows at once and is saved behind it; a save that fails says so and asks again. */
export function useCatchingUp(seasonId: string, aired: number, notYet: number | null): [boolean, () => void] {
  const after = useAfterWatching();
  const [said, setSaid] = useState<number | null>(null);
  const at = Math.max(notYet ?? 0, said ?? 0) || null;
  const later = async () => {
    setSaid(aired);
    try {
      await watching.follow(seasonId, { notYet: aired });
      await after();
    } catch (e) {
      setSaid(null);
      toast.quiet((e as Error).message);
    }
  };
  return [at != null && at >= aired, () => void later()];
}
