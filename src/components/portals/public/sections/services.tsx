"use client";
/** Services & packages catalog — tabbed. Services as Shamel cards with badge
 *  chips; packages as the guide `.package-card` (gradient pk-head + price,
 *  check-list pk-features, bookable pk-foot). Booking prefill preserved. */
import { Boxes, Check, Clock, Info, PackageOpen, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyText, } from "@/components/shared/badges";
import { BHD3 } from "@/lib/money";
import { bi, useI18n } from "@/i18n";
import { usePublicData, type PkgDto, type ServiceDto } from "../data";
import { useBooking } from "./booking";
import { Container, EmptyState, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

const PKG_GRADS = ["var(--grad-teal)", "var(--grad-navy)", "var(--grad-gold)", "var(--grad-violet)"];

function ServiceCard({ svc }: { svc: ServiceDto }) {
  const { lang, t } = useI18n();
  const openBooking = useBooking((c) => c.openBooking);
  return (
    <article className="card hoverable">
      <div className="card-body flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="card-title leading-snug">{bi(lang, svc.nameAr, svc.nameEn)}</h3>
          <MoneyText fils={svc.priceFils} className="shrink-0 text-base font-extrabold text-primary" />
        </div>
        <p className="card-desc mt-1">{svc.deptAr}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="badge b-slate"><Clock className="size-3" aria-hidden /> {t("public.services.duration", { n: svc.durationMin })}</span>
          {svc.fasting ? <span className="badge b-amber">{t("public.services.fasting")}</span> : null}
          {svc.isVideo ? <span className="badge b-teal"><Video className="size-3" aria-hidden /> {t("public.services.video")}</span> : null}
        </div>
        {bi(lang, svc.prepAr, svc.prepEn) ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-surface-2 p-2.5 text-xs leading-relaxed text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span><span className="font-bold text-ink-2">{t("public.services.prep")}: </span>{bi(lang, svc.prepAr, svc.prepEn)}</span>
          </p>
        ) : null}
      </div>
      <div className="card-foot">
        <button
          className="btn btn-outline btn-sm ms-auto h-9"
          onClick={() => openBooking({ deptCode: svc.deptCode })}
        >
          {t("public.services.book")}
        </button>
      </div>
    </article>
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
  return <li><span className="pf-check"><Check className="size-3.5" aria-hidden /></span>{label}</li>;
}

function PackageCard({ pkg, idx }: { pkg: PkgDto; idx: number }) {
  const { lang, t } = useI18n();
  const openBooking = useBooking((c) => c.openBooking);
  return (
    <article className="card package-card">
      <div className="pk-head" style={{ background: PKG_GRADS[idx % PKG_GRADS.length] }}>
        <h4 className="font-bold">{bi(lang, pkg.nameAr, pkg.nameEn)}</h4>
        <div className="pk-price">
          <span className="val">{BHD3(pkg.priceFils)}</span> <small className="text-white/85">{t("money.currency")}</small>
        </div>
      </div>
      <ul className="pk-features">
        {(pkg.items ?? []).length > 0
          ? (pkg.items ?? []).map((it, i) => <PkgItem key={i} raw={it} idx={i} />)
          : bi(lang, pkg.descAr, pkg.descEn)
            ? <li><span className="pf-check"><Check className="size-3.5" aria-hidden /></span>{bi(lang, pkg.descAr, pkg.descEn)}</li>
            : null}
      </ul>
      <div className="pk-foot">
        <button className="btn btn-primary btn-block h-11" onClick={() => openBooking()}>
          {t("public.services.pkg.book")}
        </button>
      </div>
    </article>
  );
}

export function ServicesSection() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePublicData();

  return (
    <Section id="services">
      <Container>
        <SectionHeader
          icon={Boxes}
          eyebrow={t("public.services.eyebrow")}
          title={t("public.services.title")}
          subtitle={t("public.services.subtitle")}
        />
        {error ? <ErrorRetry onRetry={reload} /> : loading ? <SectionSkeleton cards={6} /> : (
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="mb-6 h-11">
              <TabsTrigger value="services" className="px-6 text-sm">{t("public.services.tab.services")}</TabsTrigger>
              <TabsTrigger value="packages" className="px-6 text-sm">{t("public.services.tab.packages")}</TabsTrigger>
            </TabsList>
            <TabsContent value="services">
              {data.services.length === 0 ? (
                <EmptyState icon={Boxes} title={t("public.services.empty")} />
              ) : (
                <div className="grid auto-280">
                  {data.services.map((s) => <ServiceCard key={s.code} svc={s} />)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="packages">
              {data.packages.length === 0 ? (
                <EmptyState icon={PackageOpen} title={t("public.services.pkg.empty.title")} desc={t("public.services.pkg.empty.desc")} />
              ) : (
                <div className="grid auto-320">
                  {data.packages.map((p, i) => <PackageCard key={p.code} pkg={p} idx={i} />)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </Container>
    </Section>
  );
}
