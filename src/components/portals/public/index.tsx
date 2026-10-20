"use client";
/**
 * website.bh — public marketing site + guest booking (agent 2-a sections,
 * composed by orchestrator): sticky anchor sub-nav, hero, departments,
 * services, doctors, booking CTA, homecare, articles, FAQ + insurers,
 * contact + careers, AI assistant, and a pre-footer info strip.
 */
import { useEffect, useState } from "react";
import { ArrowUp, Building2, Clock, ExternalLink, MapPin, Phone } from "lucide-react";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PublicDataProvider, usePublicData } from "./data";
import { Hero } from "./sections/hero";
import { Departments } from "./sections/departments";
import { ServicesSection } from "./sections/services";
import { Doctors } from "./sections/doctors";
import { BookingDialog, BookingSection } from "./sections/booking";
import { Homecare } from "./sections/homecare";
import { Articles } from "./sections/articles";
import { Faq } from "./sections/faq";
import { Contact } from "./sections/contact";
import { AiAssistant } from "./sections/ai-assistant";

const NAV = [
  { id: "departments", key: "public.nav.departments" },
  { id: "doctors", key: "public.nav.doctors" },
  { id: "services", key: "public.nav.services" },
  { id: "booking", key: "public.nav.booking" },
  { id: "homecare", key: "public.nav.homecare" },
  { id: "articles", key: "public.nav.articles" },
  { id: "faq", key: "public.nav.faq" },
  { id: "contact", key: "public.nav.contact" },
];

function SubNav() {
  const { t } = useI18n();
  const [active, setActive] = useState("top");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const n of NAV) { const el = document.getElementById(n.id); if (el) obs.observe(el); }
    return () => obs.disconnect();
  }, []);
  return (
    <nav aria-label={t("shell.domains.label")} className="no-print sticky top-14 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-3 py-1.5 md:px-6">
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors md:text-sm",
              active === n.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}>
            {t(n.key)}
          </a>
        ))}
      </div>
    </nav>
  );
}

function PreFooter() {
  const { t } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" aria-hidden />
            <h3 className="font-bold">{t("shell.app.name")}</h3>
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("public.footer.address")}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" dir="ltr">
            <Phone className="size-4 shrink-0" aria-hidden /> +973 1750 0000
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" aria-hidden /> {t("public.hero.hours.weekdays")}: 8:00 – 21:00
          </p>
        </div>
        <div>
          <h3 className="font-bold">{t("public.footer.links")}</h3>
          <div className="mt-3 grid gap-1.5">
            <Button variant="ghost" size="sm" className="h-10 justify-start gap-2" onClick={() => setDomain("patient")}>
              <ExternalLink className="size-4" aria-hidden /> {t("public.footer.links.patient")}
            </Button>
            <Button variant="ghost" size="sm" className="h-10 justify-start gap-2" onClick={() => setDomain("verify")}>
              <ExternalLink className="size-4" aria-hidden /> {t("public.footer.links.verify")}
            </Button>
            <Button variant="ghost" size="sm" className="h-10 justify-start gap-2" onClick={() => setDomain("kiosk")}>
              <ExternalLink className="size-4" aria-hidden /> {t("public.footer.links.kiosk")}
            </Button>
          </div>
        </div>
        <div className="flex items-start md:items-end md:justify-end">
          <Button variant="outline" size="sm" className="h-10 gap-2"
            onClick={() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth" })}>
            <ArrowUp className="size-4" aria-hidden /> {t("public.footer.links.top")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function PublicSite() {
  const { t } = useI18n();
  const { error, reload } = usePublicData();
  return (
    <div id="top">
      <SubNav />
      <Hero />
      <Departments />
      <ServicesSection />
      <Doctors />
      <BookingSection />
      <Homecare />
      <Articles />
      <Faq />
      <Contact />
      <PreFooter />
      <BookingDialog />
      <AiAssistant />
      {error && (
        <div className="no-print fixed bottom-5 start-5 z-50 max-w-xs rounded-xl border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive" role="alert">
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
      <PublicSite />
    </PublicDataProvider>
  );
}
