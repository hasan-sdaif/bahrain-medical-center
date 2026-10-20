"use client";
/**
 * FAQ section — accordion from /api/public/catalog faqs (bilingual Q/A),
 * plus the insurance-partners strip (insurers list with kind badges).
 */
import { CircleHelp, ShieldCheck } from "lucide-react";
import { useI18n, bi } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Section, SectionHeader, SectionSkeleton } from "../section-shell";
import { usePublicData } from "../data";

export function Faq() {
  const { t, lang } = useI18n();
  const { data, loading } = usePublicData();

  return (
    <Section id="faq">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={CircleHelp} title={t("public.faq.title")} subtitle={t("public.faq.subtitle")} />
        {loading ? (
          <div className="mx-auto max-w-3xl"><SectionSkeleton cards={4} /></div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4 md:px-6 divide-y divide-border">
              {data.faqs.map((f, i) => (
                <AccordionItem key={i} value={`q-${i}`} className="border-0">
                  <AccordionTrigger className="text-start text-sm md:text-base font-semibold py-4 hover:no-underline">
                    {bi(lang, f.qAr, f.qEn)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {bi(lang, f.aAr, f.aEn)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {data.insurers.length > 0 && (
          <div className="mt-12 md:mt-16">
            <SectionHeader icon={ShieldCheck} title={t("public.insurers.title")} subtitle={t("public.insurers.subtitle")} />
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {data.insurers.map((ins, i) => (
                <div key={i} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center">
                  <ShieldCheck className="size-6 text-primary" aria-hidden />
                  <span className="text-sm font-semibold leading-tight">{bi(lang, ins.nameAr, ins.nameEn)}</span>
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {t(`public.insurers.kind.${ins.kind === "corporate" ? "corporate" : "insurance"}`)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
