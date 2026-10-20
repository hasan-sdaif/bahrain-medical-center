"use client";
/** Hero — teal gradient, CTAs, emergency strip, working hours (no external images). */
import { CalendarPlus, ClipboardList, Clock, PhoneCall, Siren, Stethoscope, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { usePublicData } from "../data";
import { useBooking } from "./booking";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-4 text-center backdrop-blur-sm border border-white/15">
      <div className="text-2xl md:text-3xl font-bold tabular-nums" dir="ltr">{value}</div>
      <div className="mt-1 text-[11px] md:text-xs text-white/80 leading-snug">{label}</div>
    </div>
  );
}

export function Hero() {
  const { t } = useI18n();
  const { data } = usePublicData();
  const setDomain = useApp((s) => s.setDomain);
  const openBooking = useBooking((c) => c.openBooking);

  return (
    <section id="top" className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-600 to-emerald-700 text-white">
      {/* decorative gradient orbs */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -start-24 size-96 rounded-full bg-emerald-300/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -end-16 size-[28rem] rounded-full bg-cyan-300/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-10 end-1/4 size-24 rounded-full border-[3px] border-white/10" />
      <div aria-hidden className="pointer-events-none absolute bottom-16 start-1/3 size-10 rounded-full bg-white/10" />

      <div className="relative mx-auto max-w-[1600px] px-4 md:px-6 py-12 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] items-center">
          <div className="text-center lg:text-start">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-xs md:text-sm backdrop-blur-sm">
              <Stethoscope className="size-4" aria-hidden /> {t("public.hero.badge")}
            </span>
            <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-bold leading-tight tracking-tight">
              {t("public.hero.title1")}
              <span className="block bg-gradient-to-l from-emerald-200 to-cyan-100 bg-clip-text text-transparent">
                {t("public.hero.title2")}
              </span>
            </h1>
            <p className="mx-auto lg:mx-0 mt-4 max-w-2xl text-sm md:text-base text-white/85 leading-relaxed">
              {t("public.hero.subtitle")}
            </p>

            <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-3">
              <Button size="lg" onClick={() => openBooking()} className="h-12 px-6 bg-white text-teal-800 hover:bg-white/90 shadow-lg shadow-teal-900/30">
                <CalendarPlus aria-hidden /> {t("public.hero.cta.book")}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setDomain("patient")} className="h-12 px-6 bg-white/15 text-white hover:bg-white/25 border border-white/25 backdrop-blur-sm">
                <ClipboardList aria-hidden /> {t("public.hero.cta.results")}
              </Button>
              <Button size="lg" variant="secondary" onClick={() => document.getElementById("homecare")?.scrollIntoView({ behavior: "smooth" })} className="h-12 px-6 bg-white/15 text-white hover:bg-white/25 border border-white/25 backdrop-blur-sm">
                <Syringe aria-hidden /> {t("public.hero.cta.home")}
              </Button>
            </div>
          </div>

          {/* working-hours glass card */}
          <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md p-5 md:p-6 shadow-xl shadow-teal-900/20">
            <div className="flex items-center gap-2 mb-4">
              <span className="grid size-9 place-items-center rounded-lg bg-white/15"><Clock className="size-5" aria-hidden /></span>
              <h2 className="font-semibold">{t("public.hero.hours.title")}</h2>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                [t("public.hero.hours.weekdays"), t("public.hero.hours.weekdays.val")],
                [t("public.hero.hours.fri"), t("public.hero.hours.fri.val")],
                [t("public.hero.hours.sat"), t("public.hero.hours.sat.val")],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                  <dt className="text-white/80">{k}</dt>
                  <dd className="font-medium tabular-nums" dir="ltr">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto lg:mx-0">
          <Stat value={String(data.departments.length || 10)} label={t("public.hero.stat.depts")} />
          <Stat value={String(data.doctors.filter((d) => d.deptCode).length || 12)} label={t("public.hero.stat.doctors")} />
          <Stat value="4" label={t("public.hero.stat.zones")} />
          <Stat value="24" label={t("public.hero.stat.hours")} />
        </div>
      </div>

      {/* emergency strip */}
      <div className="relative bg-red-600/95 text-white">
        <div className="mx-auto max-w-[1600px] px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-center md:justify-between gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Siren className="size-4 animate-pulse" aria-hidden /> {t("public.hero.emergency")} <a href="tel:999" dir="ltr" className="font-bold tracking-widest underline underline-offset-4 hover:text-white/90">999</a>
          </span>
          <span className="flex items-center gap-2">
            <PhoneCall className="size-4" aria-hidden /> {t("public.hero.reception")} <a href="tel:+97317500000" dir="ltr" className="font-mono font-bold tracking-wider hover:text-white/90">+973 1750 0000</a>
          </span>
        </div>
      </div>
    </section>
  );
}
