"use client";
/**
 * AI assistant — floating chat widget on the public site (POST /api/ai/chat).
 * z-ai-web-dev-sdk runs server-side only; this component is pure client.
 */
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "ai"; text: string }

export function AiAssistant() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, open]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const r = await apiPost<{ answer: string }>("/api/ai/chat", { message: q, lang });
      setMsgs((m) => [...m, { role: "ai", text: r.answer }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: t("public.ai.error") }]);
    }
    setBusy(false);
  };

  const suggestions = [t("public.ai.suggest1"), t("public.ai.suggest2"), t("public.ai.suggest3")];

  return (
    <>
      <Button
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="no-print fixed bottom-5 end-5 z-50 size-14 rounded-full shadow-lg shadow-teal-900/25 p-0"
        aria-label={t("public.ai.bot")}
      >
        {open ? <X className="size-6" aria-hidden /> : <MessageCircle className="size-6" aria-hidden />}
      </Button>

      {open && (
        <div className="no-print fixed bottom-22 end-5 z-50 flex max-h-[70vh] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"><Bot className="size-4" aria-hidden /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{t("public.ai.bot")}</p>
              <p className="text-[11px] text-muted-foreground">{busy ? t("public.ai.thinking") : "online"}</p>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="grid gap-2">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    className="rounded-xl border bg-background px-3 py-2 text-start text-xs hover:bg-muted min-h-11">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  m.role === "user" ? "bg-primary text-primary-foreground rounded-ee-sm" : "bg-muted rounded-es-sm",
                )}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> {t("public.ai.thinking")}
              </div>
            )}
          </div>

          <form className="flex items-center gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} className="h-11" placeholder={t("public.ai.send")} aria-label={t("public.ai.send")} />
            <Button type="submit" size="icon" className="size-11 shrink-0" disabled={busy || !input.trim()} aria-label={t("public.ai.send")}>
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
