"use client";
/**
 * staff.website.bh — staff console shell. Role-based module registry:
 * login (demo accounts) → sidebar (modules allowed for role) → module screens.
 * Module files are owned by build agents 2-c/2-d/2-e/2-f.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const Reception = lazy(() => import("./reception"));
const Emr = lazy(() => import("./emr"));
const Lab = lazy(() => import("./lab"));
const Billing = lazy(() => import("./billing"));
const HomeCare = lazy(() => import("./home"));
const Ops = lazy(() => import("./ops"));

type ModuleKey = "reception" | "emr" | "lab" | "billing" | "home" | "ops";

const MODULE_DEFS: { key: ModuleKey; roles: string[]; icon: string }[] = [
  { key: "reception", roles: ["reception", "callcenter", "center-manager", "med-director"], icon: "🧾" },
  { key: "emr", roles: ["nurse", "doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "dept-head", "med-director"], icon: "🩺" },
  { key: "lab", roles: ["lab-tech", "phlebotomist", "radiologist", "med-director"], icon: "🧪" },
  { key: "billing", roles: ["cashier", "insurance", "center-manager", "med-director"], icon: "💳" },
  { key: "home", roles: ["collector", "center-manager", "med-director"], icon: "🚗" },
  { key: "ops", roles: ["inventory", "maintenance-tech", "maintenance-sup", "hr", "quality", "dpo", "auditor", "sysadmin", "center-manager", "med-director"], icon: "🔧" },
];

interface LoginOption { id: string; role: string; nameAr: string; nameEn: string; deptAr: string | null; deptCode: string | null }

function StaffLogin() {
  const { t, lang } = useI18n();
  const { setStaff } = useApp();
  const [options, setOptions] = useState<LoginOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    apiGet<LoginOption[]>("/api/staff/login-options").then(setOptions).catch(() => setOptions([]));
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
  const login = (o: LoginOption) => {
    setBusy(o.id);
    setStaff({ employeeId: o.id, role: o.role, nameAr: o.nameAr, nameEn: o.nameEn, departmentId: null });
    apiPost("/api/staff/me/modules").catch(() => null);
  };
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-2">{t("staff.login.title")}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t("shell.sim.note")} — MFA (TOTP/FIDO2) مُحاكى في العرض التجريبي.</p>
      {!options ? (
        <div className="grid md:grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {grouped.map(([role, list]) => (
            <Card key={role} className="p-0 overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/50">
                <CardTitle className="text-sm">{t(`staff.role.${role}`)} <span className="font-mono text-muted-foreground text-xs">{role}</span></CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {list.map((o) => (
                  <Button key={o.id} variant="ghost" className="w-full justify-between h-11 text-start" disabled={busy === o.id} onClick={() => login(o)}>
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

export default function StaffPortal() {
  const { staff } = useApp();
  const { t, lang } = useI18n();
  const [active, setActive] = useState<ModuleKey>("reception");
  const [inboxCount, setInboxCount] = useState(0);
  const allowed = useMemo(() => MODULE_DEFS.filter((m) => !staff || m.roles.includes(staff.role)).map((m) => m.key), [staff]);

  const staffKey = staff?.employeeId ?? "";
  const allowedKey = allowed.join(",");
  useEffect(() => {
    if (!staffKey) return;
    queueMicrotask(() => {
      const list = allowedKey.split(",").filter(Boolean) as ModuleKey[];
      setActive(list.includes("reception") ? "reception" : (list[0] ?? "reception"));
    });
  }, [staffKey, allowedKey]);
  useEffect(() => {
    if (!staffKey) return;
    const poll = () => apiGet<{ tasks: unknown[] }>("/api/staff/inbox").then((d) => setInboxCount(d.tasks.length)).catch(() => null);
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [staffKey]);

  if (!staff) return <StaffLogin />;

  const Module = active === "emr" ? Emr : active === "lab" ? Lab : active === "billing" ? Billing : active === "home" ? HomeCare : active === "ops" ? Ops : Reception;

  return (
    <div className="flex min-h-[calc(100dvh-6rem)]">
      <aside className="no-print w-14 md:w-56 shrink-0 border-e bg-muted/30 hidden sm:flex flex-col">
        <div className="p-3 border-b">
          <div className="hidden md:block">
            <div className="font-semibold text-sm truncate">{lang === "ar" ? staff.nameAr : staff.nameEn}</div>
            <div className="text-xs text-muted-foreground">{t(`staff.role.${staff.role}`)}</div>
          </div>
          <span className="md:hidden text-lg">☰</span>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 flex flex-col gap-1">
            {allowed.map((key) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 h-10 text-sm font-medium transition-colors text-start",
                  active === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-current={active === key ? "page" : undefined}
              >
                <span aria-hidden className="text-base">{MODULE_DEFS.find((m) => m.key === key)?.icon}</span>
                <span className="truncate">{t(`staff.module.${key}`)}</span>
                {key === "reception" && inboxCount > 0 && <Badge className="ms-auto size-5 justify-center p-0 text-[10px] bg-red-600">{inboxCount}</Badge>}
              </button>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => useApp.getState().setStaff(null)}>
            ⏻ {t("shell.logout")}
          </Button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="sm:hidden sticky top-[6.25rem] z-20 bg-background/90 backdrop-blur border-b overflow-x-auto">
          <div className="flex gap-1 p-2">
            {allowed.map((key) => (
              <button key={key} onClick={() => setActive(key)}
                className={cn("px-3 h-9 rounded-lg text-xs font-medium whitespace-nowrap", active === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {t(`staff.module.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <Suspense fallback={<div className="p-6 grid gap-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>}>
          <Module />
        </Suspense>
      </div>
    </div>
  );
}
