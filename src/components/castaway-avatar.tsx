"use client";

import { useState } from "react";
import type { Castaway } from "@/lib/game/types";
import { castawayPhotoSrc, initials } from "@/lib/game/selectors";
import { cn } from "cn";

// A castaway's photo, falling back to their initials. Direct translation of the live app's own
// pattern, which is the same expression repeated at every avatar site:
//   `c.photoUrl ? <img style="width:100%;height:100%;object-fit:cover"> : initials(c.name)`
// -- one component here instead, since this repo had that initials block copied into six places and
// every one of them needed the photo treatment.
//
// The caller passes the container classes, so each site keeps its own size (64px on the Board grid,
// 44px in the draft/mid-season pickers, 20px in Draft Results) and its own initials styling for the
// fallback -- but always a rounded square (rounded-lg or similar), never a circle, so a cast photo
// reads the same everywhere in the app. This only swaps what goes inside.
//
// A plain <img> rather than next/image, deliberately: the Photo URL field in League Settings accepts
// an arbitrary external URL, and next/image rejects remote hosts that aren't whitelisted in
// next.config, so using it would break exactly the case the field exists for. These are small fixed
// -size avatars, so the optimisation next/image would add isn't worth that.
export function CastawayAvatar({
  castaway,
  className,
}: {
  castaway: Pick<Castaway, "name" | "photoUrl">;
  className?: string;
}) {
  // A stored photoUrl can point at a file that isn't there (a hand-added castaway, a typo in the
  // Photo URL field, a dead external link). Falling back on error means a broken path shows initials
  // rather than a broken-image icon.
  const [failed, setFailed] = useState(false);
  const src = castawayPhotoSrc(castaway.photoUrl);

  return (
    <div className={cn("overflow-hidden", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- see the note above on next/image
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(castaway.name)
      )}
    </div>
  );
}
