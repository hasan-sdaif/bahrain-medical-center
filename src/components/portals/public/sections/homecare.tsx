"use client";
/** Home draw — 4-governorate coverage (Shamel cards with fee rows) + the
 *  "how it works" feature cards; CTA routes to the patient portal (requests
 *  require login). All fees are integer fils rendered via MoneyText. */
import { useState } from "react";
import {
  CalendarCheck2, ClipboardList, Home, MapPin, MoonStar, Syringe, TestTube2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyText } from "@/components/shared/badges";
import { useI18n } from "@/i18n";
import { useApp } from "@/store/app";
import { Container, Section, SectionHeader } from "../section-shell";

const ZONES: { key: string; feeFils: number; eveningFils: number }[] = [
  { key: "capital", feeFils: 3000, eveningFils: 1500 },
  { key: "muharraq", feeFils: 3500, eveningFils: 1500 },
  { key: "northern", feeFils: 4500, eveningFils: 2000 },
  { key: "southern", feeFils: 5000, eveningFils: 2000 },
];
const MIN_ORDER_FILS = 15000;

const STEPS = [
  { icon: ClipboardList, t: "public.homecare.step1", d: "public.homecare.step1.d", ic: "ic-teal" },
  { icon: MoonStar, t: "public.homecare.step2", d: "public.homecare.step2.d", ic: "ic-gold" },
  { icon: TestTube2, t: "public.homecare.step3", d: "public.homecare.step3.d", ic: "ic-violet" },
  { icon: CalendarCheck2, t: "public.homecare.step4", d: "public.homecare.step4.d", ic: "ic-sky" },
];

export function Homecare() {
  const { t } = useI18n();
  const setDomain = useApp((s) => s.setDomain);
  const [explain, setExplain] = useState(false);

  return (
    <Section id="homecare">
      <Container>
        <SectionHeader
          icon={Syringe}
          eyebrow={t("public.homecare.eyebrow")}
          title={t("public.homecare.title")}
          subtitle={t("public.homecare.subtitle")}
        />

        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink-3">
          <MapPin className="size-4 text-primary" aria-hidden /> {t("public.homecare.zones")}
        </h3>
        <div className="grid auto-280">
          {ZONES.map((z, i) => (
            <div key={z.key} className="card hoverable">
              <div className="card-body">
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span className="num text-xs font-semibold text-ink-3" aria-hidden>0{i + 1}</span>
                </div>
                <h4 className="mt-3 font-bold">{t(`public.homecare.zone.${z.key}`)}</h4>
                <p className="card-desc mt-1 min-h-8 text-xs leading-relaxed">{t(`public.homecare.zone.areas.${z.key}`)}</p>
                <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-3">{t("public.homecare.fee")}</dt>
                    <dd className="font-bold"><MoneyText fils={z.feeFils} /></dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-ink-3">{t("public.homecare.evening")}</dt>
                    <dd><MoneyText fils={z.eveningFils} /></dd>
                  </div>
                </dl>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-3">
          {t("public.homecare.min")}: <MoneyText fils={MIN_ORDER_FILS} />
        </p>

        <div className="mt-12">
          <h3 className="mb-4 text-sm font-bold text-ink-3">{t("public.homecare.how")}</h3>
          <ol className="grid auto-280">
            {STEPS.map((s, i) => (
              <li key={s.t} className="card feature-card">
                <div className="flex items-center gap-2.5">
                  <span className={`fc-ic ${s.ic} !mb-0 size-9`}><s.icon className="size-4" aria-hidden /></span>
                  <span className="num text-xs font-semibold text-ink-3" aria-hidden>{i + 1}/4</span>
                </div>
                <h4 className="mt-3 text-sm font-bold">{t(s.t)}</h4>
                <p className="mt-1 text-xs leading-relaxed">{t(s.d)}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 text-center">
          <button className="btn btn-gold btn-lg" onClick={() => setExplain(true)}>
            <Home className="size-[18px]" aria-hidden /> {t("public.homecare.cta")}
          </button>
        </div>

        <Dialog open={explain} onOpenChange={setExplain}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("public.homecare.login.title")}</DialogTitle>
              <DialogDescription>{t("public.homecare.login.body")}</DialogDescription>
            </DialogHeader>
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => { setExplain(false); setDomain("patient"); }}
            >
              {t("public.homecare.login.cta")}
            </button>
          </DialogContent>
        </Dialog>
      </Container>
    </Section>
  );
}
