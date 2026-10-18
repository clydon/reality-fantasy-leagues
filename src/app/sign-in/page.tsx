import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

// Signed out, AuthGate draws the sign-in screen here; signed in, it sends you on to "/". The route
// only exists so /sign-in is a real page (the landing page links to it) rather than a 404.
export default function SignIn() {
  return null;
}
