"use client";
/**
 * admin.website.bh — admin & compliance console in the Shamel staff-shell
 * (sidebar nav per section + topbar + page-head). Role gate: sysadmin,
 * auditor, dpo, med-director, center-manager (server enforces the rest —
 * 403s surface as problem+json cards). Login → 5 sections, lazy-loaded.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { ShamelAccent } from "@/components/shell/brand";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HeartPulse, LockKeyhole, ScrollText, Settings2, ShieldCheck, TriangleAlert, UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AdminShell } from "./admin-shell";
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

const TAB_ICONS: Record<TabKey, LucideIcon> = {
  health: HeartPulse, audit: ScrollText, settings: Settings2, access: UsersRound, security: ShieldCheck,
};
const TAB_SUBS: Record<TabKey, string> = {
  health: "admin.health.sub", audit: "admin.audit.sub", settings: "admin.settings.sub",
  access: "admin.access.sub", security: "admin.security.sub",
};

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
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <ShamelAccent />
      <div className="page-head">
        <div className="page-head-row">
          <div className="page-title-wrap">
            <span className="page-title-ic"><LockKeyhole className="size-7" aria-hidden /></span>
            <div>
              <h1>{t("admin.login.title")}</h1>
              <p className="page-sub">{t("admin.login.note")}</p>
            </div>
          </div>
        </div>
      </div>

      {deniedRole && (
        <div role="alert" className="alert alert-danger mb-4">
          <span className="al-ic"><TriangleAlert className="size-5" aria-hidden /></span>
          <div><p className="al-title">{t("common.error")}</p>{t("admin.login.denied", { role: deniedRole })}</div>
        </div>
      )}

      {!options ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : options.length === 0 ? (
        <p className="text-sm text-ink-3">{t("admin.login.empty")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {grouped.map(([role, list], gi) => (
            <div key={role} className="card p-0">
              <div className="card-head">
                <span className="ch-title">
                  <span className="ch-ic"><ShieldCheck className="size-4" aria-hidden /></span>
                  {t(`staff.role.${role}`)}
                  <span className="mono text-[10px] text-ink-3">{role}</span>
                </span>
              </div>
              <div className="list-group">
                {list.map((o, oi) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={busy === o.id}
                    onClick={() => {
                      setBusy(o.id);
                      setStaff({ employeeId: o.id, role: o.role, nameAr: o.nameAr, nameEn: o.nameEn, departmentId: null });
                    }}
                    className="list-item w-full min-h-11 cursor-pointer text-start disabled:opacity-50"
                  >
                    <span className={`avatar a-sm av-${(gi + oi) % 10 + 1}`} aria-hidden>
                      {bi(lang, o.nameAr, o.nameEn).split(" ").slice(0, 2).map((w) => w[0]).join("")}
                    </span>
                    <span className="li-body">
                      <span className="li-title">{bi(lang, o.nameAr, o.nameEn)}</span>
                      <span className="li-sub mono">{o.deptCode ?? "—"}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPortal() {
  const { staff } = useApp();
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>("health");
  if (!staff || !ADMIN_ROLES.includes(staff.role)) return <AdminLogin deniedRole={staff?.role} />;

  const limited = (k: TabKey) => {
    const roles = TAB_ROLES[k];
    return !!roles && !roles.includes(staff.role);
  };
  const Panel = (k: TabKey) =>
    k === "health" ? <Health /> : k === "audit" ? <Audit /> : k === "settings" ? <Settings /> : k === "access" ? <Access /> : <Security />;

  const nav = TABS.map((k) => ({ key: k, icon: TAB_ICONS[k], label: t(`admin.tab.${k}`), limited: limited(k) }));

  return (
    <AdminShell
      nav={nav}
      active={tab}
      onNavigate={(k) => { setTab(k as TabKey); window.scrollTo({ top: 0 }); }}
      onLogout={() => { useApp.getState().setStaff(null); setTab("health"); }}
      titleIcon={TAB_ICONS[tab]}
      title={t(`admin.tab.${tab}`)}
      sub={t(TAB_SUBS[tab])}
    >
      <Suspense
        fallback={(
          <div className="grid gap-4">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}
      >
        {Panel(tab)}
      </Suspense>
    </AdminShell>
  );
}
