import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Landing } from "@/new/welcome/landing";

// The new design's front door (docs/PLAN-new-design.md step 9 part 2; the mock's landing.js welcomeRoute). Classic's
// landing stays at "/" for anyone signed out until cutover (step C points "/" here), so this one isn't indexed yet.
export const metadata: Metadata = {
  title: { absolute: "Game Your Show: turn any TV show into a game with friends" },
  description: "Free games for any TV show. Draft the cast, set a lineup, call who goes home and play along with your couch. Spoiler-safe, on any phone.",
  robots: { index: false, follow: true },
};

export default async function WelcomePage() {
  // Only whether there's a session cookie (as the root layout reads it): signed in, the top offers the app instead.
  const signedIn = (await cookies()).getAll().some((c) => c.name.endsWith("better-auth.session_token"));
  return <Landing signedIn={signedIn} />;
}
