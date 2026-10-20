"use client";
/**
 * New-invoice builder (agent 2-e) — line builder dialog (kind/nameAr/nameEn/
 * unitFils/qty/isDrug 0% VAT) + discount + quotation mode → POST invoices/create
 * → breakdown card (subtotal/VAT/total/patient/insurer + capped) + accept-quotation.
 */
import { useState } from "react";
import { useI18n } from "@/i18n";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { FILS } from "@/lib/money";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FilePlus2, Plus, Trash2, BadgeCheck, TriangleAlert } from "lucide-react";
import { problemDetail, type InvoiceLine, type LineDraft, type LineKind, type PickedPatient, type SessionInvoice } from "./billing-types";

const KINDS: LineKind[] = ["consultation", "lab", "imaging", "drug", "consent", "home"];
const newLine = (): LineDraft => ({ kind: "consultation", nameAr: "", nameEn: "", unitBhd: "", qty: 1, isDrug: false });

export function NewInvoice({ patient, onCreated, onQuotationAccepted }: {
  patient: PickedPatient | null;
  onCreated: (inv: SessionInvoice) => void;
  onQuotationAccepted: (invoiceId: string) => void;
}) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [discount, setDiscount] = useState("");
  const [quotation, setQuotation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SessionInvoice | null>(null);
  const [acceptedBy, setAcceptedBy] = useState("");
  const [acceptBusy, setAcceptBusy] = useState(false);

  const valid = lines.some((l) => l.unitBhd.trim() !== "" && FILS(l.unitBhd) > 0 && l.qty >= 1);

  const submit = async () => {
    if (!patient) return;
    setBusy(true);
    try {
      const payload = {
        patientId: patient.id,
        isQuotation: quotation,
        discountFils: discount.trim() ? FILS(discount) : 0,
        lines: lines.filter((l) => FILS(l.unitBhd) > 0).map((l) => ({
          kind: l.kind, nameAr: l.nameAr, nameEn: l.nameEn, unitFils: FILS(l.unitBhd), qty: l.qty, isDrug: l.isDrug || l.kind === "drug",
        })),
      };
      const r = await apiPost<SessionInvoice & { lines: InvoiceLine[] }>("/api/staff/invoices/create", payload);
      const inv: SessionInvoice = { ...r, patientId: patient.id, patientName: lang === "ar" ? patient.nameAr : patient.nameEn || patient.nameAr, status: r.isQuotation ? "draft" : "issued" };
      setLast(inv);
      onCreated(inv);
      setOpen(false);
      setLines([newLine()]); setDiscount(""); setQuotation(false);
      toast({ title: inv.code, description: t("bc.inv.result") });
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const accept = async () => {
    if (!last) return;
    setAcceptBusy(true);
    try {
      await apiPost("/api/staff/invoices/accept-quotation", { invoiceId: last.id, acceptedBy: acceptedBy || undefined });
      const upd = { ...last, status: "issued" as const };
      setLast(upd);
      onQuotationAccepted(last.id);
      toast({ title: last.code, description: t("bc.inv.accepted") });
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
    } finally { setAcceptBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="py-4">
        <CardTitle className="text-base flex items-center gap-2"><FilePlus2 className="size-4 text-primary" aria-hidden /> {t("bc.inv.new")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-11" disabled={!patient} title={patient ? undefined : t("bc.inv.needsPatient")}>
              <Plus aria-hidden /> {t(quotation ? "bc.inv.createQuotation" : "bc.inv.new")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("bc.inv.builder")}</DialogTitle>
              <DialogDescription>{patient ? `${patient.nameAr} · ${patient.mrn}` : ""}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {lines.map((l, i) => (
                <div key={i} className="grid sm:grid-cols-12 gap-2 items-end rounded-lg border p-3">
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs">{t("bc.inv.kind")}</Label>
                    <Select value={l.kind} onValueChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, kind: v as LineKind } : x))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{t(`bc.kind.${k}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <Label className="text-xs">{t("bc.inv.nameAr")}</Label>
                    <Input value={l.nameAr} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, nameAr: e.target.value } : x))} className="h-10" dir="rtl" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">{t("bc.inv.nameEn")}</Label>
                    <Input value={l.nameEn} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, nameEn: e.target.value } : x))} className="h-10" dir="ltr" />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">{t("bc.inv.unit")}</Label>
                    <Input inputMode="decimal" value={l.unitBhd} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unitBhd: e.target.value } : x))} className="h-10 font-mono" placeholder="15.000" dir="ltr" />
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <Label className="text-xs">{t("common.quantity")}</Label>
                    <Input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} className="h-10 font-mono" dir="ltr" />
                  </div>
                  <div className="sm:col-span-1 flex items-center justify-between gap-1">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer" title={t("bc.inv.drug")}>
                      <Checkbox checked={l.isDrug} onCheckedChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, isDrug: v === true } : x))} aria-label={t("bc.inv.drug")} />
                      <span className="leading-tight">VAT<br />0%</span>
                    </label>
                    {lines.length > 1 && (
                      <Button variant="ghost" size="icon" className="size-9 text-destructive" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={t("common.remove")}><Trash2 className="size-4" aria-hidden /></Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="h-10" onClick={() => setLines([...lines, newLine()])}><Plus aria-hidden /> {t("bc.inv.addLine")}</Button>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("bc.inv.discount")}</Label>
                  <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.000" className="h-10 font-mono" dir="ltr" />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="quotation-switch">{t("bc.inv.quotation")}</Label>
                    <p className="text-xs text-muted-foreground">{t("bc.inv.quotationHint")}</p>
                  </div>
                  <Switch id="quotation-switch" checked={quotation} onCheckedChange={setQuotation} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button className="h-11" disabled={!valid || busy} onClick={submit}>{busy ? t("common.loading") : t(quotation ? "bc.inv.createQuotation" : "bc.inv.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {last && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{last.code}</span>
              <StatusBadge status={last.status} />
              <span className="text-sm text-muted-foreground">{last.patientName}</span>
              <span className="ms-auto text-xs text-muted-foreground font-mono">{t("bc.inv.vat")}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.subtotal")}</span><MoneyText fils={last.subtotalFils} /></div>
              <div className="flex justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.vat")}</span><MoneyText fils={last.vatFils} /></div>
              {last.discountFils > 0 && <div className="flex justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.discount")}</span><MoneyText fils={-last.discountFils} /></div>}
              <div className="flex justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 font-semibold"><span>{t("bc.inv.total")}</span><MoneyText fils={last.totalFils} /></div>
              <div className="flex justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.patientShare")}</span><MoneyText fils={last.patientFils} /></div>
              <div className="flex justify-between gap-2 rounded-lg bg-teal-500/10 px-3 py-2"><span className="text-muted-foreground">{t("bc.inv.insurerShare")}</span><MoneyText fils={last.insurerFils} /></div>
            </div>
            {last.capped && (
              <Alert>
                <TriangleAlert className="size-4" aria-hidden />
                <AlertDescription>{t("bc.inv.cappedHint")}</AlertDescription>
              </Alert>
            )}
            {last.insurerFils === 0 && <p className="text-xs text-muted-foreground">{t("bc.inv.noPatientPolicy")}</p>}
            {last.isQuotation && last.status === "draft" && (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
                <div className="space-y-1 flex-1 min-w-40">
                  <Label>{t("bc.inv.acceptedBy")}</Label>
                  <Input value={acceptedBy} onChange={(e) => setAcceptedBy(e.target.value)} className="h-10" />
                </div>
                <Button className="h-11" disabled={acceptBusy} onClick={accept}><BadgeCheck aria-hidden /> {t("bc.inv.accept")}</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
