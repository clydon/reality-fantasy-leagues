import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDeskKind } from "@/new/routes";
import { DeskScreen } from "@/new/desk/desk";

export const metadata: Metadata = { title: "Admin" };

// The admin's desk (docs/PLAN-new-design.md step 6b part 2): /desk (Inbox), /desk/find, /desk/settings, and one thing's page
// at /desk/[kind]/[id]. Site admins only: every read behind it is checked by its own /api/desk route.
export default async function DeskRoute({ params }: PageProps<"/desk/[[...page]]">) {
  const { page = [] } = await params;
  const [first, id] = page;
  if (page.length > 2) notFound();
  if (page.length === 2 && !isDeskKind(first)) notFound();
  if (page.length === 1 && !["inbox", "find", "settings"].includes(first)) notFound();
  return <DeskScreen tab={page.length === 2 ? null : ((first as "inbox" | "find" | "settings") ?? "inbox")} item={page.length === 2 && isDeskKind(first) ? { kind: first, id } : null} />;
}
