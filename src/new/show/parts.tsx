"use client";

import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SectionHead } from "../ui/parts";

// Small pieces the show space's tabs share (the mock's .blk, the cast's faces, an icon box).

/** A section of a tab: a heading with an aside, then its content (the mock's .blk). */
export function Block({ title, aside, id, className = "", children }: { title?: ReactNode; aside?: ReactNode; id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`mt-[26px] px-4 ${className}`}>
      {title && <SectionHead title={title} aside={aside} flush />}
      {children}
    </section>
  );
}

/** A cast member's photo, cropped to the face; greyed once they're out. No photo: their initial on a tile. */
export function Face({ src, name, out, className = "", ...props }: { src: string | null; name?: string; out?: boolean } & Omit<ComponentProps<"img">, "src">) {
  if (!src) {
    return (
      <span aria-hidden className={`type-caption grid place-items-center bg-secondary text-muted-foreground ${out ? "opacity-70" : ""} ${className}`}>
        {(name ?? "?").slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- cast photos come from anywhere a show's cast was imported from
    <img src={src} alt="" {...props} className={`object-cover object-[center_20%] ${out ? "grayscale" : ""} ${className}`} />
  );
}

/** A row's icon in its square (the mock's .ic). */
export function IconBox({ icon: Icon, className = "bg-secondary" }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${className}`}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
