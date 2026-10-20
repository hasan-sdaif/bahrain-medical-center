"use client";
/** Departments grid — Shamel `.dept-card` pattern (gradient dc-ic tile, name,
 *  bilingual subtitle, desc, link-more) fed by the catalog; card click opens
 *  the details dialog with the department's priced services. */
import { useState } from "react";
import { Blocks, Clock, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyText } from "@/components/shared/badges";
import { bi, useI18n } from "@/i18n";
import { deptIcon, usePublicData, type DeptDto } from "../data";
import { Container, DirArrow, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

/** dept color → guide-style deep gradient tile */
function gradOf(color: string): string {
  return `linear-gradient(150deg, ${color}, color-mix(in srgb, ${color} 52%, #12202D))`;
}

function DeptCard({ dept, onOpen }: { dept: DeptDto; onOpen: () => void }) {
  const { lang, t } = useI18n();
  const Icon = deptIcon(dept.icon);
  return (
    <button
      onClick={onOpen}
      aria-label={`${bi(lang, dept.nameAr, dept.nameEn)} — ${t("public.depts.open")}`}
      className="card dept-card interactive text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="dc-ic" style={{ background: gradOf(dept.color) }}>
        <Icon className="size-11" aria-hidden />
      </span>
      <span className="dc-body">
        <h4 className="font-bold">{bi(lang, dept.nameAr, dept.nameEn)}</h4>
        <span className="dc-en">{bi(lang, dept.nameEn, dept.nameAr)}</span>
        <span className="dc-desc clamp-2">{bi(lang, dept.descAr, dept.descEn)}</span>
        <span className="link-more text-primary">
          {t("public.depts.discover")} <DirArrow />
        </span>
      </span>
    </button>
  );
}

function DeptDialog({ dept, onOpenChange }: { dept: DeptDto | null; onOpenChange: (v: boolean) => void }) {
  const { lang, t } = useI18n();
  const { data } = usePublicData();
  const Icon = deptIcon(dept?.icon);
  const services = dept ? data.services.filter((s) => s.deptCode === dept.code) : [];
  return (
    <Dialog open={!!dept} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {dept ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg text-white" style={{ background: gradOf(dept.color) }}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {bi(lang, dept.nameAr, dept.nameEn)}
              </DialogTitle>
              <DialogDescription>{bi(lang, dept.descAr, dept.descEn)}</DialogDescription>
            </DialogHeader>

            <div>
              <h4 className="mb-2 text-sm font-bold">{t("public.depts.services")}</h4>
              {services.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-sm text-ink-3">{t("public.depts.empty.services")}</p>
              ) : (
                <ul className="space-y-2">
                  {services.map((s) => (
                    <li key={s.code} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3">
                      <span className="min-w-40 flex-1 text-sm font-semibold">{bi(lang, s.nameAr, s.nameEn)}</span>
                      {s.fasting ? <span className="badge b-amber">{t("public.services.fasting")}</span> : null}
                      {s.isVideo ? <span className="badge b-teal">{t("public.services.video")}</span> : null}
                      <span className="flex items-center gap-1 text-xs text-ink-3">
                        <Clock className="size-3.5" aria-hidden />{t("public.services.duration", { n: s.durationMin })}
                      </span>
                      <MoneyText fils={s.priceFils} className="text-sm font-bold" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {bi(lang, dept.prepAr, dept.prepEn) ? (
              <div className="flex gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <p><span className="font-bold">{t("public.depts.prep")}: </span>{bi(lang, dept.prepAr, dept.prepEn)}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function Departments() {
  const { t } = useI18n();
  const { data, loading, error, reload } = usePublicData();
  const [selected, setSelected] = useState<DeptDto | null>(null);

  return (
    <Section id="departments">
      <Container>
        <SectionHeader
          icon={Blocks}
          eyebrow={t("public.depts.eyebrow")}
          title={t("public.depts.title")}
          subtitle={t("public.depts.subtitle")}
        />
        {error ? <ErrorRetry onRetry={reload} />
          : loading ? <SectionSkeleton cards={10} />
            : <div className="grid auto-280">{data.departments.map((d) => <DeptCard key={d.code} dept={d} onOpen={() => setSelected(d)} />)}</div>}
        <DeptDialog dept={selected} onOpenChange={(v) => !v && setSelected(null)} />
      </Container>
    </Section>
  );
}
