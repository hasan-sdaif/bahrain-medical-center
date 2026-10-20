"use client";
/**
 * Section 4 — الوصول والصلاحيات (Shamel guide admin pattern): static
 * role×module matrix mirroring the documented §5.3 RBAC (src/server/perm.ts —
 * view-only here, the server enforces every endpoint) + live active-account
 * counts per role from GET /api/staff/login-options. Shamel .card / .table.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, ClipboardCheck, LayoutGrid, Minus, Users } from "lucide-react";
import type { LoginOption } from "./bits";

/** §5.3 matrix — mirror of src/server/perm.ts (kept in sync by review) */
const MATRIX: Record<string, string[]> = {
  reception: ["reader", "board", "appointments", "queue", "messages", "clinical"],
  callcenter: ["board", "appointments", "messages", "queue"],
  nurse: ["triage", "clinical", "board", "queue", "orders", "messages"],
  doctor: ["clinical", "orders", "board", "queue", "messages", "lab", "radiology", "pharmacy", "home", "reports"],
  dentist: ["clinical", "orders", "board", "radiology", "messages", "pharmacy", "reports"],
  surgeon: ["clinical", "orders", "board", "radiology", "messages", "pharmacy", "reports"],
  oncologist: ["clinical", "orders", "board", "radiology", "messages", "reports"],
  psychiatrist: ["clinical", "orders", "board", "messages", "pharmacy", "reports"],
  nutritionist: ["clinical", "orders", "board", "messages", "reports"],
  pediatrician: ["clinical", "orders", "board", "messages", "pharmacy", "reports"],
  "lab-tech": ["lab", "phlebotomy", "queue", "messages", "reports"],
  phlebotomist: ["phlebotomy", "queue", "messages"],
  radiologist: ["radiology", "queue", "messages", "reports"],
  pharmacist: ["pharmacy", "queue", "messages", "reports"],
  cashier: ["billing", "queue", "messages", "reports"],
  insurance: ["insurance", "billing", "messages", "reports"],
  collector: ["home", "messages"],
  inventory: ["inventory", "maintenance", "messages", "reports"],
  "maintenance-tech": ["maintenance", "messages"],
  "maintenance-sup": ["maintenance", "inventory", "messages", "reports"],
  hr: ["hr", "messages", "reports"],
  quality: ["quality", "reports", "messages"],
  dpo: ["audit", "quality", "reports", "messages"],
  auditor: ["audit", "reports"],
  sysadmin: ["settings", "audit", "reports", "messages"],
  content: ["messages"],
  "center-manager": ["reports", "messages", "billing", "hr", "quality", "inventory", "maintenance", "home"],
  "med-director": ["clinical", "orders", "lab", "radiology", "pharmacy", "reports", "audit", "quality", "home", "messages"],
  "dept-head": ["clinical", "orders", "reports", "queue", "messages"],
};
const MODULES = ["reader", "patients-admin", "board", "appointments", "queue", "triage", "clinical", "orders", "lab", "phlebotomy", "radiology", "pharmacy", "billing", "insurance", "home", "maintenance", "inventory", "quality", "hr", "reports", "audit", "settings", "messages"];

export default function AdminAccess() {
  const { t } = useI18n();
  const { staff } = useApp();
  const [options, setOptions] = useState<LoginOption[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    apiGet<LoginOption[]>("/api/staff/login-options").then(setOptions).catch(() => setErr(true));
  }, []);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const o of options ?? []) c.set(o.role, (c.get(o.role) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [options]);

  return (
    <div className="stack-sm">
      <div className="alert alert-info">
        <span className="al-ic"><ClipboardCheck className="size-5" aria-hidden /></span>
        <div>{t("admin.access.note")}</div>
      </div>

      <div className="card p-0">
        <div className="card-head">
          <span className="ch-title">
            <span className="ch-ic"><Users className="size-4" aria-hidden /></span>
            {t("admin.access.accounts")}
          </span>
        </div>
        <div className="card-body">
          {err ? (
            <p className="text-sm text-ink-3">{t("admin.access.accounts.err")}</p>
          ) : !options ? (
            <div className="flex flex-wrap gap-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-28 rounded-lg" />)}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {counts.map(([role, n]) => (
                <span
                  key={role}
                  className={cn(
                    "badge b-slate inline-flex h-9 items-center gap-1.5 px-2.5 text-xs",
                    staff?.role === role && "b-teal font-semibold",
                  )}
                >
                  {t(`staff.role.${role}`)}
                  {staff?.role === role && <Badge variant="outline" className="border-transparent bg-transparent p-0 text-[9px]">{t("admin.access.you")}</Badge>}
                  <span className="mono tabular-nums">{t("admin.access.accounts.count", { n })}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-0">
        <div className="card-head">
          <span className="ch-title">
            <span className="ch-ic"><LayoutGrid className="size-4" aria-hidden /></span>
            {t("admin.access.matrix")}
          </span>
          <span className="ch-sub">{t("admin.access.matrix.hint")}</span>
        </div>
        <div className="card-body p-0">
          <div className="table-wrap max-h-96 overflow-auto">
            <table className="table sm min-w-max">
              <thead>
                <tr>
                  <th className="sticky start-0 z-20 min-w-36 bg-surface-2">{t("shell.role")}</th>
                  {MODULES.map((m) => (
                    <th key={m} className="mono whitespace-nowrap text-center text-[10px]" dir="ltr">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MATRIX).map(([role, mods]) => (
                  <tr key={role} className={cn(staff?.role === role && "bg-primary/10")}>
                    <td className="sticky start-0 z-10 min-w-36 bg-surface">
                      <div className="text-xs font-semibold">{t(`staff.role.${role}`)}</div>
                      <div className="mono text-[9px] text-ink-3" dir="ltr">{role}</div>
                    </td>
                    {MODULES.map((m) => (
                      <td key={m} className="text-center">
                        {mods.includes(m) ? (
                          <Check className="inline size-3.5 text-green-600 dark:text-green-400" aria-label={t("common.yes")} />
                        ) : (
                          <Minus className="inline size-3.5 text-ink-3/40" aria-label={t("common.no")} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
