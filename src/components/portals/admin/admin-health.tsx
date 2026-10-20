"use client";
/**
 * Tab 1 — صحة النظام: GET /api/system/health with 30s auto-refresh.
 * DB + realtime (retry) status cards, live counters, generatedAt (bh time),
 * scheduler note (60s server cycle) + uptime note.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { cn } from "@/lib/utils";
import { Activity, CalendarDays, Check, Database, RadioTower, RefreshCw, Siren, Ticket, Timer, Users, Wrench, X } from "lucide-react";
import { ErrCard, Section, type HealthResp } from "./bits";

function StatusCard({ ok, icon: Icon, title, okLabel, badLabel, onRetry }: {
  ok: boolean; icon: typeof Database; title: string; okLabel: string; badLabel: string; onRetry?: () => void;
}) {
  return (
    <Card className={cn("p-0 border-2", ok ? "border-emerald-500/60" : "border-red-500/60")}>
      <CardContent className="p-4 flex items-start gap-3">
        <span className={cn("grid size-10 place-items-center rounded-lg shrink-0", ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")} aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className={cn("mt-0.5 flex items-center gap-1 text-xs", ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <X className="size-3.5 shrink-0" aria-hidden />}
            <span>{ok ? okLabel : badLabel}</span>
          </div>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminHealth() {
  const { t } = useI18n();
  const [data, setData] = useState<HealthResp | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await apiGet<HealthResp>("/api/system/health"));
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (err && !data) return <Section title={t("admin.tab.health")}><ErrCard err={err} onRetry={() => void load()} /></Section>;
  if (!data) {
    return (
      <Section title={t("admin.tab.health")}>
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-28" />
      </Section>
    );
  }

  const counters = [
    { icon: Users, label: t("admin.health.patients"), value: data.counts.patients },
    { icon: CalendarDays, label: t("admin.health.appointments"), value: data.counts.appts },
    { icon: Ticket, label: t("admin.health.tickets"), value: data.counts.tickets },
    { icon: Wrench, label: t("admin.health.wos"), value: data.counts.openWorkOrders },
    { icon: Siren, label: t("admin.health.critical"), value: data.counts.criticalAlerts, danger: data.counts.criticalAlerts > 0 },
  ];

  return (
    <Section title={t("admin.tab.health")} sub={t("admin.health.sub")}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard ok={data.db} icon={Database} title={t("admin.health.db")} okLabel={t("admin.health.db.ok")} badLabel={t("admin.health.db.bad")} />
        <StatusCard ok={data.realtime} icon={RadioTower} title={t("admin.health.realtime")} okLabel={t("admin.health.realtime.ok")} badLabel={t("admin.health.realtime.bad")} onRetry={() => void load()} />
        <Card className="p-0">
          <CardContent className="p-4 flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground shrink-0" aria-hidden>
              <Activity className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t("admin.health.generatedAt")}</div>
              <div dir="ltr" className="font-mono text-xs mt-0.5">
                {bhDateString(data.now)} · {bhTimeString(data.now)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{busy ? t("common.loading") : t("admin.health.autoRefresh")}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">{t("admin.health.counts")}</h3>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {counters.map((c) => (
            <Card key={c.label} className="p-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <c.icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{c.label}</span>
                </div>
                <div className={cn("text-2xl font-bold tabular-nums", c.danger && "text-red-600 dark:text-red-400")}>{c.value}</div>
                {c.danger && <Badge className="mt-1 bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border-transparent">{t("flag.CRIT")}</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Timer className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">{t("admin.health.scheduler")}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("admin.health.scheduler.body")}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <RefreshCw className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">{t("admin.health.uptime")}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("admin.health.uptime.body")}</p>
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}
