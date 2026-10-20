"use client";
/**
 * Invoices — cards with lines + totals breakdown (subtotal/VAT/discount/
 * patient share/insurer share) and a simulated Benefit payment dialog
 * (دفع تجريبي — the real capture path is staff-side/webhook).
 */
import { useEffect, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { QrCode } from "@/components/shared/barcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState, ErrorBox, LoadingRows, SectionCard } from "./parts";
import { useFetch, type Invoice, type PaymentRec } from "./lib";
import { BadgeDollarSign, CreditCard, Loader2, Receipt, ShieldCheck } from "lucide-react";

function Row({ label, fils, strong = false }: { label: string; fils: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <MoneyText fils={fils} className={strong ? "font-bold" : ""} />
    </div>
  );
}

function PayDialog({ invoice, open, onOpenChange, onPaid }: { invoice: Invoice | null; open: boolean; onOpenChange: (o: boolean) => void; onPaid: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [phase, setPhase] = useState<"redirect" | "done">("redirect");

  useEffect(() => {
    if (!open) return;
    setPhase("redirect");
    const id = setTimeout(() => {
      setPhase("done");
      toast({ title: t("pp.inv.payDone"), description: invoice?.code });
      onPaid();
    }, 2000);
    return () => clearTimeout(id);
  }, [open, invoice, onPaid, t, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("pp.inv.payTitle")}
            <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("pp.inv.demoPay")}</Badge>
          </DialogTitle>
        </DialogHeader>
        {invoice ? (
          <div className="grid gap-3 text-center">
            <p className="font-mono text-sm text-muted-foreground" dir="ltr">{invoice.code}</p>
            <div className="flex items-center justify-center gap-3">
              <QrCode value={`BMC|INV|${invoice.code}|${invoice.patientFils}`} size={104} />
              <div className="grid gap-1 text-start">
                <p className="text-xs text-muted-foreground">{t("pp.inv.qrNote")}</p>
                <MoneyText fils={invoice.patientFils} className="text-xl font-bold text-primary" />
              </div>
            </div>
            {phase === "redirect" ? (
              <p className="flex items-center justify-center gap-2 rounded-lg bg-muted/60 p-2 text-sm"><Loader2 className="size-4 animate-spin" aria-hidden />{t("pp.inv.gatewayNote")}</p>
            ) : (
              <p className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck className="size-4" aria-hidden />{t("pp.inv.payDone")}</p>
            )}
            <Button className="min-h-11" variant={phase === "done" ? "default" : "outline"} onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceCard({ inv, onPay }: { inv: Invoice; onPay: (inv: Invoice) => void }) {
  const { t, lang } = useI18n();
  const discount = Math.max(0, inv.subtotalFils + inv.vatFils - inv.totalFils);
  const payable = ["issued", "partial"].includes(inv.status) && inv.patientFils > 0;
  return (
    <li className="grid gap-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold" dir="ltr">{inv.code}</span>
        <span className="flex items-center gap-2"><StatusBadge status={inv.status} /><span className="text-xs text-muted-foreground" dir="ltr">{inv.issuedAt}</span></span>
      </div>
      {inv.neutralDesc ? <p className="rounded-lg bg-muted/60 p-2 text-xs">{t("pp.inv.neutral")}: {inv.neutralDesc}</p> : null}
      <div className="grid gap-1.5">
        <p className="text-xs font-semibold text-muted-foreground">{t("pp.inv.lines")}</p>
        {inv.lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">{bi(lang, l.nameAr, l.nameEn)} <span className="text-xs text-muted-foreground">×{l.qty}</span></span>
            <MoneyText fils={l.unitFils * l.qty} className="text-xs" />
          </div>
        ))}
      </div>
      <Separator />
      <div className="grid gap-1">
        <Row label={t("pp.inv.subtotal")} fils={inv.subtotalFils} />
        <Row label={t("pp.inv.vat")} fils={inv.vatFils} />
        {discount > 0 ? <Row label={t("pp.inv.discount")} fils={discount} /> : null}
        <Row label={t("pp.inv.total")} fils={inv.totalFils} strong />
        <Separator />
        <Row label={t("pp.inv.patientShare")} fils={inv.patientFils} />
        <Row label={t("pp.inv.insurerShare")} fils={inv.insurerFils} />
      </div>
      {payable ? (
        <Button className="min-h-11" onClick={() => onPay(inv)}><CreditCard className="size-4" aria-hidden />{t("pp.inv.pay")} <MoneyText fils={inv.patientFils} currency={false} /></Button>
      ) : null}
    </li>
  );
}

export default function InvoicesScreen() {
  const { t, lang } = useI18n();
  const data = useFetch<{ invoices: Invoice[]; payments: PaymentRec[] }>(() => apiGet("/api/patient/invoices"));
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);

  return (
    <div className="grid gap-4">
      <h1 className="flex items-center gap-2 text-xl font-bold"><Receipt className="size-5 text-primary" aria-hidden />{t("pp.inv.title")}</h1>

      {data.loading ? <LoadingRows n={2} h="h-56" /> : data.error ? <ErrorBox error={data.error} onRetry={data.reload} /> : (
        <>
          <SectionCard>
            {(data.data?.invoices ?? []).length ? (
              <ul className="grid gap-3" role="list">{(data.data?.invoices ?? []).map((inv) => <InvoiceCard key={inv.id} inv={inv} onPay={setPayTarget} />)}</ul>
            ) : <EmptyState icon={Receipt} text={t("pp.inv.empty")} />}
          </SectionCard>

          <SectionCard title={t("pp.inv.payments")} icon={BadgeDollarSign}>
            {(data.data?.payments ?? []).length ? (
              <ul className="grid gap-2" role="list">
                {(data.data?.payments ?? []).map((p) => (
                  <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                    <span className="font-mono text-xs" dir="ltr">{p.code}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{t(`pm.${p.method}`)}</Badge>
                      <StatusBadge status={p.status} />
                      <MoneyText fils={p.amountFils} />
                      <span className="text-xs text-muted-foreground" dir="ltr">{p.at}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState text={t("common.empty")} className="border-0 py-2" />}
          </SectionCard>
        </>
      )}
      <p className="text-xs text-muted-foreground" dir={lang === "ar" ? "rtl" : "ltr"}>{t("barcode.verify.hint")}</p>

      <PayDialog invoice={payTarget} open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)} onPaid={data.reload} />
    </div>
  );
}
