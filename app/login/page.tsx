import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginFlow } from "./LoginFlow";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--layout-app-max)] flex-col px-4 py-8">
      <Suspense>
        <LoginFlow />
      </Suspense>
    </main>
  );
}
