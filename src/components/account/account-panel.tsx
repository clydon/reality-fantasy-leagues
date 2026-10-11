"use client";

import { useSession } from "@/lib/auth-client";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ProfileSection } from "./profile-section";
import { PasswordSection } from "./password-section";
import { NotificationsSection } from "./notifications-section";
import { SpoilerSection } from "./spoiler-section";
import { ThemePicker } from "@/components/theme-picker";
import { InstallHint } from "@/components/install-hint";
import { LogOutButton } from "@/components/log-out-button";

// This app's own, and now only, account system (Better Auth, src/lib/auth.ts -- see
// CLAUDE.md/README for the history of it becoming the one real login for everything, not a
// parallel system). Two views:
//
//   signed in  -- Account Settings: profile, appearance (light/dark), password, spoiler protection, push notification preferences, the
//                 install-app hint, sign out. Reachable from the sidebar footer / mobile More
//                 sheet, and rendered inside the app shell, so there's a way back out.
//   signed out -- the front door (login-screen.tsx) opened on Create account, rendered by AuthGate;
//                 this component only sees a signed-out visitor mid-tour (see below).
export function AccountPanel() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (session?.user) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Account settings</h2>
        <div className="mx-auto max-w-[420px]">
          <ProfileSection />
          <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
            <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Appearance</h3>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex-1">Theme</span>
              <ThemePicker className="w-[200px] max-w-[60%]" />
            </div>
          </div>
          <PasswordSection />
          <SpoilerSection />
          <NotificationsSection />
          <InstallHint variant="section" />
          <div className="rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
            <LogOutButton />
          </div>
        </div>
      </>
    );
  }

  // Signed out, AuthGate shows the front door here instead (login-screen.tsx, opened on Create
  // account). This page only renders signed out for a visitor touring without an account, inside
  // the shell: the same form, so they can sign up without leaving the tour's chrome.
  return (
    <div className="mx-auto max-w-[420px]">
      <h2 className="type-caption mb-3 text-[24px]">Create your account</h2>
      <SignUpForm />
      <p className="mt-4 text-sm text-muted-foreground">
        Already have one?{" "}
        {/* A full load on purpose: it drops the tour's state, so "/" is the front door again. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="font-semibold text-chyron-line underline-offset-2 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
