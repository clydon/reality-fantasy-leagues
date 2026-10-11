import { cn } from "cn";

// The product name, set as type so it changes in one place while the name is still being decided
// (PRODUCT.md, Brand Commitments). The mark is a lower third in miniature: an angled tag tucked over
// a plate. Foreground and muted only, never chyron: yellow on this screen belongs to its one action.
export const PRODUCT_NAME = "LeagueCrafter";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex h-11 items-center gap-2", className)} aria-label={PRODUCT_NAME} role="img">
      <svg viewBox="0 0 30 20" className="h-[18px] w-[27px]" aria-hidden>
        <rect x="8" y="4" width="22" height="12" rx="1.5" className="fill-muted-foreground" />
        <path d="M0 4h14l-2.4 12H0z" className="fill-foreground" />
      </svg>
      <span className="type-caption text-[22px]" aria-hidden>
        League<span className="text-muted-foreground">Crafter</span>
      </span>
    </span>
  );
}
