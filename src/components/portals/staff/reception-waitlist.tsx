"use client";
/**
 * reception-waitlist — قائمة الانتظار (الاستدعاءات): patients waiting for a
 * slot, priority-ordered; add from patient search; offer an appointment
 * (creates a requested Appointment + SMS notification) per row.
 */
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { bhDateString, bhTimeString } from "@/lib/bahrain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Plus, Search } from "lucide-react";
import { AssuranceDot, DEPARTMENTS, Empty, ErrorBox, LoadingRows, PRIORITY_OPTIONS, errText, setLastPatient, type SearchResp } from "./emr-shared";
import { cn } from "@/lib/utils";

interface WaitlistPatient { id: string; mrn: string; nameAr: string; nameEn?: string | null; phone?: string | null; assurance?: number }
interface WaitlistRow {
  id: string; status: string; priority: string; reasonAr: string | null; createdAt: string;
  patient: WaitlistPatient;
  dept: { code: string; nameAr: string; nameEn: string } | null;
}

const PRIO_TONE: Record<string, string> = {
  emergency: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  elderly: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  disabled: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  pregnant: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  child: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
};

/** datetime-local value for tomorrow 10:00 Bahrain wall clock (submitted with +03:00). */
function defaultSlot(): string {
  const b = new Date(Date.now() + 86400000);
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 10, 0)).toISOString().slice(0, 16);
}

export function ReceptionWaitlist() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResp | null>(null);
  const [patient, setPatient] = useState<WaitlistRow["patient"] | null>(null);
  const [dept, setDept] = useState("GP");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("normal");
  // offer dialog
  const [offerRow, setOfferRow] = useState<WaitlistRow | null>(null);
  const [slot, setSlot] = useState(defaultSlot());

  const load = useCallback(() => {
    setError(null);
    apiGet<WaitlistRow[]>("/api/staff/waitlist/list")
      .then(setRows)
      .catch((e) => { setError(errText(e, lang)); setRows([]); });
  }, [lang]);

  useEffect(load, [load]);

  const searchPatients = () => {
    const q = query.trim();
    if (!q) return;
    apiGet<SearchResp>(`/api/staff/patients/search?query=${encodeURIComponent(q)}`)
      .then(setResults)
      .catch((e) => toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" }));
  };

  const submitAdd = async () => {
    if (!patient) { toast({ title: t("common.error"), description: t("rec.wl.nopatient"), variant: "destructive" }); return; }
    setBusy(true);
    try {
      await apiPost("/api/staff/waitlist/add", { patientId: patient.id, deptCode: dept, reasonAr: reason.trim() || undefined, priority });
      toast({ title: t("rec.wl.added"), description: `${patient.nameAr} · ${t(`priority.${priority}`)}` });
      setAddOpen(false); setPatient(null); setResults(null); setQuery(""); setReason(""); setPriority("normal");
      load();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const submitOffer = async () => {
    if (!offerRow || !slot) return;
    setBusy(true);
    try {
      const r = await apiPost<{ appointmentCode: string }>("/api/staff/waitlist/offer", { id: offerRow.id, slotAt: `${slot}:00+03:00` });
      toast({ title: t("rec.wl.offered", { code: r.appointmentCode }), description: `${offerRow.patient.nameAr} · ${bhDateString(`${slot}:00+03:00`)} ${bhTimeString(`${slot}:00+03:00`)}` });
      setOfferRow(null); setSlot(defaultSlot());
      load();
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e, lang), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const PickRow = ({ p }: { p: WaitlistRow["patient"] }) => (
    <button type="button" onClick={() => setPatient(p)}
      className={cn("flex w-full items-center gap-2 rounded-md border p-2 text-start", patient?.id === p.id ? "border-primary bg-primary/5" : "bg-card hover:border-primary")}>
      <AssuranceDot level={p.assurance} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{bi(lang, p.nameAr, p.nameEn)}</span>
        <span className="block font-mono text-[11px] text-muted-foreground" dir="ltr">{p.mrn}{p.phone ? ` · ${p.phone}` : ""}</span>
      </span>
    </button>
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1 min-w-52">{t("rec.wl.desc")}</p>
        <Button size="sm" className="h-9" onClick={() => setAddOpen(true)}><Plus className="size-4" aria-hidden />{t("rec.wl.add")}</Button>
        <Button size="sm" variant="outline" className="h-9" onClick={load}>{t("common.refresh")}</Button>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <LoadingRows n={4} />}
      {rows && rows.length === 0 && <Empty label={t("rec.wl.empty")} className="py-10" />}
      {rows && rows.length > 0 && (
        <div className="rounded-lg border overflow-x-auto max-h-96 overflow-y-auto bmc-scroll">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 sticky top-0">
                <TableHead className="h-9 min-w-44">{t("rec.col.patient")}</TableHead>
                <TableHead className="h-9 min-w-24">{t("rec.wl.col.dept")}</TableHead>
                <TableHead className="h-9 min-w-36">{t("rec.wl.col.reason")}</TableHead>
                <TableHead className="h-9 w-24">{t("common.priority")}</TableHead>
                <TableHead className="h-9 w-28">{t("common.status")}</TableHead>
                <TableHead className="h-9 w-28">{t("common.date")}</TableHead>
                <TableHead className="h-9 w-32 text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id} className="[&>td]:py-1.5 [&>td]:px-2">
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AssuranceDot level={w.patient.assurance} />
                      <span className="font-medium truncate max-w-40">{bi(lang, w.patient.nameAr, w.patient.nameEn)}</span>
                      <span className="font-mono text-muted-foreground">{w.patient.mrn}</span>
                    </div>
                  </TableCell>
                  <TableCell className="truncate">{w.dept ? bi(lang, w.dept.nameAr, w.dept.nameEn) : "—"}</TableCell>
                  <TableCell className="truncate max-w-40" title={w.reasonAr ?? undefined}>{w.reasonAr ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("border-transparent text-[10px]", PRIO_TONE[w.priority] ?? "")}>{t(`priority.${w.priority}`)}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={cn("border-transparent text-[10px]", w.status === "waiting" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200")}>{t(`rec.wl.status.${w.status}`)}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap font-mono tabular-nums">{bhDateString(w.createdAt)} <span className="text-muted-foreground">{bhTimeString(w.createdAt)}</span></TableCell>
                  <TableCell className="text-end">
                    {w.status === "waiting" ? (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => { setOfferRow(w); setSlot(defaultSlot()); }}>
                        <CalendarClock className="size-3.5" aria-hidden />{t("rec.wl.offer")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setLastPatient({ id: w.patient.id, mrn: w.patient.mrn, nameAr: w.patient.nameAr }); toast({ title: t("rec.openfile.ok", { name: w.patient.nameAr }), description: t("rec.openfile.hint") }); }}>{t("rec.action.open")}</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* add-to-waitlist dialog: patient picker + dept + reason + priority */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="text-start">
            <DialogTitle className="text-sm">{t("rec.wl.addTitle")}</DialogTitle>
            <DialogDescription className="text-xs">{t("rec.wl.addDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="wl-patient" className="text-xs text-muted-foreground">{t("rec.wl.f.patient")}</Label>
              {patient ? (
                <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 p-2">
                  <AssuranceDot level={patient.assurance} />
                  <span className="flex-1 truncate text-sm font-medium">{bi(lang, patient.nameAr, patient.nameEn)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">{patient.mrn}</span>
                  <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPatient(null)}>{t("rec.wl.change")}</Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input id="wl-patient" className="h-11" value={query} onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") searchPatients(); }} placeholder={t("search.placeholder")} />
                    <Button type="button" variant="outline" className="h-11 px-4" onClick={searchPatients} disabled={!query.trim()}><Search className="size-4" aria-hidden />{t("common.search")}</Button>
                  </div>
                  {results && (
                    <div className="grid gap-1.5 max-h-40 overflow-y-auto bmc-scroll" role="listbox" aria-label={t("rec.wl.pickHint")}>
                      {[...results.exact, ...results.similar].map((p) => <PickRow key={p.id} p={p} />)}
                      {results.exact.length === 0 && results.similar.length === 0 && <p className="p-2 text-xs text-muted-foreground">{t("search.empty")}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">{t("rec.wl.f.dept")}</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d.code} value={d.code} className="text-sm">{bi(lang, d.ar, d.en)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-reason" className="text-xs text-muted-foreground">{t("rec.wl.f.reason")}</Label>
              <Input id="wl-reason" className="h-11" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("rec.wl.f.reasonHint")} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">{t("common.priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p} className="text-sm">{t(`priority.${p}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="h-11" onClick={() => setAddOpen(false)}>{t("common.close")}</Button>
            <Button className="h-11 px-6" disabled={busy || !patient} onClick={submitAdd}>{busy ? t("common.loading") : t("rec.wl.submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* offer-appointment dialog: datetime-local → appointment code */}
      <Dialog open={!!offerRow} onOpenChange={(o) => !o && setOfferRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle className="text-sm">{t("rec.wl.offerTitle")}</DialogTitle>
            <DialogDescription className="text-xs">{offerRow ? `${bi(lang, offerRow.patient.nameAr, offerRow.patient.nameEn)} · ${offerRow.patient.mrn}${offerRow.dept ? ` · ${bi(lang, offerRow.dept.nameAr, offerRow.dept.nameEn)}` : ""}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-slot" className="text-xs text-muted-foreground">{t("rec.wl.f.slot")}</Label>
            <Input id="wl-slot" type="datetime-local" dir="ltr" className="h-11 font-mono" value={slot} onChange={(e) => setSlot(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">{t("rec.wl.f.slotHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="h-11" onClick={() => setOfferRow(null)}>{t("common.close")}</Button>
            <Button className="h-11 px-6" disabled={busy || !slot} onClick={submitOffer}>{busy ? t("common.loading") : t("rec.wl.offerSubmit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
