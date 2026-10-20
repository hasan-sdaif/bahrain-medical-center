"use client";
/**
 * emr-chart — الملخص: chart summary (problems / allergies red cards / meds /
 * vitals last-5 / encounters w/ signed status). Non-clinical roles get the
 * admin-only notice (reception sees admin view only).
 */
import { useI18n, bi } from "@/i18n";
import { bhDateString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { Bandage, ChartLine, Folders, Lock, Pill, TriangleAlert } from "lucide-react";
import { Empty, Section, type ChartData } from "./emr-shared";
import { ImmunizationsCard } from "./emr-immunizations";
import { ProgramsCard } from "./emr-programs";

interface Props { chart: ChartData; reload: () => void }

export function ChartTab({ chart, reload }: Props) {
  const { t, lang } = useI18n();
  const c = chart.clinical;

  if (!c) {
    return (
      <div role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-6 max-w-xl mx-auto grid gap-2 text-center">
        <div className="grid place-items-center"><Lock className="size-8" aria-hidden /></div>
        <div className="font-bold text-amber-900 dark:text-amber-100">{t("emr.admin.title")}</div>
        <p className="text-sm text-amber-800 dark:text-amber-200">{chart.adminOnly?.noteAr ?? t("emr.admin.note")}</p>
        {chart.adminOnly && (
          <div className="flex justify-center gap-2 text-xs">
            <Badge variant="outline">{t("emr.admin.problems")}: {chart.adminOnly.problems}</Badge>
            <Badge variant="outline">{t("emr.admin.encounters")}: {chart.adminOnly.encounters}</Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* allergies — red cards first (patient safety) */}
      <Section title={<><TriangleAlert className="size-4 shrink-0" aria-hidden />{t("emr.allergies")}</>} className="lg:col-span-2">
        {c.allergies.length === 0 ? <Empty label={t("emr.none.allergies")} className="py-4" /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {c.allergies.map((a) => (
              <div key={a.id} className="rounded-lg border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3">
                <div className="font-bold text-sm text-red-900 dark:text-red-200">{a.substance}</div>
                <div className="text-xs text-red-700 dark:text-red-300">{a.reaction ?? t("emr.allergy.unknown")}</div>
                <Badge variant="outline" className="mt-1 border-red-300 text-red-800 dark:text-red-200 text-[10px]">{t(`emr.sev.${a.severity}`)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* problems */}
      <Section title={<><Bandage className="size-4 shrink-0" aria-hidden />{t("emr.problems")}</>}>
        {c.problems.length === 0 ? <Empty label={t("emr.none.problems")} className="py-4" /> : (
          <ul className="grid gap-1.5">
            {c.problems.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="font-mono text-[10px] bg-teal-50">{p.icd10}</Badge>
                <span className="truncate">{bi(lang, p.nameAr, p.nameEn)}</span>
                <StatusBadge status={p.status} className="ms-auto" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* active meds */}
      <Section title={<><Pill className="size-4 shrink-0" aria-hidden />{t("emr.meds")}</>}>
        {c.meds.length === 0 ? <Empty label={t("emr.none.meds")} className="py-4" /> : (
          <ul className="grid gap-1.5">
            {c.meds.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className="truncate">{bi(lang, m.nameAr, m.nameEn)}</span>
                {m.dose && <span className="text-xs text-muted-foreground font-mono">{m.dose}</span>}
                <StatusBadge status={m.status} className="ms-auto" />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* vitals — last 5 */}
      <Section title={<><ChartLine className="size-4 shrink-0" aria-hidden />{t("emr.vitals.last")}</>}>
        {c.vitals.length === 0 ? <Empty label={t("emr.none.vitals")} className="py-4" /> : (
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-8">{t("common.date")}</TableHead>
                  <TableHead className="h-8">BP</TableHead>
                  <TableHead className="h-8">{t("emr.vitals.pulse")}</TableHead>
                  <TableHead className="h-8">T°C</TableHead>
                  <TableHead className="h-8">SpO₂</TableHead>
                  <TableHead className="h-8">BMI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.vitals.map((v) => (
                  <TableRow key={v.id} className="[&>td]:py-1 [&>td]:px-2">
                    <TableCell className="font-mono tabular-nums whitespace-nowrap">{bhDateString(v.recordedAt)}</TableCell>
                    <TableCell className="font-mono" dir="ltr">{v.bpSys && v.bpDia ? `${v.bpSys}/${v.bpDia}` : "—"}</TableCell>
                    <TableCell className="font-mono">{v.pulse ?? "—"}</TableCell>
                    <TableCell className="font-mono">{v.tempC ?? "—"}</TableCell>
                    <TableCell className="font-mono">{v.spo2 ? `${v.spo2}%` : "—"}</TableCell>
                    <TableCell className="font-mono font-bold">{v.bmi ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* encounters w/ signed status */}
      <Section title={<><Folders className="size-4 shrink-0" aria-hidden />{t("emr.encounters")}</>}>
        {c.encounters.length === 0 ? <Empty label={t("emr.none.encounters")} className="py-4" /> : (
          <ul className="grid gap-1.5 max-h-72 overflow-y-auto bmc-scroll">
            {c.encounters.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                <span className="font-mono text-xs" dir="ltr">{e.code}</span>
                <span className="text-xs text-muted-foreground">{bhDateString(e.startedAt)}</span>
                <span className="truncate text-xs flex-1 min-w-24">{e.chief ?? t("emr.enc.nochief")}</span>
                <StatusBadge status={e.signedAt ? "signed" : e.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* immunizations — history + due/overdue schedule (pediatrics, G1) */}
      <ImmunizationsCard chart={chart} reload={reload} />

      {/* therapeutic programs — enroll + step progress (G2) */}
      <ProgramsCard chart={chart} reload={reload} />
    </div>
  );
}
