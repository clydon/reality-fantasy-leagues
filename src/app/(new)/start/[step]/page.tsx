import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { wayIn } from "@/lib/server/way-in";
import { START_STEPS } from "@/new/routes";
import { StartScreen } from "@/new/welcome/first-run";

export const metadata: Metadata = { title: "Get started" };

// First run: shows, where you are, your account, your people (step 9 part 2). Open signed out too. ?error= back from
// Google without a session; ?search opens the search on step 1.
export default async function StartPage({ params, searchParams }: PageProps<"/start/[step]">) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > START_STEPS) notFound();
  const { error } = await searchParams;
  return <StartScreen step={step} way={await wayIn()} error={typeof error === "string" ? error : null} />;
}
