import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { PageShell } from "@/components/shared/PageShell";
import { Account } from "@/components/rider/Account";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = (await getUser())!;
  return <PageShell title="Account" back="/ride"><Account user={{ name: user.name ?? "", email: user.email ?? "", phone: user.phone, rating: user.rating }} /></PageShell>;
}
