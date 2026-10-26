import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function DriveLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/drive");
  return <>{children}</>;
}
