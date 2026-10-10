import { UserPage } from "@/components/admin/users-pages";

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  const { userId } = await params;
  return <UserPage userId={userId} />;
}
