"use client";
/**
 * Pre-authorizations tab (agent 2-e) — list w/ status badges, new request
 * (patient + payer + serviceRef + amount), approve (approvedRef) / reject.
 */
import { useCallback, useEffect, useState } from "react";
import { useI18n, bi } from "@/i18n";
import { apiGet, apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { FILS } from "@/lib/money";
import { bhDateString } from "@/lib/bahrain";
import { MoneyText, StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeCheck, FileCheck2, Plus, ShieldX, XCircle } from "lucide-react";
import { PAYERS, problemDetail, type PickedPatient } from "./billing-types";
import { PatientPicker } from "./billing-patient";

interface Preauth {
  id: string; code: string; status: string; serviceRef: string;
  requestedAt: string; approvedRef: string | null; amountFils: number;
  patient: { mrn: string; nameAr: string };
}

export function PreauthsTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<Preauth[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setRows(null); setError(null); setForbidden(false);
    try {
      setRows(await apiGet<Preauth[]>("/api/staff/preauths/list"));
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 403) setForbidden(true); else setError(problemDetail(err, lang) || t("common.error"));
    }
  }, [lang, t]);

  useEffect(() => { void load(); }, [load]);

  // new request dialog
  const [newOpen, setNewOpen] = useState(false);
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [payer, setPayer] = useState("");
  const [serviceRef, setServiceRef] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const submitNew = async () => {
    if (!patient || !serviceRef.trim()) return;
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; code: string }>("/api/staff/preauths/request", {
        patientId: patient.id, payerId: payer || PAYERS[0].code, serviceRef: serviceRef.trim(), amountFils: FILS(amount || "0"),
      });
      toast({ title: r.code, description: t("bc.pa.created", { code: r.code }) });
      setNewOpen(false); setPatient(null); setPayer(""); setServiceRef(""); setAmount("");
      void load();
    } catch (err) { toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" }); }
    finally { setBusy(false); }
  };

  // approve/reject
  const [action, setAction] = useState<{ pa: Preauth; kind: "approve" | "reject" } | null>(null);
  const [refInput, setRefInput] = useState("");
  const [reason, setReason] = useState("");
  const apply = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await apiPost("/api/staff/preauths/approve", action.kind === "approve"
        ? { preauthId: action.pa.id, approvedRef: refInput.trim() || undefined }
        : { preauthId: action.pa.id, reject: reason.trim() });
      toast({ title: t("common.done"), description: t(action.kind === "approve" ? "bc.pa.approved" : "bc.pa.rejected") });
      setAction(null); setRefInput(""); setReason("");
      void load();
    } catch (err) { toast({ title: t("common.error"), description: problemDetail(err, lang), variant: "destructive" }); }
    finally { setBusy(false); }
  };

  if (forbidden) {
    return (
      <Card><CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
        <ShieldX className="size-5 text-amber-600 shrink-0" aria-hidden /> {t("bc.insuranceOnly")}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileCheck2 className="size-5 text-primary" aria-hidden /> {t("bc.pa.title")}</h2>
        <Button className="ms-auto h-11" onClick={() => setNewOpen(true)}><Plus aria-hidden /> {t("bc.pa.new")}</Button>
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
                <th className="text-start font-medium px-3 py-2">{t("common.code")}</th>
                <th className="text-start font-medium px-3 py-2">{t("common.name")}</th>
                <th className="text-start font-medium px-3 py-2">{t("bc.pa.service")}</th>
                <th className="text-start font-medium px-3 py-2">{t("bc.cl.billed")}</th>
                <th className="text-start font-medium px-3 py-2">{t("bc.pa.requested")}</th>
                <th className="text-start font-medium px-3 py-2">{t("common.status")}</th>
                <th className="text-start font-medium px-3 py-2">{t("bc.pa.approveRef")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pa) => (
                <tr key={pa.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{pa.code}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><div className="font-medium">{pa.patient.nameAr}</div><div className="text-xs text-muted-foreground font-mono">{pa.patient.mrn}</div></td>
                  <td className="px-3 py-2.5 font-mono text-xs">{pa.serviceRef}</td>
                  <td className="px-3 py-2.5"><MoneyText fils={pa.amountFils} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs">{bhDateString(pa.requestedAt)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={pa.status} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs">{pa.approvedRef ?? "—"}</td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap">
                    {pa.status === "submitted" || pa.status === "requested" ? (
                      <div className="flex gap-1.5 justify-end">
                        <Button variant="outline" size="sm" className="h-9 text-emerald-700 dark:text-emerald-300 border-emerald-600/40" onClick={() => { setAction({ pa, kind: "approve" }); setRefInput(""); }}><BadgeCheck aria-hidden /> {t("bc.pa.approve")}</Button>
                        <Button variant="outline" size="sm" className="h-9 text-rose-700 dark:text-rose-300 border-rose-600/40" onClick={() => { setAction({ pa, kind: "reject" }); setReason(""); }}>{t("bc.pa.reject")}</Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{t("common.empty")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("bc.pa.new")}</DialogTitle><DialogDescription>{t("bc.pa.serviceHint")}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <PatientPicker selected={patient} onSelect={setPatient} onClear={() => setPatient(null)} />
            <div className="space-y-1">
              <Label>{t("bc.pa.payer")}</Label>
              <Select value={payer} onValueChange={setPayer}>
                <SelectTrigger className="h-11"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                <SelectContent>
                  {PAYERS.map((p) => <SelectItem key={p.code} value={p.code}>{bi(lang, `${p.code} — ${p.ar}`, `${p.code} — ${p.en}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("bc.pa.service")}</Label>
                <Input value={serviceRef} onChange={(e) => setServiceRef(e.target.value)} placeholder="BR-SURG-BIOPSY" className="h-11 font-mono" dir="ltr" />
              </div>
              <div className="space-y-1">
                <Label>{t("bc.pa.amount")}</Label>
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500.000" className="h-11 font-mono" dir="ltr" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>{t("common.cancel")}</Button>
            <Button className="h-11" disabled={busy || !patient || !serviceRef.trim()} onClick={submitNew}>{busy ? t("common.loading") : t("bc.pa.request")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(action?.kind === "approve" ? "bc.pa.approve" : "bc.pa.reject")} — {action?.pa.code}</DialogTitle>
            <DialogDescription>{action?.pa.patient.nameAr} · {action?.pa.serviceRef}</DialogDescription>
          </DialogHeader>
          {action?.kind === "approve" ? (
            <div className="space-y-1">
              <Label>{t("bc.pa.approveRef")}</Label>
              <Input value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="GM-AUTH-77213" className="h-11 font-mono" dir="ltr" />
              <p className="text-xs text-muted-foreground">{t("bc.pa.approveRefHint")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>{t("bc.pa.rejectReason")}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAction(null)}>{t("common.cancel")}</Button>
            <Button className="h-11" variant={action?.kind === "reject" ? "destructive" : "default"} disabled={busy || (action?.kind === "reject" && !reason.trim())} onClick={apply}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
