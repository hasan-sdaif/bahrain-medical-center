"use client";
/**
 * Messages — notifications feed (kind icon, unread dot, bilingual title/body,
 * Bahrain time) with a secure-messaging policy notice + 999 emergency warning.
 * Demo channel: staff replies land here as notifications.
 */
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { useFetch, type NotificationItem } from "./lib";
import { AlertTriangle, Bell, CalendarDays, FlaskConical, Phone, Pill, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";

/** server payload carries readAt only when read — absent ⇒ unread */
interface MsgItem extends NotificationItem { readAt?: string | null }

const KIND_ICON: Record<string, LucideIcon> = {
  "appointment-reminder": CalendarDays, "critical-result": AlertTriangle,
  "result-ready": FlaskConical, "lab-result": FlaskConical, refill: Pill,
  prescription: Pill, invoice: Receipt, billing: Receipt,
};

function MsgRow({ m }: { m: MsgItem }) {
  const { t, lang } = useI18n();
  const Icon = KIND_ICON[m.kind] ?? Bell;
  return (
    <li className="flex items-start gap-3 rounded-xl border p-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {bi(lang, m.titleAr, m.titleEn)}
          {!m.readAt ? <span className="inline-block size-2 shrink-0 rounded-full bg-destructive" role="img" aria-label={t("pp.msg.unread")} /> : null}
        </p>
        {m.bodyAr ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{m.bodyAr}</p> : null}
        <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">{bhDateString(m.at)} · {bhTimeString(m.at)}</p>
      </div>
    </li>
  );
}

export default function MessagesScreen() {
  const { t } = useI18n();
  const list = useFetch<MsgItem[]>(() => apiGet<MsgItem[]>("/api/patient/notifications"));

  return (
    <div className="grid gap-4">
      <h1 className="flex items-center gap-2 text-xl font-bold"><Bell className="size-5 text-primary" aria-hidden />{t("pp.msg.title")}</h1>

      <SectionCard title={t("pp.msg.secure")} icon={ShieldCheck}>
        <div className="grid gap-2 text-sm">
          <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-2.5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{t("pp.msg.policy")}
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-2.5 font-medium text-destructive" role="alert">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />{t("pp.msg.emergency")}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("pp.msg.demoReply")}</Badge>
            {t("pp.msg.secureNote")}
          </p>
        </div>
      </SectionCard>

      {list.loading ? <LoadingRows n={4} h="h-20" /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : (
        <SectionCard title={t("pp.msg.notifications")} icon={Bell}>
          {(list.data ?? []).length ? (
            <ul className="grid max-h-96 gap-2 overflow-y-auto pe-1" role="list">
              {(list.data ?? []).map((m) => <MsgRow key={m.id} m={m} />)}
            </ul>
          ) : <EmptyState icon={Bell} text={t("pp.msg.empty")} />}
        </SectionCard>
      )}
    </div>
  );
}
