"use client";
/**
 * Results — released lab results (flag-colored H/L/CRIT badges, reference
 * range, comments) + signed imaging reports. Critical-results notice.
 */
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { StatusBadge } from "@/components/shared/badges";
import { bhDateString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { useFetch, type ImagingRow, type LabResultRow } from "./lib";
import { AlertTriangle, FileScan, FlaskConical, MessageSquareText } from "lucide-react";

function ResultRow({ r }: { r: LabResultRow }) {
  const { t, lang } = useI18n();
  const ref = r.refLow != null || r.refHigh != null ? `${r.refLow ?? "—"} – ${r.refHigh ?? "—"}` : "—";
  return (
    <li className="grid gap-1.5 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{bi(lang, r.testAr, r.testEn)}</span>
        <span className="flex items-center gap-2">
          <StatusBadge status={r.flag} />
          <span className="text-xs text-muted-foreground" dir="ltr">{bhDateString(r.resultedAt)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-mono text-base font-bold tabular-nums" dir="ltr">{r.value} <span className="text-xs font-normal text-muted-foreground">{r.unit}</span></span>
        <span className="text-xs text-muted-foreground">{t("pp.res.ref")}: <span className="font-mono" dir="ltr">{ref} {r.unit !== "-" ? r.unit : ""}</span></span>
      </div>
      {r.comment ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2 text-xs"><MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />{r.comment}</p>
      ) : null}
    </li>
  );
}

export default function ResultsScreen() {
  const { t, lang } = useI18n();
  const data = useFetch<{ results: LabResultRow[]; imaging: ImagingRow[] }>(() => apiGet("/api/patient/results"));
  const hasCritical = (data.data?.results ?? []).some((r) => r.flag === "CRIT");

  return (
    <div className="grid gap-4">
      <h1 className="flex items-center gap-2 text-xl font-bold"><FlaskConical className="size-5 text-primary" aria-hidden />{t("pp.res.title")}</h1>

      <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="note">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{t("pp.res.criticalNote")}
      </p>

      {data.loading ? <LoadingRows n={4} /> : data.error ? <ErrorBox error={data.error} onRetry={data.reload} /> : (
        <>
          <SectionCard title={t("pp.res.lab")} icon={FlaskConical}>
            {(data.data?.results ?? []).length ? (
              <ul className="grid gap-2" role="list">
                {(data.data?.results ?? []).map((r) => <ResultRow key={r.id} r={r} />)}
              </ul>
            ) : <EmptyState icon={FlaskConical} text={t("pp.res.empty")} />}
            {hasCritical ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-destructive"><AlertTriangle className="size-4" aria-hidden />{t("flag.CRIT")}</p>
            ) : null}
          </SectionCard>

          <SectionCard title={t("pp.res.imaging")} icon={FileScan}>
            {(data.data?.imaging ?? []).length ? (
              <ul className="grid gap-2" role="list">
                {(data.data?.imaging ?? []).map((i) => (
                  <li key={i.id} className="grid gap-1.5 rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{t("pp.res.imaging")}</span>
                      <span className="flex items-center gap-2">
                        {i.grade ? <Badge variant="outline" className="font-mono">{i.grade}</Badge> : null}
                        <StatusBadge status="signed" />
                        {i.signedAt ? <span className="text-xs text-muted-foreground" dir="ltr">{bhDateString(i.signedAt)}</span> : null}
                      </span>
                    </div>
                    {i.grade ? <p className="text-xs text-muted-foreground">{t("pp.res.grade")}: <span className="font-mono">{i.grade}</span></p> : null}
                    <p className="whitespace-pre-line rounded-lg bg-muted/60 p-2 text-xs leading-5">{bi(lang, i.reportAr, i.reportEn)}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={FileScan} text={t("pp.res.empty")} />}
          </SectionCard>
        </>
      )}
    </div>
  );
}
