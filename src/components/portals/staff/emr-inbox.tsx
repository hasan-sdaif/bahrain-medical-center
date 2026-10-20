"use client";
/**
 * emr-inbox — المهام/الرسائل: role inbox (tasks w/ complete, notifications,
 * threads w/ dialog conversation + send).
 */
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { bhTimeString, bhDateString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/badges";
import { Empty, ErrorBox, LoadingRows, Section, errText, type InboxData } from "./emr-shared";
import { cn } from "@/lib/utils";

interface Msg { id: string; senderId: string | null; senderRole: string | null; body: string; system: boolean; at: string }

export function InboxTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [data, setData] = useState<InboxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<InboxData["threads"][number] | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(() => {
    setError(null);
    apiGet<InboxData>("/api/staff/inbox").then(setData).catch((e) => { setError(errText(e, lang)); setData(null); });
  }, [lang]);
  useEffect(load, [load]);

  const openConversation = (th: InboxData["threads"][number]) => {
    setOpenThread(th); setMsgs(null); setDraft("");
    apiGet<Msg[]>(`/api/staff/messages/thread?id=${th.id}`).then(setMsgs).catch((e) => toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" }));
  };

  const complete = async (id: string) => {
    setBusy(id);
    try {
      await apiPost("/api/staff/tasks/complete", { taskId: id });
      toast({ title: t("emr.in.taskdone") });
      load();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const send = async () => {
    if (!openThread || !draft.trim()) return;
    setBusy("send");
    try {
      await apiPost("/api/staff/messages/send", { threadId: openThread.id, body: draft.trim() });
      setDraft("");
      const r = await apiGet<Msg[]>(`/api/staff/messages/thread?id=${openThread.id}`);
      setMsgs(r);
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(null); }
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <LoadingRows n={4} />;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* tasks */}
      <Section title={`✅ ${t("emr.in.tasks")}`} actions={<Badge variant="outline" className="text-[10px]">{data.tasks.length}</Badge>}>
        {data.tasks.length === 0 ? <Empty label={t("common.empty")} className="py-4" /> : (
          <ul className="grid gap-1.5 max-h-80 overflow-y-auto bmc-scroll">
            {data.tasks.map((k) => (
              <li key={k.id} className="rounded-md border p-2 grid gap-1 text-xs">
                <div className="flex items-start gap-2">
                  <span className="flex-1">{k.titleAr}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{t(`priority.${k.priority}`)}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {k.patient && <span className="font-mono">{k.patient.mrn} · {k.patient.nameAr}</span>}
                  {k.dueAt && <span>⏰ {bhDateString(k.dueAt)} {bhTimeString(k.dueAt)}</span>}
                  <Button size="sm" className="ms-auto h-6 px-2 text-[10px]" disabled={busy === k.id} onClick={() => complete(k.id)}>✓ {t("emr.in.complete")}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* notifications */}
      <Section title={`🔔 ${t("emr.in.notifs")}`}>
        {data.notifications.length === 0 ? <Empty label={t("common.empty")} className="py-4" /> : (
          <ul className="grid gap-1.5 max-h-80 overflow-y-auto bmc-scroll">
            {data.notifications.map((n) => (
              <li key={n.id} className="rounded-md border p-2 text-xs grid gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium flex-1 truncate">{bi(lang, n.titleAr, n.titleEn)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{bhTimeString(n.at)}</span>
                </div>
                {(n.bodyAr || n.bodyEn) && <p className="text-muted-foreground line-clamp-2">{bi(lang, n.bodyAr, n.bodyEn)}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* message threads */}
      <Section title={`💬 ${t("emr.in.threads")}`}>
        {data.threads.length === 0 ? <Empty label={t("common.empty")} className="py-4" /> : (
          <ul className="grid gap-1.5 max-h-80 overflow-y-auto bmc-scroll">
            {data.threads.map((th) => (
              <li key={th.id}>
                <button onClick={() => openConversation(th)} className="w-full rounded-md border p-2 text-start text-xs hover:border-primary hover:bg-primary/5 transition-colors grid gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="font-medium flex-1 truncate">{th.subjectAr}</span>
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">{th.category}</Badge>
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{bhDateString(th.lastAt)} {bhTimeString(th.lastAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* thread conversation */}
      <Dialog open={!!openThread} onOpenChange={(v) => { if (!v) setOpenThread(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm">💬 {openThread?.subjectAr}</DialogTitle>
            <DialogDescription className="text-xs font-mono">{openThread?.category}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72 rounded-md border p-2">
            {!msgs && <div className="text-xs text-muted-foreground p-2">{t("common.loading")}</div>}
            {msgs?.length === 0 && <div className="text-xs text-muted-foreground p-2">{t("common.empty")}</div>}
            <div className="grid gap-1.5">
              {msgs?.map((m) => (
                <div key={m.id} className={cn("rounded-lg p-2 text-xs max-w-[85%]", m.system ? "bg-muted self-center text-muted-foreground" : "bg-primary/10 self-start")}>
                  {!m.system && <div className="text-[10px] text-muted-foreground mb-0.5 font-mono">{m.senderRole ?? m.senderId ?? "—"} · {bhTimeString(m.at)}</div>}
                  {m.body}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} className="h-9 text-sm" placeholder={t("emr.in.draft")} />
            <Button size="sm" disabled={!draft.trim() || busy === "send"} onClick={send}>{t("common.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
