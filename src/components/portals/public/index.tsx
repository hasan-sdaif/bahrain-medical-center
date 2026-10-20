"use client";
/**
 * website.bh — the public marketing portal, restyled to the Shamel Medical
 * Center guide (agent 2-a): site-top + sticky site-header with mega nav,
 * anchor sub-nav, hero, departments, services & packages, doctors, booking
 * CTA, home draw, articles, FAQ + insurers, contact, AI assistant, and the
 * navy site-footer. Functionality (API calls, i18n, booking, AI, contact)
 * is unchanged — this is a visual re-skin only. The root carries `pubshell`
 * which scopes shamel-patch.css (see that file for why it exists).
 */
import "./shamel-patch.css";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ShamelAccent } from "@/components/shell/brand";
import { PublicDataProvider, usePublicData } from "./data";
import { SiteHeader } from "./site-header";
import { SubNav } from "./subnav";
import { Hero } from "./sections/hero";
import { Departments } from "./sections/departments";
import { ServicesSection } from "./sections/services";
import { Doctors } from "./sections/doctors";
import { BookingDialog, BookingSection } from "./sections/booking";
import { Homecare } from "./sections/homecare";
import { Articles } from "./sections/articles";
import { Faq } from "./sections/faq";
import { Contact } from "./sections/contact";
import { SiteFooter } from "./sections/site-footer";
import { AiAssistant } from "./sections/ai-assistant";

function PublicSite() {
  const { t } = useI18n();
  const { error, reload } = usePublicData();
  return (
    <div className="pubshell flex min-h-dvh flex-col">
      <SiteHeader />
      <SubNav />
      <div className="flex-1">
        <Hero />
        <Departments />
        <ServicesSection />
        <Doctors />
        <BookingSection />
        <Homecare />
        <Articles />
        <Faq />
        <Contact />
      </div>
      <SiteFooter />
      <BookingDialog />
      <AiAssistant />
      {error && (
        <div className="no-print fixed bottom-5 start-5 z-50 max-w-xs rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive" role="alert">
          <p className="text-sm">{t("public.load.error")}</p>
          <Button variant="outline" size="sm" className="mt-2 h-8" onClick={reload}>{t("common.retry")}</Button>
        </div>
      )}
    </div>
  );
}

export default function PublicPortal() {
  return (
    <PublicDataProvider>
      <ShamelAccent />
      <PublicSite />
    </PublicDataProvider>
  );
}
