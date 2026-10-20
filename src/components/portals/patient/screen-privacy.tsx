"use client";
/**
 * Privacy center — (a) "who accessed my record" audit table (`.table` Shamel
 * classes), (b) PDPL data-subject rights cards + DPO note, (c) notification
 * settings (static switches managed centrally).
 */
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead } from "./shell-ui";
import { useFetch, type AccessLogRow } from "./lib";
import { Eye, FilePen, FilePlus, Lock, Scale, ShieldCheck, ShieldOff, type LucideIcon } from "lucide-react";

const ACTION_TONE: Record<string, string> = {
  "view-chart": "b-teal",
  "break-glass": "b-red",
  "reader-read": "b-slate",
};

const RIGHTS: { key: string; icon: LucideIcon }[] = [
  { key: "copy", icon: FilePlus },
  { key: "rectify", icon: FilePen },
  { key: "restrict", icon: Lock },
  { key: "withdraw", icon: ShieldOff },
];

function RightsCard({ k, icon: Icon }: { k: string; icon: LucideIcon }) {
  const { t } = useI18n();
  return (
    <div className="card p-3">
      <div className="flex items-start gap-3">
        <span className="ch-ic ic-teal shrink-0" aria-hidden><Icon className="size-4" /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{t(`pp.priv.rights.${k}`)}</p>
          <p className="mt-0.5 text-xs text-ink-3">{t(`pp.priv.rights.${k}Desc`)}</p>
        </div>
      </div>
    </div>
  );
}

function NotifRow({ labelKey }: { labelKey: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line p-3">
      <span className="text-sm font-medium">{t(labelKey)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-2"><Switch checked disabled aria-label={t(labelKey)} /><span className="sr-only">{t("pp.priv.notifHint")}</span></span>
        </TooltipTrigger>
        <TooltipContent side="top">{t("pp.priv.notifHint")}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function PrivacyScreen() {
  const { t } = useI18n();
  const log = useFetch<AccessLogRow[]>(() => apiGet<AccessLogRow[]>("/api/patient/access-log"));
  const rows = log.data ?? [];

  return (
    <TooltipProvider delayDuration={100}>
      <div className="grid gap-4">
        <PageHead icon={ShieldCheck} title={t("pp.priv.title")} sub={t("pp.priv.sub")} />

        {log.loading ? <LoadingRows n={3} h="h-16" /> : log.error ? <ErrorBox error={log.error} onRetry={log.reload} /> : (
          <SectionCard title={t("pp.priv.who")} icon={Eye}>
            <p className="mb-3 text-xs text-ink-3">{t("pp.priv.whoNote")}</p>
            {rows.length ? (
              <div className="table-wrap border border-line rounded-lg">
                <table className="table sm">
                  <thead>
                    <tr>
                      <th>{t("pp.priv.time")}</th>
                      <th>{t("pp.priv.action")}</th>
                      <th>{t("pp.priv.by")}</th>
                      <th>{t("pp.priv.role")}</th>
                      <th>{t("pp.priv.reason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="num-cell whitespace-nowrap text-xs">{bhDateString(r.at)} · {bhTimeString(r.at)}</td>
                        <td>
                          <span className={`badge ${ACTION_TONE[r.action] ?? ACTION_TONE["reader-read"]}`}>{t(`al.${r.action}`)}</span>
                        </td>
                        <td className="cell-main">{r.by}</td>
                        <td className="text-xs">{r.role}</td>
                        <td className="max-w-[220px] truncate text-xs" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={Eye} text={t("pp.priv.whoEmpty")} />}
          </SectionCard>
        )}

        <SectionCard title={t("pp.priv.rightsTitle")} icon={Scale}>
          <div className="grid gap-2 sm:grid-cols-2">{RIGHTS.map((r) => <RightsCard key={r.key} k={r.key} icon={r.icon} />)}</div>
          <p className="alert alert-info mt-3 p-2.5 text-xs">{t("pp.priv.dpo")}</p>
        </SectionCard>

        <SectionCard title={t("pp.priv.notifTitle")} icon={ShieldCheck}>
          <div className="grid gap-2 sm:grid-cols-3">
            <NotifRow labelKey="pp.priv.notif.appt" />
            <NotifRow labelKey="pp.priv.notif.results" />
            <NotifRow labelKey="pp.priv.notif.billing" />
          </div>
        </SectionCard>
      </div>
    </TooltipProvider>
  );
}
