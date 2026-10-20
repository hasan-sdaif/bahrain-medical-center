"use client";
/**
 * Privacy center — (a) "who accessed my record" audit table (view-chart /
 * break-glass / reader-read), (b) PDPL data-subject rights cards + DPO note,
 * (c) notification settings (static switches managed centrally).
 */
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { useFetch, type AccessLogRow } from "./lib";
import { Eye, FilePen, FilePlus, Lock, Scale, ShieldCheck, ShieldOff, type LucideIcon } from "lucide-react";

const ACTION_TONE: Record<string, string> = {
  "view-chart": "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  "break-glass": "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  "reader-read": "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
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
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden><Icon className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t(`pp.priv.rights.${k}`)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t(`pp.priv.rights.${k}Desc`)}</p>
      </div>
    </div>
  );
}

function NotifRow({ labelKey }: { labelKey: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
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
        <h1 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="size-5 text-primary" aria-hidden />{t("pp.priv.title")}</h1>

        {log.loading ? <LoadingRows n={3} h="h-16" /> : log.error ? <ErrorBox error={log.error} onRetry={log.reload} /> : (
          <SectionCard title={t("pp.priv.who")} icon={Eye}>
            <p className="mb-3 text-xs text-muted-foreground">{t("pp.priv.whoNote")}</p>
            {rows.length ? (
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t("pp.priv.time")}</TableHead>
                      <TableHead className="text-xs">{t("pp.priv.action")}</TableHead>
                      <TableHead className="text-xs">{t("pp.priv.by")}</TableHead>
                      <TableHead className="text-xs">{t("pp.priv.role")}</TableHead>
                      <TableHead className="text-xs">{t("pp.priv.reason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs" dir="ltr">{bhDateString(r.at)} · {bhTimeString(r.at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border-transparent text-[11px] ${ACTION_TONE[r.action] ?? ACTION_TONE["reader-read"]}`}>{t(`al.${r.action}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{r.by}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.role}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : <EmptyState icon={Eye} text={t("pp.priv.whoEmpty")} />}
          </SectionCard>
        )}

        <SectionCard title={t("pp.priv.rightsTitle")} icon={Scale}>
          <div className="grid gap-2 sm:grid-cols-2">{RIGHTS.map((r) => <RightsCard key={r.key} k={r.key} icon={r.icon} />)}</div>
          <p className="mt-3 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">{t("pp.priv.dpo")}</p>
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
