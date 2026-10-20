"use client";
/**
 * Prescriptions — active/past lists, bilingual drug items, refill request
 * (POST /api/patient/prescriptions/refill → task for pharmacy).
 */
import { useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/shared/badges";
import { bhDateString } from "@/lib/bahrain";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { errText, useFetch, type Prescription } from "./lib";
import { Loader2, Pill, RefreshCcw } from "lucide-react";

function RxCard({ rx, onRefill, busy }: { rx: Prescription; onRefill: (rx: Prescription) => void; busy: boolean }) {
  const { t, lang } = useI18n();
  return (
    <li className="grid gap-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono text-sm font-semibold" dir="ltr"><Pill className="size-4 text-primary" aria-hidden />{rx.code}</span>
        <span className="flex items-center gap-2">
          <StatusBadge status={rx.status} />
          <span className="text-xs text-muted-foreground" dir="ltr">{bhDateString(rx.createdAt)}</span>
        </span>
      </div>
      <ul className="grid gap-2" role="list">
        {rx.items.map((it, i) => (
          <li key={i} className="grid gap-1 rounded-xl bg-muted/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{bi(lang, it.drugAr, it.drugEn)}</span>
              <span className="font-mono text-xs" dir="ltr">{bi(lang, it.doseAr, it.doseEn)}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{t("pp.rx.freq")}: {it.frequency}</span>
              {bi(lang, it.instrAr, it.instrEn) ? <span>{t("pp.rx.instr")}: {bi(lang, it.instrAr, it.instrEn)}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="secondary">{t("pp.rx.dispensed", { n: rx.dispensedCount })}</Badge>
        {rx.status === "active" ? (
          <Button variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => onRefill(rx)}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}{t("pp.rx.refill")}
          </Button>
        ) : null}
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
      <h1 className="flex items-center gap-2 text-xl font-bold"><Pill className="size-5 text-primary" aria-hidden />{t("pp.rx.title")}</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "past")}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="min-h-9 flex-1">{t("pp.rx.active")} ({active.length})</TabsTrigger>
          <TabsTrigger value="past" className="min-h-9 flex-1">{t("pp.rx.past")} ({past.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.loading ? <LoadingRows n={3} h="h-40" /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : (
        <SectionCard>
          {rows.length ? (
            <ul className="grid gap-3" role="list">{rows.map((rx) => <RxCard key={rx.id} rx={rx} onRefill={refill} busy={busyId === rx.id} />)}</ul>
          ) : <EmptyState icon={Pill} text={t("pp.rx.empty")} />}
        </SectionCard>
      )}
    </div>
  );
}
