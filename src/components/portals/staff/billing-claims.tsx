"use client";
/**
 * Claims tab (S3) — claims lifecycle: list, submit (patient + invoice
 * checkboxes + payer), resubmit rejected w/ corrected ICD-10 coding, remit
 * (full/partial/reject). Invoice options = session invoices + seeded codes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { BHD3, FILS } from "@/lib/money";
import { bhDateString } from "@/lib/bahrain";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeCheck, FileText, Plus, RotateCcw, ShieldX, XCircle } from "lucide-react";
import { PAYERS, SEEDED_INVOICES, problemDetail, type PickedPatient, type SessionInvoice } from "./billing-types";
import { PatientPicker } from "./billing-patient";

interface Claim { id: string; code: string; status: string; billedFils: number; approvedFils: number; rejectReason: string | null; submittedAt: string | null }
interface ClaimOption { value: string; label: string; sub: string; fils: number; seeded: boolean }
const TH = "text-start font-medium px-3 py-2";

export function ClaimsTab({ invoices, onClaimed }: { invoices: SessionInvoice[]; onClaimed: (invoiceIds: string[], claimCode: string) => void }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setRows(null); setError(null); setForbidden(false);
    try {
      setRows(await apiGet<Claim[]>("/api/staff/claims/list"));
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403) setForbidden(true); else setError(problemDetail(err, lang) || t("common.error"));
    }
  }, [lang, t]);

  useEffect(() => { void load(); }, [load]);

  // ── submit / resubmit dialog ─────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [resubmitOf, setResubmitOf] = useState<Claim | null>(null);
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [payer, setPayer] = useState("auto");
  const [picked, setPicked] = useState<string[]>([]);
  const [coding, setCoding] = useState("");
  const [busy, setBusy] = useState(false);

  const options = useMemo<ClaimOption[]>(() => [
    ...invoices.filter((i) => !i.claimCode && i.insurerFils > 0)
      .map((i) => ({ value: i.id, label: i.code, sub: i.patientName, fils: i.insurerFils, seeded: false })),
    ...SEEDED_INVOICES.map((s) => ({ value: s.code, label: s.code, sub: s.patient, fils: s.insurerFils, seeded: true })),
  ], [invoices]);

  const openDialog = (claim: Claim | null) => { setResubmitOf(claim); setPatient(null); setPayer("auto"); setPicked([]); setCoding(""); setOpen(true); };

  const submit = async () => {
    if (!patient || picked.length === 0) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { invoiceIds: picked, patientId: patient.id };
      if (payer !== "auto") body.payerId = payer;
      if (resubmitOf) {
        body.resubmitOf = resubmitOf.id;
        if (coding.trim()) body.correctedCoding = coding.trim();
      }
      const r = await apiPost<{ id: string; code: string }>("/api/staff/claims/submit", body);
      toast({ title: `✅ ${r.code}`, description: t("bc.cl.submitted", { code: r.code }) });
      onClaimed(picked.filter((v) => invoices.some((i) => i.id === v)), r.code);
      setOpen(false);
      void load();
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  // ── remit (full direct · partial/reject via dialog) ──────────────────────
  const [remit, setRemit] = useState<{ claim: Claim; kind: "partial" | "reject" } | null>(null);
  const [approvedAmt, setApprovedAmt] = useState("");
  const [reason, setReason] = useState("");

  const applyRemit = async (claim: Claim, body: Record<string, unknown>, done: () => void) => {
    setBusy(true);
    try {
      await apiPost("/api/staff/claims/remit", { claimId: claim.id, ...body });
      toast({ title: `✅ ${claim.code}`, description: t("bc.cl.remitted") });
      done();
      void load();
    } catch (err) {
      toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (forbidden) return (
    <Card><CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
      <ShieldX className="size-5 text-amber-600 shrink-0" aria-hidden /> {t("bc.insuranceOnly")}
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="size-5 text-primary" aria-hidden /> {t("bc.cl.title")}</h2>
        <Button className="ms-auto h-11" onClick={() => openDialog(null)}><Plus aria-hidden /> {t("bc.cl.new")}</Button>
      </div>

      {error && (
        <Card><CardContent className="p-4 flex items-center gap-3">
          <XCircle className="size-5 text-destructive shrink-0" aria-hidden />
          <span className="text-sm">{error}</span>
          <Button variant="outline" size="sm" className="ms-auto h-9" onClick={() => void load()}>{t("common.retry")}</Button>
        </CardContent></Card>
      )}
      {rows === null && !error && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}

      {rows !== null && (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-xs text-muted-foreground">
                <th className={TH}>{t("common.code")}</th>
                <th className={TH}>{t("common.status")}</th>
                <th className={TH}>{t("bc.cl.billed")}</th>
                <th className={TH}>{t("bc.cl.approved")}</th>
                <th className={TH}>{t("bc.cl.rejectReason")}</th>
                <th className={TH}>{t("bc.cl.submittedAt")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.code}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2.5"><MoneyText fils={c.billedFils} /></td>
                  <td className="px-3 py-2.5">{c.approvedFils > 0 ? <MoneyText fils={c.approvedFils} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5 max-w-52">{c.rejectReason
                    ? <span className="text-xs text-amber-700 dark:text-amber-300">{c.rejectReason}</span>
                    : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.submittedAt ? bhDateString(c.submittedAt) : "—"}</td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap">
                    {c.status === "submitted" ? (
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="outline" size="sm" className="h-9 text-emerald-700 dark:text-emerald-300 border-emerald-600/40" disabled={busy}
                          onClick={() => void applyRemit(c, { approve: true }, () => null)}><BadgeCheck aria-hidden /> {t("bc.cl.remitFull")}</Button>
                        <Button variant="outline" size="sm" className="h-9" disabled={busy}
                          onClick={() => { setRemit({ claim: c, kind: "partial" }); setApprovedAmt(BHD3(c.billedFils)); }}>{t("bc.cl.remitPartial")}</Button>
                        <Button variant="outline" size="sm" className="h-9 text-rose-700 dark:text-rose-300 border-rose-600/40" disabled={busy}
                          onClick={() => { setRemit({ claim: c, kind: "reject" }); setReason(""); }}>{t("bc.cl.remitReject")}</Button>
                      </div>
                    ) : c.status === "rejected" ? (
                      <Button variant="outline" size="sm" className="h-9" onClick={() => openDialog(c)}><RotateCcw aria-hidden /> {t("bc.cl.resubmit")}</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{t("common.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* submit / resubmit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{resubmitOf ? `${t("bc.cl.resubmit")} — ${resubmitOf.code}` : t("bc.cl.new")}</DialogTitle>
            <DialogDescription>{resubmitOf ? t("bc.cl.correctedHint") : t("bc.cl.invoicesHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <PatientPicker selected={patient} onSelect={setPatient} onClear={() => setPatient(null)} />
            <div className="space-y-1.5">
              <Label>{t("bc.cl.invoices")}</Label>
              <div className="rounded-xl border divide-y max-h-52 overflow-y-auto">
                {options.map((o) => (
                  <label key={o.value} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40 min-h-11">
                    <Checkbox checked={picked.includes(o.value)} aria-label={o.label}
                      onCheckedChange={(v) => setPicked(v === true ? [...picked, o.value] : picked.filter((x) => x !== o.value))} />
                    <span className="font-mono text-xs whitespace-nowrap">{o.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{o.sub}</span>
                    {o.seeded && <Badge variant="outline" className="text-[10px] shrink-0 font-normal">{t("bc.cl.seeded")}</Badge>}
                    <MoneyText fils={o.fils} className="text-xs shrink-0 ms-auto" />
                  </label>
                ))}
              </div>
              {picked.length === 0 && <p className="text-xs text-muted-foreground">ℹ️ {t("bc.cl.selectInvoice")}</p>}
            </div>
            <div className="space-y-1">
              <Label>{t("bc.pa.payer")}</Label>
              <Select value={payer} onValueChange={setPayer}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("bc.cl.payerAuto")}</SelectItem>
                  {PAYERS.map((p) => <SelectItem key={p.code} value={p.code}>{bi(lang, `${p.code} — ${p.ar}`, `${p.code} — ${p.en}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {resubmitOf && (
              <div className="space-y-1">
                <Label>{t("bc.cl.corrected")}</Label>
                <Input value={coding} onChange={(e) => setCoding(e.target.value)} placeholder="E11.9 + D24.2" className="h-11 font-mono" dir="ltr" />
                <p className="text-xs text-muted-foreground">{t("bc.cl.correctedHint")}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button className="h-11" disabled={busy || !patient || picked.length === 0} onClick={submit}>{busy ? t("common.loading") : t(resubmitOf ? "bc.cl.resubmit" : "bc.cl.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* remit partial / reject */}
      <Dialog open={!!remit} onOpenChange={(o) => !o && setRemit(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(remit?.kind === "reject" ? "bc.cl.remitReject" : "bc.cl.remitPartial")} — {remit?.claim.code}</DialogTitle>
            <DialogDescription><MoneyText fils={remit?.claim.billedFils ?? 0} /> · {t("bc.cl.billed")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>{t(remit?.kind === "reject" ? "bc.cl.rejectReason" : "bc.cl.partialAmount")}</Label>
            {remit?.kind === "reject"
              ? <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
              : <Input inputMode="decimal" value={approvedAmt} onChange={(e) => setApprovedAmt(e.target.value)} placeholder="30.000" className="h-11 font-mono" dir="ltr" />}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemit(null)}>{t("common.cancel")}</Button>
            <Button className="h-11" variant={remit?.kind === "reject" ? "destructive" : "default"}
              disabled={busy || (remit?.kind === "partial" ? !approvedAmt.trim() : !reason.trim())}
              onClick={() => remit && applyRemit(remit.claim, remit.kind === "partial"
                ? { approve: true, partial: true, approvedFils: FILS(approvedAmt) }
                : { rejectReason: reason.trim() }, () => setRemit(null))}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
