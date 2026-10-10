"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { type BackTarget, useBackTarget } from "@/lib/nav-trail";

// A page's back, always named: "‹ Overview", "‹ Episodes" (lib/nav-trail.ts decides which). When it's
// the page you came from it pops history, so the phone's back gesture agrees and the page you return
// to keeps its scroll; otherwise it's an ordinary link to the page's parent.
export function BackLink({
  target,
  variant = "page",
  className,
}: {
  target: BackTarget;
  /** "header": the mobile header's left slot. "page": above a desktop page's title. */
  variant?: "header" | "page";
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={target.href}
      onClick={(e) => {
        if (!target.viaHistory || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.back();
      }}
      aria-label={`Back to ${target.label}`}
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center font-semibold text-muted-foreground transition-colors hover:text-foreground active:text-foreground",
        variant === "header" ? "-my-1.5 -ml-2 max-w-full gap-0 pr-1 text-[15px]" : "-ml-1 gap-0.5 self-start pr-2 text-sm",
        className,
      )}
    >
      <ChevronLeft className={cn("shrink-0", variant === "header" ? "size-6 text-foreground" : "size-5")} strokeWidth={2.2} aria-hidden />
      <span className="truncate">{target.label}</span>
    </Link>
  );
}

/** The desktop page's back, from where you came (or `fallback`, else the page's parent). */
export function PageBackLink({ fallback, className }: { fallback?: { href: string; label: string }; className?: string }) {
  const target = useBackTarget(fallback);
  return target ? <BackLink target={target} className={className} /> : null;
}
