"use client";
import { useState } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";
import { supabase, type Plastic } from "@/lib/supabase";
import { useLang, type Key } from "@/lib/i18n";

export type Suggested = { name: string; plastic: Plastic | "NOT_RECYCLABLE"; count: number; grams_each: number; sure: boolean };
type Message = { role: "user" | "assistant"; content: string; items?: Suggested[]; added?: boolean };

// Chat box: describe the waste in words ("a packet of Dark Fantasy cookies"), Basellion lists the items.
// The list is only a suggestion; the user adds it to the listing and can still change every item.
export default function AskBasellion({ onAdd }: { onAdd: (items: Suggested[]) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { t, lang } = useLang();

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const history: Message[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(history);
    setText("");
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/describe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ lang, messages: history.map(({ role, content }) => ({ role, content })) }),
    });
    const answer = await res.json();
    // errors are shown in the user's language, picked by the kind of failure
    const problem: Key = res.status === 503 ? "chat.notSetUp" : res.status === 401 ? "chat.signIn" : "chat.retry";
    setMessages([...history, res.ok
      ? { role: "assistant", content: answer.reply, items: answer.items }
      : { role: "assistant", content: t(problem) }]);
    setBusy(false);
  }

  function add(i: number) {
    onAdd(messages[i].items!);
    setMessages((list) => list.map((m, n) => (n === i ? { ...m, added: true } : m)));
  }

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 font-semibold"><MessageCircle size={20} className="text-emerald-700" /> {t("chat.title")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("chat.example")}</p>

      {messages.length > 0 && (
        <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "ml-10 rounded-2xl rounded-br-sm bg-emerald-700 p-3 text-sm text-white" : "mr-10 rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-sm"}>
              {m.content}
              {!!m.items?.length && (
                <div className="mt-2 space-y-1">
                  {m.items.map((it, n) => (
                    <p key={n} className="rounded-lg bg-white px-2 py-1">
                      {it.count} × {it.name} · <b>{it.plastic === "NOT_RECYCLABLE" ? t("feed.notRecyclable") : it.plastic}</b>
                      <span className="text-slate-500"> · {t("chat.each", { g: it.grams_each })}{!it.sure && ` · ${t("feed.typical")}`}</span>
                    </p>
                  ))}
                  <button onClick={() => add(i)} disabled={m.added} className="btn-secondary mt-1 min-h-10 text-sm">
                    <Plus size={16} /> {m.added ? t("chat.added") : t("chat.add")}
                  </button>
                </div>
              )}
            </li>
          ))}
          {busy && <li className="mr-10 rounded-2xl bg-slate-100 p-3 text-sm text-slate-500">{t("chat.thinking")}</li>}
        </ul>
      )}

      <form onSubmit={ask} className="mt-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")} className="input mt-0 flex-1" />
        <button disabled={busy || !text.trim()} aria-label={t("chat.send")} className="btn-primary px-4"><Send size={18} /></button>
      </form>
      <p className="mt-2 text-xs text-slate-500">{t("chat.note")}</p>
    </section>
  );
}
