import type { Metadata } from "next";
import { wayIn } from "@/lib/server/way-in";
import { SignInScreen } from "@/new/welcome/sign-in";

export const metadata: Metadata = { title: "Sign in" };

// Signing in (step 9 part 2): ?next= a path to go on to (routes.ts safeNext), ?error= back from Google without a session.
export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { next, error } = await searchParams;
  return <SignInScreen way={await wayIn()} next={typeof next === "string" ? next : null} error={typeof error === "string" ? error : null} />;
}
