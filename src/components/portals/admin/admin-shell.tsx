"use client";
/**
 * Admin console shell — Shamel guide staff-app pattern (03-layout.css):
 * fixed `.sidebar` (brand, nav-items with lucide icons + active rail,
 * sidebar-foot user) below the sandbox bars (top-24), off-canvas < 1181px via
 * body.side-open + backdrop; `.topbar` (subdomain chip, BH clock chip,
 * lang/theme) and `.app-main > .content` with a `.page-head` per section.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Languages, LogOut, Menu, Moon, Sun, type LucideIcon } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { useApp } from "@/store/app";
import { ShamelAccent, ShamelBrand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  key: string;
  icon: LucideIcon;
  label: string;
  limited?: boolean;
}

export function AdminShell({
  nav, active, onNavigate, onLogout, titleIcon: TitleIcon, title, sub, children,
}: {
  nav: AdminNavItem[];
  active: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  titleIcon: LucideIcon;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const staff = useApp((s) => s.staff);
  const [sideOpen, setSideOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    document.body.classList.toggle("side-open", sideOpen);
    return () => document.body.classList.remove("side-open");
  }, [sideOpen]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const clock = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Bahrain", weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);

  const name = staff ? bi(lang, staff.nameAr, staff.nameEn) : "";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join(" ");

  return (
    <>
      <ShamelAccent />
      <nav aria-label={t("admin.header.title")} className="sidebar top-24" id="admin-sidebar">
        <div className="sidebar-brand">
          <ShamelBrand name={t("shell.app.name")} sub={t("admin.brand.sub")} />
        </div>
        <div className="sidebar-scroll">
          <div className="nav-group">
            <div className="nav-group-title">{t("admin.nav.group")}</div>
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn("nav-item", isActive && "active")}
                  onClick={() => onNavigate(item.key)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="nav-label">{item.label}</span>
                  {item.limited && <span className="nav-badge">{t("admin.tab.limited")}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sidebar-foot">
          <span className="avatar av-2" aria-hidden>{initials}</span>
          <div className="sf-info">
            <div className="sf-name">{name}</div>
            <div className="sf-role">{staff ? t(`staff.role.${staff.role}`) : ""}</div>
          </div>
          <Button
            variant="ghost" size="icon" className="ms-auto size-11 shrink-0"
            onClick={onLogout} aria-label={t("shell.logout")}
          >
            <LogOut className="size-5" aria-hidden />
          </Button>
        </div>
      </nav>
      <div className="sidebar-backdrop" onClick={() => setSideOpen(false)} aria-hidden />

      <div className="app-main">
        <header className="topbar top-24">
          <Button
            variant="ghost" size="icon" className="size-11 max-[1180px]:inline-flex min-[1181px]:hidden"
            onClick={() => setSideOpen(true)} aria-label={t("admin.shell.menu")} aria-expanded={sideOpen}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <span className="subdomain-chip"><span className="dot" aria-hidden />admin.website.bh</span>
          <span className="clock-chip" dir="ltr">{clock}</span>
          <div className="topbar-actions">
            <Button
              variant="ghost" size="icon" className="size-11"
              onClick={() => useApp.getState().setLang(lang === "ar" ? "en" : "ar")}
              aria-label="English / العربية"
            >
              <Languages className="size-5" aria-hidden />
            </Button>
            <Button
              variant="ghost" size="icon" className="size-11"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? t("shell.theme.light") : t("shell.theme.dark")}
            >
              {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
            </Button>
          </div>
        </header>

        <main className="content">
          <div className="page-head">
            <div className="page-head-row">
              <div className="page-title-wrap">
                <span className="page-title-ic"><TitleIcon className="size-7" aria-hidden /></span>
                <div>
                  <h1>{title}</h1>
                  <p className="page-sub">{sub}</p>
                </div>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
    </>
  );
}
