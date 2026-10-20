"use client";
/**
 * Patient portal navigation — Shamel guide app-shell sidebar (03-layout):
 * `.sidebar` with `.sidebar-brand`, nav-groups (رعايتی / الخدمات / الحساب)
 * `.nav-item`s with lucide icons + active state + `.nav-badge`s, and a
 * `.sidebar-foot` with the patient name/MRN + logout. Below 1180px the CSS
 * turns it into an off-canvas drawer driven by `body.side-open` (see index).
 */
import { useI18n, bi } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ShamelBrand } from "@/components/shell/brand";
import {
  CalendarDays, FileSignature, FileText, FlaskConical, LayoutDashboard,
  LogOut, MessageSquare, Pill, Receipt, ShieldCheck, Syringe, Users, type LucideIcon,
} from "lucide-react";

export type PatientScreen =
  | "overview" | "appointments" | "results" | "prescriptions" | "invoices"
  | "consents" | "documents" | "messages" | "family" | "homedraw" | "privacy";

export interface NavItem { key: PatientScreen; icon: LucideIcon; labelKey: string }
export interface NavGroup { titleKey: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "pp.nav.group.care",
    items: [
      { key: "overview", icon: LayoutDashboard, labelKey: "pp.nav.overview" },
      { key: "appointments", icon: CalendarDays, labelKey: "pp.nav.appointments" },
      { key: "results", icon: FlaskConical, labelKey: "pp.nav.results" },
      { key: "prescriptions", icon: Pill, labelKey: "pp.nav.prescriptions" },
      { key: "documents", icon: FileText, labelKey: "pp.nav.documents" },
      { key: "consents", icon: FileSignature, labelKey: "pp.nav.consents" },
    ],
  },
  {
    titleKey: "pp.nav.group.services",
    items: [
      { key: "invoices", icon: Receipt, labelKey: "pp.nav.invoices" },
      { key: "messages", icon: MessageSquare, labelKey: "pp.nav.messages" },
      { key: "homedraw", icon: Syringe, labelKey: "pp.nav.homedraw" },
      { key: "family", icon: Users, labelKey: "pp.nav.family" },
    ],
  },
  {
    titleKey: "pp.nav.group.account",
    items: [{ key: "privacy", icon: ShieldCheck, labelKey: "pp.nav.privacy" }],
  },
];

export function SideNav({
  screen, unread, dueInvoices, patient, onNavigate, onLogout,
}: {
  screen: PatientScreen;
  unread: number;
  dueInvoices: number;
  patient: { nameAr: string; nameEn: string; mrn: string };
  onNavigate: (s: PatientScreen) => void;
  onLogout: () => void;
}) {
  const { t, lang } = useI18n();
  const name = bi(lang, patient.nameAr, patient.nameEn);
  return (
    <nav aria-label={t("shell.domain.patient")} className="sidebar top-24" id="patient-sidebar">
      <div className="sidebar-brand">
        <ShamelBrand name={t("pp.brand.name")} sub={t("pp.brand.sub")} />
      </div>
      <div className="sidebar-scroll">
        {NAV_GROUPS.map((g) => (
          <div className="nav-group" key={g.titleKey}>
            <div className="nav-group-title">{t(g.titleKey)}</div>
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = screen === item.key;
              const badge =
                item.key === "messages" ? unread :
                item.key === "invoices" ? dueInvoices : 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn("nav-item w-full min-h-11 text-start", active && "active")}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="nav-label truncate">{t(item.labelKey)}</span>
                  {badge ? (
                    <span className={cn("nav-badge", item.key === "invoices" && "b-teal")}
                      aria-label={`${badge} ${t("pp.unread.badge")}`}>{badge > 9 ? "9+" : badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="sidebar-foot">
        <span className="avatar av-2" aria-hidden>{name.trim().charAt(0) || "P"}</span>
        <span className="sf-info min-w-0">
          <span className="sf-name block">{name}</span>
          <span className="sf-role mono" dir="ltr">{t("pp.shell.mrn")} {patient.mrn}</span>
        </span>
        <Button
          variant="ghost" size="icon" className="ms-auto size-11 shrink-0 text-destructive"
          onClick={onLogout} aria-label={t("shell.logout")}
        >
          <LogOut className="size-5" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
