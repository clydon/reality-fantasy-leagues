import { SeasonSetupPage } from "@/components/admin/season-setup";

export default async function AdminSeasonSetupPage({ params }: PageProps<"/admin/seasons/[seasonId]/setup">) {
  const { seasonId } = await params;
  return <SeasonSetupPage seasonId={seasonId} />;
}
