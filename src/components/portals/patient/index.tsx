"use client";
/**
 * patient.website.bh — Shamel guide app-shell: fixed `.sidebar` (off-canvas
 * below 1180px via body.side-open + `.sidebar-backdrop`), sticky `.topbar`
 * (subdomain chip, live UTC+3 clock, language/theme quick toggles, bell) and
 * `.app-main > .content` hosting the screen modules. `<ShamelAccent/>` pins
 * data-accent="patient" so the teal token set colors this workspace.
 */
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useApp } from "@/store/app";
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ShamelAccent } from "@/components/shell/brand";
import { Bell, Languages, Menu, Moon, PanelLeftClose, Sun } from "lucide-react";
import LoginScreen from "./login";
import { SideNav, type PatientScreen } from "./nav";
import { ErrorBox, LoadingRows } from "./parts";
import { useFetch, type OverviewPayload } from "./lib";
import "./shamel-scope.css";
import OverviewScreen from "./screen-overview";
import AppointmentsScreen from "./screen-appointments";
import ResultsScreen from "./screen-results";
import PrescriptionsScreen from "./screen-prescriptions";
import InvoicesScreen from "./screen-invoices";
import ConsentsScreen from "./screen-consents";
import DocumentsScreen from "./screen-documents";
import MessagesScreen from "./screen-messages";
import FamilyScreen from "./screen-family";
import HomeDrawScreen from "./screen-homedraw";
import PrivacyScreen from "./screen-privacy";

/** Live Bahrain clock (UTC+3) for the topbar chip. */
function useBhClock(lang: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en-GB", {
    timeZone: "Asia/Bahrain", weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
}

export default function PatientPortal() {
  const patient = useApp((s) => s.patient);
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [screen, setScreen] = useState<PatientScreen>("overview");
  const [bookSignal, setBookSignal] = useState(0);
  const [sideOpen, setSideOpen] = useState(false); // mobile off-canvas
  const [sideCollapsed, setSideCollapsed] = useState(false); // desktop rail
  const clock = useBhClock(lang);

  const overview = useFetch<OverviewPayload | null>(
    () => (patient ? apiGet<OverviewPayload>("/api/patient/overview") : Promise.resolve(null)),
    [patient?.patientId],
  );

  // body-level classes drive the guide CSS (03-layout responsive rules)
  useEffect(() => {
    document.body.classList.toggle("side-open", sideOpen);
    return () => document.body.classList.remove("side-open");
  }, [sideOpen]);
  useEffect(() => {
    document.body.classList.toggle("side-collapsed", sideCollapsed);
    return () => document.body.classList.remove("side-collapsed");
  }, [sideCollapsed]);

  if (!patient) {
    return (
      <div className="smc">
        <ShamelAccent />
        <LoginScreen />
      </div>
    );
  }

  const unread = overview.data?.unreadNotifications ?? 0;
  const dueInvoices = overview.data?.dueInvoices?.length ?? 0;
  const navigate = (s: PatientScreen, opts?: { book?: boolean }) => {
    setScreen(s);
    setSideOpen(false);
    if (opts?.book) setBookSignal((n) => n + 1);
    window.scrollTo({ top: 0 });
  };
  const logout = () => {
    useApp.getState().setPatient(null);
    setScreen("overview");
  };

  return (
    <div className="smc">
      <ShamelAccent />
      <SideNav
        screen={screen} unread={unread} dueInvoices={dueInvoices}
        patient={{ nameAr: patient.nameAr, nameEn: patient.nameEn, mrn: patient.mrn }}
        onNavigate={navigate} onLogout={logout}
      />
      <div className="sidebar-backdrop" onClick={() => setSideOpen(false)} aria-hidden />

      <div className="app-main">
        <header className="topbar top-24">
          <Button
            variant="ghost" size="icon" className="size-11 max-[1180px]:inline-flex min-[1181px]:hidden"
            onClick={() => setSideOpen(true)} aria-label={t("pp.shell.menu")} aria-expanded={sideOpen}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <Button
            variant="ghost" size="icon" className="side-collapse-btn size-11"
            onClick={() => setSideCollapsed((v) => !v)} aria-label={t("pp.shell.collapse")}
          >
            <PanelLeftClose className="size-5" aria-hidden />
          </Button>
          <span className="subdomain-chip"><span className="dot" aria-hidden />patient.website.bh</span>
          <span className="clock-chip" dir="ltr">{clock}</span>
          <div className="topbar-actions">
            <Button variant="ghost" size="icon" className="relative size-11" onClick={() => navigate("messages")} aria-label={t("pp.shell.notifications")}>
              <Bell className="size-5" aria-hidden />
              {unread ? (
                <span className="nav-badge absolute end-1.5 top-1.5 min-w-[18px] px-[5px] py-px text-[10px] leading-4">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Button>
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

        <main id="patient-screen" className="content">
          {screen === "overview" ? (
            overview.loading ? <LoadingRows n={4} /> :
              overview.error ? <ErrorBox error={overview.error} onRetry={overview.reload} /> :
                <OverviewScreen data={overview.data} reload={overview.reload} navigate={navigate} />
          ) : null}
          {screen === "appointments" ? <AppointmentsScreen bookSignal={bookSignal} /> : null}
          {screen === "results" ? <ResultsScreen /> : null}
          {screen === "prescriptions" ? <PrescriptionsScreen /> : null}
          {screen === "invoices" ? <InvoicesScreen /> : null}
          {screen === "consents" ? <ConsentsScreen /> : null}
          {screen === "documents" ? <DocumentsScreen /> : null}
          {screen === "messages" ? <MessagesScreen /> : null}
          {screen === "family" ? <FamilyScreen /> : null}
          {screen === "homedraw" ? <HomeDrawScreen /> : null}
          {screen === "privacy" ? <PrivacyScreen /> : null}
        </main>
      </div>
      <span className="sr-only" aria-live="polite">{bi(lang, patient.nameAr, patient.nameEn)}</span>
    </div>
  );
}
