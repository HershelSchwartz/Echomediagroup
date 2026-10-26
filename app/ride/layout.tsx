import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function RideLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/ride");
  if (!user.name) redirect("/login?next=/ride");
  return <>{children}</>;
}
