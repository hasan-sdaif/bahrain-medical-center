"use client";
/** Maintenance KPIs — MTTR/MTBF cards, assets-by-status donut, top-downtime bars. */
import { useI18n, bi } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/shared/badges";
import { Activity, BarChart3, PieChart as PieIcon, Timer, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel, useOps, type MetricsResp } from "./ops-shared";

const STATUS_COLORS: Record<string, string> = {
  operational: "#059669", "in-maintenance": "#d97706", down: "#dc2626",
  "awaiting-calibration": "#ca8a04", retired: "#71717a",
};

export default function MetricsTab() {
  const { t, lang } = useI18n();
  const { data, loading, error, reload } = useOps<MetricsResp>("/api/staff/maintenance/metrics");

  const statusData = Object.entries(data?.assetsByStatus ?? {}).map(([key, value]) => ({
    key, name: t(`status.${key}`), value,
  }));
  const total = statusData.reduce((a, s) => a + s.value, 0);
  const downData = (data?.topDowntime ?? []).map((a) => ({
    code: a.code, nameAr: a.nameAr, minutes: a.downtimeMin ?? 0, ratio: a.ratio, costFils: a.costFils,
  }));

  return (
    <div className="space-y-4">
      <Panel loading={loading} error={error} onRetry={reload} isEmpty={!data} rows={4}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={t("ops.metrics.mttr")} value={<span className="font-mono">{data!.mttrMin}</span>} sub={t("ops.min.short")} icon={<Timer className="size-3.5" />} />
          <Kpi label={t("ops.metrics.mtbf")} value={<span className="font-mono">{data!.mtbfDays ?? "—"}</span>} icon={<Activity className="size-3.5" />} />
          <Kpi label={t("ops.metrics.open")} value={<span className="font-mono">{data!.workOrders.open}</span>} icon={<Wrench className="size-3.5" />} />
          <Kpi label={t("ops.metrics.closed")} value={<span className="font-mono">{data!.workOrders.closed}</span>} icon={<BarChart3 className="size-3.5" />} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieIcon className="size-4 text-muted-foreground" />
                {t("ops.metrics.byStatus")} <span className="text-xs font-normal text-muted-foreground">({total})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="80%" paddingAngle={2} strokeWidth={1}>
                    {statusData.map((s) => <Cell key={s.key} fill={STATUS_COLORS[s.key] ?? "#71717a"} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">{t("ops.metrics.topDowntime")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={downData} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="code" width={92} tick={{ fontSize: 11, fontFamily: "monospace" }} />
                  <Tooltip
                    formatter={(v) => [`${v} ${t("ops.min.short")}`, t("ops.assets.downtime")]}
                    labelFormatter={(code) => bi(lang, downData.find((d) => d.code === String(code))?.nameAr, String(code))}
                  />
                  <Bar dataKey="minutes" fill="#0d9488" radius={4} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1">
                {downData.map((d) => (
                  <li key={d.code} className="flex flex-wrap items-center justify-between gap-2 border-b py-1 text-xs last:border-0">
                    <span className="font-mono text-[11px]">{d.code}</span>
                    <span className="text-muted-foreground">{t("ops.metrics.ratio", { v: d.ratio })}</span>
                    {d.costFils != null ? <MoneyText fils={d.costFils} className="text-[11px]" /> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Panel>
    </div>
  );
}
