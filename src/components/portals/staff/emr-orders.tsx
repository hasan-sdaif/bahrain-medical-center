"use client";
/**
 * emr-orders — الطلبات (CPOE): lab + imaging chips (multi-select), priority,
 * reason, live total preview, duplicate-24h warnings, orders history.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { bhDateString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Empty, ErrorBox, IMAGING_CATALOG, LAB_CATALOG, LoadingRows, Section, errText, type ChartData, type OrderRow } from "./emr-shared";
import { cn } from "@/lib/utils";

interface Props { chart: ChartData; reload: () => void }
interface OrderResp { code: string; totalFils: number; warnings: { code: string; ar: string; en: string }[] }
const PRICES: Record<string, number> = {
  CBC: 9000, HGB: 4000, "GLU-F": 5000, HBA1C: 12000, K: 5000, NA: 5000, CREA: 5000, CHOL: 6000, TSH: 15000, FT4: 18000, VITD: 20000, PSA: 22000,
  "US-ABD": 15000, "US-NECK": 15000, "US-BREAST": 18000, "DXR-PA": 12000,
};
const PRIORITIES = ["routine", "urgent", "stat"] as const;

function Chips({ items, selected, toggle }: { items: typeof LAB_CATALOG; selected: Set<string>; toggle: (code: string) => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {items.map((it) => (
        <button
          key={it.code} onClick={() => toggle(it.code)} aria-pressed={selected.has(it.code)}
          className={cn("h-9 px-2.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1.5",
            selected.has(it.code) ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-muted")}
        >
          {bi(lang, it.ar, it.en)}
          <span className="font-mono text-[10px] opacity-80"><MoneyText fils={PRICES[it.code] ?? 0} currency={false} /></span>
        </button>
      ))}
    </div>
  );
}

export function OrdersTab({ chart }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("routine");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<OrderResp[]>([]);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [ordersErr, setOrdersErr] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    setOrdersErr(null);
    apiGet<OrderRow[]>("/api/staff/orders/list").then(setOrders).catch((e) => { setOrdersErr(errText(e, lang)); setOrders([]); });
  }, [lang]);
  useEffect(loadOrders, [loadOrders]);

  const toggle = (code: string) => setSel((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const total = useMemo(() => [...sel].reduce((sum, c) => sum + (PRICES[c] ?? 0), 0), [sel]);
  const labSel = [...sel].filter((c) => LAB_CATALOG.some((x) => x.code === c));
  const imgSel = [...sel].filter((c) => IMAGING_CATALOG.some((x) => x.code === c));

  const submit = async () => {
    setBusy(true); setResults([]);
    try {
      const out: OrderResp[] = [];
      if (labSel.length) out.push(await apiPost<OrderResp>("/api/staff/orders", {
        patientId: chart.banner.id, kind: "lab", priority, reason: reason.trim() || undefined,
        items: labSel.map((testCode) => ({ testCode })),
      }));
      if (imgSel.length) out.push(await apiPost<OrderResp>("/api/staff/orders", {
        patientId: chart.banner.id, kind: "imaging", priority, reason: reason.trim() || undefined,
        items: imgSel.map((imagingCode) => ({ imagingCode })),
      }));
      setResults(out);
      const warned = out.some((o) => o.warnings.length > 0);
      toast({ title: out.length === 1 ? t("emr.ord.ok", { code: out[0].code }) : t("emr.ord.okMulti", { n: out.length }), description: warned ? t("emr.ord.dupwarn") : undefined });
      setSel(new Set()); setReason("");
      loadOrders();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3">
      <Section title={`🧪 ${t("emr.ord.lab")}`}>
        <Chips items={LAB_CATALOG} selected={sel} toggle={toggle} />
      </Section>
      <Section title={`🩻 ${t("emr.ord.imaging")}`}>
        <Chips items={IMAGING_CATALOG} selected={sel} toggle={toggle} />
      </Section>

      <div className="rounded-lg border p-3 grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("common.priority")}</Label>
            <RadioGroup value={priority} onValueChange={(v) => setPriority(v as typeof priority)} className="flex gap-3">
              {PRIORITIES.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <RadioGroupItem value={p} id={`pr-${p}`} /> {t(`priority.${p}`)}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="grid gap-1 flex-1 min-w-48">
            <Label htmlFor="ord-reason" className="text-xs text-muted-foreground">{t("common.reason")}</Label>
            <Input id="ord-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 text-sm" placeholder={t("emr.ord.reasonHint")} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{t("emr.ord.preview")}</Label>
            <div className="font-mono text-sm font-bold"><MoneyText fils={total} /> <span className="text-muted-foreground font-normal">({sel.size})</span></div>
          </div>
          <Button className="h-10 px-6" disabled={!sel.size || busy} onClick={submit}>{busy ? t("common.loading") : t("emr.ord.send")}</Button>
        </div>

        {results.map((r) => (
          <div key={r.code} className="grid gap-1.5">
            <div className="rounded-md border border-teal-300 bg-teal-50/60 dark:bg-teal-950/30 p-2.5 text-sm flex flex-wrap items-center gap-2">
              <Badge className="bg-teal-600 border-transparent text-white">✓ {t("emr.ord.ok", { code: r.code })}</Badge>
              <MoneyText fils={r.totalFils} className="font-bold" />
            </div>
            {r.warnings.map((w) => (
              <div key={w.code} role="alert" className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-900 dark:text-amber-200">
                ⚠️ {bi(lang, w.ar, w.en)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Section title={`📋 ${t("emr.ord.history")}`} actions={<Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={loadOrders}>{t("common.refresh")}</Button>}>
        {ordersErr && <ErrorBox message={ordersErr} onRetry={loadOrders} />}
        {!orders && !ordersErr && <LoadingRows n={3} />}
        {orders && orders.length === 0 && <Empty label={t("common.empty")} className="py-4" />}
        {orders && orders.length > 0 && (
          <ul className="grid gap-1.5 max-h-96 overflow-y-auto bmc-scroll">
            {orders.map((o) => (
              <li key={o.id} className="rounded-md border p-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-bold" dir="ltr">{o.code}</span>
                <span className="truncate max-w-36 font-medium">{o.patient.nameAr}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{o.kind === "lab" ? t("emr.ord.lab") : t("emr.ord.imaging")}</Badge>
                <Badge variant="outline" className="text-[10px]">{t(`priority.${o.priority}`)}</Badge>
                <span className="text-muted-foreground">{bhDateString(o.createdAt)}</span>
                <span className="truncate max-w-40 text-muted-foreground">{o.reason ?? ""}</span>
                <span className="ms-auto flex items-center gap-2">
                  <MoneyText fils={o.totalFils} />
                  <StatusBadge status={o.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
