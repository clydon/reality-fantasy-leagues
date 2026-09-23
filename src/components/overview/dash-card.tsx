import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

// Shared shell for the Overview cards -- matches the live app's .dash-card: uppercase muted
// small-caps header (h3 in the original CSS), plain panel body, optional wide span. One
// component instead of one-off markup per card, per CLAUDE.md's "grep for the closest existing
// pattern" convention translated into component terms.
export function DashCard({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={cn("border border-border shadow-sm rounded-lg", wide && "sm:col-span-2")}>
      <CardHeader>
        <CardTitle className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Matches .dash-big: font-mono, 1.9rem, bold, tight line-height.
export function DashBig({ children }: { children: ReactNode }) {
  return <div className="font-mono text-3xl font-bold leading-none">{children}</div>;
}

// Matches .dash-link -- inert for now since this POC is single-tab (no real navigation exists
// yet to wire it to); kept visually identical so tab-to-tab porting later is a drop-in.
export function DashLink({ children }: { children: ReactNode }) {
  return (
    <span className="mt-2.5 inline-block cursor-default text-[0.8rem] font-semibold text-primary">
      {children}
    </span>
  );
}
