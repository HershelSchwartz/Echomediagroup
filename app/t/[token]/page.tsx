import type { Metadata } from "next";
import { SharedTrip } from "@/components/shared/SharedTrip";

export const metadata: Metadata = { title: "Live trip", robots: { index: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedTrip token={token} />;
}
