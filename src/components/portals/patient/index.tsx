"use client";
/**
 * patient.website.bh — mobile-first PWA-feel bilingual patient portal.
 * Session gate → header (name / MRN / notifications / logout) → bottom tab
 * navigation (mobile) or sidebar (desktop) → screen modules.
 */
import { useState } from "react";
import { useApp } from "@/store/app";
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut } from "lucide-react";
import LoginScreen from "./login";
import { BottomNav, SideNav, type PatientScreen } from "./nav";
import { ErrorBox, LoadingRows } from "./parts";
import { useFetch, type OverviewPayload } from "./lib";
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

export default function PatientPortal() {
  const patient = useApp((s) => s.patient);
  const { t, lang } = useI18n();
  const [screen, setScreen] = useState<PatientScreen>("overview");
  const [bookSignal, setBookSignal] = useState(0);

  const overview = useFetch<OverviewPayload | null>(
    () => (patient ? apiGet<OverviewPayload>("/api/patient/overview") : Promise.resolve(null)),
    [patient?.patientId],
  );

  if (!patient) return <LoginScreen />;

  const unread = overview.data?.unreadNotifications ?? 0;
  const navigate = (s: PatientScreen, opts?: { book?: boolean }) => {
    setScreen(s);
    if (opts?.book) setBookSignal((n) => n + 1);
    window.scrollTo({ top: 0 });
  };
  const logout = () => {
    useApp.getState().setPatient(null);
    setScreen("overview");
  };

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <Avatar className="size-9" aria-hidden>
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {bi(lang, patient.nameAr, patient.nameEn).trim().charAt(0) || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{bi(lang, patient.nameAr, patient.nameEn)}</p>
            <Badge variant="outline" className="mt-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">{patient.mrn}</Badge>
          </div>
          <Button variant="ghost" size="icon" className="relative size-11" onClick={() => navigate("messages")} aria-label={t("pp.msg.notifications")}>
            <Bell className="size-5" aria-hidden />
            {unread ? <span className="absolute end-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
          </Button>
          <Button variant="ghost" size="icon" className="size-11 text-destructive" onClick={logout} aria-label={t("shell.logout")}>
            <LogOut className="size-5" aria-hidden />
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-0 py-0 md:px-4 md:py-4">
        <SideNav screen={screen} unread={unread} onNavigate={navigate} />
        <main id="patient-screen" className="min-w-0 flex-1 pb-6 md:pe-2 md:ps-0">
          <div className="px-4 pt-4 md:px-0 md:pt-0">
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
          </div>
        </main>
      </div>

      <BottomNav screen={screen} unread={unread} onNavigate={navigate} />
    </div>
  );
}
