import { redirect } from "next/navigation";
import { paths } from "@/new/routes";

// A league's page opens on This week (docs/PLAN-sports-couch.md B1).
export default async function LeaguePage({ params }: PageProps<"/league/[sport]/[code]">) {
  const { sport, code } = await params;
  redirect(paths.league(`${sport}/${code}`.toLowerCase()));
}
