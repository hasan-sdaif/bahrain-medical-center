"use client";
/**
 * Messages — notifications feed (kind icon tile, unread dot, bilingual
 * title/body, Bahrain time) with a secure-messaging policy notice + 999
 * emergency warning. Demo channel: staff replies land here as notifications.
 * Shamel skin: `.alert` notices + `.list-group/.list-item` feed rows.
 */
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead } from "./shell-ui";
import { useFetch, type NotificationItem } from "./lib";
import { AlertTriangle, Bell, CalendarDays, FlaskConical, Phone, Pill, Receipt, ShieldCheck, type LucideIcon } from "lucide-react";

/** server payload carries readAt only when read — absent ⇒ unread */
interface MsgItem extends NotificationItem { readAt?: string | null }

const KIND_ICON: Record<string, LucideIcon> = {
  "appointment-reminder": CalendarDays, "critical-result": AlertTriangle,
  "result-ready": FlaskConical, "lab-result": FlaskConical, refill: Pill,
  prescription: Pill, invoice: Receipt, billing: Receipt,
};

const KIND_TONE: Record<string, string> = {
  "appointment-reminder": "ic-teal", "critical-result": "ic-red",
  "result-ready": "ic-violet", "lab-result": "ic-violet", refill: "ic-gold",
  prescription: "ic-gold", invoice: "ic-amber", billing: "ic-amber",
};

function MsgRow({ m }: { m: MsgItem }) {
  const { t, lang } = useI18n();
  const Icon = KIND_ICON[m.kind] ?? Bell;
  return (
    <li className="list-item items-start">
      <span className={`ch-ic ${KIND_TONE[m.kind] ?? "ic-teal"} shrink-0`} aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="li-body">
        <span className="li-title flex flex-wrap items-center gap-1.5">
          {bi(lang, m.titleAr, m.titleEn)}
          {!m.readAt ? <span className="inline-block size-2 shrink-0 rounded-full bg-red-600" role="img" aria-label={t("pp.msg.unread")} /> : null}
        </span>
        {m.bodyAr ? <span className="li-sub line-clamp-2">{m.bodyAr}</span> : null}
        <span className="mono mt-1 block text-[11px] text-ink-3">{bhDateString(m.at)} · {bhTimeString(m.at)}</span>
      </span>
    </li>
  );
}

export default function MessagesScreen() {
  const { t } = useI18n();
  const list = useFetch<MsgItem[]>(() => apiGet<MsgItem[]>("/api/patient/notifications"));

  return (
    <div className="grid gap-4">
      <PageHead icon={Bell} title={t("pp.msg.title")} sub={t("pp.msg.sub")} />

      <SectionCard title={t("pp.msg.secure")} icon={ShieldCheck}>
        <div className="stack-sm">
          <p className="alert alert-info items-start text-sm">
            <ShieldCheck className="al-ic size-4 shrink-0" aria-hidden />{t("pp.msg.policy")}
          </p>
          <p className="alert alert-danger items-start text-sm font-semibold" role="alert">
            <Phone className="al-ic size-4 shrink-0" aria-hidden />{t("pp.msg.emergency")}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="badge b-gold">{t("pp.msg.demoReply")}</span>
            {t("pp.msg.secureNote")}
          </p>
        </div>
      </SectionCard>

      {list.loading ? <LoadingRows n={4} h="h-20" /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : (
        <SectionCard title={t("pp.msg.notifications")} icon={Bell} contentClassName="p-0">
          {(list.data ?? []).length ? (
            <ul className="list-group max-h-96 overflow-y-auto pe-1" role="list">
              {(list.data ?? []).map((m) => <MsgRow key={m.id} m={m} />)}
            </ul>
          ) : <EmptyState icon={Bell} text={t("pp.msg.empty")} />}
        </SectionCard>
      )}
    </div>
  );
}
