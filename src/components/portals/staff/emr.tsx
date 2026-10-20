"use client";
/**
 * emr.tsx — العيادات والملفات: clinical workspace shell (agent S2, completing 2-c).
 * Always-visible patient finder (fuzzy search + similar warnings + MRN Code128)
 * → pinned PatientBanner → 8 clinical sub-tabs (each in emr-*.tsx).
 * Auto-loads sessionStorage "bmc-last-patient" written by reception (handoff).
 */
import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code128 } from "@/components/shared/barcode";
import { PatientBanner } from "@/components/shared/patient-banner";
import { AssuranceDot, Empty, ErrorBox, LoadingRows, errText, getLastPatient, setLastPatient, type ChartData, type SearchResp } from "./emr-shared";
import { ChartTab } from "./emr-chart";
import { EncounterTab } from "./emr-encounter";
import { OrdersTab } from "./emr-orders";
import { RxTab } from "./emr-rx";
import { VitalsTab } from "./emr-vitals";
import { ReferralTab } from "./emr-referral";
import { ConsentsTab } from "./emr-consents";
import { InboxTab } from "./emr-inbox";

export interface EmrTabProps {
  chart: ChartData;
  reload: () => void;
}

const TABS = [
  ["summary", "📋"], ["encounter", "🩺"], ["orders", "🧪"], ["rx", "💊"],
  ["vitals", "📈"], ["referral", "↗"], ["consents", "✍"], ["inbox", "📥"],
] as const;
type TabKey = (typeof TABS)[number][0];

export default function Emr() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [resp, setResp] = useState<SearchResp | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("summary");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadChart = (id: string, nameAr?: string) => {
    setLoadingChart(true); setChartError(null);
    apiGet<ChartData>(`/api/staff/patients/chart/${id}`)
      .then((c) => {
        setChart(c);
        setOpen(false);
        toast({ title: t("emr.chart.loaded", { name: nameAr ?? c.banner.nameAr }), description: c.banner.mrn });
      })
      .catch((e) => setChartError(errText(e, lang)))
      .finally(() => setLoadingChart(false));
  };

  // reception handoff: auto-load last patient on mount (silent — manual search on failure)
  useEffect(() => {
    const lp = getLastPatient();
    if (!lp) return;
    queueMicrotask(() => {
      apiGet<ChartData>(`/api/staff/patients/chart/${lp.id}`).then(setChart).catch(() => null);
    });
  }, []);

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true); setOpen(true);
    apiGet<SearchResp>(`/api/staff/patients/search?query=${encodeURIComponent(q)}`)
      .then((r) => { setResp(r); if (!r.exact.length && !r.similar.length) toast({ title: t("search.empty") }); })
      .catch(() => { setResp(null); setOpen(false); })
      .finally(() => setSearching(false));
  };

  const pick = (id: string, mrn: string, nameAr: string) => {
    setLastPatient({ id, mrn, nameAr });
    loadChart(id, nameAr);
  };

  const reload = () => { if (chart) loadChart(chart.banner.id); };

  const Row = ({ p, similar }: { p: SearchResp["exact"][number]; similar?: boolean }) => (
    <button
      onClick={() => pick(p.id, p.mrn, p.nameAr)}
      className={similar
        ? "flex items-center gap-2 w-full rounded-md border border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-2 text-start hover:border-amber-500"
        : "flex items-center gap-2 w-full rounded-md border bg-card p-2 text-start hover:border-primary"}
    >
      <AssuranceDot level={p.assurance} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{bi(lang, p.nameAr, p.nameEn)}</span>
        <span className="block text-[11px] text-muted-foreground font-mono" dir="ltr">{p.mrn}{p.dob ? ` · ${p.dob.slice(0, 10)}` : ""}{p.idMasked ? ` · ${p.idMasked}` : ""}</span>
      </span>
      {similar && <Badge variant="outline" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-transparent shrink-0">{t("rec.similar.score", { n: Math.round(p.score ?? 0) })}</Badge>}
      <span className="shrink-0 bg-white text-black rounded px-1"><Code128 value={p.mrn} height={16} showValue={false} /></span>
    </button>
  );

  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto grid gap-3">
      {/* patient finder — always visible */}
      <div className="grid gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold whitespace-nowrap">{t("staff.module.emr")}</h1>
          {chart && <Badge variant="outline" className="font-mono text-xs">{chart.banner.mrn}</Badge>}
        </div>
        <div className="flex gap-2">
          <Input
            ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); if (e.key === "Escape") setOpen(false); }}
            className="h-10" placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} />
          <Button className="h-10 px-5" onClick={search} disabled={searching || !query.trim()}>{searching ? t("common.loading") : t("common.search")}</Button>
        </div>
        {open && resp && (
          <div className="rounded-lg border p-2 grid gap-1.5 max-h-80 overflow-y-auto bmc-scroll" role="listbox">
            {resp.similar.length > 0 && <div className="text-[11px] text-amber-800 dark:text-amber-200 px-1">⚠️ {t("search.dupwarn")} — {t("rec.similar.note")}</div>}
            {resp.exact.map((p) => <Row key={p.id} p={p} />)}
            {resp.similar.map((p) => <Row key={p.id} p={p} similar />)}
            {!resp.exact.length && !resp.similar.length && <Empty label={t("search.empty")} />}
          </div>
        )}
      </div>

      {chartError && <ErrorBox message={chartError} />}
      {loadingChart && <LoadingRows n={3} />}

      {/* pinned patient banner */}
      {chart && <PatientBanner data={chart.banner} />}

      {/* clinical sub-tabs */}
      {chart && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-3">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            {TABS.map(([key, icon]) => (
              <TabsTrigger key={key} value={key} className="h-9 flex-none px-3 text-xs">
                <span aria-hidden>{icon}</span> {t(`emr.tab.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="summary" className="mt-0"><ChartTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="encounter" className="mt-0"><EncounterTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="orders" className="mt-0"><OrdersTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="rx" className="mt-0"><RxTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="vitals" className="mt-0"><VitalsTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="referral" className="mt-0"><ReferralTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="consents" className="mt-0"><ConsentsTab chart={chart} reload={reload} /></TabsContent>
          <TabsContent value="inbox" className="mt-0"><InboxTab /></TabsContent>
        </Tabs>
      )}

      {!chart && !loadingChart && !chartError && (
        <Empty label={t("emr.nopatient")} className="py-16" />
      )}
    </div>
  );
}
