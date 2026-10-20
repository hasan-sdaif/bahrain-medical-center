"use client";
/** Services & packages catalog — tabbed: priced services (fasting/duration/prep)
 *  and packages with an items list (currently an empty state until seeded). */
import { Boxes, Clock, Info, PackageOpen, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyText } from "@/components/shared/badges";
import { bi, useI18n } from "@/i18n";
import { usePublicData, type PkgDto, type ServiceDto } from "../data";
import { useBooking } from "./booking";
import { EmptyState, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

function ServiceCard({ svc }: { svc: ServiceDto }) {
  const { lang, t } = useI18n();
  const openBooking = useBooking((c) => c.openBooking);
  return (
    <Card className="flex flex-col">
      <CardContent className="p-4 md:p-5 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug">{bi(lang, svc.nameAr, svc.nameEn)}</h3>
          <MoneyText fils={svc.priceFils} className="font-bold text-primary shrink-0" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{svc.deptAr}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal">
            <Clock className="size-3" aria-hidden /> {t("public.services.duration", { n: svc.durationMin })}
          </Badge>
          {svc.fasting ? <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent">{t("public.services.fasting")}</Badge> : null}
          {svc.isVideo ? <Badge variant="outline" className="gap-1 font-normal"><Video className="size-3" aria-hidden /> {t("public.services.video")}</Badge> : null}
        </div>
        {bi(lang, svc.prepAr, svc.prepEn) ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground leading-relaxed">
            <Info className="size-3.5 shrink-0 mt-0.5" aria-hidden />
            <span><span className="font-semibold text-foreground">{t("public.services.prep")}: </span>{bi(lang, svc.prepAr, svc.prepEn)}</span>
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="p-4 md:p-5 pt-0">
        <Button variant="outline" size="sm" className="h-9 w-full" onClick={() => openBooking({ deptCode: svc.deptCode })}>
          {t("public.services.book")}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PkgItem({ raw, idx }: { raw: unknown; idx: number }) {
  const { lang, t } = useI18n();
  let label = t("public.services.pkg.item", { n: idx + 1 });
  if (typeof raw === "string") label = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as { nameAr?: string; nameEn?: string; serviceCode?: string };
    label = bi(lang, o.nameAr, o.nameEn) || o.serviceCode || label;
  }
  return <li className="rounded-md bg-muted/60 px-2.5 py-1.5 text-sm">{label}</li>;
}

function PackageCard({ pkg }: { pkg: PkgDto }) {
  const { lang, t } = useI18n();
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug">{bi(lang, pkg.nameAr, pkg.nameEn)}</h3>
          <MoneyText fils={pkg.priceFils} className="font-bold text-primary shrink-0" />
        </div>
        {bi(lang, pkg.descAr, pkg.descEn) ? <p className="mt-2 text-sm text-muted-foreground">{bi(lang, pkg.descAr, pkg.descEn)}</p> : null}
        <p className="mt-4 mb-2 text-xs font-semibold text-muted-foreground">{t("public.services.pkg.includes")}</p>
        <ul className="flex flex-wrap gap-1.5">
          {(pkg.items ?? []).map((it, i) => <PkgItem key={i} raw={it} idx={i} />)}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ServicesSection() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePublicData();

  return (
    <Section id="services">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={Boxes} title={t("public.services.title")} subtitle={t("public.services.subtitle")} />
        {error ? <ErrorRetry onRetry={reload} /> : loading ? <SectionSkeleton cards={6} /> : (
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="mx-auto mb-6 h-11">
              <TabsTrigger value="services" className="px-6 text-sm">{t("public.services.tab.services")}</TabsTrigger>
              <TabsTrigger value="packages" className="px-6 text-sm">{t("public.services.tab.packages")}</TabsTrigger>
            </TabsList>
            <TabsContent value="services">
              {data.services.length === 0 ? (
                <EmptyState icon={Boxes} title={t("public.services.empty")} />
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {data.services.map((s) => <ServiceCard key={s.code} svc={s} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="packages">
              {data.packages.length === 0 ? (
                <EmptyState icon={PackageOpen} title={t("public.services.pkg.empty.title")} desc={t("public.services.pkg.empty.desc")} />
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {data.packages.map((p) => <PackageCard key={p.code} pkg={p} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Section>
  );
}
