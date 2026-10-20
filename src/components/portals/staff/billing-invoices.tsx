"use client";
/**
 * Invoices tab (agent 2-e) — patient quick-search → create (billing-new) +
 * session invoice list (pay shortcut) + seeded demo reference picker.
 */
import { useState } from "react";
import { useI18n } from "@/i18n";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Banknote, History, ReceiptText } from "lucide-react";
import { PatientPicker } from "./billing-patient";
import { NewInvoice } from "./billing-new";
import { SEEDED_INVOICES, type PickedPatient, type SessionInvoice } from "./billing-types";

function SessionList({ invoices, onPay }: { invoices: SessionInvoice[]; onPay: (inv: SessionInvoice) => void }) {
  const { t, lang } = useI18n();
  if (invoices.length === 0) return <p className="text-sm text-muted-foreground">{t("bc.pay.pickHint")}</p>;
  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 text-xs text-muted-foreground">
            <th className="text-start font-medium px-3 py-2">{t("common.code")}</th>
            <th className="text-start font-medium px-3 py-2">{t("common.name")}</th>
            <th className="text-start font-medium px-3 py-2">{t("bc.inv.total")}</th>
            <th className="text-start font-medium px-3 py-2">{t("bc.inv.patientShare")}</th>
            <th className="text-start font-medium px-3 py-2">{t("bc.inv.insurerShare")}</th>
            <th className="text-start font-medium px-3 py-2">{t("common.status")}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{inv.code}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{inv.patientName}</td>
              <td className="px-3 py-2.5"><MoneyText fils={inv.totalFils} /></td>
              <td className="px-3 py-2.5"><MoneyText fils={inv.patientFils} /></td>
              <td className="px-3 py-2.5"><MoneyText fils={inv.insurerFils} /></td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge status={inv.status} />
                  {inv.claimCode && <span className="text-[10px] font-mono text-muted-foreground">{inv.claimCode}</span>}
                </div>
              </td>
              <td className="px-3 py-2.5 text-end">
                {inv.status === "issued" || inv.status === "partial" ? (
                  <Button size="sm" className="h-9" onClick={() => onPay(inv)}><Banknote aria-hidden /> {t("bc.inv.pay")}</Button>
                ) : inv.isQuotation && inv.status === "draft" ? (
                  <span className="text-xs text-muted-foreground">{t("bc.inv.quotation")}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-muted-foreground border-t">{lang === "ar" ? `عدد الفواتير: ${invoices.length}` : `${invoices.length} invoice(s)`}</p>
    </div>
  );
}

function SeededPicker() {
  const { t, lang } = useI18n();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {SEEDED_INVOICES.map((s) => (
        <div key={s.code} className="rounded-xl border border-dashed p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-sm">{s.code}</span>
            <StatusBadge status={s.status} />
          </div>
          <div className="text-sm">{s.patient}</div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="flex justify-between rounded bg-muted/60 px-2 py-1.5"><span className="text-muted-foreground">{t("bc.inv.subtotal")}</span><MoneyText fils={s.subtotalFils} currency={false} /></div>
            <div className="flex justify-between rounded bg-muted/60 px-2 py-1.5"><span className="text-muted-foreground">{t("bc.inv.vat")}</span><MoneyText fils={s.vatFils} currency={false} /></div>
            <div className="flex justify-between rounded bg-primary/10 px-2 py-1.5 font-semibold"><span>{t("bc.inv.total")}</span><MoneyText fils={s.totalFils} currency={false} /></div>
            <div className="flex justify-between rounded bg-amber-500/10 px-2 py-1.5"><span className="text-muted-foreground">{t("bc.inv.patientShare")}</span><MoneyText fils={s.patientFils} currency={false} /></div>
            <div className="flex justify-between rounded bg-teal-500/10 px-2 py-1.5 col-span-2"><span className="text-muted-foreground">{t("bc.inv.insurerShare")}</span><MoneyText fils={s.insurerFils} currency={false} /></div>
          </div>
          <p className="text-xs text-muted-foreground">{lang === "ar" ? s.noteAr : s.noteEn}</p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground md:col-span-2">{t("bc.inv.seededHint")}</p>
    </div>
  );
}

export function InvoicesTab({ invoices, onCreated, onQuotationAccepted, onPay }: {
  invoices: SessionInvoice[];
  onCreated: (inv: SessionInvoice) => void;
  onQuotationAccepted: (invoiceId: string) => void;
  onPay: (inv: SessionInvoice) => void;
}) {
  const { t } = useI18n();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-4"><CardTitle className="text-base">{t("bc.patient.pick")}</CardTitle></CardHeader>
        <CardContent><PatientPicker selected={patient} onSelect={setPatient} onClear={() => setPatient(null)} /></CardContent>
      </Card>
      <NewInvoice patient={patient} onCreated={onCreated} onQuotationAccepted={onQuotationAccepted} />
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2"><History className="size-4 text-primary" aria-hidden /> {t("bc.inv.session")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("bc.inv.sessionHint")}</p>
          <SessionList invoices={invoices} onPay={onPay} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2"><ReceiptText className="size-4 text-primary" aria-hidden /> {t("bc.inv.seeded")}</CardTitle>
        </CardHeader>
        <CardContent><SeededPicker /></CardContent>
      </Card>
    </div>
  );
}

/** Lazy tab scaffold — keeps billing.tsx slim. */
export function TabSkeleton() {
  return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
}
