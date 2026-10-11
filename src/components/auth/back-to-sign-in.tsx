import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// The way back from forgot / reset password. Back always says where it goes (DESIGN.md, Layout).
export function BackToSignIn() {
  return (
    <Link
      href="/"
      className="-mr-2 flex h-11 items-center gap-0.5 rounded-[6px] px-2 text-sm font-semibold text-chyron-line hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
    >
      <ChevronLeft className="size-[18px]" strokeWidth={2.4} aria-hidden />
      Sign in
    </Link>
  );
}
