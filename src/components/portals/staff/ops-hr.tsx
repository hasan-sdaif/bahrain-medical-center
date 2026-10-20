"use client";
/**
 * HR tab (agent S4) — staff directory with professional-license expiry
 * progress (green >90d / amber 30-90 / red <30; expired = auto-suspended
 * signing) + facility licenses countdown cards.
 */
import { useState } from "react";
import { useI18n, bi } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BellRing, Building2, FlaskConical, Pill, Scan, ShieldCheck, ShieldPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Countdown, Panel, useOps, type EmpRow, type HrResp } from "./ops-shared";

const FAC_ICON: Record<string, typeof Building2> = {
  facility: Building2, lab: FlaskConical, pharmacy: Pill, radiology: Scan, defense: ShieldCheck, insurance: ShieldPlus,
};

/** license cell — number + expiry date + colored days-left bar (365d horizon) */
function LicenseCell({ e }: { e: EmpRow }) {
  const { t } = useI18n();
  if (!e.licenseNo) return <span className="text-xs text-muted-foreground">{t("ops.hr.license.none")}</span>;
  const days = e.licenseDaysLeft;
  if (days != null && days < 0) {
    return (
      <div className="space-y-0.5">
        <div className="font-mono text-[11px]">{e.licenseNo}</div>
        <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">{t("ops.hr.license.expired")}</div>
      </div>
    );
  }
  const pct = days == null ? 0 : Math.max(4, Math.min(100, Math.round((days / 365) * 100)));
  const bar = days == null ? ""
    : days > 90 ? "[&>[data-slot=progress-indicator]]:bg-emerald-600"
      : days >= 30 ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
        : "[&>[data-slot=progress-indicator]]:bg-red-600";
  return (
    <div className="min-w-32 space-y-1">
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span>{e.licenseNo}</span>
        <span className="text-[10px] text-muted-foreground">{e.licenseExpiresAt}</span>
      </div>
      <Progress value={pct} className={cn("h-1.5 bg-zinc-200 dark:bg-zinc-800", bar)} />
      <Countdown days={days} />
    </div>
  );
}

export default function HrTab() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useOps<HrResp>("/api/staff/hr/employees");
  const [q, setQ] = useState("");
  const qn = q.trim().toLowerCase();
  const rows = (data?.employees ?? []).filter((e) => !qn
    || [e.staffNo, e.nameAr, e.nameEn, e.licenseNo ?? "", e.role, e.department?.nameAr ?? "", e.department?.code ?? ""]
      .some((s) => s.toLowerCase().includes(qn)));
  const lics = data?.facilityLicenses ?? [];

  return (
    <div className="space-y-4">
      <Alert className="border-teal-600/40 bg-teal-50 dark:bg-teal-950/40">
        <BellRing className="size-4 text-teal-700 dark:text-teal-300" />
        <AlertTitle className="text-sm font-semibold">{t("ops.hr.autosuspend")}</AlertTitle>
        <AlertDescription className="text-xs">{t("ops.hr.alerts")}</AlertDescription>
      </Alert>

      <Panel loading={loading} error={error} onRetry={reload} isEmpty={!data || rows.length === 0} rows={6}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("ops.hr.employees", { n: rows.length })}</h3>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ops.hr.search")}
            aria-label={t("common.search")} className="h-10 max-w-xs" />
        </div>
        <div className="max-h-96 overflow-auto rounded-xl border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="text-start">{t("ops.hr.staffno")}</TableHead>
                <TableHead className="text-start">{t("ops.hr.name")}</TableHead>
                <TableHead className="text-start">{t("ops.hr.role")}</TableHead>
                <TableHead className="text-start">{t("ops.hr.dept")}</TableHead>
                <TableHead className="text-start">{t("ops.hr.license")}</TableHead>
                <TableHead className="text-start">{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="py-2.5 font-mono text-xs">{e.staffNo}</TableCell>
                  <TableCell className="py-2.5">
                    <div className="text-sm font-medium">{bi(lang, e.nameAr, e.nameEn)}</div>
                    <div className="text-[10px] text-muted-foreground">{bi(lang, e.jobTitleAr, e.jobTitleEn)}</div>
                  </TableCell>
                  <TableCell className="py-2.5 text-xs">{t(`staff.role.${e.role}`)}</TableCell>
                  <TableCell className="py-2.5 text-xs">{e.department ? e.department.nameAr : "—"}</TableCell>
                  <TableCell className="py-2.5"><LicenseCell e={e} /></TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant="outline" className={cn("border-transparent font-medium",
                      e.active
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")}>
                      {t(e.active ? "common.active" : "common.inactive")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold">{t("ops.hr.facility")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lics.map((l) => {
            const Icon = FAC_ICON[l.kind] ?? Building2;
            return (
              <Card key={l.number} className="p-4">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{l.nameAr}</div>
                        <Badge variant="outline" className="text-[10px] font-normal">{t(`ops.hr.fac.kind.${l.kind}`)}</Badge>
                      </div>
                    </div>
                    <Countdown days={l.daysLeft} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate font-mono" title={l.number}>{l.number}</span>
                    <span className="shrink-0">{t("ops.hr.fac.expiry")}: <span className="font-mono">{l.expiresAt}</span></span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
