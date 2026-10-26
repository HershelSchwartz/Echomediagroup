import type { Metadata } from "next";
import { PageShell } from "@/components/shared/PageShell";
import { Earnings } from "@/components/driver/Earnings";

export const metadata: Metadata = { title: "Earnings" };

export default function EarningsPage() {
  return <PageShell title="Earnings" back="/drive"><Earnings /></PageShell>;
}
