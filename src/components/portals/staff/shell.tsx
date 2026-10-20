"use client";
/**
 * shell.tsx — the Shamel app-shell (doctor/dashboard.html) around the six
 * staff modules: fixed sidebar (brand, grouped nav with inbox badge, user
 * foot + logout), off-canvas ≤1180px with backdrop, collapse persisted to
 * localStorage "smc-side", sticky topbar (shell-topbar.tsx), and the accent
 * bridge tinting the workspace per active module (01-tokens.css data-accent).
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { CreditCard, FlaskConical, LogOut, ReceiptText, Stethoscope, Wrench, Car } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ShamelBrand, setBodyAccent, STAFF_MODULE_ACCENT } from "@/components/shell/brand";
import { cn } from "@/lib/utils";
import { avClassOf, initialsOf } from "./shell-identity";
import { StaffTopbar, type InboxTask } from "./shell-topbar";

const Reception = lazy(() => import("./reception"));
const Emr = lazy(() => import("./emr"));
const Lab = lazy(() => import("./lab"));
const Billing = lazy(() => import("./billing"));
const HomeCare = lazy(() => import("./home"));
const Ops = lazy(() => import("./ops"));

export type ModuleKey = "reception" | "emr" | "lab" | "billing" | "home" | "ops";

export const MODULE_DEFS: { key: ModuleKey; roles: string[]; icon: LucideIcon }[] = [
  { key: "reception", roles: ["reception", "callcenter", "center-manager", "med-director"], icon: ReceiptText },
  { key: "emr", roles: ["nurse", "doctor", "dentist", "surgeon", "oncologist", "psychiatrist", "nutritionist", "pediatrician", "dept-head", "med-director"], icon: Stethoscope },
  { key: "lab", roles: ["lab-tech", "phlebotomist", "radiologist", "med-director"], icon: FlaskConical },
  { key: "billing", roles: ["cashier", "insurance", "center-manager", "med-director"], icon: CreditCard },
  { key: "home", roles: ["collector", "center-manager", "med-director"], icon: Car },
  { key: "ops", roles: ["inventory", "maintenance-tech", "maintenance-sup", "hr", "quality", "dpo", "auditor", "sysadmin", "center-manager", "med-director"], icon: Wrench },
];

const NAV_GROUPS: { key: string; modules: ModuleKey[] }[] = [
  { key: "staff.shell.group.front", modules: ["reception", "billing"] },
  { key: "staff.shell.group.clinical", modules: ["emr", "lab"] },
  { key: "staff.shell.group.services", modules: ["home"] },
  { key: "staff.shell.group.ops", modules: ["ops"] },
];

/** Guide page-head (03-layout.css §رأس الصفحة) — exported for future module use. */
export function PageHead({ icon: Icon, title, sub, children }: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="page-head-row">
        <div className="page-title-wrap">
          <span className="page-title-ic"><Icon className="size-7" aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="truncate">{title}</h1>
            {sub ? <p className="page-sub truncate">{sub}</p> : null}
          </div>
        </div>
        {children ? <div className="page-head-actions">{children}</div> : null}
      </div>
    </div>
  );
}

export default function StaffShell() {
  const { staff, setStaff } = useApp();
  const { t, lang } = useI18n();
  const [active, setActive] = useState<ModuleKey>("reception");
  const [inboxCount, setInboxCount] = useState(0);
  const [inbox, setInbox] = useState<InboxTask[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  const allowed = useMemo(() => MODULE_DEFS.filter((m) => !staff || m.roles.includes(staff.role)).map((m) => m.key), [staff]);
  const staffKey = staff?.employeeId ?? "";
  const allowedKey = allowed.join(",");

  const closeSide = () => { setSideOpen(false); document.body.classList.remove("side-open"); };
  const openSide = () => { setSideOpen(true); document.body.classList.add("side-open"); };
  const pick = (key: ModuleKey) => { setActive(key); closeSide(); };
  const toggleCollapse = () => setCollapsed((prev) => {
    const next = !prev;
    document.body.classList.toggle("side-collapsed", next);
    try { localStorage.setItem("smc-side", next ? "1" : "0"); } catch { /* private mode */ }
    return next;
  });

  // default module per role (unchanged logic)
  useEffect(() => {
    if (!staffKey) return;
    queueMicrotask(() => {
      const list = allowedKey.split(",").filter(Boolean) as ModuleKey[];
      setActive(list.includes("reception") ? "reception" : (list[0] ?? "reception"));
    });
  }, [staffKey, allowedKey]);

  // inbox poll (60s) — count for the badge + tasks for the popover
  useEffect(() => {
    if (!staffKey) return;
    const poll = () => apiGet<{ tasks: InboxTask[] }>("/api/staff/inbox")
      .then((d) => { setInbox(d.tasks ?? []); setInboxCount(d.tasks.length); })
      .catch(() => null);
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [staffKey]);

  // per-module workspace accent (01-tokens.css data-accent map)
  useEffect(() => {
    if (!staffKey) return;
    setBodyAccent(STAFF_MODULE_ACCENT[active] ?? "reception");
  }, [active, staffKey]);

  // restore persisted collapse + clean body state on unmount
  useEffect(() => {
    try {
      const c = localStorage.getItem("smc-side") === "1";
      setCollapsed(c);
      document.body.classList.toggle("side-collapsed", c);
    } catch { /* private mode */ }
    return () => {
      document.body.classList.remove("side-collapsed", "side-open");
      document.body.removeAttribute("data-accent");
    };
  }, []);

  useEffect(() => {
    if (!sideOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  if (!staff) return null;

  const name = lang === "ar" ? staff.nameAr : staff.nameEn;
  const Module = active === "emr" ? Emr : active === "lab" ? Lab : active === "billing" ? Billing : active === "home" ? HomeCare : active === "ops" ? Ops : Reception;

  return (
    <div className="app-shell smc-staff-shell min-h-[calc(100dvh-3.5rem)]">
      <aside className="sidebar top-14 no-print" aria-label={t("staff.shell.nav")}>
        <div className="sidebar-brand">
          <ShamelBrand name={t("shell.app.name")} sub={t("staff.shell.brandSub")} compact={collapsed} />
        </div>
        <nav className="sidebar-scroll">
          {NAV_GROUPS.map((group) => {
            const items = group.modules.filter((m) => allowed.includes(m));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.key}>
                <div className="nav-group-title">{t(group.key)}</div>
                {items.map((key) => {
                  const Icon = MODULE_DEFS.find((m) => m.key === key)?.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pick(key)}
                      className={cn("nav-item w-full cursor-pointer text-start", active === key && "active")}
                      aria-current={active === key ? "page" : undefined}
                      title={collapsed ? t(`staff.module.${key}`) : undefined}
                    >
                      {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
                      <span className="nav-label truncate">{t(`staff.module.${key}`)}</span>
                      {key === "reception" && inboxCount > 0 && <span className="nav-badge">{inboxCount}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <span className={cn("avatar", avClassOf(staff.employeeId))} aria-hidden>{initialsOf(name)}</span>
          <span className="sf-info">
            <span className="sf-name">{name}</span>
            <span className="sf-role">{t(`staff.role.${staff.role}`)} — staff</span>
          </span>
          <button
            type="button"
            className={cn("btn btn-ghost btn-icon btn-sm shrink-0", !collapsed && "ms-auto")}
            aria-label={t("staff.shell.logout")}
            title={t("staff.shell.logout")}
            onClick={() => setStaff(null)}
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop no-print" onClick={closeSide} aria-hidden />

      <main className="app-main min-h-[calc(100dvh-3.5rem)]">
        <StaffTopbar collapsed={collapsed} onToggleCollapse={toggleCollapse} onOpenSide={openSide} inbox={inbox} inboxCount={inboxCount} />
        <div className="content">
          <Suspense
            fallback={
              <div className="grid gap-5" aria-busy="true">
                <Skeleton className="h-9 w-72" />
                <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
                <Skeleton className="h-72" />
              </div>
            }
          >
            <Module />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
