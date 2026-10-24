import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { START_STEPS } from "@/new/routes";
import { StartScreen } from "@/new/screens/you";

export const metadata: Metadata = { title: "Get started" };

// First run: shows, where you are, your account, your people (step 9). Open signed out too.
export default async function StartPage({ params }: PageProps<"/start/[step]">) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > START_STEPS) notFound();
  return <StartScreen step={step} />;
}
