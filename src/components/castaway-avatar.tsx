"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  expandable = false,
}: {
  castaway: Pick<Castaway, "name" | "photoUrl">;
  className?: string;
  /** Tap the photo to see it full size ("is this who I think it is?"). Only where tapping the photo
   *  does nothing else -- never on a card or row whose tap picks, starts or swaps someone. */
  expandable?: boolean;
}) {
  // A stored photoUrl can point at a file that isn't there (a hand-added castaway, a typo in the
  // Photo URL field, a dead external link). Falling back on error means a broken path shows initials
  // rather than a broken-image icon.
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const src = castawayPhotoSrc(castaway.photoUrl);
  const hasPhoto = !!src && !failed;
  const canZoom = expandable && hasPhoto;

  const photo = (
    <div className={cn("overflow-hidden", className, canZoom && "cursor-zoom-in")}>
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- see the note above on next/image
        <img src={src!} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(castaway.name)
      )}
    </div>
  );
  if (!canZoom) return photo;

  // Stops the tap here, so a card that expands on tap (the Board's stat cards) doesn't also toggle.
  const open = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setZoomed(true);
  };
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`See ${castaway.name}'s photo`}
        className="contents"
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e)}
      >
        {photo}
      </span>
      {zoomed && <PhotoZoom name={castaway.name} src={src!} onClose={() => setZoomed(false)} />}
    </>
  );
}

// The photo full size over everything, with the name under it. Any tap or Escape closes it. Portalled
// to <body> so no card's overflow or transform can clip or trap it.
function PhotoZoom({ name, src, onClose }: { name: string; src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div
      role="dialog"
      aria-label={name}
      className="fixed inset-0 z-[100] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/80 p-6"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above on next/image */}
      <img src={src} alt={name} className="max-h-[75vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" />
      <div className="text-lg font-bold text-white">{name}</div>
    </div>,
    document.body
  );
}
