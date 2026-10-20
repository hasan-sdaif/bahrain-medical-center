"use client";
/**
 * Prescriptions — active/past lists, bilingual drug items, refill request
 * (POST /api/patient/prescriptions/refill → task for pharmacy).
 */
import { useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { bhDateString } from "@/lib/bahrain";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { PageHead, StBadge, TimeChip } from "./shell-ui";
import { errText, useFetch, type Prescription } from "./lib";
import { Loader2, Pill, RefreshCcw } from "lucide-react";

function RxCard({ rx, onRefill, busy }: { rx: Prescription; onRefill: (rx: Prescription) => void; busy: boolean }) {
  const { t, lang } = useI18n();
  return (
    <li className="card">
      <div className="card-head">
        <div className="ch-title">
          <span className="ch-ic ic-gold" aria-hidden><Pill className="size-4" /></span>
          <span className="mono">{rx.code}</span>
        </div>
        <div className="ch-tools">
          <TimeChip>{bhDateString(rx.createdAt)}</TimeChip>
          <StBadge status={rx.status} />
        </div>
      </div>
      <div className="card-body grid gap-3">
        <ul className="grid gap-2" role="list">
          {rx.items.map((it, i) => (
            <li key={i} className="grid gap-1 rounded-xl bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rm-name text-sm font-bold">{bi(lang, it.drugAr, it.drugEn)}</span>
                <span className="mono text-xs">{bi(lang, it.doseAr, it.doseEn)}</span>
              </div>
              <div className="rm-sig flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                <span>{t("pp.rx.freq")}: {it.frequency}</span>
                {bi(lang, it.instrAr, it.instrEn) ? <span>{t("pp.rx.instr")}: {bi(lang, it.instrAr, it.instrEn)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="badge b-slate">{t("pp.rx.dispensed", { n: rx.dispensedCount })}</span>
          {rx.status === "active" ? (
            <Button variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => onRefill(rx)}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}{t("pp.rx.refill")}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function PrescriptionsScreen() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = useFetch<Prescription[]>(() => apiGet<Prescription[]>("/api/patient/prescriptions"));

  const active = (list.data ?? []).filter((r) => r.status === "active");
  const past = (list.data ?? []).filter((r) => r.status !== "active");
  const rows = tab === "active" ? active : past;

  const refill = async (rx: Prescription) => {
    setBusyId(rx.id);
    try {
      await apiPost("/api/patient/prescriptions/refill", { prescriptionId: rx.id });
      toast({ title: t("pp.rx.refillDone"), description: rx.code });
      list.reload();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusyId(null); }
  };

  return (
    <div className="grid gap-4">
      <PageHead icon={Pill} title={t("pp.rx.title")} sub={t("pp.rx.sub")} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "past")}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="min-h-9 flex-1">{t("pp.rx.active")} ({active.length})</TabsTrigger>
          <TabsTrigger value="past" className="min-h-9 flex-1">{t("pp.rx.past")} ({past.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.loading ? <LoadingRows n={3} h="h-40" /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : (
        <SectionCard contentClassName="p-0">
          {rows.length ? (
            <ul className="list-group gap-3 p-4" role="list">{rows.map((rx) => <RxCard key={rx.id} rx={rx} onRefill={refill} busy={busyId === rx.id} />)}</ul>
          ) : <EmptyState icon={Pill} text={t("pp.rx.empty")} />}
        </SectionCard>
      )}
    </div>
  );
}
