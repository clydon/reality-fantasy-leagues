import { ShowSettingsPage } from "@/components/admin/shows-pages";

export default async function AdminShowSettingsPage({ params }: PageProps<"/admin/shows/[showId]/settings">) {
  const { showId } = await params;
  return <ShowSettingsPage showId={showId} />;
}
