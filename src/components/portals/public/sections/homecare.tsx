"use client";
/** Home draw — 4-governorate coverage visual with per-zone fees (fils) and a
 *  CTA that routes visitors to the patient portal (requests require login). */
import { CalendarCheck2, ClipboardList, Home, MapPin, MoonStar, Syringe, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyText } from "@/components/shared/badges";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { useState } from "react";
import { Section, SectionHeader } from "../section-shell";

const ZONES: { key: string; feeFils: number; eveningFils: number }[] = [
  { key: "capital", feeFils: 3000, eveningFils: 1500 },
  { key: "muharraq", feeFils: 3500, eveningFils: 1500 },
  { key: "northern", feeFils: 4500, eveningFils: 2000 },
  { key: "southern", feeFils: 5000, eveningFils: 2000 },
];
const MIN_ORDER_FILS = 15000;

const STEPS = [
  { icon: ClipboardList, t: "public.homecare.step1", d: "public.homecare.step1.d" },
  { icon: MoonStar, t: "public.homecare.step2", d: "public.homecare.step2.d" },
  { icon: TestTube2, t: "public.homecare.step3", d: "public.homecare.step3.d" },
  { icon: CalendarCheck2, t: "public.homecare.step4", d: "public.homecare.step4.d" },
];

export function Homecare() {
  const { t } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  const [explain, setExplain] = useState(false);

  return (
    <Section id="homecare">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={Syringe} title={t("public.homecare.title")} subtitle={t("public.homecare.subtitle")} />

        <h3 className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
          <MapPin className="size-4 text-primary" aria-hidden /> {t("public.homecare.zones")}
        </h3>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {ZONES.map((z, i) => (
            <div key={z.key} className="relative overflow-hidden rounded-xl border p-5 bg-gradient-to-b from-primary/5 to-transparent">
              <span aria-hidden className="absolute -top-6 -end-6 size-24 rounded-full bg-primary/10" />
              <div className="relative flex items-center justify-between gap-2">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-mono text-muted-foreground" dir="ltr">0{i + 1}</span>
              </div>
              <h4 className="relative mt-3 font-semibold">{t(`public.homecare.zone.${z.key}`)}</h4>
              <p className="relative mt-1 text-xs text-muted-foreground leading-relaxed min-h-8">{t(`public.homecare.zone.areas.${z.key}`)}</p>
              <dl className="relative mt-3 space-y-1.5 text-sm border-t pt-3">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("public.homecare.fee")}</dt>
                  <dd className="font-semibold"><MoneyText fils={z.feeFils} /></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{t("public.homecare.evening")}</dt>
                  <dd><MoneyText fils={z.eveningFils} /></dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("public.homecare.min")}: <MoneyText fils={MIN_ORDER_FILS} />
        </p>

        <div className="mt-10">
          <h3 className="mb-4 text-center text-sm font-semibold text-muted-foreground">{t("public.homecare.how")}</h3>
          <ol className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-xl border p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><s.icon className="size-4.5" aria-hidden /></span>
                  <span className="text-xs font-mono text-muted-foreground" dir="ltr">{i + 1}/4</span>
                </div>
                <h4 className="mt-3 font-semibold text-sm">{t(s.t)}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t(s.d)}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 text-center">
          <Button size="lg" onClick={() => setExplain(true)} className="h-12 px-8">
            <Home aria-hidden /> {t("public.homecare.cta")}
          </Button>
        </div>

        <Dialog open={explain} onOpenChange={setExplain}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("public.homecare.login.title")}</DialogTitle>
              <DialogDescription>{t("public.homecare.login.body")}</DialogDescription>
            </DialogHeader>
            <Button size="lg" className="h-12 w-full" onClick={() => { setExplain(false); setDomain("patient"); }}>
              {t("public.homecare.login.cta")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  );
}
