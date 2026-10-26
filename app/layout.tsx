import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/lib/brand";
import { demoMode } from "@/lib/mode";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {demoMode() && (
          <p role="note" className="bg-warning-soft px-3 py-1 text-center text-xs text-warning">
            Test version: fake people and test cards only. Don't enter real card details or personal information.
          </p>
        )}
        {children}
      </body>
    </html>
  );
}
