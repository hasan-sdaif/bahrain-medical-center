"use client";
/**
 * FAQ section — Shamel guide `faq.html` accordion (`.acc-item/.acc-head/.acc-body`)
 * built from the catalog FAQs, plus the insurance-partners strip as guide
 * `.partner-chip` tiles with colored monogram tiles.
 */
import { useState } from "react";
import { ChevronDown, CircleHelp, ShieldCheck } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { cn } from "@/lib/utils";
import { Section, SectionHeader, SectionSkeleton, Container } from "../section-shell";
import { usePublicData } from "../data";

const PT_COLORS = ["var(--navy-700)", "var(--sky-600)", "var(--teal-600)", "var(--gold-600)", "var(--violet-600)", "var(--green-600)", "var(--rose-600)", "var(--amber-700)"];

function Insurers() {
  const { t, lang } = useI18n();
  const { data } = usePublicData();
  if (data.insurers.length === 0) return null;
  return (
    <div className="mt-14 md:mt-20">
      <SectionHeader
        icon={ShieldCheck}
        eyebrow={t("public.insurers.eyebrow")}
        title={t("public.insurers.title")}
        subtitle={t("public.insurers.subtitle")}
      />
      <div className="grid auto-200">
        {data.insurers.map((ins, i) => {
          const name = bi(lang, ins.nameAr, ins.nameEn);
          return (
            <div key={i} className="partner-chip">
              <span className="pt-ic" style={{ background: PT_COLORS[i % PT_COLORS.length] }} aria-hidden>
                {name.trim().charAt(0)}
              </span>
              <span className="flex min-w-0 flex-col text-start">
                <span className="truncate">{name}</span>
                <span className="text-xs font-medium text-ink-3">
                  {t(`public.insurers.kind.${ins.kind === "corporate" ? "corporate" : "insurance"}`)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Faq() {
  const { t, lang } = useI18n();
  const { data, loading } = usePublicData();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq">
      <Container>
        <SectionHeader
          icon={CircleHelp}
          eyebrow={t("public.faq.eyebrow")}
          title={t("public.faq.title")}
          subtitle={t("public.faq.subtitle")}
        />
        {loading ? (
          <div className="mx-auto max-w-3xl"><SectionSkeleton cards={4} /></div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {data.faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className={cn("acc-item", isOpen && "open")}>
                  <button
                    className="acc-head"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span className="ah-ic"><CircleHelp className="size-4" aria-hidden /></span>
                    <span className="flex-1 text-start">{bi(lang, f.qAr, f.qEn)}</span>
                    <ChevronDown className="ah-caret size-4" aria-hidden />
                  </button>
                  <div className="acc-body" id={`faq-panel-${i}`} role="region">
                    <p className="pb-1">{bi(lang, f.aAr, f.aEn)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Insurers />
      </Container>
    </Section>
  );
}
