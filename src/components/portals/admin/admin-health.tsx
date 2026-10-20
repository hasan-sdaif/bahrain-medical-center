"use client";
/**
 * Section 1 — صحة النظام (Shamel guide admin/health): GET /api/system/health
 * with 30s auto-refresh. Service status stat-cards (DB/realtime with retry),
 * live counters stat-grid, scheduler + uptime notes.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity, CalendarDays, Database, RadioTower, RefreshCw, Siren, Ticket, Timer, Users, Wrench,
} from "lucide-react";
import { ErrCard, StatCard, type HealthResp } from "./bits";

function StatusValue({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span className={cn("badge lg mt-1", ok ? "b-green" : "b-red")}>
      <span className="dot" aria-hidden />
      {ok ? okLabel : badLabel}
    </span>
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

  if (err && !data) return <ErrCard err={err} onRetry={() => void load()} />;
  if (!data) {
    return (
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  const counters = [
    { icon: Users, tone: "ic-navy", label: t("admin.health.patients"), value: data.counts.patients },
    { icon: CalendarDays, tone: "ic-teal", label: t("admin.health.appointments"), value: data.counts.appts },
    { icon: Ticket, tone: "ic-sky", label: t("admin.health.tickets"), value: data.counts.tickets },
    { icon: Wrench, tone: "ic-amber", label: t("admin.health.wos"), value: data.counts.openWorkOrders },
    { icon: Siren, tone: "ic-red", label: t("admin.health.critical"), value: data.counts.criticalAlerts, danger: data.counts.criticalAlerts > 0 },
  ];

  return (
    <div className="stack-sm">
      {/* service status */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label={t("admin.health.db")} icon={Database} tone={data.db ? "ic-green" : "ic-red"}
          value={<StatusValue ok={data.db} okLabel={t("admin.health.db.ok")} badLabel={t("admin.health.db.bad")} />}
        />
        <StatCard
          label={t("admin.health.realtime")} icon={RadioTower} tone={data.realtime ? "ic-green" : "ic-red"}
          value={<StatusValue ok={data.realtime} okLabel={t("admin.health.realtime.ok")} badLabel={t("admin.health.realtime.bad")} />}
          foot={(
            <Button size="sm" variant="outline" className="h-8" onClick={() => void load()}>
              <RefreshCw className="size-3.5" aria-hidden /> {t("common.retry")}
            </Button>
          )}
        />
        <StatCard
          label={t("admin.health.generatedAt")} icon={Activity} tone="ic-slate"
          value={<span className="num text-2xl">{bhTimeString(data.now)}</span>}
          foot={<span className="sc-sub">{busy ? t("common.loading") : t("admin.health.autoRefresh")} · {bhDateString(data.now)}</span>}
        />
      </div>

      {/* live counters */}
      <section aria-label={t("admin.health.counts")}>
        <h2 className="mb-3 text-sm font-bold text-ink-3">{t("admin.health.counts")}</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {counters.map((c) => (
            <StatCard
              key={c.label} label={c.label} icon={c.icon} tone={c.tone}
              value={c.value} danger={c.danger}
              foot={c.danger ? <span className="badge b-red sm">{t("flag.CRIT")}</span> : null}
            />
          ))}
        </div>
      </section>

      {/* notes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-0">
          <div className="card-head">
            <span className="ch-title">
              <span className="ch-ic"><Timer className="size-4" aria-hidden /></span>
              {t("admin.health.scheduler")}
            </span>
          </div>
          <div className="card-body"><p className="card-desc">{t("admin.health.scheduler.body")}</p></div>
        </div>
        <div className="card p-0">
          <div className="card-head">
            <span className="ch-title">
              <span className="ch-ic"><RefreshCw className="size-4" aria-hidden /></span>
              {t("admin.health.uptime")}
            </span>
          </div>
          <div className="card-body"><p className="card-desc">{t("admin.health.uptime.body")}</p></div>
        </div>
      </div>
    </div>
  );
}
