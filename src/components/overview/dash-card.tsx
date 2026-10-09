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
    // Dark mode is direction A (docs/PLAN-ux-redesign.md): no card box, just a condensed caps heading
    // over the content, so sections read as a broadcast rundown rather than a stack of tiles. Light
    // mode keeps the card until it gets its own pass.
    <Card
      className={cn(
        "border border-border shadow-sm rounded-lg dark:gap-2.5 dark:overflow-visible dark:rounded-none dark:border-0 dark:bg-transparent dark:py-0 dark:shadow-none dark:ring-0",
        wide && "sm:col-span-2",
      )}
    >
      <CardHeader className={cn("dark:px-0", aside && "flex flex-row items-baseline justify-between gap-2")}>
        <CardTitle className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground dark:type-caption dark:text-[24px] dark:text-foreground">
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      <CardContent className="dark:px-0">{children}</CardContent>
    </Card>
  );
}

// Matches .dash-big: font-mono, 1.9rem, bold, tight line-height.
export function DashBig({ children }: { children: ReactNode }) {
  return <div className="font-mono text-3xl font-bold leading-none dark:type-num dark:font-sans dark:text-[44px]">{children}</div>;
}

// Matches .dash-link -- a real navigation link now that the app has real routes.
export function DashLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-2.5 inline-block text-[0.8rem] font-semibold text-primary hover:underline">
      {children}
    </Link>
  );
}
