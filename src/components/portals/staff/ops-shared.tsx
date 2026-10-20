"use client";
/**
 * ops-shared — payload types (docs/API.md §ops), data hook + tiny UI atoms
 * shared across the العمليات والمرافق sub-tabs (agent 2-f).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiGet } from "@/lib/api-client";
import { useI18n, type Lang } from "@/i18n";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── RBAC mirrors (server matrix in src/server/perm.ts) ──
export const MAINT_ROLES = new Set(["inventory", "maintenance-tech", "maintenance-sup", "center-manager"]);
export const INV_ROLES = new Set(["inventory", "maintenance-sup", "center-manager"]);
export const HR_ROLES = new Set(["hr", "center-manager"]);
export const QUALITY_ROLES = new Set(["quality", "dpo", "center-manager", "med-director"]);
export const REPORTS_ROLES = new Set(["inventory", "maintenance-sup", "hr", "quality", "dpo", "auditor", "sysadmin", "center-manager", "med-director"]);

// ── payload types ──
export interface PlanRow { id: string; titleAr: string; titleEn: string; frequencyDays: number; checklist: string[]; parts: { code: string; qty: number }[]; estMinutes: number }
export interface AssetRow { id: string; code: string; nameAr: string; nameEn: string; category: string; status: string; serialNo: string | null; model: string | null; costFils: number | null; warrantyUntil: string | null; calibrationDueAt: string | null; downtimeMin: number | null; notes: string | null }
export interface AssetsResp { plans: PlanRow[]; assets: AssetRow[] }
export interface FaultResp { requestId: string; code: string; workOrder: { id: string; code: string; slaDueAt: string } }
export interface WoMessage { id: string; senderId: string | null; body: string; kind: string; at: string }
export interface WoPart { id: string; itemCode: string; qty: number; issuedAt: string | null }
export interface WoRow {
  id: string; code: string; kind: string; status: string; priority: string; titleAr?: string | null;
  asset: { code: string; nameAr: string; nameEn: string; category: string } | null;
  technicianId: string | null; slaDueAt: string | null; dueIn: number | null;
  startedAt: string | null; finishedAt: string | null; closedAt: string | null;
  rootCauseAr: string | null; actionAr: string | null; downtimeMin: number | null;
  checklist: { steps?: { t: string; done: boolean }[] } | null;
  messages: WoMessage[]; parts: WoPart[]; overSla: boolean;
}
export interface MetricsResp {
  workOrders: { total: number; closed: number; open: number };
  mttrMin: number; mtbfDays: number | null;
  assetsByStatus: Record<string, number>; assetsByCategory: Record<string, number>;
  topDowntime: { code: string; nameAr: string; downtimeMin: number | null; costFils: number | null; ratio: number }[];
}
export interface ItemRow { code: string; nameAr: string; nameEn: string; category: string; uom: string; costFils: number; parLevel: number; reorderQty: number; controlled: boolean; storage: string; barcode: string }
export interface BatchRow { lotNo: string; qty: number; expiry: string; status: string }
export interface MoveRow { id: string; type: string; qty: number; fromBin: string | null; toBin: string | null; at: string; reason: string | null }
export interface InventoryResp { items: ItemRow[]; batches: BatchRow[]; moves: MoveRow[] }
export interface EmpRow { id: string; staffNo: string; nameAr: string; nameEn: string; role: string; jobTitleAr: string | null; jobTitleEn: string | null; department: { code: string; nameAr: string } | null; licenseNo: string | null; licenseExpiresAt: string | null; licenseDaysLeft: number | null; active: boolean; phone: string | null; email: string | null }
export interface FacLicRow { kind: string; nameAr: string; number: string; expiresAt: string; daysLeft: number }
export interface HrResp { employees: EmpRow[]; facilityLicenses: FacLicRow[] }
export interface IncidentRow { id: string; code: string; type: string; severity: string; description: string; status: string; at: string }
export interface ComplaintRow { id: string; code: string; category: string; description: string; status: string; slaDueAt: string | null; resolutionAr: string | null; overSla: boolean }
export interface CapaRow { id: string; code: string; status: string; actionAr: string; dueAt: string | null }
export interface QualityResp { incidents: IncidentRow[]; complaints: ComplaintRow[]; capas: CapaRow[]; nps: number; surveyCount: number }
export interface ReportsResp {
  kpis: { patients: number; appointments: number; encounters: number; revenueFils: number; collectedFils: number; claims: { total: number; rejected: number }; labResults: number; prescriptions: number; homeRequests: number; workOrders: number };
  dailyRevenue: { date: string; fils: number }[]; deptVolume: number;
}

// ── helpers ──
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}
export function fmtDT(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${bhDateString(iso)} ${bhTimeString(iso)}`;
}
export function errText(e: unknown, lang: Lang, fallback: string): string {
  const p = (e as { problem?: { detailAr?: string; detailEn?: string; detail?: string } }).problem;
  const msg = lang === "ar" ? p?.detailAr ?? p?.detailEn ?? p?.detail : p?.detailEn ?? p?.detailAr ?? p?.detail;
  return msg || fallback;
}

// ── data hook ──
export function useOps<T>(path: string): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const { lang } = useI18n();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    apiGet<T>(path, ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) setData(d); })
      .catch((e) => { if (!ctrl.signal.aborted) setError(errText(e, lang, "")); });
    return () => ctrl.abort();
  }, [path, tick, lang]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, loading: data === null && error === null, error, reload };
}

// ── UI atoms ──
export function Panel({ loading, error, onRetry, isEmpty, children, rows = 4 }: { loading: boolean; error: string | null; onRetry: () => void; isEmpty: boolean; children: ReactNode; rows?: number }) {
  const { t } = useI18n();
  if (loading) return <div className="grid gap-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (error) return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm">{error || t("common.error")}</span>
        <Button size="sm" variant="outline" onClick={onRetry} className="h-9">{t("common.retry")}</Button>
      </AlertDescription>
    </Alert>
  );
  if (isEmpty) return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t("common.empty")}</div>;
  return <>{children}</>;
}

export function Kpi({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-4">
      <CardContent className="p-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span className="truncate">{label}</span></div>
        <div className="mt-1.5 text-2xl font-bold tabular-nums leading-tight">{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

export function SlaChip({ minutes, over }: { minutes: number | null; over?: boolean }) {
  const { t } = useI18n();
  if (minutes == null) return <span className="text-xs text-muted-foreground">{t("ops.sla.none")}</span>;
  const late = over || minutes < 0;
  const abs = Math.abs(minutes);
  const m = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums",
      late ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" : "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200")}>
      {t(late ? "ops.sla.over" : "ops.sla.left", { m })}
    </span>
  );
}

export function Countdown({ days, warn = 90, danger = 30 }: { days: number | null; warn?: number; danger?: number }) {
  const { t } = useI18n();
  if (days == null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = days < danger ? "text-red-600 dark:text-red-400" : days < warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return <span className={cn("text-xs font-medium tabular-nums", tone)}>{days < 0 ? t("ops.days.late", { n: Math.abs(days) }) : t("ops.days.left", { n: days })}</span>;
}
