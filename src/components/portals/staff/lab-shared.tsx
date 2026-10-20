"use client";
/**
 * lab-shared — payload types (docs/API.md §lab/imaging), RBAC mirrors, data
 * hook and tiny UI atoms shared across the المختبر والأشعة sub-tabs (2-d / S1).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useI18n, type Lang } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── RBAC mirrors (server matrix in src/server/perm.ts) ──
export const PHLEB_ROLES = new Set(["lab-tech", "phlebotomist"]);
export const LAB_ROLES = new Set(["lab-tech", "doctor", "med-director"]);
export const RAD_ROLES = new Set(["doctor", "dentist", "surgeon", "oncologist", "radiologist", "med-director"]);

// ── payload types ──
export interface PhlebRow {
  orderId: string; code: string; priority: string; fasting: boolean;
  patient: { mrn: string; nameAr: string; assurance: number };
  items: { nameAr: string; status: string }[];
  specimen: { code: string; status: string } | null;
}
export interface DrawResp { id: string; code: string; barcode: string }
export interface SpecimenRow { id: string; code: string; status: string; patient: { mrn: string; nameAr: string }; collectedAt: string | null }
export interface PendingResult { id: string; test: string; value: number | null; unit: string; flag: string | null; patient: { mrn: string; nameAr: string } }
export interface CriticalAlertRow {
  id: string; status: string; notifiedAt: string; test: string; value: number | null; unit: string;
  patient: { mrn: string; nameAr: string };
  log: { at: string; ev: string; who?: string }[];
}
export interface LabWorklist { specimens: SpecimenRow[]; pendingResults: PendingResult[]; criticalAlerts: CriticalAlertRow[] }
export interface ResultResp { id: string; flag: string | null; autoVerified: boolean; needsHuman: boolean; reason: string; deltaPct: number | null }
export interface Hl7Resp { hl7: { adapter: string; segments: string[] }; result: ResultResp }
export interface QcRow { id: string; testId: string | null; level: number; target: number; observed: number; status: string; rule: string | null; runAt: string }
export interface QcResp { id: string; status: string; rule: string | null }
export interface StudyRow {
  id: string; code: string; status: string; grade: string | null; template: string | null;
  patient: { mrn: string; nameAr: string; gender: string; dob: string };
  reportAr: string | null; reportEn: string | null; findingsAr: string | null;
  images: { seed?: string; captionAr?: string; captionEn?: string }[];
  signedAt: string | null;
}
export interface OrderListRow {
  id: string; code: string; kind: string; priority: string; status: string; reason: string | null;
  patient: { id: string; mrn: string; nameAr: string };
  items: { id: string; nameAr: string; nameEn: string | null; status: string; priceFils: number }[];
  totalFils: number; createdAt: string;
}
export interface PickPatient { id: string; mrn: string; nameAr: string; nameEn?: string | null; phone?: string | null }

// ── error → bilingual message (problem+json RFC7807) ──
export function errText(e: unknown, lang: Lang): string {
  const p = (e as { problem?: Record<string, unknown> })?.problem;
  if (p) return String(lang === "ar" ? p.detailAr ?? p.detail ?? p.title : p.detailEn ?? p.detail ?? p.title);
  return e instanceof Error ? e.message : String(e ?? "");
}

// ── data hook (fetch on mount/lang, manual reload) ──
export function useLab<T>(path: string): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const { lang } = useI18n();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    apiGet<T>(path, ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) { setData(d); setError(null); } })
      .catch((e) => { if (!ctrl.signal.aborted) setError(errText(e, lang)); });
    return () => ctrl.abort();
  }, [path, tick, lang]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, loading: data === null && error === null, error, reload };
}

// ── UI atoms ──
export function LabPanel({ loading, error, onRetry, isEmpty, children, rows = 4 }: { loading: boolean; error: string | null; onRetry: () => void; isEmpty: boolean; children: ReactNode; rows?: number }) {
  const { t } = useI18n();
  if (loading) return <div className="grid gap-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (error) return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-3 flex-wrap">
      <span className="flex-1 min-w-40 flex items-center gap-2"><TriangleAlert className="size-4 shrink-0" aria-hidden />{error || t("common.error")}</span>
      <Button size="sm" variant="outline" className="h-9" onClick={onRetry}>{t("common.retry")}</Button>
    </div>
  );
  if (isEmpty) return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t("common.empty")}</div>;
  return <>{children}</>;
}

export function FlagBadge({ flag }: { flag: string | null | undefined }) {
  const { t } = useI18n();
  if (!flag) return null;
  const tone = flag === "CRIT"
    ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 animate-pulse"
    : flag === "H" || flag === "L"
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  return <Badge variant="outline" className={cn("border-transparent text-[10px] font-semibold", tone)}>{t(`flag.${flag}`)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useI18n();
  const tone = priority === "stat"
    ? "bg-red-600 text-white"
    : priority === "urgent"
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return <Badge variant="outline" className={cn("border-transparent text-[10px] font-semibold", tone)}>{t(`priority.${priority}`)}</Badge>;
}

export function AssuranceDot({ level }: { level: number | undefined }) {
  const tone = level === 1 ? "bg-emerald-500" : level === 2 ? "bg-teal-500" : level === 4 ? "bg-zinc-400" : "bg-amber-500";
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", tone)} />;
}

// ── reference ranges (analyzer simulation: value within refLow..refHigh) ──
export const REF_RANGES: Record<string, [number, number]> = {
  CBC: [4.5, 11], "Complete Blood Count": [4.5, 11],
  Hemoglobin: [12, 17], "Fasting Glucose": [3.9, 5.6], "Random Glucose": [3.9, 7.8],
  HbA1c: [4, 5.6], Creatinine: [53, 106], Potassium: [3.5, 5.1], Sodium: [136, 145],
  "Total Cholesterol": [3, 5.2], TSH: [0.55, 4.78], "Free T4": [11, 22],
  "Vitamin D (25-OH)": [50, 250], CRP: [0, 5], Urea: [2.8, 8.1],
};
export function randInRef(nameEn: string | null): number {
  const [lo, hi] = REF_RANGES[nameEn ?? ""] ?? [1, 10];
  const dec = hi < 10 ? 2 : hi < 100 ? 1 : 0;
  return Number((lo + Math.random() * (hi - lo)).toFixed(dec));
}

// ── print helper — isolates the .print-area element on paper ──
export function printLabel(el: HTMLElement | null) {
  if (!el) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.id = "lab-print-clone";
  clone.classList.add("print-area");
  document.body.appendChild(clone);
  document.body.classList.add("lab-printing");
  const cleanup = () => {
    document.body.classList.remove("lab-printing");
    clone.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
export function LabPrintStyle() {
  return <style>{`@media print { body.lab-printing > *:not(#lab-print-clone) { display: none !important; } #lab-print-clone { position: fixed; inset: 0; background: white; padding: 24px; } }`}</style>;
}
