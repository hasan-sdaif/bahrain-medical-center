"use client";
"use client";
/**
 * / — the single user-visible route. A "system of systems": each domain
 * (website.bh, patient.website.bh, staff.website.bh, admin.website.bh,
 * kiosk.website.bh, queue.website.bh, verify.website.bh) renders an isolated
 * portal module against its own API namespace (spec §2/§4.2, merged.md).
 */
import { Suspense, lazy } from "react";
import { useApp } from "@/store/app";
import { I18nProvider, useI18n } from "@/i18n";
import { DomainBar } from "@/components/shell/domain-bar";
import { LanguageAndTheme } from "@/components/shell/lang-theme";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const PublicPortal = lazy(() => import("@/components/portals/public"));
const PatientPortal = lazy(() => import("@/components/portals/patient"));
const StaffPortal = lazy(() => import("@/components/portals/staff"));
const AdminPortal = lazy(() => import("@/components/portals/admin"));
const KioskPortal = lazy(() => import("@/components/portals/kiosk"));
const QueuePortal = lazy(() => import("@/components/portals/queue"));
const VerifyPortal = lazy(() => import("@/components/portals/verify"));

function PortalFallback() {
  return (
    <div className="p-6 grid gap-4 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40" />
      <div className="grid md:grid-cols-3 gap-4">
        <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
      </div>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="no-print mt-auto border-t bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} {t("shell.app.name")} — {t("shell.footer.rights")}</span>
        <span>{t("shell.footer.license")}</span>
        <span dir="ltr" className="font-mono">+973 1750 0000 · emergencies 999</span>
        <span className="ms-auto">{t("shell.sim.note")}</span>
      </div>
    </footer>
  );
}

function ShellInner() {
  const { domain } = useApp();
  const Portal =
    domain === "patient" ? PatientPortal
      : domain === "staff" ? StaffPortal
        : domain === "admin" ? AdminPortal
          : domain === "kiosk" ? KioskPortal
            : domain === "queue" ? QueuePortal
              : domain === "verify" ? VerifyPortal
                : PublicPortal;
  return (
    <div className="min-h-dvh flex flex-col">
      <DomainBar />
      <LanguageAndTheme />
      <main className="flex-1 w-full" id="main">
        <Suspense fallback={<PortalFallback />}>
          <Portal />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function Page() {
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <div className={cn("contents")}>
        <ShellInner />
      </div>
    </I18nProvider>
  );
}
