import { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

// Shared shell for the Overview cards -- matches the live app's .dash-card: uppercase muted
// small-caps header (h3 in the original CSS), plain panel body, optional wide span. One
// component instead of one-off markup per card, per CLAUDE.md's "grep for the closest existing
// pattern" convention translated into component terms.
export function DashCard({
  title,
  wide,
  aside,
  children,
}: {
  title: ReactNode;
  wide?: boolean;
  /** Shown at the right end of the title line. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Direction A (docs/PLAN-ux-redesign.md): no card box, just a condensed caps heading over the
    // content, so sections read as a broadcast rundown rather than a stack of tiles.
    <Card
      className={cn(
        "gap-2.5 overflow-visible rounded-none border-0 bg-transparent py-0 shadow-none ring-0",
        wide && "sm:col-span-2",
      )}
    >
      <CardHeader className={cn("px-0", aside && "flex flex-row items-baseline justify-between gap-2")}>
        <CardTitle className="type-caption text-[24px] font-extrabold leading-none text-foreground">
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
    </Card>
  );
}

// Matches .dash-big: font-mono, 1.9rem, bold, tight line-height.
export function DashBig({ children }: { children: ReactNode }) {
  return <div className="type-num text-[44px]">{children}</div>;
}

// Matches .dash-link -- a real navigation link now that the app has real routes.
export function DashLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-2.5 inline-block text-[0.8rem] font-semibold text-chyron-line hover:underline">
      {children}
    </Link>
  );
}
