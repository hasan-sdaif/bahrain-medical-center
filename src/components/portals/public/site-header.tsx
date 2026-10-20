"use client";
/**
 * Public site header (Shamel guide `public/home.html`): navy `.site-top` info
 * strip (phone / hours / quick links / patient portal / language), sticky
 * blurred `.site-header` with the Shamel mark, `.main-nav` (departments mega
 * drop fed from the live catalog, "the center" drop, contact), `.header-cta`
 * (booking + patient portal) and the mobile `.burger` (body.nav-open pattern).
 */
import { useEffect, useState } from "react";
import {
  CalendarPlus, ChevronDown, Clock, Info, Languages, LayoutGrid, Menu, Newspaper,
  Phone, UserRound, Briefcase, ShieldCheck, X,
} from "lucide-react";
import { ShamelMark } from "@/components/shell/brand";
import { bi, useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";
import { deptIcon, usePublicData } from "./data";
import { useBooking } from "./sections/booking";

function SiteTop() {
  const { t, lang, setLang } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  const link = "inline-flex items-center gap-1.5 font-semibold text-white/85 transition-colors hover:text-white";
  return (
    <div className="site-top no-print">
      <div className="site-top-inner">
        <a href="tel:+97317500000" className={cn("st-item", link)} dir="ltr">
          <Phone className="size-[15px] shrink-0" aria-hidden /> +973 1750 0000
        </a>
        <span className="st-item hidden sm:inline-flex">
          <Clock className="size-[15px] shrink-0" aria-hidden /> {t("public.top.hours")}
        </span>
        <div className="st-links">
          <a href="#booking" className={cn(link, "hidden md:inline-flex")}>{t("public.top.appointments")}</a>
          <a href="#services" className={cn(link, "hidden md:inline-flex")}>{t("public.top.prices")}</a>
          <a href="#contact" className={cn(link, "hidden lg:inline-flex")}>{t("public.nav.contact")}</a>
          <button
            onClick={() => setDomain("patient")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-0.5 font-semibold text-white transition-colors hover:bg-white/20"
          >
            <UserRound className="size-3.5" aria-hidden /> {t("public.nav.portal")}
          </button>
          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            aria-label="switch language"
            className={link}
          >
            <Languages className="size-3.5 shrink-0" aria-hidden /> {t("shell.session.lang")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Departments mega drop — the 10 live departments from the catalog. */
function DeptMega({ onNavigate }: { onNavigate: () => void }) {
  const { t, lang } = useI18n();
  const { data } = usePublicData();
  return (
    <div className="drop mega">
      <div className="drop-title">{t("public.nav.depts.mega.title")}</div>
      <div className="drop-cols">
        {data.departments.map((d) => {
          const Icon = deptIcon(d.icon);
          return (
            <a key={d.code} href="#departments" onClick={onNavigate} className="drop-item">
              <span className="di-ic"><Icon className="size-4" aria-hidden /></span>
              {bi(lang, d.nameAr, d.nameEn)}
            </a>
          );
        })}
      </div>
      <div aria-hidden className="my-2 h-px bg-border" />
      <a
        href="#departments" onClick={onNavigate}
        className="drop-item justify-center font-bold text-primary"
      >
        <LayoutGrid className="size-4" aria-hidden /> {t("public.nav.depts.all")}
      </a>
    </div>
  );
}

const CENTER_LINKS = [
  { href: "#top", key: "public.nav.center.about", Icon: Info },
  { href: "#articles", key: "public.nav.center.news", Icon: Newspaper },
  { href: "#contact", key: "public.nav.center.careers", Icon: Briefcase },
  { href: "#faq", key: "public.nav.center.policies", Icon: ShieldCheck },
];

function MainNav({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useI18n();
  return (
    <nav className="main-nav" aria-label={t("shell.domains.label")}>
      <a href="#top" onClick={onNavigate} className="nav-link active">
        {t("public.nav.home")}
      </a>
      <div className="has-drop [&:focus-within_.drop]:visible [&:focus-within_.drop]:opacity-100">
        <a href="#departments" onClick={onNavigate} className="nav-link" aria-haspopup="true">
          {t("public.nav.departments")}
          <ChevronDown className="caret size-3.5" aria-hidden />
        </a>
        <DeptMega onNavigate={onNavigate} />
      </div>
      <a href="#doctors" onClick={onNavigate} className="nav-link">{t("public.nav.doctors")}</a>
      <div className="has-drop [&:focus-within_.drop]:visible [&:focus-within_.drop]:opacity-100">
        <a href="#top" onClick={onNavigate} className="nav-link" aria-haspopup="true">
          {t("public.nav.center")}
          <ChevronDown className="caret size-3.5" aria-hidden />
        </a>
        <div className="drop">
          {CENTER_LINKS.map(({ href, key, Icon }) => (
            <a key={key} href={href} onClick={onNavigate} className="drop-item">
              <span className="di-ic"><Icon className="size-4" aria-hidden /></span>
              {t(key)}
            </a>
          ))}
        </div>
      </div>
      <a href="#contact" onClick={onNavigate} className="nav-link">{t("public.nav.contact")}</a>
    </nav>
  );
}

export function SiteHeader() {
  const { t } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  const openBooking = useBooking((c) => c.openBooking);
  const [open, setOpen] = useState(false);

  // guide pattern: body.nav-open reveals .main-nav as a panel below the header
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  const navigate = () => setOpen(false);

  return (
    <>
      <SiteTop />
      <header className="site-header no-print top-11 z-40">
        <div className="site-header-inner">
          <a href="#top" className="site-logo" aria-label={t("shell.app.name")}>
            <ShamelMark size={46} />
            <span className="min-w-0">
              <span className="sl-name">{t("shell.app.name")}</span>
              <span className="sl-sub hidden sm:block">SHAMEL MEDICAL CENTER · BAHRAIN</span>
            </span>
          </a>

          <MainNav onNavigate={navigate} />

          <div className="header-cta">
            <button
              onClick={() => { navigate(); openBooking(); }}
              className="btn btn-soft h-10 px-3.5 text-sm sm:h-11 sm:px-5"
            >
              <CalendarPlus className="size-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t("public.hero.cta.book")}</span>
            </button>
            <button
              onClick={() => setDomain("patient")}
              className="btn btn-ghost hidden h-11 px-4 text-sm lg:inline-flex"
            >
              <UserRound className="size-4 shrink-0" aria-hidden />
              {t("public.nav.portal")}
            </button>
          </div>

          <button
            className="burger"
            aria-label={t("public.nav.menu")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </header>
    </>
  );
}
