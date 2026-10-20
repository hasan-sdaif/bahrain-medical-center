"use client";
/**
 * Shared bits for the admin console — API response shapes + problem+json
 * error surfacing (RFC 7807 bilingual errors from the backend).
 */
import { useI18n } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

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

/** Standard error card with server-side-enforcement hint + retry. */
export function ErrCard({ err, onRetry }: { err: unknown; onRetry?: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Alert variant="destructive" role="alert">
      <TriangleAlert className="size-4" />
      <AlertTitle>{t("common.error")}</AlertTitle>
      <AlertDescription>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{errText(err, lang)}</span>
          <span className="text-xs opacity-80">{t("admin.err.hint")}</span>
          {onRetry && (
            <Button size="sm" variant="outline" className="h-8" onClick={onRetry}>
              {t("common.retry")}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Compact JSON preview (settings values) with full payload in the title. */
export function jsonPreview(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 56 ? `${s.slice(0, 56)}…` : s;
}

/** Section wrapper: small heading + optional sub + content (keeps tabs tidy). */
export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="text-lg font-bold">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </header>
      {children}
    </section>
  );
}
