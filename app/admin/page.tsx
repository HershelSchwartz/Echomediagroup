import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const metadata: Metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") return <main className="grid min-h-dvh place-items-center p-6 text-center"><p>You don't have access to the operations console.</p></main>;
  return <AdminConsole />;
}
