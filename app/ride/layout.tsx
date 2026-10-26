import { userOrLogin } from "@/lib/guard";

export default async function RideLayout({ children }: { children: React.ReactNode }) {
  await userOrLogin("/ride");
  return <>{children}</>;
}
