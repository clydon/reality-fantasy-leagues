import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { wayIn } from "@/lib/server/way-in";
import { JoinScreen } from "@/new/screens/you";

export const metadata: Metadata = { title: "Join a couch" };

// An invite to a couch (step 9). Open signed out too: the couch first, then an account (part 2). ?welcome=1: back from
// Google or an emailed link, carrying on to where you are.
export default async function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{4,12}$/.test(code)) notFound();
  const { welcome } = await searchParams;
  return <JoinScreen code={code} way={await wayIn()} welcome={welcome === "1"} />;
}
