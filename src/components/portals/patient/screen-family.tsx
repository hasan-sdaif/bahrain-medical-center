"use client";
/**
 * Family & growth — linked dependants (MRN/relation/DOB) + per-child WHO-LMS
 * growth charts (recharts LineChart: weight left axis / height right axis,
 * X = age in months) with latest-record z/percentile chips and a flag legend.
 */
import { useI18n } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { bhDateString } from "@/lib/bahrain";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead } from "./shell-ui";
import { useFetch, type Dependant, type GrowthChild, type GrowthRecord } from "./lib";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Baby, Users } from "lucide-react";

const FLAG_TONE: Record<string, string> = {
  "very-low": "b-red",
  "very-high": "b-red",
  "out-of-range": "b-amber",
  normal: "b-green",
};

function flagTone(flag: string | null): string {
  return FLAG_TONE[flag ?? "normal"] ?? FLAG_TONE.normal;
}

/** latest record for a metric (records arrive ascending by recordedAt) */
function latest(records: GrowthRecord[], metric: string): GrowthRecord | null {
  const rows = records.filter((r) => r.metric === metric);
  return rows.length ? rows[rows.length - 1] : null;
}

function MetricChips({ records, metric, labelKey }: { records: GrowthRecord[]; metric: string; labelKey: string }) {
  const { t } = useI18n();
  const r = latest(records, metric);
  if (!r) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-semibold">{t(labelKey)}: <span className="mono">{r.value}</span></span>
      <span className="badge b-slate">{t("pp.grw.percentile")}: <span className="mono">{r.percentile ?? "—"}</span></span>
      <span className="badge b-slate">{t("pp.grw.z")}: <span className="mono">{r.z ?? "—"}</span></span>
      <span className={`badge ${flagTone(r.flag)}`}>{t(`pp.grw.flag.${r.flag ?? "normal"}`)}</span>
    </div>
  );
}

function ChildGrowth({ g }: { g: GrowthChild }) {
  const { t } = useI18n();
  const byAge = new Map<number, { ageMonths: number; weight?: number; height?: number }>();
  for (const r of g.records) {
    if (r.metric !== "weight" && r.metric !== "height") continue;
    const row = byAge.get(r.ageMonths) ?? { ageMonths: r.ageMonths };
    row[r.metric] = r.value;
    byAge.set(r.ageMonths, row);
  }
  const data = [...byAge.values()].sort((a, b) => a.ageMonths - b.ageMonths);
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{g.child.nameAr}</p>
        <span className="mono text-xs text-ink-3">{bhDateString(g.child.dob ?? "")}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ageMonths" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="w" width={36} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="h" orientation="right" width={36} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="w" dataKey="weight" name={t("pp.grw.weight")} connectNulls stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} />
          <Line yAxisId="h" dataKey="height" name={t("pp.grw.height")} connectNulls stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="grid gap-1.5">
        <p className="text-xs font-semibold text-muted-foreground">{t("pp.grw.latest")}</p>
        <MetricChips records={g.records} metric="weight" labelKey="pp.grw.weight" />
        <MetricChips records={g.records} metric="height" labelKey="pp.grw.height" />
        <p className="text-[11px] text-muted-foreground">{t("pp.grw.refNote")}</p>
      </div>
    </div>
  );
}

function FlagLegend() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-semibold">{t("pp.grw.legend")}:</span>
      {(["normal", "out-of-range", "very-low"] as const).map((f) => (
        <span key={f} className={`badge ${flagTone(f)}`}>{t(`pp.grw.flag.${f}`)}</span>
      ))}
    </div>
  );
}

export default function FamilyScreen() {
  const { t } = useI18n();
  const fam = useFetch<{ dependants: Dependant[] }>(() => apiGet<{ dependants: Dependant[] }>("/api/patient/family"));
  const growth = useFetch<GrowthChild[]>(() => apiGet<GrowthChild[]>("/api/patient/growth"));
  const kids = fam.data?.dependants ?? [];
  const charts = growth.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHead icon={Users} title={t("pp.fam.title")} sub={t("pp.fam.sub")} />

      {fam.loading ? <LoadingRows n={2} h="h-24" /> : fam.error ? <ErrorBox error={fam.error} onRetry={fam.reload} /> : (
        <SectionCard title={t("pp.fam.dependants")} icon={Users} contentClassName="p-0">
          {kids.length ? (
            <ul className="list-group" role="list">
              {kids.map((k, i) => (
                <li key={k.id} className="list-item">
                  <span className={`avatar av-${(i % 8) + 3}`} aria-hidden><Baby className="size-4" /></span>
                  <span className="li-body">
                    <span className="li-title">{k.nameAr}</span>
                    <span className="li-sub mono">{k.mrn} · {bhDateString(k.dob)}</span>
                  </span>
                  <span className="li-end"><span className="badge b-slate">{k.relation}</span></span>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Users} text={t("pp.fam.empty")} />}
          <p className="border-t border-line px-4 py-3 text-xs text-ink-3">{t("pp.fam.note")}</p>
        </SectionCard>
      )}

      {growth.loading ? <LoadingRows n={2} h="h-64" /> : growth.error ? <ErrorBox error={growth.error} onRetry={growth.reload} /> : (
        <SectionCard title={t("pp.grw.title")} icon={Baby}>
          {charts.length ? (
            <div className="grid gap-4">
              {charts.map((g) => <ChildGrowth key={g.child.id} g={g} />)}
              <FlagLegend />
            </div>
          ) : <EmptyState icon={Baby} text={t("pp.grw.empty")} />}
        </SectionCard>
      )}
    </div>
  );
}
