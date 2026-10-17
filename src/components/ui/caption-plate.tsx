import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";

// Direction A's signature element (docs/PLAN-ux-redesign.md, "Lower Third"): a broadcast caption.
// A short coloured tag, angled on its right edge, then a white plate carrying a condensed caps title
// and one line of detail, with an optional action on the end. Used for the moments that matter --
// "your turn", "results are in", last week's score, who went home -- not for every row.
//
// Renders as a Link (href), a button (onClick) or a plain block, so it's one component for alerts,
// navigation and static captions alike.

export type CaptionTone = "chyron" | "live" | "good" | "quiet";

const TONES: Record<CaptionTone, string> = {
  chyron: "bg-chyron text-chyron-foreground",
  live: "bg-live text-live-foreground",
  good: "bg-good text-good-foreground",
  quiet: "bg-quiet-tag text-quiet-tag-foreground",
};

/** A tag in someone's own colour (a player, a tribe), with whichever ink reads on it: plate ink on a
 *  light colour, white on a dark one. Colours are user-chosen, so this can't be fixed per tone. */
export function colourTag(hex: string): CSSProperties {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { background: hex, color: "#fff" };
  const n = parseInt(m[1], 16);
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Where white and near-black give the same contrast.
  return { background: hex, color: lum > 0.18 ? "#121018" : "#fff" };
}

export function CaptionPlate({
  tag,
  tone = "chyron",
  tagStyle,
  image,
  title,
  subtitle,
  action,
  actionTone,
  href,
  onClick,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: {
  /** Short label in the angled tag ("New", "Ep 3", "Out"). Keep it to a word or two. */
  tag: ReactNode;
  tone?: CaptionTone;
  /** Overrides the tone's colours, e.g. a tribe's own colour. */
  tagStyle?: CSSProperties;
  /** A photo before the tag (who went home, who's up). Decorative: the title names them. */
  image?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Text for the action at the right end; gets a chevron. Only meaningful with href or onClick. */
  action?: ReactNode;
  /** "chyron": the action is the screen's "now" (Reveal), a yellow block at the plate's end. */
  actionTone?: "chyron";
  href?: string;
  onClick?: () => void;
  size?: "md" | "sm";
  className?: string;
  "aria-label"?: string;
}) {
  const body = (
    <>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- cast photos are plain files under /photos, any size
        <img src={image} alt="" className="w-14 shrink-0 object-cover object-top" />
      )}
      <span
        className={cn(
          "type-caption tag-cut flex shrink-0 items-center pl-3 pr-5 tracking-[0.04em]",
          size === "sm" ? "text-[13px]" : "text-[15px]",
          TONES[tone],
        )}
        style={tagStyle}
      >
        {tag}
      </span>
      <span className="tag-tuck flex min-w-0 flex-1 flex-col justify-center gap-0.5 bg-plate px-3 py-2 text-plate-foreground">
        <span className={cn("type-caption truncate", size === "sm" ? "text-[19px]" : "text-[22px]")}>{title}</span>
        {subtitle && <span className="truncate text-[13px] text-plate-muted">{subtitle}</span>}
      </span>
      {action && (
        <span
          className={cn(
            "flex shrink-0 items-center gap-0.5 text-[15px] font-bold",
            actionTone === "chyron" ? "bg-chyron px-3.5 text-chyron-foreground" : "bg-plate pl-1 pr-3 text-plate-foreground",
          )}
        >
          {action}
          <ChevronRight className="size-[18px]" strokeWidth={2.4} aria-hidden />
        </span>
      )}
    </>
  );
  const cls = cn(
    // The plate colour under the whole strip: the tag's edge antialiases against the same white all the
    // way along, so a strip at a half-pixel position has no step where the plate starts.
    "isolate flex w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left shadow-plate",
    size === "sm" ? "min-h-[52px]" : "min-h-[60px]",
    (href || onClick) && "transition-[filter] hover:brightness-[1.04] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} aria-label={ariaLabel}>
      {body}
    </div>
  );
}
