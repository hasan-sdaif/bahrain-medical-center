"use client";
/**
 * الفوترة والتأمين (S3) — tab shell wiring agent 2-e helpers + claims (S3).
 * Tabs mirror the server RBAC matrix: billing-perm roles (cashier/insurance/
 * center-manager) see invoices/pay/shifts; insurance-only roles also see
 * preauths/claims (src/server/perm.ts).
 */
import { useCallback, useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useI18n } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InvoicesTab } from "./billing-invoices";
import { PayTab } from "./billing-pay";
import { ShiftsTab } from "./billing-shifts";
import { PreauthsTab } from "./billing-preauth";
import { ClaimsTab } from "./billing-claims";
import { Banknote, Coins, FileCheck2, ReceiptText, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionInvoice, SessionPayment } from "./billing-types";

type TabKey = "invoices" | "pay" | "shifts" | "preauths" | "claims";

const BILLING_ROLES = new Set(["cashier", "insurance", "center-manager"]);
const INSURANCE_ROLES = new Set(["insurance"]);
const TABS: readonly { key: TabKey; gate: Set<string>; icon: LucideIcon }[] = [
  { key: "invoices", gate: BILLING_ROLES, icon: ReceiptText },
  { key: "pay", gate: BILLING_ROLES, icon: Banknote },
  { key: "shifts", gate: BILLING_ROLES, icon: Coins },
  { key: "preauths", gate: INSURANCE_ROLES, icon: FileCheck2 },
  { key: "claims", gate: INSURANCE_ROLES, icon: Send },
];

export default function Billing() {
  const { staff } = useApp();
  const { t } = useI18n();
  const role = staff?.role ?? "";
  const tabs = useMemo(() => TABS.filter((x) => x.gate.has(role)).map((x) => x.key), [role]);
  const [tab, setTab] = useState<TabKey | null>(null);
  const active = tab && tabs.includes(tab) ? tab : (tabs[0] ?? null);

  // session-shared state across tabs (invoices → pay → shifts → claims)
  const [invoices, setInvoices] = useState<SessionInvoice[]>([]);
  const [payments, setPayments] = useState<SessionPayment[]>([]);
  const [preselected, setPreselected] = useState<SessionInvoice | null>(null);

  const created = (inv: SessionInvoice) => setInvoices((xs) => [inv, ...xs]);
  const quotationAccepted = (invoiceId: string) =>
    setInvoices((xs) => xs.map((i) => (i.id === invoiceId ? { ...i, status: "issued" as const } : i)));
  const pay = (inv: SessionInvoice) => { setPreselected(inv); setTab("pay"); };
  const paid = (invoiceId: string, payment: SessionPayment, invoiceStatus: string) => {
    setInvoices((xs) => xs.map((i) => (i.id === invoiceId ? { ...i, status: invoiceStatus as SessionInvoice["status"] } : i)));
    setPayments((xs) => [payment, ...xs]);
  };
  const claimed = (invoiceIds: string[], claimCode: string) =>
    setInvoices((xs) => xs.map((i) => (invoiceIds.includes(i.id) ? { ...i, claimCode } : i)));
  const clearPreselected = useCallback(() => setPreselected(null), []);

  if (!active) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("bc.forbidden")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{t("bc.title")}</h1>
        <Badge variant="outline" className="font-normal text-muted-foreground">{t(`staff.role.${role}`)}</Badge>
      </header>
      <p className="text-sm text-muted-foreground">{t("bc.subtitle")}</p>

      <Tabs value={active} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key} className="h-9 flex-none gap-1.5 px-3">
              {(() => { const Icon = TABS.find((x) => x.key === key)?.icon; return Icon ? <Icon aria-hidden className="size-4" /> : null; })()}
              {t(`bc.tab.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="invoices" className="mt-3">
          <InvoicesTab invoices={invoices} onCreated={created} onQuotationAccepted={quotationAccepted} onPay={pay} />
        </TabsContent>
        <TabsContent value="pay" className="mt-3">
          <PayTab invoices={invoices} preselected={preselected} onPaid={paid} onClearPreselected={clearPreselected} />
        </TabsContent>
        <TabsContent value="shifts" className="mt-3">
          <ShiftsTab payments={payments} />
        </TabsContent>
        <TabsContent value="preauths" className="mt-3">
          <PreauthsTab />
        </TabsContent>
        <TabsContent value="claims" className="mt-3">
          <ClaimsTab invoices={invoices} onClaimed={claimed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
