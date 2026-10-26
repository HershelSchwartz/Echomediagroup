import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/shared/PageShell";
import { Help } from "@/components/rider/Help";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return <PageShell title="Help" back="/ride"><Suspense><Help /></Suspense></PageShell>;
}
