"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Clock, CreditCard, LifeBuoy, LogOut, Steering, User, X } from "./icons";
import { api } from "@/lib/client";
import { brand } from "@/lib/brand";

export function NavMenu({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const items = [
    { href: "/ride/activity", label: "Activity", icon: <Clock className="h-5 w-5" aria-hidden /> },
    { href: "/ride/wallet", label: "Wallet", icon: <CreditCard className="h-5 w-5" aria-hidden /> },
    { href: "/ride/help", label: "Help", icon: <LifeBuoy className="h-5 w-5" aria-hidden /> },
    { href: "/ride/account", label: "Account", icon: <User className="h-5 w-5" aria-hidden /> },
    { href: "/drive", label: "Drive with us", icon: <Steering className="h-5 w-5" aria-hidden /> },
  ];
  return (
    <dialog ref={ref} onClose={onClose} aria-label="Menu"
      className="m-0 h-dvh max-h-none w-[min(86vw,320px)] bg-bg p-0 text-text shadow-pop backdrop:bg-black/40">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-text-muted">{brand.name}</p>
          <p className="text-lg font-semibold">{name}</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-pill hover:bg-surface" aria-label="Close menu">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <nav className="px-2">
        <ul>
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="flex h-14 items-center gap-3 rounded-md px-3 hover:bg-surface">{i.icon}{i.label}</Link>
            </li>
          ))}
          <li>
            <button type="button" className="flex h-14 w-full items-center gap-3 rounded-md px-3 hover:bg-surface"
              onClick={async () => { await api("/api/auth/logout", { body: {} }).catch(() => {}); window.location.href = "/login"; }}>
              <LogOut className="h-5 w-5" aria-hidden />Sign out
            </button>
          </li>
        </ul>
      </nav>
    </dialog>
  );
}
