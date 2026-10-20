"use client";
/** Work-order chat — bubbles (me / technician / reporter), system notes, part chips. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n, type Lang } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { bhTimeString } from "@/lib/bahrain";
import type { WoMessage, WoRow } from "./ops-shared";

type T = ReturnType<typeof useI18n>["t"];

function senderLabel(m: WoMessage, wo: WoRow, myId: string | undefined, t: T): string {
  if (m.senderId == null) return t("ops.wo.system");
  if (m.senderId === myId) return t("ops.wo.me");
  if (m.senderId === wo.technicianId) return t("ops.wo.tech");
  return t("ops.wo.reporter");
}

function Msg({ m, wo, myId, t, lang }: { m: WoMessage; wo: WoRow; myId?: string; t: T; lang: Lang }) {
  if (m.kind === "system") {
    return (
      <div className="text-center">
        <span className="inline-block max-w-full truncate rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground" title={m.body}>
          {m.body}
        </span>
      </div>
    );
  }
  if (m.kind === "part") {
    return (
      <div className={cn("flex flex-col", m.senderId === myId ? "items-end" : "items-start")}>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-amber-600/60 bg-amber-50 px-2.5 py-1.5 font-mono text-xs dark:bg-amber-950/40">
          <Package className="size-3.5 text-amber-600" aria-hidden />
          {m.body}
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          {senderLabel(m, wo, myId, t)} · {t("ops.wo.part.msg")} · {bhTimeString(m.at)}
        </span>
      </div>
    );
  }
  const mine = m.senderId === myId;
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <span className={cn("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
        mine ? "rounded-ee-sm bg-primary text-primary-foreground" : "rounded-es-sm bg-muted")}>
        {m.body}
      </span>
      <span className="mt-0.5 text-[10px] text-muted-foreground" dir={lang === "ar" ? "rtl" : "ltr"}>
        {senderLabel(m, wo, myId, t)} · {bhTimeString(m.at)}
      </span>
    </div>
  );
}

export function WoChat({ wo, myId, onSent }: { wo: WoRow; myId?: string; onSent: () => void }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [wo.messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    const isPart = /ITM-[A-Z0-9-]+/i.test(body);
    setBusy(true);
    try {
      await apiPost("/api/staff/maintenance/wo-message", { workOrderId: wo.id, body, kind: isPart ? "part" : "text" });
      setText("");
      onSent();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border">
      <div ref={boxRef} className="max-h-80 min-h-40 flex-1 space-y-2.5 overflow-y-auto p-3" aria-live="polite">
        {wo.messages.length === 0
          ? <p className="py-8 text-center text-xs text-muted-foreground">{t("ops.wo.chat.empty")}</p>
          : wo.messages.map((m) => <Msg key={m.id} m={m} wo={wo} myId={myId} t={t} lang={lang} />)}
      </div>
      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(e: FormEvent) => { e.preventDefault(); void send(); }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("ops.wo.chat.ph")}
          aria-label={t("ops.wo.chat")}
          className="h-11 text-sm"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={busy || !text.trim()} aria-label={t("common.submit")}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
