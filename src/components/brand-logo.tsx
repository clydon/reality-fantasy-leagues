import Image from "next/image";
import { cn } from "cn";

const LOGOS = {
  // The wide wordmark (login screen, Dashboard) and the sidebar's compact one. The dark versions are
  // the same art with the cream background taken out, the black "SURVIVOR" turned to the dark
  // theme's text colour and the gold lifted (made from the light ones; see the commit that added them).
  banner: { light: "/banner.png", dark: "/banner-dark.png", width: 1024, height: 256 },
  sidebar: { light: "/sidebar-logo.jpg", dark: "/sidebar-logo-dark.png", width: 855, height: 301 },
};

// Both versions are rendered and CSS shows the one matching the theme (the .dark class on <html>),
// so the right logo is there on first paint with no swap once the theme is read.
export function BrandLogo({ kind, className, priority }: { kind: keyof typeof LOGOS; className?: string; priority?: boolean }) {
  const l = LOGOS[kind];
  return (
    <>
      <Image src={l.light} alt="Survivor Fantasy Engine" width={l.width} height={l.height} className={cn(className, "dark:hidden")} priority={priority} />
      <Image src={l.dark} alt="Survivor Fantasy Engine" width={l.width} height={l.height} className={cn(className, "hidden dark:block")} priority={priority} />
    </>
  );
}
