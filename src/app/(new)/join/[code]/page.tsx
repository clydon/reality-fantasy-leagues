import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JoinScreen } from "@/new/screens/you";

export const metadata: Metadata = { title: "Join a couch" };

// An invite to a couch (step 9). Open signed out too: the couch first, then an account.
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) notFound();
  return <JoinScreen code={code} />;
}
