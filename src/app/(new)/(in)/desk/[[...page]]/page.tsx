import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DESK_PAGES, DESK_TABS, isDeskKind } from "@/new/routes";
import { DeskScreen } from "@/new/desk/desk";

export const metadata: Metadata = { title: "Admin" };

// The admin's desk (docs/PLAN-new-design.md step 6b part 2): /desk (Inbox), /desk/find, /desk/settings, the library and New
// show (/desk/library, /desk/new: step 10 part 3), Find › People (/desk/people: PLAN-desk-parity.md step 1), and one
// thing's page at /desk/[kind]/[id]. Site admins only: every read
// behind it is checked by its own /api/desk route.
export default async function DeskRoute({ params }: PageProps<"/desk/[[...page]]">) {
  const { page = [] } = await params;
  const [first, id] = page;
  if (page.length > 2) notFound();
  if (page.length === 2 && !isDeskKind(first)) notFound();
  const pages: readonly string[] = [...DESK_TABS, ...DESK_PAGES];
  if (page.length === 1 && !pages.includes(first)) notFound();
  return <DeskScreen tab={page.length === 2 ? null : ((first as (typeof DESK_TABS)[number] | (typeof DESK_PAGES)[number]) ?? "inbox")} item={page.length === 2 && isDeskKind(first) ? { kind: first, id } : null} />;
}
