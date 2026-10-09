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
  good: "bg-good text-[#0e2b27]",
  quiet: "bg-muted text-foreground",
};

export function CaptionPlate({
  tag,
  tone = "chyron",
  tagStyle,
  title,
  subtitle,
  action,
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
  title: ReactNode;
  subtitle?: ReactNode;
  /** Text for the action at the right end; gets a chevron. Only meaningful with href or onClick. */
  action?: ReactNode;
  href?: string;
  onClick?: () => void;
  size?: "md" | "sm";
  className?: string;
  "aria-label"?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          "type-caption flex shrink-0 items-center pl-3 pr-5 tracking-[0.04em] [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]",
          size === "sm" ? "text-[13px]" : "text-[15px]",
          TONES[tone],
        )}
        style={tagStyle}
      >
        {tag}
      </span>
      <span className="-ml-2.5 flex min-w-0 flex-1 flex-col justify-center gap-0.5 bg-plate px-3 py-2 text-plate-foreground">
        <span className={cn("type-caption truncate", size === "sm" ? "text-[19px]" : "text-[22px]")}>{title}</span>
        {subtitle && <span className="truncate text-[13px] text-plate-muted">{subtitle}</span>}
      </span>
      {action && (
        <span className="flex shrink-0 items-center gap-0.5 bg-plate pl-1 pr-3 text-[15px] font-bold text-plate-foreground">
          {action}
          <ChevronRight className="size-[18px]" strokeWidth={2.4} aria-hidden />
        </span>
      )}
    </>
  );
  const cls = cn(
    "flex w-full items-stretch overflow-hidden rounded-[3px] text-left shadow-[0_6px_18px_rgba(0,0,0,0.3)]",
    size === "sm" ? "min-h-[52px]" : "min-h-[60px]",
    (href || onClick) && "transition-[filter] hover:brightness-[1.04] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron",
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
