import { redirect } from "next/navigation";
import { paths } from "@/new/routes";

// A show opens on Tonight.
export default async function ShowPage({ params }: PageProps<"/show/[seasonId]">) {
  const { seasonId } = await params;
  redirect(paths.show(seasonId));
}
