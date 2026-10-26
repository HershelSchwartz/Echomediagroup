"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Banner } from "@/components/ui/Banner";
import { brand } from "@/lib/brand";

type Step = "phone" | "code" | "profile";

export function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ phone: string; devCode?: string }>("/api/auth/start", { body: { phone } });
      setNormalized(r.phone);
      setDevCode(r.devCode ?? null);
      setStep("code");
      setCode("");
      setResendIn(30);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ needsProfile: boolean }>("/api/auth/verify", { body: { phone: normalized, code } });
      if (r.needsProfile) setStep("profile");
      else { router.replace(next); router.refresh(); }
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) { setError("Please agree to the terms to continue."); return; }
    setBusy(true);
    try {
      await api("/api/me", { method: "PATCH", body: { name, email } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-10 text-lg font-bold tracking-tight">{brand.name}</p>

      {step === "phone" && (
        <form onSubmit={sendCode} className="flex flex-1 flex-col gap-4" noValidate>
          <h1 className="text-xl font-bold">What's your mobile number?</h1>
          <p className="text-text-muted">We'll text you a code to sign in. No password needed.</p>
          <Field
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
            autoFocus
          />
          <div className="mt-auto">
            <Button type="submit" block size="lg" loading={busy} disabled={phone.replace(/\D/g, "").length < 7}>Send code</Button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="flex flex-1 flex-col gap-4" noValidate>
          <button type="button" onClick={() => { setStep("phone"); setError(null); }} className="flex h-10 w-10 items-center justify-center rounded-pill hover:bg-surface" aria-label="Change number">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="text-xl font-bold">Enter the code we sent to {normalized}</h1>
          {devCode && <Banner variant="warning">Development mode: no SMS provider is set up. Your code is <strong>{devCode}</strong>.</Banner>}
          <Field
            ref={codeRef}
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="[&_input]:text-2xl [&_input]:tracking-[.5em]"
            error={error}
          />
          <Button variant="ghost" size="sm" className="self-start" disabled={resendIn > 0 || busy} onClick={() => sendCode()}>
            {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
          </Button>
          <div className="mt-auto">
            <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6}>Continue</Button>
          </div>
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={saveProfile} className="flex flex-1 flex-col gap-4" noValidate>
          <h1 className="text-xl font-bold">What should we call you?</h1>
          <p className="text-text-muted">Your driver sees your first name.</p>
          <Field label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          <Field label="Email for receipts (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--color-accent)]" />
            <span>I agree to the <a href="/terms" className="underline" target="_blank">Terms</a> and have read the <a href="/privacy" className="underline" target="_blank">Privacy Policy</a>.</span>
          </label>
          {error && <Banner variant="danger">{error}</Banner>}
          <div className="mt-auto">
            <Button type="submit" block size="lg" loading={busy} disabled={!name.trim()}>Done</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/ride";
}
