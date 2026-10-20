"use client";
/**
 * admin.website.bh — admin & compliance console. Role gate: sysadmin, auditor,
 * dpo, med-director, center-manager (server enforces the rest — 403s surface
 * as problem+json cards). Login → 5 sub-tabs, lazy-loaded per tab.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bhTime } from "@/lib/bahrain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LockKeyhole, LogOut, ShieldCheck, TriangleAlert } from "lucide-react";
import type { LoginOption } from "./bits";

const Health = lazy(() => import("./admin-health"));
const Audit = lazy(() => import("./admin-audit"));
const Settings = lazy(() => import("./admin-settings"));
const Access = lazy(() => import("./admin-access"));
const Security = lazy(() => import("./admin-security"));

const ADMIN_ROLES = ["sysadmin", "auditor", "dpo", "med-director", "center-manager"];
/** roles that can read each tab's protected endpoints (null = open/static) */
const TAB_ROLES: Record<string, string[] | null> = {
  health: null,
  audit: ["auditor", "dpo", "sysadmin", "med-director"],
  settings: ["sysadmin", "med-director", "dpo", "center-manager"],
  access: null,
  security: null,
};
const TABS = ["health", "audit", "settings", "access", "security"] as const;
type TabKey = (typeof TABS)[number];

function AdminLogin({ deniedRole }: { deniedRole?: string }) {
  const { t, lang } = useI18n();
  const { setStaff } = useApp();
  const [options, setOptions] = useState<LoginOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    apiGet<LoginOption[]>("/api/staff/login-options")
      .then((all) => setOptions(all.filter((o) => ADMIN_ROLES.includes(o.role))))
      .catch(() => setOptions([]));
  }, []);
  const grouped = useMemo(() => {
    const g = new Map<string, LoginOption[]>();
    for (const o of options ?? []) {
      const list = g.get(o.role) ?? [];
      list.push(o);
      g.set(o.role, list);
    }
    return [...g.entries()];
  }, [options]);
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <LockKeyhole className="size-6 text-primary" aria-hidden /> {t("admin.login.title")}
      </h1>
      <p className="text-sm text-muted-foreground mb-4">{t("admin.login.note")}</p>
      {deniedRole && (
        <Alert variant="destructive" className="mb-4" role="alert">
          <TriangleAlert className="size-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{t("admin.login.denied", { role: deniedRole })}</AlertDescription>
        </Alert>
      )}
      {!options ? (
        <div className="grid md:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.login.empty")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map(([role, list]) => (
            <Card key={role} className="p-0 overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/50">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  {t(`staff.role.${role}`)}
                  <span className="font-mono text-muted-foreground text-[10px]">{role}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {list.map((o) => (
                  <Button
                    key={o.id}
                    variant="ghost"
                    className="w-full justify-between h-11 text-start"
                    disabled={busy === o.id}
                    onClick={() => {
                      setBusy(o.id);
                      setStaff({ employeeId: o.id, role: o.role, nameAr: o.nameAr, nameEn: o.nameEn, departmentId: null });
                    }}
                  >
                    <span className="truncate">{lang === "ar" ? o.nameAr : o.nameEn}</span>
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">{o.deptCode ?? "—"}</Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveClock() {
  const { t } = useI18n();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-end leading-tight" aria-label={t("admin.header.clock")}>
      <div dir="ltr" className="font-mono text-lg tabular-nums">
        {bhTime(now).toLocaleTimeString("en-GB")}
        <span className="text-[10px] text-muted-foreground"> +03</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{t("admin.header.clock")}</div>
    </div>
  );
}

export default function AdminPortal() {
  const { staff } = useApp();
  const { t, lang } = useI18n();
  if (!staff || !ADMIN_ROLES.includes(staff.role)) return <AdminLogin deniedRole={staff?.role} />;
  const limited = (k: TabKey) => {
    const roles = TAB_ROLES[k];
    return !!roles && !roles.includes(staff.role);
  };
  const Panel = (k: TabKey) => (k === "health" ? <Health /> : k === "audit" ? <Audit /> : k === "settings" ? <Settings /> : k === "access" ? <Access /> : <Security />);
  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 rounded-xl border bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shrink-0" aria-hidden>
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold truncate">{t("admin.header.title")}</h1>
            <p className="text-xs text-muted-foreground truncate">{t("admin.header.sub")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 ms-auto">
          <LiveClock />
          <div className="hidden sm:block text-end leading-tight max-w-44">
            <div className="text-sm font-medium truncate">{lang === "ar" ? staff.nameAr : staff.nameEn}</div>
            <div className="text-xs text-muted-foreground">{t(`staff.role.${staff.role}`)}</div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-10 shrink-0"
            aria-label={t("shell.logout")}
            onClick={() => useApp.getState().setStaff(null)}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="health">
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k} className="gap-1.5">
              {t(`admin.tab.${k}`)}
              {limited(k) && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent">
                  {t("admin.tab.limited")}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <Suspense fallback={<div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>}>
              {Panel(k)}
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
