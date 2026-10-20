"use client";
/**
 * Payments tab (agent 2-e) — invoice → pay dialog (cash/card/Benefit radio,
 * amount prefilled patient share, auto-UUID idempotency key) → POST payments/pay
 * → receipt (Code128 + QR + print + bilingual lines + VAT + card-data notice);
 * IDEMPOTENT_DUP 409 surfaced bilingually.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useI18n, bi } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { BHD3, FILS } from "@/lib/money";
import { bhTimeString } from "@/lib/bahrain";
import { Code128, QrCode } from "@/components/shared/barcode";
import { MoneyText } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Banknote, CreditCard, Landmark, Printer, RefreshCw, ShieldCheck, X } from "lucide-react";
import { K, newIdemKey, problemDetail, type SessionInvoice, type SessionPayment } from "./billing-types";

type Method = "cash" | "card" | "benefit";
const METHOD_ICON: Record<Method, ReactNode> = { cash: <Banknote className="size-4" aria-hidden />, card: <CreditCard className="size-4" aria-hidden />, benefit: <Landmark className="size-4" aria-hidden /> };

interface PayResult { payment: SessionPayment; paidSoFar: number; invoiceStatus: string }

function Receipt({ inv, result, onClose }: { inv: SessionInvoice; result: PayResult; onClose: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Card className="print-area max-w-xl mx-auto">
      <style media="print">{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; inset-inline-start: 0; top: 0; width: 100%; } }`}</style>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-lg">{t("bc.pay.receipt")} — {t("bc.pay.receiptNo")} <span className="font-mono">{result.payment.code}</span></h3>
            <p className="text-xs text-muted-foreground">{t("bc.pay.receiptFor")} <span className="font-mono">{inv.code}</span> · {bhTimeString(result.payment.at)} (UTC+3)</p>
            <p className="text-sm mt-1">{inv.patientName}</p>
          </div>
          <div className="flex gap-1 no-print">
            <Button variant="outline" size="sm" className="h-9" onClick={() => window.print()}><Printer aria-hidden /> {t("bc.pay.print")}</Button>
            <Button variant="ghost" size="icon" className="size-9" onClick={onClose} aria-label={t("common.close")}><X aria-hidden /></Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-start font-medium py-1.5">{t("bc.inv.builder")}</th>
              <th className="text-start font-medium py-1.5">{t("common.quantity")}</th>
              <th className="text-end font-medium py-1.5">{t("bc.inv.subtotal")}</th>
              <th className="text-end font-medium py-1.5">{t("bc.inv.vat")}</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-dashed">
                <td className="py-1.5">{bi(lang, l.nameAr, l.nameEn)} <span className="text-xs text-muted-foreground">({K(lang, l.kind)})</span></td>
                <td className="py-1.5 font-mono">{l.qty}</td>
                <td className="py-1.5 text-end"><MoneyText fils={l.grossFils} currency={false} /></td>
                <td className="py-1.5 text-end"><MoneyText fils={l.vatFils} currency={false} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-1.5 text-sm">
          <div className="flex justify-between rounded bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.subtotal")}</span><MoneyText fils={inv.subtotalFils} /></div>
          <div className="flex justify-between rounded bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.vat")}</span><MoneyText fils={inv.vatFils} /></div>
          <div className="flex justify-between rounded bg-primary/10 px-3 py-2 font-semibold"><span>{t("bc.inv.total")}</span><MoneyText fils={inv.totalFils} /></div>
          <div className="flex justify-between rounded bg-amber-500/10 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.patientShare")}</span><MoneyText fils={inv.patientFils} /></div>
          <div className="flex justify-between rounded bg-teal-500/10 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.insurerShare")}</span><MoneyText fils={inv.insurerFils} /></div>
          <div className="flex justify-between rounded bg-emerald-500/15 px-3 py-2 font-semibold"><span>{t(`bc.pay.method.${result.payment.method}`)}</span><MoneyText fils={result.payment.amountFils} /></div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
          <div className="text-center space-y-1">
            <Code128 value={result.payment.code} height={48} />
            <p className="text-[10px] text-muted-foreground font-mono">{t("bc.pay.receiptNo")}</p>
          </div>
          <div className="text-center space-y-1">
            <QrCode value={result.payment.receiptQr} size={104} />
            <p className="text-[10px] text-muted-foreground max-w-40">{t("bc.pay.verifyQr")}</p>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground border-t pt-3">{t("bc.pay.notice.cards")}</p>
      </CardContent>
    </Card>
  );
}

export function PayTab({ invoices, preselected, onPaid, onClearPreselected }: {
  invoices: SessionInvoice[];
  preselected: SessionInvoice | null;
  onPaid: (invoiceId: string, payment: SessionPayment, invoiceStatus: string) => void;
  onClearPreselected: () => void;
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [target, setTarget] = useState<SessionInvoice | null>(null);
  const [method, setMethod] = useState<Method>("cash");
  const [amount, setAmount] = useState("");
  const [idem, setIdem] = useState(newIdemKey());
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ inv: SessionInvoice; result: PayResult } | null>(null);

  const payable = invoices.filter((i) => i.status === "issued" || i.status === "partial");

  useEffect(() => {
    if (preselected) { setTarget(preselected); setAmount(BHD3(preselected.patientFils)); setMethod("cash"); setIdem(newIdemKey()); onClearPreselected(); }
  }, [preselected, onClearPreselected]);

  const openDialog = (inv: SessionInvoice) => { setTarget(inv); setAmount(BHD3(inv.patientFils)); setMethod("cash"); setIdem(newIdemKey()); };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; code: string; method: Method; amountFils: number; paidSoFar: number; invoiceStatus: string; receiptQr: string }>("/api/staff/payments/pay", {
        invoiceId: target.id, method, amountFils: FILS(amount), idempotencyKey: idem,
      });
      const payment: SessionPayment = { id: r.id, code: r.code, invoiceCode: target.code, method: r.method, amountFils: r.amountFils, at: new Date().toISOString(), receiptQr: r.receiptQr };
      const result: PayResult = { payment, paidSoFar: r.paidSoFar, invoiceStatus: r.invoiceStatus };
      setReceipt({ inv: target, result });
      onPaid(target.id, payment, r.invoiceStatus);
      setTarget(null);
      toast({ title: r.code, description: `${t("bc.pay.done")} — ${t("bc.pay.invoiceStatus")}: ${t(`status.${r.invoiceStatus}`)}` });
    } catch (err) {
      const e = err as { status?: number; problem?: Record<string, unknown> };
      if (e.status === 409 && e.problem?.code === "IDEMPOTENT_DUP") {
        toast({ title: t("common.error"), description: t("bc.pay.dup", { code: String(e.problem.existingCode ?? "") }), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">{t("bc.pay.pick")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("bc.pay.pickHint")}</p>
          {receipt && <Receipt inv={receipt.inv} result={receipt.result} onClose={() => setReceipt(null)} />}
          {payable.length === 0 && !receipt ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("bc.pay.pickHint")}</div>
          ) : (
            <div className="grid gap-2">
              {payable.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5">
                  <span className="font-mono text-sm">{inv.code}</span>
                  <span className="text-sm truncate">{inv.patientName}</span>
                  <span className="text-xs text-muted-foreground">{t("bc.inv.patientShare")}:</span><MoneyText fils={inv.patientFils} className="text-sm" />
                  <Button size="sm" className="ms-auto h-9" onClick={() => openDialog(inv)}><Banknote aria-hidden /> {t("bc.inv.pay")}</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("bc.pay.dialog")}</DialogTitle>
            <DialogDescription>{target ? `${target.code} — ${target.patientName}` : ""}</DialogDescription>
          </DialogHeader>
          {target && (
            <div className="space-y-4">
              <div className="flex justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("bc.inv.patientShare")}</span><MoneyText fils={target.patientFils} />
              </div>
              <div className="space-y-2">
                <Label>{t("bc.pay.method")}</Label>
                <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="grid grid-cols-3 gap-2">
                  {(["cash", "card", "benefit"] as Method[]).map((m) => (
                    <label key={m} className="flex flex-col items-center justify-center gap-1 rounded-lg border p-3 cursor-pointer has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/10 text-center min-h-11">
                      <RadioGroupItem value={m} className="sr-only" />
                      {METHOD_ICON[m]}
                      <span className="text-xs font-medium">{t(`bc.pay.method.${m}`)}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-amount">{t("bc.pay.amount")}</Label>
                <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 font-mono" dir="ltr" />
                <p className="text-xs text-muted-foreground">{t("bc.pay.amountHint")}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-idem">{t("bc.pay.idem")}</Label>
                <div className="flex gap-2">
                  <Input id="pay-idem" value={idem} readOnly className="h-10 font-mono text-xs" dir="ltr" />
                  <Button variant="outline" size="icon" className="size-10 shrink-0" onClick={() => setIdem(newIdemKey())} aria-label={t("bc.pay.retryKey")}><RefreshCw className="size-4" aria-hidden /></Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("bc.pay.idemHint")}</p>
              </div>
              <Alert>
                <ShieldCheck className="size-4" aria-hidden />
                <AlertDescription>{t("bc.pay.notice.cards")}</AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>{t("common.cancel")}</Button>
            <Button className="h-11" disabled={busy || !amount.trim()} onClick={submit}>{busy ? t("common.loading") : t("bc.pay.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
