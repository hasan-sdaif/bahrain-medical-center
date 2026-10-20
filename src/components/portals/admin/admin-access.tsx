"use client";
/**
 * Tab 4 — الوصول والصلاحيات: static role×module matrix mirroring the
 * documented §5.3 RBAC (src/server/perm.ts — view-only here, the server
 * enforces every endpoint) + live active-account counts per role from
 * GET /api/staff/login-options.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Check, ClipboardCheck, LayoutGrid, Minus, Users } from "lucide-react";
import { Section, type LoginOption } from "./bits";

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
    <Section title={t("admin.tab.access")} sub={t("admin.access.sub")}>
      <div className="rounded-xl border bg-primary/5 p-4 flex items-start gap-3">
        <ClipboardCheck className="size-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm">{t("admin.access.note")}</p>
      </div>

      <Card className="p-0">
        <CardHeader className="py-3 px-4 bg-muted/50">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="size-4 text-primary" aria-hidden /> {t("admin.access.accounts")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {err ? (
            <p className="text-sm text-muted-foreground">{t("admin.access.accounts.err")}</p>
          ) : !options ? (
            <div className="flex flex-wrap gap-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-28" />)}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {counts.map(([role, n]) => (
                <span key={role} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 h-9 text-xs", staff?.role === role && "border-primary bg-primary/10 font-semibold")}>
                  {t(`staff.role.${role}`)}
                  {staff?.role === role && <Badge variant="secondary" className="text-[9px]">{t("admin.access.you")}</Badge>}
                  <Badge variant="secondary" className="tabular-nums font-mono">{t("admin.access.accounts.count", { n })}</Badge>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-0">
        <CardHeader className="py-3 px-4 bg-muted/50">
          <CardTitle className="text-sm flex items-center gap-2"><LayoutGrid className="size-4 text-primary" aria-hidden /> {t("admin.access.matrix")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3">{t("admin.access.matrix.hint")}</p>
          <div className="max-h-96 overflow-auto rounded-lg border">
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-start sticky start-0 bg-background z-20 min-w-36">{t("shell.role")}</TableHead>
                  {MODULES.map((m) => (
                    <TableHead key={m} className="text-center font-mono text-[10px] whitespace-nowrap" dir="ltr">{m}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(MATRIX).map(([role, mods]) => (
                  <TableRow key={role} className={cn(staff?.role === role && "bg-primary/10")}>
                    <TableCell className="text-start sticky start-0 bg-background z-10 min-w-36">
                      <div className="text-xs font-medium">{t(`staff.role.${role}`)}</div>
                      <div className="font-mono text-[9px] text-muted-foreground" dir="ltr">{role}</div>
                    </TableCell>
                    {MODULES.map((m) => (
                      <TableCell key={m} className="text-center">
                        {mods.includes(m) ? (
                          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 inline" aria-label={t("common.yes")} />
                        ) : (
                          <Minus className="size-3.5 text-muted-foreground/40 inline" aria-label={t("common.no")} />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}
