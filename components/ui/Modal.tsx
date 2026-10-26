"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog>: focus trap, Esc to close and the backdrop come from the browser. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,420px)] rounded-lg bg-bg p-5 text-text shadow-pop backdrop:bg-black/40"
    >
      <h2 id="modal-title" className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </dialog>
  );
}
