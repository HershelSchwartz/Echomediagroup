import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { Wallet } from "@/components/rider/Wallet";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <PageShell title="Wallet" back="/ride"><Suspense><Wallet devCards={process.env.NODE_ENV !== "production"} /></Suspense></PageShell>;
}
