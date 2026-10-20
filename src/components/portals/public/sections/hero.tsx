"use client";
/** Hero — Shamel guide pattern: .hero + .hero-pattern, NHRA .h-eyebrow, big
 *  bilingual title, .lead, .hero-actions (gold booking / white record), the
 *  .hero-stats row and the grad-red .hero-strip emergency bar. */
import { BadgeCheck, CalendarPlus, ClipboardList, PhoneCall, Siren } from "lucide-react";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { usePublicData } from "../data";
import { useBooking } from "./booking";

export function Hero() {
  const { t } = useI18n();
  const { data } = usePublicData();
  const setDomain = useApp((s) => s.setDomain);
  const openBooking = useBooking((c) => c.openBooking);

  const stats: { num: string; lbl: string }[] = [
    { num: String(data.departments.length || 10), lbl: t("public.hero.stat.depts") },
    { num: "40+", lbl: t("public.hero.stat.doctors") },
    { num: "24/7", lbl: t("public.hero.stat.service") },
    { num: "120K+", lbl: t("public.hero.stat.visits") },
  ];

  return (
    <section id="top" className="hero">
      <div className="hero-pattern" aria-hidden />
      <div className="hero-inner">
        <span className="h-eyebrow">
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          {t("public.hero.nhra")}
        </span>

        <h1 className="text-balance">
          {t("public.hero.title1")}
          <span className="block">{t("public.hero.title2")}</span>
        </h1>

        <p className="lead">{t("public.hero.subtitle")}</p>

        <div className="hero-actions">
          <button className="btn btn-gold btn-lg" onClick={() => openBooking()}>
            <CalendarPlus className="size-[18px]" aria-hidden />
            {t("public.hero.cta.book")}
          </button>
          <button className="btn btn-white btn-lg" onClick={() => setDomain("patient")}>
            <ClipboardList className="size-[18px]" aria-hidden />
            {t("public.hero.cta.record")}
          </button>
        </div>

        <div className="hero-stats">
          {stats.map((s) => (
            <div key={s.lbl} className="hs-item">
              <div className="hs-num">{s.num}</div>
              <div className="hs-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-strip">
        <div className="hero-strip-inner">
          <span className="flex items-center gap-2">
            <Siren className="size-4 animate-pulse" aria-hidden />
            {t("public.hero.emergency")}
            <a href="tel:999" className="hs-num hover:opacity-90">999</a>
          </span>
          <span className="flex items-center gap-2">
            <PhoneCall className="size-4" aria-hidden />
            {t("public.hero.reception")}
            <a href="tel:+97317500000" dir="ltr" className="num font-extrabold tracking-wider hover:opacity-90">
              +973 1750 0000
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
