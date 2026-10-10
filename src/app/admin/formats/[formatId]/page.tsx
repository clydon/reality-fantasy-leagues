import { FormatPage } from "@/components/admin/formats-pages";

export default async function AdminFormatPage({ params }: PageProps<"/admin/formats/[formatId]">) {
  const { formatId } = await params;
  return <FormatPage formatId={decodeURIComponent(formatId)} />;
}
