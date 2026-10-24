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

/** A cast member's photo, cropped to the face; greyed once they're out. */
export function Face({ src, out, className = "", ...props }: { src: string; out?: boolean } & Omit<ComponentProps<"img">, "src">) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixture photos from the published mock
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
