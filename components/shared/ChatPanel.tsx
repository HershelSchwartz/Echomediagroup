"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type Msg = { id: string; body: string; created_at: string; mine: boolean };

export function ChatPanel({ tripId, open, onClose, otherName, quickReplies }: { tripId: string; open: boolean; onClose: () => void; otherName: string; quickReplies: string[] }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    const load = () => api<{ messages: Msg[] }>(`/api/trips/${tripId}/messages`).then((r) => !stop && setMsgs(r.messages)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [open, tripId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send(body: string) {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const r = await api<{ message: Msg }>(`/api/trips/${tripId}/messages`, { body: { text: body } });
      setMsgs((m) => [...m, r.message]);
      setText("");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Message ${otherName}`}>
      <div className="mb-3 max-h-[45dvh] min-h-32 space-y-2 overflow-y-auto" aria-live="polite">
        {msgs.length === 0 && <p className="py-6 text-center text-sm text-text-muted">No messages yet. Your number stays private.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${m.mine ? "bg-accent text-on-accent" : "bg-surface text-text"}`}>{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {quickReplies.map((q) => <Button key={q} size="sm" variant="secondary" onClick={() => send(q)} disabled={sending}>{q}</Button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Type a message"
          className="h-12 min-w-0 flex-1 rounded-md bg-surface px-3 outline-none focus:ring-2 focus:ring-accent" />
        <Button type="submit" aria-label="Send" loading={sending} disabled={!text.trim()}><Send className="h-5 w-5" aria-hidden /></Button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <Button variant="ghost" block className="mt-2" onClick={onClose}>Close</Button>
    </Modal>
  );
}
