"use client";
/**
 * Results — released lab results (flag squares `.flag`, reference range via
 * `.ref-range`, comments) + signed imaging reports. Critical-results notice
 * as a Shamel `.alert.alert-warning`.
 */
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString } from "@/lib/bahrain";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { FlagBadge, PageHead, StBadge } from "./shell-ui";
import { useFetch, type ImagingRow, type LabResultRow } from "./lib";
import { AlertTriangle, FileScan, FlaskConical, MessageSquareText } from "lucide-react";

function ResultRow({ r }: { r: LabResultRow }) {
  const { t, lang } = useI18n();
  const ref = r.refLow != null || r.refHigh != null ? `${r.refLow ?? "—"} – ${r.refHigh ?? "—"}` : "—";
  return (
    <li className="card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{bi(lang, r.testAr, r.testEn)}</span>
        <span className="flex items-center gap-2">
          <FlagBadge flag={r.flag} />
          <span className="ref-range">{bhDateString(r.resultedAt)}</span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="result-val text-base">{r.value} <span className="text-xs font-normal text-ink-3">{r.unit}</span></span>
        <span className="text-xs text-ink-3">{t("pp.res.ref")}: <span className="ref-range">{ref} {r.unit !== "-" ? r.unit : ""}</span></span>
      </div>
      {r.comment ? (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-surface-2 p-2 text-xs"><MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />{r.comment}</p>
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
      <PageHead icon={FlaskConical} title={t("pp.res.title")} sub={t("pp.res.sub")} />

      <p className="alert alert-warning items-start text-xs" role="note">
        <AlertTriangle className="al-ic size-4 shrink-0" aria-hidden />{t("pp.res.criticalNote")}
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
              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400"><AlertTriangle className="size-4" aria-hidden />{t("flag.CRIT")}</p>
            ) : null}
          </SectionCard>

          <SectionCard title={t("pp.res.imaging")} icon={FileScan}>
            {(data.data?.imaging ?? []).length ? (
              <ul className="grid gap-2" role="list">
                {(data.data?.imaging ?? []).map((i) => (
                  <li key={i.id} className="card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{t("pp.res.imaging")}</span>
                      <span className="flex items-center gap-2">
                        {i.grade ? <span className="tag mono">{i.grade}</span> : null}
                        <StBadge status="signed" />
                        {i.signedAt ? <span className="ref-range">{bhDateString(i.signedAt)}</span> : null}
                      </span>
                    </div>
                    {i.grade ? <p className="mt-1 text-xs text-ink-3">{t("pp.res.grade")}: <span className="mono">{i.grade}</span></p> : null}
                    <p className="mt-1.5 whitespace-pre-line rounded-lg bg-surface-2 p-2 text-xs leading-5">{bi(lang, i.reportAr, i.reportEn)}</p>
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
