"use client";
/**
 * Reports tab (agent S4) — center-wide KPI grid, daily-revenue bars (fils,
 * BHD axis note), and governed export section (watermarked + audit-logged,
 * disabled until enabled from settings) with small-cell suppression note.
 */
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoneyText } from "@/components/shared/badges";
import { BHD3 } from "@/lib/money";
import { bhDateString } from "@/lib/bahrain";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  Activity, Banknote, CalendarCheck, ClipboardList, FileDown, FileSpreadsheet, FileText,
  FlaskConical, Home, Pill, Receipt, Stethoscope, Users, Wrench,
} from "lucide-react";
import { Kpi, Panel, useOps, type ReportsResp } from "./ops-shared";

const EXPORTS = [
  { key: "pdf", Icon: FileText },
  { key: "excel", Icon: FileSpreadsheet },
  { key: "csv", Icon: FileDown },
] as const;

export default function ReportsTab() {
  const { t } = useI18n();
  const { data, loading, error, reload } = useOps<ReportsResp>("/api/staff/reports/overview");
  const k = data?.kpis;
  const chart = (data?.dailyRevenue ?? []).map((d) => ({ date: bhDateString(d.date).slice(0, 5), fils: d.fils }));
  const rejPct = k && k.claims.total ? Math.round((k.claims.rejected / k.claims.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Panel loading={loading} error={error} onRetry={reload} isEmpty={!data || !k} rows={6}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label={t("ops.rep.patients")} value={<span className="font-mono">{k!.patients}</span>} icon={<Users className="size-3.5" />} />
          <Kpi label={t("ops.rep.appointments")} value={<span className="font-mono">{k!.appointments}</span>} icon={<CalendarCheck className="size-3.5" />} />
          <Kpi label={t("ops.rep.encounters")} value={<span className="font-mono">{k!.encounters}</span>} icon={<Stethoscope className="size-3.5" />} />
          <Kpi label={t("ops.rep.revenue")} value={<MoneyText fils={k!.revenueFils} className="text-lg" />} icon={<Receipt className="size-3.5" />} />
          <Kpi label={t("ops.rep.collected")} value={<MoneyText fils={k!.collectedFils} className="text-lg" />} icon={<Banknote className="size-3.5" />} />
          <Kpi label={t("ops.rep.lab")} value={<span className="font-mono">{k!.labResults}</span>} icon={<FlaskConical className="size-3.5" />} />
          <Kpi label={t("ops.rep.rx")} value={<span className="font-mono">{k!.prescriptions}</span>} icon={<Pill className="size-3.5" />} />
          <Kpi label={t("ops.rep.home")} value={<span className="font-mono">{k!.homeRequests}</span>} icon={<Home className="size-3.5" />} />
          <Kpi label={t("ops.rep.wo")} value={<span className="font-mono">{k!.workOrders}</span>} icon={<Wrench className="size-3.5" />} />
          <Kpi label={t("ops.rep.claims")} value={<span className="font-mono">{k!.claims.total}</span>}
            sub={t("ops.rep.claims.rej.v", { p: rejPct, n: k!.claims.total })} icon={<ClipboardList className="size-3.5" />} />
        </div>

        <Card className="mt-2">
          <CardHeader className="pb-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <Activity className="size-4 text-muted-foreground" />
              {t("ops.rep.daily")}
              <Badge variant="outline" className="font-mono text-[10px] font-normal text-muted-foreground">{t("ops.rep.axis")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => BHD3(Number(v))} />
                  <RTooltip formatter={(v) => [`${BHD3(Number(v))} ${t("ops.rep.axis")}`, t("ops.rep.revenue")]} />
                  <Bar dataKey="fils" fill="#0d9488" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{t("ops.rep.daily.note")}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <CardContent className="p-0">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileDown className="size-4 text-muted-foreground" />
                {t("common.export")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {EXPORTS.map(({ key, Icon }) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      {/* span wrapper: disabled buttons swallow pointer events */}
                      <span className="inline-flex">
                        <Button variant="outline" disabled className="h-11 pointer-events-none">
                          <Icon className="size-4" />{t(`ops.rep.export.${key}`)}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("ops.rep.export.disabled")}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("ops.rep.export.note")}</p>
            </CardContent>
          </Card>

          <Card className="border-dashed p-4">
            <CardContent className="p-0">
              <h3 className="mb-2 text-sm font-semibold">{t("ops.rep.suppress.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("ops.rep.suppress")}</p>
            </CardContent>
          </Card>
        </div>
      </Panel>
    </div>
  );
}
