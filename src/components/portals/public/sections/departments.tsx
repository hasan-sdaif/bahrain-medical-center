"use client";
/** Departments grid — 10 cards from the catalog; card click opens a details dialog. */
import { useState } from "react";
import { Blocks, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoneyText } from "@/components/shared/badges";
import { bi, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { deptIcon, usePublicData, type DeptDto } from "../data";
import { ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

function DeptCard({ dept, onOpen }: { dept: DeptDto; onOpen: () => void }) {
  const { lang, t } = useI18n();
  const Icon = deptIcon(dept.icon);
  return (
    <button
      onClick={onOpen}
      aria-label={`${bi(lang, dept.nameAr, dept.nameEn)} — ${t("public.depts.open")}`}
      className="group text-start rounded-xl border bg-card p-4 md:p-5 flex flex-col gap-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${dept.color}1a`, color: dept.color }}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors">{bi(lang, dept.nameAr, dept.nameEn)}</h3>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} aria-hidden />
            <span dir="ltr" className="font-mono">{dept.code}</span>
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{bi(lang, dept.descAr, dept.descEn)}</p>
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
                <span className="grid size-10 place-items-center rounded-xl" style={{ backgroundColor: `${dept.color}1a`, color: dept.color }}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {bi(lang, dept.nameAr, dept.nameEn)}
              </DialogTitle>
              <DialogDescription>{bi(lang, dept.descAr, dept.descEn)}</DialogDescription>
            </DialogHeader>

            <div>
              <h4 className="text-sm font-semibold mb-2">{t("public.depts.services")}</h4>
              {services.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t("public.depts.empty.services")}</p>
              ) : (
                <ul className="space-y-2">
                  {services.map((s) => (
                    <li key={s.code} className="rounded-lg border p-3 flex flex-wrap items-center gap-2">
                      <span className="flex-1 min-w-40 text-sm font-medium">{bi(lang, s.nameAr, s.nameEn)}</span>
                      {s.fasting ? <Badge className="bg-amber-100 text-amber-900 border-transparent">{t("public.services.fasting")}</Badge> : null}
                      {s.isVideo ? <Badge className="bg-teal-100 text-teal-900 border-transparent">{t("public.services.video")}</Badge> : null}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden />{t("public.services.duration", { n: s.durationMin })}</span>
                      <MoneyText fils={s.priceFils} className="text-sm font-semibold" />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {bi(lang, dept.prepAr, dept.prepEn) ? (
              <div className="flex gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <Info className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
                <p><span className="font-semibold">{t("public.depts.prep")}: </span>{bi(lang, dept.prepAr, dept.prepEn)}</p>
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
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={Blocks} title={t("public.depts.title")} subtitle={t("public.depts.subtitle")} />
        {error ? <ErrorRetry onRetry={reload} />
          : loading ? <SectionSkeleton cards={10} />
            : (
              <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")}>
                {data.departments.map((d) => <DeptCard key={d.code} dept={d} onOpen={() => setSelected(d)} />)}
              </div>
            )}
        <DeptDialog dept={selected} onOpenChange={(v) => !v && setSelected(null)} />
      </div>
    </Section>
  );
}
