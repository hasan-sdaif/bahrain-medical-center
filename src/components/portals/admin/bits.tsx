"use client";
/**
 * Shared bits for the admin console — API response shapes, problem+json error
 * surfacing (RFC 7807 bilingual errors) and the Shamel `.stat-card` primitive
 * used by the health dashboard.
 */
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HealthResp {
  ok: boolean;
  db: boolean;
  realtime: boolean;
  counts: { patients: number; appts: number; tickets: number; criticalAlerts: number; openWorkOrders: number };
  now: string;
}

export interface AuditRow {
  id: string;
  at: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  patientId: string | null;
  reason: string | null;
  hash: string;
}

export interface ChainResp { ok: boolean; checked: number; brokenAt: string | null }

export interface SettingsResp {
  settings: { key: string; value: unknown; group: string; version: number }[];
  flags: { key: string; enabled: boolean; description: string | null }[];
  sequences: { key: string; next: number }[];
  licenses: { kind: string; nameAr: string; number: string; expiresAt: string; daysLeft: number }[];
}

export interface LoginOption { id: string; role: string; nameAr: string; nameEn: string; deptCode: string | null; deptAr: string | null }

/** Pull a bilingual message out of a problem+json error (or any thrown error). */
export function errText(err: unknown, lang: "ar" | "en"): string {
  const p = (err as { problem?: Record<string, unknown> } | null)?.problem;
  if (p) {
    const detail = lang === "ar" ? p.detailAr : p.detailEn;
    const code = typeof p.code === "string" ? ` (${p.code})` : "";
    return `${detail ?? p.title ?? ""}${code}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Standard Shamel alert-danger card with server-side-enforcement hint + retry. */
export function ErrCard({ err, onRetry }: { err: unknown; onRetry?: () => void }) {
  const { t, lang } = useI18n();
  return (
    <div role="alert" className="alert alert-danger">
      <span className="al-ic"><TriangleAlert className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="al-title">{t("common.error")}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{errText(err, lang)}</span>
          <span className="text-xs opacity-80">{t("admin.err.hint")}</span>
          {onRetry && (
            <Button size="sm" variant="outline" className="h-8" onClick={onRetry}>
              <RefreshCw className="size-3.5" aria-hidden /> {t("common.retry")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shamel guide .stat-card (05-cards-tables.css): label + tone icon + big num. */
export function StatCard({
  label, icon: Icon, tone, value, foot, danger,
}: {
  label: string; icon: LucideIcon; tone: string; value: ReactNode; foot?: ReactNode; danger?: boolean;
}) {
  return (
    <div className="card stat-card">
      <div className="sc-top">
        <span className="sc-label">{label}</span>
        <span className={cn("sc-ic", tone)} aria-hidden><Icon className="size-5" /></span>
      </div>
      <div className={cn("sc-value", danger && "text-red-600 dark:text-red-400")}>{value}</div>
      {foot ? <div className="sc-foot">{foot}</div> : null}
    </div>
  );
}

/** Compact JSON preview (settings values) with full payload in the title. */
export function jsonPreview(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 56 ? `${s.slice(0, 56)}…` : s;
}
