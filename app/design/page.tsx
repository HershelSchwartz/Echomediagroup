import type { Metadata } from "next";
import { DesignPreview } from "@/components/DesignPreview";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

export default function DesignPage() {
  return <DesignPreview />;
}
