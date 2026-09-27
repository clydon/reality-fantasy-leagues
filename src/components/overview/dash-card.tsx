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
    <Card className={cn("border border-border shadow-sm rounded-lg", wide && "sm:col-span-2")}>
      <CardHeader className={cn(aside && "flex flex-row items-baseline justify-between gap-2")}>
        <CardTitle className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Matches .dash-big: font-mono, 1.9rem, bold, tight line-height.
export function DashBig({ children }: { children: ReactNode }) {
  return <div className="font-mono text-3xl font-bold leading-none">{children}</div>;
}

// Matches .dash-link -- a real navigation link now that the app has real routes.
export function DashLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-2.5 inline-block text-[0.8rem] font-semibold text-primary hover:underline">
      {children}
    </Link>
  );
}
