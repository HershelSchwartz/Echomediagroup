import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { Wallet } from "@/components/rider/Wallet";
import { testTools } from "@/lib/mode";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <PageShell title="Wallet" back="/ride"><Suspense><Wallet devCards={testTools()} /></Suspense></PageShell>;
}
