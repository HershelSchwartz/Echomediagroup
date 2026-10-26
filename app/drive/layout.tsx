import { userOrLogin } from "@/lib/guard";

export default async function DriveLayout({ children }: { children: React.ReactNode }) {
  await userOrLogin("/drive");
  return <>{children}</>;
}
