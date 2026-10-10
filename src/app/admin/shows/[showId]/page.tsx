import { ShowPage } from "@/components/admin/shows-pages";

export default async function AdminShowPage({ params }: PageProps<"/admin/shows/[showId]">) {
  const { showId } = await params;
  return <ShowPage showId={showId} />;
}
